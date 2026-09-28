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
    // Portal rule: sum the internal-procedure averages for this doctor/procedure.
    // Equal averages from different records must each contribute; no origin filter.
    const result = await connection.execute(
      `SELECT SUM(qt_media_medico) AS "minutos" FROM TASY.tempo_proced_medico
       WHERE cd_medico=:cdMedico AND cd_procedimento=:cdProcedimento
         AND qt_media_medico>0`,
      { cdMedico, cdProcedimento: input.cdProcedimento },
      { maxRows: 1 },
    );
    if (!result.rows?.length) return { minutos: null, motivo: "sem_media" };
    const minutes = Number(result.rows[0].minutos);
    if (!Number.isFinite(minutes) || minutes <= 0 || !Number.isSafeInteger(Math.round(minutes)))
      return { minutos: null, motivo: "sem_media" };
    return { minutos: Math.max(1, Math.round(minutes)), motivo: null };
  },
};
