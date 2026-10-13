import { supabase } from '@/integrations/supabase/client';

export interface CrmRespostaSugestao {
  tipo: 'agendamento' | 'acolhimento' | 'followup' | string;
  titulo: string;
  texto: string;
}

export interface CrmAnaliseIa {
  temperatura?: 'Quente' | 'Morno' | 'Frio';
  interesse?: string;
  resumo?: string;
  sugestoes?: CrmRespostaSugestao[];
}

export interface TestarKeyResult {
  success: boolean;
  message?: string;
  error?: string;
  model?: string;
}

/**
 * Testa se a chave de API da OpenAI é válida e tem conectividade.
 */
export async function testarOpenAiKey(apiKey: string, model = 'gpt-4o-mini'): Promise<TestarKeyResult> {
  const trimmed = (apiKey || '').trim();
  if (!trimmed) {
    return { success: false, error: 'Chave de API não informada.' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('chatgpt-ia', {
      body: {
        action: 'test',
        apiKey: trimmed,
        model,
      },
    });

    if (error) {
      return { success: false, error: error.message || 'Falha ao testar conexão com o ChatGPT' };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return {
      success: true,
      message: data?.message || 'Conexão com a OpenAI validada com sucesso!',
      model: data?.model || model,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro inesperado na chamada do teste.' };
  }
}

/**
 * Gera sugestões automáticas e humanizadas para WhatsApp através do ChatGPT (GPT-4o-mini).
 */
export async function sugerirRespostasCrm(params: {
  lead: any;
  messages: any[];
  apiKey?: string;
  model?: string;
  systemPrompt?: string;
}): Promise<CrmAnaliseIa> {
  const { lead, messages, apiKey, model = 'gpt-4o-mini', systemPrompt } = params;

  try {
    const { data, error } = await supabase.functions.invoke('chatgpt-ia', {
      body: {
        action: 'sugerir_resposta_crm',
        lead,
        messages,
        apiKey,
        model,
        systemPrompt,
      },
    });

    if (error) {
      throw new Error(error.message || 'Erro na Edge Function chatgpt-ia');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return {
      temperatura: data.temperatura || 'Morno',
      interesse: data.interesse || 'Tratamento Odontológico',
      resumo: data.resumo || '',
      sugestoes: data.sugestoes || [],
    };
  } catch (err: any) {
    console.error('Erro ao sugerir respostas com ChatGPT:', err);
    throw err;
  }
}

/**
 * Qualifica o lead com base na conversa, extraindo probabilidade, objeções e próxima ação.
 */
export async function qualificarLeadCrm(params: {
  lead: any;
  messages: any[];
  apiKey?: string;
  model?: string;
}) {
  const { lead, messages, apiKey, model = 'gpt-4o-mini' } = params;

  try {
    const { data, error } = await supabase.functions.invoke('chatgpt-ia', {
      body: {
        action: 'qualificar_lead',
        lead,
        messages,
        apiKey,
        model,
      },
    });

    if (error) throw error;
    return data;
  } catch (err: any) {
    console.error('Erro ao qualificar lead:', err);
    throw err;
  }
}
