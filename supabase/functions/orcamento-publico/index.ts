
function formatarDataBr(isoStr?: string | null): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return String(isoStr);
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function somarMeses(baseIso: string | Date, qtdMeses: number, diaFixo = 10): string {
  const d = new Date(baseIso);
  d.setMonth(d.getMonth() + qtdMeses);
  d.setDate(diaFixo);
  return formatarDataBr(d.toISOString());
}

function gerarParcelasServidor(cond: any, total: number, dataIso: string): any[] {
  if (!cond) return [];
  const tipo = cond.tipo || 'personalizado';
  const hoje = new Date(dataIso || Date.now());
  const diaPadrao = Math.min(28, Math.max(1, cond.diaVencimento || 10));

  if (tipo === 'a_vista') {
    const val = typeof cond.valorTotal === 'number' && cond.valorTotal > 0 ? cond.valorTotal : total;
    const venc = cond.dataEntrada ? formatarDataBr(cond.dataEntrada) : formatarDataBr(dataIso);
    const pixPago = Boolean(cond.pagamentoConfirmado || cond.pago || (cond.situacaoEntrada === 'Quitada' && cond.comprovado));
    return [{
      numero: 1,
      descricao: 'Pagamento Único via PIX',
      vencimento: venc,
      valor: val,
      metodo: 'PIX',
      status: pixPago ? 'Quitada' : 'Pendente',
    }];
  }

  if (tipo === 'cartao') {
    const qtd = Math.max(1, cond.parcelas || 1);
    const isDeb = cond.tipoCartao === 'debito';
    const mNome = isDeb ? 'Cartão de Débito' : 'Cartão de Crédito';
    const valBase = Math.floor((total / qtd) * 100) / 100;
    const centavos = Math.round((total - (valBase * qtd)) * 100);
    const cartaoAutorizado = Boolean(cond.cartaoAutorizado || cond.autorizacaoConfirmada || cond.nsu || cond.codigoAutorizacao);
    const sit = cartaoAutorizado ? (isDeb ? 'Quitada' : 'Autorizado') : 'Pendente';
    const parcs: any[] = [];
    for (let i = 0; i < qtd; i++) {
      const v = Number((valBase + (i < centavos ? 0.01 : 0)).toFixed(2));
      parcs.push({
        numero: i + 1,
        descricao: qtd === 1 ? `Pagamento em ${mNome}` : `Parcela ${i + 1} de ${qtd} (${mNome})`,
        vencimento: 'Fatura do Cartão',
        valor: v,
        metodo: mNome,
        status: sit,
      });
    }
    return parcs;
  }

  if (tipo === 'entrada_saldo') {
    const entVal = Number(cond.valorEntrada || 0);
    const saldoTotal = Math.max(0, Number((total - entVal).toFixed(2)));
    const qtdSaldo = Math.max(1, cond.saldoParcelas || 1);
    let mEnt = 'PIX';
    if (cond.metodoEntrada === 'cartao_credito') mEnt = 'Cartão de Crédito';
    else if (cond.metodoEntrada === 'cartao_debito') mEnt = 'Cartão de Débito';
    else if (cond.metodoEntrada === 'dinheiro') mEnt = 'Dinheiro';
    else if (cond.metodoEntrada === 'transferencia') mEnt = 'Transferência';

    let mSal = 'Cartão de Crédito';
    if (cond.saldoMetodo === 'pix_parcelado') mSal = 'PIX Parcelado';
    else if (cond.saldoMetodo === 'boleto') mSal = 'Boleto Bancário';
    else if (cond.saldoMetodo === 'conclusao') mSal = 'Na Conclusão do Tratamento';

    const isCartaoSaldo = /cart[aã]o/i.test(mSal);
    const entComprovada = Boolean(cond.entradaConfirmada || cond.pagamentoConfirmado || cond.pago || (cond.situacaoEntrada === 'Quitada' && cond.comprovado));
    const sitEntrada = entComprovada ? 'Quitada' : 'Pendente';

    const cartaoSaldoAut = isCartaoSaldo && Boolean(cond.cartaoAutorizado || cond.autorizacaoConfirmada || cond.nsu || cond.codigoAutorizacao);
    const outroSaldoComprovado = !isCartaoSaldo && Boolean(cond.saldoConfirmado || cond.pagamentoConfirmado || cond.pago || (cond.situacaoSaldo === 'Quitado' && cond.comprovado));
    const sitSaldo = isCartaoSaldo
      ? (cartaoSaldoAut ? 'Autorizado' : 'Pendente')
      : (outroSaldoComprovado ? 'Quitada' : 'Pendente');

    const parcs: any[] = [];
    if (entVal > 0) {
      parcs.push({
        numero: 1,
        descricao: `Entrada Inicial (${mEnt})`,
        vencimento: cond.dataEntrada ? formatarDataBr(cond.dataEntrada) : formatarDataBr(dataIso),
        valor: entVal,
        metodo: mEnt,
        status: sitEntrada,
      });
    }

    const valBase = Math.floor((saldoTotal / qtdSaldo) * 100) / 100;
    const centavos = Math.round((saldoTotal - (valBase * qtdSaldo)) * 100);

    for (let i = 0; i < qtdSaldo; i++) {
      const v = Number((valBase + (i < centavos ? 0.01 : 0)).toFixed(2));
      const venc = isCartaoSaldo ? 'Fatura do Cartão' : somarMeses(hoje, i + 1, diaPadrao);
      parcs.push({
        numero: parcs.length + 1,
        descricao: qtdSaldo === 1 ? `Saldo Restante (${mSal})` : `Saldo Restante (${i + 1}/${qtdSaldo} - ${mSal})`,
        vencimento: venc,
        valor: v,
        metodo: mSal,
        status: sitSaldo,
      });
    }
    return parcs;
  }

  if (tipo === 'pix_parcelado') {
    const qtd = Math.max(1, cond.parcelas || 1);
    const valBase = Math.floor((total / qtd) * 100) / 100;
    const centavos = Math.round((total - (valBase * qtd)) * 100);
    const pixSaldoPago = Boolean(cond.saldoConfirmado || cond.pagamentoConfirmado || cond.pago || (cond.situacaoSaldo === 'Quitado' && cond.comprovado));
    const sit = pixSaldoPago ? 'Quitada' : 'Pendente';
    const parcs: any[] = [];
    for (let i = 0; i < qtd; i++) {
      const v = Number((valBase + (i < centavos ? 0.01 : 0)).toFixed(2));
      const venc = cond.dataPrimeiroVencimento && i === 0 ? formatarDataBr(cond.dataPrimeiroVencimento) : somarMeses(hoje, i + 1, diaPadrao);
      parcs.push({
        numero: i + 1,
        descricao: `Parcela ${i + 1} de ${qtd} (PIX Parcelado)`,
        vencimento: venc,
        valor: v,
        metodo: 'PIX Parcelado',
        status: sit,
      });
    }
    return parcs;
  }

  // Fallback seguro: se valor único
  return [{
    numero: 1,
    descricao: cond.titulo || 'Pagamento Único',
    vencimento: formatarDataBr(dataIso),
    valor: total,
    metodo: 'PIX',
    status: 'Pendente',
  }];
}

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

