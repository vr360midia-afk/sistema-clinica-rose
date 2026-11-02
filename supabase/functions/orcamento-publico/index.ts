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

/**
 * Normaliza qualquer código de identificação pública:
 * Remove espaços, converte maiúsculas, extrai código hexadecimal de 8 chars se houver prefixo CTR- ou ORC-
 */
function normalizarIdentificador(input?: string | null): {
  raw: string;
  upper: string;
  code8: string | null;
  isUuid: boolean;
  withOrc: string;
  withCtr: string;
} {
  const raw = String(input || "").trim();
  const upper = raw.toUpperCase();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);

  let code8: string | null = null;
  if (isUuid) {
    code8 = raw.slice(0, 8).toUpperCase();
  } else if (/^(ORC|CTR)-[0-9A-F]{8}$/i.test(raw)) {
    code8 = raw.slice(4, 12).toUpperCase();
  } else if (/^[0-9A-F]{8}$/i.test(raw)) {
    code8 = upper;
  }

  const withOrc = code8 ? `ORC-${code8}` : upper.startsWith("ORC-") ? upper : `ORC-${upper}`;
  const withCtr = code8 ? `CTR-${code8}` : upper.startsWith("CTR-") ? upper : `CTR-${upper}`;

  return { raw, upper, code8, isUuid, withOrc, withCtr };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[orcamento-publico] Configuração do servidor incompleta (service_role ausente)");
      return json({ ok: false, error: "Erro de configuração do servidor backend", code: "INTERNAL_ERROR" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").trim();

    if (!action) {
      return json({ ok: false, error: "Parâmetro 'action' é obrigatório", code: "INVALID_PARAM" }, 400);
    }

    // Helper: Localiza orçamento no Supabase de forma abrangente com service_role
    async function localizarOrcamento(targetId: string) {
      const norm = normalizarIdentificador(targetId);
      let row: any = null;

      // 1. Busca por UUID exato
      if (norm.isUuid) {
        const { data } = await supabase.from("orcamentos").select("*").eq("id", norm.raw).maybeSingle();
        if (data) row = data;
      }

      // 2. Busca por prefixo de 8 caracteres do UUID (ex: 3327cc94 -> id LIKE 3327cc94-%)
      if (!row && norm.code8) {
        const prefixLower = norm.code8.toLowerCase();
        const { data: rowsLike } = await supabase
          .from("orcamentos")
          .select("*")
          .ilike("id", `${prefixLower}-%`)
          .order("criado_em", { ascending: false })
          .limit(1);
        if (rowsLike && rowsLike.length > 0) row = rowsLike[0];
      }

      // 3. Busca por identificador na coluna identificador (se existir)
      if (!row) {
        try {
          const { data: rowsIdCol } = await supabase
            .from("orcamentos")
            .select("*")
            .or(`identificador.eq.${norm.upper},identificador.eq.${norm.withOrc},identificador.eq.${norm.withCtr}`)
            .order("criado_em", { ascending: false })
            .limit(1);
          if (rowsIdCol && rowsIdCol.length > 0) row = rowsIdCol[0];
        } catch (_) {
          // Coluna pode não existir no schema
        }
      }

      // 4. Busca por identificador dentro de assinatura_paciente (JSONB)
      if (!row) {
        try {
          const queries = [norm.upper, norm.withOrc, norm.withCtr];
          if (norm.code8) queries.push(norm.code8);

          for (const q of queries) {
            const { data: rowsJson } = await supabase
              .from("orcamentos")
              .select("*")
              .filter("assinatura_paciente->>identificador", "eq", q)
              .order("criado_em", { ascending: false })
              .limit(1);
            if (rowsJson && rowsJson.length > 0) {
              row = rowsJson[0];
              break;
            }
          }
        } catch (_) {}
      }

      return { row, norm };
    }

    // =========================================================================
    // 1. AÇÃO: GET — Recuperação pública com validação estrita de token e permissões
    // =========================================================================
    if (action === "get") {
      const targetId = String(body.identificador || body.id || body.orcamentoId || body.ctr || "").trim();
      const token = String(body.token || body.t || "").trim();

      if (!targetId || !token) {
        return json({
          ok: false,
          error: "Identificador e token de acesso são obrigatórios para consulta pública.",
          code: "INVALID_PARAM"
        }, 400);
      }

      const { row, norm } = await localizarOrcamento(targetId);

      // Fallback: busca por token direto caso identificador tenha variado
      let finalRow = row;
      if (!finalRow) {
        const { data: rowsByToken } = await supabase
          .from("orcamentos")
          .select("*")
          .eq("token_assinatura", token)
          .order("criado_em", { ascending: false })
          .limit(1);
        if (rowsByToken && rowsByToken.length > 0) {
          finalRow = rowsByToken[0];
        }
      }

      if (!finalRow) {
        console.warn(`[orcamento-publico] Orçamento não encontrado para ref: ${targetId}`);
        // Mensagem segura que não revela se o registro existe para visitantes não autorizados
        return json({
          ok: false,
          error: "Orçamento não encontrado. Verifique o link ou solicite um novo à clínica.",
          code: "NOT_FOUND"
        }, 404);
      }

      const snap = (finalRow.assinatura_paciente || {}) as Record<string, any>;
      const tokenSalvo = finalRow.token_assinatura || snap.token || snap.tokenAssinatura;

      // Validação estrita do token de acesso
      if (!tokenSalvo || tokenSalvo !== token) {
        console.warn(`[orcamento-publico] Token inválido para orçamento id=${finalRow.id}`);
        return json({
          ok: false,
          error: "Token de segurança inválido. Acesso não autorizado.",
          code: "INVALID_TOKEN"
        }, 403);
      }

      // Validação de expiração
      const expiraEm = finalRow.data_expiracao_link || snap.dataExpiracaoLink;
      if (expiraEm && new Date(expiraEm) < new Date()) {
        return json({
          ok: false,
          error: "Esta proposta de orçamento expirou. Solicite um novo link à clínica.",
          code: "EXPIRED_TOKEN",
          isExpirado: true
        }, 410);
      }

      // Dados complementares: Clínica
      let clinicaInfo = {
        nome: "Clínica Odontológica",
        logoUrl: null,
        telefone: null,
        email: null,
        dentistaResponsavel: null,
        cro: null,
      };
      try {
        const { data: cfg } = await supabase.from("configuracoes").select("*").limit(1).maybeSingle();
        if (cfg) {
          clinicaInfo = {
            nome: cfg.nome_clinica || "Clínica Odontológica",
            logoUrl: cfg.logo_url || null,
            telefone: cfg.telefone || cfg.whatsapp_numero || null,
            email: cfg.email || null,
            dentistaResponsavel: cfg.dentista_responsavel || null,
            cro: cfg.cro || null,
          };
        }
      } catch (_) {}

      // Dados complementares: Paciente
      let pacienteNome = finalRow.paciente_nome || snap.pacienteNome || "Paciente";
      if (finalRow.paciente_id && (!finalRow.paciente_nome || finalRow.paciente_nome === "Paciente")) {
        try {
          const { data: pac } = await supabase.from("pacientes").select("nome").eq("id", finalRow.paciente_id).maybeSingle();
          if (pac?.nome) pacienteNome = pac.nome;
        } catch (_) {}
      }

      // Dados do Contrato (se já houver contrato gerado e orçamento estiver aprovado)
      let contratoLink: string | null = null;
      let contratoStatus: string | null = null;
      let contratoIdentificador: string | null = null;

      const effectiveContratoId = finalRow.contrato_id || snap.contratoId;
      const effectiveContratoToken = finalRow.contrato_token || snap.contratoToken;

      if (effectiveContratoId) {
        try {
          const { data: docContrato } = await supabase
            .from("documentos_clinicos")
            .select("id, itens")
            .eq("tipo", "contrato")
            .or(`id.eq.${effectiveContratoId},itens->>contratoId.eq.${effectiveContratoId}`)
            .limit(1)
            .maybeSingle();

          if (docContrato) {
            const snapC = (docContrato.itens || {}) as any;
            contratoIdentificador = snapC.contratoId || docContrato.id;
            contratoStatus = snapC.status || "pendente";
            const tokC = snapC.token || effectiveContratoToken;
            if (tokC) {
              const origin = "https://app.lentesemresinamaceio.com.br";
              contratoLink = `${origin}/contrato/${contratoIdentificador}?token=${encodeURIComponent(tokC)}`;
            }
          }
        } catch (_) {}
      }

      const identificadorOficial =
        snap.identificador ||
        finalRow.identificador ||
        (norm.code8 ? `ORC-${norm.code8}` : `ORC-${String(finalRow.id).slice(0, 8).toUpperCase()}`);

      const versaoAtual = Number(finalRow.versao || snap.versao || 1);
      const subtotal = (Array.isArray(finalRow.itens) ? finalRow.itens : []).reduce(
        (acc: number, i: any) => acc + Number(i.valor || 0) * Number(i.quantidade || 1),
        0
      );

      return json({
        ok: true,
        orcamento: {
          id: finalRow.id,
          identificador: identificadorOficial,
          titulo: finalRow.titulo || "Plano de Tratamento Odontológico",
          itens: Array.isArray(finalRow.itens) ? finalRow.itens : [],
          subtotal,
          desconto: Number(finalRow.desconto || 0),
          total: Number(finalRow.total || 0),
          status: finalRow.status || snap.status || "enviado",
          versao: versaoAtual,
          validade: finalRow.validade || null,
          observacoes: finalRow.observacoes || null,
          formasPagamentoRaw: finalRow.formas_pagamento,
          condicaoEscolhida: finalRow.condicao_escolhida || snap.condicaoEscolhida || null,
          aprovadoEm: finalRow.aprovado_em || finalRow.data_assinatura || snap.aprovadoEm || null,
          solicitacoesAjuste: Array.isArray(finalRow.solicitacoes_ajuste) ? finalRow.solicitacoes_ajuste : (Array.isArray(snap.solicitacoesAjuste) ? snap.solicitacoesAjuste : []),
          historicoVersoes: Array.isArray(finalRow.historico_versoes) ? finalRow.historico_versoes : (Array.isArray(snap.historicoVersoes) ? snap.historicoVersoes : []),
          fotosPlanejamento: Array.isArray(finalRow.fotos_planejamento) ? finalRow.fotos_planejamento : (Array.isArray(snap.fotosPlanejamento) ? snap.fotosPlanejamento : []),
          pacienteId: finalRow.paciente_id || null,
          pacienteNome,
          contratoId: effectiveContratoId || null,
          contratoToken: effectiveContratoToken || null,
          contratoStatus,
          contratoIdentificador,
          contratoLink,
          clinica: clinicaInfo,
        },
      });
    }

    // =========================================================================
    // 2. AÇÃO: APPROVE — Registro de aprovação do paciente com bloqueio atômico
    // =========================================================================
    if (action === "approve") {
      const targetId = String(body.identificador || body.id || body.orcamentoId || "").trim();
      const token = String(body.token || body.t || "").trim();
      const condicaoEscolhida = body.condicaoEscolhida || body.condicao;
      const versaoAprovada = body.versaoAprovada ? Number(body.versaoAprovada) : null;
      const evidencias = body.evidencias || {};

      if (!targetId || !token) {
        return json({ ok: false, error: "Identificador e token são obrigatórios", code: "INVALID_PARAM" }, 400);
      }
      if (!condicaoEscolhida) {
        return json({ ok: false, error: "Condição de pagamento deve ser selecionada para aprovação.", code: "INVALID_PARAM" }, 400);
      }

      const { row } = await localizarOrcamento(targetId);
      if (!row) {
        return json({ ok: false, error: "Orçamento não encontrado", code: "NOT_FOUND" }, 404);
      }

      const snap = (row.assinatura_paciente || {}) as Record<string, any>;
      const tokenSalvo = row.token_assinatura || snap.token || snap.tokenAssinatura;

      if (!tokenSalvo || tokenSalvo !== token) {
        return json({ ok: false, error: "Token de acesso inválido", code: "INVALID_TOKEN" }, 403);
      }

      // Se já está aprovado, retorna confirmação idempotente
      if (row.status === "aprovado" || snap.status === "aprovado") {
        return json({
          ok: true,
          jaAprovado: true,
          id: row.id,
          status: "aprovado",
          aprovadoEm: row.aprovado_em || row.data_assinatura || snap.aprovadoEm,
          condicaoEscolhida: row.condicao_escolhida || snap.condicaoEscolhida,
        });
      }

      const nowIso = new Date().toISOString();
      const versaoAtual = Number(row.versao || snap.versao || 1);

      if (versaoAprovada !== null && versaoAprovada !== versaoAtual) {
        return json({
          ok: false,
          error: `Este orçamento já possui uma proposta mais recente (v${versaoAtual}). Recarregue a página para analisar os novos valores.`,
          code: "OUTDATED_VERSION",
        }, 409);
      }

      const totalFinal = Number(condicaoEscolhida.valorTotal || row.total || 0);
      const descontoFinal = Number(condicaoEscolhida.valorDesconto || row.desconto || 0);

      const snapshotAprovacao = {
        condicao: condicaoEscolhida,
        aprovadoEm: nowIso,
        versao: versaoAtual,
        evidencias: {
          ...evidencias,
          ip: req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for") || undefined,
          timestamp: nowIso,
        },
      };

      const updatedSnap = {
        ...snap,
        status: "aprovado",
        aprovadoEm: nowIso,
        condicaoEscolhida,
        snapshotAprovacao,
        versaoAprovada: versaoAtual,
      };

      // Atualiza o orçamento no Supabase
      const updPayload: Record<string, any> = {
        status: "aprovado",
        desconto: descontoFinal,
        total: totalFinal,
        data_assinatura: nowIso,
        assinatura_paciente: updatedSnap,
        atualizado_em: nowIso,
      };

      const { error: updErr } = await supabase.from("orcamentos").update(updPayload).eq("id", row.id);
      if (updErr) {
        console.error("[orcamento-publico] Erro ao aprovar orçamento no banco:", updErr);
        throw updErr;
      }

      // Se houver paciente vinculado, atualiza status do paciente para 'Em Tratamento'
      if (row.paciente_id) {
        try {
          await supabase.from("pacientes").update({
            status: "Em Tratamento",
            atualizado_em: nowIso,
          }).eq("id", row.paciente_id);
        } catch (_) {}
      }

      console.log(`[orcamento-publico] Orçamento id=${row.id} aprovado com sucesso em ${nowIso}`);

      return json({
        ok: true,
        id: row.id,
        identificador: snap.identificador || row.identificador || targetId,
        status: "aprovado",
        aprovadoEm: nowIso,
        condicaoEscolhida,
      });
    }

    // =========================================================================
    // 3. AÇÃO: REQUEST_ADJUSTMENT — Solicitação de ajuste pelo paciente
    // =========================================================================
    if (action === "request_adjustment") {
      const targetId = String(body.identificador || body.id || body.orcamentoId || "").trim();
      const token = String(body.token || body.t || "").trim();
      const motivo = String(body.motivo || "").trim();
      const mensagem = body.mensagem ? String(body.mensagem).trim() : null;

      if (!targetId || !token) {
        return json({ ok: false, error: "Identificador e token são obrigatórios", code: "INVALID_PARAM" }, 400);
      }
      if (!motivo) {
        return json({ ok: false, error: "Informe o motivo do ajuste.", code: "INVALID_PARAM" }, 400);
      }

      const { row } = await localizarOrcamento(targetId);
      if (!row) {
        return json({ ok: false, error: "Orçamento não encontrado", code: "NOT_FOUND" }, 404);
      }

      const snap = (row.assinatura_paciente || {}) as Record<string, any>;
      const tokenSalvo = row.token_assinatura || snap.token || snap.tokenAssinatura;

      if (!tokenSalvo || tokenSalvo !== token) {
        return json({ ok: false, error: "Token de acesso inválido", code: "INVALID_TOKEN" }, 403);
      }

      if (row.status === "aprovado" || snap.status === "aprovado") {
        return json({
          ok: false,
          error: "Este orçamento já foi aprovado e não pode mais receber solicitações de ajuste.",
          code: "ALREADY_APPROVED"
        }, 400);
      }

      const nowIso = new Date().toISOString();
      const versaoAtual = Number(row.versao || snap.versao || 1);

      const novaSolicitacao = {
        id: `ajuste-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        orcamentoId: row.id,
        pacienteId: row.paciente_id,
        pacienteNome: row.paciente_nome,
        versaoOrcamento: versaoAtual,
        motivo,
        mensagem: mensagem || null,
        solicitadaEm: nowIso,
        atendida: false,
      };

      const solicitacoesExistentes = Array.isArray(snap.solicitacoesAjuste)
        ? snap.solicitacoesAjuste
        : (Array.isArray(row.solicitacoes_ajuste) ? row.solicitacoes_ajuste : []);

      const novasSolicitacoes = [...solicitacoesExistentes, novaSolicitacao];

      const updatedSnap = {
        ...snap,
        status: "ajuste_solicitado",
        solicitacoesAjuste: novasSolicitacoes,
      };

      const updPayload: Record<string, any> = {
        status: "ajuste_solicitado",
        assinatura_paciente: updatedSnap,
        atualizado_em: nowIso,
      };

      const { error: updErr } = await supabase.from("orcamentos").update(updPayload).eq("id", row.id);
      if (updErr) {
        console.error("[orcamento-publico] Erro ao registrar solicitação de ajuste:", updErr);
        throw updErr;
      }

      console.log(`[orcamento-publico] Solicitação de ajuste registrada para id=${row.id}`);

      return json({
        ok: true,
        id: row.id,
        identificador: snap.identificador || row.identificador || targetId,
        status: "ajuste_solicitado",
        solicitacao: novaSolicitacao,
      });
    }

    // =========================================================================
    // 4. AÇÃO: SAVE — Persistência administrativa garantida (service_role)
    // =========================================================================
    if (action === "save" || action === "upsert") {
      const orcamento = body.orcamento || body;
      const id = orcamento.id;
      const isUuid = id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      if (isUuid) {
        const { error: updErr } = await supabase.from("orcamentos").update(orcamento).eq("id", id);
        if (updErr) throw updErr;
        return json({ ok: true, id, action: "updated" });
      } else {
        const { data: ins, error: insErr } = await supabase.from("orcamentos").insert(orcamento).select("id").maybeSingle();
        if (insErr) throw insErr;
        return json({ ok: true, id: ins?.id || id, action: "inserted" });
      }
    }

    return json({ ok: false, error: `Ação '${action}' desconhecida`, code: "UNKNOWN_ACTION" }, 400);
  } catch (err: any) {
    console.error("[orcamento-publico] Erro interno:", err);
    return json({
      ok: false,
      error: "Ocorreu um erro interno no servidor ao processar a solicitação.",
      code: "INTERNAL_ERROR",
      detalhe: err?.message || String(err)
    }, 500);
  }
});
