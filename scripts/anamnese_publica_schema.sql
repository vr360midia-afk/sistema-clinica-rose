-- ==============================================================================
-- SCHEMA PARA PERSISTÊNCIA E ASSINATURA PÚBLICA DE ANAMNESE VIA RPC (SECURITY DEFINER)
-- Permite que pacientes preencham e assinem a anamnese diretamente no banco
-- ==============================================================================

-- Adiciona colunas para compatibilidade nativa com assinaturas e respostas
ALTER TABLE public.anamneses ADD COLUMN IF NOT EXISTS assinatura_paciente jsonb;
ALTER TABLE public.anamneses ADD COLUMN IF NOT EXISTS assinatura_doutor jsonb;
ALTER TABLE public.anamneses ADD COLUMN IF NOT EXISTS data_assinatura timestamptz;
ALTER TABLE public.anamneses ADD COLUMN IF NOT EXISTS respostas jsonb;

CREATE OR REPLACE FUNCTION public.obter_anamnese_publica(
  p_identificador text,
  p_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ana record;
  v_paciente record;
  v_cfg record;
  v_parsed_extra jsonb := '{}'::jsonb;
  v_ja_assinado boolean := false;
  v_assinatura_data jsonb := null;
BEGIN
  IF p_identificador IS NULL OR trim(p_identificador) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Identificador é obrigatório');
  END IF;

  -- Busca por ID (se for UUID) ou por exame_extra_bucal que contenha o identificador/token
  SELECT * INTO v_ana
  FROM public.anamneses
  WHERE (
    (p_identificador ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id::text = p_identificador)
    OR (exame_extra_bucal IS NOT NULL AND exame_extra_bucal LIKE '%' || p_identificador || '%')
    OR (p_token IS NOT NULL AND p_token <> '' AND exame_extra_bucal IS NOT NULL AND exame_extra_bucal LIKE '%' || p_token || '%')
  )
  ORDER BY criado_em DESC
  LIMIT 1;

  IF v_ana.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Anamnese não encontrada');
  END IF;

  -- Tenta fazer parse do exame_extra_bucal para resgatar campos detalhados
  IF v_ana.exame_extra_bucal IS NOT NULL AND trim(v_ana.exame_extra_bucal) LIKE '{%}' THEN
    BEGIN
      v_parsed_extra := v_ana.exame_extra_bucal::jsonb;
    EXCEPTION WHEN OTHERS THEN
      v_parsed_extra := '{}'::jsonb;
    END;
  END IF;

  -- Avalia se já foi assinada pelo paciente
  IF (v_ana.status_assinatura = 'paciente_assinado' OR v_ana.status_assinatura = 'completo')
     OR (v_parsed_extra ? 'assinaturaPaciente' AND v_parsed_extra->'assinaturaPaciente' IS NOT NULL) THEN
    v_ja_assinado := true;
    v_assinatura_data := v_parsed_extra->'assinaturaPaciente';
  END IF;

  -- Busca dados do paciente
  SELECT nome, telefone, cpf, email, data_nascimento INTO v_paciente
  FROM public.pacientes
  WHERE id = v_ana.paciente_id
  LIMIT 1;

  -- Busca dados da clínica
  SELECT nome_clinica, telefone, whatsapp_numero INTO v_cfg
  FROM public.configuracoes
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'anamnese', jsonb_build_object(
      'id', v_ana.id,
      'data', v_ana.data,
      'queixaPrincipal', COALESCE(v_parsed_extra->>'queixaPrincipal', v_ana.queixa_principal),
      'historiaAtual', COALESCE(v_parsed_extra->>'historiaAtual', ''),
      'historiaFamiliar', COALESCE(v_parsed_extra->>'historiaFamiliar', ''),
      'historiaMedica', COALESCE(v_parsed_extra->>'historiaMedica', v_ana.historia_medica),
      'alergias', COALESCE(v_parsed_extra->>'alergias', v_ana.alergias),
      'medicamentos', COALESCE(v_parsed_extra->>'medicamentos', v_ana.medicamentos),
      'habitosViciosPositivos', COALESCE(v_parsed_extra->>'habitosViciosPositivos', ''),
      'habitosViciosNegativos', COALESCE(v_parsed_extra->>'habitosViciosNegativos', ''),
      'observacoes', COALESCE(v_parsed_extra->>'observacoes', ''),
      'respostas', COALESCE(v_parsed_extra->'respostas', '{}'::jsonb),
      'statusAssinatura', v_ana.status_assinatura,
      'jaAssinado', v_ja_assinado,
      'assinaturaPaciente', v_assinatura_data
    ),
    'paciente', jsonb_build_object(
      'id', v_ana.paciente_id,
      'nome', COALESCE(v_paciente.nome, 'Paciente'),
      'telefone', v_paciente.telefone,
      'cpf', v_paciente.cpf,
      'email', v_paciente.email,
      'dataNascimento', v_paciente.data_nascimento
    ),
    'clinica', jsonb_build_object(
      'nome', COALESCE(v_cfg.nome_clinica, 'Dra. Rosangela Santos'),
      'telefone', COALESCE(v_cfg.whatsapp_numero, v_cfg.telefone, '5582974002213')
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.assinar_anamnese_publica(
  p_identificador text,
  p_token text DEFAULT NULL,
  p_assinatura jsonb DEFAULT '{}'::jsonb,
  p_respostas jsonb DEFAULT '{}'::jsonb,
  p_signer_name text DEFAULT 'Paciente'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ana record;
  v_parsed_extra jsonb := '{}'::jsonb;
  v_paciente record;
  v_new_extra jsonb;
  v_status_final text := 'paciente_assinado';
  v_now timestamptz := now();
BEGIN
  IF p_identificador IS NULL OR trim(p_identificador) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Identificador é obrigatório');
  END IF;

  -- Localiza a anamnese
  SELECT * INTO v_ana
  FROM public.anamneses
  WHERE (
    (p_identificador ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id::text = p_identificador)
    OR (exame_extra_bucal IS NOT NULL AND exame_extra_bucal LIKE '%' || p_identificador || '%')
    OR (p_token IS NOT NULL AND p_token <> '' AND exame_extra_bucal IS NOT NULL AND exame_extra_bucal LIKE '%' || p_token || '%')
  )
  ORDER BY criado_em DESC
  LIMIT 1;

  IF v_ana.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Anamnese não encontrada');
  END IF;

  -- Parse do extra payload existente
  IF v_ana.exame_extra_bucal IS NOT NULL AND trim(v_ana.exame_extra_bucal) LIKE '{%}' THEN
    BEGIN
      v_parsed_extra := v_ana.exame_extra_bucal::jsonb;
    EXCEPTION WHEN OTHERS THEN
      v_parsed_extra := '{}'::jsonb;
    END;
  END IF;

  -- Se tiver assinatura de doutor existente, status vira completo
  IF v_parsed_extra ? 'assinaturaDoutor' AND v_parsed_extra->'assinaturaDoutor' IS NOT NULL THEN
    v_status_final := 'completo';
  END IF;

  -- Prepara novo exame_extra_bucal mesclando dados anteriores, novas respostas e a assinatura
  v_new_extra := v_parsed_extra || jsonb_build_object(
    '__isExtraPayload', true,
    'assinaturaPaciente', p_assinatura,
    'dataAssinatura', v_now,
    'respostas', COALESCE(p_respostas->'respostas', p_respostas),
    'queixaPrincipal', COALESCE(p_respostas->>'queixaPrincipal', v_ana.queixa_principal),
    'historiaAtual', COALESCE(p_respostas->>'historiaAtual', v_parsed_extra->>'historiaAtual'),
    'historiaFamiliar', COALESCE(p_respostas->>'historiaFamiliar', v_parsed_extra->>'historiaFamiliar'),
    'historiaMedica', COALESCE(p_respostas->>'historiaMedica', v_ana.historia_medica),
    'alergias', COALESCE(p_respostas->>'alergias', v_ana.alergias),
    'medicamentos', COALESCE(p_respostas->>'medicamentos', v_ana.medicamentos),
    'habitosViciosPositivos', COALESCE(p_respostas->>'habitosViciosPositivos', v_parsed_extra->>'habitosViciosPositivos'),
    'habitosViciosNegativos', COALESCE(p_respostas->>'habitosViciosNegativos', v_parsed_extra->>'habitosViciosNegativos'),
    'observacoes', COALESCE(p_respostas->>'observacoes', v_parsed_extra->>'observacoes')
  );

  -- Atualiza o registro canônico da anamnese
  UPDATE public.anamneses
  SET
    status_assinatura = v_status_final,
    assinatura_paciente = p_assinatura,
    data_assinatura = v_now,
    respostas = COALESCE(p_respostas->'respostas', p_respostas),
    queixa_principal = COALESCE(p_respostas->>'queixaPrincipal', queixa_principal),
    historia_medica = COALESCE(p_respostas->>'historiaMedica', historia_medica),
    alergias = COALESCE(p_respostas->>'alergias', alergias),
    medicamentos = COALESCE(p_respostas->>'medicamentos', medicamentos),
    exame_extra_bucal = v_new_extra::text
  WHERE id = v_ana.id;

  -- Registra no histórico em assinaturas / documentos_clinicos
  SELECT nome INTO v_paciente FROM public.pacientes WHERE id = v_ana.paciente_id;
  
  BEGIN
    INSERT INTO public.documentos_clinicos (
      paciente_id,
      paciente_nome,
      tipo,
      titulo,
      conteudo,
      assinado_em,
      assinante_nome,
      itens,
      user_id
    ) VALUES (
      v_ana.paciente_id,
      COALESCE(p_signer_name, v_paciente.nome, 'Paciente'),
      'anamnese',
      'Ficha de Anamnese Digital - ' || COALESCE(p_signer_name, v_paciente.nome, 'Paciente'),
      COALESCE(p_respostas->>'queixaPrincipal', v_ana.queixa_principal, 'Anamnese preenchida e assinada digitalmente'),
      v_now,
      COALESCE(p_signer_name, v_paciente.nome, 'Paciente'),
      jsonb_build_object(
        'anamneseId', v_ana.id,
        'assinatura', p_assinatura,
        'respostas', p_respostas,
        'timestamp', v_now
      ),
      v_ana.user_id
    );
  EXCEPTION WHEN OTHERS THEN
    -- Continua mesmo se documentos_clinicos falhar
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Anamnese assinada com sucesso',
    'id', v_ana.id,
    'statusAssinatura', v_status_final,
    'dataAssinatura', v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.obter_anamnese_publica(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assinar_anamnese_publica(text, text, jsonb, jsonb, text) TO anon, authenticated, service_role;
