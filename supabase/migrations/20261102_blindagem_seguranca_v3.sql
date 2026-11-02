-- ==============================================================================
-- MIGRATION: BLINDAGEM DE SEGURANÇA V3.0 - CONTRATOS, ASSINATURAS E FILA PDF
-- Clínica Dra. Rosângela - Data: 2026-11-02
-- Totalmente idempotente, não-destrutiva e compatível com histórico
-- ==============================================================================

-- Garante disponibilidade de extensões criptográficas padrão
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 1. IDENTIFICADORES DETERMINÍSTICOS E RESOLUÇÃO SEGURA DE CONTRATOS HISTÓRICOS
-- ------------------------------------------------------------------------------

-- Garante a coluna identificador em documentos_clinicos
ALTER TABLE public.documentos_clinicos 
  ADD COLUMN IF NOT EXISTS identificador text;

-- Garante coluna hash_integridade para validação criptográfica
ALTER TABLE public.documentos_clinicos 
  ADD COLUMN IF NOT EXISTS hash_integridade text;

-- Garante colunas clinica_id e valor_total para integridade multi-tenant e auditoria financeira
ALTER TABLE public.documentos_clinicos 
  ADD COLUMN IF NOT EXISTS clinica_id uuid;

ALTER TABLE public.documentos_clinicos 
  ADD COLUMN IF NOT EXISTS valor_total numeric;

-- Preservação integral de contratos históricos: Não executa UPDATE em identificador nem clinica_id.
-- Preserva todos os documentos legados intactos com seus identificadores, assinaturas e links originais.

-- Índices de alta performance para resolução rápida de contratos sem renomear códigos históricos
CREATE INDEX IF NOT EXISTS idx_doc_clinicos_identificador
  ON public.documentos_clinicos (identificador);

CREATE INDEX IF NOT EXISTS idx_doc_clinicos_token_busca
  ON public.documentos_clinicos ((itens->>'token'))
  WHERE tipo = 'contrato';

CREATE INDEX IF NOT EXISTS idx_doc_clinicos_contratoid_busca
  ON public.documentos_clinicos ((itens->>'contratoId'))
  WHERE tipo = 'contrato';

CREATE INDEX IF NOT EXISTS idx_doc_clinicos_paciente_tipo
  ON public.documentos_clinicos (paciente_id, tipo);

-- ------------------------------------------------------------------------------
-- 2. ISOLAMENTO MULTI-TENANT E CONTROLE DE PERFIS POR CLÍNICA
-- ------------------------------------------------------------------------------

-- Função auxiliar dedicada para resolução de clínica em contratos (preserva 100% a public.clinica_id() pré-existente)
CREATE OR REPLACE FUNCTION public.contrato_obter_clinica_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cid uuid := NULL;
BEGIN
  -- 1. Tenta consultar a função existente public.clinica_id() sem alterá-la
  BEGIN
    SELECT public.clinica_id() INTO v_cid;
  EXCEPTION WHEN OTHERS THEN
    v_cid := NULL;
  END;

  IF v_cid IS NOT NULL THEN
    RETURN v_cid;
  END IF;

  -- 2. Fallback seguro para claims da sessão JWT
  BEGIN
    v_cid := nullif(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'clinica_id', '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_cid := NULL;
  END;

  IF v_cid IS NOT NULL THEN
    RETURN v_cid;
  END IF;

  -- 3. Fallback para tabela user_roles
  BEGIN
    SELECT clinica_id INTO v_cid 
    FROM public.user_roles 
    WHERE user_id = auth.uid() AND clinica_id IS NOT NULL 
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_cid := NULL;
  END;

  RETURN coalesce(v_cid, auth.uid());
END;
$$;

-- Adiciona clinica_id na tabela user_roles se ainda não existir
ALTER TABLE public.user_roles 
  ADD COLUMN IF NOT EXISTS clinica_id uuid;

CREATE INDEX IF NOT EXISTS idx_user_roles_user_clinica 
  ON public.user_roles (user_id, clinica_id);

-- Função segura com isolamento estrito por clínica (sem acesso universal por clinica_id IS NULL)
CREATE OR REPLACE FUNCTION public.usuario_possui_perfil_clinica(
  p_user_id uuid,
  p_clinica_id uuid,
  p_role text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
  -- Proteção contra enumeração: apenas o próprio usuário, admin da clínica ou service_role podem consultar perfis de terceiros
  IF v_caller IS NOT NULL AND v_caller <> p_user_id AND auth.role() <> 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = v_caller AND lower(ur.role) = 'admin'
        AND p_clinica_id IS NOT NULL AND ur.clinica_id = p_clinica_id
    ) AND (p_clinica_id IS NULL OR v_caller <> p_clinica_id) THEN
      RETURN false;
    END IF;
  END IF;

  -- 1. Se for o próprio dono/titular da clínica, possui perfil integral
  IF p_clinica_id IS NOT NULL AND p_user_id = p_clinica_id THEN
    RETURN true;
  END IF;

  -- 2. Verifica vínculo estrito na tabela user_roles vinculada à clínica específica (sem permissão universal arbitrária)
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id
      AND lower(role) = lower(p_role)
      AND p_clinica_id IS NOT NULL
      AND clinica_id = p_clinica_id
  ) INTO v_has_role;

  RETURN v_has_role;
