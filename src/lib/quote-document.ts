import type { ConsultationRequest } from "@/data/mock";
import { formatCurrency, medicalFeesTotal } from "@/data/mock";
import type { InstitutionSettings } from "@/lib/data/repository";
import logoHorizontal from "@/assets/logo-horizontal.png";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function num(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function field(label: string, value: string | null | undefined): string {
  return `<tr><th>${esc(label)}</th><td>${esc(value && value.trim() ? value : "")}</td></tr>`;
}

function absoluteAsset(path: string): string {
  try {
    return new URL(path, window.location.origin).href;
  } catch {
    return path;
  }
}

interface LineItem {
  codigo: string;
  descricao: string;
  qtde: number;
  medico: number;
  anestesista: number;
  hospital: number;
  desconto: number;
}

/** Monta as linhas do quadro de procedimentos a partir dos dados da solicitação. */
function buildItems(request: ConsultationRequest): LineItem[] {
  const items: LineItem[] = [];
  const honorario = request.honorariosMedicos;
  const hospitalar = request.valorHospitalar;

  items.push({
    codigo: "—",
    descricao: `${request.especialidade} — ${request.tipoConsulta}`,
    qtde: 1,
    medico: honorario ?? 0,
    anestesista: 0,
    hospital: hospitalar ?? 0,
    desconto: 0,
  });

  if (request.diaria !== null) {
    items.push({
      codigo: "—",
      descricao: "Diária Enfermaria / Apartamento",
      qtde: 1,
      medico: request.diaria,
      anestesista: 0,
      hospital: 0,
      desconto: 0,
    });
  }
  if (request.cti !== null) {
    items.push({
      codigo: "—",
      descricao: "Diária CTI",
      qtde: 1,
      medico: request.cti,
      anestesista: 0,
      hospital: 0,
      desconto: 0,
    });
  }
  if (request.fisioterapia !== null && request.fisioterapia > 0) {
    items.push({
      codigo: "—",
      descricao: "Fisioterapia",
      qtde: request.fisioterapia,
      medico: 0,
      anestesista: 0,
      hospital: 0,
      desconto: 0,
    });
  }
  return items;
}

/** Gera o HTML do orçamento no padrão institucional do hospital (A4, pronto para PDF). */
export function buildQuoteHtml(
  request: ConsultationRequest,
  institution: InstitutionSettings,
): string {
  const agora = new Date();
  const validade = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour12: false })}`;

  const items = buildItems(request);
  const somaMedico = items.reduce((a, i) => a + i.medico, 0);
  const somaAnest = items.reduce((a, i) => a + i.anestesista, 0);
  const somaHosp = items.reduce((a, i) => a + i.hospital, 0);
  const somaDesc = items.reduce((a, i) => a + i.desconto, 0);
  const totalProc = somaMedico + somaAnest + somaHosp - somaDesc;
  const totalGeral = totalProc;
  const honorarios = medicalFeesTotal(request);

  const linhas = items
    .map(
      (i) => `<tr>
    <td class="c">${esc(i.codigo)}</td>
    <td>${esc(i.descricao)}</td>
    <td class="c">${i.qtde}</td>
    <td class="r">${num(i.medico)}</td>
    <td class="r">${num(i.anestesista)}</td>
    <td class="r">${num(i.hospital)}</td>
    <td class="r">${num(i.desconto)}</td>
    <td class="r">${num(i.medico + i.anestesista + i.hospital - i.desconto)}</td>
  </tr>`,
    )
    .join("\n");

  const observacoes = [request.obsMedico, request.obsComercial, request.observacoes]
    .filter((t) => t && t.trim())
    .join(" | ");

  const detalhes = [
    ["OPME", request.opme],
    ["Anatomo patológico", request.anatomoPatologico],
    ["Reserva de sangue", request.reservaSangue],
    ["Equipe multidisciplinar", request.equipeMultidisciplinar],
    ["Tempo de bloco", request.tempoBloco],
    ["Observações", observacoes],
  ].filter(([, v]) => v && String(v).trim());

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Orçamento ${esc(request.numero)} — ${esc(request.paciente.nome)}</title>
<style>
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 10.5px;
         margin: 0 auto; padding: 0; background: #fff; max-width: 210mm; }
  @media screen { html { background: #e9edf1; } body { margin: 16px auto; padding: 10mm; background:#fff; box-shadow: 0 2px 14px rgba(0,0,0,.15); } }
  .sheet { border: 1px solid #000; }
  header { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-bottom: 1px solid #000; }
  header img { height: 46px; }
  .title { flex: 1; text-align: center; }
  .title .h1 { font-size: 17px; text-transform: uppercase; line-height: 1.15; }
  .title .h2 { font-size: 13px; font-weight: bold; margin-top: 4px; }
  .doc-num { font-size: 13px; font-weight: bold; letter-spacing: .08em; text-align: right; }
  .meta { display: flex; border-bottom: 1px solid #000; }
  .meta table { width: 50%; border-collapse: collapse; }
  .meta th, .meta td { border-bottom: 1px solid #cfcfcf; padding: 4px 8px; font-size: 10.5px; text-align: left; vertical-align: middle; }
  .meta th { background: #d9d9d9; font-weight: normal; width: 40%; white-space: nowrap; }
  .items { width: 100%; border-collapse: collapse; }
  .items thead th { background: #d9d9d9; font-weight: normal; padding: 4px 6px; border-bottom: 1px solid #9a9a9a; font-size: 10.5px; }
  .items td { padding: 4px 6px; border-bottom: 1px solid #e4e4e4; }
  .items tbody tr:nth-child(even) { background: #f2f2f2; }
  .items .r { text-align: right; }
  .items .c { text-align: center; }
  .items tfoot td { padding: 4px 6px; font-weight: bold; }
  .items tfoot .lbl { text-align: right; }
  .notes { border-top: 1px solid #000; padding: 8px 12px 16px; line-height: 1.45; }
  .notes h3 { font-size: 11px; margin: 0 0 8px; }
  .notes p { margin: 0 0 8px; }
  .detalhes { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  .detalhes th { text-align: left; width: 26%; font-weight: bold; padding: 2px 0; vertical-align: top; }
  .detalhes td { padding: 2px 0; }
  .sign { margin: 60px 0 20px; display: flex; justify-content: flex-end; }
  .sign div { width: 46%; border-top: 1px solid #000; text-align: center; padding-top: 4px; }
  footer { display: flex; justify-content: space-between; border-top: 1px solid #000; padding: 4px 12px; font-size: 10px; }
  @media print { .noprint { display: none !important; } body { margin: 0; padding: 0; box-shadow: none; } }
  .noprint { position: fixed; top: 10px; right: 10px; }
  .noprint button { background: #0d4a78; color: #fff; border: 0; border-radius: 6px;
                    padding: 10px 16px; font-size: 13px; cursor: pointer; }
</style>
</head>
<body>
<div class="noprint"><button onclick="window.print()">Salvar / Imprimir PDF</button></div>
<div class="sheet">
<header>
  <img src="${esc(absoluteAsset(logoHorizontal))}" alt="${esc(institution.nome || "Hospital")}" />
  <div class="title">
    <div class="h1">${esc(institution.nome || "Hospital Evangélico de Belo Horizonte")}</div>
    <div class="h2">Orçamento para Atendimento</div>
  </div>
  <div class="doc-num">${esc(request.numero)}</div>
</header>

<div class="meta">
  <table>
    ${field("Paciente", request.paciente.nome)}
    ${field("Atendimento", request.numero)}
    ${field("Data Orçamento", fmt(agora))}
    ${field("Data Validade", fmt(validade))}
    ${field("Data Aprovação", "")}
    ${field("Telefone/Cel", request.paciente.telefone)}
  </table>
  <table>
    ${field("Convênio", request.especialidade)}
    ${field("Cond. Pagamento", "Conforme Vencimentos")}
    ${field("Solicitante", request.medico)}
    ${field("Nome do médico", `${request.medico} · ${request.crm}`)}
    ${field("Categoria", request.tipoConsulta)}
    ${field("Status Orçamento", request.status === "concluido" ? "Aprovado" : "Em aprovação")}
  </table>
</div>

<table class="items">
  <thead>
    <tr>
      <th>Código</th><th style="text-align:left">Procedimento</th><th>Qtde</th>
      <th>Médico</th><th>Anestesista</th><th>Hospital</th><th>Descontos</th><th>Total</th>
    </tr>
  </thead>
  <tbody>
${linhas}
  </tbody>
  <tfoot>
    <tr>
      <td></td><td class="lbl">Total Procedimento</td><td></td>
      <td class="r">${num(somaMedico)}</td><td class="r">${num(somaAnest)}</td>
      <td class="r">${num(somaHosp)}</td><td class="r">${num(somaDesc)}</td><td class="r">${num(totalProc)}</td>
    </tr>
    <tr><td></td><td class="lbl">Total Material</td><td colspan="6"></td></tr>
    <tr>
      <td></td><td class="lbl">Total Geral</td><td colspan="4"></td>
      <td class="r">${num(somaDesc)}</td><td class="r">${num(totalGeral)}</td>
    </tr>
  </tfoot>
</table>

<div class="notes">
  ${
    detalhes.length
      ? `<h3>DADOS DO PROCEDIMENTO:</h3><table class="detalhes">${detalhes
          .map(([k, v]) => `<tr><th>${esc(String(k))}</th><td>${esc(String(v))}</td></tr>`)
          .join("")}</table>`
      : ""
  }
  <h3>SERVIÇO HOSPITALAR:</h3>
  <p>1. O valor informado é uma estimativa e pode sofrer alterações após avaliação clínica do paciente,
  já que a proposta inicial foi elaborada sem esta análise. O médico poderá alterar procedimentos e materiais
  conforme a necessidade. Despesas não incluídas serão cobradas ao final do tratamento dependendo da utilização
  de materiais (OPMEs), procedimentos e diárias.</p>
  <p>2. ALTA HOSPITALAR: Se ocorrer em dia não útil ou após horário comercial, o faturamento será realizado
  no primeiro dia útil subsequente.</p>
  <p>3. RESERVA DE CTI: Caso haja reserva e não seja utilizada, será cobrada taxa de R$ 300,00.</p>
  <p>4. DADOS PARA PAGAMENTO:<br />
  Depósito Bancário Antecipado - (Banco Caixa Econômica Federal: agência 2922, Conta 61-5, Operação: 003) /<br />
  PIX - CNPJ: ${esc(institution.cnpj || "17.214.743/0001-67")} (Associação Evangélica Beneficente de Minas Gerais)<br />
  Enviar comprovantes para os e-mails: ${esc(institution.emailNotificacoes || "internacao@he.org.br")}</p>
  <p>5. FORMAS DE PAGAMENTO / PARCELAMENTO:<br />
  • Até R$ 600,00 - Crédito 2x sem juros;<br />
  • Até R$ 1.000,00 - Crédito 3x sem juros.</p>
  <p>Honorários médicos informados: ${esc(honorarios === null ? "—" : formatCurrency(honorarios))} ·
  Valores hospitalares: ${esc(request.valorHospitalar === null ? "—" : formatCurrency(request.valorHospitalar))}</p>
  <div class="sign"><div>Paciente</div></div>
</div>

<footer>
  <span>Impresso em: ${esc(fmt(agora))}</span>
  <span>Página: 1/1</span>
  <span>${esc(institution.telefone || "")}</span>
</footer>
</div>
</body>
</html>`;
}

/** Abre o orçamento em nova aba, pronto para imprimir ou salvar em PDF. */
export function openQuoteDocument(
  request: ConsultationRequest,
  institution: InstitutionSettings,
): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.write(buildQuoteHtml(request, institution));
  win.document.close();
  return true;
}

/** Baixa o orçamento como arquivo .html (pode ser anexado em e-mail para o paciente). */
export function downloadQuoteFile(
  request: ConsultationRequest,
  institution: InstitutionSettings,
): void {
  const blob = new Blob([buildQuoteHtml(request, institution)], {
    type: "text/html;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orcamento-${request.numero}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
