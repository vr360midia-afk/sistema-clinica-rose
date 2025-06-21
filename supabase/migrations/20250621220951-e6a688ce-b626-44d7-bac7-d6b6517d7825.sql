
-- Criar tabelas para o sistema odontológico

-- Tabela de pacientes
CREATE TABLE public.pacientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT NOT NULL,
  idade INTEGER NOT NULL DEFAULT 0,
  foto TEXT,
  convenio TEXT NOT NULL,
  origem_lead TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Ativo',
  ultima_consulta TIMESTAMP WITH TIME ZONE,
  proxima_consulta TIMESTAMP WITH TIME ZONE,
  historico_medico TEXT,
  alergias TEXT,
  medicamentos TEXT,
  observacoes TEXT,
  endereco TEXT,
  cpf TEXT,
  rg TEXT,
  profissao TEXT,
  estado_civil TEXT,
  data_arquivamento TIMESTAMP WITH TIME ZONE,
  motivo_arquivamento TEXT,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de consultas
CREATE TABLE public.consultas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE NOT NULL,
  data TIMESTAMP WITH TIME ZONE NOT NULL,
  hora TEXT NOT NULL,
  duracao INTEGER NOT NULL,
  procedimento TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'agendado',
  dentista TEXT NOT NULL,
  observacoes TEXT,
  valor NUMERIC(10,2),
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de transações financeiras
CREATE TABLE public.transacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE NOT NULL,
  consulta_id UUID REFERENCES public.consultas(id) ON DELETE SET NULL,
  valor NUMERIC(10,2) NOT NULL,
  tipo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  metodo_pagamento TEXT NOT NULL,
  data TIMESTAMP WITH TIME ZONE NOT NULL,
  vencimento TIMESTAMP WITH TIME ZONE,
  descricao TEXT NOT NULL,
  observacoes TEXT,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de prontuários
CREATE TABLE public.prontuarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE NOT NULL,
  consulta_id UUID REFERENCES public.consultas(id) ON DELETE SET NULL,
  data TIMESTAMP WITH TIME ZONE NOT NULL,
  queixa_principal TEXT NOT NULL,
  historia_doenca TEXT NOT NULL,
  exame_clinico TEXT NOT NULL,
  diagnostico TEXT,
  plano_tratamento TEXT,
  procedimentos_realizados JSONB DEFAULT '[]'::jsonb,
  observacoes TEXT,
  anexos JSONB DEFAULT '[]'::jsonb,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de anamneses
CREATE TABLE public.anamneses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE NOT NULL,
  data TIMESTAMP WITH TIME ZONE NOT NULL,
  queixa_principal TEXT NOT NULL,
  historia_atual TEXT NOT NULL,
  historia_familiar TEXT,
  historia_medica TEXT,
  alergias TEXT,
  medicamentos TEXT,
  habitos_vicios_positivos TEXT,
  habitos_vicios_negativos TEXT,
  exame_extra_bucal TEXT,
  exame_intra_bucal TEXT,
  observacoes TEXT,
  anexos JSONB DEFAULT '[]'::jsonb,
  assinatura_paciente JSONB,
  assinatura_doutor JSONB,
  link_assinatura TEXT,
  token_assinatura TEXT,
  status_assinatura TEXT NOT NULL DEFAULT 'pendente',
  data_expiracao_link TIMESTAMP WITH TIME ZONE,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de documentos dos pacientes
CREATE TABLE public.documentos_paciente (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL,
  nome TEXT NOT NULL,
  arquivo TEXT NOT NULL,
  tamanho INTEGER,
  descricao TEXT,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de produtos (estoque)
CREATE TABLE public.produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0,
  minimo INTEGER NOT NULL DEFAULT 0,
  preco NUMERIC(10,2) NOT NULL DEFAULT 0,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS para todas as tabelas
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prontuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anamneses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_paciente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para pacientes
CREATE POLICY "Users can view their own pacientes" ON public.pacientes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own pacientes" ON public.pacientes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own pacientes" ON public.pacientes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own pacientes" ON public.pacientes FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para consultas
CREATE POLICY "Users can view their own consultas" ON public.consultas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own consultas" ON public.consultas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own consultas" ON public.consultas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own consultas" ON public.consultas FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para transações
CREATE POLICY "Users can view their own transacoes" ON public.transacoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own transacoes" ON public.transacoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own transacoes" ON public.transacoes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own transacoes" ON public.transacoes FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para prontuários
CREATE POLICY "Users can view their own prontuarios" ON public.prontuarios FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own prontuarios" ON public.prontuarios FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own prontuarios" ON public.prontuarios FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own prontuarios" ON public.prontuarios FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para anamneses
CREATE POLICY "Users can view their own anamneses" ON public.anamneses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own anamneses" ON public.anamneses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own anamneses" ON public.anamneses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own anamneses" ON public.anamneses FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para documentos
CREATE POLICY "Users can view their own documentos" ON public.documentos_paciente FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own documentos" ON public.documentos_paciente FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own documentos" ON public.documentos_paciente FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own documentos" ON public.documentos_paciente FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para produtos
CREATE POLICY "Users can view their own produtos" ON public.produtos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own produtos" ON public.produtos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own produtos" ON public.produtos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own produtos" ON public.produtos FOR DELETE USING (auth.uid() = user_id);

-- Índices para melhor performance
CREATE INDEX idx_pacientes_user_id ON public.pacientes(user_id);
CREATE INDEX idx_pacientes_status ON public.pacientes(status);
CREATE INDEX idx_consultas_user_id ON public.consultas(user_id);
CREATE INDEX idx_consultas_paciente_id ON public.consultas(paciente_id);
CREATE INDEX idx_consultas_data ON public.consultas(data);
CREATE INDEX idx_transacoes_user_id ON public.transacoes(user_id);
CREATE INDEX idx_transacoes_paciente_id ON public.transacoes(paciente_id);
CREATE INDEX idx_transacoes_data ON public.transacoes(data);
CREATE INDEX idx_prontuarios_user_id ON public.prontuarios(user_id);
CREATE INDEX idx_prontuarios_paciente_id ON public.prontuarios(paciente_id);
CREATE INDEX idx_anamneses_user_id ON public.anamneses(user_id);
CREATE INDEX idx_anamneses_paciente_id ON public.anamneses(paciente_id);
CREATE INDEX idx_documentos_user_id ON public.documentos_paciente(user_id);
CREATE INDEX idx_documentos_paciente_id ON public.documentos_paciente(paciente_id);
CREATE INDEX idx_produtos_user_id ON public.produtos(user_id);

-- Triggers para atualizar automaticamente o campo atualizado_em
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pacientes_updated_at BEFORE UPDATE ON public.pacientes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_consultas_updated_at BEFORE UPDATE ON public.consultas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transacoes_updated_at BEFORE UPDATE ON public.transacoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_prontuarios_updated_at BEFORE UPDATE ON public.prontuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_anamneses_updated_at BEFORE UPDATE ON public.anamneses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documentos_updated_at BEFORE UPDATE ON public.documentos_paciente FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_produtos_updated_at BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
