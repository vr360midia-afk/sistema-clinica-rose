ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS taxa_cartao_percentual numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxa_cartao_valor numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parcelas integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS valor_parcela numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_liquido numeric;