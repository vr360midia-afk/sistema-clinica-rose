CREATE TABLE public.extratos_financeiros (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  paciente_id uuid REFERENCES public.pacientes(id) ON DELETE SET NULL,
  paciente_nome text,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_pago numeric NOT NULL DEFAULT 0,
  total_pendente numeric NOT NULL DEFAULT 0,
  total_previsto numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  token_assinatura text,
  data_expiracao_link timestamp with time zone,
  assinatura_paciente jsonb,
  status_assinatura text NOT NULL DEFAULT 'pendente',
  data_assinatura timestamp with time zone,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.extratos_financeiros TO authenticated;
GRANT ALL ON public.extratos_financeiros TO service_role;

ALTER TABLE public.extratos_financeiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "extratos_select_own" ON public.extratos_financeiros FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "extratos_insert_own" ON public.extratos_financeiros FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "extratos_update_own" ON public.extratos_financeiros FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "extratos_delete_own" ON public.extratos_financeiros FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_extratos_updated BEFORE UPDATE ON public.extratos_financeiros
FOR EACH ROW EXECUTE FUNCTION public.update_atualizado_em();

CREATE INDEX idx_extratos_paciente ON public.extratos_financeiros(paciente_id);