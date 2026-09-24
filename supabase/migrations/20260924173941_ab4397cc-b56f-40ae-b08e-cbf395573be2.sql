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
DECLARE
  v_perfil text := CASE lower(p_perfil)
    WHEN 'médico' THEN 'medico'
    ELSE lower(p_perfil)
  END;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.portal_users
    WHERE portal_users.id = p_user_id
      AND portal_users.ativo = true
      AND portal_users.perfil::text = v_perfil
  ) THEN
    RAISE EXCEPTION 'Usuário sem permissão.';
  END IF;

  IF v_perfil = 'medico' THEN
    RETURN QUERY
      SELECT a.id, a.patient_name, a.patient_cpf, a.doctor_user_id,
             a.doctor_name, a.desired_date, a.status, a.created_at
      FROM public.surgical_appointments a
      WHERE a.doctor_user_id = p_user_id
      ORDER BY a.desired_date, a.created_at DESC;
  ELSIF v_perfil = 'administrador' THEN
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