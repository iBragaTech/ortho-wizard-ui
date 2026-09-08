CREATE OR REPLACE FUNCTION public.criar_usuario(p_nome text, p_email text, p_perfil user_profile, p_senha text)
RETURNS TABLE(id uuid, nome text, email text, perfil user_profile)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.portal_users u WHERE lower(u.email) = lower(trim(p_email))) THEN
    RAISE EXCEPTION 'Já existe um usuário com este e-mail.';
  END IF;

  RETURN QUERY
  INSERT INTO public.portal_users (nome, email, perfil, ativo, senha_hash)
  VALUES (trim(p_nome), lower(trim(p_email)), p_perfil, true,
          CASE WHEN coalesce(p_senha,'') = '' THEN NULL ELSE crypt(p_senha, gen_salt('bf')) END)
  RETURNING portal_users.id, portal_users.nome, portal_users.email, portal_users.perfil;
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_usuario(text, text, user_profile, text) TO anon, authenticated, service_role;