import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function capitalizarNome(nome: string): string {
  const minusculas = ['de', 'da', 'do', 'das', 'dos', 'e'];
  return (nome || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((palavra, index) => {
      if (index > 0 && minusculas.includes(palavra)) return palavra;
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    })
    .join(' ');
}

function normalizar(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function parsearComando(texto: string, defaultPhone?: string) {
  const resultado: {
    nome: string;
    telefone?: string;
    cpf?: string;
    dataNascimento?: string;
    queixaPrincipal?: string;
    comandoValido: boolean;
  } = {
    nome: '',
    comandoValido: false,
  };

  if (!texto) return resultado;

  const linhas = texto.split('\n').map((l) => l.trim()).filter(Boolean);
  let achouRotulo = false;

  for (const linha of linhas) {
    if (/^(?:nome|paciente)[:\s]+/i.test(linha)) {
      resultado.nome = linha.replace(/^(?:nome|paciente)[:\s]+/i, '').trim();
      achouRotulo = true;
    } else if (/^(?:tel|telefone|cel|celular|whatsapp)[:\s]+/i.test(linha)) {
      resultado.telefone = linha.replace(/^(?:tel|telefone|cel|celular|whatsapp)[:\s]+/i, '').trim();
      achouRotulo = true;
    } else if (/^(?:cpf)[:\s]+/i.test(linha)) {
      resultado.cpf = linha.replace(/^(?:cpf)[:\s]+/i, '').trim();
      achouRotulo = true;
    } else if (/^(?:nasc|nascimento|data de nascimento)[:\s]+/i.test(linha)) {
      resultado.dataNascimento = linha.replace(/^(?:nasc|nascimento|data de nascimento)[:\s]+/i, '').trim();
      achouRotulo = true;
    } else if (/^(?:queixa|motivo|obs|observacao)[:\s]+/i.test(linha)) {
      resultado.queixaPrincipal = linha.replace(/^(?:queixa|motivo|obs|observacao)[:\s]+/i, '').trim();
      achouRotulo = true;
    }
  }

  if (!achouRotulo) {
    let corpo = texto;
    corpo = corpo.replace(/^(?:#paciente|#ficha|!paciente|\/paciente|#cadastro)\s*/i, '');
    corpo = corpo.replace(/^(?:cadastrar paciente|criar ficha|novo paciente|adicionar paciente|ficha paciente|criar paciente)[:\s]*/i, '');
    corpo = corpo.trim();

    const partes = corpo.split(/[,;|]/).map((p) => p.trim()).filter(Boolean);
    if (partes.length > 0) {
      resultado.nome = partes[0];
      for (let i = 1; i < partes.length; i++) {
        const parte = partes[i];
        const digitos = parte.replace(/\D/g, '');
        if (digitos.length === 11 && (parte.includes('.') || parte.includes('-') || !resultado.cpf)) {
          if (!resultado.telefone && digitos.length === 11 && digitos.charAt(2) === '9' && !parte.includes('.')) {
            resultado.telefone = parte;
          } else if (!resultado.cpf) {
            resultado.cpf = parte;
          }
        } else if (digitos.length >= 8 && digitos.length <= 13 && !resultado.telefone) {
          resultado.telefone = parte;
        } else if (/\d{2}[/.-]\d{2}[/.-]\d{4}/.test(parte) && !resultado.dataNascimento) {
          resultado.dataNascimento = parte;
        } else if (!resultado.queixaPrincipal) {
          resultado.queixaPrincipal = parte;
        }
      }
    }
  }

  if (resultado.nome) {
    resultado.nome = capitalizarNome(resultado.nome.replace(/[#*!_]/g, '').trim());
  }
  if (!resultado.telefone && defaultPhone) {
    resultado.telefone = defaultPhone;
  }
  if (resultado.nome && resultado.nome.length >= 2 && !/^(novo|paciente|ficha|cadastro)$/i.test(resultado.nome)) {
    resultado.comandoValido = true;
  }

  return resultado;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Permite GET para conferir status e webhook handshake
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const challenge = url.searchParams.get('hub.challenge');
    if (challenge) {
      return new Response(challenge, { status: 200 });
    }
    return jsonResponse({
      servico: 'WhatsApp Comando Criar Paciente',
      status: 'ativo',
      exemplos: [
        '#paciente Mariana Costa, (82) 99999-8888, 123.456.789-00',
        '#ficha Carlos Eduardo | 82988887777',
      ],
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405);
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const contentType = req.headers.get('content-type') || '';
    let rawText = '';
    let senderPhone = '';

    // Trata Form URL Encoded (Twilio) ou JSON (Meta, Evolution API, Z-API, Custom)
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData();
      rawText = String(form.get('Body') || '');
      senderPhone = String(form.get('From') || '').replace(/\D/g, '');
    } else {
      const body = await req.json().catch(() => ({}));
      // Evolution API: body.data.message.conversation
      // Z-API: body.text.message
      // Direct: body.texto || body.message || body.comando
      rawText =
        body.texto ||
        body.message ||
        body.comando ||
        body.body ||
        body?.data?.message?.conversation ||
        body?.text?.message ||
        body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body ||
        '';

      senderPhone =
        body.sender ||
        body.from ||
        body.phone ||
        body?.data?.key?.remoteJid?.replace(/\D/g, '') ||
        body?.phone ||
        body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from ||
        '';
    }

    if (!rawText.trim()) {
      return jsonResponse({ error: 'Nenhum texto recebido' }, 400);
    }

    // Identifica se é comando de paciente
    const norm = normalizar(rawText);
    const ehComando =
      norm.startsWith('#paciente') ||
      norm.startsWith('#ficha') ||
      norm.startsWith('!paciente') ||
      norm.startsWith('/paciente') ||
      norm.startsWith('cadastrar paciente') ||
      norm.startsWith('criar ficha') ||
      norm.startsWith('novo paciente');

    if (!ehComando) {
      return jsonResponse({
        isCommand: false,
        message: 'Texto recebido não é um comando de criação de ficha. Use #paciente Nome, Telefone, CPF',
      });
    }

    const dados = parsearComando(rawText, senderPhone);
    if (!dados.comandoValido || !dados.nome) {
      const msgErro =
        '⚠️ Não foi possível identificar o nome do paciente.\n\nEnvie no formato:\n*#paciente Nome Completo, (82) 99999-9999, CPF*';
      return jsonResponse({ success: false, erro: 'Nome inválido', respostaWhatsApp: msgErro });
    }

    // Busca o user_id da clínica padrão
    const { data: configs } = await supabase
      .from('configuracoes')
      .select('user_id, nome_clinica, whatsapp_numero')
      .limit(1);

    const userId = configs?.[0]?.user_id || null;

    // 1. Verifica se já existe paciente com este telefone ou CPF ou nome exato
    let pacienteExistente: any = null;
    const query = supabase.from('pacientes').select('*');
    if (userId) query.eq('user_id', userId);

    const { data: listaPacientes } = await query;

    if (listaPacientes && listaPacientes.length > 0) {
      if (dados.cpf) {
        const cpfDigitos = dados.cpf.replace(/\D/g, '');
        pacienteExistente = listaPacientes.find(
          (p: any) => (p.cpf || '').replace(/\D/g, '') === cpfDigitos
        );
      }
      if (!pacienteExistente && dados.telefone) {
        const telDigitos = dados.telefone.replace(/\D/g, '').slice(-8);
        pacienteExistente = listaPacientes.find(
          (p: any) => (p.telefone || '').replace(/\D/g, '').slice(-8) === telDigitos
        );
      }
      if (!pacienteExistente) {
        const nomeNorm = normalizar(dados.nome);
        pacienteExistente = listaPacientes.find(
          (p: any) => normalizar(p.nome) === nomeNorm
        );
      }
    }

    let pacienteId: string;
    let jaExistia = false;

    if (pacienteExistente) {
      pacienteId = pacienteExistente.id;
      jaExistia = true;
    } else {
      // 2. Insere novo paciente
      const { data: novo, error: errNovo } = await supabase
        .from('pacientes')
        .insert([
          {
            user_id: userId,
            nome: dados.nome,
            telefone: dados.telefone || null,
            cpf: dados.cpf || null,
            convenio: 'Particular',
            status: 'Ativo',
            origem_lead: 'whatsapp',
            observacoes: dados.queixaPrincipal
              ? `Queixa: ${dados.queixaPrincipal} (Criado via WhatsApp)`
              : 'Criado via comando no WhatsApp',
          },
        ])
        .select()
        .single();

      if (errNovo || !novo) {
        console.error('Erro ao cadastrar paciente:', errNovo);
        return jsonResponse({ error: 'Erro ao salvar paciente no banco', details: errNovo }, 500);
      }

      pacienteId = novo.id;
    }

    // 3. Cria token e registro de Anamnese para o paciente
    const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const originApp = 'https://app.lentesemresinamaceio.com.br';
    const linkAnamnese = `${originApp}/anamnese/assinar/${pacienteId}?token=${token}&modo=preencher`;

    if (!jaExistia) {
      await supabase.from('anamneses').insert([
        {
          user_id: userId,
          paciente_id: pacienteId,
          data: new Date().toISOString(),
          queixa_principal: dados.queixaPrincipal || 'Avaliação Odontológica',
          token_assinatura: token,
          link_assinatura: linkAnamnese,
          status_assinatura: 'pendente',
          respostas: {},
        },
      ]);
    }

    // 4. Monta a resposta formatada para o WhatsApp
    const respostaWhatsApp = jaExistia
      ? [
          `⚠️ *Paciente Já Cadastrado na Clínica!*`,
          ``,
          `👤 *Nome:* ${dados.nome}`,
          dados.telefone ? `📱 *Telefone:* ${dados.telefone}` : null,
          `📋 *Status:* Ficha já existente no sistema`,
          ``,
          `🔗 *Link da Anamnese:*\n${linkAnamnese}`,
        ]
          .filter(Boolean)
          .join('\n')
      : [
          `✅ *Ficha de Paciente Criada com Sucesso!*`,
          ``,
          `👤 *Paciente:* ${dados.nome}`,
          dados.telefone ? `📱 *Telefone:* ${dados.telefone}` : null,
          dados.cpf ? `🆔 *CPF:* ${dados.cpf}` : null,
          `📋 *Prontuário:* Ativo na plataforma`,
          ``,
          `🔗 *Link da Anamnese Digital:*\n${linkAnamnese}`,
          ``,
          `_Você pode encaminhar o link acima para o paciente preencher no celular._`,
        ]
          .filter(Boolean)
          .join('\n');

    return jsonResponse({
      success: true,
      jaExistia,
      paciente: {
        id: pacienteId,
        nome: dados.nome,
        telefone: dados.telefone,
        cpf: dados.cpf,
      },
      linkAnamnese,
      respostaWhatsApp,
    });
  } catch (err: any) {
    console.error('Erro na função whatsapp-comando-paciente:', err);
    return jsonResponse({ error: err.message || 'Erro interno' }, 500);
  }
});
