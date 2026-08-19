ALTER TABLE public.documentos_paciente
  ADD COLUMN IF NOT EXISTS analise_ia text,
  ADD COLUMN IF NOT EXISTS analise_dados jsonb,
  ADD COLUMN IF NOT EXISTS analise_status text DEFAULT 'pendente';