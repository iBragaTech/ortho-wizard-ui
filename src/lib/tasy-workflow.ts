import type { ConsultationRequest } from "@/data/mock";

export function canPrintQuote(request: ConsultationRequest): boolean {
  if (!request.tasyGerenciado)
    return (
      request.status === "concluido" &&
      (!request.precificacao || request.precificacao.referencia.completo)
    );
  return (
    ["em_aprovacao", "aguardando_pagamento", "concluido"].includes(request.status) &&
    !!request.tasyRetorno?.completo &&
    !request.tasyRetorno.erro &&
    Date.now() - new Date(request.tasyRetorno.consultadoEm).getTime() < 120000
  );
}

export function quoteStatusLabel(request: ConsultationRequest): string | undefined {
  if (!request.tasyGerenciado) return undefined;
  if (request.status === "concluido") return "Aprovado";
  if (request.status === "aguardando_pagamento") return "Aprovado no Tasy · aguardando comprovante";
  return request.tasyRetorno?.statusLabel || "Aguardando cotação";
}
