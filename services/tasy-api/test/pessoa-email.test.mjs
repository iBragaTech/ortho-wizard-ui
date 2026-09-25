import test from "node:test";
import assert from "node:assert/strict";
import { emailOperation } from "../src/pessoa-email.mjs";
import { createExecutor } from "../src/executor.mjs";
import { createPortalOperations } from "../src/portal/operations.mjs";
import { openDatabase, migrate } from "../src/portal/database.mjs";
import { createUser } from "../src/portal/auth.mjs";

const name = "pessoas-fisicas.atualizar-email";
const input = { cdPessoaFisica: "123", nrCpf: "52998224725", email: "paciente@example.test" };
function fixture({
  rows = [{ sequencia: 1, email: "old@example.test" }],
  cpf = input.nrCpf,
  directDmlEnabled = true,
  lostCommit = false,
} = {}) {
  const calls = [];
  let written = false;
  const c = {
    execute: async (sql, binds) => {
      calls.push({ sql, binds });
      if (sql.includes('AS "cpf"')) return { rows: [{ cpf }] };
      if (sql.startsWith("UPDATE ") || sql.startsWith("INSERT ")) {
        written = true;
        return { rowsAffected: 1 };
      }
      return { rows: written ? [{ sequencia: 1, email: input.email }] : rows };
    },
    commit: async () => {
      calls.push("commit");
      if (lostCommit) throw Error("disconnected");
    },
    rollback: async () => calls.push("rollback"),
    close: async () => calls.push("close"),
  };
  const execute = createExecutor({
    pool: { getConnection: async () => c },
    operations: {
      [name]: emailOperation({
        directDmlEnabled,
        canAccess: (p, id) => id === "123",
        preparePersonWrite: async () => calls.push("context"),
      }),
    },
    writesEnabled: true,
    callTimeout: 10000,
    audit: () => {},
  });
  return {
    calls,
    run: (body = input) =>
      execute({
        name,
        body,
        principal: { enabled: true, subject: "doctor", tasyUsername: "medico", operations: [name] },
        requestId: "test",
      }),
  };
}
test("email updates only residential contact using patient scope, CPF and authenticated audit identity", async () => {
  const f = fixture();
  assert.equal((await f.run()).acao, "alterado");
  assert.equal(f.calls[0], "context");
  const update = f.calls.find((c) => c.sql?.startsWith("UPDATE "));
  assert.match(update.sql, /ie_tipo_complemento=1/);
  assert.deepEqual(update.binds, {
    email: input.email,
    usuario: "medico",
    id: "123",
    sequencia: 1,
  });
  assert.doesNotMatch(update.sql, /ds_endereco|nr_telefone|nm_pessoa_fisica/i);
  assert.deepEqual(f.calls.slice(-2), ["commit", "close"]);
  assert.equal((await fixture({ rows: [] }).run()).acao, "inserido");
  const unchanged = fixture({ rows: [{ sequencia: 1, email: input.email }] });
  assert.equal((await unchanged.run()).acao, "inalterado");
  assert.ok(!unchanged.calls.some((c) => c.sql?.startsWith("UPDATE ")));
});
test("invalid email, different patient, duplicate complements and uncertain commits are handled", async () => {
  for (const body of [
    { ...input, email: "invalid" },
    { ...input, nmUsuario: "other" },
  ])
    await assert.rejects(fixture().run(body), { code: "INVALID_INPUT" });
  await assert.rejects(fixture().run({ ...input, cdPessoaFisica: "999" }), { code: "FORBIDDEN" });
  await assert.rejects(fixture({ cpf: "00000000000" }).run(), { code: "PATIENT_MISMATCH" });
  await assert.rejects(fixture({ rows: [{}, {}] }).run(), { code: "AMBIGUOUS_CONTACT" });
  await assert.rejects(fixture({ directDmlEnabled: false }).run(), { code: "WRITES_DISABLED" });
  await assert.rejects(fixture({ lostCommit: true }).run(), { code: "WRITE_OUTCOME_UNKNOWN" });
});
test("creating a medical request persists structured email only after Tasy confirms it", async (t) => {
  const db = await openDatabase({ PORTAL_DB_MODE: "pglite", PORTAL_DATA_DIR: ":memory:" });
  t.after(() => db.close());
  await migrate(db);
  const user = await createUser(db, {
    nome: "Doctor",
    email: "doctor@example.test",
    perfil: "Médico",
    senha: "Test-only-password-2026!",
  });
  let calls = 0;
  let fail = true;
  const run = createPortalOperations(db, {
    syncPatientEmail: async (v, actor) => {
      assert.deepEqual(v, input);
      assert.equal(actor.id, user.id);
      calls++;
      if (fail) throw Error("Tasy unavailable");
    },
  });
  const request = {
    requestKey: "72a07cfc-21cb-4a45-aa36-e1c98a3bc908",
    nome: "Paciente fictício",
    nascimento: "1990-01-01",
    cpf: input.nrCpf,
    telefone: "",
    email: input.email,
    origem: "medico",
    medico: {
      honorariosMedicos: 100,
      diaria: null,
      cti: null,
      fisioterapia: null,
      tempoBloco: "60",
      opme: "",
      anatomoPatologico: "",
      reservaSangue: "",
      equipeMultidisciplinar: "",
      obsMedico: "",
    },
    tasy: {
      cdPessoaFisica: "123",
      cdConvenio: "1",
      cdCategoria: "1",
      procedimentos: [{ codigo: "456", origem: "1" }],
      materiais: [],
    },
  };
  await assert.rejects(run("createRequest", request, user));
  assert.equal((await db.query("SELECT id FROM portal.requests")).rows.length, 0);
  fail = false;
  const id = await run("createRequest", request, user);
  assert.equal((await run("getRequest", { id }, user)).paciente.email, input.email);
  assert.equal(await run("createRequest", request, user), id);
  assert.equal(calls, 2);
});
