import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, SignJWT } from "jose";
import { z } from "zod";
import { createAuthenticator } from "../src/auth.mjs";
import { createExecutor } from "../src/executor.mjs";
import { createApp } from "../src/app.mjs";
import { operations, validateOperations } from "../src/operations.mjs";
import { readConfig } from "../src/config.mjs";

const principal = {
  subject: "sub-1",
  tasyUsername: "arafaela",
  operations: ["usuarios.consultar", "orcamentos.criar", "orcamentos.alterar"],
};
function fixture({ failExecute = false, failCommit = false, failClose = false } = {}) {
  const calls = [];
  const connection = {
    execute: async (...args) => {
      calls.push(["execute", ...args]);
      if (failExecute) throw new Error("ORA-00000 internal-host sensitive-data");
      return { rows: [{ nmUsuario: "arafaela" }] };
    },
    commit: async () => {
      calls.push(["commit"]);
      if (failCommit) throw new Error("network");
    },
    rollback: async () => {
      calls.push(["rollback"]);
    },
    close: async () => {
      calls.push(["close"]);
      if (failClose) throw new Error("network");
    },
  };
  const pool = {
    getConnection: async () => {
      calls.push(["acquire"]);
      return connection;
    },
  };
  const audit = [];
  return { calls, connection, pool, audit };
}
const write = {
  kind: "write",
  schema: z.object({ id: z.number().int().positive() }).strict(),
  authorize: ({ input }) => input.id === 7,
  execute: async ({ connection, input }) => {
    await connection.execute("BEGIN TEST_ONLY(:id); END;", { id: input.id });
    return { id: input.id };
  },
};
function executor(f, extra = {}) {
  return createExecutor({
    pool: f.pool,
    operations: { ...operations, "orcamentos.criar": write, "orcamentos.alterar": write },
    writesEnabled: false,
    callTimeout: 10000,
    audit: (event) => f.audit.push(event),
    ...extra,
  });
}
function request(name, body, user = principal) {
  return { name, body, principal: user, requestId: "request-1" };
}

test("read uses binds, object authorization, read-only transaction and releases connection", async () => {
  const f = fixture();
  const result = await executor(f)(request("usuarios.consultar", { nmUsuario: "arafaela" }));
  assert.deepEqual(result, { nmUsuario: "arafaela" });
  assert.equal(f.calls[1][1], "SET TRANSACTION READ ONLY");
  assert.match(f.calls[2][1], /:nmUsuario/);
  assert.deepEqual(f.calls[2][2], { nmUsuario: "arafaela" });
  assert.deepEqual(f.calls.slice(-2), [["rollback"], ["close"]]);
  assert.equal(f.connection.clientId, "arafaela");
  assert.equal(f.connection.callTimeout, 10000);
});

test("rejects unauthorised operation, disabled writes and unknown names before acquiring Oracle", async () => {
  for (const [req, code] of [
    [request("usuarios.consultar", {}, { ...principal, operations: [] }), "FORBIDDEN"],
    [request("orcamentos.criar", { id: 7 }), "WRITES_DISABLED"],
    [request("sql.execute", { sql: "DELETE FROM usuario" }), "UNKNOWN_OPERATION"],
    [request("constructor", {}), "UNKNOWN_OPERATION"],
    [request("usuarios.consultar", { nmUsuario: "arafaela", sql: "x" }), "INVALID_INPUT"],
  ]) {
    const f = fixture();
    await assert.rejects(executor(f)(req), { code });
    assert.equal(f.calls.length, 0);
  }
});

test("cannot read another Tasy user, even with operation permission", async () => {
  const f = fixture();
  await assert.rejects(
    executor(f)(request("usuarios.consultar", { nmUsuario: "other' OR 1=1--" })),
    { code: "FORBIDDEN" },
  );
  assert.equal(f.calls.filter((c) => c[0] === "execute").length, 1); // read-only command only
  assert.deepEqual(f.calls.slice(-2), [["rollback"], ["close"]]);
});

test("enabled, mapped insertion and alteration commit once after authorization", async () => {
  for (const name of ["orcamentos.criar", "orcamentos.alterar"]) {
    const f = fixture();
    assert.deepEqual(await executor(f, { writesEnabled: true })(request(name, { id: 7 })), {
      id: 7,
    });
    assert.deepEqual(
      f.calls.map((c) => c[0]),
      ["acquire", "execute", "commit", "close"],
    );
    assert.equal(f.audit[0].outcome, "success");
  }
});

test("denies writes to unauthorized records and rolls back", async () => {
  const f = fixture();
  await assert.rejects(
    executor(f, { writesEnabled: true })(request("orcamentos.alterar", { id: 8 })),
    { code: "FORBIDDEN" },
  );
  assert.deepEqual(
    f.calls.map((c) => c[0]),
    ["acquire", "rollback", "close"],
  );
});

test("Oracle failure rolls back, releases connection and hides database error", async () => {
  const f = fixture({ failExecute: true });
  await assert.rejects(
    executor(f, { writesEnabled: true })(request("orcamentos.criar", { id: 7 })),
    (error) => {
      assert.equal(error.code, "TASY_UNAVAILABLE");
      assert.doesNotMatch(error.message, /ORA|internal-host|sensitive-data/);
      return true;
    },
  );
  assert.deepEqual(f.calls.slice(-2), [["rollback"], ["close"]]);
});

test("lost commit confirmation reports unknown outcome and never retries", async () => {
  const f = fixture({ failCommit: true });
  await assert.rejects(
    executor(f, { writesEnabled: true })(request("orcamentos.criar", { id: 7 })),
    { code: "WRITE_OUTCOME_UNKNOWN" },
  );
  assert.equal(f.calls.filter((c) => c[0] === "commit").length, 1);
  assert.equal(f.audit[0].outcome, "unknown");
  assert.deepEqual(f.calls.at(-1), ["close"]);
});

