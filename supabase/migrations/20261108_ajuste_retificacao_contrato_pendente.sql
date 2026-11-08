-- ==============================================================================
-- MIGRATION CIRÚRGICA DE BLINDAGEM: RETIFICAÇÃO CONTROLADA DE CONTRATOS PENDENTES (V6)
-- Data: 2026-11-08
--
-- PRINCÍPIOS ESTRITOS DE SEGURANÇA E AUDITORIA FORENSE:
-- 1. IMUTABILIDADE ABSOLUTA DE FORMALIZADOS (REGRA 2):
--    Contratos com indício de formalização/assinatura do paciente (ou assinaturaDra histórica)
--    têm todos os termos, cláusulas, procedimentos, financeiro e assinaturas 100% CONGELADOS,
--    inclusive na ausência de outros indicadores secundários de formalização.
--    Apenas atualizações de metadados administrativos estritamente identificados
--    (pdfUrl, pdf_url, pdfPath, pdfGeradoEm, dadosAuditoria, metadataAuditoria) e atualizado_em são admitidas.
--    Qualquer outra propriedade em 'itens' é sumariamente bloqueada via subtração JSONB.
--
-- 2. TRANSIÇÕES AUTORIZADAS EM PROPOSTAS PRÉ-ASSINADAS (REGRA 3):
--    Em contratos com pré-assinatura profissional e pendentes de paciente:
--    - Transição A (Assinatura do Paciente): Permite exclusivamente anexar a assinatura
--      do paciente e formalização (assinaturaPaciente, status, statusAssinaturaPaciente,
--      isFormalizadoTotal, metadados de PDF), aplicando COMPARAÇÃO INTEGRAL JSONB para
--      impedir absolutamente qualquer alteração simultânea em cláusulas, itens,
--      termos financeiros, parcelas, dados cadastrais, token ou assinatura da Dra.
--      O consentimento de imagem ('termoUsoImagem') só pode mudar mediante estrutura estrita
--      e auditada de consentimento LGPD.
--      As colunas da tabela fora de {assinado_em, assinatura_data, assinante_nome, atualizado_em} são imutáveis.
--    - Transição B (Metadados Administrativos): Aplica lista branca estrita tanto às
--      propriedades JSONB quanto a TODAS as colunas da tabela documentos_clinicos.
--    - Transição C (Retificação Forense Controlada): Se houver alteração de conteúdo ou financeiro,
--      exige OBRIGATORIAMENTE:
--        a) Manutenção de paciente_id, identificador (CTR), tipo e clinica_id;
--        b) Incremento de 'versoesAnteriores' (exatamente v_old + 1);
--        c) CONTROLE DE CONCORRÊNCIA OTIMISTA: A última versão arquivada DEVE coincidir
--           com a versão ('versao') e o token ('token') atualmente ativos no banco;
--        d) Rotação obrigatória para um novo token de acesso;
--        e) Registro explícito do token anterior em 'tokensRevogados';
--        f) Incremento do número da versão ('versao');
--        g) Sincronização atômica do novo token com a tabela 'orcamentos' na mesma transação,
--           com VALIDAÇÃO OBRIGATÓRIA DE EXATAMENTE 1 LINHA AFETADA (ROW_COUNT = 1) em ambos
--           os caminhos (primário e alternativo). Se o orçamento não for encontrado ou se houver
--           múltiplos orçamentos vinculados, aborta a transação integralmente (ROLLBACK).
--
-- 3. INTERCEPTAÇÃO UNIVERSAL: Trigger BEFORE UPDATE com SECURITY DEFINER atua
--    diretamente no motor PostgreSQL, bloqueando tentativas via API, dashboard ou SQL.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.garantir_imutabilidade_contrato_v3()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_formalizado_paciente boolean := false;
  v_tem_preassinatura_dra boolean := false;
  v_qtd_versoes_old integer := 0;
  v_qtd_versoes_new integer := 0;
  v_qtd_revogados_old integer := 0;
  v_qtd_revogados_new integer := 0;
  v_ultima_arquivada jsonb;
  v_orcamento_id text;
  v_linhas_orcamento integer := 0;
  v_eh_assinatura_paciente boolean := false;
  v_eh_metadata_admin boolean := false;
