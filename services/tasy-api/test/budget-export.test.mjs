import test from "node:test";
import assert from "node:assert/strict";
import { createBudgetExporter, canonicalJson } from "../src/orcamento-export.mjs";
import { createExportService } from "../src/portal/export.mjs";
import { openDatabase, migrate } from "../src/portal/database.mjs";
import { createPortalOperations } from "../src/portal/operations.mjs";
const principal = {
  enabled: true,
  operations: ["orcamentos.enviar"],
  tasyUsername: "test",
  tasyEstablishment: 2,
  tasyProfile: 1848,
  pessoaFisicaIds: ["123"],
};
const selection = {
  cdPessoaFisica: "123",
  cdConvenio: "29",
  cdCategoria: "1",
  procedimentos: [{ codigo: "10", origem: "1" }],
  materiais: [],
};
const snapshot = {
  id: "00000000-0000-4000-8000-000000000001",
  actorId: "00000000-0000-4000-8000-000000000002",
  data: { tasy: selection, paciente: { cpf: "52998224725" } },
};
function mock({ duplicate = false, commitError = false, catalogValid = true } = {}) {
  const calls = [];
  let storedHash;
  const c = {
    execute: async (sql, binds) => {
      calls.push({ sql, binds });
      if (sql.includes("get_nm_usuario"))
        return { rows: [{ usuario: "test", estab: 2, perfil: 1848, triggers: "S" }] };
      if (sql.startsWith("INSERT INTO TASY.PORTAL_ORCAMENTO_ENVIO")) {
        storedHash = binds.hash;
        if (duplicate) throw { errorNum: 1 };
      }
      if (sql.includes("HASH_CONTEUDO AS")) return { rows: [{ hash: storedHash, id: "789" }] };
      if (sql.includes("FROM TASY.pessoa_fisica")) return { rows: [{ found: 1 }] };
      if (sql.includes("FROM TASY.procedimento p") && sql.includes("FETCH NEXT"))
        return { rows: catalogValid ? [{ codigo: "10", origem: "1" }] : [] };
      if (sql.includes("NEXTVAL)")) return { rows: [{ id: "789" }] };
      return { rows: [], rowsAffected: 1 };
    },
    commit: async () => {
      calls.push("commit");
      if (commitError) throw Error("lost");
    },
    rollback: async () => calls.push("rollback"),
    close: async (opts) => calls.push({ close: opts }),
  };
  return {
    calls,
    send: createBudgetExporter({ pool: { getConnection: async () => c }, enabled: true }),
  };
}
test("Oracle draft inserts audit, header and items in one transaction, drops session", async () => {
  const { send, calls } = mock();
  assert.equal((await send(snapshot, principal)).nrOrcamento, "789");
  assert.equal(calls.filter((x) => x === "commit").length, 1);
  assert.ok(calls.some((x) => x.sql?.includes("INSERT INTO TASY.orcamento_historico")));
  assert.deepEqual(calls.at(-1), { close: { drop: true } });
});
test("Oracle export binds the selected quantity", async () => {
  const { send, calls } = mock();
  await send(
    {
      ...snapshot,
      data: {
        ...snapshot.data,
        tasy: { ...selection, procedimentos: [{ codigo: "10", origem: "1", quantidade: 2 }] },
      },
    },
    principal,
  );
  const insert = calls.find((c) => c.sql?.includes("INSERT INTO TASY.orcamento_paciente_proc"));
  assert.equal(insert.binds.quantidade, 2);
});
test("Oracle committed key is recovered without duplicate inserts; commit loss is explicit", async () => {
  const retry = mock({ duplicate: true });
  assert.equal((await retry.send(snapshot, principal)).recuperado, true);
  assert.ok(!retry.calls.some((x) => x.sql?.includes("INSERT INTO TASY.orcamento_paciente\n")));
  const lost = mock({ commitError: true });
  await assert.rejects(lost.send(snapshot, principal), (e) => e.code === "WRITE_OUTCOME_UNKNOWN");
  const stale = mock({ catalogValid: false });
  await assert.rejects(stale.send(snapshot, principal), (e) => e.code === "CATALOG_CHANGED");
  assert.ok(!stale.calls.includes("commit"));
});
test("disabled exports and inaccessible patients are blocked before Oracle", async () => {
  await assert.rejects(
    createBudgetExporter({ enabled: false })(snapshot, principal),
    (e) => e.code === "EXPORT_DISABLED",
  );
  const x = mock();
  await assert.rejects(
    x.send(snapshot, { ...principal, pessoaFisicaIds: [] }),
    (e) => e.code === "FORBIDDEN",
  );
  assert.equal(x.calls.length, 0);
  assert.equal(
    canonicalJson({ b: 2, a: { d: 4, c: 3 } }),
    canonicalJson({ a: { c: 3, d: 4 }, b: 2 }),
  );
});
test("persistent initial snapshot reconciles without blocking local pricing and enforces ownership", async (t) => {
  const db = await openDatabase({ PORTAL_DB_MODE: "pglite", PORTAL_DATA_DIR: ":memory:" });
  t.after(() => db.close());
  await migrate(db);
  await migrate(db);
  const user = { id: snapshot.actorId, perfil: "Administrador" };
  await db.query(
    "INSERT INTO portal.users(id,nome,email,perfil,password_hash) VALUES ($1,'test','test@example.test','Administrador','unused')",
    [user.id],
  );
  await db.query(
    "INSERT INTO portal.requests(id,numero,created_by,status,data) VALUES ($1,'TEST',$2,'aguardando_comercial',$3::jsonb)",
    [snapshot.id, user.id, JSON.stringify(snapshot.data)],
  );
  let count = 0;
  const bodies = [];
  const service = createExportService({
    db,
    principals: { [user.id]: principal },
    send: async (s) => {
      bodies.push(canonicalJson(s));
      if (++count === 1) throw Error("lost");
      return { nrOrcamento: "789" };
    },
  });
  await assert.rejects(service.submit({ id: snapshot.id }, user));
  assert.equal((await service.status(snapshot.id, user)).state, "unknown");
  await createPortalOperations(db)(
    "saveHospitalValue",
    { id: snapshot.id, valor: 10, obs: "test" },
    user,
  );
  await service.submit({ id: snapshot.id }, user);
  assert.equal(bodies[0], bodies[1]);
  assert.equal((await service.status(snapshot.id, user)).state, "confirmed");
  await service.submit({ id: snapshot.id }, user);
  assert.equal(count, 2);
  await assert.rejects(
    service.status(snapshot.id, { id: "00000000-0000-4000-8000-000000000003", perfil: "Médico" }),
    (e) => e.code === "NOT_FOUND",
  );
  assert.equal((await db.query("SELECT count(*)::int AS n FROM portal.events")).rows[0].n, 5);
});
