import test from "node:test";
import assert from "node:assert/strict";
import { pessoaFisicaOperations } from "../src/pessoa-fisica.mjs";
import { createExecutor } from "../src/executor.mjs";
import { openDatabase, migrate } from "../src/portal/database.mjs";
import { createPortalOperations } from "../src/portal/operations.mjs";
import { createLinkResolver, storeLink } from "../src/portal/tasy-users.mjs";

const name = "pessoas-fisicas.atualizar-telefone";
const principal = {
  subject: "doctor",
  tasyUsername: "doctor",
  tasyEstablishment: 2,
  tasyProfile: 3,
  operations: [name],
  pessoaFisicaIds: ["123"],
  canUpdatePessoaFisica: false,
};
const input = {
  cdPessoaFisica: "123",
  nrCpf: "52998224725",
  telefone: "+55 (31) 99999-1234",
  anterior: "(31) 98888-1234",
};
function oracle({ current = "988881234", writes = true, dml = true, failCommit = false } = {}) {
  const calls = [];
  const connection = {
    execute: async (sql, binds) => {
      calls.push({ sql, binds });
      if (sql.includes('AS "triggers"'))
        return { rows: [{ triggers: "S", usuario: "doctor", estabelecimento: 2, perfil: 3 }] };
      if (sql.startsWith("SELECT"))
        return {
          rows: [
            {
              cdPessoaFisica: "123",
              nrCpf: input.nrCpf,
              nrTelefoneCelular: current,
              nrDddCelular: "31",
              nrDdiCelular: "55",
            },
          ],
        };
      return { rowsAffected: 1 };
    },
    commit: async () => {
      calls.push("commit");
      if (failCommit) throw new Error("connection lost");
    },
    rollback: async () => calls.push("rollback"),
    close: async (options) => calls.push({ close: options }),
  };
  const execute = createExecutor({
    pool: { getConnection: async () => connection },
    operations: pessoaFisicaOperations({ directDmlEnabled: dml }),
    writesEnabled: writes,
    callTimeout: 10000,
    audit: () => {},
  });
  return {
    calls,
    run: (body = input, p = principal) => execute({ name, body, principal: p, requestId: "test" }),
  };
}

test("phone-only write uses the physician identity, DDD/DDI, row lock and a committed transaction", async () => {
  const f = oracle();
  await f.run();
  const update = f.calls.find((c) => c.sql?.startsWith("UPDATE"));
  assert.deepEqual(update.binds, {
    telefone: "999991234",
    ddd: "31",
    ddi: "55",
    nmUsuario: "doctor",
    cdPessoaFisica: "123",
  });
  assert.doesNotMatch(update.sql, /nm_pessoa_fisica|dt_nascimento|nr_cpf/);
  assert.ok(f.calls.some((c) => c.sql?.includes("FOR UPDATE WAIT 5")));
  assert.ok(f.calls.includes("commit"));
  assert.deepEqual(f.calls.at(-1), { close: { drop: true } });
});

test("phone updates reject other fields, invalid numbers, wrong CPF, scope and disabled writes", async () => {
  for (const body of [
    { ...input, nmPessoaFisica: "changed" },
    { ...input, telefone: "123" },
    { ...input, telefone: "" },
    { ...input, telefone: "call 31999991234" },
    { ...input, telefone: "+1 212 555 1234" },
  ])
    await assert.rejects(oracle().run(body), { code: "INVALID_INPUT" });
  await assert.rejects(oracle().run({ ...input, nrCpf: "12345678901" }), {
    code: "PATIENT_CHANGED",
  });
  await assert.rejects(oracle().run(input, { ...principal, pessoaFisicaIds: [] }), {
    code: "FORBIDDEN",
  });
  await assert.rejects(oracle({ writes: false }).run(), { code: "WRITES_DISABLED" });
  await assert.rejects(oracle({ dml: false }).run(), { code: "MAPPING_NOT_APPROVED" });
});

test("stale phone is not overwritten, retry is idempotent and lost commit stays uncertain", async () => {
  const stale = oracle({ current: "977771234" });
  await assert.rejects(stale.run(), { code: "RECORD_CHANGED" });
  assert.ok(!stale.calls.some((c) => c.sql?.startsWith("UPDATE")));
  const retry = oracle({ current: "999991234" });
  await retry.run();
  assert.ok(!retry.calls.some((c) => c.sql?.startsWith("UPDATE")));
  await assert.rejects(oracle({ failCommit: true }).run(), { code: "WRITE_OUTCOME_UNKNOWN" });
});

