CREATE TABLE public.lixeira (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  entidade text NOT NULL,
  entidade_id text,
  titulo text,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  excluido_por text,
  excluido_em timestamp with time zone NOT NULL DEFAULT now(),
  expira_em timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lixeira TO authenticated;
GRANT ALL ON public.lixeira TO service_role;

ALTER TABLE public.lixeira ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios gerenciam sua lixeira"
ON public.lixeira FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_lixeira_user ON public.lixeira (user_id, excluido_em DESC);

CREATE TABLE public.seguranca_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  senha_mestre_hash text,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seguranca_config TO authenticated;
GRANT ALL ON public.seguranca_config TO service_role;

ALTER TABLE public.seguranca_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios gerenciam sua seguranca"
ON public.seguranca_config FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_seguranca_config_updated
BEFORE UPDATE ON public.seguranca_config
FOR EACH ROW EXECUTE FUNCTION public.update_atualizado_em();