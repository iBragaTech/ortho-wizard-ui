// Camada única de acesso a dados do portal.
//
// Hoje: lê e grava no PostgreSQL gerenciado pelo Lovable Cloud, usando apenas
// SQL/tabelas padrão (sem recursos exclusivos do provedor).
//
// Amanhã (migração para o PostgreSQL do hospital): basta trocar as chamadas
// deste arquivo por uma API interna ou driver PostgreSQL. Nenhuma tela precisa
// mudar, pois todas consomem apenas as funções exportadas aqui.
// Ver docs/integracao-postgres.md.

import { supabase } from "@/integrations/supabase/client";
import type {
  ConsultationRequest,
  Doctor,
  PortalUser,
  RequestStatus,
  TimelineEvent,
} from "@/data/mock";

export interface InstitutionSettings {
  nome: string;
  cnpj: string;
  endereco: string;
  telefone: string;
  emailNotificacoes: string;
}

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function fmtDateTime(value: string | null): string {
  if (!value) return "—";
  const dt = new Date(value);
  return dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function num(value: number | string | null): number | null {
  if (value === null || value === "") return null;
  return typeof value === "number" ? value : Number(value);
}

const REQUEST_SELECT = `
  id, numero, especialidade, tipo_consulta, data_desejada, status, observacoes,
  honorarios_medicos, diaria, cti, opme, anatomo_patologico, reserva_sangue,
  equipe_multidisciplinar, fisioterapia, tempo_bloco, obs_medico,
  valor_hospitalar, obs_comercial, created_at,
  patients:patient_id ( nome, cpf, telefone, email, nascimento ),
  doctors:doctor_id ( nome, crm )
`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRequest(row: any): ConsultationRequest {
  return {
    id: row.id,
    numero: row.numero,
    paciente: {
      nome: row.patients?.nome ?? "—",
      cpf: row.patients?.cpf ?? "—",
      telefone: row.patients?.telefone ?? "—",
      email: row.patients?.email ?? "—",
      nascimento: fmtDate(row.patients?.nascimento ?? null),
    },
    medico: row.doctors?.nome ?? "—",
    crm: row.doctors?.crm ?? "—",
    especialidade: row.especialidade ?? "",
    tipoConsulta: row.tipo_consulta ?? "",
    dataDesejada: fmtDate(row.data_desejada),
    data: fmtDate(row.created_at),
    status: row.status as RequestStatus,
    honorariosMedicos: num(row.honorarios_medicos),
    diaria: num(row.diaria),
    cti: num(row.cti),
    opme: row.opme ?? "",
    anatomoPatologico: row.anatomo_patologico ?? "",
    reservaSangue: row.reserva_sangue ?? "",
    equipeMultidisciplinar: row.equipe_multidisciplinar ?? "",
    fisioterapia: row.fisioterapia ?? null,
    tempoBloco: row.tempo_bloco ?? "",
    obsMedico: row.obs_medico ?? "",
    valorHospitalar: num(row.valor_hospitalar),
    obsComercial: row.obs_comercial ?? "",
    observacoes: row.observacoes ?? "",
  };
}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<T>;
}

function unwrapId(res: { data: any; error: { message: string } | null }): { id: string } {
  if (res.error) throw new Error(res.error.message);
  return res.data as { id: string };
}

export interface NewRequestInput {
  nome: string;
  nascimento: string; // yyyy-mm-dd
  cpf: string;
  telefone: string;
  especialidade?: string;
  tipoConsulta?: string;
  dataDesejada?: string; // yyyy-mm-dd
  observacoes?: string;
}

export interface DoctorFeesInput {
  honorariosMedicos: number | null;
  diaria: number | null;
  cti: number | null;
  opme: string;
  anatomoPatologico: string;
  reservaSangue: string;
  equipeMultidisciplinar: string;
  fisioterapia: number | null;
  tempoBloco: string;
  obsMedico: string;
}

