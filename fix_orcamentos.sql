ALTER TABLE IF EXISTS public.orcamentos 
  ADD COLUMN IF NOT EXISTS paciente_nome text,
  ADD COLUMN IF NOT EXISTS formas_pagamento text,
  ADD COLUMN IF NOT EXISTS parceiro_id uuid,
  ADD COLUMN IF NOT EXISTS parceiro_nome text,
  ADD COLUMN IF NOT EXISTS parceiro_tipo_repasse text,
  ADD COLUMN IF NOT EXISTS parceiro_valor_repasse numeric,
  ADD COLUMN IF NOT EXISTS observacoes text,
  ADD COLUMN IF NOT EXISTS data_assinatura timestamp with time zone,
  ADD COLUMN IF NOT EXISTS assinatura_paciente jsonb,
  ADD COLUMN IF NOT EXISTS status_assinatura text,
  ADD COLUMN IF NOT EXISTS token_assinatura text,
  ADD COLUMN IF NOT EXISTS data_expiracao_link timestamp with time zone;

NOTIFY pgrst, 'reload schema';
