CREATE OR REPLACE FUNCTION public.update_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.update_atualizado_em() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  t text;
  trg text;
BEGIN
  FOR t, trg IN
    SELECT c.relname, tg.tgname
    FROM pg_trigger tg
    JOIN pg_class c ON c.oid = tg.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = tg.tgfoid
    WHERE n.nspname = 'public'
      AND NOT tg.tgisinternal
      AND p.proname = 'update_updated_at_column'
      AND EXISTS (
        SELECT 1 FROM information_schema.columns col
        WHERE col.table_schema = 'public' AND col.table_name = c.relname AND col.column_name = 'atualizado_em'
      )
  LOOP
    EXECUTE format('DROP TRIGGER %I ON public.%I', trg, t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_atualizado_em()', trg, t);
  END LOOP;
END;
$$;