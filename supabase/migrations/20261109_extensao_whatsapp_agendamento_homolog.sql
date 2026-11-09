-- ==============================================================================
-- MIGRATION: EXTENSÃO WHATSAPP WEB CRM & AGENDAMENTO SEGURO (HOMOLOGAÇÃO)
-- Data: 2026-11-09
-- Ambiente: EXCLUSIVO HOMOLOGAÇÃO (fsroaymkuopapwlnknhl)
-- Objetivo: Garantir tabelas equivalentes e função transacional atômica anti-concorrência
-- ==============================================================================

-- 1. Garante existência das tabelas crm_leads, dentistas, consultas, bloqueios_agenda em homologação
CREATE TABLE IF NOT EXISTS public.crm_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    telefone TEXT,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'Pendente',
    origem TEXT DEFAULT 'WhatsApp',
    campanha TEXT,
    observacoes TEXT,
    valor_estimado NUMERIC,
    data_criacao TIMESTAMPTZ DEFAULT now(),
    data_atualizacao TIMESTAMPTZ DEFAULT now(),
    phone TEXT,
    name TEXT,
    origin TEXT,
    stage TEXT
);

CREATE TABLE IF NOT EXISTS public.dentistas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    nome TEXT NOT NULL,
    cro TEXT,
    especialidade TEXT,
    telefone TEXT,
    email TEXT,
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT now(),
    atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.consultas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    paciente_id UUID,
    paciente_nome TEXT,
    data DATE NOT NULL,
    hora TEXT NOT NULL,
    duracao INTEGER DEFAULT 60,
    procedimento TEXT,
    status TEXT DEFAULT 'agendado',
    observacoes TEXT,
    valor NUMERIC,
    confirmacao_status TEXT DEFAULT 'pendente',
    confirmado_em TIMESTAMPTZ,
    dentista TEXT,
    tipo TEXT,
    criado_em TIMESTAMPTZ DEFAULT now(),
    atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bloqueios_agenda (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    titulo TEXT NOT NULL,
    dentista TEXT,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    hora_inicio TEXT,
    hora_fim TEXT,
    dia_inteiro BOOLEAN DEFAULT false,
    observacoes TEXT,
    criado_em TIMESTAMPTZ DEFAULT now(),
    atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- 2. Habilita RLS se ainda não habilitado
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dentistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloqueios_agenda ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS seguras para homologação
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_leads' AND policyname = 'crm_leads_auth_access') THEN
        CREATE POLICY crm_leads_auth_access ON public.crm_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dentistas' AND policyname = 'dentistas_auth_access') THEN
        CREATE POLICY dentistas_auth_access ON public.dentistas FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'consultas' AND policyname = 'consultas_auth_access') THEN
        CREATE POLICY consultas_auth_access ON public.consultas FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bloqueios_agenda' AND policyname = 'bloqueios_agenda_auth_access') THEN
        CREATE POLICY bloqueios_agenda_auth_access ON public.bloqueios_agenda FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 4. FUNÇÃO TRANSACIONAL ATÔMICA: AGENDAMENTO SEGURO ANTI-CONCORRÊNCIA
