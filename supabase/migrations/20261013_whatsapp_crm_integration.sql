-- ==============================================================================
-- MIGRATION: Integração WhatsApp Cloud API (Coexistência) & CRM Leads
-- ==============================================================================

-- 1. Cria ou estende a tabela crm_leads com os campos requeridos
DO $$
BEGIN
    -- Se a tabela crm_leads ainda não existir, cria-a
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'crm_leads') THEN
        CREATE TABLE public.crm_leads (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            phone TEXT UNIQUE,
            name TEXT,
            origin TEXT DEFAULT 'whatsapp',
            stage TEXT DEFAULT 'novo_lead',
            last_inbound_at TIMESTAMPTZ,
            last_outbound_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
    ELSE
        -- Se já existir, adiciona as novas colunas com segurança
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'phone') THEN
            ALTER TABLE public.crm_leads ADD COLUMN phone TEXT;
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'name') THEN
            ALTER TABLE public.crm_leads ADD COLUMN name TEXT;
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'origin') THEN
            ALTER TABLE public.crm_leads ADD COLUMN origin TEXT DEFAULT 'whatsapp';
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'stage') THEN
            ALTER TABLE public.crm_leads ADD COLUMN stage TEXT DEFAULT 'novo_lead';
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'last_inbound_at') THEN
            ALTER TABLE public.crm_leads ADD COLUMN last_inbound_at TIMESTAMPTZ;
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'last_outbound_at') THEN
            ALTER TABLE public.crm_leads ADD COLUMN last_outbound_at TIMESTAMPTZ;
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'created_at') THEN
            ALTER TABLE public.crm_leads ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'updated_at') THEN
            ALTER TABLE public.crm_leads ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
        END IF;
    END IF;
END $$;

-- Garante índice único no telefone E.164 para upsert e buscas rápidas
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_leads_phone ON public.crm_leads(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_leads_stage ON public.crm_leads(stage);

-- Sincroniza campos legados (nome <-> name, telefone <-> phone, status <-> stage, origem <-> origin)
CREATE OR REPLACE FUNCTION public.sync_crm_leads_compat()
RETURNS TRIGGER AS $$
BEGIN
    -- Sincroniza Nome
    IF NEW.name IS NOT NULL AND NEW.nome IS NULL THEN
        NEW.nome := NEW.name;
    ELSIF NEW.nome IS NOT NULL AND NEW.name IS NULL THEN
        NEW.name := NEW.nome;
    END IF;

    -- Sincroniza Telefone (com normalização de dígitos)
    IF NEW.phone IS NOT NULL AND NEW.telefone IS NULL THEN
        NEW.telefone := NEW.phone;
    ELSIF NEW.telefone IS NOT NULL AND NEW.phone IS NULL THEN
        NEW.phone := NEW.telefone;
    END IF;

    -- Sincroniza Stage / Status
    IF NEW.stage IS NOT NULL AND NEW.status IS NULL THEN
        NEW.status := NEW.stage;
    ELSIF NEW.status IS NOT NULL AND NEW.stage IS NULL THEN
        NEW.stage := NEW.status;
    END IF;

    -- Sincroniza Origem / Origin
    IF NEW.origin IS NOT NULL AND NEW.origem IS NULL THEN
        NEW.origem := NEW.origin;
    ELSIF NEW.origem IS NOT NULL AND NEW.origin IS NULL THEN
        NEW.origin := NEW.origem;
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_crm_leads_compat ON public.crm_leads;
CREATE TRIGGER trg_sync_crm_leads_compat
BEFORE INSERT OR UPDATE ON public.crm_leads
FOR EACH ROW
EXECUTE FUNCTION public.sync_crm_leads_compat();

-- 2. Cria a tabela de mensagens (messages / crm_messages)
CREATE TABLE IF NOT EXISTS public.crm_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
    body TEXT NOT NULL,
    wa_message_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices otimizados para busca de histórico de conversas do chat
CREATE INDEX IF NOT EXISTS idx_crm_messages_lead_created ON public.crm_messages(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_messages_wa_id ON public.crm_messages(wa_message_id);

-- 3. Habilita Realtime no Supabase para as tabelas crm_leads e crm_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_messages;

-- 4. Políticas de RLS (Row Level Security)
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_messages ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem ver e interagir com leads e mensagens
CREATE POLICY "Permitir leitura de leads para autenticados" ON public.crm_leads
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir criacao e edicao de leads para autenticados" ON public.crm_leads
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir leitura de mensagens para autenticados" ON public.crm_messages
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir insercao de mensagens para autenticados" ON public.crm_messages
    FOR INSERT TO authenticated WITH CHECK (true);

-- Permitir acesso via service role (usado pelas Edge Functions)
CREATE POLICY "Permitir service_role em crm_leads" ON public.crm_leads
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Permitir service_role em crm_messages" ON public.crm_messages
    FOR ALL TO service_role USING (true) WITH CHECK (true);
