ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS proxima_consulta timestamp with time zone,
  ADD COLUMN IF NOT EXISTS data_arquivamento timestamp with time zone,
  ADD COLUMN IF NOT EXISTS motivo_arquivamento text;