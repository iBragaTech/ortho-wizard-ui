import { importLegacyLinks, createLinkResolver } from "./tasy-users.mjs";
import { createApp } from "../app.mjs";
import { createLocalAuth, publicUser } from "./auth.mjs";
import { createPortalOperations } from "./operations.mjs";
import { ApiError } from "../errors.mjs";
import { createQuoteCalculator } from "./pricing.mjs";
import { createExportService } from "./export.mjs";
import { randomUUID } from "node:crypto";

export async function createPortalApp({
  db,
  portalOrigin,
  tasyExecute,
  principals = {},
  logger = true,
  budgetExporter,
  validateTasyLink,
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
  const run = createPortalOperations(db, {
    calculateQuote: tasyExecute
      ? createQuoteCalculator({ execute: tasyExecute, principals, resolvePrincipal })
      : undefined,
    auditIdentity: async (user, tx) => (await resolvePrincipal(user, tx)).tasyUsername,
    validateTasyLink,
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
  const exports = createExportService({ db, send: budgetExporter, principals, resolvePrincipal });
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
  app.post("/v1/portal/:operation", { onRequest: signed }, async (request) => ({
    data: await run(request.params.operation, request.body, request.portalUser),
    requestId: request.id,
  }));
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
