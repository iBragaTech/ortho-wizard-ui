import { z } from "zod";
import { ApiError } from "../errors.mjs";
import { buildBudgetMail } from "../budget-mail.mjs";

const email = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
const idSchema = z.object({ id: z.string().uuid() }).strict();
const parse = (schema, input) => {
  const r = schema.safeParse(input);
  if (!r.success)
    throw new ApiError(400, "INVALID_INPUT", "Informe um e-mail válido e atualize o orçamento.");
  return r.data;
};
export function quoteReady(row) {
  const r = row.data.tasyRetorno;
  return (
    row.status === "em_aprovacao" &&
    !row.data.inativo &&
    !row.data.excluido &&
    r?.completo === true &&
    !r.erro &&
    Number.isFinite(r.total) &&
    r.total >= 0 &&
    Array.isArray(r.itens) &&
    r.itens.length > 0 &&
    Date.now() - Date.parse(r.consultadoEm) < 120000
  );
}

export function createEmailService({
  db,
  send,
  newRecipient,
  portalOrigin,
  refreshQuote,
  buildMail = buildBudgetMail,
}) {
  const recipient = email.parse(newRecipient);
  let running;
  const access = async (id, user) => {
    const row = (
      await db.query(
        `SELECT * FROM portal.requests WHERE id=$1
      AND COALESCE(data->>'excluido','false') <> 'true'
      AND ($2 <> 'Médico' OR created_by=$3 OR assigned_to=$3)`,
        [id, user.perfil, user.id],
      )
    ).rows[0];
    if (!row) throw new ApiError(404, "NOT_FOUND", "Orçamento não encontrado.");
    return row;
  };
  const event = (tx, id, actor, title, description) =>
    tx.query(
      "INSERT INTO portal.events(request_id,actor_id,titulo,descricao) VALUES ($1,$2,$3,$4)",
      [id, actor, title, description],
    );
  const service = {
    enqueueNew: async (tx, id, user) => {
      const row = (await tx.query("SELECT id,numero,data FROM portal.requests WHERE id=$1", [id]))
        .rows[0];
      await tx.query(
        `INSERT INTO portal.email_outbox(request_id,actor_id,kind,recipient,dedupe_key,snapshot)
        VALUES ($1,$2,'new_request',$3,$4,$5::jsonb) ON CONFLICT(dedupe_key) DO NOTHING`,
        [id, user.id, recipient, `new:${id}`, JSON.stringify(row)],
      );
    },
    status: async (input, user) => {
      const { id } = parse(idSchema, input);
      await access(id, user);
      return (
        await db.query(
          "SELECT id,kind,recipient,state,error_code,created_at,sent_at FROM portal.email_outbox WHERE request_id=$1 ORDER BY created_at DESC LIMIT 20",
          [id],
        )
      ).rows;
    },
    queuePatient: async (input, user) => {
      if (!["Médico", "Administrador"].includes(user.perfil))
        throw new ApiError(403, "FORBIDDEN", "Envio ao paciente disponível ao médico responsável.");
      const value = parse(
        idSchema.extend({ email, hash: z.string().min(1).max(128) }).strict(),
        input,
      );
      await access(value.id, user); // authorize before any Oracle refresh
      if (refreshQuote) await refreshQuote(value.id);
      return db.transaction(async (tx) => {
        const row = (
          await tx.query("SELECT * FROM portal.requests WHERE id=$1 FOR UPDATE", [value.id])
        ).rows[0];
        if (user.perfil === "Médico" && row.created_by !== user.id && row.assigned_to !== user.id)
          throw new ApiError(403, "FORBIDDEN", "Orçamento atribuído a outro médico.");
        if (!quoteReady(row) || row.data.tasyRetorno.hash !== value.hash)
          throw new ApiError(
            409,
            "QUOTE_CHANGED",
            "O orçamento mudou ou ainda não está pronto. Atualize a página antes de enviar.",
          );
        const institution = (await tx.query("SELECT data FROM portal.settings WHERE id=1")).rows[0]
          ?.data;
        const key = `patient:${value.id}:${value.hash}:${value.email}`;
        const inserted = await tx.query(
          `INSERT INTO portal.email_outbox(request_id,actor_id,kind,recipient,dedupe_key,snapshot)
          VALUES ($1,$2,'patient_quote',$3,$4,$5::jsonb) ON CONFLICT(dedupe_key) DO NOTHING RETURNING id,state`,
          [
            value.id,
            user.id,
            value.email,
            key,
            JSON.stringify({ id: row.id, numero: row.numero, data: row.data, institution }),
          ],
        );
        if (inserted.rows.length)
          await event(
            tx,
            row.id,
            user.id,
            "Envio de orçamento solicitado",
            `PDF destinado a ${value.email}.`,
          );
        return (
          inserted.rows[0] ??
          (await tx.query("SELECT id,state FROM portal.email_outbox WHERE dedupe_key=$1", [key]))
            .rows[0]
        );
      });
    },
    retry: async (input, user) => {
      const v = parse(idSchema.extend({ emailId: z.string().uuid() }).strict(), input);
      await access(v.id, user);
      const mail = (
        await db.query("SELECT * FROM portal.email_outbox WHERE id=$1 AND request_id=$2", [
          v.emailId,
          v.id,
        ])
      ).rows[0];
      if (
        !mail ||
        (mail.kind === "new_request"
          ? user.perfil !== "Administrador"
          : !["Médico", "Administrador"].includes(user.perfil))
      )
        throw new ApiError(403, "FORBIDDEN", "Envio não autorizado.");
      if (mail.state !== "failed")
        throw new ApiError(
          409,
          "EMAIL_STATE",
          "Não é possível reenviar automaticamente uma mensagem já enviada ou sem confirmação.",
        );
      await db.query(
        "UPDATE portal.email_outbox SET state='queued',error_code=NULL WHERE id=$1 AND state='failed'",
        [mail.id],
      );
      return { id: mail.id, state: "queued" };
    },
    recover: () =>
      db.query(
        "UPDATE portal.email_outbox SET state='unknown',error_code='PROCESS_INTERRUPTED' WHERE state='sending'",
      ),
    drain: () =>
      (running ??= (async () => {
        const pending = (
          await db.query(
            "SELECT id FROM portal.email_outbox WHERE state='queued' ORDER BY created_at LIMIT 20",
          )
        ).rows;
        for (const candidate of pending) {
          const row = (
            await db.query(
              "UPDATE portal.email_outbox SET state='sending' WHERE id=$1 AND state='queued' RETURNING *",
              [candidate.id],
            )
          ).rows[0];
          if (!row) continue;
          let delivered = false;
          try {
            if (row.kind === "patient_quote") {
              if (refreshQuote) await refreshQuote(row.request_id);
              const current = (
                await db.query("SELECT * FROM portal.requests WHERE id=$1", [row.request_id])
              ).rows[0];
              if (
                !current ||
                !quoteReady(current) ||
                current.data.tasyRetorno.hash !== row.snapshot.data.tasyRetorno.hash
              )
                throw new ApiError(409, "QUOTE_CHANGED", "Orçamento alterado antes do envio.");
            }
            const mail = await buildMail({
              kind: row.kind,
              snapshot: row.snapshot,
              recipient: row.recipient,
              id: row.id,
              portalOrigin,
            });
            await send(mail);
            delivered = true;
            await db.transaction(async (tx) => {
              await tx.query(
                "UPDATE portal.email_outbox SET state='sent',sent_at=now(),error_code=NULL WHERE id=$1",
                [row.id],
              );
              await event(
                tx,
                row.request_id,
                row.actor_id,
                "E-mail aceito pelo servidor",
                `${row.kind === "new_request" ? "Notificação de novo orçamento" : "Orçamento em PDF"} enviado para ${row.recipient}.`,
              );
            });
          } catch (error) {
            const state = delivered || error.uncertain ? "unknown" : "failed";
            const code =
              error.code === "QUOTE_CHANGED"
                ? "QUOTE_CHANGED"
                : state === "unknown"
                  ? "DELIVERY_UNKNOWN"
                  : [
                        "SMTP_CONFIGURATION",
                        "SMTP_CERTIFICATE",
                        "SMTP_AUTHENTICATION",
                        "SMTP_CONNECTION",
                        "SMTP_REJECTED",
                        "SMTP_DELIVERY",
                      ].includes(error.code)
                    ? error.code
                    : "EMAIL_FAILED";
            await db.query("UPDATE portal.email_outbox SET state=$2,error_code=$3 WHERE id=$1", [
              row.id,
              state,
              code,
            ]);
          }
        }
      })().finally(() => {
        running = undefined;
      })),
    wait: async () => {
      if (running) await running;
    },
  };
  return service;
}
