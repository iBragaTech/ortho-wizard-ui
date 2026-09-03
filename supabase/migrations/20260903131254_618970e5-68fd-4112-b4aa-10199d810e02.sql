CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.portal_users ADD COLUMN IF NOT EXISTS senha_hash text;

UPDATE public.portal_users SET senha_hash = crypt('portal123', gen_salt('bf')) WHERE senha_hash IS NULL;

-- Impede que o app leia o hash de senha diretamente
REVOKE ALL ON public.portal_users FROM anon, authenticated;
GRANT SELECT (id, nome, email, perfil, ativo, ultimo_acesso, created_at, updated_at) ON public.portal_users TO anon, authenticated;
GRANT INSERT (id, nome, email, perfil, ativo) ON public.portal_users TO anon, authenticated;
GRANT UPDATE (nome, email, perfil, ativo, ultimo_acesso) ON public.portal_users TO anon, authenticated;
GRANT DELETE ON public.portal_users TO anon, authenticated;
GRANT ALL ON public.portal_users TO service_role;

CREATE OR REPLACE FUNCTION public.verificar_login(p_email text, p_senha text)
RETURNS TABLE (id uuid, nome text, email text, perfil user_profile)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.portal_users u
     SET ultimo_acesso = now()
   WHERE lower(u.email) = lower(trim(p_email))
     AND u.ativo
     AND u.senha_hash IS NOT NULL
     AND u.senha_hash = crypt(p_senha, u.senha_hash)
  RETURNING u.id, u.nome, u.email, u.perfil;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verificar_login(text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.definir_senha(p_user_id uuid, p_senha text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  UPDATE public.portal_users SET senha_hash = crypt(p_senha, gen_salt('bf')) WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.definir_senha(uuid, text) TO anon, authenticated, service_role;