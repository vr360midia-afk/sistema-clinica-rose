ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS parceiro_id uuid,
  ADD COLUMN IF NOT EXISTS parceiro_nome text,
  ADD COLUMN IF NOT EXISTS parceiro_tipo_repasse text,
  ADD COLUMN IF NOT EXISTS parceiro_valor_repasse numeric NOT NULL DEFAULT 0;