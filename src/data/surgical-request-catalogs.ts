/**
 * Opções de referência da solicitação de procedimento cirúrgico.
 * As listas definitivas virão de catálogos do Tasy; ajuste aqui quando integradas.
 */

export const lateralidadeOptions = ["Direita", "Esquerda", "Bilateral", "Não se aplica"];

export const regimeInternacaoOptions = [
  "Ambulatorial",
  "Internação hospitalar",
  "Day clinic",
  "Home care",
];

export const tipoCirurgiaOptions = ["Eletiva", "Urgência", "Emergência"];

export const origemPacienteOptions = [
  "Pronto socorro",
  "Ambulatório",
  "Internação",
  "Domicílio",
  "Outro",
];

export const porteCirurgiaOptions = ["Pequeno", "Médio", "Grande", "Especial"];

export const anestesiaOptions = ["Geral", "Regional", "Local", "Sedação"];

export const anatomiaPatologicaOptions = ["Não", "Sim"];

export const equipamentosOptions = [
  "Bisturi Bipolar",
  "Bisturi Monopolar",
  "Microscópio",
  "RX Portátil",
  "Intensificador de Imagem",
  "Serra Elétrica",
  "Video Artroscópio",
  "Video Laparoscópio",
  "Furadeira",
  "Mesa de Madeira",
  "Mesa Radiotransparente",
  "Mesa Ginecológica",
  "Outros",
];

export const movimentoPacienteOptions = [
  "Não se aplica",
  "Deambulando",
  "Macas",
  "Cadeira de rodas",
];
