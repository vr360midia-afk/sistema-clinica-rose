
-- Adicionar novos campos à tabela notas
ALTER TABLE public.notas 
ADD COLUMN prazo DATE,
ADD COLUMN lembrete_data TIMESTAMP WITH TIME ZONE,
ADD COLUMN lembrete_ativo BOOLEAN DEFAULT false,
ADD COLUMN prioridade TEXT DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta')),
ADD COLUMN categoria TEXT DEFAULT 'geral',
ADD COLUMN concluida BOOLEAN DEFAULT false;
