import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase, migrate } from "../src/portal/database.mjs";
import { createEmailService } from "../src/portal/emails.mjs";
import { createHospitalMailer, MailFailure } from "../src/mail-transport.mjs";
import { buildBudgetMail } from "../src/budget-mail.mjs";

const data = () => ({
  paciente: {
    nome: "Paciente fictício <script>",
    cpf: "000.000.000-00",
    email: "original@example.test",
  },
  medico: "Médico de teste",
  tasyRetorno: {
    hash: "version1",
    completo: true,
    consultadoEm: new Date().toISOString(),
    total: 528.18,
    itens: [
      {
        codigo: "10",
        descricao: "Procedimento de teste",
        tipo: "procedimento",
        quantidade: 1,
        total: 500,
        medico: 1000,
        contabilizado: 1,
      },
      {
        codigo: "20",
        descricao: "Material",
        tipo: "material",
        quantidade: 2,
        total: 28.18,
        contabilizado: 1,
      },
    ],
  },
});

test("durable email queue: ownership, deduplication, override, freshness and uncertain delivery", async (t) => {
  const db = await openDatabase({ PORTAL_DB_MODE: "pglite", PORTAL_DATA_DIR: ":memory:" });
  t.after(() => db.close());
  await migrate(db);
  const doctor = { id: randomUUID(), perfil: "Médico" },
    other = { id: randomUUID(), perfil: "Médico" };
  for (const u of [doctor, other])
    await db.query(
      "INSERT INTO portal.users(id,nome,email,perfil,password_hash) VALUES ($1,'Teste',$2,'Médico','unused')",
      [u.id, `${u.id}@example.test`],
    );
  const id = randomUUID();
  await db.query(
    "INSERT INTO portal.requests(id,numero,created_by,status,data) VALUES ($1,'TEST-1',$2,'em_aprovacao',$3)",
    [id, doctor.id, JSON.stringify(data())],
  );
  const sent = [];
  let failure,
    refreshes = 0;
  const service = createEmailService({
    db,
    newRecipient: "notification@example.test",
    portalOrigin: "http://localhost:5173",
    refreshQuote: async () => {
      refreshes++;
    },
    send: async (mail) => {
      if (failure) throw failure;
      sent.push(mail);
    },
    buildMail: async (args) => args,
  });
  await db.transaction(async (tx) => {
    await service.enqueueNew(tx, id, doctor);
    await service.enqueueNew(tx, id, doctor);
  });
  assert.equal((await service.status({ id }, doctor)).length, 1);
  failure = new MailFailure("SMTP_CONNECTION");
  await service.drain();
  assert.equal((await service.status({ id }, doctor))[0].state, "failed");
  assert.equal((await db.query("SELECT count(*)::int AS n FROM portal.requests")).rows[0].n, 1);
  await assert.rejects(
    service.queuePatient({ id, email: "override@example.test", hash: "version1" }, other),
    (e) => e.code === "NOT_FOUND",
  );
  assert.equal(refreshes, 0);
  await assert.rejects(
    service.queuePatient({ id, email: "bad", hash: "version1" }, doctor),
    (e) => e.code === "INVALID_INPUT",
  );
  failure = undefined;
  const queued = await service.queuePatient(
    { id, email: "Override@example.test", hash: "version1" },
    doctor,
  );
  const again = await service.queuePatient(
    { id, email: "override@example.test", hash: "version1" },
    doctor,
  );
  assert.equal(queued.id, again.id);
  await service.drain();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].recipient, "override@example.test");
  assert.equal(
    (await db.query("SELECT data FROM portal.requests WHERE id=$1", [id])).rows[0].data.paciente
      .email,
    "original@example.test",
  );
  await assert.rejects(
    service.retry({ id, emailId: queued.id }, doctor),
    (e) => e.code === "EMAIL_STATE",
  );
  const stale = await service.queuePatient(
    { id, email: "second@example.test", hash: "version1" },
    doctor,
  );
  await db.query(
    `UPDATE portal.requests SET data=jsonb_set(data,'{tasyRetorno,hash}','"version2"') WHERE id=$1`,
    [id],
  );
  await service.drain();
  assert.equal(sent.length, 1);
  assert.equal(
    (await service.status({ id }, doctor)).find((m) => m.id === stale.id).error_code,
    "QUOTE_CHANGED",
  );
  const uncertain = await service.queuePatient(
    { id, email: "third@example.test", hash: "version2" },
    doctor,
  );
  failure = new MailFailure("SMTP_DELIVERY", true);
  await service.drain();
  assert.equal(
    (await service.status({ id }, doctor)).find((m) => m.id === uncertain.id).state,
    "unknown",
  );
  await assert.rejects(
    service.retry({ id, emailId: uncertain.id }, doctor),
    (e) => e.code === "EMAIL_STATE",
  );
  const interrupted = await service.queuePatient(
    { id, email: "fourth@example.test", hash: "version2" },
    doctor,
  );
  await db.query("UPDATE portal.email_outbox SET state='sending' WHERE id=$1", [interrupted.id]);
  await service.recover();
  assert.equal(
    (await service.status({ id }, doctor)).find((m) => m.id === interrupted.id).state,
    "unknown",
  );
});

