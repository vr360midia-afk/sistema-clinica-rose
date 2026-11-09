-- ==============================================================================
-- ROLLBACK: MÓDULO ETAPAS DO TRATAMENTO E CONFIRMAÇÃO DIGITAL
-- Ambiente: HOMOLOGAÇÃO (fsroaymkuopapwlnknhl)
-- Data: 2026-11-10
-- ==============================================================================

DROP FUNCTION IF EXISTS public.reabrir_procedimento_tratamento(UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.concluir_procedimento_tratamento(UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.assinar_confirmacao_sessao_publica(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.obter_confirmacao_sessao_publica(TEXT);
DROP FUNCTION IF EXISTS public.sincronizar_procedimentos_orcamento(UUID, UUID, TEXT);

DROP TABLE IF EXISTS public.tratamento_historico_alteracoes CASCADE;
DROP TABLE IF EXISTS public.tratamento_confirmacoes CASCADE;
DROP TABLE IF EXISTS public.tratamento_sessoes CASCADE;
DROP TABLE IF EXISTS public.tratamentos_procedimentos CASCADE;
