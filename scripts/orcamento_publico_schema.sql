-- ==============================================================================
-- SCHEMA ATUALIZADO: ORÇAMENTOS ONLINE, SOLICITAÇÃO DE AJUSTE, APROVAÇÃO E CONTRATO
-- ==============================================================================

ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS identificador text;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS token_assinatura text;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS data_expiracao_link timestamptz;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS aprovado_em timestamptz;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS condicao_escolhida jsonb;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS snapshot_aprovacao jsonb;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS fotos_planejamento jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS contrato_id text;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS contrato_token text;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS versao integer DEFAULT 1;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS solicitacoes_ajuste jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS historico_versoes jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_orcamentos_identificador ON public.orcamentos (identificador);
CREATE INDEX IF NOT EXISTS idx_orcamentos_token ON public.orcamentos (token_assinatura);
CREATE INDEX IF NOT EXISTS idx_orcamentos_status ON public.orcamentos (status);
