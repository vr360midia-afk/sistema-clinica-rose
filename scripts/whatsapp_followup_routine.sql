-- ==============================================================================
-- ROTINA DE AUTOMAÇÃO DE FOLLOW-UP VIA BANCO (PG_CRON / SUPABASE)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.executar_rotina_followup_crm()
RETURNS JSONB AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_count_fu1 INT := 0;
    v_count_fu2 INT := 0;
BEGIN
    -- 1. primeiro_contato sem resposta há mais de 3 horas -> move para followup_1
    WITH movidos_fu1 AS (
        UPDATE public.crm_leads
        SET stage = 'followup_1',
            status = 'followup_1',
            updated_at = v_now
        WHERE (stage = 'primeiro_contato' OR status = 'primeiro_contato')
          AND last_outbound_at IS NOT NULL
          AND last_outbound_at <= (v_now - INTERVAL '3 hours')
          AND (last_inbound_at IS NULL OR last_inbound_at < last_outbound_at)
        RETURNING id
    )
    SELECT count(*) INTO v_count_fu1 FROM movidos_fu1;

    -- 2. followup_1 sem resposta há mais de 18 horas -> move para followup_2
    WITH movidos_fu2 AS (
        UPDATE public.crm_leads
        SET stage = 'followup_2',
            status = 'followup_2',
            updated_at = v_now
        WHERE (stage IN ('followup_1', 'fu_3h') OR status IN ('followup_1', 'fu_3h'))
          AND last_outbound_at IS NOT NULL
          AND last_outbound_at <= (v_now - INTERVAL '18 hours')
          AND (last_inbound_at IS NULL OR last_inbound_at < last_outbound_at)
        RETURNING id
    )
    SELECT count(*) INTO v_count_fu2 FROM movidos_fu2;

    RETURN jsonb_build_object(
        'sucesso', true,
        'executado_em', v_now,
        'movidos_fu1', v_count_fu1,
        'movidos_fu2', v_count_fu2
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Se a extensão pg_cron estiver habilitada no Supabase:
-- SELECT cron.schedule(
--     'executar-followup-crm-10min',
--     '*/10 * * * *',
--     'SELECT public.executar_rotina_followup_crm();'
-- );
