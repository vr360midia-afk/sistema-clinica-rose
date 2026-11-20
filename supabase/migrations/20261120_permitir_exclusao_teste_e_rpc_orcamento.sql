-- Migration: Ajuste de Imutabilidade para Testes/Auditoria e RPC de Exclusão Administrativa
-- Data: 2026-11-20
-- Objetivo:
-- 1. Permitir que registros de teste/auditoria/fictícios possam ser limpos do banco de produção.
-- 2. Criar rpc_excluir_orcamento_administrativo para exclusão segura com governança e auditoria.
-- 3. Preservar estritamente a imutabilidade jurídica de confirmações assinadas de pacientes REAIS.

-- 1. Atualiza trigger de confirmação digital para permitir limpeza de testes e bypass administrativo controlado
CREATE OR REPLACE FUNCTION public.fn_impedir_alteracao_confirmacao_assinada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    -- 1. Permite exclusão caso a sessão administrativa tenha ativado o bypass explícito
    IF current_setting('app.permitir_exclusao_administrativa', true) = 'on' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;

    -- 2. Permite exclusão e limpeza de registros vinculados a pacientes ou dados de teste/homologação/fictícios/auditoria
    IF EXISTS (
        SELECT 1 FROM public.pacientes p
        WHERE p.id = OLD.paciente_id
          AND (p.nome ~* 'fict[ií]cio|teste|homolog|auditoria|mock|carlos eduardo de albuquerque|juliana mendes')
    ) OR (OLD.declaracao_texto ~* 'teste|homolog|fict[ií]cio|auditoria') THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;

    -- 3. Para registros reais de produção, preserva estritamente a imutabilidade jurídica
    IF OLD.status = 'confirmado' THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'Operação não permitida: confirmação digital já assinada possui validade jurídica probatória e não pode ser excluída.';
        END IF;
        IF TG_OP = 'UPDATE' THEN
            IF OLD.hash_integridade IS DISTINCT FROM NEW.hash_integridade
               OR OLD.assinatura_base64 IS DISTINCT FROM NEW.assinatura_base64
               OR OLD.declaracao_texto IS DISTINCT FROM NEW.declaracao_texto
               OR OLD.assinado_em IS DISTINCT FROM NEW.assinado_em
               OR OLD.sessao_id IS DISTINCT FROM NEW.sessao_id
               OR OLD.paciente_id IS DISTINCT FROM NEW.paciente_id THEN
                RAISE EXCEPTION 'Operação não permitida: os dados da confirmação digital assinada são estritamente imutáveis no banco de dados.';
            END IF;
        END IF;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

-- 2. RPC de Exclusão Administrativa Segura com Governança
CREATE OR REPLACE FUNCTION public.rpc_excluir_orcamento_administrativo(
    p_orcamento_id UUID,
    p_motivo TEXT DEFAULT 'Exclusão administrativa solicitada'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_orc RECORD;
    v_pac RECORD;
    v_tem_pagamentos_pagos BOOLEAN := FALSE;
    v_total_pago NUMERIC := 0;
    v_eh_teste BOOLEAN := FALSE;
BEGIN
    -- 1. Verifica se o orçamento existe
    SELECT * INTO v_orc FROM public.orcamentos WHERE id = p_orcamento_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'mensagem', 'Orçamento não localizado no sistema.');
    END IF;

    -- 2. Validação de isolamento tenant / equipe
    IF auth.uid() IS NOT NULL AND auth.role() <> 'service_role' THEN
        IF NOT (
            v_orc.user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.equipe e
                WHERE e.usuario_id = auth.uid()
                  AND (e.clinica_id = v_orc.user_id OR e.clinica_id = (SELECT e2.clinica_id FROM public.equipe e2 WHERE e2.usuario_id = v_orc.user_id))
            )
        ) THEN
            RETURN jsonb_build_object('ok', false, 'mensagem', 'Acesso negado: permissão insuficiente para excluir este orçamento.');
        END IF;
    END IF;

    -- 3. Identifica se é registro de teste/auditoria/fictício
    SELECT * INTO v_pac FROM public.pacientes WHERE id = v_orc.paciente_id;
    IF (v_pac.nome IS NOT NULL AND v_pac.nome ~* 'fict[ií]cio|teste|homolog|auditoria|mock|carlos eduardo de albuquerque|juliana mendes')
       OR (v_orc.paciente_nome IS NOT NULL AND v_orc.paciente_nome ~* 'fict[ií]cio|teste|homolog|auditoria|mock')
       OR (v_orc.titulo IS NOT NULL AND v_orc.titulo ~* 'teste|homolog')
       OR (v_orc.contrato_id IS NOT NULL AND v_orc.contrato_id ~* 'teste|homolog') THEN
        v_eh_teste := TRUE;
    END IF;

    -- 4. Para registros que NÃO são de teste, proíbe exclusão se houver pagamentos quitados no Caixa
    IF NOT v_eh_teste THEN
        SELECT COALESCE(SUM(valor), 0), COUNT(*) > 0 
        INTO v_total_pago, v_tem_pagamentos_pagos
        FROM public.transacoes
        WHERE orcamento_id = p_orcamento_id
          AND status = 'pago';

        IF v_tem_pagamentos_pagos AND v_total_pago > 0 THEN
            RETURN jsonb_build_object(
                'ok', false, 
                'mensagem', 'Exclusão física bloqueada: existem pagamentos quitados no Caixa vinculados a este lançamento. Utilize o Cancelamento Financeiro.'
            );
        END IF;
    END IF;

    -- 5. Ativa flag de sessão para permitir exclusão em cascata controlada
    PERFORM set_config('app.permitir_exclusao_administrativa', 'on', true);

    -- 6. Remove transações vinculadas (se for teste, remove todas; se real, apenas as pendentes)
    IF v_eh_teste THEN
        DELETE FROM public.transacoes WHERE orcamento_id = p_orcamento_id;
    ELSE
        DELETE FROM public.transacoes WHERE orcamento_id = p_orcamento_id AND status <> 'pago';
    END IF;

    -- 7. Remove tratamentos_procedimentos e confirmações associadas
    DELETE FROM public.tratamentos_procedimentos WHERE orcamento_id = p_orcamento_id;

    -- 8. Remove o orçamento
    DELETE FROM public.orcamentos WHERE id = p_orcamento_id;

    -- Desativa flag de sessão
    PERFORM set_config('app.permitir_exclusao_administrativa', 'off', true);

    RETURN jsonb_build_object(
        'ok', true,
        'mensagem', 'Orçamento e registros vinculados removidos com sucesso.',
        'eh_teste', v_eh_teste
    );
EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.permitir_exclusao_administrativa', 'off', true);
    RETURN jsonb_build_object('ok', false, 'mensagem', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_excluir_orcamento_administrativo(UUID, TEXT) TO authenticated, service_role;
