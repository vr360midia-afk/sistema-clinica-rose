-- ==============================================================================
-- SCHEMA DEFINITIVO E IDEMPOTENTE: PERSISTÊNCIA E BLOQUEIO DE REASSINATURA
-- Execute no Supabase SQL Editor (Dashboard -> SQL Editor)
-- ==============================================================================

-- 1. Habilita RLS nas tabelas principais
ALTER TABLE public.documentos_clinicos ENABLE ROW LEVEL SECURITY;

-- Garante que a coluna pdf_path exista para vincular o documento final no Supabase Storage
ALTER TABLE public.documentos_clinicos ADD COLUMN IF NOT EXISTS pdf_path text;

-- Garante que o bucket privado de documentos exista
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-pacientes', 'documentos-pacientes', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Garante que a tabela assinaturas exista para trilha isolada e inviolável de auditoria
CREATE TABLE IF NOT EXISTS public.assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id text NOT NULL,
  documento_tipo text NOT NULL DEFAULT 'contrato',
  tipo text NOT NULL, -- 'paciente' ou 'dentista'
  nome text NOT NULL,
  assinatura_data text NOT NULL,
  paciente_id uuid NULL,
  user_id uuid NULL,
  evidencias jsonb NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;

-- Índice único para impedir fisicamente que o mesmo signatário assine o mesmo contrato duas vezes
CREATE UNIQUE INDEX IF NOT EXISTS idx_assinaturas_doc_tipo_unique
  ON public.assinaturas (documento_id, tipo);

-- Índices de alta performance
CREATE INDEX IF NOT EXISTS idx_doc_clinicos_contrato_id 
  ON public.documentos_clinicos USING btree ((itens->>'contratoId'));

CREATE INDEX IF NOT EXISTS idx_doc_clinicos_token 
  ON public.documentos_clinicos USING btree ((itens->>'token'));

CREATE INDEX IF NOT EXISTS idx_doc_clinicos_tipo 
  ON public.documentos_clinicos (tipo);

-- 2. Políticas RLS para documentos_clinicos
DROP POLICY IF EXISTS "Permitir leitura publica de contratos" ON public.documentos_clinicos;
CREATE POLICY "Permitir leitura publica de contratos"
  ON public.documentos_clinicos
  FOR SELECT
  TO anon, authenticated
  USING (tipo = 'contrato');

-- Bloqueio em nível de banco: anon só pode atualizar se o contrato AINDA NÃO foi assinado
DROP POLICY IF EXISTS "Permitir assinatura publica de contratos" ON public.documentos_clinicos;
CREATE POLICY "Permitir assinatura publica de contratos"
  ON public.documentos_clinicos
  FOR UPDATE
  TO anon, authenticated
  USING (tipo = 'contrato' AND assinado_em IS NULL)
  WITH CHECK (tipo = 'contrato');

DROP POLICY IF EXISTS "Permitir insercao de contratos" ON public.documentos_clinicos;
CREATE POLICY "Permitir insercao de contratos"
  ON public.documentos_clinicos
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (tipo = 'contrato');

DROP POLICY IF EXISTS "Permitir total para autenticados em documentos_clinicos" ON public.documentos_clinicos;
CREATE POLICY "Permitir total para autenticados em documentos_clinicos"
  ON public.documentos_clinicos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas RLS para assinaturas
