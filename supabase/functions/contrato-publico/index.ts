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

// Utilitário para gerar hash SHA-256 do documento como evidência de integridade
async function gerarHashConteudo(texto: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(texto || "");
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (_) {
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return json({ error: "Configuração do servidor incompleta (service_role)" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (!action) {
      return json({ error: "Parâmetro 'action' é obrigatório" }, 400);
    }

    // =========================================================================
    // 1. AÇÃO: SAVE / UPSERT (Persistência garantida via backend)
    // =========================================================================
    if (action === "save" || action === "upsert") {
      const snap = body.snapshot || {};
      const identificador = String(body.identificador || body.id || snap.contratoId || "").trim();
      const token = String(body.token || snap.token || "").trim();
      const pacienteNome = String(body.pacienteNome || snap.pacienteNome || snap.paciente?.nome || "Paciente").trim();
      const pacienteId = body.pacienteId || snap.pacienteId || snap.paciente?.id || null;
      const titulo = String(body.titulo || `Contrato Odontológico - ${pacienteNome} (${identificador || "Novo"})`);
      const conteudo = String(body.conteudo || body.html || "");

      if (!identificador) {
        return json({ error: "Identificador do contrato é obrigatório" }, 400);
      }

      // Garante que o snapshot carregue o identificador e token internamente
      snap.contratoId = identificador;
      if (token) snap.token = token;
      if (!snap.status) snap.status = "pendente";

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identificador);
      let existingDoc: Record<string, any> | null = null;

      if (isUuid) {
        const { data: ex } = await supabase.from("documentos_clinicos").select("*").eq("id", identificador).maybeSingle();
        if (ex?.id) existingDoc = ex;
      }
      if (!existingDoc) {
        const { data: ex2 } = await supabase.from("documentos_clinicos").select("*").filter("itens->>contratoId", "eq", identificador).maybeSingle();
        if (ex2?.id) existingDoc = ex2;
      }

      if (existingDoc) {
        // Se já está assinado, não permite sobrescrever os termos imutáveis
        if (existingDoc.assinado_em || existingDoc.itens?.status === "assinado") {
          return json({ ok: true, id: existingDoc.id, identificador, status: "assinado", jaAssinado: true });
        }

        const { error: updErr } = await supabase.from("documentos_clinicos").update({
          paciente_nome: pacienteNome,
          paciente_id: pacienteId,
          titulo,
          conteudo,
          itens: snap,
          atualizado_em: new Date().toISOString(),
        }).eq("id", existingDoc.id);

        if (updErr) throw updErr;
        return json({ ok: true, id: existingDoc.id, identificador, token, action: "updated" });
      } else {
        const insertPayload: Record<string, any> = {
          paciente_id: pacienteId,
          paciente_nome: pacienteNome,
          tipo: "contrato",
          titulo,
          conteudo,
          itens: snap,
          dentista: snap.clinica?.dentistaResponsavel || null,
        };
        if (isUuid) {
          insertPayload.id = identificador;
        }

        const { data: ins, error: insErr } = await supabase.from("documentos_clinicos").insert(insertPayload).select().maybeSingle();
        if (insErr) throw insErr;

        return json({
          ok: true,
          id: ins?.id || identificador,
          identificador,
          token,
          action: "inserted"
        });
      }
    }

    // =========================================================================
    // 2. AÇÃO: GET (Consulta pública com validação estrita de token)
    // =========================================================================
    if (action === "get") {
      const targetId = String(body.id || body.identificador || body.contratoId || "").trim();
      const token = String(body.token || body.t || "").trim();

      if (!targetId) {
        return json({ error: "Identificador do contrato ausente" }, 400);
      }
      if (!token) {
        return json({ error: "Token de acesso não informado. Acesso não autorizado." }, 403);
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
      let doc: Record<string, any> | null = null;

      if (isUuid) {
        const { data } = await supabase.from("documentos_clinicos").select("*").eq("id", targetId).maybeSingle();
        if (data) doc = data;
      }
      if (!doc) {
        const { data } = await supabase.from("documentos_clinicos").select("*").filter("itens->>contratoId", "eq", targetId).maybeSingle();
        if (data) doc = data;
      }

      if (!doc) {
        return json({ error: "Contrato não encontrado" }, 404);
      }

      // Validação do Token Criptográfico
      const tokenArmazenado = doc.itens?.token;
      if (!tokenArmazenado || tokenArmazenado !== token) {
        return json({ error: "Token de acesso inválido ou expirado" }, 403);
      }

      // Validação de expiração se houver
      const expiraEm = doc.itens?.tokenValidoAte;
      if (expiraEm) {
        try {
          if (new Date(expiraEm) < new Date()) {
            return json({ error: "Este link de contrato expirou. Solicite um novo à clínica." }, 403);
          }
        } catch (_) {}
      }

      const status = doc.itens?.status || (doc.assinado_em ? "assinado" : "pendente");

      return json({
        ok: true,
        id: doc.id,
        identificador: doc.itens?.contratoId || doc.id,
        titulo: doc.titulo,
        conteudo: doc.conteudo,
        pacienteNome: doc.paciente_nome,
        status,
        assinadoEm: doc.assinado_em,
        assinanteNome: doc.assinante_nome,
        snapshot: doc.itens,
      });
    }

    // =========================================================================
    // 3. AÇÃO: SIGN (Assinatura digital pública segura)
    // =========================================================================
    if (action === "sign") {
      const targetId = String(body.id || body.identificador || body.contratoId || "").trim();
      const token = String(body.token || body.t || "").trim();
      const signature = String(body.signature || "").trim();
      const signerName = String(body.signerName || "").trim();

      if (!targetId || !token) {
        return json({ error: "Identificador e token são obrigatórios" }, 400);
      }
      if (!signature) {
        return json({ error: "Traço de assinatura gráfica é obrigatório" }, 400);
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
      let doc: Record<string, any> | null = null;

      if (isUuid) {
        const { data } = await supabase.from("documentos_clinicos").select("*").eq("id", targetId).maybeSingle();
        if (data) doc = data;
      }
      if (!doc) {
        const { data } = await supabase.from("documentos_clinicos").select("*").filter("itens->>contratoId", "eq", targetId).maybeSingle();
        if (data) doc = data;
      }

      if (!doc) {
        return json({ error: "Contrato não encontrado" }, 404);
      }

      // Validação estrita do token
      const tokenArmazenado = doc.itens?.token;
      if (!tokenArmazenado || tokenArmazenado !== token) {
        return json({ error: "Token de acesso inválido ou expirado" }, 403);
      }

      // Previne re-assinatura ou alteração silenciosa
      if (doc.assinado_em || doc.itens?.status === "assinado") {
        return json({ error: "Este contrato já foi assinado digitalmente e sua versão é imutável." }, 400);
      }

      const dataHoraIso = new Date().toISOString();
      const clientIp = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "web";
      const userAgent = req.headers.get("user-agent") || "";
      const documentHash = await gerarHashConteudo(doc.conteudo || JSON.stringify(doc.itens || {}));

      const existingItens = typeof doc.itens === "object" && doc.itens ? doc.itens : {};
      const updatedSnapshot = { ...existingItens };

      const selfie = body.selfie || null;
      const signerInfo = body.signerInfo || {};
      const cpf = signerInfo.cpf || updatedSnapshot.paciente?.cpf || null;
      const rg = signerInfo.rg || updatedSnapshot.paciente?.rg || null;
      const email = signerInfo.email || updatedSnapshot.paciente?.email || null;

      updatedSnapshot.status = "assinado";
      updatedSnapshot.assinaturaPaciente = {
        assinaturaData: signature,
        nome: signerName || doc.paciente_nome || "Paciente",
        dataHora: dataHoraIso,
        ip: clientIp,
        userAgent,
        selfie: selfie || undefined,
        cpf: cpf || undefined,
        rg: rg || undefined,
        email: email || undefined,
        documentHash,
      };

      if (body.termoUsoImagem) {
        updatedSnapshot.termoUsoImagem = body.termoUsoImagem;
      }

      const { error: updateErr } = await supabase
        .from("documentos_clinicos")
        .update({
          assinado_em: dataHoraIso,
          assinante_nome: signerName || doc.paciente_nome || "Paciente",
          assinatura_data: signature,
          itens: updatedSnapshot,
          atualizado_em: dataHoraIso,
        })
        .eq("id", doc.id);

      if (updateErr) throw updateErr;

      return json({
        ok: true,
        mensagem: "Contrato assinado digitalmente com sucesso!",
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
