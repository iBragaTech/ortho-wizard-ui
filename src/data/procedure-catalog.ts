// Catálogo de procedimentos.
//
// Provisório: dados fictícios em memória. Estes itens virão de uma tabela de
// outro banco (catálogo corporativo/TUSS). Quando a integração existir, basta
// trocar `listProcedures()` por uma consulta/API — a interface não muda.

export interface ProcedureItem {
  codigo: string;
  descricao: string;
  porte?: string;
}

export const procedureCatalog: ProcedureItem[] = [
  { codigo: "3.07.12.05-8", descricao: "Artroplastia total de quadril não cimentada", porte: "10C" },
  { codigo: "3.07.12.06-6", descricao: "Artroplastia total de joelho", porte: "10B" },
  { codigo: "3.07.14.02-1", descricao: "Artroscopia de joelho — meniscectomia", porte: "7C" },
  { codigo: "3.07.14.05-6", descricao: "Reconstrução de ligamento cruzado anterior", porte: "9A" },
  { codigo: "3.07.20.11-0", descricao: "Osteossíntese de fratura de fêmur", porte: "9B" },
  { codigo: "3.07.20.15-2", descricao: "Osteossíntese de fratura de tíbia", porte: "8C" },
  { codigo: "3.07.26.03-8", descricao: "Descompressão de túnel do carpo", porte: "6B" },
  { codigo: "3.09.05.02-9", descricao: "Artrodese de coluna lombar", porte: "11A" },
  { codigo: "3.09.05.08-8", descricao: "Discectomia lombar", porte: "9C" },
  { codigo: "3.01.01.01-2", descricao: "Herniorrafia inguinal unilateral", porte: "6C" },
  { codigo: "3.01.01.10-1", descricao: "Colecistectomia videolaparoscópica", porte: "7B" },
  { codigo: "3.01.02.05-1", descricao: "Apendicectomia", porte: "6C" },
  { codigo: "3.03.06.02-3", descricao: "Angioplastia coronária com stent", porte: "10A" },
  { codigo: "3.03.06.10-4", descricao: "Implante de marca-passo definitivo", porte: "9B" },
  { codigo: "3.10.01.012-3", descricao: "Consulta cirúrgica pré-operatória", porte: "2A" },
  { codigo: "3.11.02.04-7", descricao: "Videolaparoscopia diagnóstica", porte: "6A" },
  { codigo: "3.12.01.03-5", descricao: "Histerectomia total abdominal", porte: "9A" },
  { codigo: "3.13.04.07-2", descricao: "Ressecção transuretral de próstata", porte: "8B" },
  { codigo: "3.14.02.09-1", descricao: "Septoplastia funcional", porte: "7A" },
  { codigo: "3.15.03.06-4", descricao: "Facectomia com implante de lente intraocular", porte: "7C" },
];

export function listProcedures(): ProcedureItem[] {
  return procedureCatalog;
}

export function formatProcedure(code: string): string {
  const item = listProcedures().find((p) => p.codigo === code);
  return item ? `${item.codigo} - ${item.descricao}` : code;
}

export function formatProcedureSelection(codes: string[]): string {
  return codes.map(formatProcedure).join("; ");
}