END;
$$;

-- Versão simplificada retrocompatível que utiliza a função auxiliar de sessão
CREATE OR REPLACE FUNCTION public.usuario_possui_perfil(p_role text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinica_id uuid;
BEGIN
  v_clinica_id := public.contrato_obter_clinica_id();
  RETURN public.usuario_possui_perfil_clinica(auth.uid(), v_clinica_id, p_role);
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. AUTORIZAÇÃO PRÉVIA EXPRESSA PARA ASSINATURA DA PROFISSIONAL
-- ------------------------------------------------------------------------------

-- Tabela de autorizações expressas (concedidas e revogadas pela própria profissional)
CREATE TABLE IF NOT EXISTS public.autorizacoes_assinatura_profissional (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id uuid NULL,
  user_id uuid NULL,
  clinica_id uuid NULL,
  nome_profissional text NULL,
  profissional_nome text NOT NULL DEFAULT '',
  cro text NULL,
  profissional_cro text NOT NULL DEFAULT '',
  profissional_documento text NULL,
  assinatura_base64 text NULL,
  assinatura_grafica text NULL,
  autorizacao_expressa text NULL,
  escopo text NOT NULL DEFAULT 'contrato_odontologico',
  modelos_autorizados jsonb NOT NULL DEFAULT '["geral", "lentes_resina", "endodontia"]'::jsonb,
  condicoes_abrangidas jsonb NOT NULL DEFAULT '{"apenas_orcamentos_aprovados": true}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  concedido_em timestamptz NOT NULL DEFAULT now(),
  autorizado_em timestamptz NOT NULL DEFAULT now(),
  concedido_por uuid NULL,
  revogado_em timestamptz NULL,
  revogado_por uuid NULL,
  motivo_revogacao text NULL,
  ip_concessao text NULL,
  user_agent_concessao text NULL,
  evidencias jsonb NOT NULL DEFAULT '{}'::jsonb,
  hash_integridade text NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Compatibilidade retroativa de colunas se a tabela já existir previamente
ALTER TABLE public.autorizacoes_assinatura_profissional ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.autorizacoes_assinatura_profissional ADD COLUMN IF NOT EXISTS profissional_nome text;
ALTER TABLE public.autorizacoes_assinatura_profissional ADD COLUMN IF NOT EXISTS profissional_cro text;
ALTER TABLE public.autorizacoes_assinatura_profissional ADD COLUMN IF NOT EXISTS profissional_documento text;
ALTER TABLE public.autorizacoes_assinatura_profissional ADD COLUMN IF NOT EXISTS autorizacao_expressa text;
ALTER TABLE public.autorizacoes_assinatura_profissional ADD COLUMN IF NOT EXISTS condicoes_abrangidas jsonb DEFAULT '{"apenas_orcamentos_aprovados": true}'::jsonb;
ALTER TABLE public.autorizacoes_assinatura_profissional ADD COLUMN IF NOT EXISTS assinatura_grafica text;
ALTER TABLE public.autorizacoes_assinatura_profissional ADD COLUMN IF NOT EXISTS autorizado_em timestamptz DEFAULT now();
ALTER TABLE public.autorizacoes_assinatura_profissional ADD COLUMN IF NOT EXISTS evidencias jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.autorizacoes_assinatura_profissional ENABLE ROW LEVEL SECURITY;

-- Garante no máximo 1 autorização ativa por profissional e escopo
CREATE UNIQUE INDEX IF NOT EXISTS idx_autorizacao_prof_ativa_unique
  ON public.autorizacoes_assinatura_profissional (profissional_id, escopo)
  WHERE ativo = true;

-- Tabela de auditoria imutável para eventos de concessão e revogação
CREATE TABLE IF NOT EXISTS public.historico_autorizacoes_assinatura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autorizacao_id uuid NOT NULL REFERENCES public.autorizacoes_assinatura_profissional(id),
  acao text NOT NULL, -- 'CONCESSAO', 'REVOGACAO', 'USO_EM_CONTRATO'
  executado_por uuid NOT NULL,
  contrato_id text NULL,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.historico_autorizacoes_assinatura ENABLE ROW LEVEL SECURITY;

-- RLS: Leitura segura para o profissional, clínica e administradores (comprovação estrita de vínculo)
DROP POLICY IF EXISTS "Autorizacoes prof RLS" ON public.autorizacoes_assinatura_profissional;
DROP POLICY IF EXISTS "Autorizacoes prof select RLS" ON public.autorizacoes_assinatura_profissional;
CREATE POLICY "Autorizacoes prof select RLS"
  ON public.autorizacoes_assinatura_profissional
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = profissional_id 
    OR auth.uid() = concedido_por 
    OR (clinica_id IS NOT NULL AND clinica_id = public.contrato_obter_clinica_id())
    OR (clinica_id IS NOT NULL AND clinica_id = auth.uid())
    OR (clinica_id IS NOT NULL AND public.usuario_possui_perfil_clinica(auth.uid(), clinica_id, 'admin'))
  );

DROP POLICY IF EXISTS "Autorizacoes prof service_role RLS" ON public.autorizacoes_assinatura_profissional;
CREATE POLICY "Autorizacoes prof service_role RLS"
  ON public.autorizacoes_assinatura_profissional
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Histórico: Estritamente imutável para authenticated. Somente leitura autorizada por clínica.
DROP POLICY IF EXISTS "Historico autorizacoes RLS" ON public.historico_autorizacoes_assinatura;
DROP POLICY IF EXISTS "Historico autorizacoes select RLS" ON public.historico_autorizacoes_assinatura;
CREATE POLICY "Historico autorizacoes select RLS"
  ON public.historico_autorizacoes_assinatura
  FOR SELECT
  TO authenticated
  USING (
    executado_por = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.autorizacoes_assinatura_profissional a
      WHERE a.id = autorizacao_id
        AND a.clinica_id IS NOT NULL
        AND (
          a.profissional_id = auth.uid()
          OR a.clinica_id = public.contrato_obter_clinica_id()
          OR a.clinica_id = auth.uid()
          OR public.usuario_possui_perfil_clinica(auth.uid(), a.clinica_id, 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "Historico autorizacoes service_role RLS" ON public.historico_autorizacoes_assinatura;
CREATE POLICY "Historico autorizacoes service_role RLS"
  ON public.historico_autorizacoes_assinatura
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RPC: Conceder autorização expressa exigindo a identidade da própria profissional titular
CREATE OR REPLACE FUNCTION public.conceder_autorizacao_assinatura(
  p_nome_profissional text,
  p_cro text,
  p_assinatura_base64 text,
  p_escopo text DEFAULT 'contrato_odontologico',
  p_modelos jsonb DEFAULT '["padrao", "procedimentos", "ortodontia", "cirurgia"]'::jsonb,
  p_clinica_id uuid DEFAULT NULL,
  p_consentimento_expresso boolean DEFAULT false,
  p_documento text DEFAULT NULL,
  p_autorizacao_expressa text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_real_clinica_id uuid;
  v_clinica_id uuid;
  v_auth_id uuid;
  v_hash text;
  v_cro_digits text;
  v_nome_norm text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuário não autenticado', 'code', 'UNAUTHORIZED');
  END IF;

  IF coalesce(p_nome_profissional, '') = '' OR coalesce(p_cro, '') = '' OR coalesce(p_assinatura_base64, '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nome, CRO e assinatura gráfica são obrigatórios', 'code', 'INVALID_PARAM');
  END IF;

  -- 1. Exige aceite e consentimento formal expresso (default false)
  IF p_consentimento_expresso IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Consentimento formal expresso da profissional titular é obrigatório', 'code', 'CONSENT_REQUIRED');
  END IF;

  -- 2. Determina e valida o vínculo real da clínica do usuário autenticado
  v_real_clinica_id := public.contrato_obter_clinica_id();
  IF v_real_clinica_id IS NULL THEN
    v_real_clinica_id := v_user_id;
  END IF;

  -- Validação estrita do parâmetro p_clinica_id contra o vínculo real do usuário
  IF p_clinica_id IS NOT NULL THEN
    IF p_clinica_id <> v_real_clinica_id AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = v_user_id AND ur.clinica_id = p_clinica_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Parâmetro clinica_id incompatível com o vínculo real do usuário', 'code', 'FORBIDDEN');
    END IF;
    v_clinica_id := p_clinica_id;
  ELSE
    v_clinica_id := v_real_clinica_id;
  END IF;

  -- 3. Validação Estrita de Identidade da Titular:
  -- Apenas a própria titular autenticada (proprietária da clínica ou titular comprovada em user_roles)
  IF v_user_id <> v_clinica_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = v_user_id 
        AND ur.clinica_id = v_clinica_id 
        AND lower(ur.role) IN ('dentista_titular', 'responsavel_tecnica')
    ) THEN
      RETURN jsonb_build_object(
        'ok', false, 
        'error', 'Apenas a própria profissional titular (Dra. Rosângela) pode conceder e autorizar o uso de sua assinatura pessoal', 
        'code', 'FORBIDDEN'
      );
    END IF;
  END IF;

  -- 4. Vinculação ao cadastro verificado da profissional titular (impede nome e CRO arbitrários)
  v_cro_digits := regexp_replace(upper(p_cro), '[^0-9]', '', 'g');
  v_nome_norm := translate(lower(trim(p_nome_profissional)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');

  -- Valida se o CRO corresponde ao cadastro oficial da titular (06267-AL)
  IF v_cro_digits <> '06267' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'CRO divergente do cadastro oficial verificado da profissional titular (esperado: 06267-AL)',
      'code', 'TITULAR_CADASTRO_DIVERGENTE'
    );
  END IF;

  -- Valida se o nome corresponde à titular verificada Dra. Rosângela Santos Pereira
  IF NOT (v_nome_norm LIKE '%rosangela%' AND v_nome_norm LIKE '%santos%') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Nome divergente do cadastro oficial verificado da profissional titular (esperado: Dra. Rosângela Santos Pereira)',
      'code', 'TITULAR_CADASTRO_DIVERGENTE'
    );
  END IF;

  -- Desativa qualquer autorização anterior ativa para o mesmo profissional e escopo
  UPDATE public.autorizacoes_assinatura_profissional
  SET ativo = false,
      revogado_em = now(),
      revogado_por = v_user_id,
      motivo_revogacao = 'Substituída por nova autorização',
      atualizado_em = now()
  WHERE profissional_id = v_user_id
    AND escopo = p_escopo
    AND ativo = true;

  -- Gera hash de integridade
  v_hash := encode(digest(v_user_id::text || p_cro || p_escopo || clock_timestamp()::text, 'sha256'), 'hex');

  -- Insere nova autorização ativa vinculada à clínica comprovada (compatível com a interface e RPCs)
  INSERT INTO public.autorizacoes_assinatura_profissional (
    profissional_id,
    user_id,
    clinica_id,
    nome_profissional,
    profissional_nome,
    cro,
    profissional_cro,
    profissional_documento,
    assinatura_base64,
    assinatura_grafica,
    autorizacao_expressa,
    escopo,
    modelos_autorizados,
    condicoes_abrangidas,
    ativo,
    concedido_em,
    autorizado_em,
    concedido_por,
    hash_integridade
  ) VALUES (
    v_user_id,
    v_user_id,
    v_clinica_id,
    p_nome_profissional,
    p_nome_profissional,
    p_cro,
    p_cro,
    p_documento,
    p_assinatura_base64,
    p_assinatura_base64,
    COALESCE(p_autorizacao_expressa, 'Autorização expressa concedida pela titular'),
    p_escopo,
    p_modelos,
    '{"apenas_orcamentos_aprovados": true}'::jsonb,
    true,
    now(),
    now(),
    v_user_id,
    v_hash
  ) RETURNING id INTO v_auth_id;

  -- Registra no histórico imutável
  INSERT INTO public.historico_autorizacoes_assinatura (
    autorizacao_id,
    acao,
    executado_por,
    detalhes
  ) VALUES (
    v_auth_id,
    'CONCESSAO',
    v_user_id,
    jsonb_build_object('hash', v_hash, 'cro', p_cro, 'escopo', p_escopo, 'clinica_id', v_clinica_id)
  );

  RETURN jsonb_build_object('ok', true, 'autorizacao_id', v_auth_id, 'hash', v_hash);
END;
$$;

-- RPC: Revogar autorização restrita à própria titular ou admin comprovado da clínica
CREATE OR REPLACE FUNCTION public.revogar_autorizacao_assinatura(
  p_autorizacao_id uuid,
  p_motivo text DEFAULT 'Revogação expressa pelo profissional'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_rec record;
  v_is_authorized boolean := false;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuário não autenticado', 'code', 'UNAUTHORIZED');
  END IF;

  SELECT * INTO v_rec FROM public.autorizacoes_assinatura_profissional
  WHERE id = p_autorizacao_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Autorização não encontrada', 'code', 'NOT_FOUND');
  END IF;

  -- Validação de Segurança Bloqueante: Apenas a própria titular que concedeu, dona da clínica ou admin da mesma clínica
  v_is_authorized := (
    v_rec.profissional_id = v_user_id
    OR (v_rec.clinica_id IS NOT NULL AND v_rec.clinica_id = v_user_id)
    OR (v_rec.clinica_id IS NOT NULL AND public.usuario_possui_perfil_clinica(v_user_id, v_rec.clinica_id, 'admin'))
  );

  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sem permissão para revogar esta autorização', 'code', 'FORBIDDEN');
  END IF;

  UPDATE public.autorizacoes_assinatura_profissional
  SET ativo = false,
      revogado_em = now(),
      revogado_por = v_user_id,
      motivo_revogacao = p_motivo,
      atualizado_em = now()
  WHERE id = p_autorizacao_id;

  INSERT INTO public.historico_autorizacoes_assinatura (
    autorizacao_id,
    acao,
    executado_por,
    detalhes
  ) VALUES (
    p_autorizacao_id,
    'REVOGACAO',
    v_user_id,
    jsonb_build_object('motivo', p_motivo, 'revogado_por', v_user_id)
  );

  RETURN jsonb_build_object('ok', true, 'mensagem', 'Autorização revogada com sucesso');
END;
$$;

-- RPC de Consulta: Restrita a chamadas autenticadas e autorizadas da própria clínica (proteção contra acesso anônimo/externo)
CREATE OR REPLACE FUNCTION public.obter_autorizacao_ativa_profissional(
  p_cro text DEFAULT '06267-AL',
  p_clinica_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rec record;
  v_caller uuid;
  v_caller_role text;
  v_target_clinica_id uuid;
  v_is_authorized boolean := false;
BEGIN
  v_caller := auth.uid();
  v_caller_role := auth.role();

  -- 1. Bloqueia expressamente chamadas anônimas e públicas
  IF v_caller IS NULL AND v_caller_role <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Acesso não autenticado proibido', 'code', 'UNAUTHORIZED');
  END IF;

  -- 2. Determina a clínica autorizada do chamador
  IF v_caller_role = 'service_role' THEN
    v_target_clinica_id := COALESCE(p_clinica_id, (
      SELECT clinica_id FROM public.autorizacoes_assinatura_profissional
      WHERE ativo = true AND revogado_em IS NULL
        AND (COALESCE(profissional_cro, cro) = p_cro OR regexp_replace(upper(COALESCE(profissional_cro, cro)), '[^0-9]', '', 'g') = regexp_replace(upper(p_cro), '[^0-9]', '', 'g'))
      ORDER BY COALESCE(autorizado_em, concedido_em) DESC LIMIT 1
    ));
    v_is_authorized := true;
  ELSE
    v_target_clinica_id := public.contrato_obter_clinica_id();

    -- Se p_clinica_id foi fornecido explicitamente, verifica se o usuário tem permissão sobre ela
    IF p_clinica_id IS NOT NULL AND p_clinica_id <> v_target_clinica_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = v_caller AND ur.clinica_id = p_clinica_id
      ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Acesso negado à assinatura de outra clínica', 'code', 'FORBIDDEN');
      END IF;
      v_target_clinica_id := p_clinica_id;
    END IF;

    IF v_target_clinica_id IS NOT NULL THEN
      v_is_authorized := (
        v_caller = v_target_clinica_id
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur 
          WHERE ur.user_id = v_caller AND ur.clinica_id = v_target_clinica_id
        )
      );
    END IF;
  END IF;

  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Acesso negado à assinatura de outra clínica', 'code', 'FORBIDDEN');
  END IF;

  -- 3. Isolamento estrito por clínica: a assinatura só é retornada se pertencer à clínica do chamador
  SELECT * INTO v_rec
  FROM public.autorizacoes_assinatura_profissional
  WHERE ativo = true
    AND revogado_em IS NULL
    AND clinica_id = v_target_clinica_id
    AND (
      COALESCE(profissional_cro, cro) = p_cro
      OR regexp_replace(upper(COALESCE(profissional_cro, cro)), '[^0-9]', '', 'g') = regexp_replace(upper(p_cro), '[^0-9]', '', 'g')
    )
  ORDER BY COALESCE(autorizado_em, concedido_em) DESC
  LIMIT 1;

  IF v_rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'temAutorizacao', false);
  END IF;

  -- Retorna rubrica e dados estritamente para chamada autenticada e autorizada da clínica
  RETURN jsonb_build_object(
    'ok', true,
    'temAutorizacao', true,
    'id', v_rec.id,
    'profissionalNome', COALESCE(v_rec.profissional_nome, v_rec.nome_profissional),
    'profissionalCro', COALESCE(v_rec.profissional_cro, v_rec.cro),
    'profissionalDocumento', v_rec.profissional_documento,
    'autorizacaoExpressa', v_rec.autorizacao_expressa,
    'modelosAutorizados', v_rec.modelos_autorizados,
    'condicoesAbrangidas', v_rec.condicoes_abrangidas,
    'assinaturaGrafica', COALESCE(v_rec.assinatura_grafica, v_rec.assinatura_base64),
    'ativo', v_rec.ativo,
    'autorizadoEm', COALESCE(v_rec.autorizado_em, v_rec.concedido_em),
    'evidencias', v_rec.evidencias
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. TRIGGERS DE IMUTABILIDADE INTEGRAL E PROIBIÇÃO DE EXCLUSÃO DE CONTRATOS
-- ------------------------------------------------------------------------------

-- Trigger 1: Bloqueia expressamente DELETE em contratos formalizados ou assinados
CREATE OR REPLACE FUNCTION public.proibir_exclusao_contrato_assinado_v3()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ja_assinado boolean := false;
BEGIN
  IF OLD.tipo IS DISTINCT FROM 'contrato' THEN
    RETURN OLD;
  END IF;

  v_ja_assinado := (
    OLD.assinado_em IS NOT NULL
    OR OLD.assinatura_data IS NOT NULL
    OR (OLD.itens IS NOT NULL AND OLD.itens->'assinaturaPaciente' IS NOT NULL)
    OR (OLD.itens IS NOT NULL AND OLD.itens->'assinaturaDentista' IS NOT NULL)
    OR (OLD.itens IS NOT NULL AND OLD.itens->'assinaturaDra' IS NOT NULL)
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'assinaturaDra' IS NOT NULL)
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'statusAssinaturaPaciente' = 'assinado')
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'isFormalizadoTotal' = 'true')
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'status' IN ('formalizado', 'assinado'))
  );

  IF v_ja_assinado THEN
    RAISE EXCEPTION 'Violação de segurança jurídica: Contratos formalizados ou assinados não podem ser excluídos do sistema.';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_proibir_exclusao_contrato ON public.documentos_clinicos;
CREATE TRIGGER trg_proibir_exclusao_contrato
  BEFORE DELETE ON public.documentos_clinicos
  FOR EACH ROW
  EXECUTE FUNCTION public.proibir_exclusao_contrato_assinado_v3();

-- Trigger 2: Bloqueia alteração de quaisquer termos essenciais após assinatura
CREATE OR REPLACE FUNCTION public.garantir_imutabilidade_contrato_v3()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ja_assinado boolean := false;
BEGIN
  -- Se o contrato não for do tipo 'contrato', permite a alteração normalmente
  IF OLD.tipo IS DISTINCT FROM 'contrato' THEN
    RETURN NEW;
  END IF;

  -- Reconhecimento de todos os campos de assinatura utilizados pelo sistema
  v_ja_assinado := (
    OLD.assinado_em IS NOT NULL
    OR OLD.assinatura_data IS NOT NULL
    OR (OLD.itens IS NOT NULL AND OLD.itens->'assinaturaPaciente' IS NOT NULL)
    OR (OLD.itens IS NOT NULL AND OLD.itens->'assinaturaDentista' IS NOT NULL)
    OR (OLD.itens IS NOT NULL AND OLD.itens->'assinaturaDra' IS NOT NULL)
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'assinaturaDra' IS NOT NULL)
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'statusAssinaturaPaciente' = 'assinado')
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'isFormalizadoTotal' = 'true')
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'status' IN ('formalizado', 'assinado'))
  );

  -- Se já estiver assinado, blinda integralmente a versão contratual aceita
  IF v_ja_assinado THEN
    -- Proíbe alteração de identificador, paciente, clínica, criador ou tipo
    IF NEW.identificador IS DISTINCT FROM OLD.identificador THEN
      RAISE EXCEPTION 'Não é permitido alterar o identificador de um contrato já assinado.';
    END IF;

    IF NEW.paciente_id IS DISTINCT FROM OLD.paciente_id THEN
      RAISE EXCEPTION 'Não é permitido alterar o paciente de um contrato já assinado.';
    END IF;

    IF NEW.tipo IS DISTINCT FROM OLD.tipo THEN
      RAISE EXCEPTION 'Não é permitido alterar o tipo de um contrato já assinado.';
    END IF;

    IF NEW.clinica_id IS DISTINCT FROM OLD.clinica_id THEN
      RAISE EXCEPTION 'Não é permitido transferir a titularidade de clínica de um contrato já assinado.';
    END IF;

    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Não é permitido alterar o criador de um contrato já assinado.';
    END IF;

    -- Proíbe alteração de termos essenciais (conteúdo clínico, título e valor total)
    IF NEW.conteudo IS DISTINCT FROM OLD.conteudo THEN
      RAISE EXCEPTION 'Violação de integridade: O conteúdo textual de um contrato assinado é estritamente imutável.';
    END IF;

    IF NEW.titulo IS DISTINCT FROM OLD.titulo THEN
      RAISE EXCEPTION 'Violação de integridade: O título de um contrato assinado é estritamente imutável.';
    END IF;

    IF NEW.valor_total IS DISTINCT FROM OLD.valor_total THEN
      RAISE EXCEPTION 'Violação de integridade: O valor financeiro de um contrato assinado é estritamente imutável.';
    END IF;

    -- Proíbe alteração da data original de formalização
    IF (OLD.assinado_em IS NOT NULL) AND NEW.assinado_em IS DISTINCT FROM OLD.assinado_em THEN
      RAISE EXCEPTION 'Violação de integridade: O carimbo de formalização de um contrato assinado não pode ser alterado.';
    END IF;

    -- Protege todos os blocos essenciais dentro de itens
    IF (OLD.itens IS NOT NULL) THEN
      IF (NEW.itens->'financeiro') IS DISTINCT FROM (OLD.itens->'financeiro') THEN
        RAISE EXCEPTION 'Violação de integridade: As condições financeiras de um contrato assinado são estritamente imutáveis.';
      END IF;

      IF (NEW.itens->'itens') IS DISTINCT FROM (OLD.itens->'itens') THEN
        RAISE EXCEPTION 'Violação de integridade: A lista de procedimentos de um contrato assinado é estritamente imutável.';
      END IF;

      IF (NEW.itens->'paciente') IS DISTINCT FROM (OLD.itens->'paciente') THEN
        RAISE EXCEPTION 'Violação de integridade: Os dados do paciente no contrato assinado são estritamente imutáveis.';
      END IF;

      IF (NEW.itens->'clinica') IS DISTINCT FROM (OLD.itens->'clinica') THEN
        RAISE EXCEPTION 'Violação de integridade: Os dados da clínica no contrato assinado são estritamente imutáveis.';
      END IF;

      IF (NEW.itens->'parcelas') IS DISTINCT FROM (OLD.itens->'parcelas') THEN
        RAISE EXCEPTION 'Violação de integridade: As parcelas de um contrato assinado são estritamente imutáveis.';
      END IF;

      IF (NEW.itens->'clausulas') IS DISTINCT FROM (OLD.itens->'clausulas') THEN
        RAISE EXCEPTION 'Violação de integridade: As cláusulas de um contrato assinado são estritamente imutáveis.';
      END IF;

      IF (OLD.itens->'assinaturaPaciente' IS NOT NULL) AND (NEW.itens->'assinaturaPaciente') IS DISTINCT FROM (OLD.itens->'assinaturaPaciente') THEN
        RAISE EXCEPTION 'Violação de integridade: A assinatura do paciente já formalizada não pode ser modificada.';
      END IF;

      IF (OLD.itens->'assinaturaDentista' IS NOT NULL) AND (NEW.itens->'assinaturaDentista') IS DISTINCT FROM (OLD.itens->'assinaturaDentista') THEN
        RAISE EXCEPTION 'Violação de integridade: A assinatura da profissional já vinculada não pode ser modificada.';
      END IF;

      -- Proteção específica e integral da assinatura histórica da titular (assinaturaDra)
      IF (OLD.itens->'assinaturaDra' IS NOT NULL) AND (NEW.itens->'assinaturaDra') IS DISTINCT FROM (OLD.itens->'assinaturaDra') THEN
        RAISE EXCEPTION 'Violação de integridade: A assinatura da profissional titular (assinaturaDra) já vinculada não pode ser modificada.';
      END IF;
    END IF;

    -- PERMITE EXCLUSIVAMENTE a gravação de metadados técnicos de arquivamento (pdf_path, atualizado_em, hash_integridade)
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_garantir_imutabilidade_contrato ON public.documentos_clinicos;
CREATE TRIGGER trg_garantir_imutabilidade_contrato
  BEFORE UPDATE ON public.documentos_clinicos
  FOR EACH ROW
  EXECUTE FUNCTION public.garantir_imutabilidade_contrato_v3();