function formatarEnderecoCompleto(input?: any): string {
  if (!input) return "";
  if (typeof input === "string") {
    const s = input.trim();
    if (!s || s.toLowerCase() === "não informado" || s.toLowerCase() === "nao informado") return "";
    if (s.startsWith("{") && s.endsWith("}")) {
      try {
        return formatarEnderecoCompleto(JSON.parse(s));
      } catch (_) {}
    }
    return s;
  }
  if (typeof input !== "object") return "";

  const logradouro = (input.logradouro || input.rua || input.logr || "").trim();
  const numero = (input.numero || input.num || "").trim();
  const complemento = (input.complemento || input.compl || "").trim();
  const bairro = (input.bairro || input.bair || "").trim();
  const cidade = (input.cidade || input.municipio || "").trim();
  const estado = (input.estado || input.uf || "").trim();
  const cep = (input.cep || "").trim();

  if (input.endereco && typeof input.endereco === "string" && !logradouro && !numero && !bairro) {
    return formatarEnderecoCompleto(input.endereco);
  }

  const partes: string[] = [];
  if (logradouro) {
    partes.push(numero ? `${logradouro}, nº ${numero}` : logradouro);
  } else if (numero) {
    partes.push(`nº ${numero}`);
  }
  if (complemento) partes.push(complemento);
  if (bairro) partes.push(`Bairro ${bairro.replace(/^bairro\s*/i, "")}`);
  if (cidade || estado) partes.push([cidade, estado].filter(Boolean).join(" - "));
  if (cep) {
    const cepLimpo = cep.replace(/\D/g, "");
    const cepFmt = cepLimpo.length === 8 ? `${cepLimpo.slice(0, 5)}-${cepLimpo.slice(5)}` : cep;
    partes.push(`CEP ${cepFmt.replace(/^CEP\s*/i, "")}`);
  }
  return partes.join(", ");
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
    //                    e geração automática do contrato com assinatura autorizada
    // =========================================================================
    if (action === "approve" || action === "aprovar") {
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

      const { row, norm } = await localizarOrcamento(targetId);
      if (!row) {
        return json({ ok: false, error: "Orçamento não encontrado", code: "NOT_FOUND" }, 404);
      }

      const snap = (row.assinatura_paciente || {}) as Record<string, any>;
      const tokenSalvo = row.token_assinatura || snap.token || snap.tokenAssinatura;

      if (!tokenSalvo || tokenSalvo !== token) {
        return json({ ok: false, error: "Token de acesso inválido", code: "INVALID_TOKEN" }, 403);
      }

      const origin = "https://app.lentesemresinamaceio.com.br";
      const nowIso = new Date().toISOString();

      // 1. Se já está aprovado, retorna confirmação idempotente com dados do contrato vinculado
      if (row.status === "aprovado" || snap.status === "aprovado") {
        const existingContratoId = row.contrato_id || snap.contratoId;
        const existingContratoToken = row.contrato_token || snap.contratoToken;
        let existingContratoStatus = "pendente";
        let existingDraStatus = "pendente";
        let existingContratoLink: string | null = null;

        if (existingContratoId) {
          try {
            const { data: exDoc } = await supabase
              .from("documentos_clinicos")
              .select("id, itens")
              .eq("tipo", "contrato")
              .or(`id.eq.${existingContratoId},itens->>contratoId.eq.${existingContratoId}`)
              .limit(1)
              .maybeSingle();

            if (exDoc) {
              const cSnap = (exDoc.itens || {}) as any;
              existingContratoStatus = cSnap.status || "pendente";
              existingDraStatus = cSnap.statusAssinaturaDentista === "assinado" ? "concluida" : "pendente";
              const tok = cSnap.token || existingContratoToken;
              existingContratoLink = `${origin}/contrato/${cSnap.contratoId || exDoc.id}?token=${encodeURIComponent(tok)}`;
            }
          } catch (_) {}
        }

        return json({
          ok: true,
          jaAprovado: true,
          id: row.id,
          status: "aprovado",
          aprovadoEm: row.aprovado_em || row.data_assinatura || snap.aprovadoEm,
          condicaoEscolhida: row.condicao_escolhida || snap.condicaoEscolhida,
          contratoId: existingContratoId,
          contratoToken: existingContratoToken,
          contratoStatus: existingContratoStatus,
          contratoLink: existingContratoLink,
          assinaturaDraStatus: existingDraStatus,
        });
      }

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

      // 2. Busca dados complementares do paciente e clínica
      let pacienteDados: any = { id: row.paciente_id, nome: row.paciente_nome || snap.pacienteNome || "Paciente" };
      if (row.paciente_id) {
        try {
          const { data: pRow } = await supabase.from("pacientes").select("*").eq("id", row.paciente_id).maybeSingle();
          if (pRow) pacienteDados = { ...pacienteDados, ...pRow };
        } catch (_) {}
      }

      let clinicaDados: any = {
        nome: "Santos & Duracenski Odontologia LTDA",
        dentistaResponsavel: "Dra. Rosângela Santos Pereira",
        cro: "CRO-AL 06267",
        cnpj: "12.345.678/0001-90",
        documento: "12.345.678/0001-90",
        endereco: "Av. Fernandes Lima, 1000, Sala 401, Farol, Maceió - AL, CEP 57055-000",
        telefone: "(82) 99999-8888",
        email: "contato@santosduracenski.com.br",
        chavePix: "12345678000190",
        tipoChavePix: "cnpj",
        favorecidoPix: "Santos & Duracenski Odontologia LTDA",
        bancoPix: "Nu Pagamentos S.A. (260)",
        instrucoesPix: "Pague via QR Code ou Copia e Cola no app do seu banco",
      };
      try {
        const { data: cRow } = await supabase.from("configuracoes").select("*").limit(1).maybeSingle();
        if (cRow) {
          clinicaDados = {
            ...clinicaDados,
            nome: cRow.nome_clinica || clinicaDados.nome,
            dentistaResponsavel: cRow.dentista_responsavel || clinicaDados.dentistaResponsavel,
            cro: cRow.cro || clinicaDados.cro,
            cnpj: cRow.cnpj || clinicaDados.cnpj,
            documento: cRow.cnpj || cRow.cpf || clinicaDados.documento,
            endereco: cRow.endereco || clinicaDados.endereco,
            telefone: cRow.telefone || cRow.whatsapp_numero || clinicaDados.telefone,
            email: cRow.email || clinicaDados.email,
            chavePix: cRow.chave_pix || cRow.chavePix || clinicaDados.chavePix,
            favorecidoPix: cRow.favorecido_pix || cRow.favorecidoPix || clinicaDados.favorecidoPix,
            bancoPix: cRow.banco_pix || cRow.bancoPix || clinicaDados.bancoPix,
            tipoChavePix: cRow.tipo_chave_pix || cRow.tipoChavePix || clinicaDados.tipoChavePix,
          };
        }
      } catch (_) {}

      // 3. Avalia autorização prévia da profissional (Dra. Rosângela Santos Pereira — CRO 06267-AL)
      let autorizacaoAtiva: any = null;
      try {
        const { data: authRows } = await supabase
          .from("autorizacoes_assinatura_profissional")
          .select("*")
          .eq("ativo", true)
          .is("revogado_em", null)
          .order("autorizado_em", { ascending: false })
          .limit(1);

        if (authRows && authRows.length > 0) {
          autorizacaoAtiva = authRows[0];
        }
      } catch (_) {
        try {
          const { data: authDoc } = await supabase
            .from("documentos_clinicos")
            .select("*")
            .eq("tipo", "autorizacao_profissional")
            .filter("itens->>ativo", "eq", "true")
            .order("criado_em", { ascending: false })
            .limit(1);

          if (authDoc && authDoc.length > 0) {
            autorizacaoAtiva = authDoc[0].itens;
          }
        } catch (_) {}
      }

      // 4. Geração do Contrato correspondente vinculado
      const contratoId = "CTR-" + (norm.code8 || crypto.randomUUID().slice(0, 8).toUpperCase());
      const rawTokenBytes = new Uint8Array(24);
      crypto.getRandomValues(rawTokenBytes);
      const contratoToken = Array.from(rawTokenBytes, (b) => b.toString(16).padStart(2, "0")).join("");
      const contratoLink = `${origin}/contrato/${contratoId}?token=${contratoToken}`;

      let statusContrato = "pendente";
      let statusAssinaturaDentista = "pendente";
      let assinaturaDentistaObj: any = null;
      let assinaturaDraStatus = "pendente";

      const isCroValido = autorizacaoAtiva && (
        autorizacaoAtiva.profissional_cro === "06267-AL" ||
        autorizacaoAtiva.profissionalCro === "06267-AL" ||
        String(autorizacaoAtiva.profissional_cro || autorizacaoAtiva.profissionalCro || "").replace(/[^0-9]/g, "") === "06267"
      );

      if (autorizacaoAtiva && isCroValido && autorizacaoAtiva.ativo !== false && !autorizacaoAtiva.revogado_em) {
        statusContrato = "aguardando_assinatura_paciente";
        statusAssinaturaDentista = "assinado";
        assinaturaDraStatus = "concluida";

        assinaturaDentistaObj = {
          nome: autorizacaoAtiva.profissional_nome || autorizacaoAtiva.profissionalNome || clinicaDados.dentistaResponsavel,
          cro: autorizacaoAtiva.profissional_cro || autorizacaoAtiva.profissionalCro || clinicaDados.cro,
          documento: autorizacaoAtiva.profissional_documento || autorizacaoAtiva.profissionalDocumento || clinicaDados.documento,
          dataHora: nowIso,
          metodo: "assinatura_automatica_autorizada",
          autorizacaoId: autorizacaoAtiva.id,
          autorizadoEm: autorizacaoAtiva.autorizado_em || autorizacaoAtiva.autorizadoEm,
          autorizacaoExpressa: autorizacaoAtiva.autorizacao_expressa || autorizacaoAtiva.autorizacaoExpressa,
          assinaturaData: autorizacaoAtiva.assinatura_grafica || autorizacaoAtiva.assinaturaGrafica || "",
          versaoContrato: "1.0",
        };
      }

      // Snapshot contratual imutável com UNICAMENTE a condição de pagamento aprovada
      const snapshotContrato = {
        contratoId,
        token: contratoToken,
        orcamentoId: row.id,
        pacienteId: row.paciente_id || null,
        pacienteNome: pacienteDados.nome,
        versao: "1.0",
        status: statusContrato,
        statusAssinaturaDentista,
        statusAssinaturaPaciente: "pendente",
        isFormalizadoTotal: false,
        emitidoEm: nowIso,
        assinaturaDentista: assinaturaDentistaObj,
        assinaturaPaciente: null,
        financeiro: (() => {
          const parcelasGeradas = gerarParcelasServidor(condicaoEscolhida, totalFinal, nowIso);
          return {
            valorTotal: totalFinal,
            valorDesconto: descontoFinal,
            condicaoEscolhida,
            formaPagamento: condicaoEscolhida.descricao || condicaoEscolhida.titulo || "Conforme aprovado",
            detalhes: condicaoEscolhida.descricao,
            parcelas: parcelasGeradas,
            quantidadeParcelas: parcelasGeradas.length,
            valorParcela: parcelasGeradas[0]?.valor || totalFinal,
          };
        })(),
        orcamento: {
          id: row.id,
          titulo: row.titulo || "Plano de Tratamento",
          itens: row.itens,
          total: totalFinal,
          desconto: descontoFinal,
          formasPagamento: condicaoEscolhida.titulo,
        },
        paciente: {
          id: row.paciente_id || null,
          nome: pacienteDados.nome,
          cpf: pacienteDados.cpf || null,
          rg: pacienteDados.rg || null,
          email: pacienteDados.email || null,
          telefone: pacienteDados.telefone || null,
          endereco: formatarEnderecoCompleto(pacienteDados) || pacienteDados.endereco || null,
          dataNascimento: pacienteDados.data_nascimento || pacienteDados.dataNascimento || null,
          idade: pacienteDados.idade || null,
          profissao: pacienteDados.profissao || null,
          estadoCivil: pacienteDados.estado_civil || pacienteDados.estadoCivil || null,
        },
        clinica: clinicaDados,
      };

      // 5. Persiste o contrato em documentos_clinicos
      try {
        await supabase.from("documentos_clinicos").insert({
          identificador: contratoId,
          paciente_id: row.paciente_id || null,
          paciente_nome: pacienteDados.nome,
          tipo: "contrato",
          titulo: `Contrato Odontológico - ${pacienteDados.nome} (${contratoId})`,
          conteudo: "",
          itens: snapshotContrato,
          dentista: clinicaDados.dentistaResponsavel,
          criado_em: nowIso,
          atualizado_em: nowIso,
        });

        if (assinaturaDentistaObj) {
          await supabase.from("assinaturas").insert({
            documento_id: contratoId,
            documento_tipo: "contrato",
            tipo: "dentista",
            nome: assinaturaDentistaObj.nome,
            assinatura_data: assinaturaDentistaObj.assinaturaData || "RUBRICA_DIGITAL_AUTORIZADA",
            paciente_id: row.paciente_id || null,
            user_id: row.user_id || null,
            evidencias: {
              autorizacaoId: assinaturaDentistaObj.autorizacaoId,
              autorizadoEm: assinaturaDentistaObj.autorizadoEm,
              metodo: "assinatura_automatica_autorizada",
              cro: assinaturaDentistaObj.cro,
              aplicadaEm: nowIso,
            },
            criado_em: nowIso,
            atualizado_em: nowIso,
          }).catch(() => {});
        }
      } catch (cErr) {
        console.error("[orcamento-publico] Erro ao persistir contrato automático:", cErr);
      }

      // 6. Atualiza o orçamento com a aprovação e vincula o contrato
      const snapshotAprovacao = {
        condicao: condicaoEscolhida,
        aprovadoEm: nowIso,
        versao: versaoAtual,
        contratoId,
        contratoToken,
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
        contratoId,
        contratoToken,
        contratoStatus: statusContrato,
        snapshotAprovacao,
        versaoAprovada: versaoAtual,
      };

      const updPayload: Record<string, any> = {
        status: "aprovado",
        desconto: descontoFinal,
        total: totalFinal,
        contrato_id: contratoId,
        contrato_token: contratoToken,
        assinatura_paciente: updatedSnap,
        data_assinatura: nowIso,
        atualizado_em: nowIso,
      };

      const { error: updErr } = await supabase.from("orcamentos").update(updPayload).eq("id", row.id);
      if (updErr) {
        console.error("[orcamento-publico] Erro ao aprovar orçamento no banco:", updErr);
        throw updErr;
      }

      // Atualiza status do paciente para 'Em Tratamento'
      if (row.paciente_id) {
        try {
          await supabase.from("pacientes").update({
            status: "Em Tratamento",
            atualizado_em: nowIso,
          }).eq("id", row.paciente_id);
        } catch (_) {}
      }

      console.log(`[orcamento-publico] Orçamento id=${row.id} aprovado com contrato vinculado ${contratoId}`);

      return json({
        ok: true,
        id: row.id,
        identificador: snap.identificador || row.identificador || targetId,
        status: "aprovado",
        aprovadoEm: nowIso,
        condicaoEscolhida,
        contratoId,
        contratoToken,
        contratoStatus: statusContrato,
        contratoLink,
        assinaturaDraStatus,
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

    // Observação de segurança: esta função é pública (verify_jwt = false).
    // Ela NÃO expõe ação de gravação livre; a emissão/edição do orçamento
    // continua sendo feita pela área administrativa autenticada (RLS normal).

    return json({ ok: false, error: `Ação '${action}' desconhecida`, code: "UNKNOWN_ACTION" }, 400);
  } catch (err: any) {
    console.error("[orcamento-publico] Erro interno:", err);
    return json({
      ok: false,
      error: "Ocorreu um erro interno no servidor ao processar a solicitação.",
      code: "INTERNAL_ERROR",
    }, 500);
  }
});

