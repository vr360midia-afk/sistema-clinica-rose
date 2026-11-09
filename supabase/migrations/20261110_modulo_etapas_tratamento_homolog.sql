-- ==============================================================================
-- MIGRATION: MÓDULO ETAPAS DO TRATAMENTO E CONFIRMAÇÃO DIGITAL
-- Ambiente: HOMOLOGAÇÃO (fsroaymkuopapwlnknhl)
-- Data: 2026-11-10
-- Tabelas: tratamentos_procedimentos, tratamento_sessoes, 
--          tratamento_confirmacoes, tratamento_historico_alteracoes
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. TABELA DE PROCEDIMENTOS DO TRATAMENTO
CREATE TABLE IF NOT EXISTS public.tratamentos_procedimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    clinica_id UUID NOT NULL,
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE RESTRICT,
    contrato_id TEXT,
    procedimento_nome TEXT NOT NULL,
    procedimento_id UUID,
    item_orcamento_index INTEGER NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 1 CHECK (quantidade >= 1),
    valor_aprovado NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (valor_aprovado >= 0),
    status TEXT NOT NULL DEFAULT 'nao_iniciado' 
        CHECK (status IN ('nao_iniciado', 'em_tratamento', 'pausado', 'concluido', 'cancelado')),
    justificativa_cancelamento TEXT,
    profissional_responsavel_id UUID,
    profissional_responsavel_nome TEXT,
    data_inicio DATE,
    data_conclusao DATE,
    termo_conclusao_id UUID,
    observacoes TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tratamento_orcamento_item UNIQUE (orcamento_id, item_orcamento_index)
);

-- 2. TABELA DE SESSÕES ILIMITADAS POR PROCEDIMENTO
CREATE TABLE IF NOT EXISTS public.tratamento_sessoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tratamento_procedimento_id UUID NOT NULL REFERENCES public.tratamentos_procedimentos(id) ON DELETE CASCADE,
    clinica_id UUID NOT NULL,
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    numero_sessao INTEGER NOT NULL CHECK (numero_sessao >= 1),
    nome_objetivo TEXT NOT NULL,
    data_prevista DATE,
    data_realizada DATE,
    hora_realizada TEXT,
    profissional_id UUID,
    profissional_nome TEXT NOT NULL,
    descricao_atos TEXT,
    observacoes_clinicas TEXT,
    status TEXT NOT NULL DEFAULT 'prevista' 
        CHECK (status IN ('prevista', 'agendada', 'realizada', 'aguardando_confirmacao', 'confirmada', 'cancelada')),
    justificativa_cancelamento TEXT,
    consulta_id UUID REFERENCES public.consultas(id) ON DELETE SET NULL,
    anexos JSONB NOT NULL DEFAULT '[]'::jsonb,
    data_prevista_anterior DATE,
    motivo_reagendamento TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    concluido_em TIMESTAMPTZ,
    CONSTRAINT uq_tratamento_sessao_numero UNIQUE (tratamento_procedimento_id, numero_sessao)
);

-- 3. TABELA DE CONFIRMAÇÕES DIGITAIS DO PACIENTE
CREATE TABLE IF NOT EXISTS public.tratamento_confirmacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sessao_id UUID NOT NULL REFERENCES public.tratamento_sessoes(id) ON DELETE CASCADE,
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    clinica_id UUID NOT NULL,
    token TEXT NOT NULL UNIQUE,
    token_expira_em TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' 
        CHECK (status IN ('pendente', 'confirmado', 'recusado', 'expirado')),
    declaracao_texto TEXT NOT NULL,
    observacoes_paciente TEXT,
    concorda_realizacao BOOLEAN,
    assinatura_base64 TEXT,
    assinante_nome TEXT,
    assinante_cpf TEXT,
    ip_origem TEXT,
    user_agent TEXT,
    assinado_em TIMESTAMPTZ,
    hash_integridade TEXT,
    documento_clinico_id UUID,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. TABELA DE HISTÓRICO E AUDITORIA CRONOLÓGICA
