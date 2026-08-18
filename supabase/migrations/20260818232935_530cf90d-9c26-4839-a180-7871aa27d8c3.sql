ALTER TABLE public.consultas
  ADD COLUMN IF NOT EXISTS duracao integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS procedimento text,
  ADD COLUMN IF NOT EXISTS dentista text;

ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS consulta_id uuid,
  ADD COLUMN IF NOT EXISTS metodo_pagamento text,
  ADD COLUMN IF NOT EXISTS vencimento timestamp with time zone,
  ADD COLUMN IF NOT EXISTS observacoes text;

ALTER TABLE public.prontuarios
  ADD COLUMN IF NOT EXISTS consulta_id uuid,
  ADD COLUMN IF NOT EXISTS historia_doenca text,
  ADD COLUMN IF NOT EXISTS exame_clinico text,
  ADD COLUMN IF NOT EXISTS plano_tratamento text,
  ADD COLUMN IF NOT EXISTS procedimentos_realizados jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS anexos jsonb DEFAULT '[]'::jsonb;