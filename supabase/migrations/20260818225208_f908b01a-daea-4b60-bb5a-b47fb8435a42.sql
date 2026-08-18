DROP POLICY IF EXISTS "public anamnese signing" ON public.anamneses;
DROP POLICY IF EXISTS "public anamnese update sign" ON public.anamneses;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;