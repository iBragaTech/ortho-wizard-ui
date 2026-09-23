import { linkFields, principalForLink, storeLink } from "./tasy-users.mjs";
import { z } from "zod";
import { ApiError } from "../errors.mjs";
import { createUser, parse, userSchema } from "./auth.mjs";
import { tasySelection } from "../orcamento-schema.mjs";
import { confirmZeroReference } from "./pricing.mjs";

const text = z.string().max(8000);
const money = z.number().finite().min(0).max(9999999999.99).nullable();
const date = z
  .string()
  .refine(
    (v) =>
      v === "" ||
      (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
        !isNaN(Date.parse(`${v}T00:00:00Z`)) &&
        new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v),
  );
const fees = z
  .object({
    honorariosMedicos: money,
    diaria: money,
    cti: money,
    fisioterapia: z.number().int().min(0).max(10000).nullable(),
    tempoBloco: text,
    opme: text,
    anatomoPatologico: text,
    reservaSangue: text,
    equipeMultidisciplinar: text,
    obsMedico: text,
  })
  .strict();
const validCpf = (value) => {
  return /^\d{11}$/.test(value) && !/^(\d)\1{10}$/.test(value);
};
const newRequest = z
  .object({
    nome: z.string().trim().min(1).max(120),
    nascimento: date,
    cpf: z
      .string()
      .regex(/^[\d.\- ]+$/)
      .transform((v) => v.replace(/\D/g, ""))
      .refine(validCpf, "CPF inválido."),
    telefone: z.string().max(40),
    especialidade: text.optional(),
    tipoConsulta: text.optional(),
    dataDesejada: date.optional(),
    observacoes: text.optional(),
    origem: z.enum(["comercial", "medico"]).default("comercial"),
    medico: fees.optional(),
    tasy: tasySelection.optional(),
  })
  .strict()
  .refine((v) => (v.origem === "medico") === Boolean(v.medico));
const settings = z
  .object({
    nome: text,
    cnpj: z.string().max(30),
    endereco: text,
    telefone: z.string().max(40),
    emailNotificacoes: z.union([z.literal(""), z.string().email()]),
  })
  .strict();
const uuid = z.string().uuid();
const idInput = z.object({ id: uuid }).strict();
const allowed = (user, roles) => {
  if (!roles.includes(user.perfil))
    throw new ApiError(403, "FORBIDDEN", "Operação não autorizada para seu perfil.");
};
const fmtDate = (value) =>
  value ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";
const fmtTime = (value) =>
  value ? new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
const rowDto = (row) => ({
  ...row.data,
  id: row.id,
  numero: row.numero,
  status: row.status,
  data: fmtDate(row.created_at),
});
async function getAccessible(db, id, user, lock = false) {
  const { rows } = await db.query(
    `SELECT * FROM portal.requests WHERE id = $1
    AND COALESCE(data->>'excluido','false') <> 'true'
    AND ($2 <> 'Médico' OR created_by = $3 OR assigned_to = $3) ${lock ? "FOR UPDATE" : ""}`,
    [id, user.perfil, user.id],
  );
  if (!rows.length) throw new ApiError(404, "NOT_FOUND", "Orçamento não encontrado.");
  if (lock && rows[0].data.inativo)
    throw new ApiError(409, "INACTIVE_REQUEST", "Orçamento inativo não pode ser alterado.");
  if (
    lock &&
    (await db.query("SELECT request_id FROM portal.tasy_exports WHERE request_id=$1", [id])).rows
      .length
  )
    throw new ApiError(
      409,
      "EXPORT_FROZEN",
      "Orçamento com envio Tasy iniciado. Edição bloqueada para preservar o conteúdo enviado.",
    );
  return rows[0];
}
const event = (db, id, user, title, description = "") =>
  db.query("INSERT INTO portal.events(request_id,actor_id,titulo,descricao) VALUES ($1,$2,$3,$4)", [
    id,
    user.id,
    title,
    description,
  ]);

