import { z } from "zod";
import { ApiError } from "../errors.mjs";
import { tasySelection } from "../orcamento-schema.mjs";
export function createExportService({ db, send, principals }) {
  const access = async (tx, id, user, lock = false) => {
    const row = (
      await tx.query(
        `SELECT * FROM portal.requests WHERE id=$1
      AND COALESCE(data->>'excluido','false') <> 'true'
      AND COALESCE(data->>'inativo','false') <> 'true'
      AND ($2 <> 'Médico' OR created_by=$3 OR assigned_to=$3) ${lock ? "FOR UPDATE" : ""}`,
        [id, user.perfil, user.id],
      )
    ).rows[0];
    if (!row) throw new ApiError(404, "NOT_FOUND", "Orçamento não encontrado.");
    return row;
  };
  const log = (tx, id, user, title, description) =>
    tx.query(
      `INSERT INTO portal.events(request_id,actor_id,titulo,descricao)
    VALUES ($1,$2,$3,$4)`,
      [id, user.id, title, description],
    );
  return {
    status: async (id, user) => {
      await access(db, id, user);
      return (
        (
          await db.query(
            "SELECT state,tasy_id,error_code,updated_at FROM portal.tasy_exports WHERE request_id=$1",
            [id],
          )
        ).rows[0] ?? null
      );
    },
    submit: async (input, user) => {
      const parsed = z.object({ id: z.string().uuid() }).strict().safeParse(input);
      if (!parsed.success) throw new ApiError(400, "INVALID_INPUT", "Orçamento inválido.");
      if (!send)
        throw new ApiError(
          403,
          "EXPORT_DISABLED",
          "Envio ao Tasy ainda não habilitado na homologação.",
        );
      const principal = principals[user.id];
      if (!principal?.enabled || !principal.operations.includes("orcamentos.enviar"))
        throw new ApiError(
          403,
          "FORBIDDEN",
          "Usuário sem permissão para enviar orçamento ao Tasy.",
        );
      const id = parsed.data.id;
      const prepared = await db.transaction(async (tx) => {
        const row = await access(tx, id, user, true);
        const previous = (
          await tx.query("SELECT * FROM portal.tasy_exports WHERE request_id=$1", [id])
        ).rows[0];
        if (previous) {
          if (
            previous.tasy_username !== principal.tasyUsername ||
            previous.snapshot.context.establishment !== principal.tasyEstablishment ||
            previous.snapshot.context.profile !== principal.tasyProfile
          )
            throw new ApiError(
              409,
              "IDENTITY_CHANGED",
              "Reconcilie o envio com o vínculo Tasy original.",
            );
          if (previous.state === "confirmed") return { confirmed: previous.tasy_id };
          await log(
            tx,
            id,
            user,
            "Reconciliação de envio Tasy solicitada",
            "Mesma chave e conteúdo do envio original.",
          );
          return { snapshot: previous.snapshot };
        }
        if (!tasySelection.safeParse(row.data.tasy).success)
          throw new ApiError(
            400,
            "MISSING_TASY_SELECTION",
            "Este orçamento não possui identificadores Tasy completos. Crie um novo orçamento com paciente e itens do ERP.",
          );
        if (!principal.tasyEstablishment || !principal.tasyProfile)
          throw new ApiError(403, "FORBIDDEN", "Contexto Tasy incompleto.");
        const snapshot = {
          id,
          actorId: user.id,
          data: row.data,
          context: { establishment: principal.tasyEstablishment, profile: principal.tasyProfile },
        };
        await tx.query(
          `INSERT INTO portal.tasy_exports(request_id,actor_id,tasy_username,snapshot,state)
          VALUES ($1,$2,$3,$4::jsonb,'sending')`,
          [id, user.id, principal.tasyUsername, JSON.stringify(snapshot)],
        );
        await log(
          tx,
          id,
          user,
          "Envio Tasy iniciado",
          `Usuário Tasy: ${principal.tasyUsername}. Destino: aguardando cotação.`,
        );
        return { snapshot };
      });
      if (prepared.confirmed) return { nrOrcamento: prepared.confirmed, recuperado: true };
      try {
        const result = await send(prepared.snapshot, principal);
        await db.transaction(async (tx) => {
          const current = (
            await tx.query("SELECT state FROM portal.tasy_exports WHERE request_id=$1 FOR UPDATE", [
              id,
            ])
          ).rows[0];
          await tx.query(
            "UPDATE portal.tasy_exports SET state='confirmed',tasy_id=$2,error_code=NULL,updated_at=now() WHERE request_id=$1",
            [id, result.nrOrcamento],
          );
          if (current.state !== "confirmed")
            await log(
              tx,
              id,
              user,
              "Orçamento registrado no Tasy",
              `Número ${result.nrOrcamento}. Aguardando cotação; preços finais não sincronizados.`,
            );
        });
        return result;
      } catch (error) {
        const code = error instanceof ApiError ? error.code : "LOCAL_CONFIRMATION_FAILED";
        await db
          .transaction(async (tx) => {
            const updated = await tx.query(
              "UPDATE portal.tasy_exports SET state='unknown',error_code=$2,updated_at=now() WHERE request_id=$1 AND state <> 'confirmed' RETURNING request_id",
              [id, code],
            );
            if (updated.rows.length)
              await log(
                tx,
                id,
                user,
                "Envio Tasy sem confirmação",
                `Código: ${code}. Reconciliar a mesma solicitação.`,
              );
          })
          .catch(() => {});
        if (error instanceof ApiError) throw error;
        throw new ApiError(
          503,
          "LOCAL_CONFIRMATION_FAILED",
          "Não foi possível registrar a confirmação local. Reconcilie o envio.",
        );
      }
    },
  };
}
