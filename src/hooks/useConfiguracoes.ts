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
  geminiApiKey: string;
  openaiApiKey: string;
  openaiModel: string;
  openaiSystemPrompt: string;
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
  geminiApiKey: '',
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  openaiSystemPrompt: '',
};

// Armazenamento local de contingência para chaves de IA caso o banco não tenha as colunas migradas
const getLocalAiConfig = (clinicaId: string): Record<string, string> | null => {
  try {
    const raw = localStorage.getItem(`config_ia_${clinicaId}`);
    return raw ? (JSON.parse(raw) as Record<string, string>) : null;
  } catch {
    return null;
  }
};

const setLocalAiConfig = (
  clinicaId: string,
  values: {
    openaiApiKey?: string;
    openaiModel?: string;
    openaiSystemPrompt?: string;
    geminiApiKey?: string;
  }
) => {
  try {
    localStorage.setItem(`config_ia_${clinicaId}`, JSON.stringify(values));
  } catch (e) {
    console.error('Erro ao salvar IA no localStorage:', e);
  }
};

export const useConfiguracoes = () => {
  const { clinicaId } = useAuth();
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

    const localAi = getLocalAiConfig(clinicaId) || {};

    if (error) {
      toast({ title: 'Erro ao carregar configurações', description: error.message, variant: 'destructive' });
    } else if (data) {
      const row = data as Record<string, unknown>;
      setConfiguracoes({
        nomeClinica: (row.nome_clinica as string) || '',
        logoUrl: (row.logo_url as string) || '',
        cnpj: (row.cnpj as string) || '',
        endereco: (row.endereco as string) || '',
        telefone: (row.telefone as string) || '',
        whatsappNumero: (row.whatsapp_numero as string) || '',
        email: (row.email as string) || '',
        emailNotificacoes: Boolean(row.email_notificacoes),
        whatsappLembretes: Boolean(row.whatsapp_lembretes),
        lembrete24h: Boolean(row.lembrete_24h),
        lembrete2h: Boolean(row.lembrete_2h),
        backupAutomatico: Boolean(row.backup_automatico),
        frequenciaBackup: (row.frequencia_backup as string) || 'diario',
        geminiApiKey: (row.gemini_api_key as string) || localAi.geminiApiKey || '',
        openaiApiKey: (row.openai_api_key as string) || localAi.openaiApiKey || '',
        openaiModel: (row.openai_model as string) || localAi.openaiModel || 'gpt-4o-mini',
        openaiSystemPrompt: (row.openai_system_prompt as string) || localAi.openaiSystemPrompt || '',
      });
    } else {
      if (localAi.openaiApiKey || localAi.geminiApiKey) {
        setConfiguracoes((prev) => ({
          ...prev,
          geminiApiKey: localAi.geminiApiKey || '',
          openaiApiKey: localAi.openaiApiKey || '',
          openaiModel: localAi.openaiModel || 'gpt-4o-mini',
          openaiSystemPrompt: localAi.openaiSystemPrompt || '',
        }));
      }
    }
    setLoading(false);
  }, [clinicaId, toast]);

  useEffect(() => {
    fetchConfiguracoes();
  }, [fetchConfiguracoes]);

  const saveConfiguracoes = async (values: ConfiguracoesGerais) => {
    try {
      if (!clinicaId) {
        toast({ title: 'Erro', description: 'ID da clínica não encontrado', variant: 'destructive' });
        return false;
      }
      setSaving(true);

      // Sempre persiste configurações de IA localmente como contingência
      setLocalAiConfig(clinicaId, {
        openaiApiKey: values.openaiApiKey,
        openaiModel: values.openaiModel,
        openaiSystemPrompt: values.openaiSystemPrompt,
        geminiApiKey: values.geminiApiKey,
      });

      // Monta o payload inicial completo
      const payload: Record<string, unknown> = {
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
        gemini_api_key: values.geminiApiKey || null,
        openai_api_key: values.openaiApiKey || null,
        openai_model: values.openaiModel || 'gpt-4o-mini',
        openai_system_prompt: values.openaiSystemPrompt || null,
      };

      let saveError: { message?: string } | null = null;
      let tentativas = 0;

      // Loop resiliente: caso o banco retorne que uma coluna não existe no schema cache, remove e tenta novamente
      while (tentativas < 5) {
        tentativas++;
        const { error } = await supabase
          .from('configuracoes')
          .upsert(payload as never, { onConflict: 'user_id' });

        if (!error) {
          saveError = null;
          break;
        }

        saveError = error;
        const msg = error.message || '';

        // Detecta coluna ausente no schema cache
        const match = msg.match(/'([^']+)' column/i) || msg.match(/column ["']?([^"'\s]+)["']?/i);
        const missingCol = match ? match[1] : null;

        if (missingCol && missingCol in payload) {
          console.warn(`Coluna '${missingCol}' não encontrada no banco. Removendo do payload e tentando salvar novamente.`);
          delete payload[missingCol];
          continue;
        }

        // Se falhou por colunas e o regex não pegou o nome exato, remove todas as de IA conhecidas
        const aiCols = ['openai_api_key', 'openai_model', 'openai_system_prompt', 'gemini_api_key'];
        let strippedAny = false;
        aiCols.forEach((col) => {
          if (col in payload) {
            delete payload[col];
            strippedAny = true;
          }
        });

        if (strippedAny) {
          continue;
        }

        // Outro erro qualquer (permissão, rede, etc.)
        break;
      }

      setSaving(false);

      if (saveError) {
        toast({ title: 'Erro ao salvar configurações', description: saveError.message || 'Erro desconhecido', variant: 'destructive' });
        return false;
      }

      toast({ title: 'Configurações salvas!', description: 'Suas preferências foram atualizadas com sucesso.' });
      setConfiguracoes(values);
      return true;
    } catch (err: unknown) {
      setSaving(false);
      const errMsg = err instanceof Error ? err.message : String(err);
      toast({ title: 'Erro inesperado', description: errMsg, variant: 'destructive' });
      return false;
    }
  };

  return { configuracoes, setConfiguracoes, loading, saving, saveConfiguracoes, refetch: fetchConfiguracoes };
};