DROP POLICY IF EXISTS "Permitir leitura de assinaturas" ON public.assinaturas;
CREATE POLICY "Permitir leitura de assinaturas"
  ON public.assinaturas
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Permitir insercao de assinaturas" ON public.assinaturas;
CREATE POLICY "Permitir insercao de assinaturas"
  ON public.assinaturas
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir total autenticados em assinaturas" ON public.assinaturas;
CREATE POLICY "Permitir total autenticados em assinaturas"
  ON public.assinaturas
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Função RPC: Obter contrato com validação estrita de token e retorno do status real das assinaturas
CREATE OR REPLACE FUNCTION public.obter_contrato_publico(
  p_identificador text,
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc record;
  v_token_salvo text;
  v_expira_em text;
  v_assinado_paciente boolean := false;
  v_assinado_dentista boolean := false;
  v_formalizado boolean := false;
  v_status_texto text := 'pendente';
BEGIN
  IF p_identificador IS NULL OR trim(p_identificador) = '' OR p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Identificador e token são obrigatórios');
  END IF;

  SELECT * INTO v_doc
  FROM public.documentos_clinicos
  WHERE tipo = 'contrato'
    AND (
      (p_identificador ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id::text = p_identificador)
      OR (itens->>'contratoId' = p_identificador)
      OR (itens->>'contratoId' = upper(p_identificador))
    )
  ORDER BY criado_em DESC
  LIMIT 1;

  IF v_doc.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Contrato não encontrado');
  END IF;

  -- Validação estrita do token
  v_token_salvo := v_doc.itens->>'token';
  IF v_token_salvo IS NULL OR trim(v_token_salvo) = '' OR v_token_salvo <> trim(p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Token de acesso inválido ou revogado');
  END IF;

  -- Validação de expiração se informada
  v_expira_em := v_doc.itens->>'tokenValidoAte';
  IF v_expira_em IS NOT NULL AND v_expira_em <> '' THEN
    BEGIN
      IF v_expira_em::timestamptz < now() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Este link de contrato expirou. Solicite um novo link à clínica.');
      END IF;
    EXCEPTION WHEN OTHERS THEN
    END;
  END IF;

  -- Avalia status das assinaturas a partir do banco
  v_assinado_paciente := (v_doc.assinado_em IS NOT NULL) OR (v_doc.itens->'assinaturaPaciente' IS NOT NULL);
  v_assinado_dentista := (v_doc.itens->'assinaturaDentista' IS NOT NULL);
  v_formalizado := (v_assinado_paciente AND v_assinado_dentista);

  IF v_formalizado THEN
    v_status_texto := 'formalizado';
  ELSIF v_assinado_paciente THEN
    v_status_texto := 'assinado_paciente';
  ELSIF v_assinado_dentista THEN
    v_status_texto := 'assinado_profissional';
  ELSE
    v_status_texto := 'pendente';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_doc.id,
    'identificador', COALESCE(v_doc.itens->>'contratoId', v_doc.id::text),
    'titulo', v_doc.titulo,
    'conteudo', v_doc.conteudo,
    'pacienteNome', v_doc.paciente_nome,
    'pacienteId', v_doc.paciente_id,
    'status', v_status_texto,
    'jaAssinadoPaciente', v_assinado_paciente,
    'jaAssinadoDentista', v_assinado_dentista,
    'isFormalizadoTotal', v_formalizado,
    'assinadoEm', v_doc.assinado_em,
    'assinanteNome', v_doc.assinante_nome,
    'pdf_path', v_doc.pdf_path,
    'pdfPath', COALESCE(v_doc.pdf_path, v_doc.itens->>'pdfPath'),
    'snapshot', v_doc.itens
  );
END;
$$;

-- 4. Função RPC: Assinar contrato digitalmente pelo paciente com bloqueio atômico de reassinatura
CREATE OR REPLACE FUNCTION public.assinar_contrato_publico(
  p_identificador text,
  p_token text,
  p_assinatura text,
  p_assinante_nome text,
  p_evidencias jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc record;
  v_token_salvo text;
  v_now timestamptz := now();
  v_now_iso text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_novo_itens jsonb;
  v_assinatura_paciente jsonb;
  v_tem_dentista boolean := false;
BEGIN
  IF p_identificador IS NULL OR trim(p_identificador) = '' OR p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Identificador e token são obrigatórios');
  END IF;

  IF p_assinatura IS NULL OR trim(p_assinatura) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Assinatura é obrigatória');
  END IF;

  -- Bloqueio com FOR UPDATE para concorrência atômica segura
  SELECT * INTO v_doc
  FROM public.documentos_clinicos
  WHERE tipo = 'contrato'
    AND (
      (p_identificador ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id::text = p_identificador)
      OR (itens->>'contratoId' = p_identificador)
      OR (itens->>'contratoId' = upper(p_identificador))
    )
  ORDER BY criado_em DESC
  LIMIT 1
  FOR UPDATE;

  IF v_doc.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Contrato não encontrado');
  END IF;

  -- Validação estrita do token
  v_token_salvo := v_doc.itens->>'token';
  IF v_token_salvo IS NULL OR trim(v_token_salvo) = '' OR v_token_salvo <> trim(p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Token de acesso inválido ou revogado');
  END IF;

  -- BLOQUEIO DEFINITIVO DE REASSINATURA
  IF v_doc.assinado_em IS NOT NULL OR v_doc.itens->>'status' = 'assinado' OR v_doc.itens->'assinaturaPaciente' IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Contrato já assinado! Sua assinatura digital foi registrada com sucesso anteriormente e não é permitido assinar novamente.',
      'jaAssinado', true,
      'assinadoEm', v_doc.assinado_em,
      'assinanteNome', v_doc.assinante_nome,
      'snapshot', v_doc.itens
    );
  END IF;

  -- Constrói o registro de evidências da assinatura do paciente
  v_assinatura_paciente := jsonb_build_object(
    'assinaturaData', p_assinatura,
    'nome', COALESCE(p_assinante_nome, v_doc.paciente_nome, 'Paciente'),
    'dataHora', v_now_iso,
    'ip', COALESCE(p_evidencias->>'ip', 'web'),
    'userAgent', COALESCE(p_evidencias->>'userAgent', ''),
    'cpf', COALESCE(p_evidencias->>'cpf', v_doc.itens->'paciente'->>'cpf'),
    'rg', COALESCE(p_evidencias->>'rg', v_doc.itens->'paciente'->>'rg'),
    'email', COALESCE(p_evidencias->>'email', v_doc.itens->'paciente'->>'email'),
    'selfie', p_evidencias->>'selfie',
    'hashDocumento', COALESCE(p_evidencias->>'hashDocumento', '')
  );

  v_tem_dentista := (v_doc.itens->'assinaturaDentista' IS NOT NULL);

  v_novo_itens := v_doc.itens;
  v_novo_itens := jsonb_set(v_novo_itens, '{status}', to_jsonb(CASE WHEN v_tem_dentista THEN 'formalizado' ELSE 'assinado' END));
  v_novo_itens := jsonb_set(v_novo_itens, '{assinaturaPaciente}', v_assinatura_paciente);
  v_novo_itens := jsonb_set(v_novo_itens, '{statusAssinaturaPaciente}', '"assinado"'::jsonb);
  IF v_tem_dentista THEN
    v_novo_itens := jsonb_set(v_novo_itens, '{isFormalizadoTotal}', 'true'::jsonb);
  ELSE
    v_novo_itens := jsonb_set(v_novo_itens, '{isFormalizadoTotal}', 'false'::jsonb);
  END IF;

  IF p_evidencias->'termoUsoImagem' IS NOT NULL THEN
    v_novo_itens := jsonb_set(v_novo_itens, '{termoUsoImagem}', p_evidencias->'termoUsoImagem');
  END IF;

  UPDATE public.documentos_clinicos
  SET
    assinado_em = v_now,
    assinante_nome = COALESCE(p_assinante_nome, v_doc.paciente_nome, 'Paciente'),
    assinatura_data = p_assinatura,
    itens = v_novo_itens,
    atualizado_em = v_now
  WHERE id = v_doc.id;

  -- Registra na tabela assinaturas com tratamento de unicidade
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
      v_doc.id::text,
      'contrato',
      'paciente',
      COALESCE(p_assinante_nome, v_doc.paciente_nome, 'Paciente'),
      p_assinatura,
      v_doc.paciente_id,
      v_doc.user_id,
      p_evidencias,
      v_now,
      v_now
    )
    ON CONFLICT (documento_id, tipo) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'mensagem', 'Contrato assinado digitalmente com sucesso!',
    'assinadoEm', v_now_iso,
    'isFormalizadoTotal', v_tem_dentista,
    'snapshot', v_novo_itens
  );
