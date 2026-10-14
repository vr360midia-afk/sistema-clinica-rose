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
 * Traduz erros comuns da OpenAI em mensagens amigáveis em português
 */
function traduzirErroOpenAi(status: number, message: string): string {
  if (status === 401 || message.includes('Incorrect API key') || message.includes('invalid_api_key')) {
    return 'Chave de API inválida ou revogada. Verifique se copiou a chave sk-... completa da OpenAI.';
  }
  if (status === 429 || message.includes('quota') || message.includes('insufficient_quota')) {
    return 'Saldo insuficiente ou limite de uso atingido na sua conta da OpenAI (Verifique seu plano/créditos em platform.openai.com).';
  }
  if (status === 404 || message.includes('model')) {
    return `O modelo especificado não está disponível para esta conta da OpenAI (${message}).`;
  }
  return message || `Erro na comunicação com a OpenAI (Status: ${status})`;
}

/**
 * Testa se a chave de API da OpenAI é válida e tem conectividade.
 * Tenta via Edge Function primeiro; caso a Edge Function não esteja deployada no Supabase,
 * realiza a validação direta na API oficial da OpenAI.
 */
export async function testarOpenAiKey(apiKey: string, model = 'gpt-4o-mini'): Promise<TestarKeyResult> {
  const trimmed = (apiKey || '').trim();
  if (!trimmed) {
    return { success: false, error: 'Chave de API não informada.' };
  }

  // 1. Tenta validar via Supabase Edge Function
  try {
    const { data, error } = await supabase.functions.invoke('chatgpt-ia', {
      body: {
        action: 'test',
        apiKey: trimmed,
        model,
      },
    });

    if (!error && data) {
      if (data.error) {
        return { success: false, error: data.error };
      }
      return {
        success: true,
        message: data?.message || `Conexão com a OpenAI validada com sucesso (${model})!`,
        model: data?.model || model,
      };
    }
  } catch (edgeErr) {
    console.warn('[ChatGPT Service] Edge Function não acessível no Supabase, executando teste direto com a OpenAI...', edgeErr);
  }

  // 2. Fallback direto à API oficial da OpenAI (quando a Edge Function não está implantada)
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${trimmed}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Diga apenas: OK' }],
        max_tokens: 5,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const rawMsg = errJson?.error?.message || '';
      return {
        success: false,
        error: traduzirErroOpenAi(res.status, rawMsg),
      };
    }

    return {
      success: true,
      message: `Conexão com a OpenAI validada com sucesso (${model})!`,
      model,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Não foi possível conectar aos servidores da OpenAI.',
    };
  }
}

/**
 * Gera sugestões automáticas e humanizadas para WhatsApp através do ChatGPT (GPT-4o-mini).
 * Funciona com a Edge Function ou diretamente com a OpenAI API Key informada nas configurações.
 */
export async function sugerirRespostasCrm(params: {
  lead: any;
  messages: any[];
  apiKey?: string;
  model?: string;
  systemPrompt?: string;
}): Promise<CrmAnaliseIa> {
  const { lead, messages, apiKey, model = 'gpt-4o-mini', systemPrompt } = params;
  const keyToUse = (apiKey || '').trim();

  // 1. Tenta via Edge Function do Supabase
  try {
    const { data, error } = await supabase.functions.invoke('chatgpt-ia', {
      body: {
        action: 'sugerir_resposta_crm',
        lead,
        messages,
        apiKey: keyToUse,
        model,
        systemPrompt,
      },
    });

    if (!error && data && !data.error) {
      return {
        temperatura: data.temperatura || 'Morno',
        interesse: data.interesse || 'Tratamento Odontológico',
        resumo: data.resumo || '',
        sugestoes: data.sugestoes || [],
      };
    }
  } catch (edgeErr) {
    console.warn('[ChatGPT Service] Edge Function falhou, utilizando conexão direta com a OpenAI...', edgeErr);
  }

  // 2. Fallback direto caso a Edge Function não esteja deployada no Supabase
  if (!keyToUse) {
    throw new Error('Chave de API da OpenAI não configurada. Acesse Configurações > APIs para salvar sua chave sk-...');
  }

  return await executarSugestaoDiretaOpenAi({
    lead,
    messages,
    apiKey: keyToUse,
    model,
    systemPrompt,
  });
}

/**
 * Executa a geração de sugestões do CRM via chamada direta à OpenAI
 */
