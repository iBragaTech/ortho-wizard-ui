import { z } from "zod";
import { ApiError } from "./errors.mjs";

export const tempoMedicoOperation = {
  kind: "read",
  schema: z.object({ cdProcedimento: z.string().regex(/^\d{1,15}$/) }).strict(),
  authorize: ({ principal }) => principal.enabled === true && Boolean(principal.tasyUsername),
  execute: async ({ connection, input, principal }) => {
    const users = await connection.execute(
      `SELECT TRIM(cd_pessoa_fisica) AS "cdMedico" FROM TASY.usuario
       WHERE nm_usuario=:nmUsuario AND ie_situacao='A'`,
      { nmUsuario: principal.tasyUsername },
      { maxRows: 2 },
    );
    if (users.rows?.length !== 1)
      throw new ApiError(403, "INVALID_TASY_LINK", "Usuário Tasy ativo não encontrado.");
    const cdMedico = users.rows[0].cdMedico;
    if (!cdMedico) return { minutos: null, motivo: "sem_medico" };
    // This installed view already calculates the doctor's average. It does not
    // expose NR_PROC_INTERNO; distinct results must not be averaged or picked at random.
    const result = await connection.execute(
      `SELECT DISTINCT qt_media_medico AS "minutos" FROM TASY.tempo_proced_medico
       WHERE cd_medico=:cdMedico AND cd_procedimento=:cdProcedimento
         AND qt_media_medico>0 FETCH FIRST 2 ROWS ONLY`,
      { cdMedico, cdProcedimento: input.cdProcedimento },
      { maxRows: 2 },
    );
    if (!result.rows?.length) return { minutos: null, motivo: "sem_media" };
    if (result.rows.length !== 1) return { minutos: null, motivo: "multiplas_medias" };
    const minutes = Number(result.rows[0].minutos);
    if (!Number.isFinite(minutes) || minutes <= 0 || !Number.isSafeInteger(Math.round(minutes)))
      return { minutos: null, motivo: "sem_media" };
    return { minutos: Math.max(1, Math.round(minutes)), motivo: null };
  },
};
