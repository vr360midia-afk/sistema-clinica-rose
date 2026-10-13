import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    const fileUrl: string | undefined = body?.fileUrl ?? body?.imageUrl;
    const nome: string = body?.nome || 'documento';
    const tipo: string = body?.tipo || 'outro';

    // Suporta chave OpenAI vinda do body ou do ambiente
    const openaiKey = (body?.apiKey || Deno.env.get('OPENAI_API_KEY') || '').trim();
    const lovableKey = (Deno.env.get('LOVABLE_API_KEY') || '').trim();

    if (!openaiKey && !lovableKey) {
      return new Response(
        JSON.stringify({
          error:
            'Chave de IA não configurada. Defina OPENAI_API_KEY ou LOVABLE_API_KEY nas variáveis de ambiente ou passe apiKey.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!fileUrl || typeof fileUrl !== 'string') {
      return new Response(JSON.stringify({ error: 'fileUrl ou imageUrl é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = `Você é assistente de uma clínica odontológica. Analise o arquivo enviado (arquivo: "${nome}", tipo informado: "${tipo}").
Responda SOMENTE com um JSON válido, sem markdown, no formato:
{
  "resumo": "resumo clínico objetivo em português (2 a 4 frases)",
  "tipo_detectado": "raio-x | foto intraoral | foto extraoral | exame laboratorial | receita | atestado | documento | outro",
  "achados": ["achado relevante 1", "achado relevante 2"],
  "dentes_mencionados": ["11", "36"],
  "recomendacoes": ["sugestão de conduta 1"],
  "texto_extraido": "texto legível encontrado, se houver",
  "queixa_principal": "queixa/resumo em linguagem de prontuário",
  "historia_doenca": "história da doença relevante, se identificável",
  "exame_clinico": "descrição dos achados do exame/imagem",
  "diagnostico": "diagnóstico clínico ou hipótese",
  "plano_tratamento": "plano/recomendações de tratamento",
  "observacoes": "observações adicionais"
}
Não invente diagnóstico definitivo; descreva apenas o que é observável e sinalize incertezas.`;

    // Baixa o arquivo e converte para base64
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) {
      console.error(`Falha ao baixar arquivo [${fileRes.status}]`);
      return new Response(
        JSON.stringify({ error: 'Falha ao baixar arquivo para análise' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const buf = new Uint8Array(await fileRes.arrayBuffer());
    if (buf.byteLength === 0) {
      return new Response(
        JSON.stringify({ error: 'Arquivo vazio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mime = fileRes.headers.get('content-type')?.split(';')[0] || 'application/octet-stream';

    let binary = '';
    for (let i = 0; i < buf.length; i += 8192) {
      binary += String.fromCharCode(...buf.subarray(i, i + 8192));
    }
    const b64 = btoa(binary);

    let contentBlock: any;
    if (mime.startsWith('image/')) {
      contentBlock = { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } };
    } else if (mime === 'application/pdf') {
      contentBlock = {
        type: 'file',
        file: { filename: nome, file_data: `data:application/pdf;base64,${b64}` },
      };
    } else {
      return new Response(
        JSON.stringify({ error: `Tipo de arquivo não suportado: ${mime}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Chamada à OpenAI (ChatGPT) ou fallback para Lovable
    const endpoint = openaiKey
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://ai.gateway.lovable.dev/v1/chat/completions';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (openaiKey) {
      headers['Authorization'] = `Bearer ${openaiKey}`;
    } else {
      headers['Lovable-API-Key'] = lovableKey;
      headers['X-Lovable-AIG-SDK'] = 'fetch';
    }

    const model = openaiKey ? (body?.model || 'gpt-4o-mini') : 'google/gemini-3.7-flash';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              contentBlock,
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const details = await res.text();
      console.error(`AI gateway falhou [${res.status}]: ${details}`);
      return new Response(
        JSON.stringify({ error: 'Falha na análise por IA', status: res.status, details }),
        { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const json = await res.json();
    const raw: string = json?.choices?.[0]?.message?.content ?? '';
    const cleaned = raw.replace(/```json|```/g, '').trim();

    let dados: any = null;
    try {
      dados = JSON.parse(cleaned);
    } catch {
      dados = { resumo: cleaned };
    }

    return new Response(
      JSON.stringify({ resumo: dados?.resumo || cleaned, dados, model_used: model }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('analisar-documento erro:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
