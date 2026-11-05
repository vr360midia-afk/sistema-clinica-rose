-- ==============================================================================
-- MIGRATION: BLINDAGEM DE ROW LEVEL SECURITY (RLS) DA TABELA ORCAMENTOS
-- Sistema: Clínica Dra. Rosângela
-- Data: 2026-11-05
-- Objetivo: Restringir mutações administrativas exclusivamente a administradores,
--           bloquear anon direto, preservar aprovação pública controlada por token
--           e manter isolamento multi-tenant por clínica.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 1. COLUNAS ESSENCIAIS NAS TABELAS (IDEMPOTENTE)
-- ------------------------------------------------------------------------------

ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS status text DEFAULT 'ativo';

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

CREATE INDEX IF NOT EXISTS idx_orcamentos_identificador ON public.orcamentos (identificador);
CREATE INDEX IF NOT EXISTS idx_orcamentos_token ON public.orcamentos (token_assinatura);
CREATE INDEX IF NOT EXISTS idx_orcamentos_paciente_id ON public.orcamentos (paciente_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_status ON public.orcamentos (status);
CREATE INDEX IF NOT EXISTS idx_orcamentos_user_id ON public.orcamentos (user_id);

-- ------------------------------------------------------------------------------
-- 2. TABELAS DE SUPORTE A PERFIS E EQUIPE (IDEMPOTENTES)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  nome_clinica text NULL,
  logo_url text NULL,
  cnpj text NULL,
  endereco text NULL,
  telefone text NULL,
  whatsapp_numero text NULL,
  email text NULL,
  dentista_responsavel text NULL,
  cro text NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL,
  clinica_id uuid NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_clinica ON public.user_roles (user_id, clinica_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles (role);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_read_own_or_admin" ON public.user_roles;
CREATE POLICY "user_roles_read_own_or_admin"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (clinica_id IS NOT NULL AND clinica_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.equipe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  nome text NULL,
  email text NULL,
  permissoes jsonb DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipe_usuario_clinica ON public.equipe (usuario_id, clinica_id);
ALTER TABLE public.equipe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "equipe_read_clinica" ON public.equipe;
CREATE POLICY "equipe_read_clinica"
  ON public.equipe
  FOR SELECT
  TO authenticated
  USING (
    clinica_id = auth.uid()
    OR usuario_id = auth.uid()
  );

-- ------------------------------------------------------------------------------
-- 3. FUNÇÕES DE RESOLUÇÃO DE CLÍNICA E VALIDAÇÃO DE PERFIL ADMINISTRATIVO
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.clinica_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT clinica_id FROM public.equipe WHERE usuario_id = auth.uid() LIMIT 1),
    auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.contrato_obter_clinica_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cid uuid := NULL;
BEGIN
  BEGIN
    SELECT public.clinica_id() INTO v_cid;
  EXCEPTION WHEN OTHERS THEN
    v_cid := NULL;
  END;

  IF v_cid IS NOT NULL THEN
    RETURN v_cid;
  END IF;

  RETURN auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.usuario_possui_perfil_clinica(
  p_user_id uuid,
  p_clinica_id uuid,
  p_role text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_role boolean := false;
  v_caller uuid;
BEGIN
  IF p_user_id IS NULL OR p_role IS NULL THEN
    RETURN false;
  END IF;

  v_caller := auth.uid();
  IF v_caller IS NOT NULL AND v_caller <> p_user_id AND auth.role() <> 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = v_caller AND lower(ur.role) = 'admin'
        AND (p_clinica_id IS NULL OR ur.clinica_id IS NULL OR ur.clinica_id = p_clinica_id)
    ) AND (p_clinica_id IS NULL OR v_caller <> p_clinica_id) THEN
      RETURN false;
    END IF;
  END IF;

  -- 1. Dono / titular da clínica
  IF p_clinica_id IS NOT NULL AND p_user_id = p_clinica_id THEN
    RETURN true;
  END IF;

  -- 2. Tabela user_roles
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id
      AND lower(role) = lower(p_role)
      AND (p_clinica_id IS NULL OR clinica_id IS NULL OR clinica_id = p_clinica_id)
  ) INTO v_has_role;

  IF v_has_role THEN
    RETURN true;
  END IF;

  -- 3. Tabela equipe
  SELECT EXISTS (
    SELECT 1 FROM public.equipe
    WHERE usuario_id = p_user_id
      AND (p_clinica_id IS NULL OR clinica_id = p_clinica_id)
      AND (
        lower(coalesce(permissoes->>'role', '')) = lower(p_role)
        OR (lower(p_role) = 'admin' AND (permissoes->>'admin')::boolean = true)
      )
  ) INTO v_has_role;

  RETURN v_has_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.usuario_is_admin_clinica(p_clinica_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Se o chamador é o titular/dono da clínica (p_clinica_id = auth.uid())
  IF p_clinica_id IS NOT NULL AND v_caller = p_clinica_id THEN
    RETURN true;
  END IF;

  -- 2. Se possui role = 'admin' em user_roles
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_caller
      AND lower(ur.role) = 'admin'
      AND (p_clinica_id IS NULL OR ur.clinica_id IS NULL OR ur.clinica_id = p_clinica_id)
  ) THEN
    RETURN true;
  END IF;

  -- 3. Se possui permissão de admin em equipe
  IF EXISTS (
    SELECT 1 FROM public.equipe eq
    WHERE eq.usuario_id = v_caller
      AND (p_clinica_id IS NULL OR eq.clinica_id = p_clinica_id)
      AND (
        lower(coalesce(eq.permissoes->>'role', '')) = 'admin'
        OR (eq.permissoes->>'admin')::boolean = true
      )
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. FUNÇÕES RPC DE ACESSO PÚBLICO E APROVAÇÃO (SECURITY DEFINER)
-- ------------------------------------------------------------------------------

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
  v_versao_atual integer;
  v_solicitacoes jsonb;
  v_nova_solicitacao jsonb;
  v_novas_solicitacoes jsonb;
  v_novo_snap jsonb;
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

  IF v_orc.status = 'aprovado' OR v_snap->>'status' = 'aprovado' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Este orçamento já foi aprovado e não pode receber solicitações de ajuste.', 'code', 'ALREADY_APPROVED');
  END IF;

  v_versao_atual := COALESCE(v_orc.versao, (v_snap->>'versao')::integer, 1);
  v_solicitacoes := COALESCE(v_orc.solicitacoes_ajuste, v_snap->'solicitacoesAjuste', '[]'::jsonb);

  v_nova_solicitacao := jsonb_build_object(
    'id', 'ajuste-' || extract(epoch from v_now)::text,
    'versao', v_versao_atual,
    'motivo', p_motivo,
    'mensagem', p_mensagem,
    'solicitadoEm', v_now,
    'atendida', false
  );

  v_novas_solicitacoes := v_solicitacoes || jsonb_build_array(v_nova_solicitacao);

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
    'status', 'ajuste_solicitado',
    'mensagem', 'Solicitação de ajuste enviada com sucesso à equipe da clínica.'
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. PERMISSÕES DE TABELA (GRANT / REVOKE)
-- ------------------------------------------------------------------------------

-- Revoga explicitamente todas as permissões de tabela para anon
REVOKE ALL ON TABLE public.orcamentos FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.orcamentos FROM anon;

-- Usuários autenticados operam estritamente sob as políticas RLS abaixo
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orcamentos TO authenticated;
GRANT SELECT ON TABLE public.user_roles TO authenticated;
GRANT SELECT ON TABLE public.equipe TO authenticated;
GRANT SELECT ON TABLE public.configuracoes TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. POLÍTICAS DE ROW LEVEL SECURITY (RLS) EM PUBLIC.ORCAMENTOS
-- ------------------------------------------------------------------------------

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

-- Limpeza idempotente de políticas prévias
DROP POLICY IF EXISTS "homolog_orcamentos_all" ON public.orcamentos;
DROP POLICY IF EXISTS "Orcamentos RLS" ON public.orcamentos;
DROP POLICY IF EXISTS "Orcamentos select autenticados" ON public.orcamentos;
DROP POLICY IF EXISTS "Orcamentos update apenas admin" ON public.orcamentos;
DROP POLICY IF EXISTS "Orcamentos delete apenas admin" ON public.orcamentos;
DROP POLICY IF EXISTS "Permitir leitura publica de orcamentos por token" ON public.orcamentos;
DROP POLICY IF EXISTS "Permitir aprovacao publica de orcamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Permitir total autenticados em orcamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "orcamentos_select_clinica" ON public.orcamentos;
DROP POLICY IF EXISTS "orcamentos_insert_clinica" ON public.orcamentos;
DROP POLICY IF EXISTS "orcamentos_update_admin" ON public.orcamentos;
DROP POLICY IF EXISTS "orcamentos_update_equipe_proposta" ON public.orcamentos;
DROP POLICY IF EXISTS "orcamentos_delete_admin" ON public.orcamentos;

-- POLÍTICA 1: SELECT (Leitura restrita à clínica autenticada)
CREATE POLICY "orcamentos_select_clinica"
  ON public.orcamentos
  FOR SELECT
  TO authenticated
  USING (
    user_id IS NOT NULL
    AND (
      user_id = auth.uid()
      OR user_id = public.clinica_id()
      OR EXISTS (
        SELECT 1 FROM public.equipe eq
        WHERE eq.usuario_id = auth.uid()
          AND eq.clinica_id = orcamentos.user_id
      )
    )
  );

-- POLÍTICA 2: INSERT (Criação de orçamentos vinculada à clínica)
CREATE POLICY "orcamentos_insert_clinica"
  ON public.orcamentos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IS NOT NULL
    AND (
      user_id = auth.uid()
      OR user_id = public.clinica_id()
    )
  );

-- POLÍTICA 3: UPDATE (Administrador da Clínica)
-- Permite edições financeiras, conciliações de paciente_id e cancelamentos
CREATE POLICY "orcamentos_update_admin"
  ON public.orcamentos
  FOR UPDATE
  TO authenticated
  USING (
    user_id IS NOT NULL
    AND (
      user_id = auth.uid()
      OR user_id = public.clinica_id()
    )
    AND public.usuario_is_admin_clinica(user_id)
  )
  WITH CHECK (
    user_id IS NOT NULL
    AND (
      user_id = auth.uid()
      OR user_id = public.clinica_id()
    )
    AND public.usuario_is_admin_clinica(user_id)
  );

-- POLÍTICA 4: UPDATE (Equipe Operacional Não-Admin)
-- Permite atualizar propostas em elaboração/abertas, mas IMPEDE expressamente:
-- cancelamentos, adulteração de orçamentos aprovados/cancelados e alteração de paciente
CREATE POLICY "orcamentos_update_equipe_proposta"
  ON public.orcamentos
  FOR UPDATE
  TO authenticated
  USING (
    user_id IS NOT NULL
    AND (
      user_id = auth.uid()
      OR user_id = public.clinica_id()
    )
    AND status IN ('rascunho', 'enviado', 'pendente', 'ajuste_solicitado', 'nova_proposta_enviada')
  )
  WITH CHECK (
    user_id IS NOT NULL
    AND (
      user_id = auth.uid()
      OR user_id = public.clinica_id()
    )
    AND status <> 'cancelado'
    AND (paciente_id = orcamentos.paciente_id OR orcamentos.paciente_id IS NULL)
  );

-- POLÍTICA 5: DELETE (Apenas Administrador da Clínica)
CREATE POLICY "orcamentos_delete_admin"
  ON public.orcamentos
  FOR DELETE
  TO authenticated
  USING (
    user_id IS NOT NULL
    AND (
      user_id = auth.uid()
      OR user_id = public.clinica_id()
    )
    AND public.usuario_is_admin_clinica(user_id)
  );

-- ------------------------------------------------------------------------------
-- 7. EXECUTE GRANTS PARA RPCs DE APROVAÇÃO PÚBLICA (SECURITY DEFINER)
-- ------------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.obter_orcamento_publico(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aprovar_orcamento_publico(text, text, jsonb, jsonb, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.solicitar_ajuste_orcamento_publico(text, text, text, text) TO anon, authenticated;

-- Notifica o PostgREST para recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';