test("connection close failure does not change a confirmed commit to a failed request", async () => {
  const f = fixture({ failClose: true });
  assert.deepEqual(
    await executor(f, { writesEnabled: true })(request("orcamentos.criar", { id: 7 })),
    { id: 7 },
  );
  assert.equal(f.audit.at(-1).outcome, "connection_close_failed");
});

test("registry rejects missing authorization and configuration does not print secrets", () => {
  assert.throws(() => validateOperations({ "unsafe.write": { ...write, authorize: undefined } }));
  assert.throws(
    () => readConfig({ ORACLE_PASSWORD: "do-not-print" }),
    (error) => {
      assert.doesNotMatch(error.message, /do-not-print/);
      return true;
    },
  );
});

const { privateKey, publicKey } = await generateKeyPair("RS256");
const authConfig = {
  AUTH_ISSUER: "https://issuer.example/",
  AUTH_AUDIENCE: "tasy-api",
  AUTH_ALGORITHM: "RS256",
};
const authenticate = createAuthenticator(
  authConfig,
  { "sub-1": { ...principal, enabled: true } },
  publicKey,
);
async function token({
  issuer = authConfig.AUTH_ISSUER,
  audience = "tasy-api",
  subject = "sub-1",
  expiry = "5m",
  exp = true,
  claims = {},
  key = privateKey,
} = {}) {
  let jwt = new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(subject)
    .setIssuedAt();
  if (exp) jwt = jwt.setExpirationTime(expiry);
  return jwt.sign(key);
}

test("JWT verifies signature, issuer, audience, expiry and server-owned permissions", async () => {
  const result = await authenticate(
    `Bearer ${await token({ claims: { operations: ["admin"], tasyUsername: "admin" } })}`,
  );
  assert.equal(result.tasyUsername, "arafaela");
  assert.equal(result.operations.includes("admin"), false);
  const other = await generateKeyPair("RS256");
  for (const options of [
    { issuer: "https://evil.example/" },
    { audience: "other-api" },
    { expiry: "-1h" },
    { exp: false },
    { key: other.privateKey },
  ]) {
    await assert.rejects(authenticate(`Bearer ${await token(options)}`), { code: "UNAUTHORIZED" });
  }
  await assert.rejects(authenticate(`Bearer ${await token({ subject: "unknown" })}`), {
    code: "FORBIDDEN",
  });
  await assert.rejects(authenticate('Bearer {"perfil":"Administrador"}'), { code: "UNAUTHORIZED" });
  await assert.rejects(authenticate(undefined), { code: "UNAUTHORIZED" });
});

test("accepts Supabase-style ES256 tokens and denies a disabled principal", async () => {
  const keys = await generateKeyPair("ES256");
  const config = {
    AUTH_ISSUER: "https://project.supabase.co/auth/v1",
    AUTH_AUDIENCE: "authenticated",
    AUTH_ALGORITHM: "ES256",
  };
  const jwt = await new SignJWT({ role: "authenticated" })
    .setProtectedHeader({ alg: "ES256" })
    .setIssuer(config.AUTH_ISSUER)
    .setAudience(config.AUTH_AUDIENCE)
    .setSubject("sub-1")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(keys.privateKey);
  const enabled = createAuthenticator(
    config,
    { "sub-1": { ...principal, enabled: true } },
    keys.publicKey,
  );
  assert.equal((await enabled(`Bearer ${jwt}`)).subject, "sub-1");
  const disabled = createAuthenticator(
    config,
    { "sub-1": { ...principal, enabled: false } },
    keys.publicKey,
  );
  await assert.rejects(disabled(`Bearer ${jwt}`), { code: "FORBIDDEN" });
});

test("HTTP requires a signed token, rejects oversized bodies and only allows configured origin", async (t) => {
  const f = fixture();
  const app = await createApp({
    authenticate,
    execute: executor(f),
    portalOrigin: "https://portal.example",
    logger: false,
  });
  t.after(() => app.close());
  const path = "/v1/operations/usuarios.consultar";
  const anonymous = await app.inject({
    method: "POST",
    url: path,
    payload: { nmUsuario: "arafaela" },
  });
  assert.equal(anonymous.statusCode, 401);
  assert.equal(f.calls.length, 0);
  const bearer = `Bearer ${await token()}`;
  const ok = await app.inject({
    method: "POST",
    url: path,
    headers: { authorization: bearer, origin: "https://portal.example" },
    payload: { nmUsuario: "arafaela" },
  });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.headers["cache-control"], "no-store");
  assert.equal(ok.headers["access-control-allow-origin"], "https://portal.example");
  assert.deepEqual(ok.json().data, { nmUsuario: "arafaela" });
  const foreign = await app.inject({
    method: "OPTIONS",
    url: path,
    headers: { origin: "https://evil.example", "access-control-request-method": "POST" },
  });
  assert.notEqual(foreign.headers["access-control-allow-origin"], "https://evil.example");
  const large = await app.inject({
    method: "POST",
    url: path,
    headers: { authorization: bearer },
    payload: { nmUsuario: "x".repeat(40000) },
  });
  assert.equal(large.statusCode, 413);
  const unknown = await app.inject({
    method: "POST",
    url: "/v1/operations/orcamentos.criar",
    headers: { authorization: bearer },
    payload: { id: 7 },
  });
  assert.equal(unknown.json().error.code, "WRITES_DISABLED");
});
