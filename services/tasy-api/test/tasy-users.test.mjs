import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase, migrate } from "../src/portal/database.mjs";
import { createPortalOperations } from "../src/portal/operations.mjs";
import { createLocalAuth, createUser } from "../src/portal/auth.mjs";
import {
  createLinkResolver,
  createTasyLinkValidator,
  importLegacyLinks,
} from "../src/portal/tasy-users.mjs";
import { createPortalApp } from "../src/portal/app.mjs";

test("administrator must provide a valid individual Tasy link; unique identity, live resolution and audit persist", async (t) => {
  const db = await openDatabase({ PORTAL_DB_MODE: "pglite", PORTAL_DATA_DIR: ":memory:" });
  t.after(() => db.close());
  await migrate(db);
  await migrate(db);
  const admin = await createUser(db, {
    nome: "Admin",
    email: "admin@example.test",
    perfil: "Administrador",
    senha: "local-password-test",
  });
  const denied = { ...admin, perfil: "Médico" };
  let validations = 0;
  const validate = async (v) => {
    validations++;
    if (v.cdPerfil === 999)
      throw Object.assign(new Error("Invalid profile"), { code: "INVALID_TASY_LINK" });
    return v;
  };
  const run = createPortalOperations(db, { validateTasyLink: validate });
  const account = {
    nome: "Doctor",
    email: "doctor@example.test",
    perfil: "Médico",
    senha: "separate-local-password",
  };
  const link = {
    nmUsuario: "doctor",
    cdPerfil: 10,
    cdEstabelecimento: 2,
    consultarTodosPacientes: true,
  };
  await assert.rejects(run("createUser", account, admin), (e) => e.code === "INVALID_INPUT");
  await assert.rejects(
    run("createUser", { ...account, ...link }, denied),
    (e) => e.code === "FORBIDDEN",
  );
  assert.equal(validations, 0);
  await assert.rejects(
    run("createUser", { ...account, ...link, cdPerfil: 999 }, admin),
    (e) => e.code === "INVALID_TASY_LINK",
  );
  assert.equal((await db.query("SELECT count(*)::int n FROM portal.users")).rows[0].n, 1);
  await run("createUser", { ...account, ...link }, admin);
  const users = await run("listUsers", {}, admin);
  const doctor = users.find((u) => u.email === account.email);
  assert.equal(doctor.nmUsuario, "doctor");
  assert.equal(doctor.cdPerfil, 10);
  const resolve = createLinkResolver(db, validate);
  const p = await resolve(doctor);
  assert.equal(p.tasyUsername, "doctor");
  assert.equal(p.tasyProfile, 10);
  assert.equal(p.allPessoaFisica, true);
  assert.equal(p.canCreatePessoaFisica, false);
  assert.ok(p.operations.includes("orcamentos.enviar"));
  assert.ok(p.operations.includes("medicos.tempo-procedimento"));
  await assert.rejects(
    run(
      "createUser",
      { ...account, ...link, email: "other@example.test", nmUsuario: "DOCTOR" },
      admin,
    ),
    (e) => e.code === "ALREADY_EXISTS",
  );
  assert.equal((await db.query("SELECT count(*)::int n FROM portal.users")).rows[0].n, 2);
  await assert.rejects(
    run("saveUserTasyLink", { id: doctor.id, ...link }, denied),
    (e) => e.code === "FORBIDDEN",
  );
  await run("saveUserTasyLink", { id: doctor.id, ...link, cdPerfil: 20 }, admin);
  assert.equal((await resolve(doctor)).tasyProfile, 20);
  const audit = (
    await db.query("SELECT * FROM portal.tasy_user_link_events WHERE user_id=$1 ORDER BY id", [
      doctor.id,
    ])
  ).rows;
  assert.equal(audit.length, 2);
  assert.equal(audit[1].anterior.tasyProfile, 10);
  assert.equal(audit[1].novo.tasyProfile, 20);
  assert.equal(audit[1].actor_id, admin.id);
  await importLegacyLinks(db, { [doctor.id]: { ...p, tasyProfile: 88 } });
  assert.equal((await resolve(doctor)).tasyProfile, 20);
  const auth = await createLocalAuth(db);
  const logged = await auth.login({ email: account.email, senha: account.senha });
  assert.equal(logged.user.id, doctor.id);
  await assert.rejects(
    auth.login({ email: account.email, senha: "pretend-tasy-password" }),
    (e) => e.code === "UNAUTHORIZED",
  );
});

