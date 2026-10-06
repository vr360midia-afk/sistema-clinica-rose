import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface ConfiguracoesGerais {
  nomeClinica: string;
  logoUrl: string;
  cnpj: string;
  endereco: string;
  telefone: string;
  whatsappNumero: string;
  email: string;
  emailNotificacoes: boolean;
  whatsappLembretes: boolean;
  lembrete24h: boolean;
  lembrete2h: boolean;
  backupAutomatico: boolean;
  frequenciaBackup: string;
}

export const defaultConfiguracoes: ConfiguracoesGerais = {
  nomeClinica: '',
  logoUrl: '',
  cnpj: '',
  endereco: '',
  telefone: '',
  whatsappNumero: '',
  email: '',
  emailNotificacoes: true,
  whatsappLembretes: true,
  lembrete24h: true,
  lembrete2h: true,
  backupAutomatico: true,
  frequenciaBackup: 'diario',
};

export const useConfiguracoes = () => {
  const { user, clinicaId } = useAuth();
  const { toast } = useToast();
  const [configuracoes, setConfiguracoes] = useState<ConfiguracoesGerais>(defaultConfiguracoes);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfiguracoes = useCallback(async () => {
    if (!clinicaId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('configuracoes')
      .select('*')
      .eq('user_id', clinicaId)
      .maybeSingle();

    if (error) {
      toast({ title: 'Erro ao carregar configurações', description: error.message, variant: 'destructive' });
    } else if (data) {
      setConfiguracoes({
        nomeClinica: data.nome_clinica || '',
        logoUrl: (data as any).logo_url || '',
        cnpj: data.cnpj || '',
        endereco: data.endereco || '',
        telefone: data.telefone || '',
        whatsappNumero: (data as any).whatsapp_numero || '',
        email: data.email || '',
        emailNotificacoes: data.email_notificacoes,
        whatsappLembretes: data.whatsapp_lembretes,
        lembrete24h: data.lembrete_24h,
        lembrete2h: data.lembrete_2h,
        backupAutomatico: data.backup_automatico,
        frequenciaBackup: data.frequencia_backup || 'diario',
      });
    }
    setLoading(false);
  }, [clinicaId, toast]);

  useEffect(() => {
    fetchConfiguracoes();
  }, [fetchConfiguracoes]);

  const saveConfiguracoes = async (values: ConfiguracoesGerais) => {
    if (!clinicaId) {
      toast({ title: 'Erro', description: 'ID da clínica não encontrado', variant: 'destructive' });
      return false;
    }
    setSaving(true);
    const { error } = await supabase
      .from('configuracoes')
      .upsert(
        {
          user_id: clinicaId,
          nome_clinica: values.nomeClinica,
          logo_url: values.logoUrl || null,
          cnpj: values.cnpj,
          endereco: values.endereco,
          telefone: values.telefone,
          whatsapp_numero: values.whatsappNumero || null,
          email: values.email,
          email_notificacoes: values.emailNotificacoes,
          whatsapp_lembretes: values.whatsappLembretes,
          lembrete_24h: values.lembrete24h,
          lembrete_2h: values.lembrete2h,
          backup_automatico: values.backupAutomatico,
          frequencia_backup: values.frequenciaBackup,
        },
        { onConflict: 'user_id' }
      );
    setSaving(false);

    if (error) {
      toast({ title: 'Erro ao salvar configurações', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Configurações salvas!', description: 'Suas preferências foram atualizadas.' });
    await fetchConfiguracoes();
    return true;
  };

  return { configuracoes, setConfiguracoes, loading, saving, saveConfiguracoes, refetch: fetchConfiguracoes };
};

