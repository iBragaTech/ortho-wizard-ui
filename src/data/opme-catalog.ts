// Catálogo de OPME.
//
// Provisório: dados fictícios em memória. Estes itens virão de uma tabela de
// outro banco (catálogo corporativo). Quando a integração existir, basta
// trocar `listOpmeItems()` por uma consulta/API — a interface não muda.

export interface OpmeItem {
  codigo: string;
  descricao: string;
  fornecedor: string;
}

export const opmeCatalog: OpmeItem[] = [
  { codigo: "OPM-0001", descricao: "Placa bloqueada de titânio 3.5mm", fornecedor: "Ortomed Brasil" },
  { codigo: "OPM-0002", descricao: "Parafuso cortical 3.5mm x 30mm", fornecedor: "Ortomed Brasil" },
  { codigo: "OPM-0003", descricao: "Parafuso esponjoso 4.0mm x 40mm", fornecedor: "Ortomed Brasil" },
  { codigo: "OPM-0004", descricao: "Haste intramedular femoral bloqueada", fornecedor: "BioImplant" },
  { codigo: "OPM-0005", descricao: "Prótese total de quadril não cimentada", fornecedor: "BioImplant" },
  { codigo: "OPM-0006", descricao: "Prótese total de joelho cimentada", fornecedor: "BioImplant" },
  { codigo: "OPM-0007", descricao: "Cimento ósseo com antibiótico 40g", fornecedor: "MedSupply" },
  { codigo: "OPM-0008", descricao: "Fio de Kirschner 2.0mm", fornecedor: "MedSupply" },
  { codigo: "OPM-0009", descricao: "Âncora de sutura 5.0mm bioabsorvível", fornecedor: "ArtroTech" },
  { codigo: "OPM-0010", descricao: "Parafuso de interferência 8mm", fornecedor: "ArtroTech" },
  { codigo: "OPM-0011", descricao: "Kit de shaver artroscópico descartável", fornecedor: "ArtroTech" },
  { codigo: "OPM-0012", descricao: "Tela de polipropileno 15x15cm", fornecedor: "CirurgMed" },
  { codigo: "OPM-0013", descricao: "Grampeador linear cortante 60mm", fornecedor: "CirurgMed" },
  { codigo: "OPM-0014", descricao: "Carga para grampeador linear 60mm", fornecedor: "CirurgMed" },
  { codigo: "OPM-0015", descricao: "Trocarte descartável 12mm", fornecedor: "CirurgMed" },
  { codigo: "OPM-0016", descricao: "Clipe de titânio médio-grande (cartucho)", fornecedor: "CirurgMed" },
  { codigo: "OPM-0017", descricao: "Cateter balão de angioplastia 3.0x20mm", fornecedor: "CardioLine" },
  { codigo: "OPM-0018", descricao: "Stent coronário farmacológico 3.0x18mm", fornecedor: "CardioLine" },
  { codigo: "OPM-0019", descricao: "Introdutor arterial 6F", fornecedor: "CardioLine" },
  { codigo: "OPM-0020", descricao: "Marca-passo definitivo dupla câmara", fornecedor: "CardioLine" },
  { codigo: "OPM-0021", descricao: "Cage intersomático lombar PEEK", fornecedor: "NeuroSpine" },
  { codigo: "OPM-0022", descricao: "Parafuso pedicular poliaxial 6.5mm", fornecedor: "NeuroSpine" },
  { codigo: "OPM-0023", descricao: "Haste de titânio 5.5mm x 120mm", fornecedor: "NeuroSpine" },
  { codigo: "OPM-0024", descricao: "Substituto ósseo sintético 10cc", fornecedor: "BioImplant" },
  { codigo: "OPM-0025", descricao: "Dreno de sucção portovac 3.2mm", fornecedor: "MedSupply" },
];

export function listOpmeItems(): OpmeItem[] {
  return opmeCatalog;
}
