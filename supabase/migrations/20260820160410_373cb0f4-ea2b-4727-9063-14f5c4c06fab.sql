ALTER TABLE public.documentos_clinicos
  ADD COLUMN IF NOT EXISTS cfo_link_validacao TEXT,
  ADD COLUMN IF NOT EXISTS cfo_codigo_validacao TEXT,
  ADD COLUMN IF NOT EXISTS cfo_emitido_em TIMESTAMP WITH TIME ZONE;