import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase, migrate } from "../src/portal/database.mjs";
import { createPortalOperations } from "../src/portal/operations.mjs";
import { confirmZeroReference } from "../src/portal/pricing.mjs";
const zero = {
  tipo: "material",
  codigo: "53304",
  quantidade: 1,
  pendente: true,
  referencia: { valorMaterial: 0 },
};
const reference = {
  completo: false,
  itens: [
    {
      tipo: "procedimento",
      codigo: "10",
      origem: "6",
      quantidade: 1,
      pendente: false,
      referencia: { valorProcedimento: 2865, honorarios: 0 },
    },
    {
      tipo: "material",
      codigo: "31",
      quantidade: 1,
      pendente: false,
      referencia: { valorMaterial: 2.97 },
    },
    zero,
  ],
  total: null,
  honorarios: null,
  hospitalar: null,
};
test("zero confirmation cannot turn absent/inconsistent prices into zero", () => {
  for (const value of [null, undefined, -1, 1])
    assert.throws(
      () =>
        confirmZeroReference(
          { ...reference, itens: [{ ...zero, referencia: { valorMaterial: value } }] },
          zero,
        ),
      (e) => e.code === "ZERO_NOT_CONFIRMABLE",
    );
  const procedure = {
    tipo: "procedimento",
    codigo: "10",
    origem: "6",
    quantidade: 1,
    pendente: true,
    referencia: { valorProcedimento: 0, honorarios: null },
  };
  assert.throws(
    () => confirmZeroReference({ ...reference, itens: [procedure] }, procedure),
    (e) => e.code === "ZERO_NOT_CONFIRMABLE",
  );
  const result = confirmZeroReference(reference, zero);
  assert.equal(result.total, 2867.97);
  assert.equal(result.completo, true);
  assert.equal(reference.itens[2].pendente, true);
});
test("zero confirmation is audited, revision locked, scoped, and respects export freeze", async (t) => {
  const db = await openDatabase({ PORTAL_DB_MODE: "pglite", PORTAL_DATA_DIR: ":memory:" });
  t.after(() => db.close());
  await migrate(db);
  const users = [];
  for (let i = 0; i < 2; i++)
    users.push(
      (
        await db.query(
          "INSERT INTO portal.users(nome,email,perfil,password_hash) VALUES ($1,$2,'Médico','unused') RETURNING id,nome,perfil",
          [`Doctor${i}`, `${i}@example.test`],
        )
      ).rows[0],
    );
  const [user, other] = users;
  const create = async () =>
    (
      await db.query(
        "INSERT INTO portal.requests(numero,created_by,status,data) VALUES (gen_random_uuid()::text,$1,'em_analise',$2::jsonb) RETURNING id",
        [
          user.id,
          JSON.stringify({ precificacao: { referencia: reference, revisao: 1, ajustes: [] } }),
        ],
      )
    ).rows[0].id;
  const run = createPortalOperations(db, { auditIdentity: () => "test" });
  const id = await create();
  const input = {
    id,
    revisao: 1,
    item: { tipo: "material", codigo: "53304" },
    motivo: "Item incluído sem cobrança",
  };
  await assert.rejects(run("confirmZeroPrice", input, other), (e) => e.code === "NOT_FOUND");
  await assert.rejects(
    run("confirmZeroPrice", { ...input, motivo: "   " }, user),
    (e) => e.code === "INVALID_INPUT",
  );
  await run("confirmZeroPrice", input, user);
  await assert.rejects(run("confirmZeroPrice", input, user), (e) => e.code === "RECORD_CHANGED");
  const row = await run("getRequest", { id }, user);
  assert.equal(row.status, "concluido");
  assert.equal(row.valorHospitalar, 2867.97);
  assert.deepEqual(row.precificacao.referenciasAnteriores[0], reference);
  const audit = row.precificacao.confirmacoesZero[0];
  assert.equal(audit.usuarioId, user.id);
  assert.equal(audit.nmUsuario, "test");
  assert.ok(audit.dataHora);
  assert.equal(audit.motivo, input.motivo);
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM portal.events WHERE request_id=$1", [id])).rows[0]
      .n,
    1,
  );
  const frozen = await create();
  await db.query(
    "INSERT INTO portal.tasy_exports(request_id,actor_id,tasy_username,snapshot,state) VALUES ($1,$2,'test','{}','unknown')",
    [frozen, user.id],
  );
  await assert.rejects(
    run("confirmZeroPrice", { ...input, id: frozen }, user),
    (e) => e.code === "EXPORT_FROZEN",
  );
});
