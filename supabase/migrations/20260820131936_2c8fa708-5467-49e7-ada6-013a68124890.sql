CREATE TABLE public.odontograma_versoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,
  observacoes TEXT,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.odontograma_versoes TO authenticated;
GRANT ALL ON public.odontograma_versoes TO service_role;

ALTER TABLE public.odontograma_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own odontograma versions"
ON public.odontograma_versoes FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_odontograma_versoes_paciente ON public.odontograma_versoes (paciente_id, criado_em DESC);

CREATE TABLE public.documentos_clinicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
  paciente_nome TEXT,
  tipo TEXT NOT NULL DEFAULT 'prescricao',
  titulo TEXT NOT NULL,
  conteudo TEXT,
  itens JSONB NOT NULL DEFAULT '[]'::jsonb,
  dias_afastamento INTEGER,
  cid TEXT,
  dentista TEXT,
  assinatura_id UUID,
  assinatura_data TEXT,
  assinante_nome TEXT,
  assinado_em TIMESTAMP WITH TIME ZONE,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_clinicos TO authenticated;
GRANT ALL ON public.documentos_clinicos TO service_role;

ALTER TABLE public.documentos_clinicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own clinical documents"
ON public.documentos_clinicos FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_documentos_clinicos_paciente ON public.documentos_clinicos (paciente_id, criado_em DESC);

CREATE TRIGGER trg_documentos_clinicos_updated
BEFORE UPDATE ON public.documentos_clinicos
FOR EACH ROW EXECUTE FUNCTION public.update_atualizado_em();