test("SMTP uses selected Oracle account, TLS and sanitized failure states", async () => {
  let config,
    closed = 0,
    failVerify = false,
    failSend;
  const pool = {
    getConnection: async () => ({
      execute: async (sql, binds) => {
        if (sql.startsWith("SET")) return {};
        assert.equal(binds.sender, "tasy@aebmg.org.br");
        return {
          rows: [{ user: "sender", pass: "test-secret", host: "smtp.example.test", port: "587" }],
        };
      },
      rollback: async () => {},
      close: async () => {},
    }),
  };
  const send = createHospitalMailer({
    pool,
    createTransport: (opts) => {
      config = opts;
      return {
        verify: async () => {
          if (failVerify) throw Error("secret");
        },
        sendMail: async () => {
          if (failSend) throw failSend;
          return { accepted: ["test@example.test"], rejected: [] };
        },
        close: () => {
          closed++;
        },
      };
    },
  });
  await send({ to: "test@example.test" });
  assert.equal(config.requireTLS, true);
  assert.equal(config.tls.rejectUnauthorized, true);
  assert.equal(config.disableUrlAccess, true);
  assert.equal(closed, 1);
  failVerify = true;
  await assert.rejects(
    send({}),
    (e) => e.code === "SMTP_CONNECTION" && !e.uncertain && !e.message.includes("secret"),
  );
  failVerify = false;
  failSend = Error("lost DATA confirmation");
  await assert.rejects(send({}), (e) => e.uncertain === true);
  failSend = Object.assign(Error("rejected"), { responseCode: 550 });
  await assert.rejects(send({}), (e) => e.uncertain === false);
});

test("branded mail escapes patient values and attaches a generated PDF only for patient", async () => {
  const args = {
    snapshot: { id: randomUUID(), numero: "TEST-1", data: data() },
    recipient: "test@example.test",
    id: randomUUID(),
    portalOrigin: "http://localhost:5173",
  };
  const notification = await buildBudgetMail({ ...args, kind: "new_request" });
  assert.ok(notification.html.includes("&lt;script&gt;"));
  assert.ok(!notification.html.includes("<script>"));
  assert.ok(notification.html.includes("#004876"));
  assert.ok(notification.html.includes("#FFA400"));
  assert.equal(notification.attachments.length, 1);
  const quote = await buildBudgetMail({ ...args, kind: "patient_quote" });
  assert.equal(quote.attachments.length, 2);
  assert.equal(quote.attachments[1].content.subarray(0, 4).toString(), "%PDF");
  assert.ok(quote.text.includes("528,18"));
  assert.ok(!quote.text.includes("1.528,18"));
});
