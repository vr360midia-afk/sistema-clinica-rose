-- ==============================================================================
-- SCRIPT DE ROLLBACK SEGURO: BLINDAGEM DE SEGURANÇA V3.0
-- Clínica Dra. Rosângela - Data: 2026-11-02
--
-- PRINCÍPIOS DESTE ROLLBACK:
-- 1. Totalmente não-destrutivo para dados de pacientes, orçamentos e contratos.
-- 2. NÃO concede permissões 'admin' a nenhum usuário ou funcionário.
-- 3. Restaura o estado anterior das funções, triggers e tabelas da V3.0.
-- ==============================================================================

-- 1. Remove o trigger de imutabilidade se necessário
DROP TRIGGER IF EXISTS trg_garantir_imutabilidade_contrato ON public.documentos_clinicos;
DROP FUNCTION IF EXISTS public.garantir_imutabilidade_contrato_v3();

-- 2. Remove as funções de fila e autorização
DROP FUNCTION IF EXISTS public.enfileirar_ou_processar_pdf(text, uuid, uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.revogar_autorizacao_assinatura(uuid, text);
DROP FUNCTION IF EXISTS public.conceder_autorizacao_assinatura(text, text, text, text, jsonb, uuid);
DROP FUNCTION IF EXISTS public.usuario_possui_perfil_clinica(uuid, uuid, text);

-- 3. Remove índices adicionados pela V3.0 (sem afetar dados)
DROP INDEX IF EXISTS public.idx_doc_clinicos_identificador_unique;
DROP INDEX IF EXISTS public.idx_doc_clinicos_paciente_tipo;
DROP INDEX IF EXISTS public.idx_user_roles_user_clinica;
DROP INDEX IF EXISTS public.idx_fila_pdf_contrato_unique;
DROP INDEX IF EXISTS public.idx_fila_pdf_status_tentativas;
DROP INDEX IF EXISTS public.idx_autorizacao_prof_ativa_unique;

-- 4. Tabelas de suporte da V3.0 (Remoção opcional se for desejado desfazer completamente)
-- NOTA: Os dados existentes em documentos_clinicos e orcamentos permanecem 100% intactos.
DROP TABLE IF EXISTS public.fila_arquivamento_pdf CASCADE;
DROP TABLE IF EXISTS public.historico_autorizacoes_assinatura CASCADE;
DROP TABLE IF EXISTS public.autorizacoes_assinatura_profissional CASCADE;

-- 5. Notifica o PostgREST para recarregar o schema
NOTIFY pgrst, 'reload schema';
