import test from "node:test";
import assert from "node:assert/strict";
import { operations } from "../src/operations.mjs";
import { createExecutor } from "../src/executor.mjs";

const name = "medicos.tempo-procedimento";
const principal = {
  enabled: true,
  subject: "doctor-id",
  tasyUsername: "doctor",
  operations: [name],
};
function fixture({ users = [{ cdMedico: "123" }], averages = [{ minutos: 90 }], failure } = {}) {
  const calls = [];
  const connection = {
    execute: async (sql, binds, options) => {
      calls.push({ sql, binds, options });
      if (sql.includes("FROM TASY.usuario")) return { rows: users };
      if (sql.includes("FROM TASY.tempo_proced_medico")) {
        if (failure) throw Error("Oracle unavailable");
        return { rows: averages };
      }
      return { rows: [] };
    },
    rollback: async () => calls.push("rollback"),
    commit: async () => calls.push("commit"),
    close: async () => calls.push("close"),
  };
  const execute = createExecutor({
    pool: { getConnection: async () => connection },
    operations,
    writesEnabled: false,
    callTimeout: 10000,
    audit: () => {},
  });
  return {
    calls,
    run: (body = { cdProcedimento: "456" }, user = principal) =>
      execute({ name, body, principal: user, requestId: "test" }),
  };
}

test("average is read using only the authenticated Tasy username and its person code", async () => {
  const f = fixture();
  assert.deepEqual(await f.run(), { minutos: 90, motivo: null });
  assert.equal(f.calls[0].sql, "SET TRANSACTION READ ONLY");
  const identity = f.calls.find((c) => c.sql?.includes("FROM TASY.usuario"));
  assert.deepEqual(identity.binds, { nmUsuario: "doctor" });
  const query = f.calls.find((c) => c.sql?.includes("FROM TASY.tempo_proced_medico"));
  assert.deepEqual(query.binds, { cdMedico: "123", cdProcedimento: "456" });
  assert.match(query.sql, /SELECT DISTINCT qt_media_medico/);
  assert.match(query.sql, /FETCH FIRST 2 ROWS ONLY/);
  assert.doesNotMatch(query.sql, /AGENDA_PACIENTE|NR_PROC_INTERNO|QT_MEDIO_TEMPO_GERAL/i);
  assert.ok(!f.calls.includes("commit"));
  assert.deepEqual(f.calls.slice(-2), ["rollback", "close"]);
});

test("callers cannot select another doctor, username or supply SQL; explicit permission is required", async () => {
  for (const body of [
    { cdProcedimento: "456", cdMedico: "other" },
    { cdProcedimento: "456", nmUsuario: "other" },
    { cdProcedimento: "1 OR 1=1" },
    {},
    { cdProcedimento: "456", nrSequencia: "789" },
  ]) {
    const f = fixture();
    await assert.rejects(f.run(body), { code: "INVALID_INPUT" });
    assert.equal(f.calls.length, 0);
  }
  await assert.rejects(fixture().run(undefined, { ...principal, operations: [] }), {
    code: "FORBIDDEN",
  });
  await assert.rejects(fixture().run(undefined, { ...principal, enabled: false }), {
    code: "FORBIDDEN",
  });
});

test("missing person, missing mean and conflicting means explicitly allow manual input", async () => {
  const absent = fixture({ users: [{ cdMedico: null }] });
  assert.deepEqual(await absent.run(), { minutos: null, motivo: "sem_medico" });
  assert.ok(!absent.calls.some((c) => c.sql?.includes("FROM TASY.tempo_proced_medico")));
  assert.deepEqual(await fixture({ averages: [] }).run(), { minutos: null, motivo: "sem_media" });
  assert.deepEqual(await fixture({ averages: [{ minutos: 90 }, { minutos: 120 }] }).run(), {
    minutos: null,
    motivo: "multiplas_medias",
  });
  for (const minutos of [0, -1, null, NaN, Infinity])
    assert.deepEqual(await fixture({ averages: [{ minutos }] }).run(), {
      minutos: null,
      motivo: "sem_media",
    });
  assert.deepEqual(await fixture({ averages: [{ minutos: 90.6 }] }).run(), {
    minutos: 91,
    motivo: null,
  });
});

test("inactive identity and database failure are not misreported as a missing mean", async () => {
  await assert.rejects(fixture({ users: [] }).run(), { code: "INVALID_TASY_LINK" });
  await assert.rejects(fixture({ users: [{ cdMedico: "123" }, { cdMedico: "456" }] }).run(), {
    code: "INVALID_TASY_LINK",
  });
  await assert.rejects(fixture({ failure: true }).run(), { code: "TASY_UNAVAILABLE" });
});
