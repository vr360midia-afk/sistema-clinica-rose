-- ==============================================================================
-- POLÍTICAS RLS PARA LEITURA E ASSINATURA PÚBLICA DE CONTRATOS (PACIENTE VIA LINK)
-- ==============================================================================

-- Garante RLS habilitado na tabela de documentos clínicos
ALTER TABLE documentos_clinicos ENABLE ROW LEVEL SECURITY;

-- 1. Leitura pública de contratos pelo ID (permite que o paciente visualize seu contrato sem login)
DROP POLICY IF EXISTS "Permitir leitura publica de contratos" ON documentos_clinicos;
CREATE POLICY "Permitir leitura publica de contratos"
  ON documentos_clinicos
  FOR SELECT
  TO anon, authenticated
  USING (tipo = 'contrato');

-- 2. Atualização pública da assinatura do contrato pelo paciente (sem login)
DROP POLICY IF EXISTS "Permitir assinatura publica de contratos" ON documentos_clinicos;
CREATE POLICY "Permitir assinatura publica de contratos"
  ON documentos_clinicos
  FOR UPDATE
  TO anon, authenticated
  USING (tipo = 'contrato')
  WITH CHECK (tipo = 'contrato');
