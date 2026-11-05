/**
 * Utilitários para detecção e formatação inteligente de CPF e CNPJ
 */

/**
 * Valida rigorosamente um CPF calculando os dois dígitos verificadores (módulo 11).
 */
export const validarCPF = (cpf?: string | null): boolean => {
  if (!cpf) return false;
  const str = String(cpf).trim();
  // Bloqueia e-mails ou caracteres alfanuméricos inadequados
  if (/@|[a-zA-Z]/.test(str)) return false;
  const digits = str.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  // Bloqueia sequências repetidas (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(digits)) return false;

  // Primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(digits.charAt(i), 10) * (10 - i);
  }
  let resto = 11 - (soma % 11);
  let dv1 = (resto === 10 || resto === 11) ? 0 : resto;
  if (dv1 !== parseInt(digits.charAt(9), 10)) return false;

  // Segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(digits.charAt(i), 10) * (11 - i);
  }
  resto = 11 - (soma % 11);
  let dv2 = (resto === 10 || resto === 11) ? 0 : resto;
  return dv2 === parseInt(digits.charAt(10), 10);
};

/**
 * Valida rigorosamente um CNPJ calculando os dois dígitos verificadores (módulo 11).
 */
export const validarCNPJ = (cnpj?: string | null): boolean => {
  if (!cnpj) return false;
  const str = String(cnpj).trim();
  // Bloqueia e-mails ou caracteres alfanuméricos inadequados
  if (/@|[a-zA-Z]/.test(str)) return false;
  const digits = str.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  // Bloqueia sequências repetidas
  if (/^(\d)\1{13}$/.test(digits)) return false;

  // Primeiro dígito verificador (pesos: 5,4,3,2,9,8,7,6,5,4,3,2)
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma = 0;
  for (let i = 0; i < 12; i++) {
    soma += parseInt(digits.charAt(i), 10) * pesos1[i];
  }
  let resto = soma % 11;
  let dv1 = resto < 2 ? 0 : 11 - resto;
  if (dv1 !== parseInt(digits.charAt(12), 10)) return false;

  // Segundo dígito verificador (pesos: 6,5,4,3,2,9,8,7,6,5,4,3,2)
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  soma = 0;
  for (let i = 0; i < 13; i++) {
    soma += parseInt(digits.charAt(i), 10) * pesos2[i];
  }
  resto = soma % 11;
  let dv2 = resto < 2 ? 0 : 11 - resto;
  return dv2 === parseInt(digits.charAt(13), 10);
};

/**
 * Validação abrangente de documento (CPF ou CNPJ) com diagnóstico descritivo.
 */
export const validarDocumento = (
  doc?: string | null,
  tipoEsperado?: 'cpf' | 'cnpj'
): {
  valido: boolean;
  tipoDetectado: 'cpf' | 'cnpj' | 'invalido';
  erro?: string;
} => {
  if (!doc || !String(doc).trim()) {
    return { valido: false, tipoDetectado: 'invalido', erro: 'Documento não informado.' };
  }
  const str = String(doc).trim();
  if (str.includes('@')) {
    return {
      valido: false,
      tipoDetectado: 'invalido',
      erro: 'E-mail inserido no campo de documento. Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.',
    };
  }
  const digits = str.replace(/\D/g, '');
  if (digits.length === 11) {
    const ok = validarCPF(digits);
    if (!ok) {
      return { valido: false, tipoDetectado: 'cpf', erro: 'CPF inválido: os dígitos verificadores não conferem.' };
    }
    if (tipoEsperado === 'cnpj') {
      return {
        valido: false,
        tipoDetectado: 'cpf',
        erro: 'Documento informado é um CPF, mas a clínica foi configurada como Pessoa Jurídica (CNPJ de 14 dígitos esperado).',
      };
    }
    return { valido: true, tipoDetectado: 'cpf' };
  }

  if (digits.length === 14) {
    const ok = validarCNPJ(digits);
    if (!ok) {
      return { valido: false, tipoDetectado: 'cnpj', erro: 'CNPJ inválido: os dígitos verificadores não conferem.' };
    }
    if (tipoEsperado === 'cpf') {
      return {
        valido: false,
        tipoDetectado: 'cnpj',
        erro: 'Documento informado é um CNPJ, mas o profissional foi configurado como Pessoa Física (CPF de 11 dígitos esperado).',
      };
    }
    return { valido: true, tipoDetectado: 'cnpj' };
  }

  return {
    valido: false,
    tipoDetectado: 'invalido',
    erro: `Documento com quantidade de dígitos inválida (${digits.length} dígitos encontrados). Um CPF possui 11 dígitos e um CNPJ possui 14 dígitos.`,
  };
};