test("Oracle link validation reads no password, verifies memberships and validity with binds", async () => {
  const calls = [];
  const c = {
    execute: async (sql, binds) => {
      calls.push({ sql, binds });
      return { rows: sql.includes("SELECT u.nm_usuario") ? [{ nmUsuario: "canonical" }] : [] };
    },
    rollback: async () => {},
    close: async () => {},
  };
  const validate = createTasyLinkValidator({ getConnection: async () => c });
  const result = await validate({ nmUsuario: "Canonical", cdPerfil: 10, cdEstabelecimento: 2 });
  assert.equal(result.nmUsuario, "canonical");
  const query = calls[1];
  assert.equal(query.binds.usuario, "Canonical");
  assert.ok(query.sql.includes("e.nm_usuario_param=u.nm_usuario"));
  assert.ok(query.sql.includes("up.cd_perfil=:perfil"));
  assert.ok(query.sql.includes("up.dt_validade"));
  assert.ok(!/senha|password|ds_senha/i.test(query.sql));
  c.execute = async () => ({ rows: [] });
  await assert.rejects(
    validate({ nmUsuario: "invalid", cdPerfil: 10, cdEstabelecimento: 2 }),
    (e) => e.code === "INVALID_TASY_LINK",
  );
});

test("HTTP routes resolve the saved identity, including price audit inside a transaction", async (t) => {
  const db = await openDatabase({ PORTAL_DB_MODE: "pglite", PORTAL_DATA_DIR: ":memory:" });
  await migrate(db);
  const admin = await createUser(db, {
    nome: "Admin",
    email: "admin@example.test",
    perfil: "Administrador",
    senha: "local-password-test",
  });
  const principal = {
    enabled: true,
    tasyUsername: "original",
    tasyProfile: 10,
    tasyEstablishment: 2,
    operations: ["usuarios.consultar"],
    allPessoaFisica: true,
  };
  const app = await createPortalApp({
    db,
    portalOrigin: "http://localhost:5173",
    logger: false,
    principals: { [admin.id]: principal },
    validateTasyLink: async (v) => v,
    tasyExecute: async ({ principal }) => ({
      nome: principal.tasyUsername,
      perfil: principal.tasyProfile,
    }),
  });
  t.after(async () => {
    await app.close();
    await db.close();
  });
  const login = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { email: "admin@example.test", senha: "local-password-test" },
  });
  const headers = { authorization: `Bearer ${login.json().data.token}` };
  const call = (operation, payload) =>
    app.inject({ method: "POST", url: `/v1/portal/${operation}`, headers, payload });
  assert.equal(
    (
      await call("saveUserTasyLink", {
        id: admin.id,
        nmUsuario: "updated",
        cdPerfil: 20,
        cdEstabelecimento: 2,
      })
    ).statusCode,
    200,
  );
  const response = await app.inject({
    method: "POST",
    url: "/v1/operations/usuarios.consultar",
    headers,
    payload: { nmUsuario: "updated" },
  });
  assert.deepEqual(response.json().data, { nome: "updated", perfil: 20 });
  const ref = {
    completo: false,
    itens: [
      {
        tipo: "material",
        codigo: "1",
        quantidade: 1,
        pendente: true,
        referencia: { valorMaterial: 0 },
      },
    ],
  };
  const id = (
    await db.query(
      "INSERT INTO portal.requests(numero,created_by,status,data) VALUES ('TEST',$1,'em_analise',$2::jsonb) RETURNING id",
      [admin.id, JSON.stringify({ precificacao: { referencia: ref, revisao: 1, ajustes: [] } })],
    )
  ).rows[0].id;
  const confirm = await call("confirmZeroPrice", {
    id,
    revisao: 1,
    item: { tipo: "material", codigo: "1" },
    motivo: "Sem custo neste teste",
  });
  assert.equal(confirm.statusCode, 200);
  const data = (await db.query("SELECT data FROM portal.requests WHERE id=$1", [id])).rows[0].data;
  assert.equal(data.precificacao.confirmacoesZero[0].nmUsuario, "updated");
});
