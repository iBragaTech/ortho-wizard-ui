import test from "node:test";
import assert from "node:assert/strict";
import { createQuoteCalculator } from "../src/portal/pricing.mjs";
import { createPortalOperations } from "../src/portal/operations.mjs";
import { openDatabase, migrate } from "../src/portal/database.mjs";

const selection = {
  cdPessoaFisica: "1",
  cdConvenio: "29",
  cdCategoria: "1",
  procedimentos: [{ codigo: "10", origem: "6" }],
  materiais: [{ codigo: "31" }],
};
function calculator(user, { material = 2.97, total = 2865, fees = 100 } = {}) {
  return createQuoteCalculator({
    principals: { [user.id]: { enabled: true, tasyUsername: "test" } },
    execute: async ({ name }) => {
      if (name === "pessoas-fisicas.consultar") return { nrCpf: "52998224725" };
      if (name === "precos.procedimento")
        return { valorProcedimento: total, honorarios: fees, custoOperacional: 2765 };
      if (name === "precos.material") return { valorMaterial: material };
      throw Error(name);
    },
  });
}
test("automatic quote sums native total once, includes materials, and does not treat missing prices as free", async () => {
  const user = { id: "test" };
  const result = await calculator(user)(selection, user, "52998224725");
  assert.equal(result.total, 2867.97);
  assert.equal(result.honorarios, 100);
  assert.equal(result.hospitalar, 2767.97);
  for (const options of [
    { material: 0 },
    { material: null },
    { total: 0 },
    { fees: null },
    { fees: 9999 },
  ]) {
    const result = await calculator(user, options)(selection, user);
    assert.equal(result.completo, false);
    assert.equal(result.total, null);
    assert.equal(result.hospitalar, null);
  }
  await assert.rejects(
    calculator(user)(selection, user, "11111111111"),
    (e) => e.code === "PATIENT_CHANGED",
  );
  await assert.rejects(
    calculator(user)(selection, { id: "another" }),
    (e) => e.code === "FORBIDDEN",
  );
});
test("creation stores server prices; negotiations preserve reference, audit identity, locking and ownership", async (t) => {
  const db = await openDatabase({ PORTAL_DB_MODE: "pglite", PORTAL_DATA_DIR: ":memory:" });
  t.after(() => db.close());
  await migrate(db);
  const users = [];
  for (const [i, perfil] of ["Administrador", "Comercial", "Médico", "Médico"].entries()) {
    users.push(
      (
        await db.query(
          "INSERT INTO portal.users(nome,email,perfil,password_hash) VALUES ($1,$2,$3,'unused') RETURNING id,nome,perfil",
          [`User${i}`, `${i}@example.test`, perfil],
        )
      ).rows[0],
    );
  }
  const [admin, commercial, doctor, other] = users;
  const run = createPortalOperations(db, {
    calculateQuote: calculator(doctor),
    auditIdentity: () => "test",
  });
  const input = {
    nome: "Test",
    cpf: "52998224725",
    nascimento: "2000-01-01",
    telefone: "",
    origem: "medico",
    medico: {
      honorariosMedicos: 999,
      diaria: 99,
      cti: 99,
      fisioterapia: null,
      tempoBloco: "",
      opme: "",
      anatomoPatologico: "",
      reservaSangue: "",
      equipeMultidisciplinar: "",
      obsMedico: "",
    },
    tasy: selection,
  };
  const id = await run("createRequest", input, doctor);
  const initial = await run("getRequest", { id }, doctor);
  assert.equal(initial.status, "concluido");
  assert.equal(initial.honorariosMedicos, 100);
  assert.equal(initial.diaria, null);
  const change = { id, revisao: 1, honorarios: 90, hospitalar: 2700, motivo: "Desconto negociado" };
  await assert.rejects(run("adjustPrices", change, other), (e) => e.code === "NOT_FOUND");
  await assert.rejects(
    run("adjustPrices", { ...change, motivo: "" }, doctor),
    (e) => e.code === "INVALID_INPUT",
  );
  await run("adjustPrices", change, doctor);
  await assert.rejects(run("adjustPrices", change, commercial), (e) => e.code === "RECORD_CHANGED");
  await run("adjustPrices", { ...change, revisao: 2, hospitalar: 2600 }, commercial);
  const final = await run("getRequest", { id }, admin);
  assert.deepEqual(final.precificacao.referencia, initial.precificacao.referencia);
  assert.equal(final.precificacao.ajustes.length, 2);
  assert.equal(final.precificacao.ajustes[0].usuarioId, doctor.id);
  assert.equal(final.precificacao.ajustes[0].nmUsuario, "test");
  assert.equal(final.precificacao.ajustes[0].anterior.honorarios, 100);
  assert.ok(final.precificacao.ajustes[0].dataHora);
  await assert.rejects(
    run("saveHospitalValue", { id, valor: 1, obs: "" }, commercial),
    (e) => e.code === "AUDIT_REQUIRED",
  );
  await assert.rejects(
    run("saveDoctorFees", { id, input: input.medico }, doctor),
    (e) => e.code === "AUDIT_REQUIRED",
  );
  await assert.rejects(
    run("createRequest", { ...input, precificacao: {} }, doctor),
    (e) => e.code === "INVALID_INPUT",
  );
  await db.query(
    "INSERT INTO portal.tasy_exports(request_id,actor_id,tasy_username,snapshot,state) VALUES ($1,$2,'test','{}','unknown')",
    [id, admin.id],
  );
  await assert.rejects(
    run("adjustPrices", { ...change, revisao: 3 }, admin),
    (e) => e.code === "EXPORT_FROZEN",
  );
});
test("pending quote stays in analysis and reconsultation preserves previous reference", async (t) => {
  const db = await openDatabase({ PORTAL_DB_MODE: "pglite", PORTAL_DATA_DIR: ":memory:" });
  t.after(() => db.close());
  await migrate(db);
  const user = (
    await db.query(
      "INSERT INTO portal.users(nome,email,perfil,password_hash) VALUES ('Admin','admin@example.test','Administrador','unused') RETURNING id,perfil,nome",
    )
  ).rows[0];
  let material = 0;
  const run = createPortalOperations(db, {
    calculateQuote: (...args) => calculator(user, { material })(...args),
  });
  const id = await run(
    "createRequest",
    { nome: "Test", cpf: "52998224725", nascimento: "2000-01-01", telefone: "", tasy: selection },
    user,
  );
  const initial = await run("getRequest", { id }, user);
  assert.equal(initial.status, "em_analise");
  assert.equal(initial.valorHospitalar, null);
  await assert.rejects(
    run("adjustPrices", { id, revisao: 1, honorarios: 1, hospitalar: 1, motivo: "teste" }, user),
    (e) => e.code === "INCOMPLETE_PRICE",
  );
  material = 2.97;
  await run("calculateRequest", { id }, user);
  const final = await run("getRequest", { id }, user);
  assert.equal(final.status, "concluido");
  assert.equal(final.precificacao.referenciasAnteriores.length, 1);
  assert.equal(final.precificacao.referenciasAnteriores[0].completo, false);
  await assert.rejects(run("calculateRequest", { id }, user), (e) => e.code === "ALREADY_PRICED");
});
