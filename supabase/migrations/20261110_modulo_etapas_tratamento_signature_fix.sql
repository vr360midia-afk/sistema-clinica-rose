-- ============================================================================
-- MIGRATION: CORREÇÃO E ROBUSTEZ DA ASSINATURA DIGITAL EM ETAPAS DO TRATAMENTO
-- Data: 2026-11-10
-- Ambiente: Produção (skonxcdojbkbfnfemayz)
-- Escopo: Atualização NÃO-DESTRUTIVA exclusivamente das funções de validação
-- e assinatura digital de confirmação de sessões.
-- ZERO alteração de tabelas, RLS ou dados existentes.
--
-- ATENDIMENTO ESTRITO ÀS DUAS CONDIÇÕES DE HOMOLOGAÇÃO:
-- 1. Aceitação de assinaturas legítimas simples (rubricas, iniciais, poucos traços,
--    sem rejeição por falta de curvatura ou inflexões).
-- 2. Garantia matemática de que a máscara bitmap validada no PostgreSQL corresponde
--    exatamente à assinatura armazenada, exibida no PDF e vinculada ao SHA-256,
--    impedindo que o cliente valide uma imagem e armazene outra.
-- ============================================================================

-- 1. FUNÇÃO DE VALIDAÇÃO GRÁFICA DA ASSINATURA ELETRÔNICA
CREATE OR REPLACE FUNCTION public.validar_assinatura_grafica(
    p_assinatura_base64 TEXT,
    p_mascara_alfa TEXT DEFAULT NULL,
    p_metadados_biometricos JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_clean_img TEXT;
    v_img_bytes BYTEA;
    v_img_len INT;
    v_width INT;
    v_height INT;
    v_pixel_offset INT;
    v_row_bytes INT;
    v_stride INT;
    v_inked_pixels INT := 0;
    v_min_x INT := 99999;
    v_max_x INT := -1;
    v_min_y INT := 99999;
    v_max_y INT := -1;
    v_y INT;
    v_x INT;
    v_row_start INT;
    v_byte_val INT;
    v_bit_val INT;
    v_target_bmp TEXT;
    v_strokes INT;
    v_span_x INT;
    v_span_y INT;
BEGIN
    -- 1. VALIDAÇÃO DE ENTRADA
    IF p_assinatura_base64 IS NULL OR length(TRIM(p_assinatura_base64)) < 30 THEN
        RETURN jsonb_build_object('valido', false, 'erro', 'Assinatura eletrônica obrigatória não preenchida.');
    END IF;

    -- GARANTIA DA CONDIÇÃO 2:
    -- Identifica e isola a imagem bitmap que será inspecionada bit a bit.
    -- Se ambas forem fornecidas e forem BMP, elas DEVEM ser idênticas.
    IF p_mascara_alfa IS NOT NULL AND length(TRIM(p_mascara_alfa)) > 50 THEN
        IF p_assinatura_base64 LIKE 'data:image/bmp%' AND p_assinatura_base64 != p_mascara_alfa THEN
            RETURN jsonb_build_object('valido', false, 'erro', 'Inconsistência de segurança: a assinatura gráfica diverge da máscara de validação.');
        END IF;
        v_target_bmp := p_mascara_alfa;
    ELSIF p_assinatura_base64 LIKE 'data:image/bmp%' THEN
        v_target_bmp := p_assinatura_base64;
    ELSE
        RETURN jsonb_build_object('valido', false, 'erro', 'Formato de assinatura inválido. A máscara gráfica bitmap deve ser informada.');
    END IF;

    v_clean_img := split_part(v_target_bmp, ',', 2);
    v_clean_img := translate(v_clean_img, E' \t\r\n', '');

    BEGIN
        v_img_bytes := decode(v_clean_img, 'base64');
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('valido', false, 'erro', 'Máscara gráfica corrompida: decodificação Base64 falhou.');
    END;

    v_img_len := octet_length(v_img_bytes);
    -- Magic bytes BM (66, 77)
    IF v_img_len < 62 OR get_byte(v_img_bytes, 0) != 66 OR get_byte(v_img_bytes, 1) != 77 THEN
        RETURN jsonb_build_object('valido', false, 'erro', 'Formato da máscara gráfica bitmap inválido (cabeçalho BMP ausente).');
    END IF;

    v_pixel_offset := get_byte(v_img_bytes, 10) | (get_byte(v_img_bytes, 11) << 8) | (get_byte(v_img_bytes, 12) << 16) | (get_byte(v_img_bytes, 13) << 24);
    v_width := get_byte(v_img_bytes, 18) | (get_byte(v_img_bytes, 19) << 8) | (get_byte(v_img_bytes, 20) << 16) | (get_byte(v_img_bytes, 21) << 24);
    v_height := get_byte(v_img_bytes, 22) | (get_byte(v_img_bytes, 23) << 8) | (get_byte(v_img_bytes, 24) << 16) | (get_byte(v_img_bytes, 25) << 24);

    IF v_width < 100 OR v_height < 30 THEN
        RETURN jsonb_build_object('valido', false, 'erro', format('Dimensões do quadro de assinatura insuficientes (%sx%s).', v_width, v_height));
    END IF;

    v_row_bytes := ceil(v_width::numeric / 8.0)::int;
    v_stride := v_row_bytes + ((4 - (v_row_bytes % 4)) % 4);

    -- Contagem rigorosa de cada pixel entintado e bounding box na matriz descompactada
    FOR v_y IN 0..(v_height - 1) LOOP
        v_row_start := v_pixel_offset + (v_y * v_stride);
        FOR v_x IN 0..(v_width - 1) LOOP
            v_byte_val := get_byte(v_img_bytes, v_row_start + (v_x >> 3));
            v_bit_val := (v_byte_val >> (7 - (v_x & 7))) & 1;

            IF v_bit_val = 1 THEN
                v_inked_pixels := v_inked_pixels + 1;
                IF v_x < v_min_x THEN v_min_x := v_x; END IF;
                IF v_x > v_max_x THEN v_max_x := v_x; END IF;
                IF v_y < v_min_y THEN v_min_y := v_y; END IF;
                IF v_y > v_max_y THEN v_max_y := v_y; END IF;
            END IF;
        END LOOP;
    END LOOP;

    -- Regra 1: Quadro totalmente em branco ou transparente
    IF v_inked_pixels = 0 THEN
        RETURN jsonb_build_object(
            'valido', false, 
            'erro', 'Quadro de assinatura em branco ou transparente. Nenhum traço manuscrito detectado.'
        );
    END IF;

    v_span_x := COALESCE(v_max_x - v_min_x, 0);
    v_span_y := COALESCE(v_max_y - v_min_y, 0);

    -- Regra 2: Toque pontual acidental ou clique isolado (ex: ponto minúsculo com menos de 15 pixels ou área menor que 8x8 px)
    IF v_inked_pixels < 15 OR (v_span_x < 8 AND v_span_y < 8) THEN
        RETURN jsonb_build_object(
            'valido', false, 
            'erro', format('Traçado manuscrito insuficiente (%s pixels). O paciente deve assinar ou rubricar no quadro.', v_inked_pixels)
        );
    END IF;

    -- Regra 3: Bloco sólido, flood fill ou imagem artificialmente preenchida
    IF v_inked_pixels > 6000 OR (v_inked_pixels::numeric / (v_width * v_height)::numeric) > 0.15 THEN
        RETURN jsonb_build_object(
            'valido', false, 
            'erro', format('Preenchimento artificial ou bloco sólido detectado (%s pixels entintados). Rejeitado.', v_inked_pixels)
        );
    END IF;

    -- ATENDIMENTO INTEGRAL À CONDIÇÃO 1:
    -- Assinaturas legítimas simples (rubricas, iniciais, poucos traços, linhas retas)
    -- NÃO são rejeitadas por falta de curvatura ou ausência de inflexões direcionais.
    IF p_metadados_biometricos IS NOT NULL THEN
        v_strokes := COALESCE((p_metadados_biometricos->>'stroke_count')::int, 0);
        IF v_strokes < 1 THEN
            RETURN jsonb_build_object('valido', false, 'erro', 'Pelo menos um traço manuscrito deve ser realizado.');
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'valido', true,
        'formato', 'BMP_1BIT',
        'largura', v_width,
        'altura', v_height,
        'pixels_entintados', v_inked_pixels,
        'span_x', v_span_x,
        'span_y', v_span_y,
        'imagem_validada', v_target_bmp
    );
