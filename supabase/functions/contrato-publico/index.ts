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
      if (!existingDoc && identificador.toLowerCase().startsWith("ctr-")) {
        const { data: ex3 } = await supabase.from("documentos_clinicos").select("*").filter("itens->>contratoId", "eq", identificador.toUpperCase()).maybeSingle();
        if (ex3?.id) existingDoc = ex3;
      }

      if (existingDoc) {
        // Se já está assinado pelo paciente, não permite sobrescrever os termos imutáveis
        if (existingDoc.assinado_em || existingDoc.itens?.status === "assinado" || existingDoc.itens?.assinaturaPaciente) {
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
      if (!doc && targetId.toLowerCase().startsWith("ctr-")) {
        const { data } = await supabase.from("documentos_clinicos").select("*").filter("itens->>contratoId", "eq", targetId.toUpperCase()).maybeSingle();
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

      const isAssinadoPaciente = !!doc.assinado_em || !!doc.itens?.assinaturaPaciente;
      const isAssinadoDentista = !!doc.itens?.assinaturaDentista;
      const isFormalizadoTotal = isAssinadoPaciente && isAssinadoDentista;

      let statusTexto = "pendente";
      if (isFormalizadoTotal) statusTexto = "formalizado";
      else if (isAssinadoPaciente) statusTexto = "assinado_paciente";
      else if (isAssinadoDentista) statusTexto = "assinado_profissional";

      return json({
        ok: true,
        id: doc.id,
        identificador: doc.itens?.contratoId || doc.id,
        titulo: doc.titulo,
        conteudo: doc.conteudo,
        pacienteNome: doc.paciente_nome,
        pacienteId: doc.paciente_id,
        status: statusTexto,
        jaAssinadoPaciente: isAssinadoPaciente,
        jaAssinadoDentista: isAssinadoDentista,
        isFormalizadoTotal,
        assinadoEm: doc.assinado_em,
        assinanteNome: doc.assinante_nome,
        snapshot: doc.itens,
      });
    }

    // =========================================================================
    // 3. AÇÃO: SIGN (Assinatura digital do paciente com bloqueio de reassinatura)
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
      if (!doc && targetId.toLowerCase().startsWith("ctr-")) {
        const { data } = await supabase.from("documentos_clinicos").select("*").filter("itens->>contratoId", "eq", targetId.toUpperCase()).maybeSingle();
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

      // BLOQUEIO DEFINITIVO DE REASSINATURA DO PACIENTE
      if (doc.assinado_em || doc.itens?.status === "assinado" || doc.itens?.assinaturaPaciente) {
        return json({
          ok: false,
          error: "Contrato já assinado! Sua assinatura digital foi registrada com sucesso anteriormente e não é permitido assinar novamente.",
          jaAssinado: true,
          assinadoEm: doc.assinado_em,
          snapshot: doc.itens,
        }, 400);
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

      const temDentista = !!updatedSnapshot.assinaturaDentista;

      updatedSnapshot.status = temDentista ? "formalizado" : "assinado";
      updatedSnapshot.statusAssinaturaPaciente = "assinado";
      updatedSnapshot.isFormalizadoTotal = temDentista;
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

      // Grava na tabela assinaturas com registro separado
      try {
        await supabase.from("assinaturas").insert({
          documento_id: String(doc.id),
          documento_tipo: "contrato",
          tipo: "paciente",
          nome: signerName || doc.paciente_nome || "Paciente",
          assinatura_data: signature,
          paciente_id: doc.paciente_id || null,
          user_id: doc.user_id || null,
          evidencias: {
            ip: clientIp,
            userAgent,
            cpf,
            email,
            documentHash,
          },
          criado_em: dataHoraIso,
          atualizado_em: dataHoraIso,
        });
      } catch (_) {}

      return json({
        ok: true,
        mensagem: "Contrato assinado digitalmente com sucesso!",
        assinadoEm: dataHoraIso,
        isFormalizadoTotal: temDentista,
        snapshot: updatedSnapshot,
      });
    }

    // =========================================================================
    // 4. AÇÃO: SIGN_PROFESSIONAL (Assinatura digital da profissional / dentista)
    // =========================================================================
    if (action === "sign_professional") {
      const targetId = String(body.id || body.identificador || body.contratoId || "").trim();
      const signature = String(body.signature || "").trim();
      const signerName = String(body.signerName || "").trim();
      const cro = String(body.cro || "").trim();

      if (!targetId) {
        return json({ error: "Identificador do contrato é obrigatório" }, 400);
      }
      if (!signature) {
        return json({ error: "Assinatura gráfica é obrigatória" }, 400);
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
      if (!doc && targetId.toLowerCase().startsWith("ctr-")) {
        const { data } = await supabase.from("documentos_clinicos").select("*").filter("itens->>contratoId", "eq", targetId.toUpperCase()).maybeSingle();
        if (data) doc = data;
      }

      if (!doc) {
        return json({ error: "Contrato não encontrado" }, 404);
      }

      const dataHoraIso = new Date().toISOString();
      const existingItens = typeof doc.itens === "object" && doc.itens ? doc.itens : {};
      const updatedSnapshot = { ...existingItens };

      const temPaciente = !!doc.assinado_em || !!updatedSnapshot.assinaturaPaciente;

      updatedSnapshot.assinaturaDentista = {
        assinaturaData: signature,
        nome: signerName || doc.dentista || updatedSnapshot.clinica?.dentistaResponsavel || "Cirurgião(ã)-Dentista Responsável",
        cro: cro || updatedSnapshot.clinica?.cro || "",
        dataHora: dataHoraIso,
      };
      updatedSnapshot.statusAssinaturaDentista = "assinado";

      if (temPaciente) {
        updatedSnapshot.status = "formalizado";
        updatedSnapshot.isFormalizadoTotal = true;
      }

      const { error: updErr } = await supabase
        .from("documentos_clinicos")
        .update({
          itens: updatedSnapshot,
          atualizado_em: dataHoraIso,
        })
        .eq("id", doc.id);

      if (updErr) throw updErr;

      // Registra na tabela assinaturas
      try {
        await supabase.from("assinaturas").insert({
          documento_id: String(doc.id),
          documento_tipo: "contrato",
          tipo: "dentista",
          nome: signerName || doc.dentista || "Cirurgião(ã)-Dentista Responsável",
          assinatura_data: signature,
          paciente_id: doc.paciente_id || null,
          user_id: doc.user_id || null,
          criado_em: dataHoraIso,
          atualizado_em: dataHoraIso,
        });
      } catch (_) {}

      return json({
        ok: true,
        mensagem: "Assinatura da profissional registrada com sucesso no banco de dados!",
        assinadoEm: dataHoraIso,
        isFormalizadoTotal: temPaciente,
        snapshot: updatedSnapshot,
      });
    }

    return json({ error: "Ação não suportada" }, 400);
  } catch (e) {
    console.error("contrato-publico error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
