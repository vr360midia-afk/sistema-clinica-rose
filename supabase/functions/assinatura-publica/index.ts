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

    const { data: anamnese, error } = await supabase
      .from("anamneses")
      .select("id, paciente_id, data, queixa_principal, status_assinatura")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!anamnese) {
      return json({ error: "invalid" }, 404);
    }

    const { data: paciente } = await supabase
      .from("pacientes")
      .select("nome")
      .eq("id", anamnese.paciente_id)
      .maybeSingle();

    const { data: cfg } = await supabase
      .from("configuracoes")
      .select("nome_clinica, telefone, whatsapp_numero")
      .limit(1)
      .maybeSingle();

    if (action === "get") {
      return json({
        anamnese: {
          id: anamnese.id,
          data: anamnese.data,
          queixaPrincipal: anamnese.queixa_principal,
          jaAssinado: !!anamnese.assinatura_paciente,
        },
        paciente: { nome: paciente?.nome ?? "Paciente" },
        clinica: {
          nome: cfg?.nome_clinica || "Dra. Rosangela Santos",
          telefone: cfg?.whatsapp_numero || cfg?.telefone || "5582974002213",
        },
      });
    }

    if (action === "sign") {
      if (!signature) return json({ error: "Assinatura ausente" }, 400);
      if (anamnese.assinatura_paciente) return json({ ok: true, jaAssinado: true });

      const assinaturaPaciente = {
        signature,
        signerName: signerName || paciente?.nome || "Paciente",
        signerRole: "paciente",
        timestamp: new Date().toISOString(),
      };

      const { error: upErr } = await supabase
        .from("anamneses")
        .update({
          assinatura_paciente: assinaturaPaciente,
          status_assinatura: anamnese.assinatura_doutor ? "completo" : "paciente_assinado",
          data_assinatura: new Date().toISOString(),
        })
        .eq("id", id);

      if (upErr) throw upErr;
      return json({ ok: true });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    console.error("assinatura-publica error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
