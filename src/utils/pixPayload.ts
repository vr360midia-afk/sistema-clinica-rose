/**
 * Utilitário Oficial para Geração de Payload PIX (BR Code / EMV)
 * Especificação do Banco Central do Brasil (Bacen)
 * 
 * Permite gerar códigos PIX Copia e Cola e QR Codes que já abrem
 * diretamente no aplicativo do banco (Nubank, Itaú, Bradesco, Inter, Santander, etc.)
 * com o VALOR PREENCHIDO AUTOMATICAMENTE e o favorecido identificado.
 */

export interface PixPayloadOptions {
  chave: string;
  tipoChave?: 'telefone' | 'cnpj' | 'cpf' | 'email' | 'aleatoria' | string;
  nomeFavorecido?: string;
  cidade?: string;
  valor?: number | string;
  txId?: string;
  descricao?: string;
}

/**
 * Normaliza strings para o padrão EMV (sem acentos e caracteres especiais)
 */
const removerAcentos = (str: string): string => {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s.,-]/g, '')
    .trim();
};

/**
 * Formata campo TLV (Tag-Length-Value)
 */
const formatarTLV = (id: string, valor: string): string => {
  const tamanho = valor.length.toString().padStart(2, '0');
  return `${id}${tamanho}${valor}`;
};

/**
 * Cálculo do Checksum CRC16-CCITT (Polinômio 0x1021, valor inicial 0xFFFF)
 * Exigido pelo padrão EMV do Banco Central do Brasil
 */
export const calcularCRC16 = (payload: string): string => {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

/**
 * Limpa e formata a chave PIX de acordo com as regras do Bacen
 */
export const limparChavePix = (chave: string, tipoChave?: string): string => {
  if (!chave) return '';
  const limpa = chave.trim();

  // Email
  if (tipoChave === 'email' || limpa.includes('@')) {
    return limpa.toLowerCase();
  }

  // Chave Aleatória (EVP UUID v4)
  if (tipoChave === 'aleatoria' || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(limpa)) {
    return limpa.toLowerCase();
  }

  const apenasDigitos = limpa.replace(/\D/g, '');

  // Telefone celular ou fixo (padrão Bacen exige código do país +55)
  if (tipoChave === 'telefone') {
    if (apenasDigitos.startsWith('55') && apenasDigitos.length >= 12) {
      return `+${apenasDigitos}`;
    }
    return `+55${apenasDigitos}`;
  }

  // CNPJ
  if (tipoChave === 'cnpj' || apenasDigitos.length === 14) {
    return apenasDigitos;
  }

  // CPF
  if (tipoChave === 'cpf') {
    return apenasDigitos;
  }

  // Se tipo não foi informado explicitamente:
  if (limpa.startsWith('+')) {
    return `+${apenasDigitos}`;
  }
  if (limpa.includes('(') || limpa.includes(')')) {
    return `+55${apenasDigitos}`;
  }
  if (apenasDigitos.length === 11) {
    // Se o 3º dígito for 9 (celular com DDD no Brasil ex: 82999998888)
    // Celulares brasileiros têm DDD (2 dígitos) seguido de 9
    const ddd = parseInt(apenasDigitos.slice(0, 2), 10);
    const terceiroDigito = apenasDigitos.charAt(2);
    if (ddd >= 11 && ddd <= 99 && terceiroDigito === '9') {
      return `+55${apenasDigitos}`;
    }
    return apenasDigitos; // Assume CPF
  }

  return apenasDigitos || limpa;
};

export interface ValidacaoChavePixResult {
  valido: boolean;
  tipoDetectado?: 'telefone' | 'cnpj' | 'cpf' | 'email' | 'aleatoria' | 'invalido';
  motivo?: string;
  chaveLimpa?: string;
}

/**
 * Validação rigorosa de chave PIX (rejeita chaves fictícias, padrões de teste ou dados inválidos)
 */
export const validarChavePix = (chave?: string | null, tipoInformado?: string): ValidacaoChavePixResult => {
  if (!chave || !String(chave).trim()) {
    return { valido: false, tipoDetectado: 'invalido', motivo: 'Chave PIX não cadastrada.' };
  }
  const str = String(chave).trim();
  const apenasDig = str.replace(/\D/g, '');

  // Bloqueio explícito e terminante de valores fictícios de teste
  if (
    str === '12345678000190' ||
    str === '12.345.678/0001-90' ||
    apenasDig === '12345678000190' ||
    apenasDig === '00000000000' ||
    apenasDig === '11111111111' ||
    apenasDig === '00000000000000' ||
    /exemplo|teste|padrao|ficticio|consulta/i.test(str)
  ) {
    return { valido: false, tipoDetectado: 'invalido', motivo: 'Chave PIX padrão ou fictícia não autorizada para cobranças.' };
  }

  // 1. E-mail
  if (tipoInformado === 'email' || str.includes('@')) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(str.toLowerCase())) {
      return { valido: true, tipoDetectado: 'email', chaveLimpa: str.toLowerCase() };
    }
    return { valido: false, tipoDetectado: 'email', motivo: 'E-mail inválido para chave PIX.' };
  }

  // 2. Chave Aleatória (EVP UUID v4)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (tipoInformado === 'aleatoria' || uuidRegex.test(str)) {
    if (uuidRegex.test(str)) {
      return { valido: true, tipoDetectado: 'aleatoria', chaveLimpa: str.toLowerCase() };
    }
    return { valido: false, tipoDetectado: 'aleatoria', motivo: 'Chave aleatória inválida (formato UUID esperado).' };
  }

  // 3. Documento CNPJ (14 dígitos)
  if (tipoInformado === 'cnpj' || apenasDig.length === 14) {
    if (apenasDig.length !== 14) {
      return { valido: false, tipoDetectado: 'cnpj', motivo: 'CNPJ deve conter 14 dígitos numéricos.' };
    }
    if (/^(\d)\1{13}$/.test(apenasDig)) {
      return { valido: false, tipoDetectado: 'cnpj', motivo: 'CNPJ com dígitos repetidos inválido.' };
    }
    return { valido: true, tipoDetectado: 'cnpj', chaveLimpa: apenasDig };
  }

  // 4. Telefone (+55 ou DDD + 8/9 dígitos)
  if (tipoInformado === 'telefone' || (apenasDig.length >= 10 && apenasDig.length <= 13 && (str.startsWith('+') || str.startsWith('(') || str.includes('-')))) {
    let telDig = apenasDig;
    if (telDig.startsWith('55') && telDig.length >= 12) {
      telDig = telDig.slice(2);
    }
    if (telDig.length === 10 || telDig.length === 11) {
      const ddd = parseInt(telDig.slice(0, 2), 10);
      if (ddd >= 11 && ddd <= 99) {
        return { valido: true, tipoDetectado: 'telefone', chaveLimpa: `+55${telDig}` };
      }
    }
    if (tipoInformado === 'telefone') {
      return { valido: false, tipoDetectado: 'telefone', motivo: 'Telefone inválido para chave PIX (DDD + 8 ou 9 dígitos esperado).' };
    }
  }

  // 5. Documento CPF (11 dígitos)
  if (tipoInformado === 'cpf' || apenasDig.length === 11) {
    if (/^(\d)\1{10}$/.test(apenasDig)) {
      return { valido: false, tipoDetectado: 'cpf', motivo: 'CPF com dígitos repetidos inválido.' };
    }
    return { valido: true, tipoDetectado: 'cpf', chaveLimpa: apenasDig };
  }

  return { valido: false, tipoDetectado: 'invalido', motivo: 'Formato de chave PIX não reconhecido.' };
};

