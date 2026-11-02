import { supabase } from '@/integrations/supabase/client';
import { slugifyNome } from './anamneseEngine';
import { obterBaseUrlOficial } from './contratoEngine';
import {
  CondicaoPagamento,
  parseCondicoesPagamento,
  obterTextoCondicaoParaContrato,
  filtrarApenasCondicaoEscolhida,
} from './orcamentoCondicoes';
import { mapearDadosContrato, emitirContratoPersistido, ContratoSnapshot, obterUserIdAtivo } from './contratoEngine';
import type { Orcamento, OrcamentoItem, StatusOrcamento } from '@/hooks/useOrcamentos';

export type { StatusOrcamento };

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

export interface SolicitacaoAjuste {
  id: string;
  orcamentoId?: string;
  pacienteId?: string | null;
  pacienteNome?: string;
  versaoOrcamento: number;
  motivo: string;
  mensagem?: string;
  solicitadaEm: string;
  atendida?: boolean;
}

export interface VersaoHistoricoOrcamento {
  versao: number;
  titulo?: string;
  total: number;
  subtotal?: number;
  desconto: number;
  itens: OrcamentoItem[];
  formasPagamento?: string | null;
  alteradaEm: string;
  alteradaPor?: string;
  motivoAjuste?: string;
}

export interface OrcamentoPublicoDados {
  id: string;
  identificador: string;
  titulo: string;
  itens: OrcamentoItem[];
  subtotal: number;
  desconto: number;
  total: number;
  status: StatusOrcamento;
  versao: number;
  solicitacoesAjuste: SolicitacaoAjuste[];
  historicoVersoes: VersaoHistoricoOrcamento[];
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
 * Normaliza qualquer código de identificação pública:
 * Suporta CTR-XXXX, ORC-XXXX, códigos de 8 caracteres e UUIDs completos
 */
export function normalizarIdentificadorPublico(input?: string | null): {
  raw: string;
  upper: string;
  code8: string | null;
  isUuid: boolean;
  withOrc: string;
  withCtr: string;
} {
  const raw = String(input || '').trim();
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

  const withOrc = code8 ? `ORC-${code8}` : upper.startsWith('ORC-') ? upper : `ORC-${upper}`;
  const withCtr = code8 ? `CTR-${code8}` : upper.startsWith('CTR-') ? upper : `CTR-${upper}`;

  return { raw, upper, code8, isUuid, withOrc, withCtr };
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
    if (!identificador || (!identificador.startsWith('ORC-') && !identificador.startsWith('CTR-'))) {
      if (orcamento.id) {
        const normId = normalizarIdentificadorPublico(orcamento.id);
        identificador = normId.code8 ? `ORC-${normId.code8}` : gerarIdentificadorOrcamento();
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

    const versao = Number((orcamento as any).versao || 1);
    const solicitacoesAjuste = (orcamento as any).solicitacoesAjuste || (orcamento as any).solicitacoes_ajuste || [];
    const historicoVersoes = (orcamento as any).historicoVersoes || (orcamento as any).historico_versoes || [];

    const snapAssinatura = {
      identificador,
      token,
      versao,
      solicitacoesAjuste,
      historicoVersoes,
      dataExpiracaoLink: dataExpiracao,
      fotosPlanejamento: (orcamento as any).fotosPlanejamento || (orcamento as any).fotos_planejamento || [],
      condicaoEscolhida: orcamento.condicaoEscolhida || null,
      aprovadoEm: orcamento.aprovadoEm || null,
      contratoId: orcamento.contratoId || null,
      contratoToken: orcamento.contratoToken || null,
    };

    const payloadDb: Record<string, any> = {
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

    if (pacienteId) {
      payloadDb.paciente_id = pacienteId;
    }

    let finalId = orcamento.id;
    const isUuid = finalId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalId);

    // Tenta persistir via Edge Function orcamento-publico com service_role
    let persistidoViaEdge = false;
    try {
      const { data: edgeSave, error: edgeErr } = await supabase.functions.invoke('orcamento-publico', {
        body: {
          action: 'save',
          orcamento: {
            ...payloadDb,
            ...(finalId ? { id: finalId } : {}),
            status: orcamento.status || 'enviado',
          },
        },
      });
      if (!edgeErr && edgeSave?.ok) {
        persistidoViaEdge = true;
        if (edgeSave.id) finalId = edgeSave.id;
      }
    } catch (_) {}

    if (!persistidoViaEdge) {
      if (isUuid) {
        const { error: updErr } = await supabase
          .from('orcamentos')
          .update(payloadDb)
          .eq('id', finalId);

        if (updErr) {
          console.warn('[OrcamentoEngine] Aviso ao atualizar orcamento no banco:', updErr);
        }
      } else {
        const activeUserId = (await obterUserIdAtivo()) || paciente?.user_id || undefined;
        const { data: insData, error: insErr } = await supabase
          .from('orcamentos')
          .insert({
            ...payloadDb,
            user_id: activeUserId,
            status: orcamento.status || 'enviado',
            criado_em: new Date().toISOString(),
          })
          .select('id')
          .maybeSingle();

        if (!insErr && insData?.id) {
          finalId = insData.id;
        } else if (insErr) {
          console.warn('[OrcamentoEngine] Aviso ao inserir novo orcamento no banco:', insErr);
        }
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
          versao,
          solicitacoesAjuste,
          historicoVersoes,
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
 * Localizador e validador centralizado para ações públicas de orçamento.
 * Resolve de forma segura e resiliente:
 * - Edge Function 'orcamento-publico' (com service_role no servidor)
 * - RPC 'obter_orcamento_publico' (com SECURITY DEFINER)
 * - Por UUID interno do Supabase (id) e por prefixo de 8 chars (id ILIKE 'XXXXXXXX-%')
 * - Por identificador público amigável (assinatura_paciente->>identificador) com ou sem prefixo CTR-/ORC-
 * - Por token criptográfico (token_assinatura / assinatura_paciente->>token)
 * - Por contingência local (localStorage)
 * Valida autorização de token, integridade de dados e expiração.
 */
export async function localizarRegistroOrcamento(
  identificadorOuId: string,
  token?: string,
  orcamentoId?: string
): Promise<{
  ok: boolean;
  row?: any;
  uuid?: string;
  identificador?: string;
  versao?: number;
  status?: StatusOrcamento;
  error?: string;
  code?: string;
  isExpirado?: boolean;
}> {
  const cleanId = String(identificadorOuId || '').trim();
  const cleanToken = String(token || '').trim();
  const cleanUuid = String(orcamentoId || '').trim();

  if (!cleanId && !cleanUuid && !cleanToken) {
    return { ok: false, error: 'Identificador ou token de acesso ausente', code: 'INVALID_PARAM' };
  }

  const targetId = cleanId || cleanUuid;
  const norm = normalizarIdentificadorPublico(targetId);
  const normUuid = cleanUuid ? normalizarIdentificadorPublico(cleanUuid) : null;

  let row: any = null;

  // 1. Tenta Edge Function 'orcamento-publico' prioritariamente (service_role com validação segura de token)
  if (cleanToken) {
    try {
      const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('orcamento-publico', {
        body: { action: 'get', identificador: targetId, token: cleanToken },
      });
      if (!edgeErr && edgeData?.ok && edgeData?.orcamento) {
        const o = edgeData.orcamento;
        return {
          ok: true,
          row: {
            id: o.id,
            titulo: o.titulo,
            itens: o.itens,
            desconto: o.desconto,
            total: o.total,
            status: o.status,
            versao: o.versao,
            validade: o.validade,
            observacoes: o.observacoes,
            formas_pagamento: o.formasPagamentoRaw,
            token_assinatura: cleanToken,
            paciente_id: o.pacienteId,
            paciente_nome: o.pacienteNome,
            assinatura_paciente: {
              identificador: o.identificador,
              token: cleanToken,
              versao: o.versao,
              solicitacoesAjuste: o.solicitacoesAjuste || [],
              historicoVersoes: o.historicoVersoes || [],
              condicaoEscolhida: o.condicaoEscolhida,
              aprovadoEm: o.aprovadoEm,
              fotosPlanejamento: o.fotosPlanejamento || [],
              contratoId: o.contratoId,
              contratoToken: o.contratoToken,
            },
          },
          uuid: o.id,
          identificador: o.identificador,
          versao: Number(o.versao || 1),
          status: o.status,
        };
      } else if (edgeData && !edgeData.ok && edgeData.code === 'EXPIRED_TOKEN') {
        return { ok: false, error: edgeData.error || 'Esta proposta de orçamento expirou.', code: 'EXPIRED_TOKEN', isExpirado: true };
      } else if (edgeData && !edgeData.ok && edgeData.code === 'INVALID_TOKEN') {
        return { ok: false, error: edgeData.error || 'Token de segurança inválido.', code: 'INVALID_TOKEN' };
      }
    } catch (_) {}
  }

  // 2. Tenta RPC do backend (SECURITY DEFINER)
  try {
    const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)('obter_orcamento_publico', {
      p_identificador: targetId,
      p_token: cleanToken,
    });
    if (!rpcErr && rpcData?.ok) {
      return {
        ok: true,
        row: rpcData,
        uuid: rpcData.id,
        identificador: rpcData.identificador,
        versao: Number(rpcData.versao || 1),
        status: rpcData.status,
      };
    } else if (rpcData && !rpcData.ok && rpcData.error && rpcData.error.includes('expirou')) {
      return { ok: false, error: rpcData.error, code: 'EXPIRED_TOKEN', isExpirado: true };
    }
  } catch (_) {}

  // 3. Consulta direta no Supabase: por UUID exato
  if (norm.isUuid) {
    try {
      const { data: rows } = await supabase
        .from('orcamentos')
        .select('*')
        .eq('id', norm.raw)
        .limit(1);
      if (rows && rows.length > 0) row = rows[0];
    } catch (_) {}
  }
  if (!row && normUuid?.isUuid) {
    try {
      const { data: rows } = await supabase
        .from('orcamentos')
        .select('*')
        .eq('id', normUuid.raw)
        .limit(1);
      if (rows && rows.length > 0) row = rows[0];
    } catch (_) {}
  }

  // 4. Consulta direta no Supabase: por prefixo de 8 caracteres do UUID (ex: 3327cc94 -> id ILIKE '3327cc94-%')
  if (!row && (norm.code8 || normUuid?.code8)) {
    const code = (norm.code8 || normUuid?.code8)!.toLowerCase();
    try {
      const { data: rows } = await supabase
        .from('orcamentos')
        .select('*')
        .ilike('id', `${code}-%`)
        .order('criado_em', { ascending: false })
        .limit(1);
      if (rows && rows.length > 0) row = rows[0];
    } catch (_) {}
  }

  // 5. Consulta direta no Supabase: por identificador amigável dentro do JSONB assinatura_paciente
  if (!row) {
    try {
      const queries = [norm.upper, norm.withOrc, norm.withCtr];
      if (norm.code8) queries.push(norm.code8);

      for (const q of queries) {
        const { data: rows } = await supabase
          .from('orcamentos')
          .select('*')
          .filter('assinatura_paciente->>identificador', 'eq', q)
          .order('criado_em', { ascending: false })
          .limit(1);
        if (rows && rows.length > 0) {
          row = rows[0];
          break;
        }
      }
    } catch (_) {}
  }

  // 6. Consulta direta no Supabase: por token criptográfico único
  if (!row && cleanToken) {
    try {
      const { data: rows } = await supabase
        .from('orcamentos')
        .select('*')
        .eq('token_assinatura', cleanToken)
        .order('criado_em', { ascending: false })
        .limit(1);

      if (rows && rows.length > 0) {
        row = rows[0];
      } else {
        const { data: rowsJson } = await supabase
          .from('orcamentos')
          .select('*')
          .filter('assinatura_paciente->>token', 'eq', cleanToken)
          .order('criado_em', { ascending: false })
          .limit(1);
        if (rowsJson && rowsJson.length > 0) {
          row = rowsJson[0];
        }
      }
    } catch (_) {}
  }

  // 7. Fallback: Cache local (localStorage) para contingência instantânea / modo offline
  if (!row && typeof window !== 'undefined' && window.localStorage) {
    try {
      const possibleKeys = [
        targetId ? `orcamento_${targetId}` : '',
        norm.upper ? `orcamento_${norm.upper}` : '',
        norm.withOrc ? `orcamento_${norm.withOrc}` : '',
        norm.withCtr ? `orcamento_${norm.withCtr}` : '',
        norm.code8 ? `orcamento_${norm.code8}` : '',
        norm.raw ? `orcamento_${norm.raw}` : '',
      ].filter(Boolean);

      for (const k of possibleKeys) {
        const str = window.localStorage.getItem(k);
        if (str) {
          try {
            const parsed = JSON.parse(str);
            if (parsed) {
              row = {
                id: parsed.id || targetId,
                titulo: parsed.titulo || 'Plano de tratamento',
                itens: parsed.itens || [],
                desconto: Number(parsed.desconto || 0),
                total: Number(parsed.total || 0),
                status: parsed.status || 'enviado',
                validade: parsed.validade,
                observacoes: parsed.observacoes,
                formas_pagamento: parsed.formasPagamento || parsed.formas_pagamento,
                token_assinatura: parsed.tokenAssinatura || parsed.token_assinatura || cleanToken,
                data_expiracao_link: parsed.dataExpiracaoLink || parsed.data_expiracao_link,
                data_assinatura: parsed.aprovadoEm || parsed.data_assinatura,
                paciente_id: parsed.pacienteId || parsed.paciente_id,
                paciente_nome: parsed.pacienteNome || parsed.paciente_nome,
                assinatura_paciente: {
                  identificador: parsed.identificador || norm.withOrc,
                  token: parsed.tokenAssinatura || cleanToken,
                  versao: parsed.versao || 1,
                  solicitacoesAjuste: parsed.solicitacoesAjuste || [],
                  historicoVersoes: parsed.historicoVersoes || [],
                  condicaoEscolhida: parsed.condicaoEscolhida,
                  aprovadoEm: parsed.aprovadoEm,
                  fotosPlanejamento: parsed.fotosPlanejamento || [],
                  contratoId: parsed.contratoId,
                  contratoToken: parsed.contratoToken,
                },
              };
              break;
            }
          } catch (_) {}
        }
      }

      // Varredura por token no localStorage
      if (!row && cleanToken) {
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith('orcamento_')) {
            try {
              const val = JSON.parse(window.localStorage.getItem(k) || '{}');
              if (val.tokenAssinatura === cleanToken || val.token_assinatura === cleanToken || val.token === cleanToken) {
                row = {
                  id: val.id || targetId,
                  titulo: val.titulo,
                  itens: val.itens || [],
                  desconto: val.desconto || 0,
                  total: val.total || 0,
                  status: val.status || 'enviado',
                  validade: val.validade,
                  observacoes: val.observacoes,
                  formas_pagamento: val.formasPagamento || val.formas_pagamento,
                  token_assinatura: cleanToken,
                  paciente_id: val.pacienteId || val.paciente_id,
                  paciente_nome: val.pacienteNome || val.paciente_nome,
                  assinatura_paciente: {
                    identificador: val.identificador || norm.withOrc,
                    token: cleanToken,
                    versao: val.versao || 1,
                    solicitacoesAjuste: val.solicitacoesAjuste || [],
                    historicoVersoes: val.historicoVersoes || [],
                    condicaoEscolhida: val.condicaoEscolhida,
                    aprovadoEm: val.aprovadoEm,
                    fotosPlanejamento: val.fotosPlanejamento || [],
                  },
                };
                break;
              }
            } catch (_) {}
          }
        }
      }
    } catch (_) {}
  }

  if (!row) {
    return {
      ok: false,
      error: 'Orçamento não encontrado. Verifique o link ou solicite um novo à clínica.',
      code: 'NOT_FOUND',
    };
  }

  const snap = (row.assinatura_paciente || {}) as any;
  const tokenSalvo = row.token_assinatura || snap.token || snap.tokenAssinatura;

  // Validação do token de segurança se fornecido
  if (cleanToken && tokenSalvo && cleanToken !== tokenSalvo) {
    return {
      ok: false,
      error: 'Token de segurança inválido. Acesso não autorizado.',
      code: 'INVALID_TOKEN',
    };
  }

  // Validação de expiração
  const expiraEm = row.data_expiracao_link || snap.dataExpiracaoLink;
  if (expiraEm && new Date(expiraEm) < new Date()) {
    return {
      ok: false,
      error: 'Esta proposta de orçamento expirou.',
      code: 'EXPIRED_TOKEN',
      isExpirado: true,
    };
  }

  const identificador = snap.identificador || norm.withOrc || (row.id ? `ORC-${String(row.id).slice(0, 8).toUpperCase()}` : targetId);
  const versao = Number(snap.versao || row.versao || 1);
  const status = (row.status || snap.status || 'enviado') as StatusOrcamento;

  return {
    ok: true,
    row,
    uuid: row.id,
    identificador,
    versao,
    status,
  };
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
  code?: string;
  isExpirado?: boolean;
}> {
  if (!identificador || !token) {
    return {
      ok: false,
      error: 'Link incompleto ou token de acesso ausente. Por razões de privacidade e segurança jurídica, utilize o link oficial completo fornecido pela clínica.',
      code: 'INVALID_PARAM'
    };
  }

  // 1. Tenta Edge Function 'orcamento-publico' prioritariamente (service_role no backend)
  try {
    const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('orcamento-publico', {
      body: { action: 'get', identificador, token },
    });
    if (!edgeErr && edgeData?.ok && edgeData?.orcamento) {
      const o = edgeData.orcamento;
      return {
        ok: true,
        orcamento: {
          ...o,
          condicoes: parseCondicoesPagamento(o.formasPagamentoRaw, Number(o.total || 0)),
        },
      };
    } else if (edgeData && !edgeData.ok) {
      if (edgeData.code === 'EXPIRED_TOKEN' || edgeData.isExpirado) {
        return { ok: false, error: edgeData.error || 'Esta proposta de orçamento expirou.', code: 'EXPIRED_TOKEN', isExpirado: true };
      }
      if (edgeData.code === 'INVALID_TOKEN' || edgeData.code === 'NOT_FOUND') {
        return { ok: false, error: edgeData.error || 'Orçamento não encontrado. Verifique o link ou solicite um novo à clínica.', code: edgeData.code };
      }
    }
  } catch (_) {}

  // 2. Fallback: localizador com RPC e consultas diretas
  const localizacao = await localizarRegistroOrcamento(identificador, token);
  if (!localizacao.ok || !localizacao.row) {
    return {
      ok: false,
      error: localizacao.error || 'Orçamento não encontrado. Verifique o link ou solicite um novo à clínica.',
      code: localizacao.code || 'NOT_FOUND',
      isExpirado: localizacao.isExpirado,
    };
  }

  const row = localizacao.row;
  const snap = (row.assinatura_paciente || {}) as any;
  const parsedConds = parseCondicoesPagamento(row.formas_pagamento, Number(row.total || 0));

  // Tenta carregar dados da clínica
  let clinicaInfo = {
    nome: 'Clínica Odontológica',
    logoUrl: null,
    telefone: null,
    email: null,
    dentistaResponsavel: null,
    cro: null,
  };
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

  // Verifica contrato vinculado
  let contratoLink: string | null = null;
  let contratoIdentificador: string | null = null;
  let contratoStatus: string | null = null;

  const effectiveContratoId = row.contrato_id || snap.contratoId;
  const effectiveContratoToken = row.contrato_token || snap.contratoToken;

  if (effectiveContratoId) {
    try {
      const isDocUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(effectiveContratoId);
      let queryContrato = supabase.from('documentos_clinicos').select('id, itens').eq('tipo', 'contrato');
      if (isDocUuid) {
        queryContrato = queryContrato.or(`id.eq.${effectiveContratoId},itens->>contratoId.eq.${effectiveContratoId}`);
      } else {
        queryContrato = queryContrato.filter('itens->>contratoId', 'eq', effectiveContratoId);
      }
      const { data: docContrato } = await queryContrato.maybeSingle();

      if (docContrato) {
        const snapContrato = docContrato.itens as any;
        contratoIdentificador = snapContrato?.contratoId || docContrato.id;
        contratoStatus = snapContrato?.status || 'pendente';
        const tok = snapContrato?.token || effectiveContratoToken;
        if (tok) {
          const base = obterBaseUrlOficial();
          const slug = slugifyNome(row.paciente_nome || 'paciente');
          contratoLink = `${base}/${slug}/contrato/${contratoIdentificador}?token=${encodeURIComponent(tok)}`;
        }
      }
    } catch (_) {}
  }

  const effectiveFotos = Array.isArray(snap.fotosPlanejamento) ? snap.fotosPlanejamento : [];
  const effectiveSolicitacoes = Array.isArray(snap.solicitacoesAjuste) ? snap.solicitacoesAjuste : [];
  const effectiveHistorico = Array.isArray(snap.historicoVersoes) ? snap.historicoVersoes : [];
  const effectiveCondicao = snap.condicaoEscolhida || (parsedConds.find((c) => c.selecionada) || null);
  const effectiveAprovadoEm = snap.aprovadoEm || row.data_assinatura || null;

  return {
    ok: true,
    orcamento: {
      id: row.id,
      identificador: localizacao.identificador!,
      titulo: row.titulo || 'Plano de tratamento',
      itens: Array.isArray(row.itens) ? row.itens : [],
      subtotal: (Array.isArray(row.itens) ? row.itens : []).reduce(
        (acc: number, it: any) => acc + (Number(it.valor || 0) * Number(it.quantidade || 1)),
        0
      ),
      desconto: Number(row.desconto || 0),
      total: Number(row.total || 0),
      status: (row.status || snap.status || 'enviado') as StatusOrcamento,
      versao: localizacao.versao!,
      solicitacoesAjuste: effectiveSolicitacoes,
      historicoVersoes: effectiveHistorico,
      validade: row.validade,
      observacoes: row.observacoes,
      formasPagamentoRaw: row.formas_pagamento,
      condicoes: parsedConds,
      condicaoEscolhida: effectiveCondicao,
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
}

/**
 * Registra a solicitação de ajuste do orçamento pelo paciente
 * - Valida identificador e token de acesso
 * - Registra motivo, mensagem livre, data e versão atual
 * - Atualiza status para 'ajuste_solicitado'
 * - NÃO permite ao paciente alterar procedimentos ou valores diretamente
 * - Mantém o mesmo link público para futura aprovação da nova proposta
 */
export async function solicitarAjusteOrcamentoPublico(params: {
  identificador: string;
  token: string;
  motivo: string;
  mensagem?: string;
  orcamentoId?: string;
}): Promise<{
  ok: boolean;
  solicitacao?: SolicitacaoAjuste;
  error?: string;
}> {
  const { identificador, token, motivo, mensagem, orcamentoId } = params;

  if (!identificador || !token) {
    return { ok: false, error: 'Identificador e token são obrigatórios.' };
  }
  if (!motivo || !motivo.trim()) {
    return { ok: false, error: 'Selecione o motivo da solicitação de ajuste.' };
  }

  // 1. Tenta Edge Function 'orcamento-publico' (action: 'request_adjustment') com service_role
  try {
    const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('orcamento-publico', {
      body: {
        action: 'request_adjustment',
        identificador: orcamentoId || identificador,
        token: token.trim(),
        motivo: motivo.trim(),
        mensagem: mensagem?.trim() || null,
      },
    });

    if (!edgeErr && edgeData?.ok && edgeData?.solicitacao) {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const keys = [`orcamento_${identificador}`, orcamentoId ? `orcamento_${orcamentoId}` : ''].filter(Boolean);
          for (const k of keys) {
            const prev = window.localStorage.getItem(k);
            if (prev) {
              const parsed = JSON.parse(prev);
              parsed.status = 'ajuste_solicitado';
              parsed.solicitacoesAjuste = [...(parsed.solicitacoesAjuste || []), edgeData.solicitacao];
              window.localStorage.setItem(k, JSON.stringify(parsed));
            }
          }
        } catch (_) {}
      }

      return {
        ok: true,
        solicitacao: edgeData.solicitacao,
      };
    } else if (edgeData && !edgeData.ok && edgeData.error) {
      return { ok: false, error: edgeData.error };
    }
  } catch (_) {}

  // 2. Tenta RPC segura do PostgreSQL
  try {
    const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)('solicitar_ajuste_orcamento_publico', {
      p_identificador: orcamentoId || identificador.trim(),
      p_token: token.trim(),
      p_motivo: motivo.trim(),
      p_mensagem: mensagem?.trim() || null,
    });

    if (!rpcErr && rpcData?.ok) {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const cachedKey = `orcamento_${identificador}`;
          const prev = window.localStorage.getItem(cachedKey);
          if (prev) {
            const parsed = JSON.parse(prev);
            parsed.status = 'ajuste_solicitado';
            parsed.solicitacoesAjuste = [...(parsed.solicitacoesAjuste || []), rpcData.solicitacao];
            window.localStorage.setItem(cachedKey, JSON.stringify(parsed));
          }
        } catch (_) {}
      }

      return {
        ok: true,
        solicitacao: rpcData.solicitacao,
      };
    } else if (rpcData && !rpcData.ok && rpcData.error) {
      return { ok: false, error: rpcData.error };
    }
  } catch (_) {}

