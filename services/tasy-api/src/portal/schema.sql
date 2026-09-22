-- Base NOVA do portal: não executar migrações Supabase nem scripts do ERP aqui.
CREATE TABLE portal.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  perfil text NOT NULL CHECK (perfil IN ('Administrador', 'Comercial', 'Médico')),
  password_hash text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ultimo_acesso timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE portal.sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON portal.sessions(user_id);
CREATE INDEX sessions_expiry_idx ON portal.sessions(expires_at);
CREATE TABLE portal.doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL, crm text NOT NULL UNIQUE, especialidade text NOT NULL,
  ativo boolean NOT NULL DEFAULT true
);
CREATE SEQUENCE portal.request_numbers;
CREATE TABLE portal.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES portal.users(id),
  assigned_to uuid REFERENCES portal.users(id),
  status text NOT NULL CHECK (status IN ('pendente','em_analise','aguardando_medico','aguardando_comercial','concluido')),
  -- Snapshot validado pelo servidor: não altera cadastros de outros orçamentos.
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX requests_assigned_idx ON portal.requests(assigned_to);
CREATE INDEX requests_created_idx ON portal.requests(created_at);
CREATE TABLE portal.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES portal.requests(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES portal.users(id),
  titulo text NOT NULL, descricao text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_request_idx ON portal.events(request_id, created_at);
CREATE TABLE portal.settings (
  id integer PRIMARY KEY CHECK (id = 1),
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object')
);
INSERT INTO portal.settings VALUES (1, '{"nome":"","cnpj":"","endereco":"","telefone":"","emailNotificacoes":""}');
-- A API é o único acesso público. Não existem roles anon/authenticated do Supabase.
REVOKE ALL ON ALL TABLES IN SCHEMA portal FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA portal FROM PUBLIC;