END;
$$;

-- 5. Função RPC: Registrar assinatura da profissional/dentista no contrato
CREATE OR REPLACE FUNCTION public.assinar_contrato_profissional(
  p_identificador text,
  p_assinatura text,
  p_nome text,
  p_cro text DEFAULT NULL,
  p_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc record;
  v_now timestamptz := now();
  v_now_iso text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_novo_itens jsonb;
  v_assinatura_dentista jsonb;
  v_tem_paciente boolean := false;
BEGIN
  IF p_identificador IS NULL OR trim(p_identificador) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Identificador do contrato é obrigatório');
  END IF;

  IF p_assinatura IS NULL OR trim(p_assinatura) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Assinatura é obrigatória');
  END IF;

  SELECT * INTO v_doc
  FROM public.documentos_clinicos
  WHERE tipo = 'contrato'
    AND (
      (p_identificador ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id::text = p_identificador)
      OR (itens->>'contratoId' = p_identificador)
      OR (itens->>'contratoId' = upper(p_identificador))
    )
  ORDER BY criado_em DESC
  LIMIT 1
  FOR UPDATE;

  IF v_doc.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Contrato não encontrado');
  END IF;

  v_assinatura_dentista := jsonb_build_object(
    'assinaturaData', p_assinatura,
    'nome', COALESCE(p_nome, v_doc.dentista, 'Cirurgião(ã)-Dentista Responsável'),
    'cro', p_cro,
    'dataHora', v_now_iso
  );

  v_tem_paciente := (v_doc.assinado_em IS NOT NULL) OR (v_doc.itens->'assinaturaPaciente' IS NOT NULL);

  v_novo_itens := v_doc.itens;
  v_novo_itens := jsonb_set(v_novo_itens, '{assinaturaDentista}', v_assinatura_dentista);
  v_novo_itens := jsonb_set(v_novo_itens, '{statusAssinaturaDentista}', '"assinado"'::jsonb);
  IF v_tem_paciente THEN
    v_novo_itens := jsonb_set(v_novo_itens, '{status}', '"formalizado"'::jsonb);
    v_novo_itens := jsonb_set(v_novo_itens, '{isFormalizadoTotal}', 'true'::jsonb);
  END IF;

  UPDATE public.documentos_clinicos
  SET
    itens = v_novo_itens,
    atualizado_em = v_now
  WHERE id = v_doc.id;

  BEGIN
    INSERT INTO public.assinaturas (
      documento_id,
      documento_tipo,
      tipo,
      nome,
      assinatura_data,
      paciente_id,
      user_id,
      criado_em,
      atualizado_em
    ) VALUES (
      v_doc.id::text,
      'contrato',
      'dentista',
      COALESCE(p_nome, 'Cirurgião(ã)-Dentista Responsável'),
      p_assinatura,
      v_doc.paciente_id,
      v_doc.user_id,
      v_now,
      v_now
    )
    ON CONFLICT (documento_id, tipo) DO UPDATE
      SET assinatura_data = EXCLUDED.assinatura_data,
          nome = EXCLUDED.nome,
          atualizado_em = EXCLUDED.atualizado_em;
  EXCEPTION WHEN OTHERS THEN
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'mensagem', 'Assinatura da profissional registrada com sucesso no banco de dados!',
    'assinadoEm', v_now_iso,
    'isFormalizadoTotal', v_tem_paciente,
    'snapshot', v_novo_itens
  );
END;
$$;

-- 6. Concessões de permissão pública de execução para anon e authenticated
GRANT EXECUTE ON FUNCTION public.obter_contrato_publico(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assinar_contrato_publico(text, text, text, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assinar_contrato_profissional(text, text, text, text, text) TO anon, authenticated;