export function createPortalOperations(
  db,
  { calculateQuote, auditIdentity = () => null, validateTasyLink } = {},
) {
  const handlers = {
    editRequest: async (input, user) => {
      const value = parse(
        z
          .object({
            id: uuid,
            telefone: z.string().max(40),
            observacoes: text,
            anterior: z.object({ telefone: z.string(), observacoes: z.string() }).strict(),
          })
          .strict(),
        input,
      );
      return db.transaction(async (tx) => {
        const row = await getAccessible(tx, value.id, user, true);
        if (row.status === "concluido")
          throw new ApiError(409, "INVALID_STATE", "Orçamento concluído não pode ser editado.");
        if (
          row.data.paciente.telefone !== value.anterior.telefone ||
          row.data.observacoes !== value.anterior.observacoes
        )
          throw new ApiError(
            409,
            "RECORD_CHANGED",
            "O orçamento foi alterado. Atualize a página antes de editar.",
          );
        const data = {
          ...row.data,
          paciente: { ...row.data.paciente, telefone: value.telefone },
          observacoes: value.observacoes,
        };
        await tx.query("UPDATE portal.requests SET data=$2::jsonb,updated_at=now() WHERE id=$1", [
          value.id,
          JSON.stringify(data),
        ]);
        await event(
          tx,
          value.id,
          user,
          "Orçamento editado",
          JSON.stringify({
            anterior: value.anterior,
            novo: { telefone: value.telefone, observacoes: value.observacoes },
          }),
        );
        return null;
      });
    },
    deactivateRequest: async (input, user) => {
      const value = parse(
        z.object({ id: uuid, motivo: z.string().trim().min(3).max(500) }).strict(),
        input,
      );
      return db.transaction(async (tx) => {
        await getAccessible(tx, value.id, user, true);
        await tx.query(
          `UPDATE portal.requests SET data=data || '{"inativo":true}'::jsonb,updated_at=now() WHERE id=$1`,
          [value.id],
        );
        await event(tx, value.id, user, "Orçamento inativado", value.motivo);
        return null;
      });
    },
    deleteRequest: async (input, user) => {
      allowed(user, ["Administrador"]);
      const value = parse(
        z.object({ id: uuid, motivo: z.string().trim().min(3).max(500) }).strict(),
        input,
      );
      return db.transaction(async (tx) => {
        // Logical deletion preserves audit records. Inactive requests may also be deleted.
        await getAccessible(tx, value.id, user);
        await tx.query("SELECT id FROM portal.requests WHERE id=$1 FOR UPDATE", [value.id]);
        if (
          (
            await tx.query("SELECT request_id FROM portal.tasy_exports WHERE request_id=$1", [
              value.id,
            ])
          ).rows.length
        )
          throw new ApiError(409, "EXPORT_FROZEN", "Envio Tasy iniciado; exclusão bloqueada.");
        const result = await tx.query(
          `UPDATE portal.requests SET data=data || '{"excluido":true,"inativo":true}'::jsonb,updated_at=now() WHERE id=$1 AND COALESCE(data->>'excluido','false') <> 'true' RETURNING id`,
          [value.id],
        );
        if (!result.rows.length) throw new ApiError(404, "NOT_FOUND", "Orçamento não encontrado.");
        await event(tx, value.id, user, "Orçamento excluído", value.motivo);
        return null;
      });
    },
    listRequests: async (input, user) => {
      const paging = parse(
        z
          .object({
            offset: z.number().int().min(0).default(0),
            limit: z.number().int().min(1).max(200).default(200),
          })
          .strict(),
        input,
      );
      const result = await db.query(
        `SELECT * FROM portal.requests
        WHERE ($1 <> 'Médico' OR created_by = $2 OR assigned_to = $2)
        AND COALESCE(data->>'inativo','false') <> 'true'
        AND COALESCE(data->>'excluido','false') <> 'true'
        ORDER BY created_at DESC, id LIMIT $3 OFFSET $4`,
        [user.perfil, user.id, paging.limit, paging.offset],
      );
      return result.rows.map(rowDto);
    },
    getRequest: async (input, user) =>
      rowDto(await getAccessible(db, parse(idInput, input).id, user)),
    createRequest: async (input, user) => {
      const value = parse(newRequest, input);
      if (
        (user.perfil === "Médico" && value.origem !== "medico") ||
        (user.perfil === "Comercial" && value.origem !== "comercial")
      ) {
        throw new ApiError(403, "FORBIDDEN", "Origem do orçamento incompatível com seu perfil.");
      }
      if (calculateQuote && !value.tasy)
        throw new ApiError(
          400,
          "TASY_SELECTION_REQUIRED",
          "Selecione paciente, convênio, categoria e procedimentos do Tasy.",
        );
      const referencia = calculateQuote ? await calculateQuote(value.tasy, user, value.cpf) : null;
      return db.transaction(async (tx) => {
        const seq = await tx.query("SELECT nextval('portal.request_numbers')::text AS value");
        const numero = `SOL-${new Date().getUTCFullYear()}-${seq.rows[0].value.padStart(6, "0")}`;
        const data = {
          paciente: {
            nome: value.nome,
            cpf: value.cpf,
            telefone: value.telefone,
            nascimento: fmtDate(value.nascimento),
            email: "",
          },
          solicitante: user.nome,
          medico: value.origem === "medico" ? user.nome : "—",
          crm: "",
          especialidade: value.especialidade || "",
          tipoConsulta: value.tipoConsulta || "",
          dataDesejada: fmtDate(value.dataDesejada),
          observacoes: value.observacoes || "",
          honorariosMedicos: null,
          diaria: null,
          cti: null,
          fisioterapia: null,
          tempoBloco: "",
          opme: "",
          anatomoPatologico: "",
          reservaSangue: "",
          equipeMultidisciplinar: "",
          obsMedico: "",
          valorHospitalar: null,
          obsComercial: "",
          dataAprovacao: referencia?.completo ? new Date().toISOString() : null,
          ...value.medico,
          ...(referencia
            ? {
                precificacao: { referencia, revisao: 1, ajustes: [] },
                honorariosMedicos: referencia.honorarios,
                valorHospitalar: referencia.hospitalar,
                diaria: null,
                cti: null,
              }
            : {}),
          ...(value.tasy ? { tasy: value.tasy } : {}),
        };
        const result = await tx.query(
          `INSERT INTO portal.requests(numero,created_by,assigned_to,status,data)
          VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING id`,
          [
            numero,
            user.id,
            value.origem === "medico" ? user.id : null,
            referencia
              ? referencia.completo
                ? "concluido"
                : "em_analise"
              : value.origem === "medico"
                ? "aguardando_comercial"
                : "aguardando_medico",
            JSON.stringify(data),
          ],
        );
        const id = result.rows[0].id;
        await event(tx, id, user, "Solicitação criada");
        if (value.medico) await event(tx, id, user, "Honorários preenchidos");
        return id;
      });
    },
    calculateRequest: async (input, user) => {
      const { id } = parse(idInput, input);
      const before = await getAccessible(db, id, user);
      if (before.data.precificacao?.referencia.completo)
        throw new ApiError(409, "ALREADY_PRICED", "A referência original já foi registrada.");
      if (!calculateQuote || !before.data.tasy)
        throw new ApiError(
          409,
          "TASY_SELECTION_REQUIRED",
          "Este orçamento não possui os itens necessários para calcular no Tasy.",
        );
      if (
        !before.data.precificacao &&
        [
          before.data.honorariosMedicos,
          before.data.valorHospitalar,
          before.data.diaria,
          before.data.cti,
        ].some((v) => v != null)
      )
        throw new ApiError(
          409,
          "EXISTING_VALUES",
          "Orçamento já possui valores informados; crie um novo orçamento para preservar o histórico.",
        );
      const referencia = await calculateQuote(before.data.tasy, user, before.data.paciente.cpf);
      return db.transaction(async (tx) => {
        const row = await getAccessible(tx, id, user, true);
        if (JSON.stringify(row.data) !== JSON.stringify(before.data))
          throw new ApiError(409, "RECORD_CHANGED", "Atualize o orçamento e tente novamente.");
        const data = {
          ...row.data,
          precificacao: {
            referencia,
            revisao: (row.data.precificacao?.revisao ?? 0) + 1,
            ajustes: [],
            confirmacoesZero: row.data.precificacao?.confirmacoesZero ?? [],
            referenciasAnteriores: [
              ...(row.data.precificacao?.referenciasAnteriores ?? []),
              ...(row.data.precificacao ? [row.data.precificacao.referencia] : []),
            ],
          },
          honorariosMedicos: referencia.honorarios,
          valorHospitalar: referencia.hospitalar,
          diaria: null,
          cti: null,
        };
        await tx.query(
          "UPDATE portal.requests SET data=$2::jsonb,status=$3,updated_at=now() WHERE id=$1",
          [id, JSON.stringify(data), referencia.completo ? "concluido" : "em_analise"],
        );
        await event(tx, id, user, "Referência Tasy calculada", JSON.stringify(referencia));
        return null;
      });
    },
    confirmZeroPrice: async (input, user) => {
      allowed(user, ["Administrador", "Médico", "Comercial"]);
      const v = parse(
        z
          .object({
            id: uuid,
            revisao: z.number().int().positive(),
            item: z
              .object({
                tipo: z.enum(["procedimento", "material"]),
                codigo: z.string().regex(/^\d{1,15}$/),
                origem: z
                  .string()
                  .regex(/^\d{1,15}$/)
                  .optional(),
              })
              .strict(),
            motivo: z.string().trim().min(5).max(1000),
          })
          .strict(),
        input,
      );
      return db.transaction(async (tx) => {
        const row = await getAccessible(tx, v.id, user, true);
        const pricing = row.data.precificacao;
        if (!pricing || pricing.revisao !== v.revisao)
          throw new ApiError(
            409,
            "RECORD_CHANGED",
            "Atualize o orçamento antes de confirmar o preço.",
          );
        const referencia = confirmZeroReference(pricing.referencia, v.item);
        const confirmation = {
          item: v.item,
          valor: 0,
          motivo: v.motivo,
          usuarioId: user.id,
          nomeUsuario: user.nome,
          nmUsuario: await auditIdentity(user, tx),
          dataHora: new Date().toISOString(),
          revisao: v.revisao,
        };
        const data = {
          ...row.data,
          honorariosMedicos: referencia.honorarios,
          valorHospitalar: referencia.hospitalar,
          precificacao: {
            ...pricing,
            referencia,
            revisao: pricing.revisao + 1,
            referenciasAnteriores: [...(pricing.referenciasAnteriores ?? []), pricing.referencia],
            confirmacoesZero: [...(pricing.confirmacoesZero ?? []), confirmation],
          },
        };
        await tx.query(
          "UPDATE portal.requests SET data=$2::jsonb,status=$3,updated_at=now() WHERE id=$1",
          [v.id, JSON.stringify(data), referencia.completo ? "concluido" : "em_analise"],
        );
        await event(tx, v.id, user, "Preço zero confirmado", JSON.stringify(confirmation));
        return null;
      });
    },
    adjustPrices: async (input, user) => {
      allowed(user, ["Administrador", "Médico", "Comercial"]);
      const v = parse(
        z
          .object({
            id: uuid,
            revisao: z.number().int().positive(),
            honorarios: money.refine((v) => v !== null),
            hospitalar: money.refine((v) => v !== null),
            motivo: z.string().trim().min(5).max(1000),
          })
          .strict(),
        input,
      );
      return db.transaction(async (tx) => {
        const row = await getAccessible(tx, v.id, user, true);
        const pricing = row.data.precificacao;
        if (!pricing?.referencia.completo)
          throw new ApiError(
            409,
            "INCOMPLETE_PRICE",
            "Resolva as referências sem preço antes de negociar o total.",
          );
        if (pricing.revisao !== v.revisao)
          throw new ApiError(
            409,
            "RECORD_CHANGED",
            "Valores alterados por outro usuário. Atualize a página.",
          );
        const round = (n) => Math.round(n * 100) / 100;
        const novo = { honorarios: round(v.honorarios), hospitalar: round(v.hospitalar) };
        const anterior = {
          honorarios: row.data.honorariosMedicos,
          hospitalar: row.data.valorHospitalar,
        };
        if (novo.honorarios === anterior.honorarios && novo.hospitalar === anterior.hospitalar)
          throw new ApiError(400, "UNCHANGED", "Informe uma alteração de valor.");
        const adjustment = {
          anterior,
          novo,
          motivo: v.motivo,
          usuarioId: user.id,
          nomeUsuario: user.nome,
          nmUsuario: await auditIdentity(user, tx),
          dataHora: new Date().toISOString(),
        };
        const data = {
          ...row.data,
          honorariosMedicos: novo.honorarios,
          valorHospitalar: novo.hospitalar,
          precificacao: {
            ...pricing,
            revisao: pricing.revisao + 1,
            ajustes: [...pricing.ajustes, adjustment],
          },
        };
        await tx.query("UPDATE portal.requests SET data=$2::jsonb,updated_at=now() WHERE id=$1", [
          v.id,
          JSON.stringify(data),
        ]);
        await event(tx, v.id, user, "Valores ajustados", JSON.stringify(adjustment));
        return null;
      });
    },
    saveDoctorFees: async (input, user) => {
      allowed(user, ["Administrador", "Médico"]);
      const value = parse(z.object({ id: uuid, input: fees }).strict(), input);
      await db.transaction(async (tx) => {
        const row = await getAccessible(tx, value.id, user, true);
        if (row.data.precificacao)
          throw new ApiError(
            409,
            "AUDIT_REQUIRED",
            "Use Ajustar valores com justificativa para este orçamento.",
          );
        if (row.status === "concluido")
          throw new ApiError(
            409,
            "INVALID_STATE",
            "Orçamento concluído não pode receber novos honorários.",
          );
        await tx.query(
          "UPDATE portal.requests SET data = data || $1::jsonb, status = 'aguardando_comercial', updated_at = now() WHERE id = $2",
          [JSON.stringify(value.input), value.id],
        );
        await event(tx, value.id, user, "Honorários preenchidos");
      });
      return null;
    },
    saveHospitalValue: async (input, user) => {
      allowed(user, ["Administrador", "Comercial"]);
      const value = parse(z.object({ id: uuid, valor: money, obs: text }).strict(), input);
      if (value.valor === null)
        throw new ApiError(400, "INVALID_INPUT", "Informe o valor hospitalar.");
      await db.transaction(async (tx) => {
        const row = await getAccessible(tx, value.id, user, true);
        if (row.data.precificacao)
          throw new ApiError(
            409,
            "AUDIT_REQUIRED",
            "Use Ajustar valores com justificativa para este orçamento.",
          );
        if (row.status !== "aguardando_comercial")
          throw new ApiError(
            409,
            "INVALID_STATE",
            "O orçamento deve aguardar o Comercial para ser concluído.",
          );
        await tx.query(
          "UPDATE portal.requests SET data = data || $1::jsonb, status = 'concluido', updated_at = now() WHERE id = $2",
          [
            JSON.stringify({
              valorHospitalar: value.valor,
              obsComercial: value.obs,
              dataAprovacao: new Date().toISOString(),
            }),
            value.id,
          ],
        );
        await event(tx, value.id, user, "Orçamento concluído");
      });
      return null;
    },
    assignDoctor: async (input, user) => {
      allowed(user, ["Administrador", "Comercial"]);
      const value = parse(z.object({ id: uuid, userId: uuid }).strict(), input);
      await db.transaction(async (tx) => {
        const row = await getAccessible(tx, value.id, user, true);
        if (row.status !== "aguardando_medico")
          throw new ApiError(
            409,
            "INVALID_STATE",
            "Só é possível atribuir orçamentos aguardando médico.",
          );
        const doctor = await tx.query(
          "SELECT id,nome FROM portal.users WHERE id=$1 AND perfil='Médico' AND ativo=true",
          [value.userId],
        );
        if (!doctor.rows.length)
          throw new ApiError(400, "INVALID_INPUT", "Usuário médico não encontrado.");
        await tx.query(
          "UPDATE portal.requests SET assigned_to=$1, data=data || $2::jsonb, updated_at=now() WHERE id=$3",
          [value.userId, JSON.stringify({ medico: doctor.rows[0].nome }), value.id],
        );
        await event(tx, value.id, user, "Solicitação enviada ao médico");
      });
      return null;
    },
    getTimeline: async (input, user) => {
      const { id } = parse(idInput, input);
      await getAccessible(db, id, user);
      const result = await db.query(
        "SELECT titulo,descricao,created_at FROM portal.events WHERE request_id=$1 ORDER BY created_at,id",
        [id],
      );
      return result.rows.map((row) => ({
        titulo: row.titulo,
        descricao: row.descricao,
        data: fmtTime(row.created_at),
        concluido: true,
      }));
    },
    listDoctors: async () =>
      (
        await db.query(
          "SELECT id,nome,crm,especialidade,ativo,0 AS solicitacoes FROM portal.doctors ORDER BY nome",
        )
      ).rows,
    createDoctor: async (input, user) => {
      allowed(user, ["Administrador"]);
      const value = parse(
        z
          .object({
            nome: z.string().trim().min(1).max(120),
            crm: z.string().trim().min(1).max(40),
            especialidade: z.string().trim().min(1).max(120),
          })
          .strict(),
        input,
      );
      await db.query("INSERT INTO portal.doctors(nome,crm,especialidade) VALUES ($1,$2,$3)", [
        value.nome,
        value.crm,
        value.especialidade,
      ]);
      return null;
    },
    listUsers: async (_input, user) => {
      allowed(user, ["Administrador"]);
      const result = await db.query(
        `SELECT u.id,u.nome,u.email,u.perfil,u.ativo,u.ultimo_acesso,l.nm_usuario AS "nmUsuario",
        (l.principal->>'tasyProfile')::int AS "cdPerfil",(l.principal->>'tasyEstablishment')::int AS "cdEstabelecimento",
        (l.principal->>'allPessoaFisica')::boolean AS "consultarTodosPacientes",(l.principal->>'canCreatePessoaFisica')::boolean AS "cadastrarPacientes"
        FROM portal.users u LEFT JOIN portal.tasy_user_links l ON l.user_id=u.id ORDER BY u.nome`,
      );
      return result.rows.map(({ ultimo_acesso, ...row }) => ({
        ...row,
        ultimoAcesso: fmtTime(ultimo_acesso),
      }));
    },
    createUser: async (input, user) => {
      allowed(user, ["Administrador"]);
      const value = parse(userSchema.extend(linkFields).strict(), input);
      if (!validateTasyLink)
        throw new ApiError(
          503,
          "TASY_DISABLED",
          "Configure a conexao Tasy para validar o cadastro.",
        );
      const {
        nmUsuario,
        cdPerfil,
        cdEstabelecimento,
        consultarTodosPacientes,
        cadastrarPacientes,
        ...account
      } = value;
      const link = await validateTasyLink({
        nmUsuario,
        cdPerfil,
        cdEstabelecimento,
        consultarTodosPacientes,
        cadastrarPacientes,
      });
      await db.transaction(async (tx) => {
        const created = await createUser(tx, account);
        await storeLink(tx, created.id, principalForLink({ ...value, ...link }), user.id);
      });
      return null;
    },
    saveUserTasyLink: async (input, user) => {
      allowed(user, ["Administrador"]);
      const value = parse(z.object({ id: uuid, ...linkFields }).strict(), input);
      if (!validateTasyLink)
        throw new ApiError(
          503,
          "TASY_DISABLED",
          "Configure a conexao Tasy para validar o cadastro.",
        );
      const link = await validateTasyLink(value);
      await db.transaction(async (tx) => {
        const target = await tx.query("SELECT id FROM portal.users WHERE id=$1 FOR UPDATE", [
          value.id,
        ]);
        if (!target.rows.length) throw new ApiError(404, "NOT_FOUND", "Usuario nao encontrado.");
        await storeLink(tx, value.id, principalForLink({ ...value, ...link }), user.id);
      });
      return null;
    },
    getSettings: async () =>
      (await db.query("SELECT data FROM portal.settings WHERE id=1")).rows[0].data,
    saveSettings: async (input, user) => {
      allowed(user, ["Administrador"]);
      await db.query("UPDATE portal.settings SET data=$1::jsonb WHERE id=1", [
        JSON.stringify(parse(settings, input)),
      ]);
      return null;
    },
  };
  return async (name, input, user) => {
    if (!Object.hasOwn(handlers, name))
      throw new ApiError(404, "NOT_FOUND", "Operação inexistente.");
    try {
      return await handlers[name](input, user);
    } catch (error) {
      if (error.code === "23505")
        throw new ApiError(409, "ALREADY_EXISTS", "Já existe um cadastro com esses dados.");
      throw error;
    }
  };
}
