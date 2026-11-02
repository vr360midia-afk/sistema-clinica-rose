-- ==============================================================================
-- MIGRATION: AGENDAMENTO AUTOMÁTICO DE REPROCESSAMENTO DA FILA DE PDFS
-- Clínica Dra. Rosângela - Data: 2026-11-02
-- Execução autônoma via pg_cron + pg_net + Supabase Vault (Zero credenciais em texto puro)
-- Totalmente idempotente, não-destrutiva e desacoplada da abertura do painel
-- ==============================================================================

-- 1. Habilita extensões se disponíveis no ambiente Supabase (com proteção para ambientes locais)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA net;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Extensão pg_net não disponível neste ambiente local. Será habilitada no Supabase hospedado.';
END $$;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Extensão pg_cron não disponível neste ambiente local. Será habilitada no Supabase hospedado.';
END $$;

-- 2. Tabela de controle de deadlocks / timeout de processamento (se tarefa ficar presa em 'processando')
CREATE OR REPLACE FUNCTION public.reconciliar_fila_pdf_timeouts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_afetados integer := 0;
BEGIN
  -- Libera tarefas que ficaram presas em 'processando' por mais de 15 minutos (timeout/crash)
  UPDATE public.fila_arquivamento_pdf
  SET status = 'falha',
      ultimo_erro = 'Timeout de processamento (tarefa travada por mais de 15 minutos)',
      atualizado_em = now()
  WHERE status = 'processando'
    AND atualizado_em < (now() - interval '15 minutes')
    AND tentativas < max_tentativas;

  GET DIAGNOSTICS v_afetados = ROW_COUNT;
  RETURN v_afetados;
END;
$$;

-- 3. View para monitoramento de tarefas pendentes e falhas (visibilidade operacional)
CREATE OR REPLACE VIEW public.vw_fila_pdf_pendencias AS
SELECT 
  id,
  contrato_id,
  clinica_id,
  paciente_id,
  status,
  tentativas,
  max_tentativas,
  ultimo_erro,
  criado_em,
  atualizado_em,
  CASE 
    WHEN status = 'concluido' THEN 'CONCLUÍDO'
    WHEN status = 'processando' AND atualizado_em < (now() - interval '15 minutes') THEN 'TRAVADO_TIMEOUT'
    WHEN status = 'processando' THEN 'EM_PROCESSAMENTO'
    WHEN status = 'falha' AND tentativas >= max_tentativas THEN 'FALHA_DEFINITIVA_EXCEDIDA'
    WHEN status = 'falha' THEN 'FALHA_AGUARDANDO_RETRY'
    ELSE 'PENDENTE'
  END AS situacao_operacional
FROM public.fila_arquivamento_pdf;

-- 4. Função que dispara a Edge Function de forma segura via pg_net utilizando Vault
CREATE OR REPLACE FUNCTION public.executar_agendamento_processar_fila_pdf()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_url text := NULL;
  v_service_key text := NULL;
  v_req_id bigint;
  v_url text;
  v_timeouts integer := 0;
  v_has_net boolean := false;
BEGIN
  -- 1. Recupera timeouts de execuções anteriores travadas
  v_timeouts := public.reconciliar_fila_pdf_timeouts();

  -- 2. Verifica se há tarefas elegíveis para processar antes de disparar HTTP
  IF NOT EXISTS (
    SELECT 1 FROM public.fila_arquivamento_pdf
    WHERE status IN ('pendente', 'falha')
      AND tentativas < max_tentativas
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object('ok', true, 'mensagem', 'Fila vazia ou sem tarefas elegíveis', 'timeouts_liberados', v_timeouts);
  END IF;

  -- 3. Busca credencial segura no Supabase Vault (Zero texto puro em código)
  BEGIN
    SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key' OR name = 'SUPABASE_SERVICE_ROLE_KEY'
    ORDER BY created_at DESC
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_service_key := NULL;
  END;

  -- Fallback de configuração de sessão segura caso Vault não esteja populado
  IF v_service_key IS NULL THEN
    v_service_key := nullif(current_setting('app.settings.service_role_key', true), '');
  END IF;

  -- 4. Busca Project URL no Vault ou fallback de settings
  BEGIN
    SELECT decrypted_secret INTO v_project_url
    FROM vault.decrypted_secrets
    WHERE name = 'project_url' OR name = 'SUPABASE_PROJECT_URL'
    ORDER BY created_at DESC
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_project_url := NULL;
  END;

  IF v_project_url IS NULL THEN
    v_project_url := nullif(current_setting('app.settings.project_url', true), '');
  END IF;

  -- Se não configurado em Vault ou settings, encerra com aviso detalhado
  IF v_service_key IS NULL OR v_project_url IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'erro', 'Credenciais de serviço não encontradas no Supabase Vault (configure service_role_key e project_url no Vault)',
      'code', 'VAULT_SECRET_MISSING'
    );
  END IF;

  v_url := rtrim(v_project_url, '/') || '/functions/v1/contrato-publico';

  -- 5. Dispara chamada HTTP assíncrona autenticada com service_role via pg_net (se disponível)
  SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
  ) INTO v_has_net;

  IF v_has_net THEN
    BEGIN
      EXECUTE 'SELECT net.http_post(
        url := $1,
        headers := jsonb_build_object(
          ''Content-Type'', ''application/json'',
          ''Authorization'', ''Bearer '' || $2
        ),
        body := jsonb_build_object(''action'', ''processar_fila_pdf'')
      )' INTO v_req_id USING v_url, v_service_key;

      RETURN jsonb_build_object(
        'ok', true,
        'net_request_id', v_req_id,
        'timeouts_liberados', v_timeouts,
        'agendado_em', now()
      );
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'erro', SQLERRM, 'code', 'NET_POST_FAILED');
    END;
  ELSE
    RETURN jsonb_build_object(
      'ok', true,
      'modo', 'simulado_sem_pg_net',
      'url', v_url,
      'timeouts_liberados', v_timeouts,
      'mensagem', 'Extensão pg_net não instalada localmente; disparo será executado pelo pg_net no Supabase hospedado.'
    );
  END IF;
END;
$$;

-- 5. Restrição estrita de permissões (Apenas identidades internas/superusers)
REVOKE EXECUTE ON FUNCTION public.executar_agendamento_processar_fila_pdf() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.executar_agendamento_processar_fila_pdf() TO service_role;

REVOKE ALL ON public.vw_fila_pdf_pendencias FROM anon, public;
GRANT SELECT ON public.vw_fila_pdf_pendencias TO authenticated, service_role;

-- 6. Agendamento com pg_cron a cada 10 minutos (idempotente)
DO $$
BEGIN
  -- Verifica se a extensão cron está disponível
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove agendamento anterior se já existir para evitar duplicações
    PERFORM cron.unschedule('processar-fila-pdf-contratos')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'processar-fila-pdf-contratos');

    -- Cria o agendamento a cada 10 minutos
    PERFORM cron.schedule(
      'processar-fila-pdf-contratos',
      '*/10 * * * *',
      'SELECT public.executar_agendamento_processar_fila_pdf();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Em ambientes sem pg_cron ativo no PostgreSQL local, ignora sem quebrar a migration
  RAISE NOTICE 'pg_cron não pôde ser ativado automaticamente neste ambiente local. Será ativado no Supabase hospedado.';
END;
$$;
