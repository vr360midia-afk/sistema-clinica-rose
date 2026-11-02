import { supabase } from '@/integrations/supabase/client';
import { slugifyNome } from './anamneseEngine';
import { obterBaseUrlOficial } from './contratoEngine';
import {
  CondicaoPagamento,
  parseCondicoesPagamento,
  obterTextoCondicaoParaContrato,
  filtrarApenasCondicaoEscolhida,
} from './orcamentoCondicoes';
import { mapearDadosContrato, emitirContratoPersistido, ContratoSnapshot } from './contratoEngine';
import type { Orcamento, OrcamentoItem } from '@/hooks/useOrcamentos';

export interface FotoPlanejamento {
  id: string;
  url: string;
  storagePath?: string;
  titulo?: string;
  descricao?: string;
  tipo?: 'inicial' | 'planejamento' | 'simulacao' | 'outro';
  autorizada: boolean;
  criadaEm?: string;
}

export interface OrcamentoPublicoDados {
  id: string;
  identificador: string;
  titulo: string;
  itens: OrcamentoItem[];
  subtotal: number;
  desconto: number;
  total: number;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'recusado';
  validade?: string | null;
  observacoes?: string | null;
  formasPagamentoRaw?: string | null;
  condicoes: CondicaoPagamento[];
  condicaoEscolhida?: CondicaoPagamento | null;
  aprovadoEm?: string | null;
  pacienteId?: string | null;
  pacienteNome: string;
  fotosPlanejamento: FotoPlanejamento[];
  contratoId?: string | null;
  contratoToken?: string | null;
  contratoStatus?: string | null;
  contratoIdentificador?: string | null;
  contratoLink?: string | null;
  clinica: {
    nome: string;
    logoUrl?: string | null;
    telefone?: string | null;
    email?: string | null;
    dentistaResponsavel?: string | null;
    cro?: string | null;
  };
}

/**
 * Gera identificador amigável padrão no formato ORC-XXXXXXXX
 */
export function gerarIdentificadorOrcamento(): string {
  const chars = '0123456789ABCDEF';
  let code = '';
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : null;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(4);
    cryptoObj.getRandomValues(bytes);
    for (let i = 0; i < 4; i++) {
      code += chars[bytes[i] >> 4] + chars[bytes[i] & 0x0f];
    }
  } else {
    code = Math.random().toString(16).substring(2, 10).toUpperCase();
  }
  return `ORC-${code}`;
}

/**
 * Gera token criptográfico seguro de 48 caracteres hexadecimais para acesso individual
 */
