import test from "node:test";
import assert from "node:assert/strict";
import { pessoaFisicaOperations } from "../src/pessoa-fisica.mjs";

const operation = pessoaFisicaOperations({ directDmlEnabled: false })["pessoas-fisicas.buscar-cpf"];
const principal = { pessoaFisicaIds: ["123"] };
const input = { nrCpf: "52998224725" };
const person = { cdPessoaFisica: "123", nmPessoaFisica: "Paciente de teste", nrCpf: input.nrCpf };
const connection = (rows) => ({
  execute: async (sql, binds, options) => {
    assert.match(sql, /nr_cpf = :nrCpf AND ROWNUM <= 2/);
    assert.deepEqual(binds, input);
    assert.equal(options.maxRows, 2);
    return { rows };
  },
});

test("CPF search validates input, uses binds and requires record scope", async () => {
  assert.equal(operation.schema.safeParse({ nrCpf: "' OR 1=1" }).success, false);
  assert.equal(Boolean(await operation.authorize({ principal: {} })), false);
  assert.equal(await operation.authorize({ principal }), true);
  assert.deepEqual(
    await operation.execute({ connection: connection([person]), input, principal }),
    person,
  );
});

test("CPF search never returns inaccessible records and rejects duplicates", async () => {
  for (const rows of [[], [{ ...person, cdPessoaFisica: "999" }]]) {
    await assert.rejects(
      operation.execute({ connection: connection(rows), input, principal }),
      (error) => error.code === "NOT_FOUND",
    );
  }
  await assert.rejects(
    operation.execute({ connection: connection([person, person]), input, principal }),
    (error) => error.code === "AMBIGUOUS_RECORD",
  );
});
