import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export interface CertificadoDigital {
  id?: string;
  provedor: string;
  ambiente: string;
  titularNome: string;
  titularCpf: string;
  clientId: string;
  clientSecret: string;
  ativo: boolean;
}

const vazio: CertificadoDigital = {
  provedor: 'safeid',
  ambiente: 'producao',
  titularNome: '',
  titularCpf: '',
  clientId: '',
  clientSecret: '',
  ativo: true,
};

export const useCertificadoDigital = () => {
  const { user, clinicaId } = useAuth();
  const [certificado, setCertificado] = useState<CertificadoDigital>(vazio);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setCertificado(vazio);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('certificados_digitais')
      .select('*')
      .eq('user_id', clinicaId)
      .maybeSingle();
    if (error) console.error('Erro ao carregar certificado digital:', error);
    if (data) {
      setCertificado({
        id: data.id,
        provedor: data.provedor || 'safeid',
        ambiente: data.ambiente || 'producao',
        titularNome: data.titular_nome || '',
        titularCpf: data.titular_cpf || '',
        clientId: data.client_id || '',
        clientSecret: data.client_secret || '',
        ativo: data.ativo ?? true,
      });
    } else {
      setCertificado(vazio);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const salvar = async (dados: CertificadoDigital) => {
    if (!user) return false;
    setSaving(true);
    const payload = {
      user_id: clinicaId,
      provedor: dados.provedor,
      ambiente: dados.ambiente,
      titular_nome: dados.titularNome || null,
      titular_cpf: dados.titularCpf || null,
      client_id: dados.clientId || null,
      client_secret: dados.clientSecret || null,
      ativo: dados.ativo,
    };
    const { error } = await supabase
      .from('certificados_digitais')
      .upsert(payload, { onConflict: 'user_id' });
    setSaving(false);
    if (error) {
      console.error(error);
      toast.error('Erro ao salvar certificado digital');
      return false;
    }
    toast.success('Certificado digital salvo');
    await load();
    return true;
  };

  const remover = async () => {
    if (!user) return;
    const { error } = await supabase.from('certificados_digitais').delete().eq('user_id', clinicaId);
    if (error) {
      toast.error('Erro ao remover certificado');
      return;
    }
    toast.success('Certificado desconectado');
    setCertificado(vazio);
  };

  return { certificado, setCertificado, loading, saving, salvar, remover, reload: load };
};

