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
    const { action, signature, signerName, signerRole, snapshot: reqSnapshot } = body;
    const targetId = String(body.id || body.slug || "").trim();
    if (!action || !targetId) return json({ error: "Parâmetros 'action' e 'id'/'slug' são obrigatórios" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
    let doc: any = null;

    // 1. Tenta buscar pelo ID direto (UUID) se for formato UUID válido
    if (isUuid) {
      const { data, error } = await supabase
        .from("documentos_clinicos")
        .select("*")
        .eq("id", targetId)
        .maybeSingle();

      if (!error && data) {
        doc = data;
      }
    }

    // 2. Se não encontrou por UUID direto, tenta buscar por itens->>contratoId (ex: CTR-...)
    if (!doc) {
      const { data: docByContratoId } = await supabase
        .from("documentos_clinicos")
        .select("*")
        .filter("itens->>contratoId", "eq", targetId)
        .maybeSingle();

      if (docByContratoId) {
        doc = docByContratoId;
      }
    }

    // 3. Se ainda não encontrou, busca por slug/nome do paciente nos contratos recentes
    if (!doc) {
      const { data: docs } = await supabase
        .from("documentos_clinicos")
        .select("*")
        .eq("tipo", "contrato")
        .order("criado_em", { ascending: false })
        .limit(50);

      if (docs && docs.length > 0) {
        const cleanTarget = targetId
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]/g, "");

        doc = docs.find((d: any) => {
          const nomeDoc = (d.paciente_nome || d.itens?.pacienteNome || d.itens?.paciente?.nome || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/[^a-z0-9]/g, "");

          if (!nomeDoc || !cleanTarget) return false;
          return nomeDoc === cleanTarget || nomeDoc.includes(cleanTarget) || cleanTarget.includes(nomeDoc);
        });
      }
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

      const existingItens = typeof doc.itens === "object" && doc.itens ? doc.itens : {};
      const payloadSnapshot = typeof reqSnapshot === "object" && reqSnapshot ? reqSnapshot : {};

      const updatedSnapshot = {
        ...existingItens,
        ...payloadSnapshot,
      };

      if (signerRole === "dentista" || signerRole === "profissional") {
        updatedSnapshot.assinaturaDentista = {
          assinaturaData: signature,
          nome: signerName || updatedSnapshot?.clinica?.dentistaResponsavel || "Profissional Responsável",
          cro: updatedSnapshot?.clinica?.cro || "",
          dataHora: dataHoraIso,
          ip: clientIp,
          userAgent,
        };

        if (updatedSnapshot.assinaturaPaciente?.assinaturaData) {
          updatedSnapshot.status = "assinado";
        }

        const { error: updateErr } = await supabase
          .from("documentos_clinicos")
          .update({
            itens: updatedSnapshot,
          })
          .eq("id", doc.id);

        if (updateErr) throw updateErr;

        return json({
          ok: true,
          mensagem: "Assinatura do profissional registrada com sucesso!",
          assinadoEm: dataHoraIso,
          snapshot: updatedSnapshot,
        });
      }

      // Caso padrão: Assinatura do Paciente
      updatedSnapshot.status = "assinado";
      updatedSnapshot.assinaturaPaciente = {
        assinaturaData: signature,
        nome: signerName || doc.paciente_nome || "Paciente",
        dataHora: dataHoraIso,
        ip: clientIp,
        userAgent,
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
