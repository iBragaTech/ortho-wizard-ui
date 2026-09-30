import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase, migrate } from "../src/portal/database.mjs";
import { createPortalOperations } from "../src/portal/operations.mjs";

const draft = {
  nome: "Implante de Cateter",
  dados: {
    cdConvenio: "29",
    cdCategoria: "1",
    procedimento: [
      { codigo: "123", origem: "1", nome: "Implante de cateter duplo lúmen", quantidade: 1 },
    ],
    adicionais: [{ codigo: "124", origem: "1", nome: "Procedimento adicional", quantidade: 2 }],
    materiais: [{ codigo: "456", nome: "Material", grupo: null, quantidade: 3 }],
    opme: [{ codigo: "789", nome: "Cateter", grupo: "OPME", quantidade: 2 }],
  },
};

test("budget favorites persist quantities and remain private to their doctor", async (t) => {
  const db = await openDatabase({ PORTAL_DB_MODE: "pglite", PORTAL_DATA_DIR: ":memory:" });
  t.after(() => db.close());
  await migrate(db);
  const actors = [];
  for (const [index, perfil] of [
    "Médico",
    "Médico",
    "Administrador",
    "Comercial",
    "Custos",
  ].entries()) {
    actors.push(
      (
        await db.query(
          "INSERT INTO portal.users(nome,email,perfil,password_hash) VALUES($1,$2,$3,'unused') RETURNING id,perfil",
          [`User ${index}`, `user${index}@example.test`, perfil],
        )
      ).rows[0],
    );
  }
  const [doctor, other, ...staff] = actors;
  let run = createPortalOperations(db);
  const saved = await run("saveBudgetTemplate", draft, doctor);
  assert.deepEqual(saved.dados, draft.dados);
  await migrate(db);
  run = createPortalOperations(db);
  assert.deepEqual(await run("listBudgetTemplates", {}, doctor), [saved]);
  assert.deepEqual(await run("listBudgetTemplates", {}, other), []);
  await assert.rejects(run("deleteBudgetTemplate", { id: saved.id }, other), { code: "NOT_FOUND" });
  await assert.rejects(
    run("saveBudgetTemplate", { ...draft, nome: " implante de cateter " }, doctor),
    { code: "ALREADY_EXISTS" },
  );
  const otherSaved = await run("saveBudgetTemplate", draft, other);
  assert.notEqual(otherSaved.id, saved.id);
  for (const actor of staff) {
    await assert.rejects(run("listBudgetTemplates", {}, actor), { code: "FORBIDDEN" });
    await assert.rejects(run("saveBudgetTemplate", draft, actor), { code: "FORBIDDEN" });
    await assert.rejects(run("deleteBudgetTemplate", { id: saved.id }, actor), {
      code: "FORBIDDEN",
    });
  }
  for (const body of [
    { ...draft, userId: other.id },
    { ...draft, nome: "   " },
    { ...draft, dados: { ...draft.dados, paciente: { nome: "Must not be saved" } } },
    { ...draft, dados: { ...draft.dados, procedimento: [] } },
    { ...draft, dados: { ...draft.dados, opme: [{ ...draft.dados.opme[0], quantidade: 0 }] } },
    {
      ...draft,
      dados: { ...draft.dados, materiais: [{ ...draft.dados.materiais[0], quantidade: 1.5 }] },
    },
    { ...draft, dados: { ...draft.dados, opme: [{ ...draft.dados.opme[0], preco: 100 }] } },
  ]) {
    await assert.rejects(run("saveBudgetTemplate", body, doctor), { code: "INVALID_INPUT" });
  }
  await assert.rejects(run("listBudgetTemplates", { userId: other.id }, doctor), {
    code: "INVALID_INPUT",
  });
  assert.deepEqual(await run("listBudgetTemplates", {}, doctor), [saved]);
  await run("deleteBudgetTemplate", { id: saved.id }, doctor);
  assert.deepEqual(await run("listBudgetTemplates", {}, doctor), []);
  assert.deepEqual(await run("listBudgetTemplates", {}, other), [otherSaved]);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM portal.requests")).rows[0].n, 0);
});
