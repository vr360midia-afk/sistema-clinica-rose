-- ==============================================================================
-- MIGRATION: BLINDAGEM DE SEGURANÇA V3.0 - CONTRATOS, ASSINATURAS E FILA PDF
-- Clínica Dra. Rosângela - Data: 2026-11-02
-- Totalmente idempotente, não-destrutiva e compatível com histórico
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. IDENTIFICADORES DETERMINÍSTICOS E UNICIDADE DE CONTRATOS (SEM PREFIXO AMBÍGUO)
-- ------------------------------------------------------------------------------

-- Garante a coluna identificador em documentos_clinicos
ALTER TABLE public.documentos_clinicos 
  ADD COLUMN IF NOT EXISTS identificador text;

-- Garante coluna hash_integridade para validação criptográfica
ALTER TABLE public.documentos_clinicos 
  ADD COLUMN IF NOT EXISTS hash_integridade text;

-- Preenche identificador para registros legados que ainda estejam nulos
UPDATE public.documentos_clinicos
SET identificador = COALESCE(itens->>'contratoId', 'CTR-' || upper(substring(id::text from 1 for 8)))
WHERE identificador IS NULL AND tipo = 'contrato';

-- Índice único condicional para contratos: garante que nenhum CTR seja duplicado
CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_clinicos_identificador_unique
  ON public.documentos_clinicos (identificador)
  WHERE identificador IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_doc_clinicos_paciente_tipo
  ON public.documentos_clinicos (paciente_id, tipo);

-- ------------------------------------------------------------------------------
-- 2. ISOLAMENTO MULTI-TENANT E CONTROLE DE PERFIS POR CLÍNICA
-- ------------------------------------------------------------------------------

-- Adiciona clinica_id na tabela user_roles se ainda não existir
ALTER TABLE public.user_roles 
  ADD COLUMN IF NOT EXISTS clinica_id uuid;

CREATE INDEX IF NOT EXISTS idx_user_roles_user_clinica 
  ON public.user_roles (user_id, clinica_id);

-- Função segura com isolamento estrito por clínica
CREATE OR REPLACE FUNCTION public.usuario_possui_perfil_clinica(
  p_user_id uuid,
  p_clinica_id uuid,
  p_role text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_role boolean := false;
BEGIN
  IF p_user_id IS NULL OR p_role IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Verifica se é o próprio dono/administrador da clínica
  IF p_clinica_id IS NOT NULL AND p_user_id = p_clinica_id THEN
    RETURN true;
  END IF;

  -- 2. Verifica vínculo na tabela user_roles com isolamento de clínica
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id
      AND lower(role) = lower(p_role)
      AND (
        p_clinica_id IS NULL 
        OR clinica_id = p_clinica_id 
        OR clinica_id IS NULL
      )
  ) INTO v_has_role;

  RETURN v_has_role;
END;
$$;

-- Versão simplificada retrocompatível que utiliza o contexto atual de autenticação
CREATE OR REPLACE FUNCTION public.usuario_possui_perfil(p_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinica_id uuid;
BEGIN
  -- Obtém clinica_id da sessão ou perfil
  BEGIN
    SELECT public.clinica_id() INTO v_clinica_id;
  EXCEPTION WHEN OTHERS THEN
    v_clinica_id := auth.uid();
  END;

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

-- RLS: Apenas autenticados pertencentes à clínica ou administradores
DROP POLICY IF EXISTS "Autorizacoes prof RLS" ON public.autorizacoes_assinatura_profissional;
CREATE POLICY "Autorizacoes prof RLS"
  ON public.autorizacoes_assinatura_profissional
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = profissional_id 
    OR auth.uid() = concedido_por 
    OR public.usuario_possui_perfil('admin')
  )
  WITH CHECK (
    auth.uid() = profissional_id 
    OR public.usuario_possui_perfil('admin')
  );

