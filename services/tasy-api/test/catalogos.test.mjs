import test from "node:test";
import assert from "node:assert/strict";
import { catalogoOperations } from "../src/catalogos.mjs";
test("active procedures include services without internal links; price is resolved separately", async () => {
  const op = catalogoOperations["catalogos.procedimentos"];
  assert.equal(op.schema.safeParse({}).success, false);
  assert.equal(
    op.schema.safeParse({ cdConvenio: "2", cdCategoria: "A", estabelecimento: 99 }).success,
    false,
  );
  assert.equal(op.authorize({ principal: { enabled: true } }), false);
  const input = op.schema.parse({ cdConvenio: "2", cdCategoria: "A" });
  await op.execute({
    input,
    principal: { tasyEstablishment: 2 },
    connection: {
      execute: async (sql, binds) => {
        assert.equal(binds.cdConvenio, "2");
        assert.equal(binds.cdCategoria, "A");
        assert.match(sql, /FROM TASY.procedimento p/);
        assert.ok(!sql.includes("proc_interno"));
        for (const alias of ["p", "v", "c"]) assert.ok(sql.includes(`${alias}.ie_situacao = 'A'`));
        assert.ok(sql.includes("p.ie_origem_proced"));
        assert.ok(sql.includes("OFFSET :offset ROWS FETCH NEXT 101 ROWS ONLY"));
        return { rows: [] };
      },
    },
  });
});
test("OPME enforces all four active levels and hospital groups with bound search", async () => {
  const op = catalogoOperations["catalogos.opme"];
  const input = op.schema.parse({ busca: "' OR 1=1" });
  assert.equal(op.schema.safeParse({ grupos: [1] }).success, false);
  const result = await op.execute({
    input,
    connection: {
      execute: async (sql, binds) => {
        for (const alias of ["a", "b", "c", "d"])
          assert.ok(sql.includes(`${alias}.ie_situacao = 'A'`));
        assert.match(sql, /d.cd_grupo_material IN \(13, 59, 60, 61\)/);
        assert.match(sql, /OFFSET :offset ROWS FETCH NEXT 101 ROWS ONLY/);
        assert.ok(!sql.includes(input.busca));
        assert.deepEqual(binds, input);
        return { rows: [] };
      },
    },
  });
  assert.deepEqual(result, { items: [], hasMore: false });
});
test("catalogs bind input, restrict active rows and paginate without dropping the extra item", async () => {
  const operation = catalogoOperations["catalogos.convenios"];
  const input = operation.schema.parse({ busca: "x' OR 1=1", offset: 100 });
  const rows = Array.from({ length: 101 }, (_, i) => ({ codigo: String(i), nome: "Teste" }));
  const result = await operation.execute({
    input,
    connection: {
      execute: async (sql, binds) => {
        assert.match(sql, /ie_situacao = 'A'/);
        assert.match(sql, /OFFSET :offset/);
        assert.ok(!sql.includes(input.busca));
        assert.deepEqual(binds, input);
        return { rows };
      },
    },
  });
  assert.equal(result.items.length, 100);
  assert.equal(result.hasMore, true);
  assert.equal(operation.authorize({ principal: { enabled: false } }), false);
  assert.equal(operation.schema.safeParse({ offset: -1 }).success, false);
});
test("categories require an insurer and filter both active insurer and category", async () => {
  const op = catalogoOperations["catalogos.categorias"];
  assert.equal(op.schema.safeParse({}).success, false);
  assert.equal(op.schema.safeParse({ cdConvenio: "1 OR 1=1" }).success, false);
  const input = op.schema.parse({ cdConvenio: "2" });
  await op.execute({
    input,
    connection: {
      execute: async (sql, binds) => {
        assert.match(sql, /c.cd_convenio = :cdConvenio/);
        assert.match(sql, /c.ie_situacao = 'A' AND v.ie_situacao = 'A'/);
        assert.equal(binds.cdConvenio, "2");
        return { rows: [] };
      },
    },
  });
});
