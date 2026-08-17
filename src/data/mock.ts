// Dados fictícios (mock) — camada isolada para facilitar a futura troca por API/PostgreSQL.

export type RequestStatus =
  | "pendente"
  | "em_analise"
  | "aguardando_medico"
  | "aguardando_comercial"
  | "concluido";

export interface Patient {
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  nascimento: string;
}

export interface ConsultationRequest {
  id: string;
  numero: string;
  paciente: Patient;
  medico: string;
  crm: string;
  especialidade: string;
  tipoConsulta: string;
  dataDesejada: string;
  data: string;
  status: RequestStatus;
  honorariosMedicos: number | null;
  obsMedico: string;
  valorHospitalar: number | null;
  obsComercial: string;
  observacoes: string;
}

export const statusLabels: Record<RequestStatus, string> = {
  pendente: "Pendente",
  em_analise: "Em análise",
  aguardando_medico: "Aguardando médico",
  aguardando_comercial: "Aguardando Comercial",
  concluido: "Concluído",
};

export const especialidades = [
  "Cardiologia",
  "Ortopedia",
  "Dermatologia",
  "Neurologia",
  "Endocrinologia",
  "Gastroenterologia",
];

export const requests: ConsultationRequest[] = [
  {
    id: "1",
    numero: "SOL-2026-0148",
    paciente: {
      nome: "Marina Albuquerque",
      cpf: "412.883.190-55",
      telefone: "(11) 98812-4471",
      email: "marina.albuquerque@exemplo.com",
      nascimento: "14/03/1988",
    },
    medico: "Dr. Ricardo Menezes",
    crm: "CRM-SP 118240",
    especialidade: "Cardiologia",
    tipoConsulta: "Primeira consulta",
    dataDesejada: "24/08/2026",
    data: "12/08/2026",
    status: "aguardando_medico",
    honorariosMedicos: null,
    obsMedico: "",
    valorHospitalar: null,
    obsComercial: "",
    observacoes: "Paciente com histórico de hipertensão. Prefere período da manhã.",
  },
  {
    id: "2",
    numero: "SOL-2026-0147",
    paciente: {
      nome: "Eduardo Tavares",
      cpf: "308.221.774-01",
      telefone: "(11) 99123-0087",
      email: "eduardo.tavares@exemplo.com",
      nascimento: "02/11/1975",
    },
    medico: "Dra. Helena Souza",
    crm: "CRM-SP 92310",
    especialidade: "Ortopedia",
    tipoConsulta: "Retorno",
    dataDesejada: "21/08/2026",
    data: "11/08/2026",
    status: "aguardando_comercial",
    honorariosMedicos: 850,
    obsMedico: "Inclui avaliação de exames de imagem prévios.",
    valorHospitalar: null,
    obsComercial: "",
    observacoes: "Encaminhado pelo pronto atendimento.",
  },
  {
    id: "3",
    numero: "SOL-2026-0146",
    paciente: {
      nome: "Cláudia Ribeiro",
      cpf: "225.667.331-92",
      telefone: "(11) 97744-2200",
      email: "claudia.ribeiro@exemplo.com",
      nascimento: "30/06/1992",
    },
    medico: "Dr. Paulo Nogueira",
    crm: "CRM-SP 145901",
    especialidade: "Dermatologia",
    tipoConsulta: "Primeira consulta",
    dataDesejada: "19/08/2026",
    data: "10/08/2026",
    status: "concluido",
    honorariosMedicos: 620,
    obsMedico: "Consulta padrão, sem procedimentos adicionais.",
    valorHospitalar: 340,
    obsComercial: "Taxa de sala ambulatorial incluída.",
    observacoes: "",
  },
  {
    id: "4",
    numero: "SOL-2026-0145",
    paciente: {
      nome: "Fernando Lacerda",
      cpf: "551.902.114-38",
      telefone: "(11) 96550-1188",
      email: "fernando.lacerda@exemplo.com",
      nascimento: "18/01/1965",
    },
    medico: "Dra. Beatriz Antunes",
    crm: "CRM-SP 100522",
    especialidade: "Neurologia",
    tipoConsulta: "Segunda opinião",
    dataDesejada: "27/08/2026",
    data: "10/08/2026",
    status: "em_analise",
    honorariosMedicos: null,
    obsMedico: "",
    valorHospitalar: null,
    obsComercial: "",
    observacoes: "Solicitação recebida via central de atendimento.",
  },
  {
    id: "5",
    numero: "SOL-2026-0144",
    paciente: {
      nome: "Juliana Prado",
      cpf: "774.310.556-20",
      telefone: "(11) 98221-7766",
      email: "juliana.prado@exemplo.com",
      nascimento: "07/09/1998",
    },
    medico: "Dr. Ricardo Menezes",
    crm: "CRM-SP 118240",
    especialidade: "Cardiologia",
    tipoConsulta: "Primeira consulta",
    dataDesejada: "18/08/2026",
    data: "09/08/2026",
    status: "pendente",
    honorariosMedicos: null,
    obsMedico: "",
    valorHospitalar: null,
    obsComercial: "",
    observacoes: "",
  },
  {
    id: "6",
    numero: "SOL-2026-0143",
    paciente: {
      nome: "Otávio Bernardes",
      cpf: "119.884.220-47",
      telefone: "(11) 95500-3311",
      email: "otavio.bernardes@exemplo.com",
      nascimento: "23/05/1981",
    },
    medico: "Dra. Helena Souza",
    crm: "CRM-SP 92310",
    especialidade: "Ortopedia",
    tipoConsulta: "Retorno",
    dataDesejada: "16/08/2026",
    data: "08/08/2026",
    status: "concluido",
    honorariosMedicos: 780,
    obsMedico: "Avaliação pós-operatória.",
    valorHospitalar: 410,
    obsComercial: "Sem materiais adicionais.",
    observacoes: "",
  },
  {
    id: "7",
    numero: "SOL-2026-0142",
    paciente: {
      nome: "Renata Vasques",
      cpf: "660.773.188-04",
      telefone: "(11) 94411-8899",
      email: "renata.vasques@exemplo.com",
      nascimento: "12/12/1970",
    },
    medico: "Dr. Paulo Nogueira",
    crm: "CRM-SP 145901",
    especialidade: "Endocrinologia",
    tipoConsulta: "Primeira consulta",
    dataDesejada: "29/08/2026",
    data: "07/08/2026",
    status: "aguardando_medico",
    honorariosMedicos: null,
    obsMedico: "",
    valorHospitalar: null,
    obsComercial: "",
    observacoes: "Paciente solicitou orçamento com urgência.",
  },
  {
    id: "8",
    numero: "SOL-2026-0141",
    paciente: {
      nome: "Sérgio Fontes",
      cpf: "903.221.667-13",
      telefone: "(11) 93322-6644",
      email: "sergio.fontes@exemplo.com",
      nascimento: "05/04/1959",
    },
    medico: "Dra. Beatriz Antunes",
    crm: "CRM-SP 100522",
    especialidade: "Gastroenterologia",
    tipoConsulta: "Primeira consulta",
    dataDesejada: "15/08/2026",
    data: "06/08/2026",
    status: "aguardando_medico",
    honorariosMedicos: null,
    obsMedico: "",
    valorHospitalar: null,
    obsComercial: "",
    observacoes: "",
  },
];