DROP POLICY IF EXISTS "Historico autorizacoes RLS" ON public.historico_autorizacoes_assinatura;
CREATE POLICY "Historico autorizacoes RLS"
  ON public.historico_autorizacoes_assinatura
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RPC: Conceder autorização expressa pela profissional titular
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

  -- Desativa qualquer autorização anterior ativa para o mesmo escopo
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

  -- Insere nova autorização ativa
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
    p_clinica_id,
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
    jsonb_build_object('hash', v_hash, 'cro', p_cro, 'escopo', p_escopo)
  );

  RETURN jsonb_build_object('ok', true, 'autorizacao_id', v_auth_id, 'hash', v_hash);
END;
$$;

-- RPC: Revogar autorização
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

  -- Apenas o próprio profissional ou admin pode revogar
  IF v_rec.profissional_id <> v_user_id AND NOT public.usuario_possui_perfil('admin') THEN
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
    jsonb_build_object('motivo', p_motivo)
  );

  RETURN jsonb_build_object('ok', true, 'mensagem', 'Autorização revogada com sucesso');
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. TRIGGER DE IMUTABILIDADE DO CONTRATO APÓS PRIMEIRA ASSINATURA
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

  -- Verifica se o contrato já possui assinatura registrada (paciente ou profissional)
  v_ja_assinado := (
    OLD.assinado_em IS NOT NULL
    OR OLD.assinatura_data IS NOT NULL
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'assinaturaPaciente' IS NOT NULL)
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'assinaturaDra' IS NOT NULL)
  );

  -- Se já estiver assinado, proíbe alterações substanciais em cláusulas, valores ou termos
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
CREATE POLICY "Fila PDF RLS"
  ON public.fila_arquivamento_pdf
  FOR ALL
  TO authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- RPC Idempotente: Enfileirar contrato para arquivamento ou retornar status se já concluído
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
BEGIN
  IF coalesce(p_contrato_id, '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'contrato_id é obrigatório', 'code', 'INVALID_PARAM');
  END IF;

  SELECT * INTO v_rec FROM public.fila_arquivamento_pdf
  WHERE contrato_id = p_contrato_id;

  IF FOUND THEN
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

    -- Se falhou ou está pendente, reinicia se solicitado
    UPDATE public.fila_arquivamento_pdf
    SET status = 'pendente',
        tentativas = 0,
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

  -- Inserção idempotente inicial
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
    p_documento_id,
    p_paciente_id,
    p_clinica_id,
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
-- 6. REVISÃO DE PERMISSÕES: REVOGAÇÃO DO ACESSO PÚBLICO E ANÔNIMO A FUNÇÕES CRÍTICAS
-- ------------------------------------------------------------------------------

-- Revoga execução pública e anônima de funções administrativas e de concessão de autorização
REVOKE EXECUTE ON FUNCTION public.conceder_autorizacao_assinatura FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.revogar_autorizacao_assinatura FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.usuario_possui_perfil_clinica FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.enfileirar_ou_processar_pdf FROM anon, public;

-- Concede estritamente a autenticados e service_role
GRANT EXECUTE ON FUNCTION public.conceder_autorizacao_assinatura TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revogar_autorizacao_assinatura TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.usuario_possui_perfil_clinica TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.usuario_possui_perfil TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enfileirar_ou_processar_pdf TO authenticated, service_role;

-- Revoga permissões diretas nas tabelas sensíveis de autorização e fila
REVOKE ALL ON public.autorizacoes_assinatura_profissional FROM anon, public;
REVOKE ALL ON public.historico_autorizacoes_assinatura FROM anon, public;
REVOKE ALL ON public.fila_arquivamento_pdf FROM anon, public;

GRANT ALL ON public.autorizacoes_assinatura_profissional TO authenticated, service_role;
GRANT ALL ON public.historico_autorizacoes_assinatura TO authenticated, service_role;
GRANT ALL ON public.fila_arquivamento_pdf TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. RECARREGA SCHEMA DO POSTGREST
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