export function gerarTokenAcessoOrcamento(): string {
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : null;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(24);
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return Array.from({ length: 48 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/**
 * Constrói o link oficial público curto, limpo e seguro do orçamento:
 * Formato padrão: /{slug-paciente}/orcamento/{identificador}?token={token}
 */
export function construirUrlPublicaOrcamento(params: {
  pacienteNome?: string;
  identificador: string;
  token?: string;
}): string {
  const base = obterBaseUrlOficial();
  const slug = slugifyNome(params.pacienteNome || 'paciente');
  const tokenParam = params.token ? `token=${encodeURIComponent(params.token)}` : '';
  const queryStr = tokenParam ? `?${tokenParam}` : '';
  return `${base}/${slug}/orcamento/${params.identificador}${queryStr}`;
}

/**
 * Garante que o orçamento esteja persistido no Supabase com seu identificador amigável
 * e token individual seguro ANTES de ser compartilhado.
 */
export async function garantirOrcamentoPersistidoComToken(
  orcamento: Partial<Orcamento> & { itens: OrcamentoItem[] },
  paciente?: any
): Promise<{
  ok: boolean;
  link: string;
  identificador: string;
  token: string;
  orcamentoId: string;
  error?: string;
}> {
  try {
    const pacienteNome = paciente?.nome || orcamento.pacienteNome || 'Paciente';
    const pacienteId = paciente?.id || orcamento.pacienteId || null;

    let identificador = (orcamento as any).identificador;
    if (!identificador || !identificador.startsWith('ORC-')) {
      if (orcamento.id && !orcamento.id.includes('-')) {
        identificador = orcamento.id;
      } else {
        identificador = gerarIdentificadorOrcamento();
      }
    }

    let token = (orcamento as any).tokenAssinatura || (orcamento as any).token_assinatura;
    if (!token || token.length < 16) {
      token = gerarTokenAcessoOrcamento();
    }

    const dataExpiracao = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const subtotal = (orcamento.itens || []).reduce(
      (acc, i) => acc + (Number(i.valor || 0) * Number(i.quantidade || 1)),
      0
    );
    const total = Math.max(0, subtotal - Number(orcamento.desconto || 0));

    const snapAssinatura = {
      identificador,
      token,
      dataExpiracaoLink: dataExpiracao,
      fotosPlanejamento: (orcamento as any).fotosPlanejamento || (orcamento as any).fotos_planejamento || [],
    };

    // Payload para atualizar ou inserir no Supabase
    const payloadUpdate: Record<string, any> = {
      token_assinatura: token,
      data_expiracao_link: dataExpiracao,
      paciente_nome: pacienteNome,
      titulo: orcamento.titulo || 'Plano de tratamento',
      itens: orcamento.itens,
      desconto: orcamento.desconto || 0,
      total,
      formas_pagamento: orcamento.formasPagamento || null,
      observacoes: orcamento.observacoes || null,
      validade: orcamento.validade || null,
      assinatura_paciente: snapAssinatura,
      atualizado_em: new Date().toISOString(),
    };

    if (identificador) {
      payloadUpdate.identificador = identificador;
    }

    if (pacienteId) {
      payloadUpdate.paciente_id = pacienteId;
    }

    let finalId = orcamento.id;

    if (finalId) {
      let { error: updErr } = await supabase
        .from('orcamentos')
        .update(payloadUpdate)
        .eq('id', finalId);

      if (updErr && (updErr.code === 'PGRST204' || updErr.message?.includes('column'))) {
        delete payloadUpdate.identificador;
        const retry = await supabase
          .from('orcamentos')
          .update(payloadUpdate)
          .eq('id', finalId);
        updErr = retry.error;
      }

      if (updErr) {
        console.warn('[OrcamentoEngine] Falha ao atualizar orcamento no banco:', updErr);
      }
    } else {
      // Inserção caso seja um novo orçamento
      let { data: insData, error: insErr } = await supabase
        .from('orcamentos')
        .insert({
          ...payloadUpdate,
          user_id: paciente?.user_id || undefined,
          status: orcamento.status || 'enviado',
        })
        .select('id')
        .maybeSingle();

      if (insErr && (insErr.code === 'PGRST204' || insErr.message?.includes('column'))) {
        delete payloadUpdate.identificador;
        const retryIns = await supabase
          .from('orcamentos')
          .insert({
            ...payloadUpdate,
            user_id: paciente?.user_id || undefined,
            status: orcamento.status || 'enviado',
          })
          .select('id')
          .maybeSingle();
        insData = retryIns.data;
        insErr = retryIns.error;
      }

      if (!insErr && insData?.id) {
        finalId = insData.id;
      }
    }

    // Salva no localStorage local para contingência instantânea
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cacheData = {
          ...orcamento,
          id: finalId || identificador,
          identificador,
          tokenAssinatura: token,
          token_assinatura: token,
          pacienteNome,
          total,
        };
        window.localStorage.setItem(`orcamento_${identificador}`, JSON.stringify(cacheData));
        if (finalId) {
          window.localStorage.setItem(`orcamento_${finalId}`, JSON.stringify(cacheData));
        }
      } catch (_) {}
    }

    const link = construirUrlPublicaOrcamento({
      pacienteNome,
      identificador,
      token,
    });

    return {
      ok: true,
      link,
      identificador,
      token,
      orcamentoId: finalId || identificador,
    };
  } catch (err: any) {
    console.error('[OrcamentoEngine] Erro ao garantir persistência:', err);
    const pacienteNome = paciente?.nome || orcamento.pacienteNome || 'Paciente';
    const identificador = (orcamento as any).identificador || gerarIdentificadorOrcamento();
    const token = (orcamento as any).tokenAssinatura || gerarTokenAcessoOrcamento();
    const link = construirUrlPublicaOrcamento({ pacienteNome, identificador, token });

    return {
      ok: false,
      link,
      identificador,
      token,
      orcamentoId: orcamento.id || identificador,
      error: err?.message || 'Erro inesperado',
    };
  }
}

/**
 * Consulta o orçamento público com validação estrita de token e permissões
 */
export async function obterOrcamentoPublico(
  identificador: string,
  token: string
): Promise<{
  ok: boolean;
  orcamento?: OrcamentoPublicoDados;
  error?: string;
  isExpirado?: boolean;
}> {
  if (!identificador || !token) {
    return { ok: false, error: 'Identificador e token de acesso são obrigatórios' };
  }

  const cleanId = identificador.trim();
  const cleanToken = token.trim();

  // 1. Tenta RPC do backend 'obter_orcamento_publico'
  try {
    const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)('obter_orcamento_publico', {
      p_identificador: cleanId,
      p_token: cleanToken,
    });

    if (!rpcErr && rpcData?.ok) {
      const orc = rpcData;
      const parsedConds = parseCondicoesPagamento(orc.formasPagamento, orc.total || 0);

      let contratoLink: string | null = null;
      if (orc.contratoId && orc.contratoToken) {
        const base = obterBaseUrlOficial();
        const slug = slugifyNome(orc.pacienteNome || 'paciente');
        const cId = orc.contratoIdentificador || orc.contratoId;
        contratoLink = `${base}/${slug}/contrato/${cId}?token=${encodeURIComponent(orc.contratoToken)}`;
      }

      return {
        ok: true,
        orcamento: {
          id: orc.id,
          identificador: orc.identificador,
          titulo: orc.titulo || 'Plano de tratamento',
          itens: Array.isArray(orc.itens) ? orc.itens : [],
          subtotal: (Array.isArray(orc.itens) ? orc.itens : []).reduce(
            (acc: number, it: any) => acc + (Number(it.valor || 0) * Number(it.quantidade || 1)),
            0
          ),
          desconto: Number(orc.desconto || 0),
          total: Number(orc.total || 0),
          status: orc.status,
          validade: orc.validade,
          observacoes: orc.observacoes,
          formasPagamentoRaw: orc.formasPagamento,
          condicoes: parsedConds,
          condicaoEscolhida: orc.condicaoEscolhida || (parsedConds.find((c) => c.selecionada) || null),
          aprovadoEm: orc.aprovadoEm,
          pacienteId: orc.pacienteId,
          pacienteNome: orc.pacienteNome,
          fotosPlanejamento: Array.isArray(orc.fotosPlanejamento) ? orc.fotosPlanejamento : [],
          contratoId: orc.contratoId,
          contratoToken: orc.contratoToken,
          contratoStatus: orc.contratoStatus,
          contratoIdentificador: orc.contratoIdentificador,
          contratoLink,
          clinica: orc.clinica || { nome: 'Clínica Odontológica' },
        },
      };
    } else if (rpcData && !rpcData.ok && rpcData.error) {
      if (rpcData.error.includes('expirou')) {
        return { ok: false, error: rpcData.error, isExpirado: true };
      }
      return { ok: false, error: rpcData.error };
    }
  } catch (_) {}

  // 2. Fallback: Consulta direta no banco de dados Supabase
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
    let query = supabase.from('orcamentos').select('*');

    if (isUuid) {
      query = query.or(`id.eq.${cleanId},identificador.eq.${cleanId.toUpperCase()},identificador.eq.${cleanId}`);
    } else {
      query = query.or(`identificador.eq.${cleanId.toUpperCase()},identificador.eq.${cleanId},id.eq.${cleanId}`);
    }

    const { data: rows, error: queryErr } = await query.order('criado_em', { ascending: false }).limit(1);
    const row = rows?.[0];

    if (!row) {
      // 3. Fallback: Cache local (offline)
      if (typeof window !== 'undefined' && window.localStorage) {
        const cachedStr =
          window.localStorage.getItem(`orcamento_${cleanId}`) ||
          window.localStorage.getItem(`orcamento_${cleanId.toUpperCase()}`);
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          if (cached.tokenAssinatura === cleanToken || cached.token_assinatura === cleanToken) {
            const parsedConds = parseCondicoesPagamento(cached.formasPagamento, cached.total || 0);
            return {
              ok: true,
              orcamento: {
                id: cached.id || cleanId,
                identificador: cached.identificador || cleanId,
                titulo: cached.titulo || 'Plano de tratamento',
                itens: cached.itens || [],
                subtotal: (cached.itens || []).reduce(
                  (acc: number, it: any) => acc + (Number(it.valor || 0) * Number(it.quantidade || 1)),
                  0
                ),
                desconto: Number(cached.desconto || 0),
                total: Number(cached.total || 0),
                status: cached.status || 'enviado',
                validade: cached.validade,
                observacoes: cached.observacoes,
                formasPagamentoRaw: cached.formasPagamento,
                condicoes: parsedConds,
                condicaoEscolhida: cached.condicaoEscolhida || (parsedConds.find((c) => c.selecionada) || null),
                aprovadoEm: cached.aprovadoEm || null,
                pacienteId: cached.pacienteId,
                pacienteNome: cached.pacienteNome || 'Paciente',
                fotosPlanejamento: cached.fotosPlanejamento || [],
                contratoId: cached.contratoId || null,
                contratoToken: cached.contratoToken || null,
                clinica: { nome: 'Clínica Odontológica' },
              },
            };
          }
        }
      }

      return { ok: false, error: 'Orçamento não encontrado. Verifique o link ou solicite um novo à clínica.' };
    }

    // Validação estrita do token
    const tokenSalvo = row.token_assinatura;
    if (!tokenSalvo || tokenSalvo !== cleanToken) {
      return { ok: false, error: 'Token de segurança inválido. Acesso não autorizado.' };
    }

    // Validação de expiração se informada
    if (row.data_expiracao_link && new Date(row.data_expiracao_link) < new Date()) {
      return { ok: false, error: 'Esta proposta de orçamento expirou.', isExpirado: true };
    }

    const parsedConds = parseCondicoesPagamento(row.formas_pagamento, Number(row.total || 0));

    // Tenta carregar dados da clínica
    let clinicaInfo = { nome: 'Clínica Odontológica', logoUrl: null, telefone: null, email: null, dentistaResponsavel: null, cro: null };
    try {
      const { data: configRow } = await supabase.from('configuracoes').select('*').limit(1).maybeSingle();
      if (configRow) {
        clinicaInfo = {
          nome: configRow.nome_clinica || 'Clínica Odontológica',
          logoUrl: configRow.logo_url || null,
          telefone: configRow.telefone || null,
          email: configRow.email || null,
          dentistaResponsavel: configRow.dentista_responsavel || null,
          cro: configRow.cro || null,
        };
      }
    } catch (_) {}

    // Verifica se há contrato vinculado
    let contratoLink: string | null = null;
    let contratoIdentificador: string | null = null;
    let contratoStatus: string | null = null;

    const snapAssinatura = (row.assinatura_paciente || {}) as any;
    const effectiveContratoId = row.contrato_id || snapAssinatura.contratoId;
    const effectiveContratoToken = row.contrato_token || snapAssinatura.contratoToken;
    const effectiveIdentificador = row.identificador || snapAssinatura.identificador || `ORC-${row.id.slice(0, 8).toUpperCase()}`;
    const effectiveFotos = Array.isArray(row.fotos_planejamento) && row.fotos_planejamento.length > 0
      ? row.fotos_planejamento
      : (snapAssinatura.fotosPlanejamento || []);
    const effectiveCondicao = row.condicao_escolhida || snapAssinatura.condicaoEscolhida;
    const effectiveAprovadoEm = row.aprovado_em || snapAssinatura.aprovadoEm || row.data_assinatura;

    if (effectiveContratoId) {
      try {
        const { data: docContrato } = await supabase
          .from('documentos_clinicos')
          .select('id, itens')
          .eq('tipo', 'contrato')
          .or(`id.eq.${effectiveContratoId},itens->>contratoId.eq.${effectiveContratoId}`)
          .maybeSingle();

        if (docContrato) {
          const snap = docContrato.itens as any;
          contratoIdentificador = snap?.contratoId || docContrato.id;
          contratoStatus = snap?.status || 'pendente';
          const tok = snap?.token || effectiveContratoToken;
          if (tok) {
            const base = obterBaseUrlOficial();
            const slug = slugifyNome(row.paciente_nome || 'paciente');
            contratoLink = `${base}/${slug}/contrato/${contratoIdentificador}?token=${encodeURIComponent(tok)}`;
          }
        }
      } catch (_) {}
    }

    return {
      ok: true,
      orcamento: {
        id: row.id,
        identificador: effectiveIdentificador,
        titulo: row.titulo || 'Plano de tratamento',
        itens: Array.isArray(row.itens) ? row.itens : [],
        subtotal: (Array.isArray(row.itens) ? row.itens : []).reduce(
          (acc: number, it: any) => acc + (Number(it.valor || 0) * Number(it.quantidade || 1)),
          0
        ),
        desconto: Number(row.desconto || 0),
        total: Number(row.total || 0),
        status: row.status as any,
        validade: row.validade,
        observacoes: row.observacoes,
        formasPagamentoRaw: row.formas_pagamento,
        condicoes: parsedConds,
        condicaoEscolhida: effectiveCondicao || (parsedConds.find((c) => c.selecionada) || null),
        aprovadoEm: effectiveAprovadoEm,
        pacienteId: row.paciente_id,
        pacienteNome: row.paciente_nome || 'Paciente',
        fotosPlanejamento: effectiveFotos,
        contratoId: effectiveContratoId,
        contratoToken: effectiveContratoToken,
        contratoStatus,
        contratoIdentificador,
        contratoLink,
        clinica: clinicaInfo,
      },
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erro ao carregar orçamento.' };
  }
}

