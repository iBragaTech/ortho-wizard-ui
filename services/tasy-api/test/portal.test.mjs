import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase, migrate } from "../src/portal/database.mjs";
import { createUser } from "../src/portal/auth.mjs";
import { createPortalApp } from "../src/portal/app.mjs";

test("independent portal with a real embedded PostgreSQL database", async (t) => {
  const db = await openDatabase({ PORTAL_DB_MODE: "pglite", PORTAL_DATA_DIR: ":memory:" });
  await migrate(db);
  await migrate(db); // repeatable initialization, never recreates the data
  const password = "Only-for-this-test-2026!";
  const admin = await createUser(db, {
    nome: "Admin",
    email: "admin@example.test",
    perfil: "Administrador",
    senha: password,
  });
  const doctor = await createUser(db, {
    nome: "Doctor",
    email: "doctor@example.test",
    perfil: "Médico",
    senha: password,
  });
  await createUser(db, {
    nome: "Other",
    email: "other@example.test",
    perfil: "Médico",
    senha: password,
  });
  await createUser(db, {
    nome: "Commercial",
    email: "commercial@example.test",
    perfil: "Comercial",
    senha: password,
  });
  const app = await createPortalApp({
    db,
    portalOrigin: "http://localhost:5173",
    logger: false,
    validateTasyLink: async (v) => v,
  });
  t.after(async () => {
    await app.close();
    await db.close();
  });
  async function login(email, senha = password) {
    return app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, senha } });
  }
  const tokens = {};
  for (const name of ["admin", "doctor", "other", "commercial"]) {
    const response = await login(`${name}@example.test`);
    assert.equal(response.statusCode, 200);
    tokens[name] = response.json().data.token;
  }
  const call = (operation, payload = {}, name = "admin") =>
    app.inject({
      method: "POST",
      url: `/v1/portal/${operation}`,
      payload,
      headers: name ? { authorization: `Bearer ${tokens[name]}` } : {},
    });
  const fees = {
    honorariosMedicos: 100,
    diaria: null,
    cti: null,
    fisioterapia: null,
    tempoBloco: "",
    opme: "",
    anatomoPatologico: "",
    reservaSangue: "",
    equipeMultidisciplinar: "",
    obsMedico: "",
  };
  const patient = {
    nome: "Pessoa fictícia de teste",
    cpf: "529.982.247-25",
    nascimento: "1990-01-20",
    telefone: "",
  };
  let id;
  await t.test(
    "authentication uses hashed passwords and stores only hashed session tokens",
    async () => {
      const stored = (
        await db.query("SELECT password_hash FROM portal.users WHERE id=$1", [admin.id])
      ).rows[0];
      assert.match(stored.password_hash, /^scrypt:/);
      assert.notEqual(stored.password_hash, password);
      const sessions = (await db.query("SELECT token_hash FROM portal.sessions")).rows;
      assert.ok(sessions.every((s) => !Object.values(tokens).includes(s.token_hash)));
      assert.equal((await login("admin@example.test", "wrong")).statusCode, 401);
      assert.equal((await login("missing@example.test", "wrong")).statusCode, 401);
      assert.equal((await call("listRequests", {}, null)).statusCode, 401);
    },
  );
  await t.test(
    "doctor creates an owned request; other doctors cannot read or change it",
    async () => {
      const created = await call(
        "createRequest",
        { ...patient, origem: "medico", medico: fees },
        "doctor",
      );
      assert.equal(created.statusCode, 200);
      id = created.json().data;
      const read = await call("getRequest", { id }, "doctor");
      assert.equal(read.json().data.paciente.nome, patient.nome);
      assert.equal(read.json().data.status, "em_analise");
      assert.equal((await call("getRequest", { id }, "other")).statusCode, 404);
      assert.deepEqual((await call("listRequests", {}, "other")).json().data, []);
      assert.equal((await call("getTimeline", { id }, "other")).statusCode, 404);
      assert.equal((await call("saveDoctorFees", { id, input: fees }, "other")).statusCode, 404);
      assert.equal(
        (await call("saveDoctorFees", { id, input: fees }, "commercial")).statusCode,
        403,
      );
    },
  );
  await t.test("commercial cannot approve or set hospital prices", async () => {
    for (const who of ["doctor", "commercial"]) {
      assert.equal(
        (await call("saveHospitalValue", { id, valor: 500, obs: "teste" }, who)).statusCode,
        403,
      );
      assert.equal((await call("approveRequest", { id, revisao: 1 }, who)).statusCode, 403);
    }
    assert.equal((await call("getRequest", { id }, "doctor")).json().data.status, "em_analise");
  });
  await t.test("commercial request needs explicit physician assignment", async () => {
    const created = await call("createRequest", { ...patient }, "commercial");
    const pendingId = created.json().data;
    assert.equal(created.statusCode, 200);
    assert.equal((await call("getRequest", { id: pendingId }, "doctor")).statusCode, 404);
    assert.equal(
      (await call("assignDoctor", { id: pendingId, userId: doctor.id }, "commercial")).statusCode,
      200,
    );
    assert.equal((await call("getRequest", { id: pendingId }, "doctor")).statusCode, 200);
    assert.equal(
      (await call("saveDoctorFees", { id: pendingId, input: fees }, "doctor")).statusCode,
      200,
    );
  });
  await t.test("user management and settings are enforced in backend", async () => {
    assert.equal((await call("listUsers", {}, "doctor")).statusCode, 403);
    assert.equal(
      (
        await call(
          "createUser",
          { nome: "X", email: "x@example.test", perfil: "Administrador", senha: password },
          "commercial",
        )
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await call("createUser", {
          nome: "New",
          email: "new@example.test",
          nmUsuario: "newuser",
          cdPerfil: 10,
          cdEstabelecimento: 2,
          perfil: "Comercial",
          senha: password,
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await call("createUser", {
          nome: "New",
          email: "new@example.test",
          nmUsuario: "newuser",
          cdPerfil: 10,
          cdEstabelecimento: 2,
          perfil: "Comercial",
          senha: password,
        })
      ).statusCode,
      409,
    );
    const users = (await call("listUsers")).json().data;
    assert.ok(users.every((u) => !("password_hash" in u)));
    const settings = {
      nome: "Homologação",
      cnpj: "",
      endereco: "",
      telefone: "",
      emailNotificacoes: "",
    };
    assert.equal((await call("saveSettings", settings, "doctor")).statusCode, 403);
    assert.equal((await call("saveSettings", settings)).statusCode, 200);
    assert.equal((await call("getSettings", {}, "doctor")).json().data.nome, "Homologação");
    assert.equal(
      (await call("createDoctor", { nome: "Doctor", crm: "TEST", especialidade: "Teste" }))
        .statusCode,
      200,
    );
    assert.equal((await call("listDoctors", {}, "doctor")).json().data.length, 1);
  });
  await t.test("invalid input and unauthorized SQL operations are rejected", async () => {
    assert.equal(
      (
        await call(
          "createRequest",
          { ...patient, origem: "medico", medico: { ...fees, honorariosMedicos: -1 } },
          "doctor",
        )
      ).statusCode,
      400,
    );
    assert.equal(
      (await call("createRequest", { ...patient, nascimento: "2025-02-29" }, "commercial"))
        .statusCode,
      400,
    );
    assert.equal(
      (await call("createRequest", { ...patient, perfil: "Administrador" }, "commercial"))
        .statusCode,
      400,
    );
    assert.equal((await call("constructor")).statusCode, 404);
    assert.equal((await call("sql", { sql: "DELETE FROM portal.users" })).statusCode, 404);
  });
  await t.test("logout and disabled users invalidate access immediately", async () => {
    const logout = await app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      payload: {},
      headers: { authorization: `Bearer ${tokens.other}` },
    });
    assert.equal(logout.statusCode, 200);
    assert.equal((await call("listRequests", {}, "other")).statusCode, 401);
    await db.query("UPDATE portal.users SET ativo=false WHERE id=$1", [doctor.id]);
    assert.equal((await call("listRequests", {}, "doctor")).statusCode, 401);
    await db.query(
      "UPDATE portal.sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1",
      [admin.id],
    );
    assert.equal((await call("listRequests", {}, "admin")).statusCode, 401);
  });
});
