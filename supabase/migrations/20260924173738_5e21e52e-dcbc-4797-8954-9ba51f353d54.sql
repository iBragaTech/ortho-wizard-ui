CREATE TABLE public.surgical_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name text NOT NULL CHECK (char_length(btrim(patient_name)) BETWEEN 1 AND 120),
  patient_cpf text NOT NULL CHECK (patient_cpf ~ '^[0-9]{11}$'),
  doctor_user_id uuid NOT NULL REFERENCES public.portal_users(id) ON DELETE RESTRICT,
  doctor_name text NOT NULL,
  desired_date date NOT NULL,
  status text NOT NULL DEFAULT 'solicitado' CHECK (status IN ('solicitado', 'confirmado', 'cancelado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.surgical_appointments TO authenticated;
GRANT ALL ON public.surgical_appointments TO service_role;

ALTER TABLE public.surgical_appointments ENABLE ROW LEVEL SECURITY;

CREATE INDEX surgical_appointments_doctor_idx
  ON public.surgical_appointments (doctor_user_id, desired_date);
CREATE INDEX surgical_appointments_status_idx
  ON public.surgical_appointments (status, desired_date);

CREATE TRIGGER surgical_appointments_updated_at
  BEFORE UPDATE ON public.surgical_appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.listar_agendamentos_cirurgicos(
  p_user_id uuid,
  p_perfil text
)
RETURNS TABLE (
  id uuid,
  patient_name text,
  patient_cpf text,
  doctor_user_id uuid,
  doctor_name text,
  desired_date date,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.portal_users
    WHERE portal_users.id = p_user_id
      AND portal_users.ativo = true
      AND portal_users.perfil::text = lower(p_perfil)
  ) THEN
    RAISE EXCEPTION 'Usuário sem permissão.';
  END IF;

  IF lower(p_perfil) = 'medico' THEN
    RETURN QUERY
      SELECT a.id, a.patient_name, a.patient_cpf, a.doctor_user_id,
             a.doctor_name, a.desired_date, a.status, a.created_at
      FROM public.surgical_appointments a
      WHERE a.doctor_user_id = p_user_id
      ORDER BY a.desired_date, a.created_at DESC;
  ELSIF lower(p_perfil) = 'administrador' THEN
    RETURN QUERY
      SELECT a.id, a.patient_name, a.patient_cpf, a.doctor_user_id,
             a.doctor_name, a.desired_date, a.status, a.created_at
      FROM public.surgical_appointments a
      ORDER BY a.desired_date, a.created_at DESC;
  ELSE
    RAISE EXCEPTION 'Perfil sem acesso aos agendamentos cirúrgicos.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.criar_agendamento_cirurgico(
  p_user_id uuid,
  p_patient_name text,
  p_patient_cpf text,
  p_desired_date date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_name text;
BEGIN
  SELECT nome INTO v_name
  FROM public.portal_users
  WHERE id = p_user_id AND perfil::text = 'medico' AND ativo = true;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Somente médicos podem solicitar agendamentos cirúrgicos.';
  END IF;
  IF char_length(btrim(p_patient_name)) < 1 OR char_length(btrim(p_patient_name)) > 120 THEN
    RAISE EXCEPTION 'Informe o nome do paciente.';
  END IF;
  IF p_patient_cpf !~ '^[0-9]{11}$' THEN
    RAISE EXCEPTION 'CPF inválido.';
  END IF;
  IF p_desired_date < current_date THEN
    RAISE EXCEPTION 'A data desejada não pode estar no passado.';
  END IF;

  INSERT INTO public.surgical_appointments (
    patient_name, patient_cpf, doctor_user_id, doctor_name, desired_date
  ) VALUES (
    btrim(p_patient_name), p_patient_cpf, p_user_id, v_name, p_desired_date
  ) RETURNING surgical_appointments.id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_agendamentos_cirurgicos(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.criar_agendamento_cirurgico(uuid, text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_agendamentos_cirurgicos(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.criar_agendamento_cirurgico(uuid, text, text, date) TO anon, authenticated;