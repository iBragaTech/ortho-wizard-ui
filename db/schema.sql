-- Portal de Orçamentos de Consultas Particulares
-- Schema PostgreSQL (rodar no banco do hospital)
-- psql -h <host> -U <usuario> -d <banco> -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE request_status AS ENUM (
  'pendente',
  'em_analise',
  'aguardando_medico',
  'aguardando_comercial',
  'concluido'
);

CREATE TYPE user_profile AS ENUM ('administrador', 'comercial', 'medico');

CREATE TABLE IF NOT EXISTS doctors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text NOT NULL,
  crm           text NOT NULL UNIQUE,
  especialidade text NOT NULL,
  ativo         boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portal_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text NOT NULL,
  email         text NOT NULL UNIQUE,
  perfil        user_profile NOT NULL,
  ativo         boolean NOT NULL DEFAULT true,
  ultimo_acesso timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL,
  cpf        text NOT NULL UNIQUE,
  telefone   text,
  email      text,
  nascimento date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consultation_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero         text NOT NULL UNIQUE,
  patient_id     uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id      uuid REFERENCES doctors(id) ON DELETE SET NULL,
  especialidade  text,
  tipo_consulta  text,
  data_desejada  date,
  status         request_status NOT NULL DEFAULT 'pendente',
  observacoes    text,

  -- Preenchimento do médico
  honorarios_medicos       numeric(12,2),
  diaria                   numeric(12,2),
  cti                      numeric(12,2),
  opme                     text,
  anatomo_patologico       text,
  reserva_sangue           text,
  equipe_multidisciplinar  text,
  fisioterapia             integer,
  tempo_bloco              text,
  obs_medico               text,
  preenchido_medico_em     timestamptz,

  -- Preenchimento do comercial
  valor_hospitalar         numeric(12,2),
  obs_comercial            text,
  preenchido_comercial_em  timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requests_status ON consultation_requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_doctor ON consultation_requests(doctor_id);
CREATE INDEX IF NOT EXISTS idx_requests_created ON consultation_requests(created_at DESC);

-- Histórico / timeline do fluxo
CREATE TABLE IF NOT EXISTS request_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES consultation_requests(id) ON DELETE CASCADE,
  titulo     text NOT NULL,
  descricao  text,
  autor_id   uuid REFERENCES portal_users(id) ON DELETE SET NULL,
  criado_em  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_request ON request_events(request_id, criado_em);

-- Configurações da instituição (linha única)
CREATE TABLE IF NOT EXISTS institution_settings (
  id                 integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nome               text,
  cnpj               text,
  endereco           text,
  telefone           text,
  email_notificacoes text,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Atualização automática de updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_requests_updated BEFORE UPDATE ON consultation_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_doctors_updated BEFORE UPDATE ON doctors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