/**
 * Registra a aprovação online do orçamento pelo paciente
 * - Bloqueia aprovações duplicadas
 * - Salva snapshot imutável da versão aprovada
 * - Registra data/hora e condição escolhida
 * - Atualiza status no painel administrativo
 * - NÃO lança baixa financeira nem recebimentos automáticos
 */
export async function aprovarOrcamentoPublico(params: {
  identificador: string;
  token: string;
  condicaoEscolhida: CondicaoPagamento;
  evidencias?: {
    ip?: string;
    userAgent?: string;
    dispositivo?: string;
  };
}): Promise<{
  ok: boolean;
  aprovadoEm?: string;
  error?: string;
  jaAprovado?: boolean;
}> {
  const { identificador, token, condicaoEscolhida, evidencias } = params;

  if (!identificador || !token) {
    return { ok: false, error: 'Identificador e token são obrigatórios.' };
  }
  if (!condicaoEscolhida) {
    return { ok: false, error: 'Selecione uma condição de pagamento antes de aprovar.' };
  }

  // 1. Tenta RPC segura do PostgreSQL
  try {
    const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)('aprovar_orcamento_publico', {
      p_identificador: identificador.trim(),
      p_token: token.trim(),
      p_condicao: condicaoEscolhida,
      p_evidencias: evidencias || {},
    });

    if (!rpcErr && rpcData?.ok) {
      return {
        ok: true,
        aprovadoEm: rpcData.aprovadoEm,
        jaAprovado: rpcData.jaAprovado,
      };
    }
  } catch (_) {}

  // 2. Fallback: Gravação direta no Supabase com validação e integridade
  try {
    const cleanId = identificador.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

    let query = supabase.from('orcamentos').select('*');
    if (isUuid) {
      query = query.or(`id.eq.${cleanId},identificador.eq.${cleanId.toUpperCase()},identificador.eq.${cleanId}`);
    } else {
      query = query.or(`identificador.eq.${cleanId.toUpperCase()},identificador.eq.${cleanId},id.eq.${cleanId}`);
    }

    const { data: rows } = await query.limit(1);
    const orc = rows?.[0];

    if (!orc) {
      return { ok: false, error: 'Orçamento não encontrado no sistema.' };
    }

    if (orc.token_assinatura !== token.trim()) {
      return { ok: false, error: 'Token de segurança inválido.' };
    }

    if (orc.status === 'aprovado') {
      return {
        ok: true,
        jaAprovado: true,
        aprovadoEm: orc.aprovado_em || new Date().toISOString(),
      };
    }

    const nowIso = new Date().toISOString();
    const subtotalItens = (orc.itens || []).reduce(
      (acc: number, it: any) => acc + (Number(it.valor || 0) * Number(it.quantidade || 1)),
      0
    );

    let totalFinal = orc.total;
    let descontoFinal = orc.desconto;

    if (typeof condicaoEscolhida.valorTotal === 'number' && condicaoEscolhida.valorTotal > 0) {
      totalFinal = condicaoEscolhida.valorTotal;
      descontoFinal = Math.max(0, Number((subtotalItens - totalFinal).toFixed(2)));
    }

    const snapshot = {
      orcamentoId: orc.id,
      identificador: orc.identificador,
      titulo: orc.titulo,
      itens: orc.itens,
      subtotal: subtotalItens,
      desconto: descontoFinal,
      total: totalFinal,
      condicaoEscolhida,
      aprovadoEm: nowIso,
      pacienteNome: orc.paciente_nome,
      pacienteId: orc.paciente_id,
      evidencias: evidencias || {},
    };

    const updPayload: Record<string, any> = {
      status: 'aprovado',
      desconto: descontoFinal,
      total: totalFinal,
      data_assinatura: nowIso,
      aprovado_em: nowIso,
      condicao_escolhida: condicaoEscolhida as never,
      snapshot_aprovacao: snapshot as never,
      assinatura_paciente: {
        ...(orc.assinatura_paciente || {}),
        status: 'aprovado',
        aprovadoEm: nowIso,
        condicaoEscolhida,
        snapshotAprovacao: snapshot,
      },
      atualizado_em: nowIso,
    };

    let { error: updErr } = await supabase
      .from('orcamentos')
      .update(updPayload)
      .eq('id', orc.id);

    if (updErr && (updErr.code === 'PGRST204' || updErr.message?.includes('column'))) {
      delete updPayload.aprovado_em;
      delete updPayload.condicao_escolhida;
      delete updPayload.snapshot_aprovacao;
      const retry = await supabase
        .from('orcamentos')
        .update(updPayload)
        .eq('id', orc.id);
      updErr = retry.error;
    }

    if (updErr) {
      throw updErr;
    }

    // Se houver paciente vinculado, atualiza status para 'Em Tratamento'
    if (orc.paciente_id) {
      try {
        await supabase
          .from('pacientes')
          .update({
            status: 'Em Tratamento',
            atualizado_em: nowIso,
          })
          .eq('id', orc.paciente_id);
      } catch (_) {}
    }

    // Atualiza cache local
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cachedKey = `orcamento_${orc.identificador || cleanId}`;
        const prev = window.localStorage.getItem(cachedKey);
        if (prev) {
          const parsed = JSON.parse(prev);
          parsed.status = 'aprovado';
          parsed.aprovadoEm = nowIso;
          parsed.condicaoEscolhida = condicaoEscolhida;
          window.localStorage.setItem(cachedKey, JSON.stringify(parsed));
        }
      } catch (_) {}
    }

    return {
      ok: true,
      aprovadoEm: nowIso,
    };
  } catch (err: any) {
    console.error('[OrcamentoEngine] Erro ao aprovar orçamento:', err);
    return { ok: false, error: err?.message || 'Falha ao registrar aprovação do orçamento.' };
  }
}