async function executarSugestaoDiretaOpenAi(params: {
  lead: any;
  messages: any[];
  apiKey: string;
  model: string;
  systemPrompt?: string;
}): Promise<CrmAnaliseIa> {
  const { lead, messages, apiKey, model, systemPrompt } = params;

  const nomeLead = lead?.name || lead?.nome || 'Paciente';
  const stageLead = lead?.stage || lead?.status || 'novo_lead';
  const telefoneLead = lead?.phone || lead?.telefone || '';
  const origemLead = lead?.origin || lead?.origem || 'WhatsApp';
  const obsLead = lead?.observacoes || '';

  const historicoFormatado =
    Array.isArray(messages) && messages.length > 0
      ? messages
          .slice(-15)
          .map((m: any) => {
            const remetente = m.direction === 'in' ? `${nomeLead} (Paciente)` : 'Clínica (Atendente)';
            return `[${remetente}]: ${m.body}`;
          })
          .join('\n')
      : 'Nenhuma mensagem trocada ainda.';

  const baseSystemPrompt =
    systemPrompt ||
    `Você é uma assistente executiva sênior de atendimento e concierge de uma clínica odontológica de alto padrão da Dra. Rosangela Santos, localizada em Maceió-AL.
Seu objetivo é encantar o paciente, transmitir segurança, autoridade e acolhimento, e conduzi-lo de forma natural para o agendamento de uma consulta de avaliação presencial.
Não dê orçamentos fechados sem consulta prévia, mas valorize o tratamento personalizado e os diferenciais da clínica.
Use um tom profissional, amigável, humanizado (com emojis moderados e elegantes), sem parecer um robô.`;

  const userPrompt = `Analise o perfil do lead e o histórico da conversa abaixo e gere sugestões inteligentes de resposta no WhatsApp:

---
DADOS DO LEAD:
- Nome: ${nomeLead}
- Telefone: ${telefoneLead}
- Etapa no Kanban: ${stageLead}
- Origem: ${origemLead}
${obsLead ? `- Observações: ${obsLead}` : ''}

HISTÓRICO DA CONVERSA:
${historicoFormatado}
---

RESPONDA EXCLUSIVAMENTE COM UM JSON VÁLIDO (sem blocos markdown adicionais ou texto fora do JSON) no seguinte formato:
{
  "temperatura": "Quente | Morno | Frio",
  "interesse": "breve descrição do interesse ou procedimento do paciente (ex: Implantes, Clareamento, Dúvida de horário)",
  "resumo": "resumo de 1 frase sobre o momento do paciente na negociação",
  "sugestoes": [
    {
      "tipo": "agendamento",
      "titulo": "📅 Agendamento de Consulta",
      "texto": "texto completo e pronto da mensagem para convidar ou confirmar data/hora com o paciente"
    },
    {
      "tipo": "acolhimento",
      "titulo": "💬 Dúvidas & Acolhimento",
      "texto": "texto completo focado em responder dúvidas, passar calma e segurança"
    },
    {
      "tipo": "followup",
      "titulo": "🔄 Reativação / Follow-up",
      "texto": "texto completo suave para reatar a conversa se o paciente demorou a responder"
    }
  ]
}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        { role: 'system', content: baseSystemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    const rawMsg = errJson?.error?.message || '';
    throw new Error(traduzirErroOpenAi(res.status, rawMsg));
  }

  const resJson = await res.json();
  const rawContent = resJson?.choices?.[0]?.message?.content || '{}';
  const cleanContent = rawContent.replace(/```json|```/g, '').trim();

  try {
    const parsed = JSON.parse(cleanContent);
    return {
      temperatura: parsed.temperatura || 'Morno',
      interesse: parsed.interesse || 'Tratamento Odontológico',
      resumo: parsed.resumo || '',
      sugestoes: parsed.sugestoes || [],
    };
  } catch {
    return {
      temperatura: 'Morno',
      interesse: 'Atendimento Odontológico',
      resumo: 'Interesse identificado na conversa.',
      sugestoes: [
        {
          tipo: 'acolhimento',
          titulo: '💬 Resposta Sugerida',
          texto: rawContent.slice(0, 300),
        },
      ],
    };
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
  const keyToUse = (apiKey || '').trim();

  try {
    const { data, error } = await supabase.functions.invoke('chatgpt-ia', {
      body: {
        action: 'qualificar_lead',
        lead,
        messages,
        apiKey: keyToUse,
        model,
      },
    });

    if (!error && data) return data;
  } catch (edgeErr) {
    console.warn('[ChatGPT Service] Edge Function falhou ao qualificar lead, tentando conexão direta...', edgeErr);
  }

  if (!keyToUse) {
    throw new Error('Chave de API da OpenAI não informada.');
  }

  const nomeLead = lead?.name || lead?.nome || 'Paciente';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${keyToUse}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em qualificação de leads odontológicos. Responda em JSON válido.',
        },
        {
          role: 'user',
          content: `Qualifique o lead ${nomeLead}. Responda em JSON no formato: { "temperatura": "Quente | Morno | Frio", "interesse": "...", "score": 75 }`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    const rawMsg = errJson?.error?.message || '';
    throw new Error(traduzirErroOpenAi(res.status, rawMsg));
  }

  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content || '{}';
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    return { temperatura: 'Morno', score: 50 };
  }
}
