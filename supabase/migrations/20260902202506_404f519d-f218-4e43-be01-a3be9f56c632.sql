CREATE TYPE public.request_status AS ENUM ('pendente','em_analise','aguardando_medico','aguardando_comercial','concluido');
CREATE TYPE public.user_profile AS ENUM ('administrador','comercial','medico');

CREATE TABLE public.doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  crm text NOT NULL UNIQUE,
  especialidade text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.portal_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  perfil public.user_profile NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ultimo_acesso timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cpf text NOT NULL UNIQUE,
  telefone text,
  email text,
  nascimento date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.consultation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  especialidade text,
  tipo_consulta text,
  data_desejada date,
  status public.request_status NOT NULL DEFAULT 'pendente',
  observacoes text,
  honorarios_medicos numeric(12,2),
  diaria numeric(12,2),
  cti numeric(12,2),
  opme text,
  anatomo_patologico text,
  reserva_sangue text,
  equipe_multidisciplinar text,
  fisioterapia integer,
  tempo_bloco text,
  obs_medico text,
  preenchido_medico_em timestamptz,
  valor_hospitalar numeric(12,2),
  obs_comercial text,
  preenchido_comercial_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_requests_status ON public.consultation_requests(status);
CREATE INDEX idx_requests_doctor ON public.consultation_requests(doctor_id);
CREATE INDEX idx_requests_created ON public.consultation_requests(created_at DESC);

