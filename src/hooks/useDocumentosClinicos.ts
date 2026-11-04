import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export type DocumentoClinicoTipo = 'prescricao' | 'atestado' | 'contrato';

export interface DocumentoClinicoItem {
  nome: string;
  posologia?: string;
  quantidade?: string;
  [key: string]: any;
}

export interface DocumentoClinico {
  id: string;
  pacienteId?: string | null;
  pacienteNome?: string | null;
  tipo: DocumentoClinicoTipo;
  titulo: string;
  conteudo?: string | null;
  itens: any;
  orcamentoId?: string | null;
  contratoId?: string | null;
  identificador?: string | null;
  status?: string | null;
  pdfPath?: string | null;
  diasAfastamento?: number | null;
  cid?: string | null;
  dentista?: string | null;
  assinaturaId?: string | null;
  assinaturaData?: string | null;
  assinanteNome?: string | null;
  assinadoEm?: Date | null;
  cfoLinkValidacao?: string | null;
  cfoCodigoValidacao?: string | null;
  cfoEmitidoEm?: Date | null;
  criadoEm: Date;
  /** Versionamento de contratos (itens.versao / itens.contratoAnteriorId) */
  versao?: number;
  contratoAnteriorId?: string | null;
  /** Versões anteriores (históricas e imutáveis) da versão vigente, da mais recente para a mais antiga */
  versoesAnteriores?: DocumentoClinico[];
}

const parseJsonField = (field: any) => {
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch (_) {
      return field;
    }
  }
  return field;
};

const rowToDoc = (row: any): DocumentoClinico => {
  const parsedItens = parseJsonField(row.itens);
  const snap = (parsedItens && typeof parsedItens === 'object') ? parsedItens : {};
  return {
    id: row.id,
    pacienteId: row.paciente_id || snap.pacienteId,
    pacienteNome: row.paciente_nome || snap.pacienteNome || snap.paciente?.nome,
    tipo: row.tipo,
    titulo: row.titulo,
    conteudo: row.conteudo,
    itens: parsedItens || [],
    orcamentoId: row.orcamento_id || snap.orcamentoId || null,
    contratoId: snap.contratoId || (row.tipo === 'contrato' ? row.id : null),
    identificador: snap.contratoId || row.identificador || (row.tipo === 'contrato' ? row.id : null),
    status: row.status || snap.status || null,
    pdfPath: row.pdf_path || snap.pdfPath || null,
    diasAfastamento: row.dias_afastamento,
    cid: row.cid,
    dentista: row.dentista || snap.clinica?.dentistaResponsavel,
    assinaturaId: row.assinatura_id,
    assinaturaData: row.assinatura_data,
    assinanteNome: row.assinante_nome,
    assinadoEm: row.assinado_em
      ? new Date(row.assinado_em)
      : (snap.assinaturaPaciente?.dataHora ? new Date(snap.assinaturaPaciente.dataHora) : null),
    cfoLinkValidacao: row.cfo_link_validacao ?? null,
    cfoCodigoValidacao: row.cfo_codigo_validacao ?? null,
    cfoEmitidoEm: row.cfo_emitido_em ? new Date(row.cfo_emitido_em) : null,
    criadoEm: new Date(row.criado_em),
    versao: Number(snap.versao) || 1,
    contratoAnteriorId: row.tipo === 'contrato' ? (snap.contratoAnteriorId || null) : null,
  };
};

/**
 * Agrupa as versões de contratos: retorna somente a versão VIGENTE de cada cadeia
 * (a que não foi substituída por outra via itens.contratoAnteriorId) e anexa as versões
 * anteriores em `versoesAnteriores`, preservadas como histórico identificável.
 */
export const agruparVersoesContrato = (docs: DocumentoClinico[]): DocumentoClinico[] => {
  const porId = new Map(docs.map((d) => [d.id, d]));
  const substituidos = new Set(
    docs.filter((d) => d.tipo === 'contrato' && d.contratoAnteriorId).map((d) => String(d.contratoAnteriorId))
  );
  return docs
    .filter((d) => !(d.tipo === 'contrato' && substituidos.has(d.id)))
    .map((d) => {
      if (d.tipo !== 'contrato' || !d.contratoAnteriorId) return d;
      const anteriores: DocumentoClinico[] = [];
      let ant = porId.get(String(d.contratoAnteriorId));
      const vistos = new Set<string>([d.id]);
      while (ant && !vistos.has(ant.id)) {
        vistos.add(ant.id);
        anteriores.push(ant);
        ant = ant.contratoAnteriorId ? porId.get(String(ant.contratoAnteriorId)) : undefined;
      }
      return { ...d, versoesAnteriores: anteriores };
    });
};

const isUuid = (val: unknown): val is string =>
  typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

