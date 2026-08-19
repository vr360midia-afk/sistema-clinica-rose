import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, id, token, signature, signerName } = await req.json();
    if (!action || !id || !token) return json({ error: "Parâmetros inválidos" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: extrato, error } = await supabase
      .from("extratos_financeiros")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!extrato || extrato.token_assinatura !== token) return json({ error: "invalid" }, 404);
    if (extrato.data_expiracao_link && new Date(extrato.data_expiracao_link) < new Date()) {
      return json({ error: "expired" }, 410);
    }

    if (action === "get") {
      return json({
        extrato: {
          id: extrato.id,
          pacienteNome: extrato.paciente_nome,
          dados: extrato.dados,
          totalPago: Number(extrato.total_pago || 0),
          totalPendente: Number(extrato.total_pendente || 0),
          totalPrevisto: Number(extrato.total_previsto || 0),
          total: Number(extrato.total || 0),
          criadoEm: extrato.criado_em,
          jaAssinado: !!extrato.assinatura_paciente,
        },
      });
    }

    if (action === "sign") {
      if (!signature) return json({ error: "Assinatura ausente" }, 400);
      if (extrato.assinatura_paciente) return json({ ok: true, jaAssinado: true });

      const { error: upErr } = await supabase
        .from("extratos_financeiros")
        .update({
          assinatura_paciente: {
            signature,
            signerName: signerName || extrato.paciente_nome || "Paciente",
            signerRole: "paciente",
            timestamp: new Date().toISOString(),
          },
          status_assinatura: "assinado",
          data_assinatura: new Date().toISOString(),
        })
        .eq("id", id);

      if (upErr) throw upErr;
      return json({ ok: true });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    console.error("extrato-publico error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