/**
 * Gera um contrato formal a partir do orçamento aprovado contendo UNICAMENTE a condição de pagamento escolhida
 */
export async function gerarContratoDoOrcamentoAprovado(params: {
  orcamento: OrcamentoPublicoDados | Orcamento;
  patient: any;
  configuracoes: any;
  configContrato: any;
  modeloId?: 'geral' | 'lentes_resina' | 'endodontia';
}): Promise<{
  ok: boolean;
  contratoId: string;
  contratoToken: string;
  contratoLink: string;
  snapshot: ContratoSnapshot;
  error?: string;
}> {
  const { orcamento, patient, configuracoes, configContrato, modeloId } = params;

  // 1. Identifica a condição aprovada
  const condicoes = 'condicoes' in orcamento && Array.isArray(orcamento.condicoes)
    ? orcamento.condicoes
    : parseCondicoesPagamento((orcamento as any).formasPagamento || (orcamento as any).formas_pagamento, orcamento.total || 0);

  const condicaoEscolhida =
    ('condicaoEscolhida' in orcamento && orcamento.condicaoEscolhida) ||
    condicoes.find((c) => c.selecionada) ||
    condicoes[0];

  // 2. Filtra estritamente apenas a condição aprovada para que nenhuma outra apareça no contrato
  const { formasPagamentoFinal } = filtrarApenasCondicaoEscolhida(
    condicoes,
    condicaoEscolhida?.id
  );

  const orcamentoAprovadoParaContrato: Orcamento = {
    id: orcamento.id,
    titulo: orcamento.titulo,
    pacienteId: orcamento.pacienteId || patient?.id,
    pacienteNome: orcamento.pacienteNome || patient?.nome,
    itens: orcamento.itens || [],
    desconto: orcamento.desconto || 0,
    total: typeof condicaoEscolhida?.valorTotal === 'number' && condicaoEscolhida.valorTotal > 0
      ? condicaoEscolhida.valorTotal
      : orcamento.total,
    status: 'aprovado',
    validade: orcamento.validade,
    observacoes: orcamento.observacoes,
    formasPagamento: formasPagamentoFinal,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  };

  // 3. Mapeia o snapshot formal do contrato com os termos e cláusulas
  const snapshotContrato = mapearDadosContrato({
    patient,
    orcamento: orcamentoAprovadoParaContrato,
    configuracoes,
    configContrato,
    dadosRestauracoesPreexistentes: patient?.restauracoesPreexistentes,
  });

  // Vincula ID do orçamento no snapshot
  if (snapshotContrato.orcamento) {
    snapshotContrato.orcamento.id = orcamento.id;
  }

  // 4. Emite e persiste o contrato no Supabase
  const resEmissao = await emitirContratoPersistido(snapshotContrato);

  if (resEmissao.ok || resEmissao.identificador) {
    // 5. Vincula o contrato gerado ao orçamento no Supabase
    try {
      await supabase
        .from('orcamentos')
        .update({
          contrato_id: resEmissao.identificador,
          contrato_token: resEmissao.token,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', orcamento.id);
    } catch (e) {
      console.warn('[OrcamentoEngine] Falha ao salvar contrato_id no orcamento:', e);
    }

    return {
      ok: true,
      contratoId: resEmissao.identificador,
      contratoToken: resEmissao.token,
      contratoLink: resEmissao.link,
      snapshot: resEmissao.snapshot,
    };
  }

  return {
    ok: false,
    contratoId: resEmissao.identificador,
    contratoToken: resEmissao.token,
    contratoLink: resEmissao.link,
    snapshot: resEmissao.snapshot,
    error: resEmissao.error || 'Falha ao gerar contrato',
  };
}

/**
 * Gera URL assinada temporária para visualização privada de foto de planejamento
 */
export async function obterUrlAssinadaFoto(pathOuUrl: string): Promise<string> {
  if (!pathOuUrl) return '';
  if (pathOuUrl.startsWith('http') && !pathOuUrl.includes('supabase.co/storage/v1/object/public/')) {
    // Já é uma URL completa ou assinada
    return pathOuUrl;
  }

  try {
    // Extrai o path relativo dentro do bucket
    const cleanPath = pathOuUrl.replace(/^.*?documentos-pacientes\//, '').replace(/^\/+/, '');
    const { data, error } = await supabase.storage
      .from('documentos-pacientes')
      .createSignedUrl(cleanPath, 3600); // 1 hora de validade

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  } catch (_) {}

  return pathOuUrl;
}
