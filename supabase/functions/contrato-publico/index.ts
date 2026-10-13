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
    const { action, id, signature, signerName } = await req.json();
    if (!action || !id) return json({ error: "Parâmetros 'action' e 'id' são obrigatórios" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Tenta buscar pelo ID direto (UUID)
    let query = supabase.from("documentos_clinicos").select("*").eq("id", id).maybeSingle();
    let { data: doc, error } = await query;

    // Se não encontrou por UUID direto, tenta buscar por itens->>contratoId (ex: CTR-...)
    if (!doc && !error) {
      const { data: docByContratoId, error: err2 } = await supabase
        .from("documentos_clinicos")
        .select("*")
        .filter("itens->>contratoId", "eq", id)
        .maybeSingle();

      if (!err2 && docByContratoId) {
        doc = docByContratoId;
      }
    }

    if (error) {
      console.error("Erro ao consultar documentos_clinicos:", error);
      throw error;
    }

    if (!doc) {
      return json({ error: "Contrato não encontrado" }, 404);
    }

    if (action === "get") {
      return json({
        ok: true,
        id: doc.id,
        titulo: doc.titulo,
        snapshot: doc.itens,
        conteudo: doc.conteudo,
        assinadoEm: doc.assinado_em,
        assinanteNome: doc.assinante_nome,
      });
    }

    if (action === "sign") {
      if (!signature) return json({ error: "Assinatura gráfica ausente" }, 400);

      const dataHoraIso = new Date().toISOString();
      const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "web";
      const userAgent = req.headers.get("user-agent") || "";

      const updatedSnapshot = {
        ...(typeof doc.itens === "object" && doc.itens ? doc.itens : {}),
        status: "assinado",
        assinaturaPaciente: {
          assinaturaData: signature,
          nome: signerName || doc.paciente_nome || "Paciente",
          dataHora: dataHoraIso,
          ip: clientIp,
          userAgent,
        },
      };

      const { error: updateErr } = await supabase
        .from("documentos_clinicos")
        .update({
          assinatura_data: signature,
          assinante_nome: signerName || doc.paciente_nome || "Paciente",
          assinado_em: dataHoraIso,
          itens: updatedSnapshot,
        })
        .eq("id", doc.id);

      if (updateErr) throw updateErr;

      return json({
        ok: true,
        mensagem: "Contrato assinado com sucesso!",
        assinadoEm: dataHoraIso,
        snapshot: updatedSnapshot,
      });
    }

    return json({ error: "Ação não suportada" }, 400);
  } catch (e) {
    console.error("contrato-publico error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
