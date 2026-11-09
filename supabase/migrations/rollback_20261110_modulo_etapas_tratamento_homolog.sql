-- ==============================================================================
-- PLANO DE ROLLBACK NÃO DESTRUTIVO: MÓDULO ETAPAS DO TRATAMENTO
-- Ambiente: PRODUÇÃO E HOMOLOGAÇÃO
-- Data de Validação: 2026-11-10
-- ==============================================================================
--
-- PRINCÍPIOS DE SEGURANÇA E NÃO DESTRUIÇÃO:
-- 1. PROIBIÇÃO ABSOLUTA DE "DROP TABLE CASCADE":
--    Sessões clínicas, confirmações com assinaturas eletrônicas de pacientes,
--    hashes de integridade e auditorias cronológicas possuem valor médico,
--    legal e probatório. Sob NENHUMA hipótese devem ser excluídas via DROP TABLE.
--
-- 2. REVERSÃO VIA FRONTEND (ZERO IMPACTO EM DADOS):
--    A aplicação web em produção (commit be1f710) não faz chamadas às tabelas de tratamento.
--    Caso seja necessário suspender o módulo de Etapas do Tratamento, basta realizar
--    o redeploy do commit anterior no Cloudflare Pages. O frontend voltará
--    ao estado anterior imediatamente, tornando o módulo invisível aos usuários
--    sem apagar qualquer dado no banco.
--
-- 3. SUSPENSÃO CONTROLADA NO BANCO DE DADOS (SOFT-FREEZE / ROLLBACK SEGURO):
--    Se for necessário suspender operações do módulo no banco sem apagar os dados:
--    a) Revogam-se as permissões de execução das RPCs de sincronização e assinatura;
--    b) Mantêm-se todas as 4 tabelas, índices e dados históricos preservados para consulta clínica;
--    c) Mantêm-se os termos em documentos_clinicos intactos para download e auditoria legal.
-- ==============================================================================

-- ETAPA 1: SUSPENDER NOVAS OPERAÇÕES (FREEZE SELETIVO DE ESCRITA)
REVOKE EXECUTE ON FUNCTION public.sincronizar_procedimentos_orcamento(UUID, UUID, TEXT, INTEGER[]) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assinar_confirmacao_sessao_publica(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.concluir_procedimento_tratamento(UUID, UUID, TEXT, TEXT) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reabrir_procedimento_tratamento(UUID, UUID, TEXT, TEXT) FROM authenticated, anon, PUBLIC;

-- ETAPA 2: PRESERVAÇÃO INTEGRAL DE DADOS E AUDITORIA (CONSULTA SOMENTE-LEITURA)
-- As tabelas abaixo PERMANECEM 100% INTACTAS com seus registros, integridade e chaves:
-- - public.tratamentos_procedimentos
-- - public.tratamento_sessoes
-- - public.tratamento_confirmacoes
-- - public.tratamento_historico_alteracoes
-- - public.documentos_clinicos

COMMENT ON TABLE public.tratamentos_procedimentos IS 'Módulo Etapas do Tratamento (Rollback Ativo: Dados Preservados em Modo Somente-Leitura)';
COMMENT ON TABLE public.tratamento_sessoes IS 'Módulo Etapas do Tratamento - Sessões (Rollback Ativo: Dados Preservados em Modo Somente-Leitura)';
COMMENT ON TABLE public.tratamento_confirmacoes IS 'Módulo Etapas do Tratamento - Confirmações e Assinaturas (Rollback Ativo: Dados Preservados em Modo Somente-Leitura)';
COMMENT ON TABLE public.tratamento_historico_alteracoes IS 'Módulo Etapas do Tratamento - Auditoria Cronológica (Rollback Ativo: Dados Preservados em Modo Somente-Leitura)';
