-- ============================================================================
-- SCRIPT SQL: Habilitar OpenAI ChatGPT na tabela configuracoes
-- Execute no SQL Editor do Supabase (https://app.supabase.com)
-- ============================================================================

ALTER TABLE configuracoes 
  ADD COLUMN IF NOT EXISTS openai_api_key text,
  ADD COLUMN IF NOT EXISTS openai_model text DEFAULT 'gpt-4o-mini',
  ADD COLUMN IF NOT EXISTS openai_system_prompt text;

COMMENT ON COLUMN configuracoes.openai_api_key IS 'Chave de API oficial da OpenAI (sk-...) para ChatGPT e Whisper';
COMMENT ON COLUMN configuracoes.openai_model IS 'Modelo padrão do ChatGPT (ex: gpt-4o-mini, gpt-4o)';
COMMENT ON COLUMN configuracoes.openai_system_prompt IS 'Instrução do sistema para personalidade do assistente virtual no WhatsApp e CRM';

-- Verifica se as colunas foram criadas com sucesso
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'configuracoes' 
  AND column_name IN ('openai_api_key', 'openai_model', 'openai_system_prompt');
