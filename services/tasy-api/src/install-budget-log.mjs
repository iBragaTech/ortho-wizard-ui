import { readFile } from "node:fs/promises";
import { createOraclePool } from "./oracle.mjs";
import { readEncryptedSecret } from "./secrets.mjs";

const pool = await createOraclePool({
  ...process.env,
  ORACLE_POOL_MAX: 1,
  ORACLE_PASSWORD: await readEncryptedSecret({
    encryptedValue: process.env.ORACLE_PASSWORD_ENCRYPTED,
    keyFile: process.env.ORACLE_DECRYPTION_KEY_FILE,
    fallbackValue: process.env.ORACLE_PASSWORD,
  }),
});
let connection;
try {
  connection = await pool.getConnection();
  connection.callTimeout = 15000;
  const existing = await connection.execute(
    `SELECT table_name FROM all_tables
     WHERE owner='TASY' AND table_name='AEBMG_PAINEL_ORÇAMENTO_LOG'`,
  );
  if (existing.rows.length) throw new Error("A tabela já existe; revise sua estrutura antes de instalar.");
  const sql = await readFile(new URL("../sql/painel-orcamento-log.sql", import.meta.url), "utf8");
  for (const statement of sql.split(/^\/\s*$/m).map((s) => s.trim()).filter(Boolean))
    await connection.execute(statement);
  const errors = await connection.execute(
    `SELECT line, position, text FROM all_errors
     WHERE owner='TASY' AND name='AEBMG_PAINEL_ORC_LOG_IMUTAVEL' ORDER BY sequence`,
  );
  if (errors.rows.length) throw new Error(JSON.stringify(errors.rows));
  console.log('Tabela TASY."AEBMG_PAINEL_ORÇAMENTO_LOG" criada; trigger compilada sem erros.');
} finally {
  if (connection) await connection.close();
  await pool.close(0);
}