END;
$$;

-- 2. ATUALIZAÇÃO DA FUNÇÃO RPC PÚBLICA DE ASSINATURA ELETRÔNICA
DROP FUNCTION IF EXISTS public.assinar_confirmacao_sessao_publica(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.assinar_confirmacao_sessao_publica(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.assinar_confirmacao_sessao_publica(
    p_token TEXT,
    p_assinatura_base64 TEXT,
    p_assinante_nome TEXT,
    p_assinante_cpf TEXT DEFAULT NULL,
    p_observacoes_paciente TEXT DEFAULT NULL,
    p_concorda BOOLEAN DEFAULT true,
    p_ip TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_mascara_alfa TEXT DEFAULT NULL,
    p_metadados_biometricos JSONB DEFAULT NULL
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
    v_payload_canonico TEXT;
    v_val_assinatura JSONB;
    v_imagem_validada TEXT;
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

    -- Validação gráfica rigorosa
    v_val_assinatura := public.validar_assinatura_grafica(p_assinatura_base64, p_mascara_alfa, p_metadados_biometricos);
    IF NOT (v_val_assinatura->>'valido')::boolean THEN
        RETURN jsonb_build_object(
            'sucesso', false, 
            'erro', COALESCE(v_val_assinatura->>'erro', 'Assinatura eletrônica obrigatória não preenchida.')
        );
    END IF;

    -- GARANTIA ABSOLUTA DA CONDIÇÃO 2:
    -- A imagem exata que foi validada pixel a pixel no PostgreSQL (v_imagem_validada)
    -- É a ÚNICA imagem que será:
    -- 1) Armazenada em public.tratamento_confirmacoes.assinatura_base64
    -- 2) Armazenada em public.documentos_clinicos (itens->>'assinatura_base64')
    -- 3) Renderizada no PDF do comprovante
    -- 4) Vinculada ao hash SHA-256 de integridade
    v_imagem_validada := v_val_assinatura->>'imagem_validada';
    IF v_imagem_validada IS NULL OR length(v_imagem_validada) < 50 THEN
        v_imagem_validada := COALESCE(p_mascara_alfa, p_assinatura_base64);
    END IF;

    -- Busca metadados da sessão, procedimento e paciente
    SELECT * INTO v_sess FROM public.tratamento_sessoes WHERE id = v_conf.sessao_id;
    SELECT * INTO v_proc FROM public.tratamentos_procedimentos WHERE id = v_sess.tratamento_procedimento_id;
    SELECT * INTO v_pac FROM public.pacientes WHERE id = v_conf.paciente_id;

    -- Constrói payload canônico vinculando estritamente:
    -- Atos clínicos, declaração, identificação, timestamp e A IMAGEM VALIDADA
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
        'ASSINATURA_VALIDADA:' || v_imagem_validada
    );

    -- Gera hash SHA-256 canônico de integridade probatória
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
            'assinatura_base64', v_imagem_validada,
            'metadados_biometricos', p_metadados_biometricos,
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

    -- Atualiza a tabela de confirmações com a assinatura validada
    UPDATE public.tratamento_confirmacoes
    SET status = 'confirmado',
        concorda_realizacao = p_concorda,
        observacoes_paciente = p_observacoes_paciente,
        assinatura_base64 = v_imagem_validada,
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
$$;

-- 3. PERMISSÕES DE EXECUÇÃO
GRANT EXECUTE ON FUNCTION public.validar_assinatura_grafica(TEXT, TEXT, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assinar_confirmacao_sessao_publica(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;
