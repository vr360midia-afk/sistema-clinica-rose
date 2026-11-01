-- ==============================================================================
-- SCHEMA COMPLETO E DEFINITIVO PARA CONTRATOS DIGITAIS PÚBLICOS
-- Execute no Supabase SQL Editor (Dashboard -> SQL Editor)
-- ==============================================================================

ALTER TABLE public.documentos_clinicos ENABLE ROW LEVEL SECURITY;

-- Índices de alta performance
CREATE INDEX IF NOT EXISTS idx_doc_clinicos_contrato_id 
  ON public.documentos_clinicos USING btree ((itens->>'contratoId'));

CREATE INDEX IF NOT EXISTS idx_doc_clinicos_token 
  ON public.documentos_clinicos USING btree ((itens->>'token'));

CREATE INDEX IF NOT EXISTS idx_doc_clinicos_tipo 
  ON public.documentos_clinicos (tipo);

-- Políticas RLS
DROP POLICY IF EXISTS "Permitir leitura publica de contratos" ON public.documentos_clinicos;
CREATE POLICY "Permitir leitura publica de contratos"
  ON public.documentos_clinicos
  FOR SELECT
  TO anon, authenticated
  USING (tipo = 'contrato');

DROP POLICY IF EXISTS "Permitir assinatura publica de contratos" ON public.documentos_clinicos;
CREATE POLICY "Permitir assinatura publica de contratos"
  ON public.documentos_clinicos
  FOR UPDATE
  TO anon, authenticated
  USING (tipo = 'contrato')
  WITH CHECK (tipo = 'contrato');

-- Função RPC: Obter contrato com validação de token
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
    )
  ORDER BY criado_em DESC
  LIMIT 1;

  IF v_doc.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Contrato não encontrado');
  END IF;

  v_token_salvo := v_doc.itens->>'token';
  IF v_token_salvo IS NULL OR trim(v_token_salvo) = '' OR v_token_salvo <> trim(p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Token de acesso inválido ou revogado');
  END IF;

  v_expira_em := v_doc.itens->>'tokenValidoAte';
  IF v_expira_em IS NOT NULL AND v_expira_em <> '' THEN
    BEGIN
      IF v_expira_em::timestamptz < now() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Este link de contrato expirou. Solicite um novo link à clínica.');
      END IF;
    EXCEPTION WHEN OTHERS THEN
    END;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_doc.id,
    'identificador', COALESCE(v_doc.itens->>'contratoId', v_doc.id::text),
    'titulo', v_doc.titulo,
    'conteudo', v_doc.conteudo,
    'pacienteNome', v_doc.paciente_nome,
    'status', COALESCE(v_doc.itens->>'status', CASE WHEN v_doc.assinado_em IS NOT NULL THEN 'assinado' ELSE 'pendente' END),
    'assinadoEm', v_doc.assinado_em,
    'assinanteNome', v_doc.assinante_nome,
    'snapshot', v_doc.itens
  );
END;
$$;

-- Função RPC: Assinar contrato digitalmente
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
BEGIN
  IF p_identificador IS NULL OR trim(p_identificador) = '' OR p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Identificador e token são obrigatórios');
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
    )
  ORDER BY criado_em DESC
  LIMIT 1;

  IF v_doc.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Contrato não encontrado');
  END IF;

  v_token_salvo := v_doc.itens->>'token';
  IF v_token_salvo IS NULL OR trim(v_token_salvo) = '' OR v_token_salvo <> trim(p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Token de acesso inválido ou revogado');
  END IF;

  IF v_doc.assinado_em IS NOT NULL OR v_doc.itens->>'status' = 'assinado' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Este contrato já foi assinado e sua versão não pode ser alterada.');
  END IF;

  v_assinatura_paciente := jsonb_build_object(
    'assinaturaData', p_assinatura,
    'nome', COALESCE(p_assinante_nome, v_doc.paciente_nome, 'Paciente'),
    'dataHora', v_now_iso,
    'ip', COALESCE(p_evidencias->>'ip', 'web'),
    'userAgent', COALESCE(p_evidencias->>'userAgent', ''),
    'cpf', COALESCE(p_evidencias->>'cpf', v_doc.itens->'paciente'->>'cpf'),
    'email', COALESCE(p_evidencias->>'email', v_doc.itens->'paciente'->>'email'),
    'hashDocumento', COALESCE(p_evidencias->>'hashDocumento', '')
  );

  v_novo_itens := v_doc.itens;
  v_novo_itens := jsonb_set(v_novo_itens, '{status}', '"assinado"');
  v_novo_itens := jsonb_set(v_novo_itens, '{assinaturaPaciente}', v_assinatura_paciente);
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

  RETURN jsonb_build_object(
    'ok', true,
    'mensagem', 'Contrato assinado digitalmente com sucesso!',
    'assinadoEm', v_now_iso,
    'snapshot', v_novo_itens
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.obter_contrato_publico(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assinar_contrato_publico(text, text, text, text, jsonb) TO anon, authenticated;
