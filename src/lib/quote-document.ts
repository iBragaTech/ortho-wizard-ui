import type { ConsultationRequest } from "@/data/mock";
import { formatCurrency, medicalFeesTotal } from "@/data/mock";
import type { InstitutionSettings } from "@/lib/data/repository";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function row(label: string, value: string | null | undefined): string {
  return `<tr><th>${esc(label)}</th><td>${esc(value && value.trim() ? value : "—")}</td></tr>`;
}

function money(value: number | null): string {
  return value === null ? "—" : formatCurrency(value);
}

/** Gera o HTML do orçamento do paciente (documento A4 pronto para impressão/PDF). */
export function buildQuoteHtml(
  request: ConsultationRequest,
  institution: InstitutionSettings,
): string {
  const honorarios = medicalFeesTotal(request);
  const hospitalar = request.valorHospitalar;
  const total =
    honorarios === null && hospitalar === null ? null : (honorarios ?? 0) + (hospitalar ?? 0);
  const emitido = new Date().toLocaleDateString("pt-BR");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Orçamento ${esc(request.numero)} — ${esc(request.paciente.nome)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1b2733; margin: 0; font-size: 12px; }
  header { border-bottom: 3px solid #1668b3; padding-bottom: 12px; margin-bottom: 20px; }
  .inst { font-size: 18px; font-weight: 700; color: #0f4c81; }
  .inst-meta { color: #5b6b7b; font-size: 11px; margin-top: 4px; line-height: 1.5; }
  h1 { font-size: 15px; margin: 0 0 2px; }
  .doc-meta { text-align: right; font-size: 11px; color: #5b6b7b; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: #0f4c81;
       margin: 22px 0 8px; border-bottom: 1px solid #dbe4ec; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eef2f6; vertical-align: top; }
  th { width: 38%; font-weight: 600; color: #5b6b7b; }
  .totals td, .totals th { border-bottom: 1px solid #dbe4ec; }
  .totals .grand th, .totals .grand td { border-bottom: none; font-size: 14px; font-weight: 700; color: #0f7b52; padding-top: 10px; }
  .totals td { text-align: right; }
  footer { margin-top: 28px; border-top: 1px solid #dbe4ec; padding-top: 10px;
           font-size: 10px; color: #7b8794; line-height: 1.6; }
  .sign { margin-top: 40px; display: flex; gap: 48px; }
  .sign div { flex: 1; border-top: 1px solid #9aa8b5; padding-top: 6px; text-align: center; font-size: 10px; color: #5b6b7b; }
  @media print { .noprint { display: none !important; } }
  .noprint { position: fixed; top: 10px; right: 10px; }
  .noprint button { background: #1668b3; color: #fff; border: 0; border-radius: 6px;
                    padding: 10px 16px; font-size: 13px; cursor: pointer; }
</style>
</head>
<body>
<div class="noprint"><button onclick="window.print()">Salvar / Imprimir PDF</button></div>
<header>
  <div class="top">
    <div>
      <div class="inst">${esc(institution.nome || "Instituição de Saúde")}</div>
      <div class="inst-meta">
        ${esc(institution.endereco || "")}<br />
        ${institution.cnpj ? "CNPJ: " + esc(institution.cnpj) + " · " : ""}${esc(institution.telefone || "")}
      </div>
    </div>
    <div class="doc-meta">
      <h1>Orçamento de consulta particular</h1>
      Nº ${esc(request.numero)}<br />
      Emitido em ${esc(emitido)}
    </div>
  </div>
</header>

<h2>Paciente</h2>
<table>
  ${row("Nome", request.paciente.nome)}
  ${row("CPF", request.paciente.cpf)}
  ${row("Telefone", request.paciente.telefone)}
  ${row("E-mail", request.paciente.email)}
</table>

<h2>Procedimento</h2>
<table>
  ${row("Especialidade", request.especialidade)}
  ${row("Médico responsável", `${request.medico} · ${request.crm}`)}
  ${row("Tipo de consulta", request.tipoConsulta)}
  ${row("Data desejada", request.dataDesejada)}
  ${row("Tempo de bloco", request.tempoBloco)}
  ${row("OPME", request.opme)}
  ${row("Anatomo patológico", request.anatomoPatologico)}
  ${row("Reserva de sangue", request.reservaSangue)}
  ${row("Equipe multidisciplinar", request.equipeMultidisciplinar)}
  ${row("Fisioterapia (quantidade)", request.fisioterapia === null ? "" : String(request.fisioterapia))}
</table>

<h2>Resumo financeiro</h2>
<table class="totals">
  <tr><th>Honorários médicos</th><td>${esc(money(honorarios))}</td></tr>
  <tr><th>Valores hospitalares</th><td>${esc(money(hospitalar))}</td></tr>
  <tr class="grand"><th>Total estimado</th><td>${esc(money(total))}</td></tr>
</table>

${
  request.obsComercial || request.observacoes
    ? `<h2>Observações</h2><p>${esc(request.obsComercial || request.observacoes)}</p>`
    : ""
}

<div class="sign">
  <div>Responsável pelo orçamento</div>
  <div>Ciente do paciente / responsável</div>
</div>

<footer>
  Este documento é um orçamento estimativo e não constitui cobrança. Valores válidos por 30 dias a partir da data de emissão
  e sujeitos a alteração conforme a evolução clínica e materiais efetivamente utilizados.
  Dúvidas: ${esc(institution.telefone || institution.emailNotificacoes || "entre em contato com a instituição")}.
</footer>
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
