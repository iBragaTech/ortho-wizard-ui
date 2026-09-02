// Camada única de acesso a dados do portal.
//
// Hoje: devolve os dados fictícios de `src/data/mock.ts`.
// Amanhã: cada função aqui vira uma chamada HTTP à API interna do hospital
// (ver docs/integracao-postgres.md) ou uma query ao PostgreSQL, sem que
// nenhuma tela precise mudar.

import {
  requests as mockRequests,
  doctors as mockDoctors,
  users as mockUsers,
  timelineEvents as mockTimeline,
  type ConsultationRequest,
  type Doctor,
  type PortalUser,
  type TimelineEvent,
} from "@/data/mock";

export interface InstitutionSettings {
  nome: string;
  cnpj: string;
  endereco: string;
  telefone: string;
  emailNotificacoes: string;
}

const mockSettings: InstitutionSettings = {
  nome: "Hospital Exemplo",
  cnpj: "12.345.678/0001-90",
  endereco: "Av. Paulista, 1000 — São Paulo/SP",
  telefone: "(11) 3000-0000",
  emailNotificacoes: "orcamentos@hospital.exemplo",
};

export interface PortalRepository {
  listRequests(): Promise<ConsultationRequest[]>;
  getRequest(id: string): Promise<ConsultationRequest | null>;
  listDoctors(): Promise<Doctor[]>;
  listUsers(): Promise<PortalUser[]>;
  getTimeline(requestId: string): Promise<TimelineEvent[]>;
  getSettings(): Promise<InstitutionSettings>;
}

export const repository: PortalRepository = {
  async listRequests() {
    return mockRequests;
  },
  async getRequest(id) {
    return mockRequests.find((r) => r.id === id) ?? null;
  },
  async listDoctors() {
    return mockDoctors;
  },
  async listUsers() {
    return mockUsers;
  },
  async getTimeline(_requestId) {
    return mockTimeline;
  },
  async getSettings() {
    return mockSettings;
  },
};
