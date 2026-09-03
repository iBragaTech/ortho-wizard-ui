// Catálogo demonstrativo de categorias de convênio.
//
// Hoje: lista fixa em memória, apenas para compor a interface.
// Futuro: os dados virão da tabela de convênios/categorias do banco
// PostgreSQL corporativo do hospital. Ao integrar, basta trocar este
// arquivo por uma consulta ao banco (ver docs/integracao-postgres.md),
// sem alterar os componentes que consomem a lista.

export interface ConvenioCategoria {
  codigo: string;
  nome: string;
}

export const CONVENIO_CATEGORIAS: ConvenioCategoria[] = [
  { codigo: "PART", nome: "Particular" },
  { codigo: "PART-DESC", nome: "Particular — Pacote promocional" },
  { codigo: "CONV-ENF", nome: "Convênio — Enfermaria" },
  { codigo: "CONV-APT", nome: "Convênio — Apartamento" },
  { codigo: "CONV-EXEC", nome: "Convênio — Executivo" },
  { codigo: "EMP", nome: "Empresarial" },
];
