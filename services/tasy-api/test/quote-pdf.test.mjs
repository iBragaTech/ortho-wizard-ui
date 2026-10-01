import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase, migrate } from "../src/portal/database.mjs";
import { createPatientPdf } from "../src/portal/quote-pdf.mjs";
import { buildPatientQuoteHtml } from "../src/patient-quote-document.mjs";

test("patient PDF checks ownership and refreshed values without sending a message", async (t) => {
  const db = await openDatabase({ PORTAL_DB_MODE: "pglite", PORTAL_DATA_DIR: ":memory:" });
  t.after(() => db.close());
  await migrate(db);
  const doctor = { id: randomUUID(), perfil: "Médico" };
  await db.query(
    "INSERT INTO portal.users(id,nome,email,perfil,password_hash) VALUES($1,'Test','pdf@example.test','Médico','unused')",
    [doctor.id],
  );
  const data = {
    tasyGerenciado: true,
    honorariosMedicos: null,
    valorHospitalar: null,
    paciente: { nome: "Paciente fictício" },
    medico: "Médico fictício",
    tasyRetorno: {
      hash: "v1",
      completo: true,
      consultadoEm: new Date().toISOString(),
      total: 100,
      itens: [
        {
          codigo: "1",
          descricao: "Material",
          tipo: "material",
          quantidade: 1,
          total: 100,
          contabilizado: true,
        },
      ],
    },
  };
  const id = randomUUID();
  const feeData = {
    ...data,
    honorariosMedicos: 9876.54,
    honorariosSolicitados: 9876.54,
    tasyRetorno: {
      ...data.tasyRetorno,
      itens: [
        ...data.tasyRetorno.itens,
        {
          codigo: "2",
          descricao: "Procedimento teste",
          tipo: "procedimento",
          quantidade: 1,
          total: 0,
          medico: 9876.54,
          anestesista: 1234.56,
          contabilizado: true,
        },
      ],
    },
  };
  const feeHtml = await buildPatientQuoteHtml({
    id,
    numero: "PDF-1",
    status: "em_aprovacao",
    data: feeData,
  });
  assert.ok(!feeHtml.includes("9.876,54"));
  assert.ok(!feeHtml.includes("1.234,56"));
  assert.ok(!feeHtml.includes("Médico (informativo)"));
  assert.ok(feeHtml.includes("100,00"));
  assert.ok(feeHtml.includes("Honorários médicos são cobrados separadamente"));
  const html = await buildPatientQuoteHtml({
    id,
    numero: "PDF-1",
    status: "em_aprovacao",
    data,
    institution: { nome: "Hospital de teste", cnpj: "00.000.000/0001-00" },
  });
  for (const text of [
    "Orçamento para Atendimento",
    "Paciente fictício",
    "Hospital de teste",
    "SERVIÇO HOSPITALAR:",
    "DADOS PARA PAGAMENTO:",
    "00.000.000/0001-00",
    "FORMAS DE PAGAMENTO / PARCELAMENTO:",
    'class="sign"',
    'src="data:image/png;base64,',
  ])
    assert.ok(html.includes(text), `Missing patient document section: ${text}`);
  await db.query(
    "INSERT INTO portal.requests(id,numero,created_by,status,data) VALUES($1,'PDF-1',$2,'em_aprovacao',$3)",
    [id, doctor.id, JSON.stringify(data)],
  );
  let refreshes = 0;
  const getPdf = createPatientPdf({
    db,
    refreshQuote: async () => {
      refreshes++;
    },
  });
  const input = { id, hash: "v1" };
  await assert.rejects(getPdf(input, { id: randomUUID(), perfil: "Médico" }), {
    code: "NOT_FOUND",
  });
  await assert.rejects(getPdf(input, { ...doctor, perfil: "Comercial" }), { code: "FORBIDDEN" });
  assert.equal(refreshes, 0);
  const pdf = await getPdf(input, doctor);
  assert.equal(pdf.filename, "Orcamento-PDF-1.pdf");
  assert.equal(Buffer.from(pdf.base64, "base64").subarray(0, 5).toString(), "%PDF-");
  assert.equal(refreshes, 1);
  await assert.rejects(getPdf({ ...input, hash: "old" }, doctor), { code: "QUOTE_CHANGED" });
  const change = createPatientPdf({
    db,
    refreshQuote: async () => {
      await db.query(
        "UPDATE portal.requests SET data=jsonb_set(data,'{tasyRetorno,hash}','\"v2\"') WHERE id=$1",
        [id],
      );
    },
  });
  await assert.rejects(change(input, doctor), { code: "QUOTE_CHANGED" });
  await db.query("UPDATE portal.requests SET data=$2 WHERE id=$1", [
    id,
    JSON.stringify({
      ...data,
      tasyRetorno: { ...data.tasyRetorno, consultadoEm: "2000-01-01T00:00:00Z" },
    }),
  ]);
  await assert.rejects(getPdf(input, doctor), { code: "QUOTE_CHANGED" });
  await db.query("UPDATE portal.requests SET data=$2,status='aguardando_cotacao' WHERE id=$1", [
    id,
    JSON.stringify(data),
  ]);
  await assert.rejects(getPdf(input, doctor), { code: "QUOTE_CHANGED" });
  assert.equal((await db.query("SELECT count(*)::int AS n FROM portal.email_outbox")).rows[0].n, 0);
});
