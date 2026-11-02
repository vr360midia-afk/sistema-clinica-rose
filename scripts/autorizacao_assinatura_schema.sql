-- ==============================================================================
-- SCHEMA & RPCs: AUTORIZAÇÃO DE ASSINATURA AUTOMÁTICA DA PROFISSIONAL
-- Dra. Rosângela Santos Pereira — CRO 06267-AL
-- ==============================================================================

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

DROP POLICY IF EXISTS "Permitir insercao anonima de autorizacoes" ON public.autorizacoes_assinatura_profissional;
CREATE POLICY "Permitir insercao anonima de autorizacoes"
  ON public.autorizacoes_assinatura_profissional
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualizacao anonima de autorizacoes" ON public.autorizacoes_assinatura_profissional;
CREATE POLICY "Permitir atualizacao anonima de autorizacoes"
  ON public.autorizacoes_assinatura_profissional
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 1. RPC: Obter autorização ativa da profissional
CREATE OR REPLACE FUNCTION public.obter_autorizacao_ativa_profissional(
  p_cro text DEFAULT '06267-AL'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec record;
BEGIN
  SELECT * INTO v_rec
  FROM public.autorizacoes_assinatura_profissional
  WHERE ativo = true
    AND revogado_em IS NULL
    AND (
      profissional_cro = p_cro
      OR replace(replace(profissional_cro, '-', ''), ' ', '') = replace(replace(p_cro, '-', ''), ' ', '')
    )
  ORDER BY autorizado_em DESC
  LIMIT 1;

  IF v_rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'temAutorizacao', false);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'temAutorizacao', true,
    'id', v_rec.id,
    'profissionalNome', v_rec.profissional_nome,
    'profissionalCro', v_rec.profissional_cro,
    'profissionalDocumento', v_rec.profissional_documento,
    'autorizacaoExpressa', v_rec.autorizacao_expressa,
    'modelosAutorizados', v_rec.modelos_autorizados,
    'condicoesAbrangidas', v_rec.condicoes_abrangidas,
    'assinaturaGrafica', v_rec.assinatura_grafica,
    'ativo', v_rec.ativo,
    'autorizadoEm', v_rec.autorizado_em,
    'evidencias', v_rec.evidencias
  );
END;
$$;

-- 2. RPC: Conceder autorização expressa da profissional
CREATE OR REPLACE FUNCTION public.conceder_autorizacao_assinatura_profissional(
  p_nome text,
  p_cro text,
  p_documento text,
  p_autorizacao_expressa text,
  p_modelos jsonb,
  p_assinatura text,
  p_evidencias jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_new_id uuid;
  v_user_id uuid := auth.uid();
BEGIN
  -- Desativa qualquer autorização anterior ativa para este CRO
  UPDATE public.autorizacoes_assinatura_profissional
  SET ativo = false,
      revogado_em = v_now,
      motivo_revogacao = 'Substituída por nova outorga expressa de autorização',
      atualizado_em = v_now
  WHERE ativo = true AND profissional_cro = p_cro;

  INSERT INTO public.autorizacoes_assinatura_profissional (
    user_id,
    profissional_nome,
    profissional_cro,
    profissional_documento,
    autorizacao_expressa,
    modelos_autorizados,
    condicoes_abrangidas,
    assinatura_grafica,
    ativo,
    autorizado_em,
    evidencias,
    criado_em,
    atualizado_em
  ) VALUES (
    v_user_id,
    COALESCE(p_nome, 'Dra. Rosângela Santos Pereira'),
    COALESCE(p_cro, '06267-AL'),
    COALESCE(p_documento, '032.663.962-43'),
    p_autorizacao_expressa,
    COALESCE(p_modelos, '["geral", "lentes_resina", "endodontia"]'::jsonb),
    '{"apenas_orcamentos_aprovados": true}'::jsonb,
    p_assinatura,
    true,
    v_now,
    p_evidencias,
    v_now,
    v_now
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_new_id,
    'autorizadoEm', v_now,
    'mensagem', 'Autorização da profissional concedida e autenticada com sucesso!'
  );
END;
$$;

-- 3. RPC: Revogar autorização expressa
CREATE OR REPLACE FUNCTION public.revogar_autorizacao_assinatura_profissional(
  p_autorizacao_id uuid,
  p_motivo text DEFAULT 'Revogação voluntária pela profissional no painel'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_user_id uuid := auth.uid();
BEGIN
  UPDATE public.autorizacoes_assinatura_profissional
  SET ativo = false,
      revogado_em = v_now,
      revogado_por = v_user_id,
      motivo_revogacao = p_motivo,
      atualizado_em = v_now
  WHERE id = p_autorizacao_id;

  RETURN jsonb_build_object(
    'ok', true,
    'revogadoEm', v_now,
    'mensagem', 'Autorização revogada com sucesso. Emissões futuras exigirão assinatura manual.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.obter_autorizacao_ativa_profissional(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.conceder_autorizacao_assinatura_profissional(text, text, text, text, jsonb, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revogar_autorizacao_assinatura_profissional(uuid, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
