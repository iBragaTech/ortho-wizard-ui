import type { TimelineEvent } from "@/data/mock";

type Fields = Record<string, unknown>;
const object = (value: unknown): Fields =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : {};
const text = (value: unknown) => (typeof value === "string" ? value : "");
const money = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "não informado";

export function presentTimelineEvent(event: TimelineEvent): TimelineEvent {
  const raw = event.descricao?.trim() || "";
  let data: Fields = {};
  const structured = raw.startsWith("{") || raw.startsWith("[");
  if (structured) {
    try {
      data = object(JSON.parse(raw));
    } catch {
      /* Old malformed audit entries stay private. */
    }
  }
  const actor = text(data["nomeUsuario"]) || text(data["nmUsuario"]);
  const by = actor ? `Responsável: ${actor}.` : "";
  const reason = text(data["motivo"]) ? `Justificativa: ${text(data["motivo"])}` : "";
  const lines = (...parts: string[]) => parts.filter(Boolean).join("\n");
  switch (event.titulo) {
    case "Referência Tasy calculada": {
      const items = Array.isArray(data["itens"]) ? data["itens"].map(object) : [];
      const pending = items.filter((item) => item["pendente"] === true).length;
      return {
        ...event,
        titulo: "Preços consultados no Tasy",
        descricao: lines(
          data["completo"] === true
            ? `Total calculado: ${money(data["total"])}.`
            : `Subtotal confirmado: ${money(data["subtotalConfirmado"])}.`,
          pending
            ? `${pending} ${pending === 1 ? "item aguarda confirmação de preço" : "itens aguardam confirmação de preço"}.`
            : data["completo"] === true
              ? "Todos os preços foram confirmados."
              : "Confira as pendências no cálculo do orçamento.",
          by,
        ),
      };
    }
    case "Preço zero confirmado": {
      const item = object(data["item"]);
      const label = item["tipo"] === "procedimento" ? "Procedimento" : "Material";
      return {
        ...event,
        titulo: "Item confirmado sem cobrança",
        descricao: lines(
          `${label}${text(item["codigo"]) ? ` ${text(item["codigo"])}` : ""}${text(item["origem"]) ? ` (origem ${text(item["origem"])})` : ""} confirmado por R$ 0,00 neste orçamento.`,
          by,
          reason,
        ),
      };
    }
    case "Valores ajustados": {
      const previous = object(data["anterior"]),
        next = object(data["novo"]);
      return {
        ...event,
        titulo: "Valores do orçamento alterados",
        descricao: lines(
          `Honorários: ${money(previous["honorarios"])} → ${money(next["honorarios"])}.`,
          `Hospitalar: ${money(previous["hospitalar"])} → ${money(next["hospitalar"])}.`,
          by,
          reason,
        ),
      };
    }
    case "Orçamento editado": {
      const previous = object(data["anterior"]),
        next = object(data["novo"]);
      const changes = [
        previous["telefone"] !== next["telefone"] ? "telefone do paciente" : "",
        previous["observacoes"] !== next["observacoes"] ? "observações" : "",
      ].filter(Boolean);
      return {
        ...event,
        descricao: changes.length
          ? `Atualização de ${changes.join(" e ")}.`
          : "Dados do orçamento atualizados.",
      };
    }
    case "Reconciliação de envio Tasy solicitada":
      return {
        ...event,
        titulo: "Verificação do envio ao Tasy",
        descricao: "Solicitada a verificação do envio anterior para evitar duplicidade.",
      };
    case "Envio Tasy sem confirmação":
      return {
        ...event,
        titulo: "Envio ao Tasy aguardando confirmação",
        descricao:
          "Ainda não foi possível confirmar o registro. Verifique o envio antes de tentar novamente.",
      };
    case "Orçamento aprovado por Custos":
    case "Itens revisados por Custos":
    case "Valor de item ajustado por Custos":
      return { ...event, descricao: lines(by, reason) };
    default:
      return {
        ...event,
        descricao: structured ? "Ação registrada no histórico do orçamento." : raw,
      };
  }
}
