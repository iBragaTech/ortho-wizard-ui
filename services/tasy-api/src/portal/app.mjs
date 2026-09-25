import { importLegacyLinks, createLinkResolver } from "./tasy-users.mjs";
import { createApp } from "../app.mjs";
import { createLocalAuth, publicUser } from "./auth.mjs";
import { createPortalOperations } from "./operations.mjs";
import { ApiError } from "../errors.mjs";
import { createQuoteCalculator } from "./pricing.mjs";
import { createExportService } from "./export.mjs";
import { randomUUID } from "node:crypto";
import { createReturnSync } from "./tasy-return.mjs";

export async function createPortalApp({
  db,
  portalOrigin,
  tasyExecute,
  principals = {},
  logger = true,
  budgetExporter,
  validateTasyLink,
  budgetReader,
  approvalRule,
}) {
  await importLegacyLinks(db, principals);
  const resolvePrincipal = createLinkResolver(db, validateTasyLink);
  const auth = await createLocalAuth(db);
  const app = await createApp({
    portalOrigin,
    logger,
    authenticate: async (header) => {
      const user = await auth.authenticate(header);
      if (!tasyExecute)
        throw new ApiError(
          503,
          "TASY_DISABLED",
          "A consulta ao Tasy ainda não está habilitada neste ambiente.",
        );
      const principal = await resolvePrincipal(user);
      if (!["Custos", "Administrador"].includes(user.perfil)) {
        return {
          ...principal,
          operations: principal.operations.filter(
            (name) => !name.startsWith("precos.") && name !== "orcamentos.enviar",
          ),
        };
      }
      return principal;
    },
    execute:
      tasyExecute ||
      (async () => {
        throw new ApiError(503, "TASY_DISABLED", "Integração Tasy desabilitada.");
      }),
  });
  const exports = createExportService({ db, send: budgetExporter, principals, resolvePrincipal });
  const returnSync = budgetReader
    ? createReturnSync({ db, read: budgetReader, approvalRule })
    : null;
  const run = createPortalOperations(db, {
    enqueueExport: budgetExporter ? exports.enqueue : undefined,
    calculateQuote: tasyExecute
      ? createQuoteCalculator({ execute: tasyExecute, principals, resolvePrincipal })
      : undefined,
    auditIdentity: async (user, tx) => (await resolvePrincipal(user, tx)).tasyUsername,
    validateTasyLink,
    tasyManaged: !!returnSync,
    syncPatientPhone: tasyExecute
      ? async (input, user, tx) =>
          tasyExecute({
            name: "pessoas-fisicas.atualizar-telefone",
            body: input,
            principal: await resolvePrincipal(user, tx),
            requestId: randomUUID(),
          })
      : undefined,
  });
  if (budgetExporter) {
    let draining;
    let timer;
    const drain = () => {
      if (!draining)
        draining = exports
          .drainQueued()
          .catch(() => app.log.warn("Não foi possível processar a fila de envios Tasy."))
          .finally(() => {
            draining = undefined;
          });
    };
    app.addHook("onReady", async () => {
      await db.query(
        "UPDATE portal.tasy_exports SET state='unknown',error_code='PROCESS_INTERRUPTED',updated_at=now() WHERE state='sending'",
      );
      drain();
      timer = setInterval(drain, 30000);
      timer.unref();
    });
    app.addHook("preClose", async () => {
      clearInterval(timer);
      if (draining) await draining;
    });
  }
  if (returnSync) {
    let timer;
    const sync = () =>
      returnSync.sync().catch(() => app.log.warn("Sincronização de retorno Tasy pendente."));
    app.addHook("onReady", async () => {
      await db.query(`UPDATE portal.requests r SET data=data || '{"tasyGerenciado":true}'::jsonb
        WHERE EXISTS (SELECT 1 FROM portal.tasy_exports e WHERE e.request_id=r.id)`);
      void sync();
      timer = setInterval(() => void sync(), 30000);
      timer.unref();
    });
    app.addHook("preClose", async () => {
      clearInterval(timer);
      await returnSync.sync();
    });
  }
  const signed = async (request) => {
    request.portalUser = await auth.authenticate(request.headers.authorization);
  };
  app.post(
    "/v1/auth/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request) => ({ data: await auth.login(request.body), requestId: request.id }),
  );
  app.get("/v1/auth/me", { onRequest: signed }, async (request) => ({
    data: publicUser(request.portalUser),
    requestId: request.id,
  }));
  app.post("/v1/auth/logout", { onRequest: signed }, async (request) => {
    await auth.logout(request.portalUser);
    return { data: null, requestId: request.id };
  });
  app.post("/v1/portal/:operation", { onRequest: signed }, async (request) => {
    const data = await run(request.params.operation, request.body, request.portalUser);
    if (request.params.operation === "createRequest" && budgetExporter) {
      try {
        await exports.submit({ id: data }, request.portalUser);
      } catch (error) {
        // Creation is already durable. Return its ID even when Oracle is unavailable;
        // retrying creation would produce a second request instead of reconciling this one.
        app.log.warn(
          {
            requestId: request.id,
            operation: "automatic_tasy_export",
            code: error instanceof ApiError ? error.code : "EXPORT_FAILED",
          },
          "tasy_export_pending",
        );
      }
    }
    return { data, requestId: request.id };
  });
  app.get("/v1/requests/:id/tasy", { onRequest: signed }, async (request) => {
    if (!/^[0-9a-f-]{36}$/i.test(request.params.id))
      throw new ApiError(400, "INVALID_INPUT", "Identificador inválido.");
    return { data: await exports.status(request.params.id, request.portalUser) };
  });
  app.post("/v1/requests/:id/tasy", { onRequest: signed }, async (request) => ({
    data: await exports.submit({ id: request.params.id }, request.portalUser),
  }));
  return app;
}
