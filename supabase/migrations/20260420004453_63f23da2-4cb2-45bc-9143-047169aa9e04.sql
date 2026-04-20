
-- Função utilitária para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-cria profile no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', ''), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ PACIENTES ============
CREATE TABLE public.pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  idade INTEGER,
  endereco TEXT,
  cpf TEXT,
  rg TEXT,
  profissao TEXT,
  estado_civil TEXT,
  convenio TEXT,
  origem_lead TEXT,
  foto TEXT,
  historico_medico TEXT,
  alergias TEXT,
  medicamentos TEXT,
  observacoes TEXT,
  status TEXT DEFAULT 'Ativo',
  ultima_consulta TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pacientes select" ON public.pacientes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own pacientes insert" ON public.pacientes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own pacientes update" ON public.pacientes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own pacientes delete" ON public.pacientes FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_pacientes_updated BEFORE UPDATE ON public.pacientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CONSULTAS ============
CREATE TABLE public.consultas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE,
  paciente_nome TEXT,
  data DATE NOT NULL,
  hora TEXT,
  tipo TEXT,
  status TEXT DEFAULT 'Agendada',
  valor NUMERIC DEFAULT 0,
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.consultas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own consultas select" ON public.consultas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own consultas insert" ON public.consultas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own consultas update" ON public.consultas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own consultas delete" ON public.consultas FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_consultas_updated BEFORE UPDATE ON public.consultas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ TRANSACOES ============
CREATE TABLE public.transacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  descricao TEXT,
  valor NUMERIC NOT NULL DEFAULT 0,
  categoria TEXT,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
  paciente_nome TEXT,
  status TEXT DEFAULT 'Pago',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transacoes select" ON public.transacoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own transacoes insert" ON public.transacoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own transacoes update" ON public.transacoes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own transacoes delete" ON public.transacoes FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_transacoes_updated BEFORE UPDATE ON public.transacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PRONTUARIOS ============
CREATE TABLE public.prontuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE,
  paciente_nome TEXT,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  queixa_principal TEXT,
  diagnostico TEXT,
  tratamento TEXT,
  observacoes TEXT,
  odontograma JSONB,
  imagens JSONB,
  assinatura TEXT,
  procedimentos JSONB,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.prontuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prontuarios select" ON public.prontuarios FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own prontuarios insert" ON public.prontuarios FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own prontuarios update" ON public.prontuarios FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own prontuarios delete" ON public.prontuarios FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_prontuarios_updated BEFORE UPDATE ON public.prontuarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ANAMNESES ============
CREATE TABLE public.anamneses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE,
  paciente_nome TEXT,
  respostas JSONB,
  assinatura TEXT,
  status TEXT DEFAULT 'Pendente',
  link_assinatura TEXT,
  data_assinatura TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.anamneses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own anamneses select" ON public.anamneses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own anamneses insert" ON public.anamneses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own anamneses update" ON public.anamneses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own anamneses delete" ON public.anamneses FOR DELETE USING (auth.uid() = user_id);
-- Permite acesso público via link de assinatura (paciente assina sem login)
CREATE POLICY "public anamnese signing" ON public.anamneses FOR SELECT USING (link_assinatura IS NOT NULL);
CREATE POLICY "public anamnese update sign" ON public.anamneses FOR UPDATE USING (link_assinatura IS NOT NULL);
CREATE TRIGGER trg_anamneses_updated BEFORE UPDATE ON public.anamneses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ DOCUMENTOS_PACIENTE ============
CREATE TABLE public.documentos_paciente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT,
  url TEXT,
  tamanho INTEGER,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documentos_paciente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own docs select" ON public.documentos_paciente FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own docs insert" ON public.documentos_paciente FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own docs update" ON public.documentos_paciente FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own docs delete" ON public.documentos_paciente FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_docs_updated BEFORE UPDATE ON public.documentos_paciente FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PRODUTOS ============
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  categoria TEXT,
  quantidade INTEGER NOT NULL DEFAULT 0,
  minimo INTEGER NOT NULL DEFAULT 0,
  preco NUMERIC NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own produtos select" ON public.produtos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own produtos insert" ON public.produtos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own produtos update" ON public.produtos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own produtos delete" ON public.produtos FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_produtos_updated BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ NOTAS ============
CREATE TABLE public.notas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  conteudo TEXT,
  prazo DATE,
  lembrete_data TIMESTAMPTZ,
  lembrete_ativo BOOLEAN NOT NULL DEFAULT false,
  prioridade TEXT NOT NULL DEFAULT 'media',
  categoria TEXT NOT NULL DEFAULT 'geral',
  concluida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notas select" ON public.notas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own notas insert" ON public.notas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notas update" ON public.notas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own notas delete" ON public.notas FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_notas_updated BEFORE UPDATE ON public.notas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