CREATE OR REPLACE FUNCTION public.agendar_consulta_extensao(
    p_paciente_id UUID,
    p_data DATE,
    p_hora TEXT,
    p_duracao INTEGER,
    p_dentista TEXT,
    p_procedimento TEXT,
    p_observacoes TEXT DEFAULT NULL,
    p_lead_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_clinica_id UUID;
    v_paciente_nome TEXT;
    v_hora_inicio_min INTEGER;
    v_hora_fim_min INTEGER;
    v_conflito RECORD;
    v_bloqueio RECORD;
    v_nova_consulta_id UUID;
    v_permissoes JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    -- Obtém clinica_id e valida permissões
    SELECT COALESCE(
        (SELECT clinica_id FROM public.equipe WHERE usuario_id = v_user_id LIMIT 1),
        v_user_id
    ) INTO v_clinica_id;

    -- Verifica se é membro de equipe e se possui permissão de agenda
    SELECT permissoes FROM public.equipe WHERE usuario_id = v_user_id LIMIT 1 INTO v_permissoes;
    IF v_permissoes IS NOT NULL AND (v_permissoes->>'agenda')::boolean = false THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não possui permissão para gerenciar agenda.';
    END IF;

    -- Localiza o paciente
    SELECT nome FROM public.pacientes WHERE id = p_paciente_id INTO v_paciente_nome;
    IF v_paciente_nome IS NULL THEN
        RAISE EXCEPTION 'Paciente não localizado para agendamento.';
    END IF;

    -- Converte horários para minutos do dia
    v_hora_inicio_min := (split_part(p_hora, ':', 1)::integer * 60) + split_part(p_hora, ':', 2)::integer;
    v_hora_fim_min := v_hora_inicio_min + COALESCE(p_duracao, 60);

    -- =========================================================================
    -- TRAVA TRANSACIONAL ATÔMICA (ADVISORY LOCK POR DENTISTA E DATA)
    -- Impede estritamente que duas transações concorrentes tentem alocar o mesmo profissional
    -- na mesma data simultaneamente, garantindo serialização estrita sem deadlocks
    -- =========================================================================
    PERFORM pg_advisory_xact_lock(hashtext(COALESCE(p_dentista, 'geral') || '_' || p_data::text));

    -- 1. Verifica bloqueios de agenda existentes para o dentista e data
    FOR v_bloqueio IN
        SELECT titulo, hora_inicio, hora_fim, dia_inteiro
        FROM public.bloqueios_agenda
        WHERE data_inicio <= p_data AND data_fim >= p_data
          AND (dentista IS NULL OR dentista = '' OR dentista = p_dentista)
    LOOP
        IF v_bloqueio.dia_inteiro THEN
            RAISE EXCEPTION 'Horário bloqueado na agenda: % (dia inteiro)', v_bloqueio.titulo;
        END IF;

        IF v_bloqueio.hora_inicio IS NOT NULL AND v_bloqueio.hora_fim IS NOT NULL THEN
            DECLARE
                b_inicio_min INTEGER := (split_part(v_bloqueio.hora_inicio, ':', 1)::integer * 60) + split_part(v_bloqueio.hora_inicio, ':', 2)::integer;
                b_fim_min INTEGER := (split_part(v_bloqueio.hora_fim, ':', 1)::integer * 60) + split_part(v_bloqueio.hora_fim, ':', 2)::integer;
            BEGIN
                IF v_hora_inicio_min < b_fim_min AND b_inicio_min < v_hora_fim_min THEN
                    RAISE EXCEPTION 'Horário bloqueado na agenda: % (% às %)', v_bloqueio.titulo, v_bloqueio.hora_inicio, v_bloqueio.hora_fim;
                END IF;
            END;
        END IF;
    END LOOP;

    -- 2. Verifica conflito com consultas já existentes (exceto canceladas e remarcadas)
    FOR v_conflito IN
        SELECT hora, duracao, paciente_nome
        FROM public.consultas
        WHERE data = p_data
          AND dentista = p_dentista
          AND status NOT IN ('cancelado', 'remarcado')
    LOOP
        DECLARE
            c_inicio_min INTEGER := (split_part(v_conflito.hora, ':', 1)::integer * 60) + split_part(v_conflito.hora, ':', 2)::integer;
            c_fim_min INTEGER := c_inicio_min + COALESCE(v_conflito.duracao, 60);
        BEGIN
            IF v_hora_inicio_min < c_fim_min AND c_inicio_min < v_hora_fim_min THEN
                RAISE EXCEPTION 'Conflito de horário: % já tem consulta às % (% min) com %',
                    p_dentista, v_conflito.hora, COALESCE(v_conflito.duracao, 60), COALESCE(v_conflito.paciente_nome, 'outro paciente');
            END IF;
        END;
    END LOOP;

    -- 3. Insere a consulta atômica
    INSERT INTO public.consultas (
        user_id,
        paciente_id,
        paciente_nome,
        data,
        hora,
        duracao,
        procedimento,
        dentista,
        status,
        confirmacao_status,
        observacoes,
        criado_em,
        atualizado_em
    ) VALUES (
        v_clinica_id,
        p_paciente_id,
        v_paciente_nome,
        p_data,
        p_hora,
        COALESCE(p_duracao, 60),
        COALESCE(p_procedimento, 'Avaliação Odontológica'),
        p_dentista,
        'agendado',
        'pendente',
        p_observacoes,
        now(),
        now()
    ) RETURNING id INTO v_nova_consulta_id;

    -- 4. Se houver lead associado, atualiza o status para Agendado
    IF p_lead_id IS NOT NULL THEN
        UPDATE public.crm_leads
        SET status = 'Agendado',
            observacoes = CASE
                WHEN observacoes IS NULL OR observacoes = '' THEN
                    '[Agendamento Extensão]: ' || to_char(p_data, 'DD/MM/YYYY') || ' às ' || p_hora || ' com ' || p_dentista
                ELSE
                    observacoes || E'\n[Agendamento Extensão]: ' || to_char(p_data, 'DD/MM/YYYY') || ' às ' || p_hora || ' com ' || p_dentista
            END,
            data_atualizacao = now()
        WHERE id = p_lead_id;
    END IF;

    -- Retorna resultado estruturado
    RETURN jsonb_build_object(
        'sucesso', true,
        'consulta_id', v_nova_consulta_id,
        'paciente_id', p_paciente_id,
        'paciente_nome', v_paciente_nome,
        'data', p_data,
        'hora', p_hora,
        'duracao', COALESCE(p_duracao, 60),
        'dentista', p_dentista,
        'procedimento', p_procedimento,
        'status', 'agendado'
    );
END;
$$;
