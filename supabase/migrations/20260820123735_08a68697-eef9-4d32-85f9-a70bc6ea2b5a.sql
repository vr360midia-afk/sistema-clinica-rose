CREATE TABLE public.parceiros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  especialidade TEXT,
  telefone TEXT,
  email TEXT,
  tipo_repasse TEXT NOT NULL DEFAULT 'percentual',
  valor_repasse NUMERIC NOT NULL DEFAULT 0,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parceiros TO authenticated;
GRANT ALL ON public.parceiros TO service_role;

ALTER TABLE public.parceiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parceiros_select_own" ON public.parceiros FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "parceiros_insert_own" ON public.parceiros FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "parceiros_update_own" ON public.parceiros FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "parceiros_delete_own" ON public.parceiros FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_parceiros_updated BEFORE UPDATE ON public.parceiros FOR EACH ROW EXECUTE FUNCTION public.update_atualizado_em();

ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS parceiro_id UUID,
  ADD COLUMN IF NOT EXISTS parceiro_nome TEXT,
  ADD COLUMN IF NOT EXISTS valor_parceiro NUMERIC;