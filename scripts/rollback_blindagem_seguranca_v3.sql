-- ==============================================================================
-- SCRIPT DE ROLLBACK SEGURO: BLINDAGEM DE SEGURANÇA V3.0
-- Clínica Dra. Rosângela - Data: 2026-11-02
--
-- PRINCÍPIOS ESTRITOS DESTE ROLLBACK:
-- 1. PRESERVAÇÃO TOTAL DE DADOS: NUNCA executa DROP TABLE ou DROP COLUMN.
-- 2. Históricos de autorização, assinaturas, contratos e filas NÃO SÃO APAGADOS.
-- 3. NÃO concede perfil 'admin' a nenhum usuário ou funcionário.
-- 4. Reverte apenas triggers, funções ativas e políticas de bloqueio da V3.0,
--    permitindo a continuidade das operações sem perda de registros reais.
-- ==============================================================================

-- 1. Desativação do trigger de imutabilidade restritiva de contratos
DROP TRIGGER IF EXISTS trg_garantir_imutabilidade_contrato ON public.documentos_clinicos;
DROP FUNCTION IF EXISTS public.garantir_imutabilidade_contrato_v3();

-- 2. Reversão segura das funções da V3.0
DROP FUNCTION IF EXISTS public.enfileirar_ou_processar_pdf(text, uuid, uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.revogar_autorizacao_assinatura(uuid, text);
DROP FUNCTION IF EXISTS public.conceder_autorizacao_assinatura(text, text, text, text, jsonb, uuid);
DROP FUNCTION IF EXISTS public.usuario_possui_perfil_clinica(uuid, uuid, text);

-- 3. Remoção de índices restritivos adicionados pela V3.0 (sem apagar nenhum dado)
DROP INDEX IF EXISTS public.idx_doc_clinicos_identificador_unique;
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
