import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readConfig, readPrincipals } from "./config.mjs";
import { createAuthenticator } from "./auth.mjs";
import { createOraclePool } from "./oracle.mjs";
import { operations, validateOperations } from "./operations.mjs";
import { createExecutor } from "./executor.mjs";
import { createApp } from "./app.mjs";
import { pessoaFisicaOperations } from "./pessoa-fisica.mjs";
import { catalogoOperations } from "./catalogos.mjs";
import { precoOperations } from "./precos.mjs";

let pool;
let app;
try {
  const config = readConfig(process.env);
  const principals = await readPrincipals(config.TASY_PRINCIPALS_FILE);
  const builtIn = {
    ...operations,
    ...catalogoOperations,
    ...precoOperations,
    ...pessoaFisicaOperations({
      directDmlEnabled: config.TASY_PESSOA_FISICA_DML_ENABLED === "true",
    }),
  };
  const custom = config.TASY_OPERATIONS_FILE
    ? (await import(pathToFileURL(resolve(config.TASY_OPERATIONS_FILE)).href)).operations
    : {};
  validateOperations(custom);
  if (Object.keys(custom).some((name) => Object.hasOwn(builtIn, name))) {
    throw new Error("Operação customizada duplicada.");
  }
  const registry = validateOperations({ ...builtIn, ...custom });
  pool = await createOraclePool(config);
  const execute = createExecutor({
    pool,
    operations: registry,
    writesEnabled: config.TASY_WRITES_ENABLED === "true",
    callTimeout: config.ORACLE_CALL_TIMEOUT_MS,
    audit: (event) => app.log.info(event, "tasy_audit"),
  });
  app = await createApp({
    authenticate: createAuthenticator(config, principals),
    execute,
    portalOrigin: config.PORTAL_ORIGIN,
  });
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    try {
      await app.close();
      await pool.close(10);
    } catch {
      process.exitCode = 1;
    }
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  await app.listen({ host: config.HOST, port: config.PORT });
} catch {
  // No raw driver/config errors: they can contain internal addresses or secrets.
  console.error(
    "Falha ao iniciar a API. Verifique configuração, permissões dos arquivos e disponibilidade do Oracle.",
  );
  if (app) await app.close().catch(() => {});
  if (pool) await pool.close(0).catch(() => {});
  process.exitCode = 1;
}
