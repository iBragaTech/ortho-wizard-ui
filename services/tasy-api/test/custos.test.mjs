import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase, migrate } from "../src/portal/database.mjs";
import { createPortalOperations } from "../src/portal/operations.mjs";

test("Custos exclusively reviews, audits and approves; prices stay private until approval", async (t) => {
  const db = await openDatabase({ PORTAL_DATA_DIR: ":memory:" });
  t.after(() => db.close());
  await migrate(db);
  await migrate(db);
  const users = [];
  for (const [i, perfil] of ["Médico", "Comercial", "Custos", "Médico"].entries()) {
    users.push(
      (
        await db.query(
          "INSERT INTO portal.users(nome,email,perfil,password_hash) VALUES ($1,$2,$3,'unused') RETURNING id,nome,perfil",
          [`User ${i}`, `${i}@example.test`, perfil],
        )
      ).rows[0],
    );
  }
  const [doctor, commercial, costs, other] = users;
  const calculateQuote = async (selection) => {
    const itens = [
      ...selection.procedimentos.map((p) => ({
        ...p,
        tipo: "procedimento",
        quantidade: p.quantidade ?? 1,
        pendente: false,
        referencia: { nome: "Procedimento teste", valorProcedimento: 100, honorarios: 10 },
      })),
      ...selection.materiais.map((m) => ({
        ...m,
        tipo: "material",
        quantidade: m.quantidade ?? 1,
        pendente: false,
        referencia: { nome: "Material teste", valorMaterial: 20 },
      })),
    ];
    const total = itens.reduce(
      (n, i) => n + (i.referencia.valorProcedimento ?? i.referencia.valorMaterial) * i.quantidade,
      0,
    );
    const honorarios = selection.procedimentos.reduce((n, p) => n + 10 * (p.quantidade ?? 1), 0);
    return {
      itens,
      completo: true,
      total,
      honorarios,
      hospitalar: total - honorarios,
      subtotalConfirmado: total,
    };
  };
  const run = createPortalOperations(db, {
    calculateQuote,
    auditIdentity: (user) => `tasy-${user.nome}`,
  });
  const input = {
    nome: "Paciente teste",
    cpf: "52998224725",
    nascimento: "2000-01-01",
    telefone: "",
    origem: "medico",
    medico: {
      honorariosMedicos: 500,
      diaria: null,
      cti: null,
      fisioterapia: null,
      tempoBloco: "",
      opme: "",
      anatomoPatologico: "",
      reservaSangue: "",
      equipeMultidisciplinar: "Anestesista: Sim",
      obsMedico: "",
    },
    tasy: {
      cdPessoaFisica: "1",
      cdConvenio: "29",
      cdCategoria: "1",
      procedimentos: [{ codigo: "10", origem: "6", quantidade: 2 }],
      materiais: [],
    },
  };
  const id = await run("createRequest", input, doctor);
  for (const user of [doctor, commercial]) {
    const view = await run("getRequest", { id }, user);
    assert.equal(view.status, "em_analise");
    assert.equal(view.precificacao, undefined);
    assert.equal(view.honorariosMedicos, null);
    assert.equal(view.valorHospitalar, null);
    assert.equal(view.honorariosSolicitados, 500);
    assert.equal((await run("listRequests", {}, user))[0].precificacao, undefined);
    for (const operation of [
      "approveRequest",
      "adjustItemPrice",
      "updateRequestItems",
      "adjustPrices",
      "confirmZeroPrice",
      "calculateRequest",
    ])
      await assert.rejects(run(operation, { id, revisao: 1 }, user), (e) => e.code === "FORBIDDEN");
  }
  await assert.rejects(run("getRequest", { id }, other), (e) => e.code === "NOT_FOUND");
  let view = await run("getRequest", { id }, costs);
  assert.equal(view.honorariosMedicos, 500);
  assert.equal(view.valorHospitalar, 180);
  await run(
    "updateRequestItems",
    {
      id,
      revisao: 1,
      tasy: { ...input.tasy, materiais: [{ codigo: "31", quantidade: 3 }] },
      motivo: "Adicionar material necessário",
    },
    costs,
  );
  await assert.rejects(
    run("approveRequest", { id, revisao: 1 }, costs),
    (e) => e.code === "RECORD_CHANGED",
  );
  await run(
    "adjustItemPrice",
    { id, revisao: 2, indice: 1, valor: 25, motivo: "Preço revisado por Custos" },
    costs,
  );
  view = await run("getRequest", { id }, costs);
  assert.equal(view.valorHospitalar, 255);
  assert.equal(view.honorariosMedicos, 500);
  const stored = (
    await db.query(
      "SELECT descricao FROM portal.events WHERE request_id=$1 AND titulo='Valor de item ajustado por Custos'",
      [id],
    )
  ).rows[0];
  const audit = JSON.parse(stored.descricao);
  assert.equal(audit.anterior.referencia.valorMaterial, 20);
  assert.equal(audit.novo.referencia.valorMaterial, 25);
  assert.ok(audit.nmUsuario);
  assert.ok(audit.dataHora);
  const hiddenHistory = await run("getTimeline", { id }, doctor);
  assert.ok(hiddenHistory.every((e) => !e.descricao.includes('"valorMaterial"')));
  await run("approveRequest", { id, revisao: 3 }, costs);
  view = await run("getRequest", { id }, doctor);
  assert.equal(view.status, "concluido");
  assert.equal(view.valorHospitalar, 255);
  assert.equal(view.aprovacaoCustos.usuarioId, costs.id);
  assert.ok(view.dataAprovacao);
  await assert.rejects(
    run("approveRequest", { id, revisao: 3 }, costs),
    (e) => e.code === "INVALID_STATE",
  );
  await assert.rejects(
    run(
      "adjustItemPrice",
      { id, revisao: 3, indice: 0, valor: 1, motivo: "Alteração posterior" },
      costs,
    ),
    (e) => e.code === "INVALID_STATE",
  );
  const direct = await run(
    "createRequest",
    { ...input, origem: "comercial", medico: undefined },
    commercial,
  );
  assert.equal((await run("getRequest", { id: direct }, costs)).status, "em_analise");
  await db.query(
    "UPDATE portal.requests SET data=jsonb_set(data,'{precificacao,referencia,completo}','false') WHERE id=$1",
    [direct],
  );
  await assert.rejects(run("approveRequest", {id: direct, revisao: 1}, costs), e => e.code === "INCOMPLETE_PRICE");
  await assert.rejects(run("createRequest", {...input, medico: undefined}, doctor), e => e.code === "INVALID_INPUT");
});

