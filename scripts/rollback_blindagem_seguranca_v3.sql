-- ==============================================================================
-- SCRIPT DE ROLLBACK SEGURO: BLINDAGEM DE SEGURANÇA V3.0
-- Clínica Dra. Rosângela - Data: 2026-11-02
--
-- PRINCÍPIOS ESTRITOS DESTE ROLLBACK:
-- 1. PRESERVAÇÃO TOTAL DE DADOS: NUNCA executa DROP TABLE ou DROP COLUMN.
-- 2. Históricos de autorização, assinaturas, contratos e filas NÃO SÃO APAGADOS.
-- 3. NÃO DEIXA CONTRATOS ASSINADOS DESPROTEGIDOS: Restaura a proteção estável
--    compatível, impedindo alteração de cláusulas, valores ou remoção de assinaturas.
-- 4. Reverte apenas funções ativas e índices restritivos específicos da V3.0,
--    permitindo a continuidade das operações sem perda de registros reais.
-- ==============================================================================

-- 1. Restauração da proteção de imutabilidade compatível para contratos formalizados
-- (Garante que contratos já assinados NUNCA fiquem desprotegidos contra adulteração)
CREATE OR REPLACE FUNCTION public.garantir_protecao_contratos_assinados_compat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Se for contrato e já possuir assinatura (paciente ou profissional)
  IF OLD.tipo = 'contrato' AND (
    OLD.assinado_em IS NOT NULL 
    OR OLD.assinatura_data IS NOT NULL 
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'assinaturaPaciente' IS NOT NULL)
  ) THEN
    -- Proíbe remoção da data ou traço de assinatura de contrato formalizado
    IF NEW.assinado_em IS NULL AND OLD.assinado_em IS NOT NULL THEN
      RAISE EXCEPTION 'Operação não permitida: A data de assinatura de um contrato formalizado não pode ser removida.';
    END IF;

    IF NEW.assinatura_data IS NULL AND OLD.assinatura_data IS NOT NULL THEN
      RAISE EXCEPTION 'Operação não permitida: O registro de assinatura gráfica de um contrato formalizado não pode ser removido.';
    END IF;

    -- Proíbe alteração substancial do conteúdo textual de contrato assinado
    IF NEW.conteudo IS DISTINCT FROM OLD.conteudo THEN
      RAISE EXCEPTION 'Operação não permitida: O conteúdo textual de um contrato formalizado é estritamente imutável.';
    END IF;

    -- Proíbe alteração de valores de contrato assinado
    IF NEW.valor_total IS DISTINCT FROM OLD.valor_total THEN
      RAISE EXCEPTION 'Operação não permitida: O valor financeiro de um contrato formalizado é estritamente imutável.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_garantir_imutabilidade_contrato ON public.documentos_clinicos;
CREATE TRIGGER trg_garantir_imutabilidade_contrato
  BEFORE UPDATE ON public.documentos_clinicos
  FOR EACH ROW
  EXECUTE FUNCTION public.garantir_protecao_contratos_assinados_compat();

-- 2. Reversão segura das funções da V3.0
DROP FUNCTION IF EXISTS public.enfileirar_ou_processar_pdf(text, uuid, uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.revogar_autorizacao_assinatura(uuid, text);
DROP FUNCTION IF EXISTS public.conceder_autorizacao_assinatura(text, text, text, text, jsonb, uuid);
DROP FUNCTION IF EXISTS public.usuario_possui_perfil_clinica(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.contrato_obter_clinica_id();
DROP FUNCTION IF EXISTS public.garantir_imutabilidade_contrato_v3();

-- 3. Remoção de índices adicionados pela V3.0 (sem apagar nenhum dado)
DROP INDEX IF EXISTS public.idx_doc_clinicos_identificador;
DROP INDEX IF EXISTS public.idx_doc_clinicos_token_busca;
DROP INDEX IF EXISTS public.idx_doc_clinicos_contratoid_busca;
DROP INDEX IF EXISTS public.idx_doc_clinicos_paciente_tipo;
DROP INDEX IF EXISTS public.idx_user_roles_user_clinica;
DROP INDEX IF EXISTS public.idx_fila_pdf_contrato_unique;
DROP INDEX IF EXISTS public.idx_fila_pdf_status_tentativas;
DROP INDEX IF EXISTS public.idx_autorizacao_prof_ativa_unique;

-- 4. PRESERVAÇÃO INTEGRAL DAS TABELAS DE DADOS:
-- As tabelas abaixo e seus registros (históricos, filas e autorizações)
-- são MANTIDAS INTACTAS para fins de auditoria, conformidade legal e rastreabilidade:
--   - public.autorizacoes_assinatura_profissional (PRESERVADA)
--   - public.historico_autorizacoes_assinatura (PRESERVADA)
--   - public.fila_arquivamento_pdf (PRESERVADA)
--   - public.documentos_clinicos (PRESERVADA)
--   - public.orcamentos (PRESERVADA)
--   - public.documentos_paciente (PRESERVADA)

-- 5. Notifica o PostgREST para recarregar o schema
NOTIFY pgrst, 'reload schema';
