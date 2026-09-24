import type { ProcedureSelectionItem } from "./procedure-catalog";

export type SurgicalAppointmentStatus = "solicitado" | "confirmado" | "cancelado";

/** Item de material com quantidade (OPME e reserva de fios cirúrgicos). */
export interface SurgicalMaterialItem {
  material: string;
  quantidade: number | null;
}

/** Detalhes completos da solicitação de procedimento cirúrgico. */
export interface SurgicalRequestDetails {
  diagnostico: string;
  alergias: string;
  cid: string;
  ctiResposta: "" | "sim" | "nao";
  motivoCti: string;
  procedimentoPrincipal: ProcedureSelectionItem[];
  procedimentosAdicionais: ProcedureSelectionItem[];
  lateralidade: string;
  regimeInternacao: string;
  tipo: string;
  origemPaciente: string;
  origemOutros: string;
  convenio: string;
  dataCirurgia: string; // datetime-local
  duracaoPrevistaMin: number | null;
  porte: string;
  anestesia: string;
  numAuxiliares: number | null;
  jeovaResposta: "" | "sim" | "nao";
  transfusaoResposta: "" | "sim" | "nao";
  anatomiaPatologica: string;
  anatomiaQuantidade: number | null;
  equipamentos: string[];
  equipamentosOutros: string;
  movimentoPaciente: string;
  opme: SurgicalMaterialItem[];
  fiosCirurgicos: SurgicalMaterialItem[];
}

export interface SurgicalAppointment {
  id: string;
  patientName: string;
  patientCpf: string;
  doctorUserId: string;
  doctorName: string;
  desiredDate: string;
  status: SurgicalAppointmentStatus;
  createdAt: string;
  dados: SurgicalRequestDetails | null;
}

export interface NewSurgicalAppointmentInput {
  patientName: string;
  patientCpf: string;
  desiredDate: string;
  dados?: SurgicalRequestDetails | null;
}

export const surgicalAppointmentStatusLabels: Record<SurgicalAppointmentStatus, string> = {
  solicitado: "Solicitado",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
};

export const emptySurgicalRequestDetails: SurgicalRequestDetails = {
  diagnostico: "",
  alergias: "",
  cid: "",
  ctiResposta: "",
  motivoCti: "",
  procedimentoPrincipal: [],
  procedimentosAdicionais: [],
  lateralidade: "",
  regimeInternacao: "",
  tipo: "",
  origemPaciente: "",
  origemOutros: "",
  convenio: "",
  dataCirurgia: "",
  duracaoPrevistaMin: null,
  porte: "",
  anestesia: "",
  numAuxiliares: null,
  jeovaResposta: "",
  transfusaoResposta: "",
  anatomiaPatologica: "",
  anatomiaQuantidade: null,
  equipamentos: [],
  equipamentosOutros: "",
  movimentoPaciente: "",
  opme: [],
  fiosCirurgicos: [],
};
