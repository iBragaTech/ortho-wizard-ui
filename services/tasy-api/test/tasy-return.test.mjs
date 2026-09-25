import test from "node:test";
import assert from "node:assert/strict";
import { createBudgetReader } from "../src/orcamento-retorno.mjs";
import { createReturnSync, returnStatus } from "../src/portal/tasy-return.mjs";
import { openDatabase, migrate } from "../src/portal/database.mjs";
import { createUser } from "../src/portal/auth.mjs";
import { createPortalOperations } from "../src/portal/operations.mjs";
import { canPrintQuote } from "../../../src/lib/tasy-workflow.ts";

test("approval requires explicit policy, valid receipt and preserves cancellation", () => {
  assert.throws(() => returnStatus({ statusCode: 2, receipt: true }));
  for (const rule of ["status_and_document", "document"]) {
    assert.equal(returnStatus({ statusCode: 2, receipt: false }, rule), "aguardando_pagamento");
    assert.equal(returnStatus({ statusCode: 2, receipt: true }, rule), "concluido");
    assert.equal(returnStatus({ statusCode: 3, receipt: true }, rule), "cancelado_paciente");
    assert.equal(returnStatus({ statusCode: 4, receipt: true }, rule), "cancelado_estabelecimento");
    assert.equal(returnStatus({ statusCode: 5, receipt: false }, rule), "aguardando_cotacao");
    assert.equal(returnStatus({ statusCode: 6, receipt: false }, rule), "aguardando_documentacao");
  }
  assert.equal(
    returnStatus({ statusCode: 1, receipt: true }, "status_and_document"),
    "em_aprovacao",
  );
  assert.equal(returnStatus({ statusCode: 1, receipt: true }, "document"), "concluido");
});

test("reader scopes by exported identity, uses native total and read-only transaction", async () => {
  const calls = [];
  const c = {
    execute: async (sql, binds) => {
      calls.push({ sql, binds });
      if (sql.includes("AEBMG_PORTAL_ORCAMENTO_ENVIO"))
        return { rows: [{ id: "10", statusCode: 1, total: 400 }] };
      if (sql.includes("FROM TASY.orcamento_paciente_proc p"))
        return { rows: [{ id: "1", total: 300, quantidade: 3 }] };
      if (sql.includes("FROM TASY.orcamento_paciente_mat m"))
        return { rows: [{ id: "2", total: 100, quantidade: 2 }] };
      if (sql.includes("orcamento_pac_doc")) return { rows: [{ count: 1 }] };
      return { rows: [] };
    },
    rollback: async () => calls.push("rollback"),
    close: async () => calls.push("close"),
  };
  const input = { id: "local", tasyId: "10", patientId: "20", establishment: 2 };
  const result = await createBudgetReader({ pool: { getConnection: async () => c } })(input);
  assert.equal(calls[0].sql, "SET TRANSACTION READ ONLY");
  assert.deepEqual(calls[1].binds, input);
  assert.match(calls[1].sql, /obter_valor_orc_pac/);
  assert.equal(result.total, 400);
  assert.equal(result.itens[0].total, 300); // no quantity multiplication
  assert.equal(result.receipt, true);
  assert.match(calls.find((x) => x.sql?.includes("orcamento_pac_doc")).sql, /nr_seq_tipo_doc=1/);
  assert.deepEqual(calls.slice(-2), ["rollback", "close"]);
  c.execute = async (sql) => ({ rows: [] });
  await assert.rejects(createBudgetReader({ pool: { getConnection: async () => c } })(input), {
    code: "TASY_LINK_CHANGED",
  });
});

test("PDF is available before payment only with a fresh complete Tasy snapshot", () => {
  const request = {
    tasyGerenciado: true,
    status: "em_aprovacao",
    tasyRetorno: { completo: true, consultadoEm: new Date().toISOString() },
  };
  assert.equal(canPrintQuote(request), true);
  assert.equal(canPrintQuote({ ...request, status: "aguardando_cotacao" }), false);
  assert.equal(canPrintQuote({ ...request, status: "cancelado_paciente" }), false);
  assert.equal(
    canPrintQuote({ ...request, tasyRetorno: { ...request.tasyRetorno, erro: "offline" } }),
    false,
  );
  assert.equal(
    canPrintQuote({
      ...request,
      tasyRetorno: { ...request.tasyRetorno, consultadoEm: "2020-01-01" },
    }),
    false,
  );
});

