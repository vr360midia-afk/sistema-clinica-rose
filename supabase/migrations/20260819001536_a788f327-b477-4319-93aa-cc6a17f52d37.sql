ALTER TABLE public.consultas
  ADD COLUMN IF NOT EXISTS confirmacao_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS confirmado_em timestamp with time zone;