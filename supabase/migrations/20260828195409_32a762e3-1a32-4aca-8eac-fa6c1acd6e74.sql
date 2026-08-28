ALTER TABLE public.configuracoes ADD COLUMN IF NOT EXISTS whatsapp_numero text;

CREATE TABLE IF NOT EXISTS public.whatsapp_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  paciente_id uuid REFERENCES public.pacientes(id) ON DELETE SET NULL,
  telefone text NOT NULL,
  nome_contato text,
  direcao text NOT NULL DEFAULT 'recebida',
  corpo text,
  media_url text,
  status text NOT NULL DEFAULT 'recebida',
  message_sid text,
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_msg_user_tel ON public.whatsapp_mensagens (user_id, telefone, criado_em DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_mensagens TO authenticated;
GRANT ALL ON public.whatsapp_mensagens TO service_role;

ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_msg_select_own" ON public.whatsapp_mensagens FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "wa_msg_insert_own" ON public.whatsapp_mensagens FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "wa_msg_update_own" ON public.whatsapp_mensagens FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "wa_msg_delete_own" ON public.whatsapp_mensagens FOR DELETE TO authenticated USING (user_id = auth.uid());