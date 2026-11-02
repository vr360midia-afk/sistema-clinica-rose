-- ==============================================================================
-- SCHEMA & RPCs: ORÇAMENTO ONLINE, SOLICITAÇÃO DE AJUSTE, APROVAÇÃO E CONTRATO
-- Suporte nativo e robusto a CTR-XXXX, ORC-XXXX, códigos de 8 chars e UUIDs
-- Com geração automática de contrato e assinatura autorizada da profissional
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

-- 2. Tabela de Autorização de Assinatura Profissional
CREATE TABLE IF NOT EXISTS public.autorizacoes_assinatura_profissional (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  profissional_nome text NOT NULL DEFAULT 'Dra. Rosângela Santos Pereira',
  profissional_cro text NOT NULL DEFAULT '06267-AL',
  profissional_documento text NOT NULL DEFAULT '032.663.962-43',
  autorizacao_expressa text NOT NULL,
  modelos_autorizados jsonb NOT NULL DEFAULT '["geral", "lentes_resina", "endodontia"]'::jsonb,
  condicoes_abrangidas jsonb NOT NULL DEFAULT '{"apenas_orcamentos_aprovados": true}'::jsonb,
  assinatura_grafica text NULL,
  ativo boolean NOT NULL DEFAULT true,
  autorizado_em timestamptz NOT NULL DEFAULT now(),
  revogado_em timestamptz NULL,
  revogado_por uuid NULL,
  motivo_revogacao text NULL,
  evidencias jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.autorizacoes_assinatura_profissional ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_autorizacoes_profissional_cro_ativo
  ON public.autorizacoes_assinatura_profissional (profissional_cro, ativo);

DROP POLICY IF EXISTS "Permitir leitura publica de autorizacoes ativas" ON public.autorizacoes_assinatura_profissional;
CREATE POLICY "Permitir leitura publica de autorizacoes ativas"
  ON public.autorizacoes_assinatura_profissional
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Permitir gestao total para autenticados em autorizacoes" ON public.autorizacoes_assinatura_profissional;
CREATE POLICY "Permitir gestao total para autenticados em autorizacoes"
  ON public.autorizacoes_assinatura_profissional
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Índices para performance máxima de consulta
CREATE INDEX IF NOT EXISTS idx_orcamentos_identificador ON public.orcamentos (identificador);
CREATE INDEX IF NOT EXISTS idx_orcamentos_token ON public.orcamentos (token_assinatura);
CREATE INDEX IF NOT EXISTS idx_orcamentos_paciente_id ON public.orcamentos (paciente_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_status ON public.orcamentos (status);

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
  ORDER BY criado_em DESC
  LIMIT 1;

  IF v_orc.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Orçamento não encontrado. Verifique o link ou solicite um novo à clínica.', 'code', 'NOT_FOUND');
  END IF;

  v_snap := COALESCE(v_orc.assinatura_paciente, '{}'::jsonb);
  v_token_salvo := COALESCE(v_orc.token_assinatura, v_snap->>'token', v_snap->>'tokenAssinatura');

  IF v_token_salvo IS NULL OR v_token_salvo <> v_clean_token THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Token de segurança inválido. Acesso não autorizado.', 'code', 'INVALID_TOKEN');
  END IF;

  v_expira_em := COALESCE(v_orc.data_expiracao_link, (v_snap->>'dataExpiracaoLink')::timestamptz);
  IF v_expira_em IS NOT NULL AND v_expira_em < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Esta proposta de orçamento expirou. Solicite uma nova à clínica.', 'code', 'EXPIRED_TOKEN', 'isExpirado', true);
  END IF;

  SELECT * INTO v_clinica FROM public.configuracoes LIMIT 1;

  IF v_orc.paciente_id IS NOT NULL THEN
    SELECT nome, telefone, email, cpf INTO v_paciente FROM public.pacientes WHERE id = v_orc.paciente_id LIMIT 1;
  END IF;

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
      'nome', COALESCE(v_clinica.nome_clinica, 'Dra. Rosangela Santos - Clínica Odontológica'),
      'logoUrl', v_clinica.logo_url,
      'telefone', COALESCE(v_clinica.telefone, v_clinica.whatsapp_numero),
      'email', v_clinica.email,
      'dentistaResponsavel', COALESCE(v_clinica.dentista_responsavel, 'Dra. Rosângela Santos Pereira'),
      'cro', COALESCE(v_clinica.cro, '06267-AL')
    )
  );
