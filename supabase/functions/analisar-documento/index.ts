import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY ausente' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => null);
    const imageUrl: string | undefined = body?.imageUrl;
    const nome: string = body?.nome || 'documento';
    const tipo: string = body?.tipo || 'outro';

    if (!imageUrl || typeof imageUrl !== 'string') {
      return new Response(JSON.stringify({ error: 'imageUrl é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = `Você é assistente de uma clínica odontológica. Analise a imagem enviada (arquivo: "${nome}", tipo: "${tipo}").
Responda SOMENTE com um JSON válido, sem markdown, no formato:
{
  "resumo": "resumo clínico objetivo em português (2 a 4 frases)",
  "tipo_detectado": "raio-x | foto intraoral | foto extraoral | exame laboratorial | receita | documento | outro",
  "achados": ["achado relevante 1", "achado relevante 2"],
  "dentes_mencionados": ["11", "36"],
  "recomendacoes": ["sugestão de conduta 1"],
  "texto_extraido": "texto legível encontrado na imagem, se houver"
}
Não invente diagnóstico definitivo; descreva apenas o que é observável e sinalize incertezas.`;

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': apiKey,
        'X-Lovable-AIG-SDK': 'fetch',
      },
      body: JSON.stringify({
        model: 'google/gemini-3.7-flash',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const details = await res.text();
      console.error(`AI gateway falhou [${res.status}]: ${details}`);
      return new Response(JSON.stringify({ error: 'Falha na análise por IA', status: res.status, details }), {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      JSON.stringify({ resumo: dados?.resumo || cleaned, dados }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('analisar-documento erro:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
