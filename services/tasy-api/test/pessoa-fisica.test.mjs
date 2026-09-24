import test from "node:test";
import assert from "node:assert/strict";
import { pessoaFisicaOperations } from "../src/pessoa-fisica.mjs";
import { createExecutor } from "../src/executor.mjs";

const before = {
  nmPessoaFisica: "Pessoa de teste",
  dtNascimento: "1990-01-20",
  nrCpf: "52998224725",
};
const principal = {
  subject: "sub-1",
  tasyUsername: "arafaela",
  tasyEstablishment: 1,
  tasyProfile: 2,
  operations: [
    "pessoas-fisicas.consultar",
    "pessoas-fisicas.salvar",
    "pessoas-fisicas.atualizar-telefone",
  ],
  pessoaFisicaIds: ["123"],
  canCreatePessoaFisica: true,
};
function setup({
  row,
  duplicateCpf = false,
  insertError,
  session = { triggers: "S", usuario: "arafaela", estabelecimento: 1, perfil: 2 },
  returnedCode = "124",
  directDmlEnabled = true,
  failInitialization = false,
} = {}) {
  const calls = [];
  const closes = [];
  const connection = {
    execute: async (sql, binds, options) => {
      calls.push({ sql, binds, options });
      if (sql.startsWith("BEGIN") && failInitialization) throw new Error("initialization failed");
      if (sql.includes('AS "found"')) return { rows: duplicateCpf ? [{ found: 1 }] : [] };
      if (sql.includes('AS "triggers"')) return { rows: [session] };
      if (sql.startsWith("SELECT")) return { rows: row ? [row] : [] };
      if (sql.startsWith("INSERT") && insertError) throw insertError;
      if (sql.startsWith("INSERT"))
        return { rowsAffected: 1, outBinds: { codigoGerado: [returnedCode] } };
      return { rowsAffected: 1 };
    },
    commit: async () => calls.push("commit"),
    rollback: async () => calls.push("rollback"),
    close: async (options) => {
      closes.push(options);
      calls.push("close");
    },
  };
  const execute = createExecutor({
    pool: { getConnection: async () => connection },
    operations: pessoaFisicaOperations({ directDmlEnabled }),
    writesEnabled: true,
    callTimeout: 10000,
    audit: () => {},
  });
  return {
    calls,
    closes,
    run: (body, operation = "pessoas-fisicas.salvar", user = principal) =>
      execute({ name: operation, body, principal: user, requestId: "r1" }),
  };
}

test("insert delegates the code to the trigger and binds the authenticated audit user", async () => {
  const f = setup();
  assert.deepEqual(await f.run(before), { cdPessoaFisica: "124", acao: "inserido" });
  const insert = f.calls.find((call) => call.sql?.startsWith("INSERT"));
  assert.match(insert.sql, /nr_cpf/);
  assert.match(insert.sql, /TO_DATE\(:dtNascimento, 'FXYYYY-MM-DD'\)/);
  assert.match(insert.sql, /'@SEQUENCE'/);
  assert.match(insert.sql, /RETURNING cd_pessoa_fisica INTO :codigoGerado/);
  assert.equal(insert.binds.nmUsuario, principal.tasyUsername);
  assert.equal(insert.binds.cdEstabelecimento, principal.tasyEstablishment);
  assert.equal(insert.binds.nmPessoaFisica, before.nmPessoaFisica);
  assert.equal(
    f.calls.some((call) => call.sql?.includes("NEXTVAL")),
    false,
  );
  assert.equal(insert.options.autoCommit, false);
  assert.deepEqual(f.calls.slice(-2), ["commit", "close"]);
});

test("initializes server-owned context before verification and discards the write session", async () => {
  const f = setup();
  await f.run(before);
  assert.ok(f.calls[0].sql.startsWith("BEGIN"));
  assert.deepEqual(f.calls[0].binds, {
    nmUsuario: "arafaela",
    cdEstabelecimento: 1,
    cdPerfil: 2,
    executarTriggers: "S",
  });
  assert.match(f.calls[1].sql, /get_ie_executar_trigger/);
  assert.deepEqual(f.closes, [{ drop: true }]);
});

test("a partially initialized session is discarded and cannot execute DML", async () => {
  const f = setup({ failInitialization: true });
  await assert.rejects(f.run(before), { code: "TASY_UNAVAILABLE" });
  assert.equal(
    f.calls.some((call) => /^(INSERT|UPDATE)/.test(call.sql)),
    false,
  );
  assert.deepEqual(f.calls.slice(-2), ["rollback", "close"]);
  assert.deepEqual(f.closes, [{ drop: true }]);
});

