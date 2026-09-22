-- Executar no PostgreSQL ortho_wizard em pc14121 (nao no Oracle).
-- Somente leitura; nao retorna senhas ou hashes.
SELECT current_database() AS banco, current_user AS usuario_conexao,
       inet_server_addr() AS endereco, inet_server_port() AS porta;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'portal_users'
ORDER BY ordinal_position;

SELECT id, nome, email, perfil, ativo
FROM public.portal_users
WHERE lower(email) = 'amanda.rafaela@he.org.br';

-- Existencia das rotinas; nao executa login e nao exibe codigo ou credenciais.
SELECT n.nspname AS schema, p.proname AS rotina,
       pg_get_function_identity_arguments(p.oid) AS argumentos
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('verificar_login', 'criar_usuario', 'definir_senha');
