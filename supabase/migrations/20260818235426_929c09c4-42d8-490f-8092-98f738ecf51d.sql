CREATE TABLE public.configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  nome_clinica text,
  cnpj text,
  endereco text,
  telefone text,
  email text,
  email_notificacoes boolean NOT NULL DEFAULT true,
  whatsapp_lembretes boolean NOT NULL DEFAULT true,
  lembrete_24h boolean NOT NULL DEFAULT true,
  lembrete_2h boolean NOT NULL DEFAULT true,
  backup_automatico boolean NOT NULL DEFAULT true,
  frequencia_backup text NOT NULL DEFAULT 'diario',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes TO authenticated;
GRANT ALL ON public.configuracoes TO service_role;

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own configuracoes select" ON public.configuracoes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own configuracoes insert" ON public.configuracoes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own configuracoes update" ON public.configuracoes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own configuracoes delete" ON public.configuracoes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_configuracoes_updated BEFORE UPDATE ON public.configuracoes
FOR EACH ROW EXECUTE FUNCTION public.update_atualizado_em();