export const useDocumentosClinicos = (pacienteId?: string) => {
  const { user, clinicaId } = useAuth();
  const [documentos, setDocumentos] = useState<DocumentoClinico[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setDocumentos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let query = supabase.from('documentos_clinicos').select('*').order('criado_em', { ascending: false });
    if (pacienteId) {
      if (isUuid(pacienteId)) {
        // Se for UUID, busca tanto pela chave relacional quanto pelo JSON de contingência
        query = query.or(`paciente_id.eq.${pacienteId},itens->>pacienteId.eq.${pacienteId}`);
      } else {
        // Se for ID legado/texto, busca exclusivamente no JSON para evitar erro 22P02 do PostgreSQL
        query = query.filter('itens->>pacienteId', 'eq', pacienteId);
      }
    }
    const { data, error } = await query;
    if (error) console.error('Erro ao carregar documentos clínicos:', error);
    setDocumentos(agruparVersoesContrato((data || []).map(rowToDoc)));
    setLoading(false);
  }, [user, pacienteId]);

  useEffect(() => {
    load();
  }, [load]);

  const salvarDocumento = async (doc: Partial<DocumentoClinico>) => {
    if (!user) return null;
    const rawPacienteId = doc.pacienteId ?? pacienteId ?? null;
    const safePacienteId = isUuid(rawPacienteId) ? rawPacienteId : null;
    const effectiveUserId = clinicaId || user.id;

    // Preserva pacienteId dentro do payload JSON de itens caso não seja UUID nativo
    let safeItens: any = doc.itens || [];
    if (rawPacienteId && !Array.isArray(safeItens) && typeof safeItens === 'object') {
      safeItens = { ...safeItens, pacienteId: rawPacienteId };
    }

    const payload: any = {
      user_id: effectiveUserId,
      paciente_id: safePacienteId,
      paciente_nome: doc.pacienteNome ?? null,
      tipo: doc.tipo || 'prescricao',
      titulo: doc.titulo || (doc.tipo === 'atestado' ? 'Atestado odontológico' : doc.tipo === 'contrato' ? 'Contrato de prestação de serviços' : 'Prescrição odontológica'),
      conteudo: doc.conteudo || null,
      itens: safeItens as never,
      dias_afastamento: doc.diasAfastamento ?? null,
      cid: doc.cid || null,
      dentista: doc.dentista || null,
    };

    let { data, error } = doc.id
      ? await supabase.from('documentos_clinicos').update(payload).eq('id', doc.id).select().single()
      : await supabase.from('documentos_clinicos').insert(payload).select().single();

    // Se falhou por violação de RLS (42501) com clinica_id, tenta novamente usando user.id direto da sessão
    if (error && (error.code === '42501' || error.message?.includes('policy')) && effectiveUserId !== user.id) {
      console.warn('[useDocumentosClinicos] RLS falhou com clinica_id, tentando com user.id da sessão...', error);
      const retryPayload = { ...payload, user_id: user.id };
      const retry = await supabase.from('documentos_clinicos').insert(retryPayload).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('[useDocumentosClinicos] Erro ao salvar documento:', error);
      toast.error('Erro ao salvar documento: ' + (error.message || 'Verifique a conexão'));
      return null;
    }
    toast.success('Documento salvo');
    await load();
    return rowToDoc(data);
  };

  const registrarAssinatura = async (
    id: string,
    params: { assinaturaData: string; assinanteNome: string; assinaturaId?: string | null }
  ) => {
    const { error } = await supabase
      .from('documentos_clinicos')
      .update({
        assinatura_data: params.assinaturaData,
        assinante_nome: params.assinanteNome,
        assinatura_id: params.assinaturaId || null,
        assinado_em: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) {
      console.error(error);
      toast.error('Erro ao salvar assinatura');
      return false;
    }
    toast.success('Documento assinado digitalmente');
    await load();
    return true;
  };

  const registrarCfo = async (
    id: string,
    params: { link?: string | null; codigo?: string | null }
  ) => {
    const { error } = await supabase
      .from('documentos_clinicos')
      .update({
        cfo_link_validacao: params.link || null,
        cfo_codigo_validacao: params.codigo || null,
        cfo_emitido_em: params.link || params.codigo ? new Date().toISOString() : null,
      })
      .eq('id', id);
    if (error) {
      console.error(error);
      toast.error('Erro ao salvar dados do CFO');
      return false;
    }
    toast.success('Prescrição do CFO vinculada ao documento');
    await load();
    return true;
  };

  const deleteDocumento = async (id: string) => {
    const { error } = await supabase.from('documentos_clinicos').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao remover documento');
      return;
    }
    toast.success('Documento removido');
    await load();
  };

  return { documentos, loading, salvarDocumento, registrarAssinatura, registrarCfo, deleteDocumento, reload: load };
};

