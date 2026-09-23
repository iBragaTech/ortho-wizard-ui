import { z } from "zod";
import { parse } from "./auth.mjs";
import { ApiError } from "../errors.mjs";
import { tasySelection } from "../orcamento-schema.mjs";

export const isCustos = (user) => ["Custos", "Administrador"].includes(user.perfil);
export function requireCustos(user) {
  if (!isCustos(user))
    throw new ApiError(403, "FORBIDDEN", "Operação exclusiva do setor de Custos.");
}
export function visibleRequest(row, user) {
  const data = structuredClone(row.data);
  if (!isCustos(user) && row.status !== "concluido") {
    delete data.precificacao;
    data.honorariosMedicos = null;
    data.valorHospitalar = null;
    data.diaria = null;
    data.cti = null;
  }
  return data;
}

export function custosOperations({ db, getAccessible, event, calculateQuote, auditIdentity }) {
  const revisionInput = z.object({ id: z.string().uuid(), revisao: z.number().int().positive() });
  const reason = z.string().trim().min(5).max(1000);
  const money = z.number().finite().min(0).max(9999999999.99);
  const editable = (row, revision) => {
    if (row.status === "concluido")
      throw new ApiError(409, "INVALID_STATE", "Orçamento aprovado não pode ser alterado.");
    if (row.data.precificacao?.revisao !== revision)
      throw new ApiError(409, "RECORD_CHANGED", "Atualize o orçamento antes de continuar.");
  };
  const audit = async (tx, user, motivo, anterior, novo) => ({
    motivo,
    anterior,
    novo,
    usuarioId: user.id,
    nomeUsuario: user.nome,
    nmUsuario: await auditIdentity(user, tx),
    dataHora: new Date().toISOString(),
  });
  return {
    approveRequest: async (input, user) => {
      requireCustos(user);
      const v = parse(revisionInput.strict(), input);
      return db.transaction(async (tx) => {
        const row = await getAccessible(tx, v.id, user, true);
        editable(row, v.revisao);
        if (
          !row.data.precificacao.referencia.completo ||
          !money.safeParse(row.data.honorariosMedicos).success ||
          !money.safeParse(row.data.valorHospitalar).success
        )
          throw new ApiError(
            409,
            "INCOMPLETE_PRICE",
            "Resolva os itens e valores pendentes antes de aprovar.",
          );
        const approval = await audit(tx, user, "Aprovação de Custos", null, {
          honorarios: row.data.honorariosMedicos,
          hospitalar: row.data.valorHospitalar,
          revisao: v.revisao,
        });
        const data = { ...row.data, aprovacaoCustos: approval, dataAprovacao: approval.dataHora };
        await tx.query(
          "UPDATE portal.requests SET data=$2::jsonb,status='concluido',updated_at=now() WHERE id=$1",
          [v.id, JSON.stringify(data)],
        );
        await event(tx, v.id, user, "Orçamento aprovado por Custos", JSON.stringify(approval));
        return null;
      });
    },
    updateRequestItems: async (input, user) => {
      requireCustos(user);
      const v = parse(
        revisionInput.extend({ tasy: tasySelection, motivo: reason }).strict(),
        input,
      );
      const before = await getAccessible(db, v.id, user);
      editable(before, v.revisao);
      if (v.tasy.cdPessoaFisica !== before.data.tasy?.cdPessoaFisica)
        throw new ApiError(
          400,
          "INVALID_INPUT",
          "O paciente do orçamento não pode ser substituído.",
        );
      if (!calculateQuote) throw new ApiError(503, "TASY_DISABLED", "Consulta Tasy indisponível.");
      const referencia = await calculateQuote(v.tasy, user, before.data.paciente.cpf);
      return db.transaction(async (tx) => {
        const row = await getAccessible(tx, v.id, user, true);
        editable(row, v.revisao);
        const change = await audit(
          tx,
          user,
          v.motivo,
          {
            tasy: row.data.tasy,
            precificacao: row.data.precificacao,
            honorarios: row.data.honorariosMedicos,
            hospitalar: row.data.valorHospitalar,
          },
          { tasy: v.tasy, referencia },
        );
        const main = referencia.itens.find((item) => item.tipo === "procedimento");
        const data = {
          ...row.data,
          tasy: v.tasy,
          especialidade: main
            ? `${main.codigo} (origem ${main.origem}) - ${main.referencia.nome ?? main.codigo}`
            : row.data.especialidade,
          honorariosMedicos:
            row.data.honorariosMedicos ?? row.data.honorariosSolicitados ?? referencia.honorarios,
          valorHospitalar: referencia.hospitalar,
          precificacao: {
            ...row.data.precificacao,
            referencia,
            revisao: v.revisao + 1,
            referenciasAnteriores: [
              ...(row.data.precificacao.referenciasAnteriores ?? []),
              row.data.precificacao.referencia,
            ],
          },
        };
        await tx.query(
          "UPDATE portal.requests SET data=$2::jsonb,status='em_analise',updated_at=now() WHERE id=$1",
          [v.id, JSON.stringify(data)],
        );
        await event(tx, v.id, user, "Itens revisados por Custos", JSON.stringify(change));
        return null;
      });
    },
    adjustItemPrice: async (input, user) => {
      requireCustos(user);
      const v = parse(
        revisionInput
          .extend({ indice: z.number().int().min(0), valor: money, motivo: reason })
          .strict(),
        input,
      );
      return db.transaction(async (tx) => {
        const row = await getAccessible(tx, v.id, user, true);
        editable(row, v.revisao);
        const pricing = row.data.precificacao;
        const item = pricing.referencia.itens[v.indice];
        if (!item) throw new ApiError(400, "INVALID_INPUT", "Item não encontrado.");
        const valor = Math.round(v.valor * 100) / 100;
        const fees = item.tipo === "material" ? 0 : item.referencia.honorarios;
        if (fees == null || fees > valor)
          throw new ApiError(
            400,
            "INVALID_INPUT",
            "Valor inferior aos honorários do item ou honorários não informados.",
          );
        const novo = {
          ...item,
          pendente: false,
          referencia: {
            ...item.referencia,
            [item.tipo === "material" ? "valorMaterial" : "valorProcedimento"]: valor,
          },
        };
        const itens = pricing.referencia.itens.map((entry, index) =>
          index === v.indice ? novo : entry,
        );
        let total = 0,
          honorarios = 0;
        for (const entry of itens) {
          if (entry.pendente) continue;
          total +=
            Math.round(
              (entry.referencia.valorMaterial ?? entry.referencia.valorProcedimento) * 100,
            ) * entry.quantidade;
          honorarios +=
            Math.round((entry.tipo === "material" ? 0 : entry.referencia.honorarios) * 100) *
            entry.quantidade;
        }
        const completo = itens.every((entry) => !entry.pendente);
        const referencia = {
          ...pricing.referencia,
          itens,
          completo,
          subtotalConfirmado: total / 100,
          total: completo ? total / 100 : null,
          honorarios: completo ? honorarios / 100 : null,
          hospitalar: completo ? (total - honorarios) / 100 : null,
        };
        const change = await audit(tx, user, v.motivo, item, novo);
        const data = {
          ...row.data,
          valorHospitalar: referencia.hospitalar,
          precificacao: {
            ...pricing,
            referencia,
            revisao: v.revisao + 1,
            referenciasAnteriores: [...(pricing.referenciasAnteriores ?? []), pricing.referencia],
          },
        };
        await tx.query("UPDATE portal.requests SET data=$2::jsonb,updated_at=now() WHERE id=$1", [
          v.id,
          JSON.stringify(data),
        ]);
        await event(tx, v.id, user, "Valor de item ajustado por Custos", JSON.stringify(change));
        return null;
      });
    },
  };
}
