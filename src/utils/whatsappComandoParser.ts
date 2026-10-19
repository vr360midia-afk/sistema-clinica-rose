/**
 * Utilitário de parsing de comandos de WhatsApp para criação de fichas de pacientes.
 */

export interface DadosPacienteComando {
  nome: string;
  telefone?: string;
  cpf?: string;
  dataNascimento?: string;
  queixaPrincipal?: string;
  observacoes?: string;
  convenio?: string;
  comandoValido: boolean;
  mensagemOriginal: string;
}

/**
 * Remove acentos e normaliza para minúsculas
 */
function normalizar(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Formata nome para padrão Title Case (ex: "maria silva" -> "Maria Silva")
 */
export function capitalizarNome(nome: string): string {
  const minusculas = ['de', 'da', 'do', 'das', 'dos', 'e'];
  return nome
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((palavra, index) => {
      if (index > 0 && minusculas.includes(palavra)) return palavra;
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    })
    .join(' ');
}

/**
 * Detecta se uma mensagem do WhatsApp é uma instrução para criar ficha de paciente
 */
export function ehComandoCriarPaciente(texto: string): boolean {
  if (!texto || typeof texto !== 'string') return false;
  const t = normalizar(texto);

  // Prefixos explícitos
  if (t.startsWith('#paciente') || t.startsWith('#ficha') || t.startsWith('!paciente') || t.startsWith('/paciente') || t.startsWith('#cadastro')) {
    return true;
  }

  // Frases de comando
  if (
    t.startsWith('cadastrar paciente') ||
    t.startsWith('criar ficha') ||
    t.startsWith('novo paciente') ||
    t.startsWith('adicionar paciente') ||
    t.startsWith('ficha paciente') ||
    t.startsWith('criar paciente')
  ) {
    return true;
  }

  return false;
}

/**
 * Faz o parse da mensagem do WhatsApp e extrai os campos do paciente
 */
export function parsearComandoWhatsApp(texto: string, defaultPhone?: string): DadosPacienteComando {
  const resultado: DadosPacienteComando = {
    nome: '',
    comandoValido: false,
    mensagemOriginal: texto,
  };

  if (!texto) return resultado;

  const linhas = texto.split('\n').map((l) => l.trim()).filter(Boolean);

  // 1. TENTA FORMATO CHAVE: VALOR EM MÚLTIPLAS LINHAS
  // Exemplo:
  // #paciente
  // Nome: Maria Silva
  // Telefone: 82999998888
  // CPF: 12345678900
  let achouCamposRotulados = false;
  for (const linha of linhas) {
    const limpa = normalizar(linha);
    if (/^(?:nome|paciente)[:\s]+/i.test(linha)) {
      resultado.nome = linha.replace(/^(?:nome|paciente)[:\s]+/i, '').trim();
      achouCamposRotulados = true;
    } else if (/^(?:tel|telefone|cel|celular|whatsapp)[:\s]+/i.test(linha)) {
      resultado.telefone = linha.replace(/^(?:tel|telefone|cel|celular|whatsapp)[:\s]+/i, '').trim();
      achouCamposRotulados = true;
    } else if (/^(?:cpf)[:\s]+/i.test(linha)) {
      resultado.cpf = linha.replace(/^(?:cpf)[:\s]+/i, '').trim();
      achouCamposRotulados = true;
    } else if (/^(?:nasc|nascimento|data de nascimento)[:\s]+/i.test(linha)) {
      resultado.dataNascimento = linha.replace(/^(?:nasc|nascimento|data de nascimento)[:\s]+/i, '').trim();
      achouCamposRotulados = true;
    } else if (/^(?:queixa|motivo|obs|observacao)[:\s]+/i.test(linha)) {
      resultado.queixaPrincipal = linha.replace(/^(?:queixa|motivo|obs|observacao)[:\s]+/i, '').trim();
      achouCamposRotulados = true;
    }
  }

  // 2. SE NÃO ACHOU ROTULADO, PROCESSA FORMATO LINHA ÚNICA OU SEPARADO POR VÍRGULA/PIPE
  // Exemplo: "#paciente Maria Silva, 82999998888, 12345678900"
  // Exemplo: "cadastrar paciente: João Santos | 82988887777"
  if (!achouCamposRotulados) {
    let corpo = texto;

    // Remove o comando inicial
    corpo = corpo.replace(/^(?:#paciente|#ficha|!paciente|\/paciente|#cadastro)\s*/i, '');
    corpo = corpo.replace(/^(?:cadastrar paciente|criar ficha|novo paciente|adicionar paciente|ficha paciente|criar paciente)[:\s]*/i, '');
    corpo = corpo.trim();

    // Divide por vírgula, ponto e vírgula ou pipe
    const partes = corpo.split(/[,;|]/).map((p) => p.trim()).filter(Boolean);

    if (partes.length > 0) {
      resultado.nome = partes[0];

      // Procura outros campos nas partes seguintes
      for (let i = 1; i < partes.length; i++) {
        const parte = partes[i];
        const digitos = parte.replace(/\D/g, '');

        // CPF (11 dígitos)
        if (digitos.length === 11 && (parte.includes('.') || parte.includes('-') || !resultado.cpf)) {
          // Se parece telefone celular com DDD (ex: 82999998888), distingue pelo 9º dígito
          if (!resultado.telefone && digitos.length === 11 && digitos.charAt(2) === '9' && !parte.includes('.')) {
            resultado.telefone = parte;
          } else if (!resultado.cpf) {
            resultado.cpf = parte;
          }
        }
        // Telefone (10 ou 11 dígitos, ou com parênteses)
        else if (digitos.length >= 8 && digitos.length <= 13 && !resultado.telefone) {
          resultado.telefone = parte;
        }
        // Data de nascimento (contém barras)
        else if (/\d{2}[/.-]\d{2}[/.-]\d{4}/.test(parte) && !resultado.dataNascimento) {
          resultado.dataNascimento = parte;
        }
        // Observações / Queixa
        else if (!resultado.queixaPrincipal) {
          resultado.queixaPrincipal = parte;
        }
      }
    }
  }

  // 3. LIMPEZA E FORMATACÃO DOS CAMPOS
  if (resultado.nome) {
    resultado.nome = capitalizarNome(resultado.nome.replace(/[#*!_]/g, '').trim());
  }

  // Se não foi informado telefone no comando, mas temos o telefone de quem enviou
  if (!resultado.telefone && defaultPhone) {
    resultado.telefone = defaultPhone;
  }

  // Validação: precisa de nome com pelo menos 2 caracteres válidos
  if (resultado.nome && resultado.nome.length >= 2 && !/^(novo|paciente|ficha|cadastro)$/i.test(resultado.nome)) {
    resultado.comandoValido = true;
  }

  return resultado;
}

/**
 * Gera mensagem de resposta padrão para ser enviada no WhatsApp após a criação da ficha
 */
export function gerarRespostaSucessoWhatsApp(params: {
  nome: string;
  telefone?: string;
  cpf?: string;
  pacienteId: string;
  linkAnamnese?: string;
  jaExistia?: boolean;
}): string {
  const { nome, telefone, cpf, pacienteId, linkAnamnese, jaExistia } = params;

  if (jaExistia) {
    return [
      `⚠️ *Paciente Já Cadastrado na Clínica!*`,
      ``,
      `👤 *Nome:* ${nome}`,
      telefone ? `📱 *Telefone:* ${telefone}` : null,
      cpf ? `🆔 *CPF:* ${cpf}` : null,
      `📋 *Ficha:* Já ativa no sistema (ID: ${pacienteId.slice(0, 8)})`,
      ``,
      linkAnamnese ? `🔗 *Link para Assinar Anamnese:*\n${linkAnamnese}` : null,
    ].filter(Boolean).join('\n');
  }

  return [
    `✅ *Ficha de Paciente Criada com Sucesso!*`,
    ``,
    `👤 *Paciente:* ${nome}`,
    telefone ? `📱 *Telefone:* ${telefone}` : null,
    cpf ? `🆔 *CPF:* ${cpf}` : null,
    `📋 *Prontuário:* Ativo na plataforma`,
    ``,
    linkAnamnese
      ? `🔗 *Link da Anamnese Digital:*\n${linkAnamnese}\n\n_Envie este link para o paciente preencher ou assinar no celular._`
      : `_Ficha cadastrada e disponível no menu Pacientes._`,
  ].filter(Boolean).join('\n');
}

/**
 * Gera mensagem de ajuda com exemplos de comandos para o WhatsApp
 */
export function gerarMensagemAjudaComandos(): string {
  return [
    `📋 *Como Criar Fichas de Pacientes pelo WhatsApp:*`,
    ``,
    `Envie uma mensagem em qualquer um dos formatos abaixo:`,
    ``,
    `🔹 *Formato Rápido (em 1 linha):*`,
    `#paciente Mariana Costa, (82) 99999-8888, 123.456.789-00`,
    ``,
    `🔹 *Formato em Linhas Separadas:*`,
    `#paciente`,
    `Nome: Carlos Eduardo`,
    `Telefone: (82) 98888-7777`,
    `CPF: 123.456.789-00`,
    `Queixa: Avaliação de lentes`,
    ``,
    `🔹 *Comandos aceitos:* \`#paciente\`, \`#ficha\`, \`cadastrar paciente:\`, \`novo paciente:\``,
  ].join('\n');
}
