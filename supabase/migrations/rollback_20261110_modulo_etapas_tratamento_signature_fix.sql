-- ============================================================================
-- SCRIPT DE ROLLBACK NÃO-DESTRUTIVO: ASSINATURA DIGITAL ETAPAS DO TRATAMENTO
-- Data: 2026-11-10
-- Ambiente: Produção (skonxcdojbkbfnfemayz)
-- Efeito: Restaura a função assinar_confirmacao_sessao_publica para a versão
-- original em produção e remove a função auxiliar validar_assinatura_grafica.
-- GARANTIA: Nenhuma tabela, sessão, confirmação ou histórico é excluído.
-- ============================================================================

-- 1. Remove versão com 10 parâmetros
DROP FUNCTION IF EXISTS public.assinar_confirmacao_sessao_publica(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.validar_assinatura_grafica(TEXT, TEXT, JSONB);

-- 2. Restaura a função original com 8 parâmetros de produção
CREATE OR REPLACE FUNCTION public.assinar_confirmacao_sessao_publica(
    p_token text, 
    p_assinatura_base64 text, 
    p_assinante_nome text, 
    p_assinante_cpf text, 
    p_observacoes_paciente text DEFAULT NULL::text, 
    p_concorda boolean DEFAULT true, 
    p_ip text DEFAULT NULL::text, 
    p_user_agent text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth', 'pg_temp'
AS $function$
DECLARE
    v_conf RECORD;
    v_hash TEXT;
    v_doc_id UUID;
    v_now TIMESTAMPTZ := now();
    v_sess RECORD;
    v_proc RECORD;
    v_pac RECORD;
    v_payload_canonico TEXT;
BEGIN
    -- Validação estrita de formato do token
    IF p_token IS NULL OR p_token !~ '^[a-fA-F0-9]{32,64}$' THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Formato de token de confirmação inválido.');
    END IF;

    -- Trava atômica na linha para impedir duplo clique concorrente
    SELECT * INTO v_conf
    FROM public.tratamento_confirmacoes
    WHERE token = p_token
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Token inválido ou não localizado.');
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

    -- Constrói payload canônico vinculando estritamente:
    -- Atos clínicos realizados, declaração, observações, identificação, timestamp e assinatura
    v_payload_canonico := (
        'ID:' || v_conf.id::text || '|' ||
        'SESSAO_ID:' || v_conf.sessao_id::text || '|' ||
        'TOKEN:' || p_token || '|' ||
        'PROC:' || v_proc.procedimento_nome || '|' ||
        'NUM_SESSAO:' || v_sess.numero_sessao::text || '|' ||
        'OBJETIVO:' || v_sess.nome_objetivo || '|' ||
        'ATOS_CLINICOS:' || COALESCE(v_sess.descricao_atos, '') || '|' ||
        'DECLARACAO:' || v_conf.declaracao_texto || '|' ||
        'OBS_PACIENTE:' || COALESCE(p_observacoes_paciente, '') || '|' ||
        'CONCORDA:' || CASE WHEN p_concorda THEN 'SIM' ELSE 'NAO' END || '|' ||
        'ASSINANTE_NOME:' || COALESCE(p_assinante_nome, '') || '|' ||
        'ASSINANTE_CPF:' || COALESCE(p_assinante_cpf, '') || '|' ||
        'TIMESTAMP_ISO:' || to_char(v_now, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || '|' ||
        'ASSINATURA_BASE64:' || p_assinatura_base64
    );

    -- Gera hash SHA-256 canônico de integridade criptográfica
    v_hash := encode(extensions.digest(v_payload_canonico::bytea, 'sha256'), 'hex');

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
            'assinatura_base64', p_assinatura_base64,
            'assinado_em', v_now
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
            'observacoes_paciente', p_observacoes_paciente,
            'atos_clinicos', v_sess.descricao_atos
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
$function$;

GRANT EXECUTE ON FUNCTION public.assinar_confirmacao_sessao_publica(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT) TO anon, authenticated, service_role;

