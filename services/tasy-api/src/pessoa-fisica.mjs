import { z } from "zod";
import oracledb from "oracledb";
import { ApiError } from "./errors.mjs";

const code = z.string().regex(/^[0-9]{1,10}$/);
const dateFormat = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const birthDate = dateFormat.refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value >= "0001-01-01" &&
    value <= new Date().toISOString().slice(0, 10)
  );
}, "Data de nascimento inválida.");
const cpf = z
  .string()
  .regex(/^\d{11}$/)
  .refine((value) => !/^(\d)\1{10}$/.test(value), "CPF inválido.");
const fields = z
  .object({
    nmPessoaFisica: z.string().trim().min(1).max(60),
    dtNascimento: birthDate,
    nrCpf: cpf,
  })
  .strict();
const previous = z
  .object({
    nmPessoaFisica: z.string().nullable(),
    dtNascimento: dateFormat.nullable(),
    nrCpf: z.string().nullable(),
  })
  .strict();
const selectPerson = `SELECT cd_pessoa_fisica AS "cdPessoaFisica",
  nm_pessoa_fisica AS "nmPessoaFisica",
  TO_CHAR(dt_nascimento, 'YYYY-MM-DD') AS "dtNascimento",
  RTRIM(nr_cpf) AS "nrCpf",
  TRIM(nr_telefone_celular) AS "nrTelefoneCelular",
  TRIM(nr_ddd_celular) AS "nrDddCelular",
  TRIM(nr_ddi_celular) AS "nrDdiCelular"
  FROM TASY.pessoa_fisica WHERE cd_pessoa_fisica = :cdPessoaFisica`;
const canAccess = (principal, id) =>
  principal.allPessoaFisica === true || principal.pessoaFisicaIds?.includes(id) === true;

