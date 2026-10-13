import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    const audioBase64: string | undefined = body?.audioBase64;
    const mimeType: string = body?.mimeType || 'audio/webm';

    // Suporta chave OpenAI vinda do body ou do ambiente
    const openaiKey = (body?.apiKey || Deno.env.get('OPENAI_API_KEY') || '').trim();
    const lovableKey = (Deno.env.get('LOVABLE_API_KEY') || '').trim();

    if (!openaiKey && !lovableKey) {
      return new Response(
        JSON.stringify({
          error:
            'Chave de IA não configurada. Defina OPENAI_API_KEY ou LOVABLE_API_KEY nas variáveis de ambiente.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return new Response(JSON.stringify({ error: 'audioBase64 é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sub = mimeType.split('/')[1] || 'webm';
    const ext = sub === 'mp4' ? 'm4a' : sub;

    // Se temos OpenAI Key, usamos o Whisper da OpenAI (altamente preciso para português)
    if (openaiKey) {
      // Converte Base64 para Uint8Array
      const binaryString = atob(audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: mimeType });
      const formData = new FormData();
      formData.append('file', blob, `audio.${ext}`);
      formData.append('model', 'whisper-1');
      formData.append('language', 'pt');
      formData.append(
        'prompt',
        'Áudio de consulta ou prontuário odontológico. Termos: dentes, canal, restauração, implante, resina.'
      );

      const resWhisper = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
        },
        body: formData,
      });

      if (!resWhisper.ok) {
        const details = await resWhisper.text();
        console.error(`OpenAI Whisper falhou [${resWhisper.status}]: ${details}`);
        return new Response(
          JSON.stringify({ error: 'Falha na transcrição com Whisper', details }),
          { status: resWhisper.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const jsonWhisper = await resWhisper.json();
      const transcribedText = jsonWhisper?.text || '';

      return new Response(
        JSON.stringify({ text: transcribedText.trim(), provider: 'openai_whisper' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fallback: Gateway Lovable
    const prompt =
      'Você é um assistente de uma clínica odontológica. Transcreva o áudio a seguir para texto em português do Brasil. ' +
      'Preserve termos técnicos odontológicos e formate o texto em parágrafos curtos. ' +
      'Responda SOMENTE com o texto transcrito, sem markdown e sem comentários.';

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': lovableKey,
        'X-Lovable-AIG-SDK': 'fetch',
      },
      body: JSON.stringify({
        model: 'google/gemini-3.7-flash',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'input_audio', input_audio: { data: audioBase64, format: ext } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const details = await res.text();
      console.error(`AI gateway falhou [${res.status}]: ${details}`);
      return new Response(
        JSON.stringify({ error: 'Falha na transcrição', status: res.status, details }),
        { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const json = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? '';

    return new Response(JSON.stringify({ text: text.trim(), provider: 'lovable_gemini' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('transcrever-audio erro:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
