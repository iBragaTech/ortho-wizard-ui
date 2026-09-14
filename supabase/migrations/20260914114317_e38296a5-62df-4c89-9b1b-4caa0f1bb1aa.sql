UPDATE public.portal_users
SET senha_hash = crypt('portal123', gen_salt('bf'))
WHERE lower(email) = 'gustavo.braga@he.org.br';