/**
 * Gera a string completa do PIX Copia e Cola (BR Code)
 */
export const gerarPayloadPix = ({
  chave,
  tipoChave,
  nomeFavorecido = 'Clinica Odontologica',
  cidade = 'MACEIO',
  valor,
  txId,
  descricao,
}: PixPayloadOptions): string => {
  // Validação estrita da chave: se for inválida ou fictícia, bloqueia a geração
  const valChave = validarChavePix(chave, tipoChave);
  if (!valChave.valido) return '';

  const chaveLimpa = limparChavePix(valChave.chaveLimpa || chave, tipoChave);
  if (!chaveLimpa) return '';

  // 00: Payload Format Indicator (Fixo: 01)
  let payload = formatarTLV('00', '01');

  // 01: Point of Initiation Method (12 = Estático reutilizável com valor fixo)
  const valNum = typeof valor === 'number' ? valor : parseFloat(String(valor || '').replace(',', '.'));
  const temValor = !isNaN(valNum) && valNum > 0;
  payload += formatarTLV('01', temValor ? '12' : '11');

  // 26: Merchant Account Information (PIX Oficial Bacen)
  //   00: GUI (br.gov.bcb.pix)
  //   01: Chave PIX
  let merchantInfo = formatarTLV('00', 'br.gov.bcb.pix');
  merchantInfo += formatarTLV('01', chaveLimpa);
  payload += formatarTLV('26', merchantInfo);

  // 52: Merchant Category Code (0000 = Geral)
  payload += formatarTLV('52', '0000');

  // 53: Transaction Currency (986 = BRL / Real Brasileiro)
  payload += formatarTLV('53', '986');

  // 54: Transaction Amount (Valor com ponto, ex: 150.00)
  if (temValor) {
    payload += formatarTLV('54', valNum.toFixed(2));
  }

  // 58: Country Code (BR)
  payload += formatarTLV('58', 'BR');

  // 59: Merchant Name (Nome do Favorecido, max 25 chars)
  const nomeNorm = removerAcentos(nomeFavorecido).slice(0, 25) || 'CLINICA';
  payload += formatarTLV('59', nomeNorm);

  // 60: Merchant City (Cidade, max 15 chars)
  const cidadeLimpa = (!cidade || cidade.toUpperCase().includes('SAO PAULO')) ? 'MACEIO' : cidade;
  const cidadeNorm = removerAcentos(cidadeLimpa).slice(0, 15) || 'MACEIO';
  payload += formatarTLV('60', cidadeNorm);

  // 62: Additional Data Field Template
  //   05: Reference Label / TxID (max 25 chars, sem espaços)
  const txIdNorm = (txId ? removerAcentos(txId).replace(/\s+/g, '') : '***').slice(0, 25) || '***';
  const additionalData = formatarTLV('05', txIdNorm);
  payload += formatarTLV('62', additionalData);

  // 63: CRC16 (Calculado sobre toda a string anterior incluindo a tag 6304)
  const payloadSemCRC = `${payload}6304`;
  const crc = calcularCRC16(payloadSemCRC);

  return `${payloadSemCRC}${crc}`;
};

/**
 * Retorna URL de imagem do QR Code a partir do payload PIX
 */
export const gerarQrCodePixUrl = (payloadPix: string, tamanho = 240): string => {
  if (!payloadPix) return '';
  return `https://api.qrserver.com/v1/create-qr-code/?size=${tamanho}x${tamanho}&margin=4&data=${encodeURIComponent(payloadPix)}`;
};