BEGIN
  -- Se o documento não for do tipo 'contrato', permite a alteração normalmente
  IF OLD.tipo IS DISTINCT FROM 'contrato' THEN
    RETURN NEW;
  END IF;

  -- ---------------------------------------------------------------------------
  -- REGRA 1: DETECÇÃO ROBUSTA DE FORMALIZAÇÃO BILATERAL / ASSINATURA DO PACIENTE
  -- (Inclusive proteção de contratos históricos com assinaturaDra, independentemente de outros indicadores)
  -- ---------------------------------------------------------------------------
  v_formalizado_paciente := (
    OLD.assinado_em IS NOT NULL
    OR OLD.assinatura_data IS NOT NULL
    OR (OLD.itens IS NOT NULL AND OLD.itens->'assinaturaPaciente' IS NOT NULL AND jsonb_typeof(OLD.itens->'assinaturaPaciente') = 'object')
    OR (OLD.itens IS NOT NULL AND OLD.itens->'assinaturaDra' IS NOT NULL AND jsonb_typeof(OLD.itens->'assinaturaDra') != 'null')
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'assinaturaDra' IS NOT NULL)
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'statusAssinaturaPaciente' = 'assinado')
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'isFormalizadoTotal' = 'true')
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'status' IN ('formalizado', 'assinado'))
  );

  -- ---------------------------------------------------------------------------
  -- REGRA 2: CONTRATO FORMALIZADO / ASSINADO (BLINDAGEM TOTAL)
  -- ---------------------------------------------------------------------------
  IF v_formalizado_paciente THEN
    -- A) Imutabilidade de colunas estruturais e de dados da tabela documentos_clinicos
    IF (NEW.identificador IS DISTINCT FROM OLD.identificador)
       OR ((NEW.itens->>'contratoId') IS DISTINCT FROM (OLD.itens->>'contratoId')) THEN
      RAISE EXCEPTION 'Violação de integridade: Não é permitido alterar o identificador de um contrato formalizado.';
    END IF;

    IF NEW.paciente_id IS DISTINCT FROM OLD.paciente_id THEN
      RAISE EXCEPTION 'Violação de integridade: Não é permitido alterar o paciente de um contrato formalizado.';
    END IF;

    IF NEW.paciente_nome IS DISTINCT FROM OLD.paciente_nome THEN
      RAISE EXCEPTION 'Violação de integridade: Não é permitido alterar o nome do paciente de um contrato formalizado.';
    END IF;

    IF NEW.tipo IS DISTINCT FROM OLD.tipo THEN
      RAISE EXCEPTION 'Violação de integridade: Não é permitido alterar o tipo de um contrato formalizado.';
    END IF;

    IF NEW.clinica_id IS DISTINCT FROM OLD.clinica_id THEN
      RAISE EXCEPTION 'Violação de integridade: Não é permitido transferir a titularidade de clínica de um contrato formalizado.';
    END IF;

    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Violação de integridade: Não é permitido alterar o criador de um contrato formalizado.';
    END IF;

    IF NEW.conteudo IS DISTINCT FROM OLD.conteudo THEN
      RAISE EXCEPTION 'Violação de integridade: O conteúdo textual de um contrato formalizado é estritamente imutável.';
    END IF;

    IF NEW.titulo IS DISTINCT FROM OLD.titulo THEN
      RAISE EXCEPTION 'Violação de integridade: O título de um contrato formalizado é estritamente imutável.';
    END IF;

    IF NEW.valor_total IS DISTINCT FROM OLD.valor_total THEN
      RAISE EXCEPTION 'Violação de integridade: O valor financeiro de um contrato formalizado é estritamente imutável.';
    END IF;

    IF (OLD.assinado_em IS NOT NULL) AND NEW.assinado_em IS DISTINCT FROM OLD.assinado_em THEN
      RAISE EXCEPTION 'Violação de integridade: O carimbo de formalização de um contrato formalizado não pode ser alterado.';
    END IF;

    IF (OLD.assinatura_data IS NOT NULL) AND NEW.assinatura_data IS DISTINCT FROM OLD.assinatura_data THEN
      RAISE EXCEPTION 'Violação de integridade: A data de assinatura de um contrato formalizado não pode ser alterada.';
    END IF;

    IF NEW.assinante_nome IS DISTINCT FROM OLD.assinante_nome
       OR NEW.dentista IS DISTINCT FROM OLD.dentista
       OR NEW.criado_em IS DISTINCT FROM OLD.criado_em THEN
      RAISE EXCEPTION 'Violação de integridade: Colunas documentais de contrato formalizado são estritamente imutáveis.';
    END IF;

    -- B) Imutabilidade integral de 'itens' (exceto whitelist de metadados administrativos)
    IF (OLD.itens IS NOT NULL) THEN
      IF (OLD.itens - '{pdfUrl,pdf_url,pdfPath,pdfGeradoEm,dadosAuditoria,metadataAuditoria}'::text[])
         IS DISTINCT FROM
         (NEW.itens - '{pdfUrl,pdf_url,pdfPath,pdfGeradoEm,dadosAuditoria,metadataAuditoria}'::text[]) THEN
        RAISE EXCEPTION 'Violação de integridade: Modificação proibida em contrato formalizado. Todos os termos, cláusulas, financeiro e assinaturas são estritamente imutáveis; apenas metadados de PDF e auditoria são permitidos.';
      END IF;

      -- Proteção específica e integral de assinaturaDra histórica se presente
      IF (OLD.itens->'assinaturaDra' IS NOT NULL AND jsonb_typeof(OLD.itens->'assinaturaDra') != 'null')
         AND (NEW.itens->'assinaturaDra') IS DISTINCT FROM (OLD.itens->'assinaturaDra') THEN
        RAISE EXCEPTION 'Violação de integridade: A assinatura histórica da profissional titular (assinaturaDra) é estritamente imutável.';
      END IF;

      -- O status formalizado não pode ser revertido
      IF NEW.itens->>'status' NOT IN ('formalizado', 'assinado') THEN
        RAISE EXCEPTION 'Violação de integridade: O status de um contrato formalizado não pode ser revertido.';
      END IF;

      -- Se já possuía assinatura do paciente, ela não pode ser corrompida ou excluída
      IF (OLD.itens->'assinaturaPaciente' IS NOT NULL AND jsonb_typeof(OLD.itens->'assinaturaPaciente') = 'object')
         AND (NEW.itens->'assinaturaPaciente') IS DISTINCT FROM (OLD.itens->'assinaturaPaciente') THEN
        RAISE EXCEPTION 'Violação de integridade: A assinatura formalizada do paciente não pode ser modificada.';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- ---------------------------------------------------------------------------
  -- REGRA 3: CONTRATO PENDENTE COM PRÉ-ASSINATURA DA PROFISSIONAL
  -- (Ainda aguardando assinatura do paciente: assinado_em IS NULL)
  -- ---------------------------------------------------------------------------
  v_tem_preassinatura_dra := (
    OLD.itens IS NOT NULL 
    AND OLD.itens->'assinaturaDentista' IS NOT NULL 
    AND jsonb_typeof(OLD.itens->'assinaturaDentista') = 'object'
  );

  IF v_tem_preassinatura_dra THEN
    -- A) Imutabilidade cadastral absoluta em propostas emitidas
    IF NEW.paciente_id IS DISTINCT FROM OLD.paciente_id THEN
      RAISE EXCEPTION 'Violação de integridade: Não é permitido alterar o paciente de um contrato emitido.';
    END IF;

    IF NEW.paciente_nome IS DISTINCT FROM OLD.paciente_nome THEN
      RAISE EXCEPTION 'Violação de integridade: Não é permitido alterar o nome do paciente de um contrato emitido.';
    END IF;

    IF (NEW.identificador IS DISTINCT FROM OLD.identificador)
       OR ((NEW.itens->>'contratoId') IS DISTINCT FROM (OLD.itens->>'contratoId')) THEN
      RAISE EXCEPTION 'Violação de integridade: Não é permitido alterar o identificador CTR de um contrato emitido.';
    END IF;

    IF NEW.tipo IS DISTINCT FROM OLD.tipo THEN
      RAISE EXCEPTION 'Violação de integridade: Não é permitido alterar o tipo de um contrato emitido.';
    END IF;

    IF NEW.clinica_id IS DISTINCT FROM OLD.clinica_id THEN
      RAISE EXCEPTION 'Violação de integridade: Não é permitido alterar a clínica de um contrato emitido.';
    END IF;

    -- B) TRANSIÇÕES AUTORIZADAS QUANDO CONTEÚDO E FINANCEIRO NÃO MUDAM:
    IF (NEW.conteudo IS NOT DISTINCT FROM OLD.conteudo)
       AND ((NEW.itens->'financeiro') IS NOT DISTINCT FROM (OLD.itens->'financeiro')) THEN

      -- 1. Transição Autorizada: Assinatura do Paciente
      v_eh_assinatura_paciente := (
        OLD.assinado_em IS NULL
        AND NEW.assinado_em IS NOT NULL
        AND (OLD.itens->'assinaturaPaciente' IS NULL OR jsonb_typeof(OLD.itens->'assinaturaPaciente') = 'null')
        AND (NEW.itens->'assinaturaPaciente' IS NOT NULL AND jsonb_typeof(NEW.itens->'assinaturaPaciente') = 'object')
      );

      -- 2. Transição Autorizada: Atualização Puramente Administrativa de Metadados
      -- Aplica whitelist estrita tanto às propriedades JSONB quanto a TODAS as colunas da tabela
      v_eh_metadata_admin := (
        (OLD.itens - '{pdfUrl,pdf_url,pdfPath,pdfGeradoEm,dadosAuditoria,metadataAuditoria}'::text[])
        IS NOT DISTINCT FROM
        (NEW.itens - '{pdfUrl,pdf_url,pdfPath,pdfGeradoEm,dadosAuditoria,metadataAuditoria}'::text[])
        AND NEW.id IS NOT DISTINCT FROM OLD.id
        AND NEW.identificador IS NOT DISTINCT FROM OLD.identificador
        AND NEW.paciente_id IS NOT DISTINCT FROM OLD.paciente_id
        AND NEW.paciente_nome IS NOT DISTINCT FROM OLD.paciente_nome
        AND NEW.tipo IS NOT DISTINCT FROM OLD.tipo
        AND NEW.clinica_id IS NOT DISTINCT FROM OLD.clinica_id
        AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id
        AND NEW.titulo IS NOT DISTINCT FROM OLD.titulo
        AND NEW.conteudo IS NOT DISTINCT FROM OLD.conteudo
        AND NEW.valor_total IS NOT DISTINCT FROM OLD.valor_total
        AND NEW.dentista IS NOT DISTINCT FROM OLD.dentista
        AND NEW.assinado_em IS NOT DISTINCT FROM OLD.assinado_em
        AND NEW.assinatura_data IS NOT DISTINCT FROM OLD.assinatura_data
        AND NEW.assinante_nome IS NOT DISTINCT FROM OLD.assinante_nome
        AND NEW.criado_em IS NOT DISTINCT FROM OLD.criado_em
      );

      IF v_eh_assinatura_paciente THEN
        -- AJUSTE 1: COMPARAÇÃO INTEGRAL DOS DADOS CONTRATUAIS NA FORMALIZAÇÃO
        -- Permite exclusivamente as propriedades de assinatura e formalização:
        -- {assinaturaPaciente, status, statusAssinaturaPaciente, isFormalizadoTotal, assinadoEm, termoUsoImagem, pdfUrl, pdf_url, pdfPath, pdfGeradoEm, dadosAuditoria, metadataAuditoria}
        IF (OLD.itens - '{assinaturaPaciente,status,statusAssinaturaPaciente,isFormalizadoTotal,assinadoEm,termoUsoImagem,pdfUrl,pdf_url,pdfPath,pdfGeradoEm,dadosAuditoria,metadataAuditoria}'::text[])
           IS DISTINCT FROM
           (NEW.itens - '{assinaturaPaciente,status,statusAssinaturaPaciente,isFormalizadoTotal,assinadoEm,termoUsoImagem,pdfUrl,pdf_url,pdfPath,pdfGeradoEm,dadosAuditoria,metadataAuditoria}'::text[]) THEN
          RAISE EXCEPTION 'Violação de integridade: Comparação integral falhou. Cláusulas, procedimentos, parcelas, financeiro, tokens ou termos contratuais não podem sofrer qualquer alteração durante a assinatura do paciente.';
        END IF;

        -- Validação estrita do consentimento de uso de imagem (anti-adulteração de termoUsoImagem):
        IF (NEW.itens->'termoUsoImagem') IS DISTINCT FROM (OLD.itens->'termoUsoImagem') THEN
          IF NEW.itens->'termoUsoImagem' IS NULL
             OR jsonb_typeof(NEW.itens->'termoUsoImagem') != 'object'
             OR (((NEW.itens->'termoUsoImagem') - '{ativo,autorizado,usoDidaticoCientifico,usoPublicitarioRedesSociais,identificacaoFacialVoz,depoimentos,canalContatoLgpd}'::text[]) IS DISTINCT FROM '{}'::jsonb)
             OR (NEW.itens->'termoUsoImagem'->'autorizado' IS NOT NULL AND jsonb_typeof(NEW.itens->'termoUsoImagem'->'autorizado') != 'boolean') THEN
            RAISE EXCEPTION 'Violação de integridade: O consentimento de uso de imagem contém propriedades não autorizadas ou estrutura inválida.';
          END IF;
        END IF;

        -- Colunas da tabela na formalização: apenas assinado_em, assinatura_data, assinante_nome e atualizado_em podem mudar
        IF NEW.id IS DISTINCT FROM OLD.id
           OR NEW.identificador IS DISTINCT FROM OLD.identificador
           OR NEW.paciente_id IS DISTINCT FROM OLD.paciente_id
           OR NEW.paciente_nome IS DISTINCT FROM OLD.paciente_nome
           OR NEW.tipo IS DISTINCT FROM OLD.tipo
           OR NEW.clinica_id IS DISTINCT FROM OLD.clinica_id
           OR NEW.user_id IS DISTINCT FROM OLD.user_id
           OR NEW.titulo IS DISTINCT FROM OLD.titulo
           OR NEW.conteudo IS DISTINCT FROM OLD.conteudo
           OR NEW.valor_total IS DISTINCT FROM OLD.valor_total
           OR NEW.dentista IS DISTINCT FROM OLD.dentista
           OR NEW.criado_em IS DISTINCT FROM OLD.criado_em THEN
          RAISE EXCEPTION 'Violação de integridade: Colunas cadastrais e estruturais não podem ser alteradas durante a formalização do paciente.';
        END IF;

        -- Status deve transicionar para formalizado/assinado
        IF NEW.itens->>'status' NOT IN ('formalizado', 'assinado') THEN
          RAISE EXCEPTION 'Violação de integridade: O status de formalização deve ser formalizado ou assinado.';
        END IF;

        RETURN NEW;
      ELSIF v_eh_metadata_admin THEN
        -- Atualização puramente administrativa autorizada
        RETURN NEW;
      ELSE
        -- Qualquer outra alteração arbitrária em proposta pré-assinada é bloqueada
        RAISE EXCEPTION 'Violação de integridade: Modificação não autorizada em proposta pré-assinada. Alterações em cláusulas, assinaturas, tokens ou dados cadastrais sem retificação forense são estritamente proibidas.';
      END IF;
    END IF;

    -- C) RETIFICAÇÃO CONTROLADA (ALTERAÇÃO DE CONTEÚDO OU VALORES FINANCEIROS)
    IF (NEW.conteudo IS DISTINCT FROM OLD.conteudo)
       OR ((NEW.itens->'financeiro') IS DISTINCT FROM (OLD.itens->'financeiro')) THEN

      -- Paciente não pode assinar simultaneamente a uma retificação (deve assinar em etapa posterior)
      IF NEW.assinado_em IS NOT NULL OR (NEW.itens->'assinaturaPaciente' IS NOT NULL AND jsonb_typeof(NEW.itens->'assinaturaPaciente') = 'object') THEN
        RAISE EXCEPTION 'Violação de processo: O paciente não pode assinar simultaneamente a uma alteração nos termos contratuais.';
      END IF;

      -- Exigência 1: Histórico de versões obrigatório e controle de concorrência
      IF NEW.itens->'versoesAnteriores' IS NULL OR jsonb_typeof(NEW.itens->'versoesAnteriores') != 'array' THEN
        RAISE EXCEPTION 'Violação de auditoria: A retificação de contrato emitido exige arquivamento da versão anterior em versoesAnteriores.';
      END IF;

      v_qtd_versoes_old := COALESCE(jsonb_array_length(OLD.itens->'versoesAnteriores'), 0);
      v_qtd_versoes_new := jsonb_array_length(NEW.itens->'versoesAnteriores');

      -- Exige exatamente uma versão a mais (impede sobrescrita concorrente ou perda de histórico)
      IF v_qtd_versoes_new != (v_qtd_versoes_old + 1) THEN
        RAISE EXCEPTION 'Violação de concorrência: O contrato foi modificado por outra sessão (esperado: % versões no histórico, recebido: %). Recarregue a página antes de retificar.', v_qtd_versoes_old + 1, v_qtd_versoes_new;
      END IF;

      -- Validação de versão atômica (Optimistic Concurrency Control):
      -- A última versão arquivada DEVE corresponder com exatidão à versão e ao token que estavam ativos no banco!
      v_ultima_arquivada := NEW.itens->'versoesAnteriores'->(v_qtd_versoes_new - 1);

      IF (v_ultima_arquivada->>'versao') IS DISTINCT FROM (OLD.itens->>'versao') THEN
        RAISE EXCEPTION 'Violação de concorrência: A versão anterior arquivada (%) não coincide com a versão ativa no banco (%). Operação abortada para evitar sobrescrita concorrente.', (v_ultima_arquivada->>'versao'), (OLD.itens->>'versao');
      END IF;

      IF (v_ultima_arquivada->>'token') IS DISTINCT FROM (OLD.itens->>'token') THEN
        RAISE EXCEPTION 'Violação de concorrência: O token da versão arquivada não coincide com o token ativo no banco. O contrato foi retificado por outra sessão concorrente.';
      END IF;

      -- Exigência 2: Rotação obrigatória do token de acesso
      IF (NEW.itens->>'token') IS NOT DISTINCT FROM (OLD.itens->>'token') THEN
        RAISE EXCEPTION 'Violação de segurança: A retificação de contrato emitido exige obrigatoriamente a rotação para um novo token de acesso.';
      END IF;

      -- Exigência 3: Registro do token anterior na lista de tokens revogados
      IF NEW.itens->'tokensRevogados' IS NULL OR jsonb_typeof(NEW.itens->'tokensRevogados') != 'array' THEN
        RAISE EXCEPTION 'Violação de segurança: A retificação exige registrar o token anterior na lista tokensRevogados.';
      END IF;

      v_qtd_revogados_old := COALESCE(jsonb_array_length(OLD.itens->'tokensRevogados'), 0);
      v_qtd_revogados_new := jsonb_array_length(NEW.itens->'tokensRevogados');
      IF v_qtd_revogados_new <= v_qtd_revogados_old THEN
        RAISE EXCEPTION 'Violação de segurança: O token de acesso anterior deve ser expressamente adicionado a tokensRevogados.';
      END IF;

      IF NOT (NEW.itens->'tokensRevogados' @> to_jsonb(OLD.itens->>'token')) THEN
        RAISE EXCEPTION 'Violação de segurança: O token anterior específico (%) deve constar em tokensRevogados.', (OLD.itens->>'token');
      END IF;

      -- Exigência 4: Incremento do número da versão
      IF (NEW.itens->>'versao') IS NOT DISTINCT FROM (OLD.itens->>'versao') THEN
        RAISE EXCEPTION 'Violação de auditoria: A retificação de contrato emitido exige incremento do número da versão.';
      END IF;

      -- AJUSTE 3: SINCRONIZAÇÃO ATÔMICA COM VALIDAÇÃO DE EXATAMENTE 1 LINHA (ROW_COUNT = 1)
      v_orcamento_id := COALESCE(NEW.itens->>'orcamentoId', NEW.itens->'orcamento'->>'id');
      IF v_orcamento_id IS NOT NULL AND v_orcamento_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        UPDATE public.orcamentos
        SET contrato_token = NEW.itens->>'token',
            contrato_id = NEW.id::text,
            atualizado_em = now()
        WHERE id = v_orcamento_id::uuid;

        GET DIAGNOSTICS v_linhas_orcamento = ROW_COUNT;
        IF v_linhas_orcamento != 1 THEN
          RAISE EXCEPTION 'Violação de integridade referencial: Esperava-se exatamente 1 orçamento vinculado (%) para sincronização atômica do token, mas % foram afetados. Operação abortada.', v_orcamento_id, v_linhas_orcamento;
        END IF;
      ELSE
        UPDATE public.orcamentos
        SET contrato_token = NEW.itens->>'token',
            atualizado_em = now()
        WHERE contrato_id = NEW.id::text;

        GET DIAGNOSTICS v_linhas_orcamento = ROW_COUNT;
        IF v_linhas_orcamento != 1 THEN
          RAISE EXCEPTION 'Violação de integridade referencial: Esperava-se exatamente 1 orçamento vinculado ao contrato (%) no caminho alternativo, mas % foram afetados. Operação abortada.', NEW.id, v_linhas_orcamento;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
