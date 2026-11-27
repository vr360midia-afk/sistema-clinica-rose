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
    const body = await req.json();
    const { action, id, token, signature, signerName, respostasAtualizadas } = body;
    if (!action || !id) return json({ error: "Parâmetros inválidos" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Tenta buscar via RPC dedicado
    if (action === "get") {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("obter_anamnese_publica", {
        p_identificador: id,
        p_token: token || null,
      });

      if (!rpcErr && rpcData && rpcData.ok) {
        return json(rpcData);
      }
    }

    if (action === "sign") {
      if (!signature) return json({ error: "Assinatura ausente" }, 400);

      const assinaturaPayload = {
        signature,
        signerName: signerName || "Paciente",
        signerRole: "paciente",
        timestamp: new Date().toISOString(),
      };

      const { data: signData, error: signErr } = await supabase.rpc("assinar_anamnese_publica", {
        p_identificador: id,
        p_token: token || null,
        p_assinatura: assinaturaPayload,
        p_respostas: respostasAtualizadas || {},
        p_signer_name: signerName || "Paciente",
      });

      if (!signErr && signData && signData.ok) {
        return json({ ok: true, data: signData });
      }
    }

    // 2. Fallback caso o RPC não esteja acessível diretamente
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let query = supabase.from("anamneses").select("*");
    if (isUuid) {
      query = query.eq("id", id);
    } else {
      query = query.ilike("exame_extra_bucal", `%${id}%`);
    }

    const { data: anamnese, error } = await query.order("criado_em", { ascending: false }).limit(1).maybeSingle();

    if (error) throw error;
    if (!anamnese) {
      return json({ error: "invalid" }, 404);
    }

    let parsedExtra: any = {};
    if (typeof anamnese.exame_extra_bucal === "string" && anamnese.exame_extra_bucal.startsWith("{")) {
      try {
        parsedExtra = JSON.parse(anamnese.exame_extra_bucal);
      } catch (_) {}
    }

    const { data: paciente } = await supabase
      .from("pacientes")
      .select("nome, telefone, cpf, email")
      .eq("id", anamnese.paciente_id)
      .maybeSingle();

    const { data: cfg } = await supabase
      .from("configuracoes")
      .select("nome_clinica, telefone, whatsapp_numero")
      .limit(1)
      .maybeSingle();

    const jaAssinado =
      anamnese.status_assinatura === "paciente_assinado" ||
      anamnese.status_assinatura === "completo" ||
      !!anamnese.assinatura_paciente ||
      !!parsedExtra.assinaturaPaciente;

    if (action === "get") {
      return json({
        ok: true,
        anamnese: {
          id: anamnese.id,
          data: anamnese.data,
          queixaPrincipal: parsedExtra.queixaPrincipal || anamnese.queixa_principal,
          historiaAtual: parsedExtra.historiaAtual || "",
          historiaFamiliar: parsedExtra.historiaFamiliar || "",
          historiaMedica: parsedExtra.historiaMedica || anamnese.historia_medica,
          alergias: parsedExtra.alergias || anamnese.alergias,
          medicamentos: parsedExtra.medicamentos || anamnese.medicamentos,
          habitosViciosPositivos: parsedExtra.habitosViciosPositivos || "",
          habitosViciosNegativos: parsedExtra.habitosViciosNegativos || "",
          observacoes: parsedExtra.observacoes || "",
          respostas: parsedExtra.respostas || anamnese.respostas || {},
          jaAssinado,
          statusAssinatura: anamnese.status_assinatura,
          assinaturaPaciente: parsedExtra.assinaturaPaciente || anamnese.assinatura_paciente,
        },
        paciente: {
          id: anamnese.paciente_id,
          nome: paciente?.nome || "Paciente",
          telefone: paciente?.telefone,
          cpf: paciente?.cpf,
          email: paciente?.email,
        },
        clinica: {
          nome: cfg?.nome_clinica || "Dra. Rosangela Santos",
          telefone: cfg?.whatsapp_numero || cfg?.telefone || "5582974002213",
        },
      });
    }

    if (action === "sign") {
      if (!signature) return json({ error: "Assinatura ausente" }, 400);
      if (jaAssinado) return json({ ok: true, jaAssinado: true });

      const assinaturaPaciente = {
        signature,
        signerName: signerName || paciente?.nome || "Paciente",
        signerRole: "paciente",
        timestamp: new Date().toISOString(),
      };

      const now = new Date().toISOString();
      const newExtra = {
        ...parsedExtra,
        __isExtraPayload: true,
        assinaturaPaciente,
        dataAssinatura: now,
        respostas: respostasAtualizadas || parsedExtra.respostas,
        ...(respostasAtualizadas ? respostasAtualizadas : {}),
      };

      const updateData: any = {
        status_assinatura: anamnese.assinatura_doutor || parsedExtra.assinaturaDoutor ? "completo" : "paciente_assinado",
        assinatura_paciente: assinaturaPaciente,
        data_assinatura: now,
        exame_extra_bucal: JSON.stringify(newExtra),
      };

      if (respostasAtualizadas?.queixaPrincipal) updateData.queixa_principal = respostasAtualizadas.queixaPrincipal;
      if (respostasAtualizadas?.historiaMedica) updateData.historia_medica = respostasAtualizadas.historiaMedica;
      if (respostasAtualizadas?.alergias) updateData.alergias = respostasAtualizadas.alergias;
      if (respostasAtualizadas?.medicamentos) updateData.medicamentos = respostasAtualizadas.medicamentos;
      if (respostasAtualizadas) updateData.respostas = respostasAtualizadas;

      const { error: upErr } = await supabase
        .from("anamneses")
        .update(updateData)
        .eq("id", anamnese.id);

      if (upErr) throw upErr;

      return json({ ok: true });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    console.error("assinatura-publica error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
