import { readFile } from "node:fs/promises";
import PDFDocument from "pdfkit";

const logoUrl = new URL("../../../src/assets/logo-horizontal.png", import.meta.url);
const blue = "#004876",
  yellow = "#FFA400";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const money = (value) =>
  Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
function frame(title, content) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f3f6f8;font-family:Rubik,Arial,sans-serif;color:#263746"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" style="width:100%;max-width:600px;background:#fff;border:1px solid #dde5eb;border-radius:12px" cellspacing="0" cellpadding="0"><tr><td style="padding:28px 32px"><img src="cid:hospital-logo" width="260" style="max-width:100%;height:auto" alt="Hospital Evangélico de Belo Horizonte"></td></tr><tr><td style="height:5px;background:${yellow}"></td></tr><tr><td style="padding:28px 32px"><p style="margin:0 0 12px;color:${blue};font-size:12px;font-weight:bold;letter-spacing:1px">PORTAL DE ORÇAMENTOS</p><h1 style="margin:0 0 20px;color:${blue};font-size:24px;line-height:1.3">${esc(title)}</h1>${content}</td></tr><tr><td style="padding:20px 32px;background:${blue};color:white;font-size:12px;line-height:1.6">Hospital Evangélico de Belo Horizonte<br>Esta mensagem contém informações destinadas exclusivamente ao destinatário.</td></tr></table></td></tr></table></body></html>`;
}
const details = (entries) =>
  `<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px">${entries.map(([label, value]) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e5ebef;color:#5e6d78;vertical-align:top;width:35%">${esc(label)}</td><td style="padding:10px 0;border-bottom:1px solid #e5ebef;overflow-wrap:anywhere">${esc(value || "Não informado")}</td></tr>`).join("")}</table>`;

export async function buildBudgetPdf(snapshot, suppliedLogo) {
  const logo = suppliedLogo ?? (await readFile(logoUrl));
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 40, bottom: 45, left: 40, right: 40 },
    info: { Title: `Orçamento ${snapshot.numero}` },
  });
  const chunks = [];
  const done = new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const { data } = snapshot;
  doc.image(logo, 40, 30, { width: 240 });
  doc.y = 145;
  doc.rect(40, doc.y, 515, 4).fill(yellow);
  doc.moveDown();
  doc.fillColor(blue).font("Helvetica-Bold").fontSize(20).text(`Orçamento ${snapshot.numero}`);
  doc.font("Helvetica").fontSize(10).fillColor("#263746");
  doc
    .moveDown()
    .text(`Paciente: ${data.paciente.nome}`)
    .text(`Médico: ${data.medico}`)
    .text("Status: Em aprovação")
    .text(`Validade no Tasy: ${data.tasyRetorno.validUntil || "Não informada"}`);
  doc.moveDown();
  const items = data.tasyRetorno.itens.filter((i) => i.contabilizado);
  for (const i of items) {
    const description = `${i.codigo} — ${i.descricao || i.tipo}`;
    doc.font("Helvetica-Bold").fontSize(10);
    const descriptionHeight = doc.heightOfString(description, { width: 360 });
    const height = descriptionHeight + 35;
    if (doc.y + height > 770) doc.addPage();
    const top = doc.y;
    doc.font("Helvetica-Bold").text(description, 40, top, { width: 360 });
    doc.text(money(i.total), 420, top, { width: 135, align: "right" });
    doc
      .font("Helvetica")
      .fontSize(9)
      .text(
        `Quantidade: ${i.quantidade}${i.tipo === "procedimento" ? `  |  Médico (informativo): ${money(i.medico ?? 0)}` : ""}`,
        40,
        top + descriptionHeight + 6,
        { width: 515 },
      );
    doc.y = Math.max(doc.y, top + height);
    doc.fontSize(10);
  }
  const gross = items.reduce((sum, i) => sum + i.total, 0);
  const adjustment = Math.round((data.tasyRetorno.total - gross) * 100) / 100;
  if (doc.y > 680) doc.addPage();
  if (adjustment) doc.text(`Descontos e ajustes do Tasy: ${money(adjustment)}`);
  doc
    .moveDown()
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(blue)
    .text(`Total do orçamento: ${money(data.tasyRetorno.total)}`);
  doc
    .moveDown()
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#536575")
    .text(
      "Para orientações sobre pagamento, entre em contato com o hospital. Este documento não é um comprovante de pagamento.",
    );
  if (snapshot.institution?.telefone)
    doc.moveDown().text(`Contato do hospital: ${snapshot.institution.telefone}`);
  doc.end();
  return done;
}

export async function buildBudgetMail({ kind, snapshot, recipient, id, portalOrigin }) {
  const logo = await readFile(logoUrl);
  const { data, numero } = snapshot;
  const internal = kind === "new_request";
  if (internal && !/^\d+$/.test(String(snapshot.tasyId ?? "")))
    throw new Error("Número do orçamento Tasy ainda não confirmado.");
  const displayNumber = internal ? snapshot.tasyId : numero;
  const entries = internal
    ? [
        ["Orçamento", displayNumber],
        ["Paciente", data.paciente.nome],
        ["CPF", data.paciente.cpf],
        ["Nascimento", data.paciente.nascimento],
        ["Telefone", data.paciente.telefone],
        ["E-mail", data.paciente.email],
        ["Médico", data.medico],
        ["Especialidade", data.especialidade],
      ]
    : [
        ["Orçamento", numero],
        ["Paciente", data.paciente.nome],
        ["Situação", "Em aprovação"],
        ["Valor do orçamento", money(data.tasyRetorno.total)],
      ];
  const title = internal ? "Novo orçamento pendente" : "Seu orçamento está disponível";
  const intro = internal
    ? "Uma nova solicitação foi criada pelo portal e aguarda avaliação de Custos no Tasy."
    : "Olá! Encaminhamos seu orçamento em anexo para avaliação. Para orientações sobre pagamento, entre em contato com o hospital.";
  const link = internal ? `${portalOrigin}/orcamentos/${encodeURIComponent(snapshot.id)}` : null;
  const html = frame(
    title,
    `<p style="line-height:1.7;font-size:15px">${intro}</p>${details(entries)}${link ? `<p style="margin:26px 0 8px"><a href="${esc(link)}" style="display:inline-block;background:${blue};color:white;padding:13px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Consultar orçamento no portal</a></p><p style="font-size:12px;color:#5e6d78">Acesso restrito à equipe autorizada.</p>` : `<p style="font-size:13px;color:#5e6d78;margin-top:24px">O PDF anexo apresenta os itens e os valores do orçamento. O pagamento ainda depende da confirmação da Tesouraria.</p>`}`,
  );
  const attachments = [
    {
      filename: "hospital-evangelico.png",
      content: logo,
      cid: "hospital-logo",
      contentType: "image/png",
    },
  ];
  if (!internal)
    attachments.push({
      filename: `Orcamento-${String(numero).replace(/[^a-zA-Z0-9-]/g, "")}.pdf`,
      content: await buildBudgetPdf(snapshot, logo),
      contentType: "application/pdf",
    });
  return {
    to: recipient,
    subject: `${title} • ${numero}`,
    messageId: `<portal-${id}@aebmg.org.br>`,
    html,
    text: `${title}\n\n${intro}\n\n${entries.map(([k, v]) => `${k}: ${v || "Não informado"}`).join("\n")}${link ? `\n\nConsultar: ${link}` : "\n\nOrçamento em PDF anexo."}`,
    attachments,
  };
}