export function pessoaFisicaOperations({ directDmlEnabled }) {
  return {
    "pessoas-fisicas.buscar-cpf": {
      kind: "read",
      schema: z.object({ nrCpf: cpf }).strict(),
      authorize: ({ principal }) =>
        principal.allPessoaFisica === true || principal.pessoaFisicaIds?.length > 0,
      execute: async ({ connection, input, principal }) => {
        const result = await connection.execute(
          selectPerson.replace(
            "cd_pessoa_fisica = :cdPessoaFisica",
            "nr_cpf = :nrCpf AND ROWNUM <= 2",
          ),
          input,
          { maxRows: 2 },
        );
        // Never expose a person outside the authenticated principal's record scope.
        if (
          !result.rows?.length ||
          result.rows.some((row) => !canAccess(principal, row.cdPessoaFisica))
        )
          throw new ApiError(404, "NOT_FOUND", "Paciente não encontrado no escopo autorizado.");
        if (result.rows.length !== 1)
          throw new ApiError(
            409,
            "AMBIGUOUS_RECORD",
            "Há mais de um cadastro para esse CPF. Consulte pelo código do paciente.",
          );
        return result.rows[0];
      },
    },
    "pessoas-fisicas.consultar": {
      kind: "read",
      schema: z.object({ cdPessoaFisica: code }).strict(),
      authorize: ({ input, principal }) => canAccess(principal, input.cdPessoaFisica),
      execute: async ({ connection, input }) => {
        const result = await connection.execute(selectPerson, input, { maxRows: 2 });
        if (!result.rows?.length)
          throw new ApiError(404, "NOT_FOUND", "Pessoa física não encontrada.");
        if (result.rows.length !== 1)
          throw new ApiError(409, "AMBIGUOUS_RECORD", "Código de pessoa física não é único.");
        return result.rows[0];
      },
    },
    "pessoas-fisicas.salvar": {
      kind: "write",
      schema: fields
        .extend({
          cdPessoaFisica: code.optional(),
          anterior: previous.optional(),
        })
        .strict()
        .refine((value) => Boolean(value.cdPessoaFisica) === Boolean(value.anterior)),
      authorize: ({ input, principal }) =>
        input.cdPessoaFisica
          ? principal.canUpdatePessoaFisica !== false && canAccess(principal, input.cdPessoaFisica)
          : principal.canCreatePessoaFisica === true,
      execute: async ({ connection, input, principal }) => {
        if (!directDmlEnabled) {
          throw new ApiError(
            501,
            "MAPPING_NOT_APPROVED",
            "Cadastro de pessoa física ainda não homologado para gravação.",
          );
        }
        if (!principal.tasyEstablishment || !principal.tasyProfile) {
          throw new ApiError(
            501,
            "TASY_CONTEXT_NOT_CONFIGURED",
            "Contexto Tasy ainda não configurado para gravação.",
          );
        }
        // Signature confirmed from ALL_ARGUMENTS. Values are server-owned;
        // the browser cannot select a Tasy identity, establishment or profile.
        await connection.execute(
          `BEGIN
          TASY.wheb_usuario_pck.set_nm_usuario(nm_usuario_p => :nmUsuario);
          TASY.wheb_usuario_pck.set_cd_estabelecimento(cd_estabelecimento_p => :cdEstabelecimento);
          TASY.wheb_usuario_pck.set_cd_perfil(cd_perfil_p => :cdPerfil);
          TASY.wheb_usuario_pck.set_ie_executar_trigger(ie_executar_p => :executarTriggers);
        END;`,
          {
            nmUsuario: principal.tasyUsername,
            cdEstabelecimento: principal.tasyEstablishment,
            cdPerfil: principal.tasyProfile,
            executarTriggers: "S",
          },
          { autoCommit: false },
        );
        // Verify on the same connection before DML; never disable ERP triggers.
        const context = await connection.execute(
          `SELECT
          TASY.wheb_usuario_pck.get_ie_executar_trigger AS "triggers",
          TASY.wheb_usuario_pck.get_nm_usuario AS "usuario",
          TASY.wheb_usuario_pck.get_cd_estabelecimento AS "estabelecimento",
          TASY.wheb_usuario_pck.get_cd_perfil AS "perfil" FROM dual`,
          {},
          { maxRows: 1 },
        );
        const session = context.rows?.[0];
        if (
          session?.triggers !== "S" ||
          session.usuario !== principal.tasyUsername ||
          String(session.estabelecimento) !== String(principal.tasyEstablishment) ||
          String(session.perfil) !== String(principal.tasyProfile)
        ) {
          throw new ApiError(
            503,
            "TASY_CONTEXT_MISMATCH",
            "A conexão não possui o contexto Tasy autorizado.",
          );
        }
        const binds = {
          nmPessoaFisica: input.nmPessoaFisica,
          dtNascimento: input.dtNascimento,
          nrCpf: input.nrCpf,
          nmUsuario: principal.tasyUsername,
        };
        if (input.cdPessoaFisica) {
          const result = await connection.execute(
            `${selectPerson} FOR UPDATE WAIT 5`,
            { cdPessoaFisica: input.cdPessoaFisica },
            { maxRows: 2 },
          );
          if (result.rows?.length > 1)
            throw new ApiError(409, "AMBIGUOUS_RECORD", "Código de pessoa física não é único.");
          const current = result.rows?.[0];
          if (!current)
            throw new ApiError(
              404,
              "NOT_FOUND",
              "Cadastro não encontrado. Para incluir, envie os dados sem código.",
            );
          if (
            current.nmPessoaFisica !== input.anterior.nmPessoaFisica ||
            current.dtNascimento !== input.anterior.dtNascimento ||
            current.nrCpf !== input.anterior.nrCpf
          ) {
            throw new ApiError(
              409,
              "RECORD_CHANGED",
              "Consulte novamente o cadastro antes de alterar.",
            );
          }
          const update = await connection.execute(
            `UPDATE TASY.pessoa_fisica
            SET nm_pessoa_fisica = :nmPessoaFisica,
                dt_nascimento = TO_DATE(:dtNascimento, 'FXYYYY-MM-DD'), nr_cpf = :nrCpf,
                nm_usuario = :nmUsuario, dt_atualizacao = SYSDATE
            WHERE cd_pessoa_fisica = :cdPessoaFisica`,
            { ...binds, cdPessoaFisica: input.cdPessoaFisica },
            { autoCommit: false },
          );
          if (update.rowsAffected !== 1)
            throw new ApiError(409, "RECORD_CHANGED", "Cadastro alterado durante a operação.");
          return { cdPessoaFisica: input.cdPessoaFisica, acao: "alterado" };
        }
        // This precheck is NOT a concurrency guarantee. CPF uniqueness/routines
        // must be validated before enabling direct DML; see the integration guide.
        const existing = await connection.execute(
          'SELECT 1 AS "found" FROM TASY.pessoa_fisica WHERE nr_cpf = :nrCpf AND ROWNUM <= 1',
          { nrCpf: input.nrCpf },
          { maxRows: 1 },
        );
        if (existing.rows?.length)
          throw new ApiError(
            409,
            "PERSON_EXISTS",
            "Cadastro já existente. Consulte antes de alterar.",
          );
        let generatedCode;
        try {
          const inserted = await connection.execute(
            `INSERT INTO TASY.pessoa_fisica
            (cd_pessoa_fisica, nm_pessoa_fisica, dt_nascimento, nr_cpf, nm_usuario, dt_atualizacao, cd_estabelecimento)
            VALUES ('@SEQUENCE', :nmPessoaFisica, TO_DATE(:dtNascimento, 'FXYYYY-MM-DD'), :nrCpf, :nmUsuario, SYSDATE, :cdEstabelecimento)
            RETURNING cd_pessoa_fisica INTO :codigoGerado`,
            {
              ...binds,
              cdEstabelecimento: principal.tasyEstablishment,
              codigoGerado: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 10 },
            },
            { autoCommit: false },
          );
          const returned = inserted.outBinds?.codigoGerado;
          if (
            inserted.rowsAffected !== 1 ||
            !Array.isArray(returned) ||
            returned.length !== 1 ||
            !code.safeParse(returned[0]).success
          ) {
            throw new ApiError(
              503,
              "INVALID_GENERATED_CODE",
              "O Tasy não confirmou um código válido para a inclusão.",
            );
          }
          generatedCode = returned[0];
        } catch (error) {
          if (error.errorNum === 1)
            throw new ApiError(
              409,
              "PERSON_EXISTS",
              "Cadastro já existente. Consulte antes de alterar.",
            );
          throw error;
        }
        return { cdPessoaFisica: generatedCode, acao: "inserido" };
      },
    },
  };
}