test("sync preserves source values, updates items/status, blocks local approval and survives Oracle failure", async (t) => {
  const db = await openDatabase({ PORTAL_DB_MODE: "pglite", PORTAL_DATA_DIR: ":memory:" });
  t.after(() => db.close());
  await migrate(db);
  await migrate(db);
  const user = await createUser(db, {
    nome: "Test",
    email: "return@example.test",
    perfil: "Administrador",
    senha: "Test-only-password-2026!",
  });
  const run = createPortalOperations(db);
  const id = await run(
    "createRequest",
    {
      nome: "Paciente fictício",
      nascimento: "1990-01-01",
      cpf: "52998224725",
      telefone: "",
      origem: "comercial",
    },
    user,
  );
  const exportSnapshot = {
    data: { tasy: { cdPessoaFisica: "20" } },
    context: { establishment: 2 },
  };
  await db.query(
    `INSERT INTO portal.tasy_exports(request_id,actor_id,tasy_username,snapshot,state,tasy_id) VALUES ($1,$2,'test',$3::jsonb,'confirmed','10')`,
    [id, user.id, JSON.stringify(exportSnapshot)],
  );
  let snapshot = {
    id: "10",
    statusCode: 1,
    statusLabel: "Em aprovação",
    total: 250,
    receipt: false,
    itens: [
      {
        id: "1",
        codigo: "123",
        tipo: "procedimento",
        quantidade: 3,
        total: 300,
        medico: 100,
        anestesista: 0,
        desconto: 50,
        contabilizado: 1,
      },
    ],
  };
  let failure = false;
  const sync = createReturnSync({
    db,
    approvalRule: "status_and_document",
    read: async (input) => {
      assert.deepEqual(input, { id, tasyId: "10", patientId: "20", establishment: 2 });
      if (failure) throw Error("Oracle offline");
      return snapshot;
    },
  });
  await sync.sync();
  let row = await run("getRequest", { id }, user);
  assert.equal(row.status, "em_aprovacao");
  assert.equal(row.tasyRetorno.total, 250);
  assert.equal(row.honorariosMedicos, 100);
  assert.equal(row.valorHospitalar, 150);
  await assert.rejects(run("approveRequest", { id, revisao: 1 }, user), { code: "TASY_MANAGED" });
  await assert.rejects(run("saveHospitalValue", { id, valor: 20, obs: "test" }, user), {
    code: "TASY_MANAGED",
  });
  const count = async () =>
    Number(
      (await db.query("SELECT COUNT(*) AS n FROM portal.events WHERE request_id=$1", [id])).rows[0]
        .n,
    );
  const before = await count();
  await sync.sync();
  assert.equal(await count(), before);
  snapshot = { ...snapshot, statusCode: 2, statusLabel: "Aprovado" };
  await sync.sync();
  assert.equal((await run("getRequest", { id }, user)).status, "aguardando_pagamento");
  snapshot = { ...snapshot, receipt: true };
  await sync.sync();
  assert.equal((await run("getRequest", { id }, user)).status, "concluido");
  failure = true;
  await sync.sync();
  row = await run("getRequest", { id }, user);
  assert.equal(row.tasyRetorno.total, 250);
  assert.ok(row.tasyRetorno.erro);
  failure = false;
  snapshot = { ...snapshot, statusCode: 4 };
  await sync.sync();
  row = await run("getRequest", { id }, user);
  assert.equal(row.status, "cancelado_estabelecimento");
  assert.equal(row.tasyRetorno.erro, null);
  snapshot = {
    ...snapshot,
    statusCode: 1,
    statusLabel: "Em aprovação",
    receipt: true,
    receiptAt: "2026-09-25T10:00:00",
  };
  const documentSync = createReturnSync({
    db,
    approvalRule: "document",
    read: async () => snapshot,
  });
  await documentSync.sync();
  row = await run("getRequest", { id }, user);
  assert.equal(row.status, "concluido");
  assert.equal(row.dataAprovacao, "2026-09-25T10:00:00-03:00");
  snapshot = { ...snapshot, receipt: false, receiptAt: null };
  await documentSync.sync();
  assert.equal((await run("getRequest", { id }, user)).status, "em_aprovacao");
});
