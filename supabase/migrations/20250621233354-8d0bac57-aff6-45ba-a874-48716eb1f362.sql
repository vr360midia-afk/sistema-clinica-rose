
-- Adicionar os novos campos à tabela notas que estão faltando
ALTER TABLE public.notas 
ADD COLUMN IF NOT EXISTS prazo DATE,
ADD COLUMN IF NOT EXISTS lembrete_data TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS lembrete_ativo BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS prioridade TEXT DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta')),
ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'geral',
ADD COLUMN IF NOT EXISTS concluida BOOLEAN DEFAULT false;

-- Adicionar trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_notas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Criar o trigger se não existir
DROP TRIGGER IF EXISTS update_notas_updated_at ON public.notas;
CREATE TRIGGER update_notas_updated_at
    BEFORE UPDATE ON public.notas
    FOR EACH ROW
    EXECUTE FUNCTION update_notas_updated_at();

-- Adicionar políticas RLS para as notas se ainda não existirem
ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Users can view their own notes" ON public.notas;
DROP POLICY IF EXISTS "Users can create their own notes" ON public.notas;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notas;
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notas;

-- Criar políticas RLS
CREATE POLICY "Users can view their own notes" 
    ON public.notas 
    FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notes" 
    ON public.notas 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes" 
    ON public.notas 
    FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes" 
    ON public.notas 
    FOR DELETE 
    USING (auth.uid() = user_id);