CREATE TABLE IF NOT EXISTS public.tratamento_historico_alteracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tratamento_procedimento_id UUID REFERENCES public.tratamentos_procedimentos(id) ON DELETE CASCADE,
    sessao_id UUID REFERENCES public.tratamento_sessoes(id) ON DELETE CASCADE,
    clinica_id UUID NOT NULL,
    usuario_id UUID NOT NULL,
    usuario_nome TEXT,
    acao TEXT NOT NULL,
    dados_anteriores JSONB,
    dados_novos JSONB,
    justificativa TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. ÍNDICES DE PERFORMANCE E INTEGRIDADE
CREATE INDEX IF NOT EXISTS idx_trat_proc_paciente ON public.tratamentos_procedimentos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_trat_proc_orcamento ON public.tratamentos_procedimentos(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_trat_proc_clinica ON public.tratamentos_procedimentos(clinica_id);
CREATE INDEX IF NOT EXISTS idx_trat_proc_status ON public.tratamentos_procedimentos(status);

CREATE INDEX IF NOT EXISTS idx_trat_sess_proc ON public.tratamento_sessoes(tratamento_procedimento_id);
CREATE INDEX IF NOT EXISTS idx_trat_sess_paciente ON public.tratamento_sessoes(paciente_id);
CREATE INDEX IF NOT EXISTS idx_trat_sess_status ON public.tratamento_sessoes(status);
CREATE INDEX IF NOT EXISTS idx_trat_sess_data_prev ON public.tratamento_sessoes(data_prevista);
CREATE INDEX IF NOT EXISTS idx_trat_sess_consulta ON public.tratamento_sessoes(consulta_id);

CREATE INDEX IF NOT EXISTS idx_trat_conf_token ON public.tratamento_confirmacoes(token);
CREATE INDEX IF NOT EXISTS idx_trat_conf_sessao ON public.tratamento_confirmacoes(sessao_id);
CREATE INDEX IF NOT EXISTS idx_trat_conf_status ON public.tratamento_confirmacoes(status);

CREATE INDEX IF NOT EXISTS idx_trat_hist_proc ON public.tratamento_historico_alteracoes(tratamento_procedimento_id);
CREATE INDEX IF NOT EXISTS idx_trat_hist_sess ON public.tratamento_historico_alteracoes(sessao_id);

-- 6. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.tratamentos_procedimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tratamento_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tratamento_confirmacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tratamento_historico_alteracoes ENABLE ROW LEVEL SECURITY;

-- 7. POLÍTICAS RLS COM ISOLAMENTO MULTI-TENANT E PERMISSÕES DE EQUIPE
DO $$
BEGIN
    -- tratamentos_procedimentos
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tratamentos_procedimentos' AND policyname = 'Tratamentos Procedimentos RLS') THEN
        CREATE POLICY "Tratamentos Procedimentos RLS" ON public.tratamentos_procedimentos
            FOR ALL
            USING (
                clinica_id IN (
                    SELECT COALESCE(e.clinica_id, auth.uid())
                    FROM public.equipe e
                    WHERE e.usuario_id = auth.uid()
                    UNION
                    SELECT auth.uid()
                )
            )
            WITH CHECK (
                clinica_id IN (
                    SELECT COALESCE(e.clinica_id, auth.uid())
                    FROM public.equipe e
                    WHERE e.usuario_id = auth.uid()
                    UNION
                    SELECT auth.uid()
                )
            );
    END IF;

    -- tratamento_sessoes
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tratamento_sessoes' AND policyname = 'Tratamento Sessoes RLS') THEN
        CREATE POLICY "Tratamento Sessoes RLS" ON public.tratamento_sessoes
            FOR ALL
            USING (
                clinica_id IN (
                    SELECT COALESCE(e.clinica_id, auth.uid())
                    FROM public.equipe e
                    WHERE e.usuario_id = auth.uid()
                    UNION
                    SELECT auth.uid()
                )
            )
            WITH CHECK (
                clinica_id IN (
                    SELECT COALESCE(e.clinica_id, auth.uid())
                    FROM public.equipe e
                    WHERE e.usuario_id = auth.uid()
                    UNION
                    SELECT auth.uid()
                )
            );
    END IF;

    -- tratamento_confirmacoes
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tratamento_confirmacoes' AND policyname = 'Tratamento Confirmacoes RLS') THEN
        CREATE POLICY "Tratamento Confirmacoes RLS" ON public.tratamento_confirmacoes
            FOR ALL
            USING (
                clinica_id IN (
                    SELECT COALESCE(e.clinica_id, auth.uid())
                    FROM public.equipe e
                    WHERE e.usuario_id = auth.uid()
                    UNION
                    SELECT auth.uid()
                )
            )
            WITH CHECK (
                clinica_id IN (
                    SELECT COALESCE(e.clinica_id, auth.uid())
                    FROM public.equipe e
                    WHERE e.usuario_id = auth.uid()
                    UNION
                    SELECT auth.uid()
                )
            );
    END IF;

    -- tratamento_historico_alteracoes
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tratamento_historico_alteracoes' AND policyname = 'Tratamento Historico RLS') THEN
        CREATE POLICY "Tratamento Historico RLS" ON public.tratamento_historico_alteracoes
            FOR ALL
            USING (
                clinica_id IN (
                    SELECT COALESCE(e.clinica_id, auth.uid())
                    FROM public.equipe e
                    WHERE e.usuario_id = auth.uid()
                    UNION
                    SELECT auth.uid()
                )
            )
            WITH CHECK (
                clinica_id IN (
                    SELECT COALESCE(e.clinica_id, auth.uid())
                    FROM public.equipe e
                    WHERE e.usuario_id = auth.uid()
                    UNION
                    SELECT auth.uid()
                )
            );
    END IF;
END $$;

-- 8. FUNÇÃO RPC: SINCRONIZAÇÃO IDEMPOTENTE DE PROCEDIMENTOS APROVADOS
CREATE OR REPLACE FUNCTION public.sincronizar_procedimentos_orcamento(
    p_orcamento_id UUID,
    p_usuario_id UUID,
    p_usuario_nome TEXT DEFAULT 'Profissional'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_orc RECORD;
    v_item RECORD;
    v_idx INTEGER := 0;
    v_importados INTEGER := 0;
    v_ignorados INTEGER := 0;
    v_nome_item TEXT;
    v_valor_item NUMERIC;
    v_qtd_item INTEGER;
    v_proc_id UUID;
    v_clinica_id UUID;
    v_novo_id UUID;
    v_eh_financeiro BOOLEAN;
BEGIN
    -- 1. Busca o orçamento aprovado
    SELECT id, user_id, paciente_id, contrato_id, status, itens
    INTO v_orc
    FROM public.orcamentos
    WHERE id = p_orcamento_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Orçamento não localizado: %', p_orcamento_id;
    END IF;

    IF v_orc.status <> 'aprovado' THEN
        RAISE EXCEPTION 'Apenas orçamentos aprovados geram etapas de tratamento. Status atual: %', v_orc.status;
    END IF;

    -- Identifica clinica_id (user titular ou via equipe)
    SELECT COALESCE(e.clinica_id, v_orc.user_id) INTO v_clinica_id
    FROM public.equipe e
    WHERE e.usuario_id = p_usuario_id;
    IF v_clinica_id IS NULL THEN
        v_clinica_id := v_orc.user_id;
    END IF;

    -- 2. Varre cada item do array JSONB itens
    FOR v_item IN SELECT * FROM jsonb_to_recordset(v_orc.itens) AS x(
        nome TEXT,
        quantidade NUMERIC,
        valor NUMERIC,
        procedimento_id UUID
    )
    LOOP
        v_idx := v_idx + 1;
        v_nome_item := COALESCE(TRIM(v_item.nome), '');
        v_valor_item := COALESCE(v_item.valor, 0);
        v_qtd_item := GREATEST(COALESCE(v_item.quantidade::INTEGER, 1), 1);
        v_proc_id := v_item.procedimento_id;

        -- Regra de Filtro Inteligente: ignora taxas financeiras, cartão, juros, maquininha e descontos
        v_eh_financeiro := (
            v_nome_item ~* '^(taxa|juros|acréscimo|acrescimo|desconto|maquininha|máquina|maquina|parcelamento|cartão|cartao|ajuste\s+financeiro|tarifa|estorno)'
            OR v_valor_item <= 0
        );

        IF v_eh_financeiro THEN
            v_ignorados := v_ignorados + 1;
            CONTINUE;
        END IF;

        -- 3. Insere ou ignora caso já exista (idempotência via uq_tratamento_orcamento_item)
        INSERT INTO public.tratamentos_procedimentos (
            user_id,
            clinica_id,
            paciente_id,
            orcamento_id,
            contrato_id,
            procedimento_nome,
            procedimento_id,
            item_orcamento_index,
            quantidade,
            valor_aprovado,
            status,
            criado_em,
            atualizado_em
        ) VALUES (
            p_usuario_id,
            v_clinica_id,
            v_orc.paciente_id,
            v_orc.id,
            v_orc.contrato_id,
            v_nome_item,
            v_proc_id,
            v_idx,
            v_qtd_item,
            v_valor_item,
            'nao_iniciado',
            now(),
            now()
        )
        ON CONFLICT (orcamento_id, item_orcamento_index) DO NOTHING
        RETURNING id INTO v_novo_id;

        IF v_novo_id IS NOT NULL THEN
            v_importados := v_importados + 1;

            -- Registra auditoria da importação
            INSERT INTO public.tratamento_historico_alteracoes (
                tratamento_procedimento_id,
                clinica_id,
                usuario_id,
                usuario_nome,
                acao,
                dados_novos,
                justificativa
            ) VALUES (
                v_novo_id,
                v_clinica_id,
                p_usuario_id,
                p_usuario_nome,
                'PROCEDIMENTO_IMPORTADO',
                jsonb_build_object(
                    'procedimento_nome', v_nome_item,
                    'valor_aprovado', v_valor_item,
                    'item_orcamento_index', v_idx,
                    'orcamento_id', v_orc.id
                ),
                'Importação automática de item clínico a partir de orçamento aprovado'
            );
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'sucesso', true,
        'importados', v_importados,
        'ignorados_financeiros', v_ignorados,
        'total_itens_orcamento', v_idx
    );
END;
$$;

-- 9. FUNÇÃO RPC PÚBLICA: OBTER DADOS DA SESSÃO POR TOKEN (SEM VAZAMENTO DE DADOS SENSÍVEIS)
CREATE OR REPLACE FUNCTION public.obter_confirmacao_sessao_publica(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_conf RECORD;
    v_sess RECORD;
    v_proc RECORD;
    v_pac RECORD;
BEGIN
    SELECT * INTO v_conf
    FROM public.tratamento_confirmacoes
    WHERE token = p_token;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('sucesso', false, 'valido', false, 'erro', 'Link de confirmação não localizado.');
    END IF;

    IF v_conf.status = 'confirmado' THEN
        RETURN jsonb_build_object(
            'sucesso', true,
            'valido', true,
            'ja_assinado', true,
            'assinado_em', v_conf.assinado_em,
            'assinante_nome', v_conf.assinante_nome,
            'declaracao_texto', v_conf.declaracao_texto,
            'observacoes_paciente', v_conf.observacoes_paciente
        );
    END IF;

    IF now() > v_conf.token_expira_em THEN
        RETURN jsonb_build_object('sucesso', false, 'valido', false, 'erro', 'Este link de confirmação expirou. Solicite um novo link à recepção da clínica.');
    END IF;

    -- Busca dados vinculados
    SELECT * INTO v_sess FROM public.tratamento_sessoes WHERE id = v_conf.sessao_id;
    SELECT * INTO v_proc FROM public.tratamentos_procedimentos WHERE id = v_sess.tratamento_procedimento_id;
    SELECT id, nome, telefone INTO v_pac FROM public.pacientes WHERE id = v_conf.paciente_id;

    RETURN jsonb_build_object(
        'sucesso', true,
        'valido', true,
        'ja_assinado', false,
        'sessao_id', v_sess.id,
        'numero_sessao', v_sess.numero_sessao,
        'nome_objetivo', v_sess.nome_objetivo,
        'data_realizada', v_sess.data_realizada,
        'hora_realizada', v_sess.hora_realizada,
        'descricao_atos', v_sess.descricao_atos,
        'profissional_nome', v_sess.profissional_nome,
        'procedimento_nome', v_proc.procedimento_nome,
        'paciente_nome', v_pac.nome,
        'declaracao_texto', v_conf.declaracao_texto,
        'token_expira_em', v_conf.token_expira_em,
        'dados', jsonb_build_object(
            'paciente_nome', v_pac.nome,
            'procedimento_nome', v_proc.procedimento_nome,
            'status', 'pendente',
            'numero_sessao', v_sess.numero_sessao
        )
    );
END;
$$;

-- 10. FUNÇÃO RPC PÚBLICA: ASSINAR CONFIRMAÇÃO DA SESSÃO COM ATOMICIDADE E HASH
CREATE OR REPLACE FUNCTION public.assinar_confirmacao_sessao_publica(
    p_token TEXT,
    p_assinatura_base64 TEXT,
    p_assinante_nome TEXT,
    p_assinante_cpf TEXT,
    p_observacoes_paciente TEXT DEFAULT NULL,
    p_concorda BOOLEAN DEFAULT true,
    p_ip TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth, pg_temp
AS $$
DECLARE
    v_conf RECORD;
    v_hash TEXT;
    v_doc_id UUID;
    v_now TIMESTAMPTZ := now();
    v_sess RECORD;
    v_proc RECORD;
    v_pac RECORD;
BEGIN
    -- Trava atômica na linha para impedir duplo clique concorrente
    SELECT * INTO v_conf
    FROM public.tratamento_confirmacoes
    WHERE token = p_token
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Token inválido.');
    END IF;

    IF v_conf.status = 'confirmado' THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Esta sessão já foi assinada e confirmada anteriormente.');
    END IF;

    IF v_now > v_conf.token_expira_em THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'O link expirou e não pode mais ser assinado.');
    END IF;

    IF p_assinatura_base64 IS NULL OR length(TRIM(p_assinatura_base64)) < 20 THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Assinatura eletrônica obrigatória.');
    END IF;

    -- Busca metadados da sessão, procedimento e paciente
    SELECT * INTO v_sess FROM public.tratamento_sessoes WHERE id = v_conf.sessao_id;
    SELECT * INTO v_proc FROM public.tratamentos_procedimentos WHERE id = v_sess.tratamento_procedimento_id;
    SELECT * INTO v_pac FROM public.pacientes WHERE id = v_conf.paciente_id;

    -- Gera hash SHA-256 de integridade criptográfica
    v_hash := encode(extensions.digest(
        (v_conf.id::text || ':' || 
        v_conf.sessao_id::text || ':' || 
        p_token || ':' || 
        v_now::text || ':' || 
        COALESCE(p_observacoes_paciente, '') || ':' || 
        p_assinatura_base64)::bytea,
        'sha256'
    ), 'hex');

    -- Cria o documento clínico / comprovante arquivado no prontuário
    INSERT INTO public.documentos_clinicos (
        user_id,
        clinica_id,
        paciente_id,
        paciente_nome,
        tipo,
        titulo,
        conteudo,
        itens,
        dentista,
        assinante_nome,
        assinado_em,
        identificador,
        criado_em,
        atualizado_em
    ) VALUES (
        v_proc.user_id,
        v_conf.clinica_id,
        v_conf.paciente_id,
        COALESCE(p_assinante_nome, v_pac.nome),
        'termo_confirmacao_sessao',
        'Confirmação de Atendimento — ' || v_proc.procedimento_nome || ' (Sessão ' || v_sess.numero_sessao || ')',
        v_conf.declaracao_texto,
        jsonb_build_object(
            'sessao_id', v_sess.id,
            'numero_sessao', v_sess.numero_sessao,
            'nome_objetivo', v_sess.nome_objetivo,
            'procedimento_nome', v_proc.procedimento_nome,
            'data_realizada', v_sess.data_realizada,
            'hora_realizada', v_sess.hora_realizada,
            'profissional_nome', v_sess.profissional_nome,
            'descricao_atos', v_sess.descricao_atos,
            'atos_praticados', v_sess.descricao_atos,
            'observacoes_clinicas', v_sess.observacoes_clinicas,
            'observacoes_paciente', p_observacoes_paciente,
            'concorda_realizacao', p_concorda,
            'ip_origem', p_ip,
            'user_agent', p_user_agent,
            'token', p_token,
            'hash_integridade', v_hash,
            'assinatura_base64', p_assinatura_base64
        ),
        v_sess.profissional_nome,
        p_assinante_nome,
        v_now,
        'CONF-SESS-' || SUBSTRING(v_sess.id::text, 1, 8),
        v_now,
        v_now
    )
    RETURNING id INTO v_doc_id;

    -- Atualiza a tabela de confirmações
    UPDATE public.tratamento_confirmacoes
    SET status = 'confirmado',
        concorda_realizacao = p_concorda,
        observacoes_paciente = p_observacoes_paciente,
        assinatura_base64 = p_assinatura_base64,
        assinante_nome = p_assinante_nome,
        assinante_cpf = p_assinante_cpf,
        ip_origem = p_ip,
        user_agent = p_user_agent,
        assinado_em = v_now,
        hash_integridade = v_hash,
        documento_clinico_id = v_doc_id
    WHERE id = v_conf.id;

    -- Atualiza status da sessão
    UPDATE public.tratamento_sessoes
    SET status = 'confirmada',
        atualizado_em = v_now
    WHERE id = v_sess.id;

    -- Registra na auditoria
    INSERT INTO public.tratamento_historico_alteracoes (
        tratamento_procedimento_id,
        sessao_id,
        clinica_id,
        usuario_id,
        usuario_nome,
        acao,
        dados_novos,
        justificativa
    ) VALUES (
        v_proc.id,
        v_sess.id,
        v_conf.clinica_id,
        v_proc.user_id,
        p_assinante_nome || ' (Paciente)',
        'CONFIRMACAO_ASSINADA',
        jsonb_build_object(
            'hash_integridade', v_hash,
            'documento_clinico_id', v_doc_id,
            'concorda_realizacao', p_concorda,
            'observacoes_paciente', p_observacoes_paciente
        ),
        'Assinatura digital de confirmação de sessão realizada pelo paciente'
    );

    RETURN jsonb_build_object(
        'sucesso', true,
        'hash_integridade', v_hash,
        'documento_clinico_id', v_doc_id,
        'assinado_em', v_now
    );
END;
$$;

-- 11. FUNÇÃO RPC: CONCLUIR PROCEDIMENTO DE TRATAMENTO
CREATE OR REPLACE FUNCTION public.concluir_procedimento_tratamento(
    p_procedimento_id UUID,
    p_usuario_id UUID,
    p_usuario_nome TEXT DEFAULT 'Profissional',
    p_observacoes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_proc RECORD;
    v_sessoes_count INTEGER;
    v_now TIMESTAMPTZ := now();
    v_doc_id UUID;
    v_pac RECORD;
BEGIN
    SELECT * INTO v_proc
    FROM public.tratamentos_procedimentos
    WHERE id = p_procedimento_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Procedimento não localizado.');
    END IF;

    IF v_proc.status = 'concluido' THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Procedimento já está concluído.');
    END IF;

    -- Verifica se possui ao menos uma sessão registrada
    SELECT count(*) INTO v_sessoes_count
    FROM public.tratamento_sessoes
    WHERE tratamento_procedimento_id = p_procedimento_id;

    SELECT id, nome, telefone INTO v_pac
    FROM public.pacientes
    WHERE id = v_proc.paciente_id;

    -- Gera documento clínico: Termo de Conclusão do Procedimento
    INSERT INTO public.documentos_clinicos (
        user_id,
        clinica_id,
        paciente_id,
        paciente_nome,
        tipo,
        titulo,
        conteudo,
        itens,
        dentista,
        criado_em,
        atualizado_em
    ) VALUES (
        p_usuario_id,
        v_proc.clinica_id,
        v_proc.paciente_id,
        v_pac.nome,
        'termo_conclusao_procedimento',
        'Termo de Conclusão de Tratamento — ' || v_proc.procedimento_nome,
        'Declaramos que o procedimento clínico "' || v_proc.procedimento_nome || '" do paciente ' || v_pac.nome || ' foi concluído em conformidade com o planejamento clínico inicial, após a realização de ' || v_sessoes_count || ' sessões terapêuticas.',
        jsonb_build_object(
            'procedimento_id', v_proc.id,
            'procedimento_nome', v_proc.procedimento_nome,
            'orcamento_id', v_proc.orcamento_id,
            'contrato_id', v_proc.contrato_id,
            'total_sessoes', v_sessoes_count,
            'observacoes', p_observacoes,
            'concluido_por', p_usuario_nome
        ),
        p_usuario_nome,
        v_now,
        v_now
    ) RETURNING id INTO v_doc_id;

    -- Atualiza status do procedimento
    UPDATE public.tratamentos_procedimentos
    SET status = 'concluido',
        data_conclusao = CURRENT_DATE,
        termo_conclusao_id = v_doc_id,
        atualizado_em = v_now
    WHERE id = p_procedimento_id;

    -- Registra na auditoria
    INSERT INTO public.tratamento_historico_alteracoes (
        tratamento_procedimento_id,
        clinica_id,
        usuario_id,
        usuario_nome,
        acao,
        dados_novos,
        justificativa
    ) VALUES (
        p_procedimento_id,
        v_proc.clinica_id,
        p_usuario_id,
        p_usuario_nome,
        'PROCEDIMENTO_CONCLUIDO',
        jsonb_build_object(
            'data_conclusao', CURRENT_DATE,
            'termo_conclusao_id', v_doc_id,
            'total_sessoes', v_sessoes_count
        ),
        COALESCE(p_observacoes, 'Conclusão formal do procedimento clínico com termo emitido')
    );

    RETURN jsonb_build_object(
        'sucesso', true,
        'termo_conclusao_id', v_doc_id,
        'total_sessoes', v_sessoes_count
    );
END;
$$;

-- 12. FUNÇÃO RPC: REABRIR PROCEDIMENTO DE TRATAMENTO AUDITADO
CREATE OR REPLACE FUNCTION public.reabrir_procedimento_tratamento(
    p_procedimento_id UUID,
    p_usuario_id UUID,
    p_usuario_nome TEXT DEFAULT 'Profissional',
    p_justificativa TEXT DEFAULT 'Necessidade de sessão complementar ou ajuste clínico'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_proc RECORD;
    v_now TIMESTAMPTZ := now();
BEGIN
    SELECT * INTO v_proc
    FROM public.tratamentos_procedimentos
    WHERE id = p_procedimento_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Procedimento não localizado.');
    END IF;

    IF v_proc.status <> 'concluido' THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Apenas procedimentos concluídos podem ser reabertos.');
    END IF;

    IF p_justificativa IS NULL OR length(TRIM(p_justificativa)) < 5 THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Justificativa obrigatória para reabertura de procedimento.');
    END IF;

    -- Atualiza status de volta para em_tratamento, PRESERVANDO termo_conclusao_id no histórico
    UPDATE public.tratamentos_procedimentos
    SET status = 'em_tratamento',
        data_conclusao = NULL,
        atualizado_em = v_now
    WHERE id = p_procedimento_id;

    -- Registra na auditoria
    INSERT INTO public.tratamento_historico_alteracoes (
        tratamento_procedimento_id,
        clinica_id,
        usuario_id,
        usuario_nome,
        acao,
        dados_anteriores,
        dados_novos,
        justificativa
    ) VALUES (
        p_procedimento_id,
        v_proc.clinica_id,
        p_usuario_id,
        p_usuario_nome,
        'PROCEDIMENTO_REABERTO',
        jsonb_build_object(
            'status_anterior', 'concluido',
            'termo_conclusao_anterior_id', v_proc.termo_conclusao_id
        ),
        jsonb_build_object(
            'status_novo', 'em_tratamento',
            'data_reabertura', v_now
        ),
        p_justificativa
    );

    RETURN jsonb_build_object(
        'sucesso', true,
        'procedimento_id', p_procedimento_id,
        'status', 'em_tratamento'
    );
END;
$$;

-- 13. PERMISSÕES E GRANTS PARA OS ROLES SUPABASE
GRANT ALL ON TABLE public.tratamentos_procedimentos TO postgres, authenticated, service_role;
GRANT ALL ON TABLE public.tratamento_sessoes TO postgres, authenticated, service_role;
GRANT ALL ON TABLE public.tratamento_confirmacoes TO postgres, authenticated, service_role;
GRANT ALL ON TABLE public.tratamento_historico_alteracoes TO postgres, authenticated, service_role;
GRANT ALL ON TABLE public.documentos_clinicos TO postgres, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.sincronizar_procedimentos_orcamento TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.obter_confirmacao_sessao_publica TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assinar_confirmacao_sessao_publica TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.concluir_procedimento_tratamento TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reabrir_procedimento_tratamento TO authenticated, service_role;


