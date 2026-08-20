-- Bloqueios de agenda
CREATE TABLE public.bloqueios_agenda (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  dentista TEXT,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  hora_inicio TEXT,
  hora_fim TEXT,
  dia_inteiro BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bloqueios_agenda TO authenticated;
GRANT ALL ON public.bloqueios_agenda TO service_role;
ALTER TABLE public.bloqueios_agenda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bloqueios_select" ON public.bloqueios_agenda FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "bloqueios_insert" ON public.bloqueios_agenda FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bloqueios_update" ON public.bloqueios_agenda FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bloqueios_delete" ON public.bloqueios_agenda FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_bloqueios_updated BEFORE UPDATE ON public.bloqueios_agenda FOR EACH ROW EXECUTE FUNCTION public.update_atualizado_em();

-- Orçamentos / planos de tratamento
CREATE TABLE public.orcamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE,
  paciente_nome TEXT,
  titulo TEXT NOT NULL DEFAULT 'Plano de tratamento',
  itens JSONB NOT NULL DEFAULT '[]'::jsonb,
  desconto NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'rascunho',
  validade DATE,
  observacoes TEXT,
  token_assinatura TEXT,
  data_expiracao_link TIMESTAMPTZ,
  assinatura_paciente JSONB,
  data_assinatura TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamentos TO authenticated;
GRANT ALL ON public.orcamentos TO service_role;
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orcamentos_select" ON public.orcamentos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "orcamentos_insert" ON public.orcamentos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "orcamentos_update" ON public.orcamentos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "orcamentos_delete" ON public.orcamentos FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_orcamentos_updated BEFORE UPDATE ON public.orcamentos FOR EACH ROW EXECUTE FUNCTION public.update_atualizado_em();

-- Log de auditoria
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ator_email TEXT,
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id TEXT,
  descricao TEXT,
  dados JSONB,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select" ON public.audit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "audit_insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_audit_logs_user_data ON public.audit_logs (user_id, criado_em DESC);