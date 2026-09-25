import { z } from "zod";
import { ApiError } from "./errors.mjs";

export function emailOperation({ directDmlEnabled, canAccess, preparePersonWrite }) {
  return {
    kind: "write",
    schema: z
      .object({
        cdPessoaFisica: z.string().regex(/^\d{1,10}$/),
        nrCpf: z.string().regex(/^\d{11}$/),
        email: z
          .string()
          .trim()
          .email()
          .max(255)
          .refine((v) => Buffer.byteLength(v, "utf8") <= 255),
      })
      .strict(),
    authorize: ({ input, principal }) =>
      principal.enabled === true && canAccess(principal, input.cdPessoaFisica),
    execute: async ({ connection, input, principal }) => {
      if (!directDmlEnabled)
        throw new ApiError(403, "WRITES_DISABLED", "Atualização de e-mail no Tasy desabilitada.");
      await preparePersonWrite(connection, principal);
      const person = await connection.execute(
        `SELECT RTRIM(nr_cpf) AS "cpf" FROM TASY.pessoa_fisica
         WHERE cd_pessoa_fisica=:id FOR UPDATE WAIT 5`,
        { id: input.cdPessoaFisica },
        { maxRows: 2 },
      );
      if (person.rows?.length !== 1 || person.rows[0].cpf !== input.nrCpf)
        throw new ApiError(
          409,
          "PATIENT_MISMATCH",
          "O CPF não corresponde ao paciente selecionado no Tasy.",
        );
      const query = `SELECT nr_sequencia AS "sequencia", ds_email AS "email"
        FROM TASY.compl_pessoa_fisica WHERE cd_pessoa_fisica=:id AND ie_tipo_complemento=1`;
      const result = await connection.execute(
        `${query} FOR UPDATE WAIT 5`,
        { id: input.cdPessoaFisica },
        { maxRows: 2 },
      );
      if (result.rows.length > 1)
        throw new ApiError(
          409,
          "AMBIGUOUS_CONTACT",
          "Paciente com mais de um complemento residencial no Tasy. Revise o cadastro antes de enviar.",
        );
      const current = result.rows[0];
      if (current?.email === input.email)
        return { cdPessoaFisica: input.cdPessoaFisica, acao: "inalterado" };
      let changed;
      if (current) {
        changed = await connection.execute(
          `UPDATE TASY.compl_pessoa_fisica SET ds_email=:email, nm_usuario=:usuario, dt_atualizacao=SYSDATE
           WHERE cd_pessoa_fisica=:id AND nr_sequencia=:sequencia AND ie_tipo_complemento=1`,
          {
            email: input.email,
            usuario: principal.tasyUsername,
            id: input.cdPessoaFisica,
            sequencia: current.sequencia,
          },
          { autoCommit: false },
        );
      } else {
        // The parent row lock serializes portal insertions; the composite PK also
        // rejects a concurrent Tasy insertion. Do not overwrite another complement.
        changed = await connection.execute(
          `INSERT INTO TASY.compl_pessoa_fisica
           (cd_pessoa_fisica,nr_sequencia,ie_tipo_complemento,ds_email,nm_usuario,dt_atualizacao,nm_usuario_nrec,dt_atualizacao_nrec)
           SELECT :id,NVL(MAX(nr_sequencia),0)+1,1,:email,:usuario,SYSDATE,:usuario,SYSDATE
           FROM TASY.compl_pessoa_fisica WHERE cd_pessoa_fisica=:id`,
          { id: input.cdPessoaFisica, email: input.email, usuario: principal.tasyUsername },
          { autoCommit: false },
        );
      }
      if (changed.rowsAffected !== 1)
        throw new ApiError(
          409,
          "RECORD_CHANGED",
          "Não foi possível atualizar o e-mail do paciente.",
        );
      const saved = await connection.execute(query, { id: input.cdPessoaFisica }, { maxRows: 2 });
      if (saved.rows.length !== 1 || saved.rows[0].email !== input.email)
        throw new ApiError(
          409,
          "EMAIL_NOT_SAVED",
          "O Tasy não confirmou o e-mail informado. A alteração foi desfeita.",
        );
      return { cdPessoaFisica: input.cdPessoaFisica, acao: current ? "alterado" : "inserido" };
    },
  };
}
