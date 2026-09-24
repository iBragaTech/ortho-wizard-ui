import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase, migrate } from "../src/portal/database.mjs";
import { createUser } from "../src/portal/auth.mjs";
import { createPortalApp } from "../src/portal/app.mjs";
import { createPortalOperations } from "../src/portal/operations.mjs";
import { createExportService } from "../src/portal/export.mjs";

const selection = {
  cdPessoaFisica: "123",
  cdConvenio: "29",
  cdCategoria: "2",
  procedimentos: [{ codigo: "10", origem: "1", quantidade: 2 }],
  materiais: [],
};
const input = {
  nome: "Test",
  cpf: "52998224725",
  nascimento: "1990-01-01",
  telefone: "",
  origem: "medico",
  tasy: selection,
  medico: {
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
  },
};
const principal = {
  enabled: true,
  tasyUsername: "doctor",
  tasyEstablishment: 2,
  tasyProfile: 10,
  operations: ["pessoas-fisicas.consultar", "precos.procedimento", "orcamentos.enviar"],
  pessoaFisicaIds: ["123"],
};

test("HTTP creation exports automatically, preserves one local request on retry and permits subsequent cost approval", async (t) => {
  const db = await openDatabase({ PORTAL_DB_MODE: "pglite", PORTAL_DATA_DIR: ":memory:" });
  await migrate(db);
  const doctor = await createUser(db, {
    nome: "Doctor",
    email: "doctor@test.com",
    perfil: "Médico",
    senha: "Password-for-testing",
  });
  const admin = await createUser(db, {
    nome: "Admin",
    email: "admin@test.com",
    perfil: "Administrador",
    senha: "Password-for-testing",
  });
  const exports = [];
  let failing = false;
  const app = await createPortalApp({
    db,
    logger: false,
    portalOrigin: "http://localhost:5173",
    principals: { [doctor.id]: principal, [admin.id]: { ...principal, tasyUsername: "admin" } },
    tasyExecute: async ({ name }) =>
      name === "pessoas-fisicas.consultar"
        ? { nrCpf: input.cpf }
        : { valorProcedimento: 200, honorarios: 50 },
    budgetExporter: async (snapshot, p) => {
      exports.push({ snapshot, principal: p });
      if (failing) throw new Error("lost confirmation");
      return { nrOrcamento: "789" };
    },
  });
  t.after(async () => {
    await app.close();
    await db.close();
  });
  const login = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { email: "doctor@test.com", senha: "Password-for-testing" },
  });
  const headers = { authorization: `Bearer ${login.json().data.token}` };
  const requestKey = randomUUID();
  const create = () =>
    app.inject({
      method: "POST",
      url: "/v1/portal/createRequest",
      headers,
      payload: { ...input, requestKey },
    });
  const first = await create();
  assert.equal(first.statusCode, 200, first.body);
  assert.equal(first.json().data, requestKey);
  assert.equal(exports.length, 1);
  assert.equal(exports[0].principal.tasyUsername, "doctor");
  assert.equal(exports[0].snapshot.data.tasy.procedimentos[0].quantidade, 2);
  const status = await app.inject({
    method: "GET",
    url: `/v1/requests/${requestKey}/tasy`,
    headers,
  });
  assert.equal(status.json().data.state, "confirmed");
  assert.equal((await create()).json().data, requestKey);
  assert.equal(exports.length, 1);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM portal.requests")).rows[0].n, 1);
  const run = createPortalOperations(db, { auditIdentity: () => "admin" });
  await run("approveRequest", { id: requestKey, revisao: 1 }, admin);
  assert.equal(
    (await db.query("SELECT status FROM portal.requests WHERE id=$1", [requestKey])).rows[0].status,
    "concluido",
  );
  failing = true;
  const second = await app.inject({
    method: "POST",
    url: "/v1/portal/createRequest",
    headers,
    payload: { ...input, requestKey: randomUUID() },
  });
  assert.equal(second.statusCode, 200, second.body);
  const failedId = second.json().data;
  assert.equal(
    (await db.query("SELECT state FROM portal.tasy_exports WHERE request_id=$1", [failedId]))
      .rows[0].state,
    "unknown",
  );
  assert.equal((await db.query("SELECT count(*)::int AS n FROM portal.requests")).rows[0].n, 2);
  failing = false;
  const retry = await app.inject({ method: "POST", url: `/v1/requests/${failedId}/tasy`, headers });
  assert.equal(retry.statusCode, 200, retry.body);
  assert.deepEqual(exports.at(-1).snapshot, exports.at(-2).snapshot);
});

test("durable queue survives service restart; enqueue failures roll back local creation", async (t) => {
  const db = await openDatabase({ PORTAL_DB_MODE: "pglite", PORTAL_DATA_DIR: ":memory:" });
  t.after(() => db.close());
  await migrate(db);
  const doctor = await createUser(db, {
    nome: "Doctor",
    email: "doctor@test.com",
    perfil: "Médico",
    senha: "Password-for-testing",
  });
  const principals = { [doctor.id]: principal };
  const service = createExportService({
    db,
    principals,
    send: async () => ({ nrOrcamento: "789" }),
  });
  const run = createPortalOperations(db, { enqueueExport: service.enqueue });
  const requestKey = randomUUID();
  await run("createRequest", { ...input, requestKey }, doctor);
  assert.equal((await service.status(requestKey, doctor)).state, "queued");
  const restarted = createExportService({
    db,
    principals,
    send: async () => ({ nrOrcamento: "789" }),
  });
  await restarted.drainQueued();
  assert.equal((await restarted.status(requestKey, doctor)).state, "confirmed");
  const failed = createPortalOperations(db, {
    enqueueExport: async () => {
      throw Error("cannot enqueue");
    },
  });
  await assert.rejects(failed("createRequest", { ...input, requestKey: randomUUID() }, doctor));
  assert.equal((await db.query("SELECT count(*)::int AS n FROM portal.requests")).rows[0].n, 1);
  await assert.rejects(
    run("createRequest", { ...input, requestKey }, { ...doctor, id: randomUUID() }),
    { code: "REQUEST_KEY_CONFLICT" },
  );
});
