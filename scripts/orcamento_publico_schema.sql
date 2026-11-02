-- ==============================================================================
-- SCHEMA & RPCs: ORÇAMENTO ONLINE, SOLICITAÇÃO DE AJUSTE, APROVAÇÃO E CONTRATO
-- Suporte nativo e robusto a CTR-XXXX, ORC-XXXX, códigos de 8 chars e UUIDs
-- ==============================================================================

-- 1. Garante colunas na tabela orcamentos
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS identificador text;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS token_assinatura text;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS data_expiracao_link timestamptz;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS aprovado_em timestamptz;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS condicao_escolhida jsonb;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS snapshot_aprovacao jsonb;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS fotos_planejamento jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS contrato_id text;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS contrato_token text;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS versao integer DEFAULT 1;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS solicitacoes_ajuste jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS historico_versoes jsonb DEFAULT '[]'::jsonb;

-- 2. Índices para performance máxima de consulta
CREATE INDEX IF NOT EXISTS idx_orcamentos_identificador ON public.orcamentos (identificador);
CREATE INDEX IF NOT EXISTS idx_orcamentos_token ON public.orcamentos (token_assinatura);
CREATE INDEX IF NOT EXISTS idx_orcamentos_paciente_id ON public.orcamentos (paciente_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_status ON public.orcamentos (status);

-- 3. Habilita RLS em orcamentos
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
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
  USING (token_assinatura IS NOT NULL)
  WITH CHECK (token_assinatura IS NOT NULL);

DROP POLICY IF EXISTS "Permitir total autenticados em orcamentos" ON public.orcamentos;
CREATE POLICY "Permitir total autenticados em orcamentos"
  ON public.orcamentos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Função RPC: Obter Orçamento Público
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
  v_clean_id text;
  v_clean_token text;
  v_code8 text := NULL;
  v_orc record;
  v_clinica record;
  v_paciente record;
  v_contrato record;
  v_snap jsonb;
  v_token_salvo text;
  v_expira_em timestamptz;
BEGIN
  v_clean_id := trim(COALESCE(p_identificador, ''));
  v_clean_token := trim(COALESCE(p_token, ''));

  IF v_clean_id = '' OR v_clean_token = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Identificador e token são obrigatórios', 'code', 'INVALID_PARAM');
  END IF;

  -- Extrai código de 8 caracteres caso venha com prefixo CTR- ou ORC-
  IF v_clean_id ~* '^(ORC|CTR)-[0-9A-F]{8}$' THEN
    v_code8 := upper(substring(v_clean_id from 5 for 8));
  ELSIF v_clean_id ~* '^[0-9A-F]{8}$' THEN
    v_code8 := upper(v_clean_id);
  ELSIF v_clean_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_code8 := upper(substring(v_clean_id from 1 for 8));
  END IF;

  -- 1. Busca abrangente do orçamento
  SELECT * INTO v_orc
  FROM public.orcamentos
  WHERE (
    (v_clean_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id::text = v_clean_id)
    OR (v_code8 IS NOT NULL AND id::text ILIKE lower(v_code8) || '-%')
    OR (identificador = v_clean_id)
    OR (identificador = upper(v_clean_id))
    OR (v_code8 IS NOT NULL AND identificador = 'ORC-' || v_code8)
    OR (v_code8 IS NOT NULL AND identificador = 'CTR-' || v_code8)
    OR (v_code8 IS NOT NULL AND identificador = v_code8)
    OR (assinatura_paciente->>'identificador' = v_clean_id)
    OR (assinatura_paciente->>'identificador' = upper(v_clean_id))
    OR (v_code8 IS NOT NULL AND assinatura_paciente->>'identificador' = 'ORC-' || v_code8)
    OR (v_code8 IS NOT NULL AND assinatura_paciente->>'identificador' = 'CTR-' || v_code8)
    OR (v_code8 IS NOT NULL AND assinatura_paciente->>'identificador' = v_code8)
    OR (token_assinatura = v_clean_token)
  )
  ORDER BY criado_em DESC
  LIMIT 1;

  IF v_orc.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Orçamento não encontrado. Verifique o link ou solicite um novo à clínica.', 'code', 'NOT_FOUND');
  END IF;

  v_snap := COALESCE(v_orc.assinatura_paciente, '{}'::jsonb);
  v_token_salvo := COALESCE(v_orc.token_assinatura, v_snap->>'token', v_snap->>'tokenAssinatura');

  -- Validação do token de acesso
  IF v_token_salvo IS NULL OR v_token_salvo <> v_clean_token THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Token de segurança inválido. Acesso não autorizado.', 'code', 'INVALID_TOKEN');
  END IF;

  -- Validação de expiração
  v_expira_em := COALESCE(v_orc.data_expiracao_link, (v_snap->>'dataExpiracaoLink')::timestamptz);
  IF v_expira_em IS NOT NULL AND v_expira_em < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Esta proposta de orçamento expirou. Solicite uma nova à clínica.', 'code', 'EXPIRED_TOKEN', 'isExpirado', true);
  END IF;

  -- Busca dados da clínica
  SELECT * INTO v_clinica FROM public.configuracoes LIMIT 1;

  -- Busca dados do paciente
  IF v_orc.paciente_id IS NOT NULL THEN
    SELECT nome, telefone, email, cpf INTO v_paciente FROM public.pacientes WHERE id = v_orc.paciente_id LIMIT 1;
  END IF;

  -- Busca contrato se vinculado
  IF v_orc.contrato_id IS NOT NULL OR v_snap->>'contratoId' IS NOT NULL THEN
    SELECT id, itens INTO v_contrato
    FROM public.documentos_clinicos
    WHERE tipo = 'contrato'
      AND (
        id::text = COALESCE(v_orc.contrato_id, v_snap->>'contratoId')
        OR itens->>'contratoId' = COALESCE(v_orc.contrato_id, v_snap->>'contratoId')
      )
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_orc.id,
    'identificador', COALESCE(v_orc.identificador, v_snap->>'identificador', 'ORC-' || upper(substring(v_orc.id::text from 1 for 8))),
    'titulo', COALESCE(v_orc.titulo, 'Plano de tratamento'),
    'itens', COALESCE(v_orc.itens, '[]'::jsonb),
    'desconto', COALESCE(v_orc.desconto, 0),
    'total', COALESCE(v_orc.total, 0),
    'status', COALESCE(v_orc.status, v_snap->>'status', 'enviado'),
    'versao', COALESCE(v_orc.versao, (v_snap->>'versao')::integer, 1),
    'validade', v_orc.validade,
    'observacoes', v_orc.observacoes,
    'formasPagamento', v_orc.formas_pagamento,
    'fotosPlanejamento', COALESCE(v_orc.fotos_planejamento, v_snap->'fotosPlanejamento', '[]'::jsonb),
    'solicitacoesAjuste', COALESCE(v_orc.solicitacoes_ajuste, v_snap->'solicitacoesAjuste', '[]'::jsonb),
    'historicoVersoes', COALESCE(v_orc.historico_versoes, v_snap->'historicoVersoes', '[]'::jsonb),
    'pacienteId', v_orc.paciente_id,
    'pacienteNome', COALESCE(v_orc.paciente_nome, v_paciente.nome, 'Paciente'),
    'aprovadoEm', COALESCE(v_orc.aprovado_em, v_orc.data_assinatura, (v_snap->>'aprovadoEm')::timestamptz),
    'condicaoEscolhida', COALESCE(v_orc.condicao_escolhida, v_snap->'condicaoEscolhida'),
    'contratoId', COALESCE(v_orc.contrato_id, v_snap->>'contratoId'),
    'contratoToken', COALESCE(v_orc.contrato_token, v_snap->>'contratoToken'),
    'contratoStatus', v_contrato.itens->>'status',
    'contratoIdentificador', v_contrato.itens->>'contratoId',
    'clinica', jsonb_build_object(
      'nome', COALESCE(v_clinica.nome_clinica, 'Clínica Odontológica'),
      'logoUrl', v_clinica.logo_url,
      'telefone', COALESCE(v_clinica.telefone, v_clinica.whatsapp_numero),
      'email', v_clinica.email,
      'dentistaResponsavel', v_clinica.dentista_responsavel,
      'cro', v_clinica.cro
    )
  );
