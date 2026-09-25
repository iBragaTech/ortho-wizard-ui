import { readFile, mkdir, open, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

export async function openDatabase(env = process.env) {
  const mode = env.PORTAL_DB_MODE || "pglite";
  if (mode === "pglite") {
    const directory =
      env.PORTAL_DATA_DIR === ":memory:"
        ? undefined
        : resolve(env.PORTAL_DATA_DIR || "./.local/pgdata");
    let lock;
    if (directory) {
      await mkdir(directory, { recursive: true });
      lock = await open(`${directory}.lock`, "wx", 0o600);
      await lock.writeFile(String(process.pid));
    }
    try {
      const db = new PGlite(directory);
      await db.waitReady;
      const originalClose = db.close.bind(db);
      db.close = async () => {
        await originalClose();
        if (lock) {
          await lock.close();
          await unlink(`${directory}.lock`);
          lock = undefined;
        }
      };
      return db;
    } catch (error) {
      if (lock) {
        await lock.close();
        await unlink(`${directory}.lock`);
      }
      throw error;
    }
  }
  if (mode !== "postgres") throw new Error("PORTAL_DB_MODE inválido.");
  if (!env.PGHOST || !env.PGDATABASE || !env.PGUSER || !env.PGPASSWORD) {
    throw new Error("Configure PGHOST, PGDATABASE, PGUSER e PGPASSWORD.");
  }
  const sslMode = env.PGSSLMODE || "verify-full";
  if (!["verify-full", "disable"].includes(sslMode))
    throw new Error("PGSSLMODE deve ser verify-full ou disable.");
  const pool = new pg.Pool({
    host: env.PGHOST,
    port: Number(env.PGPORT || 5432),
    database: env.PGDATABASE,
    user: env.PGUSER,
    password: env.PGPASSWORD,
    max: 5,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
    ssl:
      sslMode === "disable"
        ? false
        : {
            rejectUnauthorized: true,
            ...(env.PGSSLROOTCERT ? { ca: await readFile(env.PGSSLROOTCERT, "utf8") } : {}),
          },
  });
  pool.on("error", () => console.error("Conexão PostgreSQL interrompida."));
  return {
    query: (sql, params) => pool.query(sql, params),
    exec: (sql) => pool.query(sql),
    close: () => pool.end(),
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn({
          query: (sql, params) => client.query(sql, params),
          exec: (sql) => client.query(sql),
        });
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

export async function migrate(db) {
  await db.transaction(async (tx) => {
    await tx.exec(
      "CREATE SCHEMA IF NOT EXISTS portal; CREATE TABLE IF NOT EXISTS portal.schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());",
    );
    await tx.exec("LOCK TABLE portal.schema_migrations IN EXCLUSIVE MODE");
    const applied = await tx.query(
      "SELECT version FROM portal.schema_migrations WHERE version = 1",
    );
    if (!applied.rows.length) {
      await tx.exec(await readFile(new URL("./schema.sql", import.meta.url), "utf8"));
      await tx.query("INSERT INTO portal.schema_migrations(version) VALUES (1)");
    }
    const exportMigration = await tx.query(
      "SELECT version FROM portal.schema_migrations WHERE version = 2",
    );
    if (!exportMigration.rows.length) {
      await tx.exec(await readFile(new URL("./export-schema.sql", import.meta.url), "utf8"));
      await tx.query("INSERT INTO portal.schema_migrations(version) VALUES (2)");
    }
    if (
      !(await tx.query("SELECT version FROM portal.schema_migrations WHERE version=3")).rows.length
    ) {
      await tx.exec(await readFile(new URL("./tasy-users-schema.sql", import.meta.url), "utf8"));
      await tx.query("INSERT INTO portal.schema_migrations(version) VALUES (3)");
    }
    if (
      !(await tx.query("SELECT version FROM portal.schema_migrations WHERE version=4")).rows.length
    ) {
      await tx.exec(
        "ALTER TABLE portal.users DROP CONSTRAINT users_perfil_check; ALTER TABLE portal.users ADD CONSTRAINT users_perfil_check CHECK (perfil IN ('Administrador','Comercial','Médico','Custos'));",
      );
      await tx.query("INSERT INTO portal.schema_migrations(version) VALUES (4)");
    }
    if (
      !(await tx.query("SELECT version FROM portal.schema_migrations WHERE version=5")).rows.length
    ) {
      await tx.exec(
        "ALTER TABLE portal.tasy_exports DROP CONSTRAINT tasy_exports_state_check; ALTER TABLE portal.tasy_exports ADD CONSTRAINT tasy_exports_state_check CHECK (state IN ('queued','sending','unknown','confirmed'));",
      );
      await tx.query("INSERT INTO portal.schema_migrations(version) VALUES (5)");
    }
    if (
      !(await tx.query("SELECT version FROM portal.schema_migrations WHERE version=6")).rows.length
    ) {
      await tx.exec(
        await readFile(new URL("./surgical-appointments-schema.sql", import.meta.url), "utf8"),
      );
      await tx.query("INSERT INTO portal.schema_migrations(version) VALUES (6)");
    }
    if (
      !(await tx.query("SELECT version FROM portal.schema_migrations WHERE version=7")).rows.length
    ) {
      await tx.exec(`ALTER TABLE portal.requests DROP CONSTRAINT requests_status_check;
        ALTER TABLE portal.requests ADD CONSTRAINT requests_status_check CHECK
        (status IN ('pendente','em_analise','aguardando_medico','aguardando_comercial','concluido',
        'aguardando_cotacao','em_aprovacao','aguardando_pagamento','aguardando_documentacao',
        'cancelado_paciente','cancelado_estabelecimento'));`);
      await tx.query("INSERT INTO portal.schema_migrations(version) VALUES (7)");
    }
  });
}
