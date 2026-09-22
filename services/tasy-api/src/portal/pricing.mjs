import { randomUUID } from "node:crypto";
import { quantity } from "../orcamento-schema.mjs";
import { ApiError } from "../errors.mjs";

const cents = (v) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 9999999999.99
    ? Math.round(v * 100)
    : null;

export function confirmZeroReference(reference, item) {
  const index = reference.itens.findIndex(
    (i) =>
      i.tipo === item.tipo &&
      i.codigo === item.codigo &&
      (i.origem ?? null) === (item.origem ?? null),
  );
  const selected = reference.itens[index];
  if (
    !selected?.pendente ||
    (selected.tipo === "material"
      ? selected.referencia.valorMaterial !== 0
      : selected.referencia.valorProcedimento !== 0 || selected.referencia.honorarios !== 0)
  ) {
    throw new ApiError(
      409,
      "ZERO_NOT_CONFIRMABLE",
      "Somente um preço zero retornado pelo Tasy pode ser confirmado. Valores ausentes ou inconsistentes precisam de nova consulta.",
    );
  }
  const itens = reference.itens.map((entry, n) =>
    n === index ? { ...entry, pendente: false, zeroConfirmado: true } : entry,
  );
  let total = 0,
    honorarios = 0;
  for (const entry of itens) {
    if (entry.pendente) continue;
    const value = cents(
      entry.tipo === "material"
        ? entry.referencia.valorMaterial
        : entry.referencia.valorProcedimento,
    );
    const fees = entry.tipo === "material" ? 0 : cents(entry.referencia.honorarios);
    if (
      value === null ||
      fees === null ||
      fees > value ||
      !quantity.safeParse(entry.quantidade).success
    )
      throw new ApiError(
        409,
        "INVALID_REFERENCE",
        "Referência inconsistente. Consulte os preços novamente.",
      );
    total += value * (entry.quantidade ?? 1);
    honorarios += fees * (entry.quantidade ?? 1);
  }
  const completo = itens.every((i) => !i.pendente);
  return {
    ...reference,
    itens,
    completo,
    subtotalConfirmado: total / 100,
    total: completo ? total / 100 : null,
    honorarios: completo ? honorarios / 100 : null,
    hospitalar: completo ? (total - honorarios) / 100 : null,
  };
}

export function createQuoteCalculator({ execute, principals }) {
  return async (selection, user, cpf) => {
    if (!execute)
      throw new ApiError(
        503,
        "TASY_DISABLED",
        "Habilite a conexão Tasy para calcular o orçamento.",
      );
    const mapping = Object.hasOwn(principals, user.id) ? principals[user.id] : null;
    if (!mapping?.enabled)
      throw new ApiError(403, "FORBIDDEN", "Usuário sem vínculo autorizado com o Tasy.");
    const principal = { ...mapping, subject: user.id };
    const requestId = randomUUID();
    const run = (name, body) => execute({ name, body, principal, requestId });
    const person = await run("pessoas-fisicas.consultar", {
      cdPessoaFisica: selection.cdPessoaFisica,
    });
    if (!person || (cpf && person.nrCpf?.replace(/\D/g, "") !== cpf.replace(/\D/g, "")))
      throw new ApiError(409, "PATIENT_CHANGED", "Paciente não encontrado.");
    const context = { cdConvenio: selection.cdConvenio, cdCategoria: selection.cdCategoria };
    const items = [];
    let total = 0,
      fees = 0;
    for (const p of selection.procedimentos) {
      const quantidade = quantity.parse(p.quantidade);
      const price = await run("precos.procedimento", {
        ...context,
        codigo: p.codigo,
        origem: p.origem,
      });
      const value = cents(price.valorProcedimento),
        honorarios = cents(price.honorarios);
      const pending = value === null || value === 0 || honorarios === null || honorarios > value;
      items.push({
        tipo: "procedimento",
        ...p,
        quantidade,
        referencia: price,
        pendente: pending,
      });
      if (!pending) {
        total += value * quantidade;
        fees += honorarios * quantidade;
      }
    }
    for (const m of selection.materiais) {
      const quantidade = quantity.parse(m.quantidade);
      const price = await run("precos.material", { ...context, codigo: m.codigo });
      const value = cents(price.valorMaterial);
      const pending = value === null || value === 0;
      items.push({ tipo: "material", ...m, quantidade, referencia: price, pendente: pending });
      if (!pending) total += value * quantidade;
    }
    const complete = items.every((i) => !i.pendente);
    return {
      calculadoEm: new Date().toISOString(),
      nmUsuario: principal.tasyUsername,
      estabelecimento: principal.tasyEstablishment,
      ...context,
      itens: items,
      completo: complete,
      subtotalConfirmado: total / 100,
      honorarios: complete ? fees / 100 : null,
      hospitalar: complete ? (total - fees) / 100 : null,
      total: complete ? total / 100 : null,
      contexto:
        "Valores calculados conforme a quantidade de cada item. Referência vigente hoje, sem médico, plano, acomodação ou atendimento específico. Hospitalar corresponde ao total dos procedimentos menos honorários, mais materiais/OPME. Diárias e outros serviços só entram quando selecionados como itens do catálogo.",
    };
  };
}
