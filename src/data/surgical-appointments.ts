export type SurgicalAppointmentStatus = "solicitado" | "confirmado" | "cancelado";

export interface SurgicalAppointment {
  id: string;
  patientName: string;
  patientCpf: string;
  doctorUserId: string;
  doctorName: string;
  desiredDate: string;
  status: SurgicalAppointmentStatus;
  createdAt: string;
}

export interface NewSurgicalAppointmentInput {
  patientName: string;
  patientCpf: string;
  desiredDate: string;
}

export const surgicalAppointmentStatusLabels: Record<SurgicalAppointmentStatus, string> = {
  solicitado: "Solicitado",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
};