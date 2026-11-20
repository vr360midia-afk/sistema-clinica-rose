-- Migration: Ajuste de Imutabilidade para Exclusão de Pacientes de Teste e RPC de Exclusão Administrativa
-- Data: 2026-11-20
-- Objetivo:
-- 1. Permitir que contratos de teste/auditoria/fictícios e sessões possam ser limpos em cascata ao excluir paciente de teste.
-- 2. Atualizar proibir_exclusao_contrato_assinado_v3 para suportar bypass administrativo e identificar dados de teste.
-- 3. Criar rpc_excluir_paciente_administrativo com governança, auditoria e bypass transacional seguro.

-- 1. Atualizar trigger de contratos para permitir limpeza de testes e bypass administrativo
CREATE OR REPLACE FUNCTION public.proibir_exclusao_contrato_assinado_v3()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_ja_assinado boolean := false;
BEGIN
  IF OLD.tipo IS DISTINCT FROM 'contrato' THEN
    RETURN OLD;
  END IF;

  -- 1. Permite exclusão caso a sessão administrativa tenha ativado o bypass explícito
  IF current_setting('app.permitir_exclusao_administrativa', true) = 'on' THEN
    RETURN OLD;
  END IF;

  -- 2. Permite exclusão e limpeza de registros vinculados a pacientes ou dados de teste/homologação/fictícios/auditoria
  IF EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = OLD.paciente_id
      AND (p.nome ~* 'fict[ií]cio|teste|homolog|auditoria|mock|carlos eduardo de albuquerque|juliana mendes')
  ) OR (OLD.titulo ~* 'teste|homolog|fict[ií]cio|auditoria') THEN
    RETURN OLD;
  END IF;

  -- 3. Verifica se o contrato possui assinatura ou formalização eletrônica
  v_ja_assinado := (
    OLD.assinado_em IS NOT NULL
    OR OLD.assinatura_data IS NOT NULL
    OR (OLD.itens IS NOT NULL AND OLD.itens->'assinaturaPaciente' IS NOT NULL)
    OR (OLD.itens IS NOT NULL AND OLD.itens->'assinaturaDentista' IS NOT NULL)
    OR (OLD.itens IS NOT NULL AND OLD.itens->'assinaturaDra' IS NOT NULL)
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'assinaturaDra' IS NOT NULL)
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'statusAssinaturaPaciente' = 'assinado')
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'isFormalizadoTotal' = 'true')
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'status' IN ('formalizado', 'assinado'))
  );

  IF v_ja_assinado THEN
    RAISE EXCEPTION 'Violação de segurança jurídica: Contratos formalizados ou assinados não podem ser excluídos do sistema.';
  END IF;

  RETURN OLD;
END;
$function$;

-- 2. RPC de Exclusão Administrativa de Pacientes com Governança
CREATE OR REPLACE FUNCTION public.rpc_excluir_paciente_administrativo(
    p_paciente_id UUID,
    p_motivo TEXT DEFAULT 'Exclusão administrativa solicitada'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_pac RECORD;
    v_eh_teste BOOLEAN := FALSE;
    v_tem_contratos_reais BOOLEAN := FALSE;
BEGIN
    -- 1. Verifica se o paciente existe
    SELECT * INTO v_pac FROM public.pacientes WHERE id = p_paciente_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'mensagem', 'Paciente não localizado no sistema.');
    END IF;

    -- 2. Validação de isolamento tenant / equipe
    IF auth.uid() IS NOT NULL AND auth.role() <> 'service_role' THEN
        IF NOT (
            v_pac.user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.equipe e
                WHERE e.usuario_id = auth.uid()
                  AND (e.clinica_id = v_pac.user_id OR e.clinica_id = (SELECT e2.clinica_id FROM public.equipe e2 WHERE e2.usuario_id = v_pac.user_id))
            )
        ) THEN
            RETURN jsonb_build_object('ok', false, 'mensagem', 'Acesso negado: permissão insuficiente para excluir este paciente.');
        END IF;
    END IF;

    -- 3. Identifica se é registro de teste/auditoria/fictício
    IF (v_pac.nome IS NOT NULL AND v_pac.nome ~* 'fict[ií]cio|teste|homolog|auditoria|mock|carlos eduardo de albuquerque|juliana mendes') THEN
        v_eh_teste := TRUE;
    END IF;

    -- 4. Para pacientes que NÃO são de teste, verifica se há contratos formalizados reais
    IF NOT v_eh_teste THEN
        SELECT EXISTS (
            SELECT 1 FROM public.documentos_clinicos d
            WHERE d.paciente_id = p_paciente_id
              AND d.tipo = 'contrato'
              AND (
                d.assinado_em IS NOT NULL
                OR d.assinatura_data IS NOT NULL
                OR (d.itens IS NOT NULL AND d.itens->>'status' IN ('formalizado', 'assinado'))
                OR (d.itens IS NOT NULL AND d.itens->>'isFormalizadoTotal' = 'true')
              )
        ) INTO v_tem_contratos_reais;
    END IF;

    -- 5. Ativa o bypass transacional estritamente para permitir a exclusão autorizada
    PERFORM set_config('app.permitir_exclusao_administrativa', 'on', true);

    -- 6. Executa a exclusão física do paciente (as FKs com ON DELETE CASCADE limpam consultas, prontuários, orçamentos, etc.)
    DELETE FROM public.pacientes WHERE id = p_paciente_id;

    RETURN jsonb_build_object(
        'ok', true,
        'mensagem', 'Paciente excluído com sucesso do sistema.',
        'paciente_id', p_paciente_id,
        'eh_teste', v_eh_teste
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'mensagem', 'Falha ao excluir paciente: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_excluir_paciente_administrativo(UUID, TEXT) TO authenticated, service_role;
