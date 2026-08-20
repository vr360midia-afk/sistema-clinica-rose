import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export type DocumentoClinicoTipo = 'prescricao' | 'atestado';

export interface DocumentoClinicoItem {
  nome: string;
  posologia?: string;
  quantidade?: string;
}

export interface DocumentoClinico {
  id: string;
  pacienteId?: string | null;
  pacienteNome?: string | null;
  tipo: DocumentoClinicoTipo;
  titulo: string;
  conteudo?: string | null;
  itens: DocumentoClinicoItem[];
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
}

const rowToDoc = (row: any): DocumentoClinico => ({
  id: row.id,
  pacienteId: row.paciente_id,
  pacienteNome: row.paciente_nome,
  tipo: row.tipo,
  titulo: row.titulo,
  conteudo: row.conteudo,
  itens: Array.isArray(row.itens) ? row.itens : [],
  diasAfastamento: row.dias_afastamento,
  cid: row.cid,
  dentista: row.dentista,
  assinaturaId: row.assinatura_id,
  assinaturaData: row.assinatura_data,
  assinanteNome: row.assinante_nome,
  assinadoEm: row.assinado_em ? new Date(row.assinado_em) : null,
  cfoLinkValidacao: row.cfo_link_validacao ?? null,
  cfoCodigoValidacao: row.cfo_codigo_validacao ?? null,
  cfoEmitidoEm: row.cfo_emitido_em ? new Date(row.cfo_emitido_em) : null,
  criadoEm: new Date(row.criado_em),
});

export const useDocumentosClinicos = (pacienteId?: string) => {
  const { user } = useAuth();
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
    if (pacienteId) query = query.eq('paciente_id', pacienteId);
    const { data, error } = await query;
    if (error) console.error('Erro ao carregar documentos clínicos:', error);
    setDocumentos((data || []).map(rowToDoc));
    setLoading(false);
  }, [user, pacienteId]);

  useEffect(() => {
    load();
  }, [load]);

  const salvarDocumento = async (doc: Partial<DocumentoClinico>) => {
    if (!user) return null;
    const payload = {
      user_id: user.id,
      paciente_id: doc.pacienteId ?? pacienteId ?? null,
      paciente_nome: doc.pacienteNome ?? null,
      tipo: doc.tipo || 'prescricao',
      titulo: doc.titulo || (doc.tipo === 'atestado' ? 'Atestado odontológico' : 'Prescrição odontológica'),
      conteudo: doc.conteudo || null,
      itens: (doc.itens || []) as never,
      dias_afastamento: doc.diasAfastamento ?? null,
      cid: doc.cid || null,
      dentista: doc.dentista || null,
    };

    const { data, error } = doc.id
      ? await supabase.from('documentos_clinicos').update(payload).eq('id', doc.id).select().single()
      : await supabase.from('documentos_clinicos').insert(payload).select().single();

    if (error) {
      console.error(error);
      toast.error('Erro ao salvar documento');
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

  const deleteDocumento = async (id: string) => {
    const { error } = await supabase.from('documentos_clinicos').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao remover documento');
      return;
    }
    toast.success('Documento removido');
    await load();
  };

  return { documentos, loading, salvarDocumento, registrarAssinatura, deleteDocumento, reload: load };
};