test("HTTP price endpoints reject doctor and commercial before contacting Oracle", async (t) => {
  const { createUser } = await import("../src/portal/auth.mjs");
  const { createPortalApp } = await import("../src/portal/app.mjs");
  const { createExecutor } = await import("../src/executor.mjs");
  const { z } = await import("zod");
  const db = await openDatabase({PORTAL_DATA_DIR: ":memory:"});
  t.after(() => db.close());
  await migrate(db);
  const principals = {};
  for (const [i, perfil] of ["Médico", "Comercial"].entries()) {
    const user = await createUser(db, {nome: `User ${i}`,email:`price${i}@example.test`,perfil,senha:"test-password-local"});
    principals[user.id] = {enabled:true,tasyUsername:`test${i}`,tasyProfile:1,tasyEstablishment:2,operations:["precos.procedimento","precos.material"]};
  }
  let oracleCalls = 0;
  const tasyExecute = createExecutor({pool:{getConnection:async () => {oracleCalls++; throw Error("must not run");}},
    operations: Object.fromEntries(["precos.procedimento","precos.material"].map(name => [name,{kind:"read",schema:z.object({}),authorize:()=>true}])),
    writesEnabled:false, audit:()=>{},callTimeout:1000});
  const app = await createPortalApp({db,principals,tasyExecute,portalOrigin:"http://localhost:5173",logger:false});
  t.after(() => app.close());
  for (let i=0; i<2; i++) {
    const login = await app.inject({method:"POST",url:"/v1/auth/login",payload:{email:`price${i}@example.test`,senha:"test-password-local"}});
    assert.equal(login.statusCode,200);
    for (const name of ["precos.procedimento","precos.material"]) {
      const response = await app.inject({method:"POST",url:`/v1/operations/${name}`,payload:{},headers:{authorization:`Bearer ${login.json().data.token}`}});
      assert.equal(response.statusCode,403);
    }
  }
  assert.equal(oracleCalls,0);
});
