-- ==============================================================================
-- ROLLBACK: DESATIVAÇÃO DO AGENDAMENTO AUTOMÁTICO DE REPROCESSAMENTO
-- Não exclui tarefas, contratos, assinaturas ou arquivos no Storage
-- ==============================================================================

-- 1. Remove o job agendado no pg_cron se existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('processar-fila-pdf-contratos')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'processar-fila-pdf-contratos');
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- ignora se a extensão cron não estiver ativa
END;
$$;

-- 2. Remove as funções auxiliares de disparo e view de monitoramento
DROP FUNCTION IF EXISTS public.executar_agendamento_processar_fila_pdf();
DROP FUNCTION IF EXISTS public.reconciliar_fila_pdf_timeouts();
DROP VIEW IF EXISTS public.vw_fila_pdf_pendencias;

-- NOTA DE INTEGRIDADE:
-- A tabela public.fila_arquivamento_pdf, os contratos formalizados,
-- as assinaturas e os PDFs no Supabase Storage permanecem 100% INTACTOS e preservados.
