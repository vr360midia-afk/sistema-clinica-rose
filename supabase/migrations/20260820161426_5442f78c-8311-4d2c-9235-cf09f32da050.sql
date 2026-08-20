CREATE TABLE public.medicamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  nome text NOT NULL,
  principio_ativo text,
  apresentacao text,
  dosagem text,
  posologia text,
  periodo text,
  quantidade text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicamentos TO authenticated;
GRANT ALL ON public.medicamentos TO service_role;

ALTER TABLE public.medicamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own medicamentos"
ON public.medicamentos FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_medicamentos_atualizado_em
BEFORE UPDATE ON public.medicamentos
FOR EACH ROW EXECUTE FUNCTION public.update_atualizado_em();