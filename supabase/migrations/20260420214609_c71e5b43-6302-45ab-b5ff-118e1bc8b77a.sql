CREATE TABLE public.dentistas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  cro TEXT,
  especialidade TEXT,
  telefone TEXT,
  email TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dentistas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own dentistas select" ON public.dentistas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own dentistas insert" ON public.dentistas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own dentistas update" ON public.dentistas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own dentistas delete" ON public.dentistas FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_dentistas_atualizado_em
BEFORE UPDATE ON public.dentistas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();