test("update locks existing record, compares original values and commits changes", async () => {
  const f = setup({ row: { ...before, cdPessoaFisica: "123" } });
  const input = {
    ...before,
    nmPessoaFisica: "Nome atualizado",
    cdPessoaFisica: "123",
    anterior: before,
  };
  assert.deepEqual(await f.run(input), { cdPessoaFisica: "123", acao: "alterado" });
  assert.ok(f.calls.some((call) => /FOR UPDATE WAIT 5/.test(call.sql)));
  const update = f.calls.find((call) => call.sql?.startsWith("UPDATE"));
  assert.equal(update.binds.nmPessoaFisica, "Nome atualizado");
  assert.deepEqual(f.calls.slice(-2), ["commit", "close"]);
});

test("cannot overwrite concurrent changes, create with caller ID, or ignore a deleted record", async () => {
  const changed = setup({ row: { ...before, nmPessoaFisica: "Outro nome" } });
  await assert.rejects(changed.run({ ...before, cdPessoaFisica: "123", anterior: before }), {
    code: "RECORD_CHANGED",
  });
  assert.equal(
    changed.calls.some((call) => call.sql?.startsWith("UPDATE")),
    false,
  );
  const absent = setup();
  await assert.rejects(absent.run({ ...before, cdPessoaFisica: "123", anterior: before }), {
    code: "NOT_FOUND",
  });
  assert.equal(
    absent.calls.some((call) => call.sql?.startsWith("INSERT")),
    false,
  );
  const missingOriginal = setup();
  await assert.rejects(missingOriginal.run({ ...before, cdPessoaFisica: "123" }), {
    code: "INVALID_INPUT",
  });
  assert.equal(missingOriginal.calls.length, 0);
});

test("requires nonempty name, CPF with eleven digits and a real nonfuture birth date", async () => {
  for (const changes of [
    { nrCpf: undefined },
    { nrCpf: "123" },
    { dtNascimento: null },
    { dtNascimento: "2025-02-29" },
    { dtNascimento: "9999-01-01" },
    { nmPessoaFisica: "" },
    { nmPessoaFisica: "a".repeat(61) },
    { cdPessoaFisica: "12345678901", anterior: before },
    { sql: "DELETE FROM pessoa_fisica" },
  ]) {
    const f = setup();
    await assert.rejects(f.run({ ...before, ...changes }), { code: "INVALID_INPUT" });
    assert.equal(f.calls.length, 0);
  }
});

test("creation requires separate permission and updates/reads require record scope", async () => {
  const f = setup();
  await assert.rejects(f.run(before, undefined, { ...principal, canCreatePessoaFisica: false }), {
    code: "FORBIDDEN",
  });
  await assert.rejects(f.run({ cdPessoaFisica: "999" }, "pessoas-fisicas.consultar"), {
    code: "FORBIDDEN",
  });
  await assert.rejects(f.run({ ...before, cdPessoaFisica: "999", anterior: before }), {
    code: "FORBIDDEN",
  });
  assert.equal(
    f.calls.some((call) => call.sql?.startsWith("SELECT")),
    false,
  );
});

test("mapping and the correct Tasy context are required before writing", async () => {
  await assert.rejects(setup({ directDmlEnabled: false }).run(before), {
    code: "MAPPING_NOT_APPROVED",
  });
  await assert.rejects(setup().run(before, undefined, { ...principal, tasyProfile: undefined }), {
    code: "TASY_CONTEXT_NOT_CONFIGURED",
  });
  for (const change of [
    { triggers: "N" },
    { usuario: "other" },
    { estabelecimento: 99 },
    { perfil: 99 },
  ]) {
    const f = setup({
      session: { triggers: "S", usuario: "arafaela", estabelecimento: 1, perfil: 2, ...change },
    });
    await assert.rejects(f.run(before), { code: "TASY_CONTEXT_MISMATCH" });
    assert.equal(
      f.calls.some((call) => /^(INSERT|UPDATE)/.test(call.sql)),
      false,
    );
  }
});

test("unreplaced marker or invalid returned code rolls back instead of committing", async () => {
  for (const returnedCode of ["@SEQUENCE", "12345678901", undefined, null]) {
    const f = setup({ returnedCode: returnedCode === undefined ? "" : returnedCode });
    await assert.rejects(f.run(before), { code: "INVALID_GENERATED_CODE" });
    assert.deepEqual(f.calls.slice(-2), ["rollback", "close"]);
    assert.equal(f.calls.includes("commit"), false);
  }
});

test("existing CPF and unique constraint conflicts do not silently update another person", async () => {
  const existing = setup({ duplicateCpf: true });
  await assert.rejects(existing.run(before), { code: "PERSON_EXISTS" });
  assert.equal(
    existing.calls.some((call) => call.sql?.includes("NEXTVAL")),
    false,
  );
  const raced = setup({ insertError: { errorNum: 1 } });
  await assert.rejects(raced.run(before), { code: "PERSON_EXISTS" });
  assert.deepEqual(raced.calls.slice(-2), ["rollback", "close"]);
});