CREATE TABLE public.request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.consultation_requests(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  concluido boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_request ON public.request_events(request_id, ordem);

CREATE TABLE public.institution_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nome text,
  cnpj text,
  endereco text,
  telefone text,
  email_notificacoes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_doctors_updated BEFORE UPDATE ON public.doctors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_portal_users_updated BEFORE UPDATE ON public.portal_users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_requests_updated BEFORE UPDATE ON public.consultation_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctors TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_users TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultation_requests TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_events TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.institution_settings TO anon, authenticated;
GRANT ALL ON public.doctors, public.portal_users, public.patients, public.consultation_requests, public.request_events, public.institution_settings TO service_role;

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prototipo_acesso_total" ON public.doctors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "prototipo_acesso_total" ON public.portal_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "prototipo_acesso_total" ON public.patients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "prototipo_acesso_total" ON public.consultation_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "prototipo_acesso_total" ON public.request_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "prototipo_acesso_total" ON public.institution_settings FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.doctors (nome, crm, especialidade, ativo) VALUES
  ('Dr. Ricardo Menezes','CRM-SP 118240','Cardiologia',true),
  ('Dra. Helena Souza','CRM-SP 92310','Ortopedia',true),
  ('Dr. Paulo Nogueira','CRM-SP 145901','Dermatologia',true),
  ('Dra. Beatriz Antunes','CRM-SP 100522','Neurologia',false),
  ('Dr. André Camargo','CRM-SP 133870','Endocrinologia',true);

INSERT INTO public.portal_users (nome, email, perfil, ativo, ultimo_acesso) VALUES
  ('Ana Carolina Lima','ana.lima@hospital.exemplo','administrador',true,'2026-08-17 09:42'),
  ('Marcos Dantas','marcos.dantas@hospital.exemplo','comercial',true,'2026-08-17 08:15'),
  ('Dr. Ricardo Menezes','ricardo.menezes@hospital.exemplo','medico',true,'2026-08-16 18:03'),
  ('Dra. Helena Souza','helena.souza@hospital.exemplo','medico',true,'2026-08-15 14:27'),
  ('Priscila Moraes','priscila.moraes@hospital.exemplo','comercial',false,'2026-08-02 11:10');

INSERT INTO public.patients (nome, cpf, telefone, email, nascimento) VALUES
  ('Marina Albuquerque','412.883.190-55','(11) 98812-4471','marina.albuquerque@exemplo.com','1988-03-14'),
  ('Eduardo Tavares','308.221.774-01','(11) 99123-0087','eduardo.tavares@exemplo.com','1975-11-02'),
  ('Cláudia Ribeiro','225.667.331-92','(11) 97744-2200','claudia.ribeiro@exemplo.com','1992-06-30'),
  ('Fernando Lacerda','551.902.114-38','(11) 96550-1188','fernando.lacerda@exemplo.com','1965-01-18'),
  ('Juliana Prado','774.310.556-20','(11) 98221-7766','juliana.prado@exemplo.com','1998-09-07'),
  ('Otávio Bernardes','119.884.220-47','(11) 95500-3311','otavio.bernardes@exemplo.com','1981-05-23'),
  ('Renata Vasques','660.773.188-04','(11) 94411-8899','renata.vasques@exemplo.com','1970-12-12'),
  ('Sérgio Fontes','903.221.667-13','(11) 93322-6644','sergio.fontes@exemplo.com','1959-04-05');

INSERT INTO public.consultation_requests
  (numero, patient_id, doctor_id, especialidade, tipo_consulta, data_desejada, status, observacoes,
   honorarios_medicos, diaria, cti, opme, anatomo_patologico, reserva_sangue, equipe_multidisciplinar,
   fisioterapia, tempo_bloco, obs_medico, valor_hospitalar, obs_comercial, created_at)
SELECT v.numero, p.id, d.id, v.especialidade, v.tipo_consulta, v.data_desejada::date, v.status::public.request_status, v.observacoes,
       v.honorarios_medicos, v.diaria, v.cti, v.opme, v.anatomo_patologico, v.reserva_sangue, v.equipe_multidisciplinar,
       v.fisioterapia, v.tempo_bloco, v.obs_medico, v.valor_hospitalar, v.obs_comercial, v.created_at::timestamptz
FROM (VALUES
  ('SOL-2026-0148','412.883.190-55','CRM-SP 118240','Cardiologia','Primeira consulta','2026-08-24','aguardando_medico','Paciente com histórico de hipertensão. Prefere período da manhã.',NULL::numeric,NULL::numeric,NULL::numeric,'','','','',NULL::integer,'','',NULL::numeric,'','2026-08-12'),
  ('SOL-2026-0147','308.221.774-01','CRM-SP 92310','Ortopedia','Retorno','2026-08-21','aguardando_comercial','Encaminhado pelo pronto atendimento.',850,320,NULL,'Placa de titânio para osteossíntese – 2 unidades – Fornecedor: Ortosintese Brasil','','','',6,'1h30','Inclui avaliação de exames de imagem prévios.',NULL,'','2026-08-11'),
  ('SOL-2026-0146','225.667.331-92','CRM-SP 145901','Dermatologia','Primeira consulta','2026-08-19','concluido','',620,NULL,NULL,'','Biópsia de pele – 1 lâmina – Laboratório: Patolab','','',NULL,'','Consulta padrão, sem procedimentos adicionais.',340,'Taxa de sala ambulatorial incluída.','2026-08-10'),
  ('SOL-2026-0145','551.902.114-38','CRM-SP 100522','Neurologia','Segunda opinião','2026-08-27','em_analise','Solicitação recebida via central de atendimento.',NULL,NULL,NULL,'','','','',NULL,'','',NULL,'','2026-08-10'),
  ('SOL-2026-0144','774.310.556-20','CRM-SP 118240','Cardiologia','Primeira consulta','2026-08-18','pendente','',NULL,NULL,NULL,'','','','',NULL,'','',NULL,'','2026-08-09'),
  ('SOL-2026-0143','119.884.220-47','CRM-SP 92310','Ortopedia','Retorno','2026-08-16','concluido','',780,280,NULL,'','','','',4,'','Avaliação pós-operatória.',410,'Sem materiais adicionais.','2026-08-08'),
  ('SOL-2026-0142','660.773.188-04','CRM-SP 145901','Endocrinologia','Primeira consulta','2026-08-29','aguardando_medico','Paciente solicitou orçamento com urgência.',NULL,NULL,NULL,'','','','',NULL,'','',NULL,'','2026-08-07'),
  ('SOL-2026-0141','903.221.667-13','CRM-SP 100522','Gastroenterologia','Primeira consulta','2026-08-15','aguardando_medico','',NULL,NULL,NULL,'','','','',NULL,'','',NULL,'','2026-08-06')
) AS v(numero,cpf,crm,especialidade,tipo_consulta,data_desejada,status,observacoes,honorarios_medicos,diaria,cti,opme,anatomo_patologico,reserva_sangue,equipe_multidisciplinar,fisioterapia,tempo_bloco,obs_medico,valor_hospitalar,obs_comercial,created_at)
JOIN public.patients p ON p.cpf = v.cpf
JOIN public.doctors d ON d.crm = v.crm;

INSERT INTO public.request_events (request_id, titulo, descricao, concluido, ordem, criado_em)
SELECT r.id, e.titulo, e.descricao, e.concluido, e.ordem, r.created_at + (e.ordem * interval '3 minutes')
FROM public.consultation_requests r
CROSS JOIN (VALUES
  ('Solicitação criada','Registrada pela central de atendimento',true,1),
  ('Solicitação enviada ao médico','Encaminhada para preenchimento de honorários',true,2)
) AS e(titulo,descricao,concluido,ordem);

INSERT INTO public.institution_settings (id, nome, cnpj, endereco, telefone, email_notificacoes)
VALUES (1,'Hospital Exemplo','12.345.678/0001-90','Av. Paulista, 1000 — São Paulo/SP','(11) 3000-0000','orcamentos@hospital.exemplo');