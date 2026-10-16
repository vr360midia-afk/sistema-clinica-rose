-- ==============================================================================
-- MIGRATION: Tabela de Tarefas Internas e Follow-up da Clínica
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.tarefas_internas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    clinica_id UUID,
    titulo TEXT NOT NULL,
    descricao TEXT,
    tipo TEXT NOT NULL DEFAULT 'geral', -- 'chamar_lead', 'followup_orcamento', 'confirmar_paciente', 'pos_operatorio', 'laboratorio', 'financeiro', 'geral'
    prioridade TEXT NOT NULL DEFAULT 'media', -- 'baixa', 'media', 'alta'
    status TEXT NOT NULL DEFAULT 'pendente', -- 'pendente', 'em_andamento', 'concluida'
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    hora TIME WITHOUT TIME ZONE,
    responsavel TEXT,
    
    -- Vínculo com Leads do CRM
    lead_id UUID REFERENCES public.crm_leads(id) ON DELETE SET NULL,
    lead_nome TEXT,
    lead_telefone TEXT,
    
    -- Vínculo com Pacientes
    paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
    paciente_nome TEXT,
    paciente_telefone TEXT,
    
    concluida_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_tarefas_internas_data ON public.tarefas_internas(data);
CREATE INDEX IF NOT EXISTS idx_tarefas_internas_status ON public.tarefas_internas(status);
CREATE INDEX IF NOT EXISTS idx_tarefas_internas_tipo ON public.tarefas_internas(tipo);
CREATE INDEX IF NOT EXISTS idx_tarefas_internas_user ON public.tarefas_internas(user_id);

-- RLS (Row Level Security)
ALTER TABLE public.tarefas_internas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tarefas Internas RLS" ON public.tarefas_internas;
CREATE POLICY "Tarefas Internas RLS" ON public.tarefas_internas 
FOR ALL USING (
    auth.uid() = user_id OR 
    (SELECT public.clinica_id()) = user_id OR
    (SELECT public.clinica_id()) = clinica_id
);
