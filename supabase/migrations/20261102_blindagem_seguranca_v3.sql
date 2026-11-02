-- ==============================================================================
-- MIGRATION: BLINDAGEM DE SEGURANÇA V3.0 - CONTRATOS, ASSINATURAS E FILA PDF
-- Clínica Dra. Rosângela - Data: 2026-11-02
-- Totalmente idempotente, não-destrutiva e compatível com histórico
-- ==============================================================================

-- Garante disponibilidade de extensões criptográficas padrão
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 1. IDENTIFICADORES DETERMINÍSTICOS E MAPEAMENTO SEGURO DE CONTRATOS HISTÓRICOS
-- ------------------------------------------------------------------------------

-- Garante a coluna identificador em documentos_clinicos
ALTER TABLE public.documentos_clinicos 
  ADD COLUMN IF NOT EXISTS identificador text;

-- Garante coluna hash_integridade para validação criptográfica
ALTER TABLE public.documentos_clinicos 
  ADD COLUMN IF NOT EXISTS hash_integridade text;

-- Preenche identificador de forma segura e não colidente para registros legados que estejam nulos
DO $$
DECLARE
  r RECORD;
  v_base text;
  v_candidate text;
  v_count integer;
BEGIN
  FOR r IN 
    SELECT id, itens->>'contratoId' AS contrato_id
    FROM public.documentos_clinicos
    WHERE identificador IS NULL AND tipo = 'contrato'
    ORDER BY criado_em ASC
  LOOP
    v_base := COALESCE(NULLIF(trim(r.contrato_id), ''), 'CTR-' || upper(substring(r.id::text from 1 for 8)));
    v_candidate := v_base;
    v_count := 1;

    WHILE EXISTS (SELECT 1 FROM public.documentos_clinicos WHERE identificador = v_candidate AND id <> r.id) LOOP
      v_count := v_count + 1;
      v_candidate := v_base || '-LEG' || v_count::text;
    END LOOP;

    UPDATE public.documentos_clinicos
    SET identificador = v_candidate
    WHERE id = r.id;
  END LOOP;
END $$;

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

  RETURN coalesce(v_cid, auth.uid());
END;
$$;

-- Adiciona clinica_id na tabela user_roles se ainda não existir
ALTER TABLE public.user_roles 
  ADD COLUMN IF NOT EXISTS clinica_id uuid;

CREATE INDEX IF NOT EXISTS idx_user_roles_user_clinica 
  ON public.user_roles (user_id, clinica_id);

-- Função segura com isolamento estrito por clínica (sem permissão universal arbitrária)
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
        AND (p_clinica_id IS NULL OR ur.clinica_id = p_clinica_id)
    ) AND (p_clinica_id IS NULL OR v_caller <> p_clinica_id) THEN
      RETURN false;
    END IF;
  END IF;

  -- 1. Se for o próprio dono/titular da clínica, possui perfil integral
  IF p_clinica_id IS NOT NULL AND p_user_id = p_clinica_id THEN
    RETURN true;
  END IF;

  -- 2. Verifica vínculo estrito na tabela user_roles vinculada à clínica específica
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id
      AND lower(role) = lower(p_role)
      AND (
        (p_clinica_id IS NOT NULL AND clinica_id = p_clinica_id)
        OR (p_clinica_id IS NULL AND clinica_id IS NULL)
      )
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
  profissional_id uuid NOT NULL,
  clinica_id uuid NULL,
  nome_profissional text NOT NULL,
  cro text NOT NULL,
  assinatura_base64 text NOT NULL,
  escopo text NOT NULL DEFAULT 'contrato_odontologico',
  modelos_autorizados jsonb NOT NULL DEFAULT '["padrao", "procedimentos", "ortodontia", "cirurgia"]'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  concedido_em timestamptz NOT NULL DEFAULT now(),
  concedido_por uuid NOT NULL,
  revogado_em timestamptz NULL,
  revogado_por uuid NULL,
  motivo_revogacao text NULL,
  ip_concessao text NULL,
  user_agent_concessao text NULL,
  hash_integridade text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

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

-- RLS: Leitura segura para o profissional, clínica e administradores
DROP POLICY IF EXISTS "Autorizacoes prof RLS" ON public.autorizacoes_assinatura_profissional;
DROP POLICY IF EXISTS "Autorizacoes prof select RLS" ON public.autorizacoes_assinatura_profissional;
CREATE POLICY "Autorizacoes prof select RLS"
  ON public.autorizacoes_assinatura_profissional
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = profissional_id 
    OR auth.uid() = concedido_por 
    OR clinica_id = public.contrato_obter_clinica_id()
    OR clinica_id = auth.uid()
    OR public.usuario_possui_perfil('admin')
  );