export const repository = {
  async listRequests(): Promise<ConsultationRequest[]> {
    const data = unwrap(
      await supabase
        .from("consultation_requests")
        .select(REQUEST_SELECT)
        .order("created_at", { ascending: false }),
    );
    return (data as any[]).map(mapRequest);
  },

  async getRequest(id: string): Promise<ConsultationRequest | null> {
    const { data, error } = await supabase
      .from("consultation_requests")
      .select(REQUEST_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRequest(data) : null;
  },

  async createRequest(input: NewRequestInput): Promise<string> {
    const patient = unwrapId(
      await supabase
        .from("patients")
        .upsert(
          {
            nome: input.nome,
            cpf: input.cpf,
            telefone: input.telefone || null,
            nascimento: input.nascimento || null,
          },
          { onConflict: "cpf" },
        )
        .select("id")
        .single(),
    );

    const numero = `SOL-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const created = unwrapId(
      await supabase
        .from("consultation_requests")
        .insert({
          numero,
          patient_id: patient.id,
          especialidade: input.especialidade || null,
          tipo_consulta: input.tipoConsulta || null,
          data_desejada: input.dataDesejada || null,
          observacoes: input.observacoes || null,
          status: "aguardando_medico",
        })
        .select("id")
        .single(),
    );

    await supabase.from("request_events").insert([
      { request_id: created.id, titulo: "Solicitação criada", descricao: "Registrada no portal", ordem: 1 },
      { request_id: created.id, titulo: "Solicitação enviada ao médico", descricao: "Encaminhada para preenchimento de honorários", ordem: 2 },
    ]);

    return created.id;
  },

  async saveDoctorFees(requestId: string, input: DoctorFeesInput): Promise<void> {
    const { error } = await supabase
      .from("consultation_requests")
      .update({
        honorarios_medicos: input.honorariosMedicos,
        diaria: input.diaria,
        cti: input.cti,
        opme: input.opme,
        anatomo_patologico: input.anatomoPatologico,
        reserva_sangue: input.reservaSangue,
        equipe_multidisciplinar: input.equipeMultidisciplinar,
        fisioterapia: input.fisioterapia,
        tempo_bloco: input.tempoBloco,
        obs_medico: input.obsMedico,
        preenchido_medico_em: new Date().toISOString(),
        status: "aguardando_comercial",
      })
      .eq("id", requestId);
    if (error) throw new Error(error.message);
    await supabase.from("request_events").insert({
      request_id: requestId,
      titulo: "Honorários preenchidos",
      descricao: "Valores informados pelo médico responsável",
      ordem: 3,
    });
  },

  async saveHospitalValue(requestId: string, valor: number | null, obs: string): Promise<void> {
    const { error } = await supabase
      .from("consultation_requests")
      .update({
        valor_hospitalar: valor,
        obs_comercial: obs,
        preenchido_comercial_em: new Date().toISOString(),
        status: "concluido",
      })
      .eq("id", requestId);
    if (error) throw new Error(error.message);
    await supabase.from("request_events").insert({
      request_id: requestId,
      titulo: "Valor hospitalar preenchido",
      descricao: "Orçamento concluído pelo setor Comercial",
      ordem: 5,
    });
  },

  async listDoctors(): Promise<Doctor[]> {
    const data = unwrap(
      await supabase.from("doctors").select("id, nome, crm, especialidade, ativo").order("nome"),
    );
    return (data as any[]).map((d) => ({
      id: d.id,
      nome: d.nome,
      crm: d.crm,
      especialidade: d.especialidade,
      ativo: d.ativo,
      solicitacoes: 0,
    }));
  },

  async createDoctor(input: { nome: string; crm: string; especialidade: string }): Promise<void> {
    const { error } = await supabase.from("doctors").insert(input);
    if (error) throw new Error(error.message);
  },

  async listUsers(): Promise<PortalUser[]> {
    const data = unwrap(
      await supabase
        .from("portal_users")
        .select("id, nome, email, perfil, ativo, ultimo_acesso")
        .order("nome"),
    );
    const labels: Record<string, PortalUser["perfil"]> = {
      administrador: "Administrador",
      comercial: "Comercial",
      medico: "Médico",
    };
    return (data as any[]).map((u) => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      perfil: labels[u.perfil] ?? "Comercial",
      ativo: u.ativo,
      ultimoAcesso: fmtDateTime(u.ultimo_acesso),
    }));
  },

  // Valida e-mail + senha no banco (função verificar_login, hash bcrypt/pgcrypto).
  async signIn(email: string, senha: string) {
    const { data, error } = await (supabase as any).rpc("verificar_login", {
      p_email: email,
      p_senha: senha,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    const labels: Record<string, PortalUser["perfil"]> = {
      administrador: "Administrador",
      comercial: "Comercial",
      medico: "Médico",
    };
    return {
      id: row.id as string,
      nome: row.nome as string,
      email: row.email as string,
      perfil: (labels[row.perfil] ?? "Comercial") as PortalUser["perfil"],
    };
  },



  async getTimeline(requestId: string): Promise<TimelineEvent[]> {
    const data = unwrap(
      await supabase
        .from("request_events")
        .select("titulo, descricao, concluido, criado_em, ordem")
        .eq("request_id", requestId)
        .order("ordem"),
    );
    const registrados = (data as any[]).map((e) => ({
      titulo: e.titulo,
      descricao: e.descricao ?? "",
      data: fmtDateTime(e.criado_em),
      concluido: e.concluido,
    }));
    const previstos: TimelineEvent[] = [
      { titulo: "Solicitação criada", descricao: "Registrada no portal", data: "—", concluido: false },
      { titulo: "Solicitação enviada ao médico", descricao: "Encaminhada para preenchimento de honorários", data: "—", concluido: false },
      { titulo: "Honorários preenchidos", descricao: "Aguardando ação do médico responsável", data: "—", concluido: false },
      { titulo: "Enviada ao Comercial", descricao: "Etapa seguinte do fluxo", data: "—", concluido: false },
      { titulo: "Valor hospitalar preenchido", descricao: "Preenchimento pelo setor Comercial", data: "—", concluido: false },
      { titulo: "Orçamento concluído", descricao: "Orçamento final disponível ao paciente", data: "—", concluido: false },
    ];
    return previstos.map((p) => registrados.find((r) => r.titulo === p.titulo) ?? p);
  },

  async getSettings(): Promise<InstitutionSettings> {
    const { data } = await supabase
      .from("institution_settings")
      .select("nome, cnpj, endereco, telefone, email_notificacoes")
      .eq("id", 1)
      .maybeSingle();
    return {
      nome: data?.nome ?? "",
      cnpj: data?.cnpj ?? "",
      endereco: data?.endereco ?? "",
      telefone: data?.telefone ?? "",
      emailNotificacoes: data?.email_notificacoes ?? "",
    };
  },

  async saveSettings(input: InstitutionSettings): Promise<void> {
    const { error } = await supabase.from("institution_settings").upsert({
      id: 1,
      nome: input.nome,
      cnpj: input.cnpj,
      endereco: input.endereco,
      telefone: input.telefone,
      email_notificacoes: input.emailNotificacoes,
    });
    if (error) throw new Error(error.message);
  },
};
