-- ==============================================================================
-- MIGRATION: Módulo Novos Leads & Meta Lead Ads
-- ==============================================================================

-- 1. Garante que as colunas necessárias existam na tabela crm_leads
DO $$
BEGIN
    -- Identificadores da Meta
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'meta_lead_id') THEN
        ALTER TABLE public.crm_leads ADD COLUMN meta_lead_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'form_id') THEN
        ALTER TABLE public.crm_leads ADD COLUMN form_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'ad_id') THEN
        ALTER TABLE public.crm_leads ADD COLUMN ad_id TEXT;
    END IF;

    -- Respostas completas do formulário (JSONB)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'respostas') THEN
        ALTER TABLE public.crm_leads ADD COLUMN respostas JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- Prioridade ('alta', 'media', 'baixa')
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'prioridade') THEN
        ALTER TABLE public.crm_leads ADD COLUMN prioridade TEXT DEFAULT 'media';
    END IF;

    -- Revisão de lead
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'revisado') THEN
        ALTER TABLE public.crm_leads ADD COLUMN revisado BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'revisado_em') THEN
        ALTER TABLE public.crm_leads ADD COLUMN revisado_em TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'revisado_por') THEN
        ALTER TABLE public.crm_leads ADD COLUMN revisado_por TEXT;
    END IF;

    -- Status Convertido e Perdido
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'valor_venda') THEN
        ALTER TABLE public.crm_leads ADD COLUMN valor_venda NUMERIC;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'motivo_perda') THEN
        ALTER TABLE public.crm_leads ADD COLUMN motivo_perda TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'arquivado') THEN
        ALTER TABLE public.crm_leads ADD COLUMN arquivado BOOLEAN DEFAULT false;
    END IF;

    -- Agendamento e alertas
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'agendado_para') THEN
        ALTER TABLE public.crm_leads ADD COLUMN agendado_para TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'alertas_agendamento') THEN
        ALTER TABLE public.crm_leads ADD COLUMN alertas_agendamento JSONB DEFAULT '{"h72": true, "h48": true, "h24": true, "h3": true}'::jsonb;
    END IF;

    -- Régua de Follow-ups (3h, 15h, 24h, 3d, 4d, 6d, 8d, 15d, 30d)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'follow_ups') THEN
        ALTER TABLE public.crm_leads ADD COLUMN follow_ups JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- Vínculo com paciente convertido
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'paciente_id') THEN
        ALTER TABLE public.crm_leads ADD COLUMN paciente_id UUID;
    END IF;
END $$;

-- Índice para deduplicação rápida de leads Meta
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_leads_meta_lead_id 
ON public.crm_leads(meta_lead_id) 
WHERE meta_lead_id IS NOT NULL;

-- Índice para busca de não revisados
CREATE INDEX IF NOT EXISTS idx_crm_leads_revisado ON public.crm_leads(revisado);