END;
$$;

-- 5. Função RPC: Aprovar Orçamento Público com Geração Automática de Contrato e Assinatura Autorizada
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
  v_now_iso text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_snap jsonb;
  v_token_salvo text;
  v_versao_atual integer;
  v_novo_snap jsonb;
  v_total numeric;
  v_desconto numeric;

  -- Variáveis de contrato e autorização
  v_contrato_id text;
  v_contrato_token text;
  v_contrato_status text := 'pendente';
  v_contrato_link text;
  v_assinatura_dra_status text := 'pendente';
  v_auth record;
  v_paciente record;
  v_clinica record;
  v_snapshot_contrato jsonb;
  v_assinatura_dentista jsonb := NULL;
  v_paciente_nome text;
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

  -- 1. Se já está aprovado, retorna confirmação idempotente com contrato existente
  IF v_orc.status = 'aprovado' OR v_snap->>'status' = 'aprovado' THEN
    v_contrato_id := COALESCE(v_orc.contrato_id, v_snap->>'contratoId');
    v_contrato_token := COALESCE(v_orc.contrato_token, v_snap->>'contratoToken');

    IF v_contrato_id IS NOT NULL THEN
      SELECT
        itens->>'status',
        itens->>'statusAssinaturaDentista'
      INTO v_contrato_status, v_assinatura_dra_status
      FROM public.documentos_clinicos
      WHERE tipo = 'contrato'
        AND (id::text = v_contrato_id OR itens->>'contratoId' = v_contrato_id)
      LIMIT 1;

      v_contrato_link := 'https://app.lentesemresinamaceio.com.br/contrato/' || v_contrato_id || '?token=' || COALESCE(v_contrato_token, '');
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'jaAprovado', true,
      'mensagem', 'Este orçamento já foi aprovado anteriormente.',
      'id', v_orc.id,
      'identificador', COALESCE(v_orc.identificador, v_snap->>'identificador', v_clean_id),
      'status', 'aprovado',
      'aprovadoEm', COALESCE(v_orc.aprovado_em, v_orc.data_assinatura, (v_snap->>'aprovadoEm')::timestamptz),
      'condicaoEscolhida', COALESCE(v_orc.condicao_escolhida, v_snap->'condicaoEscolhida'),
      'contratoId', v_contrato_id,
      'contratoToken', v_contrato_token,
      'contratoStatus', v_contrato_status,
      'contratoLink', v_contrato_link,
      'assinaturaDraStatus', CASE WHEN v_assinatura_dra_status = 'assinado' THEN 'concluida' ELSE 'pendente' END
    );
  END IF;

  v_versao_atual := COALESCE(v_orc.versao, (v_snap->>'versao')::integer, 1);
  IF p_versao_aprovada IS NOT NULL AND p_versao_aprovada <> v_versao_atual THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Versão desatualizada. Por favor, recarregue a página.', 'code', 'OUTDATED_VERSION');
  END IF;

  v_total := COALESCE((p_condicao->>'valorTotal')::numeric, v_orc.total);
  v_desconto := COALESCE((p_condicao->>'valorDesconto')::numeric, v_orc.desconto);

  -- 2. Gera identificador e token do contrato
  v_contrato_id := 'CTR-' || COALESCE(v_code8, upper(substring(v_orc.id::text from 1 for 8)));
  v_contrato_token := encode(gen_random_bytes(24), 'hex');
  v_contrato_link := 'https://app.lentesemresinamaceio.com.br/contrato/' || v_contrato_id || '?token=' || v_contrato_token;

  -- 3. Busca dados do paciente e da clínica
  IF v_orc.paciente_id IS NOT NULL THEN
    SELECT nome, cpf, rg, email, telefone INTO v_paciente FROM public.pacientes WHERE id = v_orc.paciente_id LIMIT 1;
  END IF;
  SELECT * INTO v_clinica FROM public.configuracoes LIMIT 1;

  v_paciente_nome := COALESCE(v_orc.paciente_nome, v_paciente.nome, 'Paciente');

  -- 4. Avalia autorização ativa da profissional Dra. Rosângela Santos Pereira (CRO 06267-AL)
  SELECT * INTO v_auth
  FROM public.autorizacoes_assinatura_profissional
  WHERE ativo = true
    AND revogado_em IS NULL
    AND (
      profissional_cro = '06267-AL'
      OR replace(replace(profissional_cro, '-', ''), ' ', '') = '06267AL'
    )
  ORDER BY autorizado_em DESC
  LIMIT 1;

  -- 5. Se houver autorização ativa, aplica a assinatura digital profissional
  IF v_auth.id IS NOT NULL THEN
    v_assinatura_dra_status := 'concluida';
    v_contrato_status := 'aguardando_assinatura_paciente';

    v_assinatura_dentista := jsonb_build_object(
      'nome', v_auth.profissional_nome,
      'cro', v_auth.profissional_cro,
      'documento', v_auth.profissional_documento,
      'dataHora', v_now_iso,
      'metodo', 'assinatura_automatica_autorizada',
      'autorizacaoId', v_auth.id,
      'autorizadoEm', v_auth.autorizado_em,
      'autorizacaoExpressa', v_auth.autorizacao_expressa,
      'assinaturaData', COALESCE(v_auth.assinatura_grafica, '')
    );
  ELSE
    v_assinatura_dra_status := 'pendente';
    v_contrato_status := 'pendente';
    v_assinatura_dentista := NULL;
  END IF;

  -- 6. Constrói snapshot completo e imutável do contrato contendo SOMENTE a condição de pagamento aprovada
  v_snapshot_contrato := jsonb_build_object(
    'contratoId', v_contrato_id,
    'token', v_contrato_token,
    'orcamentoId', v_orc.id,
    'pacienteId', v_orc.paciente_id,
    'pacienteNome', v_paciente_nome,
    'versao', '1.0',
    'status', v_contrato_status,
    'statusAssinaturaDentista', CASE WHEN v_auth.id IS NOT NULL THEN 'assinado' ELSE 'pendente' END,
    'statusAssinaturaPaciente', 'pendente',
    'isFormalizadoTotal', false,
    'emitidoEm', v_now_iso,
    'assinaturaDentista', v_assinatura_dentista,
    'financeiro', jsonb_build_object(
      'valorTotal', v_total,
      'valorDesconto', v_desconto,
      'condicaoEscolhida', p_condicao,
      'formaPagamento', COALESCE(p_condicao->>'titulo', 'Conforme acordado'),
      'detalhes', p_condicao->>'descricao'
    ),
    'orcamento', jsonb_build_object(
      'id', v_orc.id,
      'titulo', v_orc.titulo,
      'itens', v_orc.itens,
      'total', v_total,
      'desconto', v_desconto,
      'formasPagamento', p_condicao->>'titulo'
    ),
    'paciente', jsonb_build_object(
      'id', v_orc.paciente_id,
      'nome', v_paciente_nome,
      'cpf', v_paciente.cpf,
      'rg', v_paciente.rg,
      'email', v_paciente.email,
      'telefone', v_paciente.telefone
    ),
    'clinica', jsonb_build_object(
      'nome', COALESCE(v_clinica.nome_clinica, 'Dra. Rosangela Santos - Clínica Odontológica'),
      'dentistaResponsavel', COALESCE(v_auth.profissional_nome, v_clinica.dentista_responsavel, 'Dra. Rosângela Santos Pereira'),
      'cro', COALESCE(v_auth.profissional_cro, v_clinica.cro, '06267-AL'),
      'endereco', v_clinica.endereco,
      'telefone', COALESCE(v_clinica.telefone, v_clinica.whatsapp_numero)
    )
  );

  -- 7. Persiste o contrato em public.documentos_clinicos antes de devolver seu link
  INSERT INTO public.documentos_clinicos (
    paciente_id,
    paciente_nome,
    tipo,
    titulo,
    conteudo,
    itens,
    dentista,
    criado_em,
    atualizado_em
  ) VALUES (
    v_orc.paciente_id,
    v_paciente_nome,
    'contrato',
    'Contrato Odontológico - ' || v_paciente_nome || ' (' || v_contrato_id || ')',
    '',
    v_snapshot_contrato,
    COALESCE(v_auth.profissional_nome, 'Dra. Rosângela Santos Pereira'),
    v_now,
    v_now
  );

  -- 8. Se assinado pela profissional, registra na trilha isolada de assinaturas
  IF v_auth.id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.assinaturas (
        documento_id,
        documento_tipo,
        tipo,
        nome,
        assinatura_data,
        paciente_id,
        user_id,
        evidencias,
        criado_em,
        atualizado_em
      ) VALUES (
        v_contrato_id,
        'contrato',
        'dentista',
        v_auth.profissional_nome,
        COALESCE(v_auth.assinatura_grafica, 'RUBRICA_DIGITAL_AUTORIZADA'),
        v_orc.paciente_id,
        v_orc.user_id,
        jsonb_build_object(
          'autorizacaoId', v_auth.id,
          'autorizadoEm', v_auth.autorizado_em,
          'metodo', 'assinatura_automatica_autorizada',
          'cro', v_auth.profissional_cro,
          'versaoContrato', '1.0'
        ),
        v_now,
        v_now
      );
    EXCEPTION WHEN OTHERS THEN
    END;
  END IF;

  -- 9. Atualiza o orçamento com status aprovado e vincula o contrato correspondente
  v_novo_snap := v_snap || jsonb_build_object(
    'status', 'aprovado',
    'aprovadoEm', v_now,
    'condicaoEscolhida', p_condicao,
    'versaoAprovada', v_versao_atual,
    'contratoId', v_contrato_id,
    'contratoToken', v_contrato_token,
    'contratoStatus', v_contrato_status,
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
    contrato_id = v_contrato_id,
    contrato_token = v_contrato_token,
    snapshot_aprovacao = jsonb_build_object('condicao', p_condicao, 'aprovadoEm', v_now, 'versao', v_versao_atual, 'evidencias', p_evidencias),
    assinatura_paciente = v_novo_snap,
    atualizado_em = v_now
  WHERE id = v_orc.id;

  -- 10. Atualiza status do paciente para 'Em Tratamento'
  IF v_orc.paciente_id IS NOT NULL THEN
    UPDATE public.pacientes SET status = 'Em Tratamento', atualizado_em = v_now WHERE id = v_orc.paciente_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_orc.id,
    'identificador', COALESCE(v_orc.identificador, v_snap->>'identificador', v_clean_id),
    'status', 'aprovado',
    'aprovadoEm', v_now,
    'condicaoEscolhida', p_condicao,
    'contratoId', v_contrato_id,
    'contratoToken', v_contrato_token,
    'contratoStatus', v_contrato_status,
    'contratoLink', v_contrato_link,
    'assinaturaDraStatus', v_assinatura_dra_status
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

-- 7. Permissões de execução
GRANT EXECUTE ON FUNCTION public.obter_orcamento_publico(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aprovar_orcamento_publico(text, text, jsonb, jsonb, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.solicitar_ajuste_orcamento_publico(text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obter_autorizacao_ativa_profissional(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.conceder_autorizacao_assinatura_profissional(text, text, text, text, jsonb, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revogar_autorizacao_assinatura_profissional(uuid, text) TO anon, authenticated;

-- 8. Recarrega o cache da API
NOTIFY pgrst, 'reload schema';