test("portal phone edit checks ownership, preserves all other fields and does not save on Tasy failure", async (t) => {
  const db = await openDatabase({ PORTAL_DB_MODE: "pglite", PORTAL_DATA_DIR: ":memory:" });
  t.after(() => db.close());
  await migrate(db);
  const doctor = (
    await db.query(
      "INSERT INTO portal.users(nome,email,perfil,password_hash) VALUES ('Doctor','doctor@test.com','Médico','unused') RETURNING id,perfil",
    )
  ).rows[0];
  const data = {
    paciente: {
      nome: "Patient",
      cpf: input.nrCpf,
      telefone: input.anterior,
      nascimento: "01/01/1990",
    },
    tasy: { cdPessoaFisica: "123" },
    observacoes: "Preserve",
    honorariosMedicos: 150,
  };
  const id = (
    await db.query(
      "INSERT INTO portal.requests(numero,created_by,status,data) VALUES ('T1',$1,'concluido',$2::jsonb) RETURNING id",
      [doctor.id, JSON.stringify(data)],
    )
  ).rows[0].id;
  await db.query(
    "INSERT INTO portal.tasy_exports(request_id,actor_id,tasy_username,snapshot,state) VALUES ($1,$2,'doctor','{}','unknown')",
    [id, doctor.id],
  );
  let fail = true;
  const calls = [];
  const run = createPortalOperations(db, {
    syncPatientPhone: async (body, user) => {
      calls.push({ body, user });
      if (fail) throw Object.assign(new Error("offline"), { code: "TASY_UNAVAILABLE" });
    },
  });
  const body = { id, telefone: input.telefone, anterior: input.anterior };
  await assert.rejects(
    run("updatePatientPhone", body, { ...doctor, id: "00000000-0000-4000-8000-000000000001" }),
    { code: "NOT_FOUND" },
  );
  await assert.rejects(run("updatePatientPhone", { ...body, nome: "changed" }, doctor), {
    code: "INVALID_INPUT",
  });
  assert.equal(calls.length, 0);
  await assert.rejects(run("updatePatientPhone", body, doctor), { code: "TASY_UNAVAILABLE" });
  assert.deepEqual(
    (await db.query("SELECT data FROM portal.requests WHERE id=$1", [id])).rows[0].data,
    data,
  );
  fail = false;
  await run("updatePatientPhone", body, doctor);
  assert.deepEqual(
    (await db.query("SELECT data FROM portal.requests WHERE id=$1", [id])).rows[0].data,
    { ...data, paciente: { ...data.paciente, telefone: input.telefone } },
  );
  assert.equal((await db.query("SELECT count(*)::int AS n FROM portal.events")).rows[0].n, 1);
  assert.equal(calls.at(-1).body.cdPessoaFisica, "123");
  await assert.rejects(run("updatePatientPhone", body, doctor), { code: "RECORD_CHANGED" });
  await db.transaction((tx) =>
    storeLink(
      tx,
      doctor.id,
      {
        ...principal,
        enabled: true,
        operations: ["pessoas-fisicas.consultar"],
        canUpdatePessoaFisica: true,
      },
      doctor.id,
    ),
  );
  const resolved = await createLinkResolver(db)(doctor);
  assert.ok(resolved.operations.includes(name));
  assert.equal(resolved.canUpdatePessoaFisica, false);

  const newRequest = {
    nome: "Patient",
    cpf: input.nrCpf,
    nascimento: "1990-01-01",
    telefone: input.telefone,
    telefoneAnterior: input.anterior,
    origem: "medico",
    medico: {
      honorariosMedicos: 150,
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
    tasy: {
      cdPessoaFisica: "123",
      cdConvenio: "1",
      cdCategoria: "2",
      procedimentos: [{ codigo: "1", origem: "1" }],
      materiais: [],
    },
  };
  fail = true;
  await assert.rejects(run("createRequest", newRequest, doctor), { code: "TASY_UNAVAILABLE" });
  assert.equal((await db.query("SELECT count(*)::int AS n FROM portal.requests")).rows[0].n, 1);
  fail = false;
  const createdId = await run("createRequest", newRequest, doctor);
  assert.equal(
    (await db.query("SELECT data FROM portal.requests WHERE id=$1", [createdId])).rows[0].data
      .paciente.telefone,
    input.telefone,
  );
  assert.equal(calls.at(-1).body.anterior, input.anterior);
});