/**
 * Identifica se um documento é CPF (11 dígitos ou menos) ou CNPJ (14 dígitos).
 */
export const identificarTipoDocumento = (doc?: string | null): 'cpf' | 'cnpj' => {
  if (!doc) return 'cnpj';
  const limpo = String(doc).replace(/\D/g, '');
  if (limpo.length > 0 && limpo.length <= 11) return 'cpf';
  return 'cnpj';
};

/**
 * Retorna o rótulo adequado para exibição ('CPF', 'CPF/MF' ou 'CNPJ').
 */
export const obterRotuloDocumento = (doc?: string | null, incluirMF: boolean = false): string => {
  const tipo = identificarTipoDocumento(doc);
  if (tipo === 'cpf') {
    return incluirMF ? 'CPF/MF' : 'CPF';
  }
  return 'CNPJ';
};

/**
 * Formata um CPF ou CNPJ de acordo com a quantidade de dígitos numéricos.
 */
export const formatarDocumento = (value?: string | null): string => {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

/**
 * Adiciona meses a uma data de forma matematicamente segura,
 * impedindo o clássico 'mês rollover' do JavaScript (ex: 31 de Outubro + 1 mês virar 1º de Dezembro, pulando Novembro).
 */
export const somarMesesSeguro = (dataBase: Date, meses: number, diaFixo?: number): Date => {
  const ano = dataBase.getFullYear();
  const mesAlvo = dataBase.getMonth() + meses;
  const diaOriginal = diaFixo ?? dataBase.getDate();
  const primeiroDia = new Date(ano, mesAlvo, 1, 12, 0, 0);
  const maxDiasNoMes = new Date(primeiroDia.getFullYear(), primeiroDia.getMonth() + 1, 0).getDate();
  primeiroDia.setDate(Math.min(diaOriginal, maxDiasNoMes));
  return primeiroDia;
};

/**
 * Verifica se um campo textual tem conteúdo informativo real (não vazio e diferente de 'Não informado').
 */
export const temValorValido = (val?: string | null): boolean => {
  if (!val) return false;
  const s = String(val).trim().toLowerCase();
  return (
    s !== '' &&
    s !== 'não informado' &&
    s !== 'nao informado' &&
    s !== 'não informada' &&
    s !== 'nao informada' &&
    s !== 'null' &&
    s !== 'undefined'
  );
};

/**
 * Formata um endereço completo a partir de uma string ou objeto com campos
 * (logradouro, número, complemento, bairro, cidade, estado, CEP).
 * Nunca inventa dados ausentes.
 */
export const formatarEnderecoCompleto = (input?: any): string => {
  if (!input) return '';
  if (typeof input === 'string') {
    const s = input.trim();
    if (!temValorValido(s)) return '';
    if (s.startsWith('{') && s.endsWith('}')) {
      try {
        return formatarEnderecoCompleto(JSON.parse(s));
      } catch (_) {}
    }
    return s;
  }

  if (typeof input !== 'object') return '';

  const logradouro = (input.logradouro || input.rua || input.logr || '').trim();
  const numero = (input.numero || input.num || '').trim();
  const complemento = (input.complemento || input.compl || '').trim();
  const bairro = (input.bairro || input.bair || '').trim();
  const cidade = (input.cidade || input.municipio || '').trim();
  const estado = (input.estado || input.uf || '').trim();
  const cep = (input.cep || '').trim();

  // Se já possui um campo endereco de texto completo e não possui campos estruturados avulsos
  if (input.endereco && typeof input.endereco === 'string' && !logradouro && !numero && !bairro) {
    return formatarEnderecoCompleto(input.endereco);
  }

  const partes: string[] = [];
  if (logradouro) {
    partes.push(numero ? `${logradouro}, nº ${numero}` : logradouro);
  } else if (numero) {
    partes.push(`nº ${numero}`);
  }

  if (complemento) {
    partes.push(complemento);
  }

  if (bairro) {
    partes.push(`Bairro ${bairro.replace(/^bairro\s*/i, '')}`);
  }

  if (cidade || estado) {
    const cidEst = [cidade, estado].filter(Boolean).join(' - ');
    partes.push(cidEst);
  }

  if (cep) {
    const cepLimpo = cep.replace(/\D/g, '');
    const cepFmt = cepLimpo.length === 8 ? `${cepLimpo.slice(0, 5)}-${cepLimpo.slice(5)}` : cep;
    partes.push(`CEP ${cepFmt.replace(/^CEP\s*/i, '')}`);
  }

  return partes.join(', ');
};

/**
 * Formata um número de telefone/WhatsApp em formato legível brasileiro.
 */
export const formatarTelefone = (v?: string | null): string => {
  if (!v || !temValorValido(v)) return '';
  const digits = String(v).replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return String(v).trim();
};
