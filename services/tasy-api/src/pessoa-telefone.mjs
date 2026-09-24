import { z } from "zod";
import { ApiError } from "./errors.mjs";

export function phoneDigits(value) {
  let digits = value.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55"))
    digits = digits.slice(2);
  return digits;
}

export function personPhone(person) {
  const phone = person.nrTelefoneCelular?.trim() || "";
  const area = person.nrDddCelular?.trim() || "";
  if (/^\d{2}$/.test(area) && /^\d{8,9}$/.test(phone.replace(/\D/g, "")) && !phone.startsWith("+"))
    return `${person.nrDdiCelular?.trim() || "55"}${area}${phone}`;
  return phone;
}

export function phoneOperation({ directDmlEnabled, selectPerson, canAccess, preparePersonWrite }) {
  return {
    kind: "write",
    schema: z
      .object({
        cdPessoaFisica: z.string().regex(/^\d{1,10}$/),
        nrCpf: z.string().regex(/^\d{11}$/),
        telefone: z
          .string()
          .trim()
          .max(40)
          .regex(/^[+\d ().-]+$/)
          .refine((v) => !v.includes("+") || /^\+55[\d ().-]+$/.test(v))
          .refine((v) => /^[1-9]\d{9,10}$/.test(phoneDigits(v))),
        anterior: z.string().max(40),
      })
      .strict(),
    authorize: ({ input, principal }) => canAccess(principal, input.cdPessoaFisica),
    execute: async ({ connection, input, principal }) => {
      if (!directDmlEnabled)
        throw new ApiError(
          501,
          "MAPPING_NOT_APPROVED",
          "Atualização de telefone no Tasy não habilitada.",
        );
      await preparePersonWrite(connection, principal);
      const result = await connection.execute(
        `${selectPerson} FOR UPDATE WAIT 5`,
        { cdPessoaFisica: input.cdPessoaFisica },
        { maxRows: 2 },
      );
      if (result.rows?.length !== 1)
        throw new ApiError(409, "PATIENT_CHANGED", "Consulte novamente o paciente no Tasy.");
      const person = result.rows[0];
      if (person.nrCpf !== input.nrCpf)
        throw new ApiError(
          409,
          "PATIENT_CHANGED",
          "O CPF do paciente foi alterado. Consulte novamente.",
        );
      const digits = phoneDigits(input.telefone);
      const current = phoneDigits(personPhone(person));
      // A confirmed Oracle write can precede a failed local save. Repeating the same
      // value is safe, but must never overwrite a different concurrent change.
      if (current === digits)
        return { cdPessoaFisica: input.cdPessoaFisica, telefone: input.telefone };
      if (current !== phoneDigits(input.anterior))
        throw new ApiError(
          409,
          "RECORD_CHANGED",
          "O telefone foi alterado no Tasy. Consulte novamente o paciente antes de salvar.",
        );
      const update = await connection.execute(
        `UPDATE TASY.pessoa_fisica
        SET nr_telefone_celular = :telefone, nr_ddd_celular = :ddd, nr_ddi_celular = :ddi,
            nm_usuario = :nmUsuario, dt_atualizacao = SYSDATE
        WHERE cd_pessoa_fisica = :cdPessoaFisica`,
        {
          telefone: digits.slice(2),
          ddd: digits.slice(0, 2),
          ddi: "55",
          nmUsuario: principal.tasyUsername,
          cdPessoaFisica: input.cdPessoaFisica,
        },
        { autoCommit: false },
      );
      if (update.rowsAffected !== 1)
        throw new ApiError(409, "RECORD_CHANGED", "O cadastro foi alterado durante a gravação.");
      return { cdPessoaFisica: input.cdPessoaFisica, telefone: input.telefone };
    },
  };
}
