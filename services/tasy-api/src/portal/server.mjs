import { createTasyLinkValidator } from "./tasy-users.mjs";
import { openDatabase, migrate } from "./database.mjs";
import { createPortalApp } from "./app.mjs";
import { readPrincipals } from "../config.mjs";
import { createOraclePool } from "../oracle.mjs";
import { createExecutor } from "../executor.mjs";
import { operations } from "../operations.mjs";
import { pessoaFisicaOperations } from "../pessoa-fisica.mjs";
import { catalogoOperations } from "../catalogos.mjs";
import { precoOperations } from "../precos.mjs";
import { createBudgetExporter } from "../orcamento-export.mjs";
import { readEncryptedSecret } from "../secrets.mjs";
let db, oracle, app;
try {
  const origin = process.env.PORTAL_ORIGIN || "http://localhost:5173";
  const url = new URL(origin);
  const allowPrivateHttp = process.env.PORTAL_ALLOW_PRIVATE_HTTP === "true";
  const privateHostname =
    /^(10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})$/.test(
      url.hostname,
    );
  if (
    url.origin !== origin ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        (["localhost", "127.0.0.1"].includes(url.hostname) || (allowPrivateHttp && privateHostname))
      ))
  )
    throw new Error("Origem inválida.");
  const port = Number(process.env.PORT || 3100);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Porta inválida.");
  db = await openDatabase();
  await migrate(db);
  let principals = {},
    tasyExecute;
  if (process.env.TASY_ENABLED === "true") {
    if (
      !process.env.ORACLE_USER ||
      (!process.env.ORACLE_PASSWORD &&
        (!process.env.ORACLE_PASSWORD_ENCRYPTED || !process.env.ORACLE_DECRYPTION_KEY_FILE)) ||
      !process.env.ORACLE_CONNECT_STRING
    )
      throw new Error("Configuração Oracle incompleta.");
    principals = await readPrincipals(
      process.env.TASY_PRINCIPALS_FILE || "./principals.local.json",
    );
    oracle = await createOraclePool({
      ...process.env,
      ORACLE_PASSWORD: await readEncryptedSecret({
        encryptedValue: process.env.ORACLE_PASSWORD_ENCRYPTED,
        keyFile: process.env.ORACLE_DECRYPTION_KEY_FILE,
        fallbackValue: process.env.ORACLE_PASSWORD,
      }),
      ORACLE_POOL_MAX: 4,
      ORACLE_CALL_TIMEOUT_MS: 10000,
    });
    tasyExecute = createExecutor({
      pool: oracle,
      operations: {
        ...operations,
        ...catalogoOperations,
        ...precoOperations,
        ...pessoaFisicaOperations({
          directDmlEnabled: process.env.TASY_PESSOA_FISICA_DML_ENABLED === "true",
        }),
      },
      writesEnabled: process.env.TASY_WRITES_ENABLED === "true",
      callTimeout: 10000,
      audit: (event) => app.log.info(event, "tasy_audit"),
    });
  }
  const budgetExporter =
    oracle &&
    process.env.TASY_BUDGET_EXPORT_ENABLED === "true" &&
    process.env.TASY_WRITES_ENABLED === "true"
      ? createBudgetExporter({ pool: oracle, enabled: true })
      : undefined;
  app = await createPortalApp({
    db,
    portalOrigin: origin,
    principals,
    tasyExecute,
    budgetExporter,
    validateTasyLink: createTasyLinkValidator(oracle),
  });
  app.addHook("onClose", async () => {
    if (oracle) await oracle.close(10);
    await db.close();
  });
  const shutdown = () =>
    app.close().catch(() => {
      process.exitCode = 1;
    });
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  await app.listen({ host: process.env.HOST || "127.0.0.1", port });
} catch {
  console.error(
    "Não foi possível iniciar o backend independente. Verifique a configuração e se outra instância está usando a base local.",
  );
  if (app) await app.close().catch(() => {});
  else {
    if (oracle) await oracle.close(0).catch(() => {});
    if (db) await db.close().catch(() => {});
  }
  process.exitCode = 1;
}
