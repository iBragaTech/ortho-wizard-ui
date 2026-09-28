import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../../../src/lib/data/use-doctor-block-time.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

// Exercise the actual hook's transitions with controlled session/query responses.
function harness() {
  let state = null;
  let query = { data: undefined, error: null, isFetching: true };
  const exports = {};
  const dependencies = {
    react: { useState: () => [state, value => { state = value; }] },
    "@tanstack/react-query": { useQuery: () => query },
    "@/lib/auth/session": { useSession: () => ({ user: { id: "doctor", nome: "Médico teste", perfil: "Médico" } }) },
    "./local-api": { localAuthEnabled: true },
    "./tasy-supabase": { getTasyClient: () => ({}) },
  };
  vm.runInNewContext(compiled, { exports, require: name => dependencies[name] });
  return {
    render: (props = {}) => exports.useDoctorBlockTime({ open: true, medical: true, procedureCode: "418010064", ...props }),
    respond: (data, error = null) => { query = { data, error, isFetching: false }; },
  };
}

test("block time preloads average and warns without replacing a physician's different value", () => {
  const h = harness();
  assert.equal(h.render().loading, true);
  h.respond({ minutos: 90, motivo: null });
  assert.equal(h.render().value, "90");
  assert.equal(h.render().warning, null);
  h.render().setValue("120");
  assert.equal(h.render().value, "120");
  assert.equal(h.render().readOnly, false);
  assert.match(h.render().warning, /90 minutos.*120 minutos.*mantido/);
  h.render().setValue("90");
  assert.equal(h.render().warning, null);
});

test("no average allows manual entry; pending response does not overwrite typed minutes", () => {
  const h = harness();
  h.render().setValue("75");
  h.respond({ minutos: 90, motivo: null });
  assert.equal(h.render().value, "75");
  assert.ok(h.render().warning);
  h.render().reset();
  h.respond({ minutos: null, motivo: "sem_media" });
  assert.equal(h.render().value, "");
  h.render().setValue("60");
  assert.equal(h.render().value, "60");
  assert.equal(h.render().warning, null);
  assert.equal(h.render().readOnly, false);
});

test("another procedure uses its own average; existing saved minutes remain editable", () => {
  const h = harness();
  h.respond({ minutos: 90, motivo: null });
  h.render().setValue("120");
  h.respond({ minutos: 45, motivo: null });
  assert.equal(h.render({ procedureCode: "999" }).value, "45");
  const saved = h.render({ initialValue: "100" });
  assert.equal(saved.value, "100");
  assert.ok(saved.warning);
  assert.equal(saved.readOnly, false);
});
