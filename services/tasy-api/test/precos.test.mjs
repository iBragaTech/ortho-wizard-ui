import test from "node:test";
import assert from "node:assert/strict";
import { precoOperations } from "../src/precos.mjs";
import { createExecutor } from "../src/executor.mjs";
const principal = {
  enabled: true,
  operations: ["precos.procedimento"],
  tasyUsername: "test",
  tasyEstablishment: 2,
  tasyProfile: 1848,
  subject: "test",
};
const input = { cdConvenio: "29", cdCategoria: "1", codigo: "30721075", origem: "6" };
function setup({ match = true, context = true, price = 2865, classification } = {}) {
  const calls = [];
  const c = {
    execute: async (sql, binds) => {
      calls.push({ sql, binds });
      if (sql.includes("FROM TASY.procedimento p") && sql.includes("FETCH NEXT"))
        return { rows: match ? [{ codigo: input.codigo, origem: input.origem }] : [] };
      if (sql.includes("get_nm_usuario"))
        return { rows: [{ usuario: context ? "test" : "wrong", estab: 2, perfil: 1848 }] };
      if (sql.includes("obter_preco_procedimento"))
        return {
          rows: [
            {
              valorProcedimento: price,
              honorarios: classification === "3" ? null : 0,
              classificacao: classification,
              custoOperacional: price,
              filmeMateriais: 0,
              consultadoEm: "2026-09-21T11:00:00",
            },
          ],
        };
      return { rows: [] };
    },
    rollback: async () => calls.push("rollback"),
    commit: async () => calls.push("commit"),
    close: async (options) => calls.push({ close: options }),
  };
  return {
    calls,
    run: createExecutor({
      pool: { getConnection: async () => c },
      operations: precoOperations,
      writesEnabled: false,
      callTimeout: 10000,
      audit: () => {},
    }),
  };
}
test("price reference uses native options and binds in read-only transaction, without double summation", async () => {
  const { calls, run } = setup();
  const result = await run({ name: "precos.procedimento", body: input, principal });
  assert.equal(result.valorProcedimento, 2865);
  assert.equal(result.custoOperacional, 2865);
  assert.equal(calls[0].sql, "SET TRANSACTION READ ONLY");
  const sql = calls.find((c) => c.sql?.includes("obter_preco_procedimento"));
  assert.equal(sql.binds.origem, "6");
  assert.equal(sql.binds.estab, 2);
  for (const option of ["P", "H", "C", "F"]) assert.ok(sql.sql.includes(`'${option}'`));
  assert.ok(!calls.some((c) => c.sql?.includes("gerar_consulta_preco")));
  assert.ok(!calls.includes("commit"));
  assert.deepEqual(calls.at(-1), { close: { drop: true } });
});
test("invalid catalog, mismatched context and missing permission cannot calculate prices", async () => {
  for (const [options, code] of [
    [{ match: false }, "CATALOG_CHANGED"],
    [{ context: false }, "TASY_CONTEXT_MISMATCH"],
  ]) {
    const { run, calls } = setup(options);
    await assert.rejects(
      run({ name: "precos.procedimento", body: input, principal }),
      (e) => e.code === code,
    );
    assert.ok(!calls.some((c) => c.sql?.includes("obter_preco_procedimento")));
  }
  const { run, calls } = setup();
  await assert.rejects(
    run({ name: "precos.procedimento", body: input, principal: { ...principal, operations: [] } }),
    (e) => e.code === "FORBIDDEN",
  );
  assert.equal(calls.length, 0);
});
test("zero and missing price are preserved rather than fabricated", async () => {
  for (const price of [0, null]) {
    const { run } = setup({ price });
    const result = await run({ name: "precos.procedimento", body: input, principal });
    assert.equal(result.valorProcedimento, price);
  }
  assert.equal(
    precoOperations["precos.procedimento"].schema.safeParse({ ...input, valorProcedimento: 1 })
      .success,
    false,
  );
});

test("material prices validate active catalog and use read-only native calculation", async () => {
  const calls = [];
  const connection = {
    execute: async (sql, binds) => {
      calls.push({ sql, binds });
      if (sql.includes("FROM TASY.material")) return { rows: [{ CD_MATERIAL: 31 }] };
      if (sql.includes("get_nm_usuario"))
        return { rows: [{ usuario: "test", estab: 2, perfil: 1848 }] };
      if (sql.includes("obter_preco_material")) return { rows: [{ valorMaterial: 2.97 }] };
      return { rows: [] };
    },
    rollback: async () => calls.push("rollback"),
    close: async (options) => calls.push(options),
  };
  const run = createExecutor({
    pool: { getConnection: async () => connection },
    operations: precoOperations,
    writesEnabled: false,
    callTimeout: 10000,
    audit: () => {},
  });
  const r = await run({
    name: "precos.material",
    body: { codigo: "31", cdConvenio: "29", cdCategoria: "1" },
    principal: { ...principal, operations: ["precos.material"] },
  });
  assert.equal(r.valorMaterial, 2.97);
  assert.equal(calls[0].sql, "SET TRANSACTION READ ONLY");
  assert.equal(calls.find((c) => c.sql?.includes("obter_preco_material")).binds.codigo, "31");
  assert.ok(calls.includes("rollback"));
  assert.deepEqual(calls.at(-1), { drop: true });
});

test("service classification uses native total without requiring uncomputed medical components", async () => {
  const { run } = setup({ price: 550, classification: "3" });
  const r = await run({ name: "precos.procedimento", body: input, principal });
  assert.equal(r.valorProcedimento, 550);
  assert.equal(r.honorarios, 0);
  assert.equal(r.honorariosNativo, null);
  assert.equal(r.tipoCalculo, "servico");
});
