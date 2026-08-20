CREATE TABLE public.certificados_digitais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  provedor text NOT NULL DEFAULT 'safeid',
  ambiente text NOT NULL DEFAULT 'producao',
  titular_nome text,
  titular_cpf text,
  client_id text,
  client_secret text,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificados_digitais TO authenticated;
GRANT ALL ON public.certificados_digitais TO service_role;

ALTER TABLE public.certificados_digitais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own certificado" ON public.certificados_digitais
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER certificados_digitais_atualizado_em
BEFORE UPDATE ON public.certificados_digitais
FOR EACH ROW EXECUTE FUNCTION public.update_atualizado_em();