ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS data_nascimento date;

GRANT SELECT, INSERT, UPDATE ON public.pacientes TO authenticated;
GRANT ALL ON public.pacientes TO service_role;