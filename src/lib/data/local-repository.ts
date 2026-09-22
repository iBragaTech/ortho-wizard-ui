import type { ConsultationRequest, Doctor, PortalUser, TimelineEvent } from "@/data/mock";
import type { DoctorFeesInput, InstitutionSettings, NewRequestInput } from "./repository";
import { localAuth, portalCall } from "./local-api";

export const localRepository = {
  async listRequests(): Promise<ConsultationRequest[]> {
    const all: ConsultationRequest[] = [];
    for (let offset = 0; ; offset += 200) {
      const page = await portalCall<ConsultationRequest[]>("listRequests", { offset, limit: 200 });
      all.push(...page);
      if (page.length < 200) return all;
    }
  },
  getRequest: (id: string) => portalCall<ConsultationRequest | null>("getRequest", { id }),
  createRequest: (input: NewRequestInput) => portalCall<string>("createRequest", input),
  saveDoctorFees: (id: string, input: DoctorFeesInput) =>
    portalCall<void>("saveDoctorFees", { id, input }),
  saveHospitalValue: (id: string, valor: number | null, obs: string) =>
    portalCall<void>("saveHospitalValue", { id, valor, obs }),
  getTimeline: (id: string) => portalCall<TimelineEvent[]>("getTimeline", { id }),
  listDoctors: () => portalCall<Doctor[]>("listDoctors"),
  createDoctor: (input: { nome: string; crm: string; especialidade: string }) =>
    portalCall<void>("createDoctor", input),
  listUsers: () => portalCall<PortalUser[]>("listUsers"),
  createUser: (input: {
    nome: string;
    email: string;
    perfil: PortalUser["perfil"];
    senha: string;
  }) => portalCall<void>("createUser", input),
  getSettings: () => portalCall<InstitutionSettings>("getSettings"),
  saveSettings: (input: InstitutionSettings) => portalCall<void>("saveSettings", input),
  signIn: localAuth.signIn,
};