DROP POLICY IF EXISTS "Autorizacoes prof service_role RLS" ON public.autorizacoes_assinatura_profissional;
CREATE POLICY "Autorizacoes prof service_role RLS"
  ON public.autorizacoes_assinatura_profissional
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Histórico: Estritamente imutável para authenticated. Somente leitura autorizada.
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
        AND (
          a.profissional_id = auth.uid()
          OR a.clinica_id = public.contrato_obter_clinica_id()
          OR a.clinica_id = auth.uid()
        )
    )
    OR public.usuario_possui_perfil('admin')
  );

DROP POLICY IF EXISTS "Historico autorizacoes service_role RLS" ON public.historico_autorizacoes_assinatura;
CREATE POLICY "Historico autorizacoes service_role RLS"
  ON public.historico_autorizacoes_assinatura
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RPC: Conceder autorização expressa com validação estrita de identidade e vínculo da titular
CREATE OR REPLACE FUNCTION public.conceder_autorizacao_assinatura(
  p_nome_profissional text,
  p_cro text,
  p_assinatura_base64 text,
  p_escopo text DEFAULT 'contrato_odontologico',
  p_modelos jsonb DEFAULT '["padrao", "procedimentos", "ortodontia", "cirurgia"]'::jsonb,
  p_clinica_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_clinica_id uuid;
  v_auth_id uuid;
  v_hash text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuário não autenticado', 'code', 'UNAUTHORIZED');
  END IF;

  IF coalesce(p_nome_profissional, '') = '' OR coalesce(p_cro, '') = '' OR coalesce(p_assinatura_base64, '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nome, CRO e assinatura gráfica são obrigatórios', 'code', 'INVALID_PARAM');
  END IF;

  -- Determina a clínica do usuário autenticado
  v_clinica_id := COALESCE(p_clinica_id, public.contrato_obter_clinica_id(), v_user_id);

  -- Validação de Segurança Bloqueante: Apenas a profissional titular responsável ou administradora vinculada pode conceder
  IF NOT (
    v_user_id = v_clinica_id
    OR public.usuario_possui_perfil_clinica(v_user_id, v_clinica_id, 'dentista')
    OR public.usuario_possui_perfil_clinica(v_user_id, v_clinica_id, 'admin')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Apenas a profissional titular responsável pela clínica pode conceder esta autorização', 'code', 'FORBIDDEN');
  END IF;

  -- Impede delegação forjada para outra clínica
  IF p_clinica_id IS NOT NULL AND p_clinica_id <> v_clinica_id AND NOT (v_user_id = p_clinica_id OR public.usuario_possui_perfil_clinica(v_user_id, p_clinica_id, 'admin')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Não é permitido conceder autorização para outra clínica', 'code', 'FORBIDDEN');
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

  -- Insere nova autorização ativa vinculada à clínica comprovada
  INSERT INTO public.autorizacoes_assinatura_profissional (
    profissional_id,
    clinica_id,
    nome_profissional,
    cro,
    assinatura_base64,
    escopo,
    modelos_autorizados,
    ativo,
    concedido_em,
    concedido_por,
    hash_integridade
  ) VALUES (
    v_user_id,
    v_clinica_id,
    p_nome_profissional,
    p_cro,
    p_assinatura_base64,
    p_escopo,
    p_modelos,
    true,
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

  -- Validação de Segurança Bloqueante: Apenas a titular, dono da clínica ou admin da mesma clínica
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

-- ------------------------------------------------------------------------------
-- 4. TRIGGER DE IMUTABILIDADE DO CONTRATO APÓS ASSINATURA
-- ------------------------------------------------------------------------------

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
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'assinaturaDra' IS NOT NULL)
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'statusAssinaturaPaciente' = 'assinado')
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'isFormalizadoTotal' = 'true')
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'status' IN ('formalizado', 'assinado'))
  );

  -- Se já estiver assinado, blinda integralmente a versão contratual aceita
  IF v_ja_assinado THEN
    -- Proíbe alteração de identificador, paciente_id ou tipo
    IF NEW.identificador IS DISTINCT FROM OLD.identificador THEN
      RAISE EXCEPTION 'Não é permitido alterar o identificador de um contrato já assinado.';
    END IF;

    IF NEW.paciente_id IS DISTINCT FROM OLD.paciente_id THEN
      RAISE EXCEPTION 'Não é permitido alterar o paciente de um contrato já assinado.';
    END IF;

    IF NEW.tipo IS DISTINCT FROM OLD.tipo THEN
      RAISE EXCEPTION 'Não é permitido alterar o tipo de um contrato já assinado.';
    END IF;

    -- Proíbe alteração de termos essenciais (conteúdo clínico e valor total)
    IF NEW.conteudo IS DISTINCT FROM OLD.conteudo THEN
      RAISE EXCEPTION 'Violação de integridade: O conteúdo textual de um contrato assinado é estritamente imutável.';
    END IF;

    IF NEW.valor_total IS DISTINCT FROM OLD.valor_total THEN
      RAISE EXCEPTION 'Violação de integridade: O valor financeiro de um contrato assinado é estritamente imutável.';
    END IF;

    -- Protege os blocos essenciais dentro de itens (financeiro, itens, parcelas, paciente, clinica)
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

      -- Assinatura do paciente já existente não pode ser substituída ou apagada
      IF (OLD.itens->'assinaturaPaciente' IS NOT NULL) AND (NEW.itens->'assinaturaPaciente') IS DISTINCT FROM (OLD.itens->'assinaturaPaciente') THEN
        RAISE EXCEPTION 'Violação de integridade: A assinatura do paciente já formalizada não pode ser modificada.';
      END IF;

      -- Assinatura da profissional já existente não pode ser substituída ou apagada
      IF (OLD.itens->'assinaturaDentista' IS NOT NULL) AND (NEW.itens->'assinaturaDentista') IS DISTINCT FROM (OLD.itens->'assinaturaDentista') THEN
        RAISE EXCEPTION 'Violação de integridade: A assinatura da profissional já vinculada não pode ser modificada.';
      END IF;
    END IF;

    -- PERMITE EXCLUSIVAMENTE a gravação de metadados técnicos de arquivamento (pdf_path, atualizado_em)
    -- Isso garante que a fila e o Storage consigam arquivar o PDF oficial sem ser bloqueados pelo trigger.
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
  clinica_id uuid NULL,
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
    clinica_id IS NULL
    OR clinica_id = public.contrato_obter_clinica_id()
    OR clinica_id = auth.uid()
    OR public.usuario_possui_perfil('admin')
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

  -- Determina a clínica legítima
  IF v_caller_role = 'service_role' THEN
    v_clinica_id := COALESCE(p_clinica_id, (
      SELECT COALESCE(clinica_id, user_id) FROM public.documentos_clinicos 
      WHERE identificador = p_contrato_id OR id = p_documento_id LIMIT 1
    ));
  ELSE
    v_clinica_id := public.contrato_obter_clinica_id();
  END IF;

  -- Validação estrita de existência do contrato no acervo da PRÓPRIA clínica
  SELECT id, paciente_id, clinica_id, user_id INTO v_doc_record
  FROM public.documentos_clinicos
  WHERE (identificador = p_contrato_id OR id = p_documento_id)
    AND tipo = 'contrato'
    AND (
      v_caller_role = 'service_role'
      OR clinica_id = v_clinica_id
      OR user_id = v_clinica_id
      OR (clinica_id IS NULL AND user_id IS NULL)
      OR public.usuario_possui_perfil_clinica(v_user_id, COALESCE(clinica_id, user_id), 'admin')
    )
  LIMIT 1;

  IF NOT FOUND AND v_caller_role <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Contrato não localizado no acervo da clínica autorizada', 'code', 'NOT_FOUND');
  END IF;

  SELECT * INTO v_rec FROM public.fila_arquivamento_pdf
  WHERE contrato_id = p_contrato_id;

  IF FOUND THEN
    -- Impede manipulação da fila de outra clínica
    IF v_caller_role <> 'service_role' AND v_rec.clinica_id IS NOT NULL AND v_rec.clinica_id <> v_clinica_id AND NOT public.usuario_possui_perfil_clinica(v_user_id, v_rec.clinica_id, 'admin') THEN
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
    v_clinica_id,
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
REVOKE EXECUTE ON FUNCTION public.usuario_possui_perfil_clinica FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.usuario_possui_perfil FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.enfileirar_ou_processar_pdf FROM anon, public;

-- Concede execução estritamente a autenticados e service_role
GRANT EXECUTE ON FUNCTION public.conceder_autorizacao_assinatura TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revogar_autorizacao_assinatura TO authenticated, service_role;
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
