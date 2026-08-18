CREATE TABLE public.procedimentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  nome text NOT NULL,
  categoria text NOT NULL DEFAULT 'geral',
  descricao text,
  preco numeric NOT NULL DEFAULT 0,
  preco_convenio numeric DEFAULT 0,
  duracao_minutos integer NOT NULL DEFAULT 30,
  complexidade text NOT NULL DEFAULT 'baixa',
  requerer_anestesia boolean NOT NULL DEFAULT false,
  requerer_raio_x boolean NOT NULL DEFAULT false,
  materiais_necessarios jsonb NOT NULL DEFAULT '[]'::jsonb,
  equipamentos_necessarios jsonb NOT NULL DEFAULT '[]'::jsonb,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  criado_por text,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.procedimentos TO authenticated;
GRANT ALL ON public.procedimentos TO service_role;

ALTER TABLE public.procedimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own procedimentos select" ON public.procedimentos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own procedimentos insert" ON public.procedimentos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own procedimentos update" ON public.procedimentos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own procedimentos delete" ON public.procedimentos FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_procedimentos_updated BEFORE UPDATE ON public.procedimentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.pacotes_procedimentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text,
  procedimento_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  preco numeric NOT NULL DEFAULT 0,
  desconto_percentual numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pacotes_procedimentos TO authenticated;
GRANT ALL ON public.pacotes_procedimentos TO service_role;

ALTER TABLE public.pacotes_procedimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own pacotes select" ON public.pacotes_procedimentos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own pacotes insert" ON public.pacotes_procedimentos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own pacotes update" ON public.pacotes_procedimentos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own pacotes delete" ON public.pacotes_procedimentos FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_pacotes_updated BEFORE UPDATE ON public.pacotes_procedimentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.assinaturas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'dentista',
  assinatura_data text NOT NULL,
  documento_id text,
  documento_tipo text,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assinaturas TO authenticated;
GRANT ALL ON public.assinaturas TO service_role;

ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own assinaturas select" ON public.assinaturas FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own assinaturas insert" ON public.assinaturas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own assinaturas update" ON public.assinaturas FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own assinaturas delete" ON public.assinaturas FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_assinaturas_updated BEFORE UPDATE ON public.assinaturas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();