-- ------------------------------------------------------------------------------
-- 5. FILA DE ARQUIVAMENTO PERSISTIDA E IDEMPOTENTE DE PDFS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fila_arquivamento_pdf (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id text NOT NULL,
  documento_id uuid NULL,
  paciente_id uuid NULL,
  clinica_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pendente', -- 'pendente', 'processando', 'concluido', 'falha'
  tentativas integer NOT NULL DEFAULT 0,
  max_tentativas integer NOT NULL DEFAULT 5,
  ultimo_erro text NULL,
  storage_path text NULL,
  payload jsonb NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_fila_pdf_status CHECK (status IN ('pendente', 'processando', 'concluido', 'falha'))
);

ALTER TABLE public.fila_arquivamento_pdf ENABLE ROW LEVEL SECURITY;

-- Índice único por contrato: garante idempotência absoluta na fila
CREATE UNIQUE INDEX IF NOT EXISTS idx_fila_pdf_contrato_unique
  ON public.fila_arquivamento_pdf (contrato_id);

CREATE INDEX IF NOT EXISTS idx_fila_pdf_status_tentativas
  ON public.fila_arquivamento_pdf (status, tentativas);

DROP POLICY IF EXISTS "Fila PDF RLS" ON public.fila_arquivamento_pdf;
DROP POLICY IF EXISTS "Fila PDF select RLS" ON public.fila_arquivamento_pdf;
CREATE POLICY "Fila PDF select RLS"
  ON public.fila_arquivamento_pdf
  FOR SELECT
  TO authenticated
  USING (
    clinica_id IS NOT NULL 
    AND (
      clinica_id = public.contrato_obter_clinica_id()
      OR clinica_id = auth.uid()
      OR public.usuario_possui_perfil_clinica(auth.uid(), clinica_id, 'admin')
    )
  );