END;
$$;

-- 5. Função RPC: Aprovar Orçamento Público
CREATE OR REPLACE FUNCTION public.aprovar_orcamento_publico(
  p_identificador text,
  p_token text,
  p_condicao jsonb,
  p_evidencias jsonb DEFAULT '{}'::jsonb,
  p_versao_aprovada integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_id text;
  v_clean_token text;
  v_code8 text := NULL;
  v_orc record;
  v_now timestamptz := now();
  v_snap jsonb;
  v_token_salvo text;
  v_versao_atual integer;
  v_novo_snap jsonb;
  v_total numeric;
  v_desconto numeric;
BEGIN
  v_clean_id := trim(COALESCE(p_identificador, ''));
  v_clean_token := trim(COALESCE(p_token, ''));

  IF v_clean_id = '' OR v_clean_token = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Identificador e token são obrigatórios', 'code', 'INVALID_PARAM');
  END IF;

  IF v_clean_id ~* '^(ORC|CTR)-[0-9A-F]{8}$' THEN
    v_code8 := upper(substring(v_clean_id from 5 for 8));
  ELSIF v_clean_id ~* '^[0-9A-F]{8}$' THEN
    v_code8 := upper(v_clean_id);
  ELSIF v_clean_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_code8 := upper(substring(v_clean_id from 1 for 8));
  END IF;

  SELECT * INTO v_orc
  FROM public.orcamentos
  WHERE (
    (v_clean_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id::text = v_clean_id)
    OR (v_code8 IS NOT NULL AND id::text ILIKE lower(v_code8) || '-%')
    OR (identificador = v_clean_id)
    OR (identificador = upper(v_clean_id))
    OR (v_code8 IS NOT NULL AND identificador = 'ORC-' || v_code8)
    OR (v_code8 IS NOT NULL AND identificador = 'CTR-' || v_code8)
    OR (v_code8 IS NOT NULL AND identificador = v_code8)
    OR (assinatura_paciente->>'identificador' = v_clean_id)
    OR (assinatura_paciente->>'identificador' = upper(v_clean_id))
    OR (v_code8 IS NOT NULL AND assinatura_paciente->>'identificador' = 'ORC-' || v_code8)
    OR (v_code8 IS NOT NULL AND assinatura_paciente->>'identificador' = 'CTR-' || v_code8)
    OR (v_code8 IS NOT NULL AND assinatura_paciente->>'identificador' = v_code8)
    OR (token_assinatura = v_clean_token)
  )
  FOR UPDATE;

  IF v_orc.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Orçamento não encontrado', 'code', 'NOT_FOUND');
  END IF;

  v_snap := COALESCE(v_orc.assinatura_paciente, '{}'::jsonb);
  v_token_salvo := COALESCE(v_orc.token_assinatura, v_snap->>'token', v_snap->>'tokenAssinatura');

  IF v_token_salvo IS NULL OR v_token_salvo <> v_clean_token THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Token de acesso inválido', 'code', 'INVALID_TOKEN');
  END IF;

  -- Bloqueio estrito de aprovação duplicada (idempotente)
  IF v_orc.status = 'aprovado' OR v_snap->>'status' = 'aprovado' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'jaAprovado', true,
      'mensagem', 'Este orçamento já foi aprovado anteriormente.',
      'id', v_orc.id,
      'aprovadoEm', COALESCE(v_orc.aprovado_em, v_orc.data_assinatura, (v_snap->>'aprovadoEm')::timestamptz),
      'condicaoEscolhida', COALESCE(v_orc.condicao_escolhida, v_snap->'condicaoEscolhida')
    );
  END IF;

  v_versao_atual := COALESCE(v_orc.versao, (v_snap->>'versao')::integer, 1);
  IF p_versao_aprovada IS NOT NULL AND p_versao_aprovada <> v_versao_atual THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Versão desatualizada. Por favor, recarregue a página.', 'code', 'OUTDATED_VERSION');
  END IF;

  v_total := COALESCE((p_condicao->>'valorTotal')::numeric, v_orc.total);
  v_desconto := COALESCE((p_condicao->>'valorDesconto')::numeric, v_orc.desconto);

  v_novo_snap := v_snap || jsonb_build_object(
    'status', 'aprovado',
    'aprovadoEm', v_now,
    'condicaoEscolhida', p_condicao,
    'versaoAprovada', v_versao_atual,
    'snapshotAprovacao', jsonb_build_object(
      'condicao', p_condicao,
      'aprovadoEm', v_now,
      'versao', v_versao_atual,
      'evidencias', p_evidencias
    )
  );

  UPDATE public.orcamentos
  SET
    status = 'aprovado',
    desconto = v_desconto,
    total = v_total,
    data_assinatura = v_now,
    aprovado_em = v_now,
    condicao_escolhida = p_condicao,
    snapshot_aprovacao = jsonb_build_object('condicao', p_condicao, 'aprovadoEm', v_now, 'versao', v_versao_atual, 'evidencias', p_evidencias),
    assinatura_paciente = v_novo_snap,
    atualizado_em = v_now
  WHERE id = v_orc.id;

  -- Atualiza status do paciente para 'Em Tratamento'
  IF v_orc.paciente_id IS NOT NULL THEN
    UPDATE public.pacientes SET status = 'Em Tratamento', atualizado_em = v_now WHERE id = v_orc.paciente_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_orc.id,
    'identificador', COALESCE(v_orc.identificador, v_snap->>'identificador', v_clean_id),
    'status', 'aprovado',
    'aprovadoEm', v_now,
    'condicaoEscolhida', p_condicao
  );
