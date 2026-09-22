import test from "node:test";
import assert from "node:assert/strict";
import { tasySelection } from "../src/orcamento-schema.mjs";
import { createQuoteCalculator, confirmZeroReference } from "../src/portal/pricing.mjs";
const selection = {
  cdPessoaFisica: "1",
  cdConvenio: "29",
  cdCategoria: "4",
  procedimentos: [{ codigo: "60000694", origem: "8", quantidade: 2 }],
  materiais: [
    { codigo: "31", quantidade: 3 },
    { codigo: "53304", quantidade: 2 },
  ],
};
test("quantity requires positive integers, defaults old selections to one", () => {
  for (const quantidade of [null, 0, -1, 1.5, "2", 10001]) {
    assert.equal(
      tasySelection.safeParse({
        ...selection,
        procedimentos: [{ ...selection.procedimentos[0], quantidade }],
      }).success,
      false,
    );
    assert.equal(
      tasySelection.safeParse({ ...selection, materiais: [{ codigo: "31", quantidade }] }).success,
      false,
    );
  }
  const legacy = tasySelection.parse({
    ...selection,
    procedimentos: [{ codigo: "1", origem: "8" }],
    materiais: [{ codigo: "31" }],
  });
  assert.equal(legacy.procedimentos[0].quantidade, 1);
  assert.equal(legacy.materiais[0].quantidade, 1);
});
test("quantities multiply unit prices and survive zero confirmation without double-counting", async () => {
  const calculate = createQuoteCalculator({
    principals: { test: { enabled: true, tasyUsername: "test" } },
    execute: async ({ name, body }) => {
      assert.equal(Object.hasOwn(body, "quantidade"), false);
      if (name === "pessoas-fisicas.consultar") return { nrCpf: "52998224725" };
      if (name === "precos.procedimento") return { valorProcedimento: 550, honorarios: 0 };
      return { valorMaterial: body.codigo === "31" ? 2.97 : 0 };
    },
  });
  const ref = await calculate(selection, { id: "test" }, "52998224725");
  assert.equal(ref.subtotalConfirmado, 1108.91);
  assert.equal(ref.total, null);
  assert.deepEqual(
    ref.itens.map((i) => i.quantidade),
    [2, 3, 2],
  );
  const confirmed = confirmZeroReference(ref, { tipo: "material", codigo: "53304" });
  assert.equal(confirmed.total, 1108.91);
  assert.equal(confirmed.hospitalar, 1108.91);
  assert.equal(confirmed.honorarios, 0);
});