  // 2. Serviço centralizado de localização e validação
  const localizacao = await localizarRegistroOrcamento(identificador, token, orcamentoId);
  if (!localizacao.ok || !localizacao.row) {
    return { ok: false, error: localizacao.error || 'Orçamento não encontrado no sistema.' };
  }

  const orc = localizacao.row;
  const uuid = localizacao.uuid || orc.id;
  const snap = (orc.assinatura_paciente || {}) as any;
  const nowIso = new Date().toISOString();

  if (orc.status === 'aprovado' || snap.status === 'aprovado') {
    return { ok: false, error: 'Este orçamento já foi aprovado e não pode receber solicitações de ajuste.' };
  }

  const versaoAtual = Number(localizacao.versao || snap.versao || 1);

  const novaSolicitacao: SolicitacaoAjuste = {
    id: `ajuste-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    orcamentoId: uuid,
    pacienteId: orc.paciente_id,
    pacienteNome: orc.paciente_nome,
    versaoOrcamento: versaoAtual,
    motivo: motivo.trim(),
    mensagem: mensagem?.trim() || undefined,
    solicitadaEm: nowIso,
    atendida: false,
  };

  const solicitacoesExistentes = Array.isArray(snap.solicitacoesAjuste)
    ? snap.solicitacoesAjuste
    : (Array.isArray(orc.solicitacoes_ajuste) ? orc.solicitacoes_ajuste : []);

  const novasSolicitacoes = [...solicitacoesExistentes, novaSolicitacao];

  const updatedAssinatura = {
    ...snap,
    identificador: localizacao.identificador,
    status: 'ajuste_solicitado',
    solicitacoesAjuste: novasSolicitacoes,
  };

  const updPayload: Record<string, any> = {
    status: 'ajuste_solicitado',
    assinatura_paciente: updatedAssinatura,
    atualizado_em: nowIso,
  };

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
  if (isUuid) {
    try {
      const { error: updErr } = await supabase
        .from('orcamentos')
        .update(updPayload)
        .eq('id', uuid);

      if (updErr) {
        console.warn('[OrcamentoEngine] Aviso ao atualizar solicitacao de ajuste:', updErr);
      }
    } catch (e) {
      console.warn('[OrcamentoEngine] Erro ao gravar solicitacao de ajuste:', e);
    }
  }

  // Atualiza cache local
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const keysToUpdate = [
        `orcamento_${localizacao.identificador}`,
        `orcamento_${identificador}`,
        uuid ? `orcamento_${uuid}` : '',
      ].filter(Boolean);

      for (const k of keysToUpdate) {
        const prev = window.localStorage.getItem(k);
        let baseObj: any = {};
        if (prev) {
          try { baseObj = JSON.parse(prev); } catch (_) {}
        }
        const merged = {
          ...baseObj,
          ...orc,
          status: 'ajuste_solicitado',
          solicitacoesAjuste: novasSolicitacoes,
        };
        window.localStorage.setItem(k, JSON.stringify(merged));
      }
    } catch (_) {}
  }

  return {
    ok: true,
    solicitacao: novaSolicitacao,
  };
}

/**
 * Envia uma nova proposta revisada pela clínica para o paciente
 * - Incrementa a versão do orçamento
 * - Preserva histórico completo da versão anterior
 * - Registra quem alterou e data no servidor
 * - Atualiza status para 'nova_proposta_enviada'
 * - Mantém o MESMO link público ativo
 * - Marca solicitações de ajuste anteriores como atendidas
 */
export async function enviarNovaPropostaOrcamento(params: {
  orcamentoId: string;
  novosItens: OrcamentoItem[];
  novoDesconto: number;
  novasFormasPagamento?: string | null;
  usuarioNome?: string;
  motivoAjuste?: string;
}): Promise<{
  ok: boolean;
  novaVersao: number;
  link: string;
  identificador: string;
  error?: string;
}> {
  const { orcamentoId, novosItens, novoDesconto, novasFormasPagamento, usuarioNome, motivoAjuste } = params;

  if (!orcamentoId) {
    return { ok: false, novaVersao: 1, link: '', identificador: '', error: 'ID do orçamento é obrigatório.' };
  }

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orcamentoId);
    let row: any = null;

    if (isUuid) {
      const { data: rows } = await supabase.from('orcamentos').select('*').eq('id', orcamentoId).limit(1);
      row = rows?.[0];
    } else {
      const idUpper = orcamentoId.toUpperCase();
      const { data: rows } = await supabase
        .from('orcamentos')
        .select('*')
        .filter('assinatura_paciente->>identificador', 'eq', idUpper)
        .limit(1);
      row = rows?.[0];
    }

    if (!row) {
      if (typeof window !== 'undefined' && window.localStorage) {
        const cached = window.localStorage.getItem(`orcamento_${orcamentoId}`);
        if (cached) {
          try { row = JSON.parse(cached); } catch (_) {}
        }
      }
    }

    if (!row) {
      return { ok: false, novaVersao: 1, link: '', identificador: '', error: 'Orçamento não encontrado para revisão.' };
    }

    const snap = (row.assinatura_paciente || {}) as any;
    const versaoAtual = Number(snap.versao || row.versao || 1);
    const novaVersao = versaoAtual + 1;
    const nowIso = new Date().toISOString();

    const subtotalNovo = novosItens.reduce(
      (acc, i) => acc + (Number(i.valor || 0) * Number(i.quantidade || 1)),
      0
    );
    const totalNovo = Math.max(0, subtotalNovo - Number(novoDesconto || 0));

    const snapshotVersaoAnterior: VersaoHistoricoOrcamento = {
      versao: versaoAtual,
      titulo: row.titulo,
      subtotal: (row.itens || []).reduce(
        (acc: number, i: any) => acc + (Number(i.valor || 0) * Number(i.quantidade || 1)),
        0
      ),
      desconto: Number(row.desconto || 0),
      total: Number(row.total || 0),
      itens: row.itens || [],
      formasPagamento: row.formas_pagamento || row.formasPagamento,
      alteradaEm: nowIso,
      alteradaPor: usuarioNome || 'Clínica',
      motivoAjuste: motivoAjuste || 'Revisão e envio de nova proposta',
    };

    const historicoExistente = Array.isArray(snap.historicoVersoes) ? snap.historicoVersoes : [];
    const novoHistorico = [...historicoExistente, snapshotVersaoAnterior];

    const solicitacoesExistentes = Array.isArray(snap.solicitacoesAjuste) ? snap.solicitacoesAjuste : [];
    const solicitacoesAtendidas = solicitacoesExistentes.map((s: any) => ({
      ...s,
      atendida: true,
      respondidaEm: nowIso,
      respondidaPor: usuarioNome || 'Clínica',
    }));

    const identificador = snap.identificador || (row.id ? `ORC-${String(row.id).slice(0, 8).toUpperCase()}` : orcamentoId);
    const token = row.token_assinatura || snap.tokenAssinatura || snap.token;

    const updatedAssinatura = {
      ...snap,
      identificador,
      status: 'nova_proposta_enviada',
      versao: novaVersao,
      historicoVersoes: novoHistorico,
      solicitacoesAjuste: solicitacoesAtendidas,
      condicaoEscolhida: null,
      aprovadoEm: null,
      snapshotAprovacao: null,
    };

    const payload: Record<string, any> = {
      itens: novosItens,
      desconto: novoDesconto,
      total: totalNovo,
      formas_pagamento: novasFormasPagamento !== undefined ? novasFormasPagamento : row.formas_pagamento,
      status: 'nova_proposta_enviada',
      assinatura_paciente: updatedAssinatura,
      atualizado_em: nowIso,
    };

    if (row.id && isUuid) {
      await supabase.from('orcamentos').update(payload).eq('id', row.id);
    }

    const link = construirUrlPublicaOrcamento({
      pacienteNome: row.paciente_nome || row.pacienteNome,
      identificador,
      token,
    });

    // Atualiza cache local
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cacheData = {
          ...row,
          ...payload,
          identificador,
          tokenAssinatura: token,
          versao: novaVersao,
          solicitacoesAjuste: solicitacoesAtendidas,
          historicoVersoes: novoHistorico,
          condicaoEscolhida: null,
          aprovadoEm: null,
        };
        window.localStorage.setItem(`orcamento_${identificador}`, JSON.stringify(cacheData));
        if (row.id) {
          window.localStorage.setItem(`orcamento_${row.id}`, JSON.stringify(cacheData));
        }
      } catch (_) {}
    }

    return {
      ok: true,
      novaVersao,
      link,
      identificador,
    };
  } catch (err: any) {
    console.error('[OrcamentoEngine] Erro ao enviar nova proposta:', err);
    return {
      ok: false,
      novaVersao: 1,
      link: '',
      identificador: '',
      error: err?.message || 'Falha ao enviar nova proposta.',
    };
  }
}

/**
 * Registra a aprovação online do orçamento pelo paciente
 * - Bloqueia aprovações duplicadas
 * - Valida se a versão aprovada é a mais recente
 * - Salva snapshot imutável da versão aprovada
 * - Registra data/hora e condição escolhida
 * - Atualiza status no painel administrativo
 * - NÃO lança baixa financeira nem recebimentos automáticos
 */
export async function aprovarOrcamentoPublico(params: {
  identificador: string;
  token: string;
  condicaoEscolhida: CondicaoPagamento;
  versaoAprovada?: number;
  orcamentoId?: string;
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
  const { identificador, token, condicaoEscolhida, versaoAprovada, orcamentoId, evidencias } = params;

  if (!identificador || !token) {
    return { ok: false, error: 'Identificador e token são obrigatórios.' };
  }
  if (!condicaoEscolhida) {
    return { ok: false, error: 'Selecione uma condição de pagamento antes de aprovar.' };
  }

  // 1. Tenta Edge Function 'orcamento-publico' (action: 'approve') com service_role
  try {
    const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('orcamento-publico', {
      body: {
        action: 'approve',
        identificador: orcamentoId || identificador,
        token: token.trim(),
        condicaoEscolhida,
        evidencias: evidencias || {},
        versaoAprovada: versaoAprovada || null,
      },
    });

    if (!edgeErr && edgeData?.ok) {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const keys = [`orcamento_${identificador}`, orcamentoId ? `orcamento_${orcamentoId}` : ''].filter(Boolean);
          for (const k of keys) {
            const prev = window.localStorage.getItem(k);
            if (prev) {
              const parsed = JSON.parse(prev);
              parsed.status = 'aprovado';
              parsed.aprovadoEm = edgeData.aprovadoEm;
              parsed.condicaoEscolhida = condicaoEscolhida;
              window.localStorage.setItem(k, JSON.stringify(parsed));
            }
          }
        } catch (_) {}
      }

      return {
        ok: true,
        aprovadoEm: edgeData.aprovadoEm,
        jaAprovado: edgeData.jaAprovado,
      };
    } else if (edgeData && !edgeData.ok && edgeData.error) {
      return { ok: false, error: edgeData.error };
    }
  } catch (_) {}

  // 2. Tenta RPC segura do PostgreSQL
  try {
    const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)('aprovar_orcamento_publico', {
      p_identificador: orcamentoId || identificador.trim(),
      p_token: token.trim(),
      p_condicao: condicaoEscolhida,
      p_evidencias: evidencias || {},
      p_versao_aprovada: versaoAprovada || null,
    });

    if (!rpcErr && rpcData?.ok) {
      return {
        ok: true,
        aprovadoEm: rpcData.aprovadoEm,
        jaAprovado: rpcData.jaAprovado,
      };
    } else if (rpcData && !rpcData.ok && rpcData.error) {
      return { ok: false, error: rpcData.error };
    }
  } catch (_) {}

  // 2. Serviço centralizado de localização e validação
  const localizacao = await localizarRegistroOrcamento(identificador, token, orcamentoId);
  if (!localizacao.ok || !localizacao.row) {
    return { ok: false, error: localizacao.error || 'Orçamento não encontrado no sistema.' };
  }

  const orc = localizacao.row;
  const uuid = localizacao.uuid || orc.id;
  const snap = (orc.assinatura_paciente || {}) as any;
  const nowIso = new Date().toISOString();

  // Bloqueio de aprovação duplicada
  if (orc.status === 'aprovado' || snap.status === 'aprovado') {
    return {
      ok: true,
      jaAprovado: true,
      aprovadoEm: orc.data_assinatura || snap.aprovadoEm || nowIso,
    };
  }

  const versaoAtual = Number(localizacao.versao || snap.versao || 1);

  // Validação de versão: impede aprovação de versão antiga se a clínica tiver enviado uma nova
  if (versaoAprovada !== undefined && versaoAprovada < versaoAtual) {
    return {
      ok: false,
      error: 'Uma nova proposta foi enviada pela clínica. Por favor, atualize a página para visualizar e aprovar a versão mais recente.',
    };
  }

  const subtotalItens = (orc.itens || []).reduce(
    (acc: number, it: any) => acc + (Number(it.valor || 0) * Number(it.quantidade || 1)),
    0
  );

  let totalFinal = Number(orc.total || 0);
  let descontoFinal = Number(orc.desconto || 0);

  if (typeof condicaoEscolhida.valorTotal === 'number' && condicaoEscolhida.valorTotal > 0) {
    totalFinal = condicaoEscolhida.valorTotal;
    descontoFinal = Math.max(0, Number((subtotalItens - totalFinal).toFixed(2)));
  }

  const snapshot = {
    orcamentoId: uuid,
    identificador: localizacao.identificador,
    versaoAprovada: versaoAtual,
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

  const updatedAssinatura = {
    ...snap,
    identificador: localizacao.identificador,
    status: 'aprovado',
    aprovadoEm: nowIso,
    condicaoEscolhida,
    snapshotAprovacao: snapshot,
    versaoAprovada: versaoAtual,
  };

  const updPayload: Record<string, any> = {
    status: 'aprovado',
    desconto: descontoFinal,
    total: totalFinal,
    data_assinatura: nowIso,
    assinatura_paciente: updatedAssinatura,
    atualizado_em: nowIso,
  };

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
  if (isUuid) {
    try {
      const { error: updErr } = await supabase
        .from('orcamentos')
        .update(updPayload)
        .eq('id', uuid);

      if (updErr) {
        console.warn('[OrcamentoEngine] Aviso ao atualizar aprovacao no banco:', updErr);
      }
    } catch (e) {
      console.warn('[OrcamentoEngine] Erro de rede ao atualizar aprovacao:', e);
    }
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
      const keysToUpdate = [
        `orcamento_${localizacao.identificador}`,
        `orcamento_${identificador}`,
        uuid ? `orcamento_${uuid}` : '',
      ].filter(Boolean);

      for (const k of keysToUpdate) {
        const prev = window.localStorage.getItem(k);
        let baseObj: any = {};
        if (prev) {
          try { baseObj = JSON.parse(prev); } catch (_) {}
        }
        const merged = {
          ...baseObj,
          ...orc,
          status: 'aprovado',
          desconto: descontoFinal,
          total: totalFinal,
          aprovadoEm: nowIso,
          condicaoEscolhida,
          snapshotAprovacao: snapshot,
        };
        window.localStorage.setItem(k, JSON.stringify(merged));
      }
    } catch (_) {}
  }

  return {
    ok: true,
    aprovadoEm: nowIso,
  };
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
      const { data: currentRows } = await supabase.from('orcamentos').select('assinatura_paciente').eq('id', orcamento.id).limit(1);
      const prevSnap = (currentRows?.[0]?.assinatura_paciente || (orcamento as any).assinatura_paciente || {}) as any;
      await supabase
        .from('orcamentos')
        .update({
          assinatura_paciente: {
            ...prevSnap,
            contratoId: resEmissao.identificador,
            contratoToken: resEmissao.token,
          },
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', orcamento.id);
    } catch (e) {
      console.warn('[OrcamentoEngine] Falha ao salvar contrato no orcamento:', e);
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