END;
$$;

-- 6. Função RPC: Solicitar Ajuste no Orçamento pelo Paciente
CREATE OR REPLACE FUNCTION public.solicitar_ajuste_orcamento_publico(
  p_identificador text,
  p_token text,
  p_motivo text,
  p_mensagem text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_id text;
  v_clean_token text;
  v_code8 text := NULL;
  v_orc record;
  v_now timestamptz := now();
  v_snap jsonb;
  v_token_salvo text;
  v_versao integer;
  v_solicitacao jsonb;
  v_novas_solicitacoes jsonb;
  v_novo_snap jsonb;
BEGIN
  v_clean_id := trim(COALESCE(p_identificador, ''));
  v_clean_token := trim(COALESCE(p_token, ''));

  IF v_clean_id = '' OR v_clean_token = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Identificador e token são obrigatórios', 'code', 'INVALID_PARAM');
  END IF;

  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Informe o motivo do ajuste.', 'code', 'INVALID_PARAM');
  END IF;

  IF v_clean_id ~* '^(ORC|CTR)-[0-9A-F]{8}$' THEN
    v_code8 := upper(substring(v_clean_id from 5 for 8));
  ELSIF v_clean_id ~* '^[0-9A-F]{8}$' THEN
    v_code8 := upper(v_clean_id);
  ELSIF v_clean_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_code8 := upper(substring(v_clean_id from 1 for 8));
  END IF;

  SELECT * INTO v_orc
  FROM public.orcamentos
  WHERE (
    (v_clean_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id::text = v_clean_id)
    OR (v_code8 IS NOT NULL AND id::text ILIKE lower(v_code8) || '-%')
    OR (identificador = v_clean_id)
    OR (identificador = upper(v_clean_id))
    OR (v_code8 IS NOT NULL AND identificador = 'ORC-' || v_code8)
    OR (v_code8 IS NOT NULL AND identificador = 'CTR-' || v_code8)
    OR (v_code8 IS NOT NULL AND identificador = v_code8)
    OR (assinatura_paciente->>'identificador' = v_clean_id)
    OR (assinatura_paciente->>'identificador' = upper(v_clean_id))
    OR (v_code8 IS NOT NULL AND assinatura_paciente->>'identificador' = 'ORC-' || v_code8)
    OR (v_code8 IS NOT NULL AND assinatura_paciente->>'identificador' = 'CTR-' || v_code8)
    OR (v_code8 IS NOT NULL AND assinatura_paciente->>'identificador' = v_code8)
    OR (token_assinatura = v_clean_token)
  )
  FOR UPDATE;

  IF v_orc.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Orçamento não encontrado', 'code', 'NOT_FOUND');
  END IF;

  v_snap := COALESCE(v_orc.assinatura_paciente, '{}'::jsonb);
  v_token_salvo := COALESCE(v_orc.token_assinatura, v_snap->>'token', v_snap->>'tokenAssinatura');

  IF v_token_salvo IS NULL OR v_token_salvo <> v_clean_token THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Token de acesso inválido', 'code', 'INVALID_TOKEN');
  END IF;

  IF v_orc.status = 'aprovado' OR v_snap->>'status' = 'aprovado' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Este orçamento já foi aprovado e não aceita mais solicitações de alteração.', 'code', 'ALREADY_APPROVED');
  END IF;

  v_versao := COALESCE(v_orc.versao, (v_snap->>'versao')::integer, 1);

  v_solicitacao := jsonb_build_object(
    'id', 'ajuste-' || extract(epoch from v_now)::bigint::text || '-' || floor(random() * 1000)::text,
    'orcamentoId', v_orc.id,
    'pacienteId', v_orc.paciente_id,
    'pacienteNome', v_orc.paciente_nome,
    'versaoOrcamento', v_versao,
    'motivo', trim(p_motivo),
    'mensagem', CASE WHEN p_mensagem IS NOT NULL AND trim(p_mensagem) <> '' THEN trim(p_mensagem) ELSE NULL END,
    'solicitadaEm', v_now,
    'atendida', false
  );

  v_novas_solicitacoes := COALESCE(v_orc.solicitacoes_ajuste, v_snap->'solicitacoesAjuste', '[]'::jsonb) || jsonb_build_array(v_solicitacao);

  v_novo_snap := v_snap || jsonb_build_object(
    'status', 'ajuste_solicitado',
    'solicitacoesAjuste', v_novas_solicitacoes
  );

  UPDATE public.orcamentos
  SET
    status = 'ajuste_solicitado',
    solicitacoes_ajuste = v_novas_solicitacoes,
    assinatura_paciente = v_novo_snap,
    atualizado_em = v_now
  WHERE id = v_orc.id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_orc.id,
    'identificador', COALESCE(v_orc.identificador, v_snap->>'identificador', v_clean_id),
    'status', 'ajuste_solicitado',
    'versao', v_versao,
    'solicitadaEm', v_now,
    'solicitacao', v_solicitacao
  );
END;
$$;
