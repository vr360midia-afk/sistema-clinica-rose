-- ==============================================================================
-- ROLLBACK: EXTENSÃO WHATSAPP WEB CRM & AGENDAMENTO SEGURO (HOMOLOGAÇÃO)
-- ==============================================================================

DROP FUNCTION IF EXISTS public.agendar_consulta_extensao(UUID, DATE, TEXT, INTEGER, TEXT, TEXT, TEXT, UUID);
DROP POLICY IF EXISTS crm_leads_auth_access ON public.crm_leads;
DROP POLICY IF EXISTS dentistas_auth_access ON public.dentistas;
DROP POLICY IF EXISTS consultas_auth_access ON public.consultas;
DROP POLICY IF EXISTS bloqueios_agenda_auth_access ON public.bloqueios_agenda;

