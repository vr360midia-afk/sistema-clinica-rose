-- ==============================================================================
-- SCHEMA: JORNADA DE ORÇAMENTO ONLINE -> APROVAÇÃO -> CONTRATO DIGITAL
-- Data: 2026-11-02
-- ==============================================================================

-- 1. Garante colunas necessárias na tabela orcamentos
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS identificador text;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS token_assinatura text;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS data_expiracao_link timestamptz;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS aprovado_em timestamptz;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS condicao_escolhida jsonb;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS snapshot_aprovacao jsonb;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS fotos_planejamento jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS contrato_id text;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS contrato_token text;

-- 2. Índices de alta performance para busca rápida
CREATE INDEX IF NOT EXISTS idx_orcamentos_identificador ON public.orcamentos (identificador);
CREATE INDEX IF NOT EXISTS idx_orcamentos_token ON public.orcamentos (token_assinatura);
CREATE INDEX IF NOT EXISTS idx_orcamentos_paciente_id ON public.orcamentos (paciente_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_status ON public.orcamentos (status);

-- 3. Habilita RLS em orcamentos
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para orcamentos
DROP POLICY IF EXISTS "Permitir leitura publica de orcamentos por token" ON public.orcamentos;
CREATE POLICY "Permitir leitura publica de orcamentos por token"
  ON public.orcamentos
  FOR SELECT
  TO anon, authenticated
  USING (token_assinatura IS NOT NULL);

DROP POLICY IF EXISTS "Permitir aprovacao publica de orcamentos" ON public.orcamentos;
CREATE POLICY "Permitir aprovacao publica de orcamentos"
  ON public.orcamentos
  FOR UPDATE
  TO anon, authenticated
  USING (token_assinatura IS NOT NULL AND (status IS NULL OR status <> 'aprovado'))
  WITH CHECK (token_assinatura IS NOT NULL);

DROP POLICY IF EXISTS "Permitir total autenticados em orcamentos" ON public.orcamentos;
CREATE POLICY "Permitir total autenticados em orcamentos"
  ON public.orcamentos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Função RPC: Obter orçamento público com validação de token e regras de negócio
CREATE OR REPLACE FUNCTION public.obter_orcamento_publico(
  p_identificador text,
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orc record;
  v_token_salvo text;
  v_expira_em timestamptz;
  v_clinica record;
  v_paciente record;
  v_contrato record;
BEGIN
  IF p_identificador IS NULL OR trim(p_identificador) = '' OR p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Identificador e token são obrigatórios');
  END IF;

  -- Localiza o orçamento por UUID ou Identificador amigável (ex: ORC-12345678)
  SELECT * INTO v_orc
  FROM public.orcamentos
  WHERE (
    (p_identificador ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id::text = p_identificador)
    OR (identificador = p_identificador)
    OR (identificador = upper(p_identificador))
    OR (id::text = p_identificador)
  )
  ORDER BY criado_em DESC
  LIMIT 1;

  IF v_orc.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Orçamento não encontrado');
  END IF;

  -- Validação estrita do token
  v_token_salvo := v_orc.token_assinatura;
  IF v_token_salvo IS NULL OR trim(v_token_salvo) = '' OR v_token_salvo <> trim(p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Token de acesso inválido ou expirado');
  END IF;

  -- Validação de expiração
  v_expira_em := v_orc.data_expiracao_link;
  IF v_expira_em IS NOT NULL AND v_expira_em < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Esta proposta de orçamento expirou. Solicite uma nova à clínica.');
  END IF;

  -- Dados do paciente
  IF v_orc.paciente_id IS NOT NULL THEN
    SELECT nome, telefone, email, cpf INTO v_paciente
    FROM public.pacientes
    WHERE id = v_orc.paciente_id
    LIMIT 1;
  END IF;

  -- Dados da clínica (se configurado)
  SELECT * INTO v_clinica FROM public.configuracoes LIMIT 1;

  -- Verifica se já existe contrato emitido vinculado a este orçamento
  IF v_orc.contrato_id IS NOT NULL THEN
    SELECT id, itens INTO v_contrato
    FROM public.documentos_clinicos
    WHERE tipo = 'contrato'
      AND (id::text = v_orc.contrato_id OR itens->>'contratoId' = v_orc.contrato_id)
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_orc.id,
    'identificador', COALESCE(v_orc.identificador, 'ORC-' || upper(substring(v_orc.id::text from 1 for 8))),
    'titulo', v_orc.titulo,
    'itens', v_orc.itens,
    'desconto', v_orc.desconto,
    'total', v_orc.total,
    'status', v_orc.status,
    'validade', v_orc.validade,
    'observacoes', v_orc.observacoes,
    'formasPagamento', v_orc.formas_pagamento,
    'fotosPlanejamento', COALESCE(v_orc.fotos_planejamento, '[]'::jsonb),
    'pacienteId', v_orc.paciente_id,
    'pacienteNome', COALESCE(v_orc.paciente_nome, v_paciente.nome, 'Paciente'),
    'aprovadoEm', v_orc.aprovado_em,
    'condicaoEscolhida', v_orc.condicao_escolhida,
    'contratoId', v_orc.contrato_id,
    'contratoToken', v_orc.contrato_token,
    'contratoStatus', v_contrato.itens->>'status',
    'contratoIdentificador', v_contrato.itens->>'contratoId',
    'clinica', jsonb_build_object(
      'nome', COALESCE(v_clinica.nome_clinica, 'Clínica Odontológica'),
      'logoUrl', v_clinica.logo_url,
      'telefone', v_clinica.telefone,
      'email', v_clinica.email,
      'dentistaResponsavel', v_clinica.dentista_responsavel,
      'cro', v_clinica.cro
    )
  );
END;
$$;

-- 5. Função RPC: Aprovar orçamento com bloqueio atômico de aprovação duplicada
CREATE OR REPLACE FUNCTION public.aprovar_orcamento_publico(
  p_identificador text,
  p_token text,
  p_condicao jsonb,
  p_evidencias jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orc record;
  v_now timestamptz := now();
  v_novo_snapshot jsonb;
BEGIN
  IF p_identificador IS NULL OR trim(p_identificador) = '' OR p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Identificador e token são obrigatórios');
  END IF;

  -- Busca o orçamento com lock para garantir atomicidade
  SELECT * INTO v_orc
  FROM public.orcamentos
  WHERE (
    (p_identificador ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id::text = p_identificador)
    OR (identificador = p_identificador)
    OR (identificador = upper(p_identificador))
    OR (id::text = p_identificador)
  )
  FOR UPDATE;

  IF v_orc.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Orçamento não encontrado');
  END IF;

  -- Validação estrita do token
  IF v_orc.token_assinatura IS NULL OR v_orc.token_assinatura <> trim(p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Token de acesso inválido');
  END IF;

  -- Bloqueio estrito de aprovação duplicada
  IF v_orc.status = 'aprovado' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'jaAprovado', true,
      'mensagem', 'Este orçamento já foi aprovado anteriormente.',
      'id', v_orc.id,
      'aprovadoEm', v_orc.aprovado_em,
      'condicaoEscolhida', v_orc.condicao_escolhida,
      'contratoId', v_orc.contrato_id,
      'contratoToken', v_orc.contrato_token
    );
  END IF;

  -- Monta snapshot congelado da versão aprovada
  v_novo_snapshot := jsonb_build_object(
    'orcamentoId', v_orc.id,
    'identificador', COALESCE(v_orc.identificador, 'ORC-' || upper(substring(v_orc.id::text from 1 for 8))),
    'titulo', v_orc.titulo,
    'itens', v_orc.itens,
    'desconto', v_orc.desconto,
    'total', v_orc.total,
    'condicaoEscolhida', p_condicao,
    'aprovadoEm', v_now,
    'pacienteNome', v_orc.paciente_nome,
    'pacienteId', v_orc.paciente_id,
    'evidencias', p_evidencias
  );

  -- Atualiza o orçamento no banco
  UPDATE public.orcamentos
  SET
    status = 'aprovado',
    aprovado_em = v_now,
    condicao_escolhida = p_condicao,
    snapshot_aprovacao = v_novo_snapshot,
    atualizado_em = v_now
  WHERE id = v_orc.id;

  -- Se houver paciente vinculado, atualiza status para 'Em Tratamento'
  IF v_orc.paciente_id IS NOT NULL THEN
    BEGIN
      UPDATE public.pacientes
      SET
        status = 'Em Tratamento',
        atualizado_em = v_now
      WHERE id = v_orc.paciente_id;
    EXCEPTION WHEN OTHERS THEN
    END;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_orc.id,
    'identificador', COALESCE(v_orc.identificador, 'ORC-' || upper(substring(v_orc.id::text from 1 for 8))),
    'status', 'aprovado',
    'aprovadoEm', v_now,
    'condicaoEscolhida', p_condicao
  );
END;
$$;

