import { z } from "zod";
import { parse } from "./auth.mjs";
import { ApiError } from "../errors.mjs";
import { quoteReady } from "./emails.mjs";
import { buildPatientQuotePdf } from "../patient-quote-document.mjs";

export function createPatientPdf({ db, refreshQuote, buildPdf = buildPatientQuotePdf }) {
  return async (input, user) => {
    if (!["Médico", "Administrador"].includes(user.perfil))
      throw new ApiError(403, "FORBIDDEN", "Envio ao paciente disponível ao médico responsável.");
    const value = parse(
      z.object({ id: z.string().uuid(), hash: z.string().min(1).max(128) }).strict(),
      input,
    );
    const access = async () => {
      const row = (
        await db.query(
          `SELECT * FROM portal.requests WHERE id=$1
         AND COALESCE(data->>'excluido','false') <> 'true'
         AND ($2 <> 'Médico' OR created_by=$3 OR assigned_to=$3)`,
          [value.id, user.perfil, user.id],
        )
      ).rows[0];
      if (!row) throw new ApiError(404, "NOT_FOUND", "Orçamento não encontrado.");
      return row;
    };
    await access();
    if (refreshQuote) await refreshQuote(value.id);
    const row = await access();
    if (!quoteReady(row) || row.data.tasyRetorno.hash !== value.hash)
      throw new ApiError(
        409,
        "QUOTE_CHANGED",
        "O orçamento mudou ou ainda não está pronto. Atualize a página antes de compartilhar.",
      );
    const institution = (await db.query("SELECT data FROM portal.settings WHERE id=1")).rows[0]
      ?.data;
    const pdf = await buildPdf({ ...row, institution });
    return {
      filename: `Orcamento-${String(row.numero).replace(/[^a-zA-Z0-9-]/g, "")}.pdf`,
      base64: pdf.toString("base64"),
    };
  };
}