DROP POLICY IF EXISTS "Fila PDF service_role RLS" ON public.fila_arquivamento_pdf;
CREATE POLICY "Fila PDF service_role RLS"
  ON public.fila_arquivamento_pdf
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RPC Idempotente: Enfileirar contrato com isolamento estrito de tenant e limite de tentativas
CREATE OR REPLACE FUNCTION public.enfileirar_ou_processar_pdf(
  p_contrato_id text,
  p_documento_id uuid DEFAULT NULL,
  p_paciente_id uuid DEFAULT NULL,
  p_clinica_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rec record;
  v_user_id uuid;
  v_caller_role text;
  v_clinica_id uuid;
  v_doc_record record;
BEGIN
  IF coalesce(p_contrato_id, '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'contrato_id é obrigatório', 'code', 'INVALID_PARAM');
  END IF;

  v_user_id := auth.uid();
  v_caller_role := auth.role();

  -- Determina a clínica legítima da chamada
  IF v_caller_role = 'service_role' THEN
    v_clinica_id := COALESCE(p_clinica_id, (
      SELECT clinica_id FROM public.documentos_clinicos 
      WHERE identificador = p_contrato_id OR id = p_documento_id LIMIT 1
    ));
  ELSE
    v_clinica_id := public.contrato_obter_clinica_id();
  END IF;

  IF v_clinica_id IS NULL AND v_caller_role <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Clínica do usuário não identificada', 'code', 'UNAUTHORIZED');
  END IF;

  -- Validação estrita de existência do contrato no acervo da PRÓPRIA clínica
  -- Não presume que user_id corresponde à clínica; exige clinica_id comprovada
  SELECT id, paciente_id, clinica_id, user_id INTO v_doc_record
  FROM public.documentos_clinicos
  WHERE (identificador = p_contrato_id OR id = p_documento_id)
    AND tipo = 'contrato'
    AND (
      v_caller_role = 'service_role'
      OR (clinica_id IS NOT NULL AND clinica_id = v_clinica_id)
      OR (clinica_id IS NOT NULL AND public.usuario_possui_perfil_clinica(v_user_id, clinica_id, 'admin'))
    )
  LIMIT 1;

  IF NOT FOUND AND v_caller_role <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Contrato não localizado no acervo da clínica autorizada', 'code', 'NOT_FOUND');
  END IF;

  SELECT * INTO v_rec FROM public.fila_arquivamento_pdf
  WHERE contrato_id = p_contrato_id;

  IF FOUND THEN
    -- Impede manipulação da fila de outra clínica
    IF v_caller_role <> 'service_role' AND (v_rec.clinica_id IS NULL OR (v_rec.clinica_id <> v_clinica_id AND NOT public.usuario_possui_perfil_clinica(v_user_id, v_rec.clinica_id, 'admin'))) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Acesso negado à fila de outra clínica', 'code', 'FORBIDDEN');
    END IF;

    -- Se já foi concluído, retorna com sucesso imediatamente
    IF v_rec.status = 'concluido' THEN
      RETURN jsonb_build_object(
        'ok', true,
        'status', 'concluido',
        'ja_processado', true,
        'storage_path', v_rec.storage_path,
        'id', v_rec.id
      );
    END IF;

    -- Proteção contra loops infinitos de reprocessamento
    IF v_rec.tentativas >= v_rec.max_tentativas AND v_caller_role <> 'service_role' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'Limite máximo de tentativas de arquivamento atingido para este contrato. Intervenção técnica necessária.',
        'code', 'MAX_RETRIES_EXCEEDED'
      );
    END IF;

    -- Incrementa tentativas controladamente
    UPDATE public.fila_arquivamento_pdf
    SET status = 'pendente',
        tentativas = LEAST(tentativas + 1, max_tentativas),
        ultimo_erro = NULL,
        payload = COALESCE(p_payload, payload),
        atualizado_em = now()
    WHERE id = v_rec.id;

    RETURN jsonb_build_object(
      'ok', true,
      'status', 'pendente',
      'reprocessando', true,
      'id', v_rec.id
    );
  END IF;

  -- Inserção idempotente com clinica_id vinculado com segurança
  INSERT INTO public.fila_arquivamento_pdf (
    contrato_id,
    documento_id,
    paciente_id,
    clinica_id,
    status,
    payload,
    criado_em,
    atualizado_em
  ) VALUES (
    p_contrato_id,
    COALESCE(p_documento_id, v_doc_record.id),
    COALESCE(p_paciente_id, v_doc_record.paciente_id),
    COALESCE(v_clinica_id, v_doc_record.clinica_id),
    'pendente',
    p_payload,
    now(),
    now()
  ) RETURNING * INTO v_rec;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'pendente',
    'ja_processado', false,
    'id', v_rec.id
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. REVISÃO RIGOROSA DE PERMISSÕES: SEM GRANT ALL PARA AUTHENTICATED
-- ------------------------------------------------------------------------------

-- Revoga execução pública e anônima de todas as funções administrativas e sensíveis
REVOKE EXECUTE ON FUNCTION public.conceder_autorizacao_assinatura FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.revogar_autorizacao_assinatura FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.obter_autorizacao_ativa_profissional FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.usuario_possui_perfil_clinica FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.usuario_possui_perfil FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.enfileirar_ou_processar_pdf FROM anon, public;

-- Concede execução estritamente a autenticados e service_role
GRANT EXECUTE ON FUNCTION public.contrato_obter_clinica_id TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.conceder_autorizacao_assinatura TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revogar_autorizacao_assinatura TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.obter_autorizacao_ativa_profissional TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.usuario_possui_perfil_clinica TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.usuario_possui_perfil TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enfileirar_ou_processar_pdf TO authenticated, service_role;

-- Revoga TODAS as permissões diretas nas tabelas sensíveis de autorização e fila para anônimos e autenticados
REVOKE ALL ON public.autorizacoes_assinatura_profissional FROM anon, public, authenticated;
REVOKE ALL ON public.historico_autorizacoes_assinatura FROM anon, public, authenticated;
REVOKE ALL ON public.fila_arquivamento_pdf FROM anon, public, authenticated;

-- Usuários autenticados recebem EXCLUSIVAMENTE SELECT (filtrado pelas políticas RLS)
-- Modificações (INSERT/UPDATE/DELETE) ocorrem exclusivamente através das RPCs SECURITY DEFINER ou service_role
GRANT SELECT ON public.autorizacoes_assinatura_profissional TO authenticated;
GRANT SELECT ON public.historico_autorizacoes_assinatura TO authenticated;
GRANT SELECT ON public.fila_arquivamento_pdf TO authenticated;

-- Service_role retém privilégios totais para rotinas de backend
GRANT ALL ON public.autorizacoes_assinatura_profissional TO service_role;
GRANT ALL ON public.historico_autorizacoes_assinatura TO service_role;
GRANT ALL ON public.fila_arquivamento_pdf TO service_role;

-- ------------------------------------------------------------------------------
-- 7. RECARREGA SCHEMA DO POSTGREST
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
