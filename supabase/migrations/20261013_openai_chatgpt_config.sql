-- ============================================================================
-- Migração: Suporte à API da OpenAI (ChatGPT) no Sistema da Clínica & CRM
-- Permite armazenar a chave de API, modelo padrão e prompt do copiloto
-- ============================================================================

ALTER TABLE configuracoes 
  ADD COLUMN IF NOT EXISTS openai_api_key text,
  ADD COLUMN IF NOT EXISTS openai_model text DEFAULT 'gpt-4o-mini',
  ADD COLUMN IF NOT EXISTS openai_system_prompt text;

COMMENT ON COLUMN configuracoes.openai_api_key IS 'Chave de API oficial da OpenAI (sk-...) para ChatGPT e Whisper';
COMMENT ON COLUMN configuracoes.openai_model IS 'Modelo padrão do ChatGPT (ex: gpt-4o-mini, gpt-4o)';
COMMENT ON COLUMN configuracoes.openai_system_prompt IS 'Instrução do sistema para personalidade do assistente virtual no WhatsApp e CRM';
