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
      const code8Match = targetId.match(/^(?:CTR-)?([0-9a-f]{8})$/i);
      const code8 = code8Match ? code8Match[1].toUpperCase() : null;
      let doc: Record<string, any> | null = null;

      if (isUuid) {
        const { data } = await supabase.from("documentos_clinicos").select("*").eq("id", targetId).maybeSingle();
        if (data) doc = data;
      }
      if (!doc && code8) {
        const { data: rowsLike } = await supabase.from("documentos_clinicos").select("*").ilike("id", `${code8.toLowerCase()}-%`).order("criado_em", { ascending: false }).limit(1);
        if (rowsLike && rowsLike.length > 0) doc = rowsLike[0];
      }
      if (!doc) {
        const { data } = await supabase.from("documentos_clinicos").select("*").filter("itens->>contratoId", "eq", targetId).maybeSingle();
        if (data) doc = data;
      }
      if (!doc && targetId.toLowerCase().startsWith("ctr-")) {
        const { data } = await supabase.from("documentos_clinicos").select("*").filter("itens->>contratoId", "eq", targetId.toUpperCase()).maybeSingle();
        if (data) doc = data;
      }
      if (!doc && code8) {
        const { data } = await supabase.from("documentos_clinicos").select("*").or(`itens->>contratoId.eq.CTR-${code8},itens->>contratoId.eq.${code8}`).maybeSingle();
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
      else if (isAssinadoDentista) statusTexto = "aguardando_assinatura_paciente";

      const pdfPath = doc.pdf_path || doc.itens?.pdfPath || null;
      let signedPdfUrl = null;

      if (pdfPath) {
        try {
          const { data: signUrlData } = await supabase.storage
            .from("documentos-pacientes")
            .createSignedUrl(pdfPath, 300);
          if (signUrlData?.signedUrl) {
            signedPdfUrl = signUrlData.signedUrl;
          }
        } catch (_) {}
      }

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
        pdfPath,
        signedPdfUrl,
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
      const code8Match = targetId.match(/^(?:CTR-)?([0-9a-f]{8})$/i);
      const code8 = code8Match ? code8Match[1].toUpperCase() : null;
      let doc: Record<string, any> | null = null;

      if (isUuid) {
        const { data } = await supabase.from("documentos_clinicos").select("*").eq("id", targetId).maybeSingle();
        if (data) doc = data;
      }
      if (!doc && code8) {
        const { data: rowsLike } = await supabase.from("documentos_clinicos").select("*").ilike("id", `${code8.toLowerCase()}-%`).order("criado_em", { ascending: false }).limit(1);
        if (rowsLike && rowsLike.length > 0) doc = rowsLike[0];
      }
      if (!doc) {
        const { data } = await supabase.from("documentos_clinicos").select("*").filter("itens->>contratoId", "eq", targetId).maybeSingle();
        if (data) doc = data;
      }
      if (!doc && targetId.toLowerCase().startsWith("ctr-")) {
        const { data } = await supabase.from("documentos_clinicos").select("*").filter("itens->>contratoId", "eq", targetId.toUpperCase()).maybeSingle();
        if (data) doc = data;
      }
      if (!doc && code8) {
        const { data } = await supabase.from("documentos_clinicos").select("*").or(`itens->>contratoId.eq.CTR-${code8},itens->>contratoId.eq.${code8}`).maybeSingle();
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
          status: temDentista ? "formalizado" : "assinado",
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
      const code8Match = targetId.match(/^(?:CTR-)?([0-9a-f]{8})$/i);
      const code8 = code8Match ? code8Match[1].toUpperCase() : null;
      let doc: Record<string, any> | null = null;

      if (isUuid) {
        const { data } = await supabase.from("documentos_clinicos").select("*").eq("id", targetId).maybeSingle();
        if (data) doc = data;
      }
      if (!doc && code8) {
        const { data: rowsLike } = await supabase.from("documentos_clinicos").select("*").ilike("id", `${code8.toLowerCase()}-%`).order("criado_em", { ascending: false }).limit(1);
        if (rowsLike && rowsLike.length > 0) doc = rowsLike[0];
      }
      if (!doc) {
        const { data } = await supabase.from("documentos_clinicos").select("*").filter("itens->>contratoId", "eq", targetId).maybeSingle();
        if (data) doc = data;
      }
      if (!doc && targetId.toLowerCase().startsWith("ctr-")) {
        const { data } = await supabase.from("documentos_clinicos").select("*").filter("itens->>contratoId", "eq", targetId.toUpperCase()).maybeSingle();
        if (data) doc = data;
      }
      if (!doc && code8) {
        const { data } = await supabase.from("documentos_clinicos").select("*").or(`itens->>contratoId.eq.CTR-${code8},itens->>contratoId.eq.${code8}`).maybeSingle();
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
          status: temPaciente ? "formalizado" : "aguardando_assinatura_paciente",
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

    // =========================================================================
    // 5. AÇÃO: GET_PDF_SIGNED_URL (Obtém URL assinada do PDF privado com validação de token)
    // =========================================================================
    if (action === "get_pdf_signed_url") {
      const targetId = String(body.id || body.identificador || body.contratoId || "").trim();
      const token = String(body.token || body.t || "").trim();

      if (!targetId) {
        return json({ error: "Identificador do contrato ausente" }, 400);
      }
      if (!token) {
        return json({ error: "Token de acesso não informado. Acesso não autorizado." }, 403);
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
      const code8Match = targetId.match(/^(?:CTR-)?([0-9a-f]{8})$/i);
      const code8 = code8Match ? code8Match[1].toUpperCase() : null;
      let doc: Record<string, any> | null = null;

      if (isUuid) {
        const { data } = await supabase.from("documentos_clinicos").select("*").eq("id", targetId).maybeSingle();
        if (data) doc = data;
      }
      if (!doc && code8) {
        const { data: rowsLike } = await supabase.from("documentos_clinicos").select("*").ilike("id", `${code8.toLowerCase()}-%`).order("criado_em", { ascending: false }).limit(1);
        if (rowsLike && rowsLike.length > 0) doc = rowsLike[0];
      }
      if (!doc) {
        const { data } = await supabase.from("documentos_clinicos").select("*").filter("itens->>contratoId", "eq", targetId).maybeSingle();
        if (data) doc = data;
      }
      if (!doc && targetId.toLowerCase().startsWith("ctr-")) {
        const { data } = await supabase.from("documentos_clinicos").select("*").filter("itens->>contratoId", "eq", targetId.toUpperCase()).maybeSingle();
        if (data) doc = data;
      }
      if (!doc && code8) {
        const { data } = await supabase.from("documentos_clinicos").select("*").or(`itens->>contratoId.eq.CTR-${code8},itens->>contratoId.eq.${code8}`).maybeSingle();
        if (data) doc = data;
      }

      if (!doc) {
        return json({ error: "Contrato não encontrado" }, 404);
      }

      // Validação estrita de Token
      const tokenArmazenado = doc.itens?.token;
      if (!tokenArmazenado || tokenArmazenado !== token) {
        return json({ error: "Token de acesso inválido ou expirado" }, 403);
      }

      const isAssinadoPaciente = !!doc.assinado_em || !!doc.itens?.assinaturaPaciente;
      const isAssinadoDentista = !!doc.itens?.assinaturaDentista;
      const isFormalizadoTotal = isAssinadoPaciente && isAssinadoDentista;

      const pdfPath = doc.pdf_path || doc.itens?.pdfPath || null;
      let signedUrl: string | null = null;

      if (pdfPath) {
        try {
          const { data: signUrlData } = await supabase.storage
            .from("documentos-pacientes")
            .createSignedUrl(pdfPath, 300); // 300s = 5 minutos
          if (signUrlData?.signedUrl) {
            signedUrl = signUrlData.signedUrl;
          }
        } catch (e) {
          console.warn("Erro ao gerar URL assinada:", e);
        }
      }

      return json({
        ok: true,
        pdfPath,
        signedUrl,
        isAssinadoPaciente,
        isAssinadoDentista,
        isFormalizadoTotal,
        snapshot: doc.itens,
      });
    }

    // =========================================================================
    // 6. AÇÃO: UPLOAD_SIGNED_PDF (Armazena versão final em PDF no bucket privado)
    // =========================================================================
    if (action === "upload_signed_pdf") {
      const targetId = String(body.id || body.identificador || body.contratoId || "").trim();
      const token = String(body.token || body.t || "").trim();
      const pdfBase64 = String(body.pdfBase64 || "").trim();
      const isFormalizado = Boolean(body.isFormalizado);

      if (!targetId || !token) {
        return json({ error: "Identificador e token são obrigatórios" }, 400);
      }
      if (!pdfBase64) {
        return json({ error: "Conteúdo do PDF em Base64 é obrigatório" }, 400);
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
      const code8Match = targetId.match(/^(?:CTR-)?([0-9a-f]{8})$/i);
      const code8 = code8Match ? code8Match[1].toUpperCase() : null;
      let doc: Record<string, any> | null = null;

      if (isUuid) {
        const { data } = await supabase.from("documentos_clinicos").select("*").eq("id", targetId).maybeSingle();
        if (data) doc = data;
      }
      if (!doc && code8) {
        const { data: rowsLike } = await supabase.from("documentos_clinicos").select("*").ilike("id", `${code8.toLowerCase()}-%`).order("criado_em", { ascending: false }).limit(1);
        if (rowsLike && rowsLike.length > 0) doc = rowsLike[0];
      }
      if (!doc) {
        const { data } = await supabase.from("documentos_clinicos").select("*").filter("itens->>contratoId", "eq", targetId).maybeSingle();
        if (data) doc = data;
      }
      if (!doc && targetId.toLowerCase().startsWith("ctr-")) {
        const { data } = await supabase.from("documentos_clinicos").select("*").filter("itens->>contratoId", "eq", targetId.toUpperCase()).maybeSingle();
        if (data) doc = data;
      }
      if (!doc && code8) {
        const { data } = await supabase.from("documentos_clinicos").select("*").or(`itens->>contratoId.eq.CTR-${code8},itens->>contratoId.eq.${code8}`).maybeSingle();
        if (data) doc = data;
      }

      if (!doc) {
        return json({ error: "Contrato não encontrado" }, 404);
      }

      // Validação estrita de Token
      const tokenArmazenado = doc.itens?.token;
      if (!tokenArmazenado || tokenArmazenado !== token) {
        return json({ error: "Token de acesso inválido ou expirado" }, 403);
      }

      // Decodifica base64 para Uint8Array
      const cleanBase64 = pdfBase64.replace(/^data:[^;]+;base64,/, "");
      const binaryStr = atob(cleanBase64);
      const pdfBytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        pdfBytes[i] = binaryStr.charCodeAt(i);
      }

      const identificador = doc.itens?.contratoId || doc.id;
      const tipoSufixo = isFormalizado ? "formalizado" : "paciente";
      const filePath = `contratos/${identificador}/contrato_${tipoSufixo}.pdf`;

      // Garante que o bucket privado exista
      try {
        await supabase.storage.createBucket("documentos-pacientes", { public: false });
      } catch (_) {}

      // Upload do arquivo para o bucket privado
      const { error: uploadErr } = await supabase.storage
        .from("documentos-pacientes")
        .upload(filePath, pdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadErr) {
        throw uploadErr;
      }

      // Gera URL assinada de curta duração (300 segundos = 5 minutos)
      const { data: signedData } = await supabase.storage
        .from("documentos-pacientes")
        .createSignedUrl(filePath, 300);

      // Atualiza o documento clínico com o caminho do PDF
      const updatedItens = { ...(doc.itens || {}), pdfPath: filePath };
      await supabase
        .from("documentos_clinicos")
        .update({
          pdf_path: filePath,
          itens: updatedItens,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", doc.id);

      return json({
        ok: true,
        pdfPath: filePath,
        signedUrl: signedData?.signedUrl || null,
        mensagem: "PDF assinado armazenado com sucesso no Supabase Storage privado",
      });
    }

    // =========================================================================
    // 5. AÇÃO: ORCAMENTO-GET (Consulta pública do orçamento com validação de token)
    // =========================================================================
    if (action === "orcamento-get") {
      const targetId = String(body.id || body.identificador || "").trim();
      const token = String(body.token || body.t || "").trim();

      if (!targetId || !token) {
        return json({ error: "Identificador e token são obrigatórios" }, 400);
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
      let orc: Record<string, any> | null = null;

      if (isUuid) {
        const { data } = await supabase.from("orcamentos").select("*").eq("id", targetId).maybeSingle();
        if (data) orc = data;
      }
      if (!orc) {
        const { data } = await supabase.from("orcamentos").select("*").eq("identificador", targetId).maybeSingle();
        if (data) orc = data;
      }
      if (!orc && targetId.toLowerCase().startsWith("orc-")) {
        const { data } = await supabase.from("orcamentos").select("*").eq("identificador", targetId.toUpperCase()).maybeSingle();
        if (data) orc = data;
      }

      if (!orc) {
        return json({ error: "Orçamento não encontrado" }, 404);
      }

      if (orc.token_assinatura !== token) {
        return json({ error: "Token de acesso inválido ou expirado" }, 403);
      }

      if (orc.data_expiracao_link && new Date(orc.data_expiracao_link) < new Date()) {
        return json({ error: "Esta proposta de orçamento expirou.", isExpirado: true }, 403);
      }

      // Converte fotos para signed URLs se houver storagePath
      let fotosComSignedUrls = [];
      if (Array.isArray(orc.fotos_planejamento)) {
        for (const f of orc.fotos_planejamento) {
          if (f.storagePath) {
            try {
              const { data: signRes } = await supabase.storage
                .from("documentos-pacientes")
                .createSignedUrl(f.storagePath, 3600);
              fotosComSignedUrls.push({ ...f, url: signRes?.signedUrl || f.url });
            } catch (_) {
              fotosComSignedUrls.push(f);
            }
          } else {
            fotosComSignedUrls.push(f);
          }
        }
      }

      return json({
        ok: true,
        orcamento: {
          ...orc,
          fotos_planejamento: fotosComSignedUrls,
        },
      });
    }

    // =========================================================================
    // 6. AÇÃO: ORCAMENTO-APPROVE (Aprovação online do orçamento pelo paciente)
    // =========================================================================
    if (action === "orcamento-approve") {
      const targetId = String(body.id || body.identificador || "").trim();
      const token = String(body.token || body.t || "").trim();
      const condicao = body.condicaoEscolhida;

      if (!targetId || !token) {
        return json({ error: "Identificador e token são obrigatórios" }, 400);
      }
      if (!condicao) {
        return json({ error: "Condição de pagamento é obrigatória" }, 400);
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
      let orc: Record<string, any> | null = null;

      if (isUuid) {
        const { data } = await supabase.from("orcamentos").select("*").eq("id", targetId).maybeSingle();
        if (data) orc = data;
      }
      if (!orc) {
        const { data } = await supabase.from("orcamentos").select("*").eq("identificador", targetId).maybeSingle();
        if (data) orc = data;
      }

      if (!orc) {
        return json({ error: "Orçamento não encontrado" }, 404);
      }
      if (orc.token_assinatura !== token) {
        return json({ error: "Token de acesso inválido" }, 403);
      }
      if (orc.status === "aprovado") {
        return json({ ok: true, jaAprovado: true, aprovadoEm: orc.aprovado_em, condicaoEscolhida: orc.condicao_escolhida });
      }

      const nowIso = new Date().toISOString();
      const snapshot = {
        orcamentoId: orc.id,
        identificador: orc.identificador,
        titulo: orc.titulo,
        itens: orc.itens,
        total: condicao.valorTotal || orc.total,
        condicaoEscolhida: condicao,
        aprovadoEm: nowIso,
        pacienteNome: orc.paciente_nome,
        pacienteId: orc.paciente_id,
        evidencias: body.evidencias || {},
      };

      await supabase
        .from("orcamentos")
        .update({
          status: "aprovado",
          aprovado_em: nowIso,
          condicao_escolhida: condicao,
          snapshot_aprovacao: snapshot,
          atualizado_em: nowIso,
        })
        .eq("id", orc.id);

      if (orc.paciente_id) {
        try {
          await supabase.from("pacientes").update({ status: "Em Tratamento", atualizado_em: nowIso }).eq("id", orc.paciente_id);
        } catch (_) {}
      }

      return json({ ok: true, aprovadoEm: nowIso, condicaoEscolhida: condicao });
    }

    // =========================================================================
    // 7. AÇÕES DE AUTORIZAÇÃO DE ASSINATURA AUTOMÁTICA DA PROFISSIONAL
    // =========================================================================
    if (action === "autorizacao_obter") {
      const cro = String(body.cro || "06267-AL").trim();
      let autorizacao: any = null;

      try {
        const { data: rows } = await supabase
          .from("autorizacoes_assinatura_profissional")
          .select("*")
          .eq("ativo", true)
          .is("revogado_em", null)
          .order("autorizado_em", { ascending: false })
          .limit(1);

        if (rows && rows.length > 0) {
          autorizacao = rows[0];
        }
      } catch (_) {
        // Fallback
        try {
          const { data: docs } = await supabase
            .from("documentos_clinicos")
            .select("*")
            .eq("tipo", "autorizacao_profissional")
            .filter("itens->>ativo", "eq", "true")
            .order("criado_em", { ascending: false })
            .limit(1);

          if (docs && docs.length > 0) {
            autorizacao = docs[0].itens;
          }
        } catch (_) {}
      }

      return json({
        ok: true,
        temAutorizacao: !!autorizacao,
        autorizacao: autorizacao ? {
          id: autorizacao.id,
          profissionalNome: autorizacao.profissional_nome || autorizacao.profissionalNome || "Dra. Rosângela Santos Pereira",
          profissionalCro: autorizacao.profissional_cro || autorizacao.profissionalCro || "06267-AL",
          profissionalDocumento: autorizacao.profissional_documento || autorizacao.profissionalDocumento || "032.663.962-43",
          autorizacaoExpressa: autorizacao.autorizacao_expressa || autorizacao.autorizacaoExpressa,
          modelosAutorizados: autorizacao.modelos_autorizados || autorizacao.modelosAutorizados || ["geral", "lentes_resina", "endodontia"],
          condicoesAbrangidas: autorizacao.condicoes_abrangidas || autorizacao.condicoesAbrangidas || { apenas_orcamentos_aprovados: true },
          assinaturaGrafica: autorizacao.assinatura_grafica || autorizacao.assinaturaGrafica || null,
          ativo: autorizacao.ativo,
          autorizadoEm: autorizacao.autorizado_em || autorizacao.autorizadoEm,
          evidencias: autorizacao.evidencias || {},
        } : null,
      });
    }

    if (action === "autorizacao_conceder") {
      const {
        profissionalNome = "Dra. Rosângela Santos Pereira",
        profissionalCro = "06267-AL",
        profissionalDocumento = "032.663.962-43",
        autorizacaoExpressa,
        modelosAutorizados = ["geral", "lentes_resina", "endodontia"],
        condicoesAbrangidas = { apenas_orcamentos_aprovados: true },
        assinaturaGrafica,
        evidencias = {},
      } = body;

      if (!autorizacaoExpressa) {
        return json({ error: "Termo de autorização expressa é obrigatório" }, 400);
      }

      const nowIso = new Date().toISOString();
      const newId = crypto.randomUUID();

      const payload = {
        id: newId,
        profissional_nome: profissionalNome,
        profissional_cro: profissionalCro,
        profissional_documento: profissionalDocumento,
        autorizacao_expressa: autorizacaoExpressa,
        modelos_autorizados: modelosAutorizados,
        condicoes_abrangidas: condicoesAbrangidas,
        assinatura_grafica: assinaturaGrafica || null,
        ativo: true,
        autorizado_em: nowIso,
        evidencias: {
          ...evidencias,
          ip: req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for") || "web",
          timestamp: nowIso,
        },
        criado_em: nowIso,
        atualizado_em: nowIso,
      };

      try {
        // Desativa anteriores
        await supabase
          .from("autorizacoes_assinatura_profissional")
          .update({ ativo: false, revogado_em: nowIso, motivo_revogacao: "Substituída por nova outorga" })
          .eq("ativo", true);

        // Insere nova
        await supabase.from("autorizacoes_assinatura_profissional").insert(payload);
      } catch (_) {
        // Fallback em documentos_clinicos
        try {
          await supabase.from("documentos_clinicos").insert({
            tipo: "autorizacao_profissional",
            titulo: `Autorização de Assinatura Automática - ${profissionalNome}`,
            conteudo: autorizacaoExpressa,
            itens: {
              ...payload,
              profissionalNome,
              profissionalCro,
              profissionalDocumento,
              autorizacaoExpressa,
              modelosAutorizados,
              condicoesAbrangidas,
              assinaturaGrafica,
            },
            criado_em: nowIso,
            atualizado_em: nowIso,
          });
        } catch (_) {}
      }

      return json({
        ok: true,
        mensagem: "Autorização concedida e autenticada com sucesso!",
        autorizacao: {
          id: newId,
          profissionalNome,
          profissionalCro,
          autorizadoEm: nowIso,
          modelosAutorizados,
        },
      });
    }

    if (action === "autorizacao_revogar") {
      const { autorizacaoId, motivo = "Revogação voluntária pela profissional" } = body;
      const nowIso = new Date().toISOString();

      try {
        if (autorizacaoId) {
          await supabase
            .from("autorizacoes_assinatura_profissional")
            .update({ ativo: false, revogado_em: nowIso, motivo_revogacao: motivo, atualizado_em: nowIso })
            .eq("id", autorizacaoId);
        } else {
          await supabase
            .from("autorizacoes_assinatura_profissional")
            .update({ ativo: false, revogado_em: nowIso, motivo_revogacao: motivo, atualizado_em: nowIso })
            .eq("ativo", true);
        }
      } catch (_) {
        try {
          await supabase
            .from("documentos_clinicos")
            .update({
              itens: { ativo: false, revogadoEm: nowIso, motivoRevogacao: motivo },
              atualizado_em: nowIso,
            })
            .eq("tipo", "autorizacao_profissional");
        } catch (_) {}
      }

      return json({
        ok: true,
        mensagem: "Autorização de assinatura automática revogada com sucesso.",
        revogadoEm: nowIso,
      });
    }

    return json({ error: "Ação não suportada" }, 400);
  } catch (e) {
    console.error("contrato-publico error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
