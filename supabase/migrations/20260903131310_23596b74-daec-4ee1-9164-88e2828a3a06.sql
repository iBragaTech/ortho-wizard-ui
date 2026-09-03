REVOKE EXECUTE ON FUNCTION public.definir_senha(uuid, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.definir_senha(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.verificar_login(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.verificar_login(text, text) TO anon, authenticated, service_role;