export interface Doctor {
  id: string;
  nome: string;
  crm: string;
  especialidade: string;
  ativo: boolean;
  solicitacoes: number;
}

export const doctors: Doctor[] = [
  { id: "1", nome: "Dr. Ricardo Menezes", crm: "CRM-SP 118240", especialidade: "Cardiologia", ativo: true, solicitacoes: 24 },
  { id: "2", nome: "Dra. Helena Souza", crm: "CRM-SP 92310", especialidade: "Ortopedia", ativo: true, solicitacoes: 18 },
  { id: "3", nome: "Dr. Paulo Nogueira", crm: "CRM-SP 145901", especialidade: "Dermatologia", ativo: true, solicitacoes: 12 },
  { id: "4", nome: "Dra. Beatriz Antunes", crm: "CRM-SP 100522", especialidade: "Neurologia", ativo: false, solicitacoes: 7 },
  { id: "5", nome: "Dr. André Camargo", crm: "CRM-SP 133870", especialidade: "Endocrinologia", ativo: true, solicitacoes: 9 },
];

export interface PortalUser {
  id: string;
  nome: string;
  email: string;
  perfil: "Administrador" | "Comercial" | "Médico";
  ativo: boolean;
  ultimoAcesso: string;
}

export const users: PortalUser[] = [
  { id: "1", nome: "Ana Carolina Lima", email: "ana.lima@hospital.exemplo", perfil: "Administrador", ativo: true, ultimoAcesso: "17/08/2026 09:42" },
  { id: "2", nome: "Marcos Dantas", email: "marcos.dantas@hospital.exemplo", perfil: "Comercial", ativo: true, ultimoAcesso: "17/08/2026 08:15" },
  { id: "3", nome: "Dr. Ricardo Menezes", email: "ricardo.menezes@hospital.exemplo", perfil: "Médico", ativo: true, ultimoAcesso: "16/08/2026 18:03" },
  { id: "4", nome: "Dra. Helena Souza", email: "helena.souza@hospital.exemplo", perfil: "Médico", ativo: true, ultimoAcesso: "15/08/2026 14:27" },
  { id: "5", nome: "Priscila Moraes", email: "priscila.moraes@hospital.exemplo", perfil: "Comercial", ativo: false, ultimoAcesso: "02/08/2026 11:10" },
];

export interface TimelineEvent {
  titulo: string;
  descricao: string;
  data: string;
  concluido: boolean;
}

export const timelineEvents: TimelineEvent[] = [
  { titulo: "Solicitação criada", descricao: "Registrada pela central de atendimento", data: "12/08/2026 09:12", concluido: true },
  { titulo: "Solicitação enviada ao médico", descricao: "Encaminhada para preenchimento de honorários", data: "12/08/2026 09:15", concluido: true },
  { titulo: "Honorários preenchidos", descricao: "Aguardando ação do médico responsável", data: "—", concluido: false },
  { titulo: "Enviada ao Comercial", descricao: "Etapa seguinte do fluxo", data: "—", concluido: false },
  { titulo: "Valor hospitalar preenchido", descricao: "Preenchimento pelo setor Comercial", data: "—", concluido: false },
  { titulo: "Orçamento concluído", descricao: "Orçamento final disponível ao paciente", data: "—", concluido: false },
];

export const currentUser = {
  nome: "Ana Carolina Lima",
  perfil: "Administrador",
  email: "ana.lima@hospital.exemplo",
};

export function formatCurrency(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const metrics = {
  pendentes: requests.filter((r) => r.status === "pendente").length,
  emAnalise: requests.filter((r) => r.status === "em_analise").length,
  aguardandoMedico: requests.filter((r) => r.status === "aguardando_medico").length,
  aguardandoComercial: requests.filter((r) => r.status === "aguardando_comercial").length,
  concluidos: requests.filter((r) => r.status === "concluido").length,
};

export function totalOf(r: ConsultationRequest): number | null {
  if (r.honorariosMedicos === null && r.valorHospitalar === null) return null;
  return (r.honorariosMedicos ?? 0) + (r.valorHospitalar ?? 0);
}
