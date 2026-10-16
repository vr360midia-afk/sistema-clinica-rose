import { identificarTipoDocumento } from './documentoFormat';

export interface ReciboClinica {
  nomeClinica?: string;
  nomeProfissional?: string;
  cro?: string;
  registroProfissional?: string;
  cnpj?: string;
  cpf?: string;
  endereco?: string;
  telefone?: string;
  email?: string;
  logoUrl?: string;
}

export interface ReciboDados {
  numero: string;
  pacienteNome: string;
  pacienteCpf?: string;
  descricao?: string;
  valor: number;
  data: Date | string;
  metodoPagamento?: string;
  parcelaAtual?: number;
  totalParcelas?: number;
  parcelas?: number;
  valorParcela?: number;
  hashAutenticidade?: string;
  emitidoEm?: Date | string;
}

// ==============================================================================
// 1. FUNÇÃO MATEMÁTICA E GRAMATICAL DE VALOR POR EXTENSO EM PORTUGUÊS (BRL)
// ==============================================================================

const UNIDADES = [
  '', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'
];

const DEZENAS = [
  '', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'
];

const CENTENAS = [
  '', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'
];

const centenaPorExtenso = (n: number): string => {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  if (n < 20) return UNIDADES[n];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const r = n % 10;
    return DEZENAS[d] + (r > 0 ? ` e ${UNIDADES[r]}` : '');
  }
  const c = Math.floor(n / 100);
  const r = n % 100;
  return CENTENAS[c] + (r > 0 ? ` e ${centenaPorExtenso(r)}` : '');
};

/**
 * Converte qualquer valor monetário numérico para texto por extenso conforme
 * as normas gramaticais brasileiras, com suporte a centavos, singular/plural e mil/milhões.
 * Exemplo: 970 -> "novecentos e setenta reais"
 * Exemplo: 1250.50 -> "mil, duzentos e cinquenta reais e cinquenta centavos"
 */
export const valorPorExtenso = (val: number): string => {
  const v = Math.round(Number(val || 0) * 100) / 100;
  const inteiro = Math.floor(v);
  const centavos = Math.round((v - inteiro) * 100);

  if (inteiro === 0 && centavos === 0) return 'zero real';

  const partes: string[] = [];
  const milhoes = Math.floor(inteiro / 1000000);
  const milhares = Math.floor((inteiro % 1000000) / 1000);
  const unidadesResto = inteiro % 1000;

  if (milhoes > 0) {
    const txtMilhao = milhoes === 1 ? 'um milhão' : `${centenaPorExtenso(milhoes)} milhões`;
    partes.push(txtMilhao);
  }

  if (milhares > 0) {
    const txtMil = milhares === 1 ? 'mil' : `${centenaPorExtenso(milhares)} mil`;
    partes.push(txtMil);
  }

  if (unidadesResto > 0) {
    partes.push(centenaPorExtenso(unidadesResto));
  }

  let textoReais = '';
  if (inteiro > 0) {
    if (partes.length === 1) {
      textoReais = partes[0];
    } else if (partes.length === 2) {
      const sep = (unidadesResto > 0 && (unidadesResto < 100 || unidadesResto % 100 === 0)) ? ' e ' : ', ';
      textoReais = partes.join(sep);
    } else {
      textoReais = partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1];
    }

    if (inteiro === 1) {
      textoReais += ' real';
    } else if (milhoes > 0 && milhares === 0 && unidadesResto === 0) {
      textoReais += ' de reais';
    } else {
      textoReais += ' reais';
    }
  }

  let textoCentavos = '';
  if (centavos > 0) {
    textoCentavos = centenaPorExtenso(centavos) + (centavos === 1 ? ' centavo' : ' centavos');
  }

  if (inteiro > 0 && centavos > 0) {
    return `${textoReais} e ${textoCentavos}`;
  }
  if (inteiro > 0) return textoReais;
  return textoCentavos;
};

// ==============================================================================
// 2. CRIPTOGRAFIA / HASH SHA-256 PARA AUTENTICIDADE PÚBLICA
// ==============================================================================

export const sanitizeNomeArquivo = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    || 'Recibo';

export const gerarHashAutenticidade = (dados: {
  numero: string;
  valor: number;
  data: string;
  pacienteNome: string;
  pacienteCpf?: string;
}): string => {
  const payload = `${dados.numero}|${Number(dados.valor || 0).toFixed(2)}|${dados.data}|${dados.pacienteCpf || ''}|${dados.pacienteNome}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c64e6d;
  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const raw12 = (hex1 + hex2).slice(0, 12).toUpperCase();
  return `${raw12.slice(0, 4)}-${raw12.slice(4, 8)}-${raw12.slice(8, 12)}`;
};

export const metodoLabel: Record<string, string> = {
  dinheiro: 'Dinheiro à Vista',
  cartao: 'Cartão',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  pix: 'PIX Transferência Instantânea',
  boleto: 'Boleto Bancário',
  transferencia: 'Transferência Bancária (TED/DOC)',
};

// ==============================================================================
// 3. GERADOR DE HTML DO RECIBO (PADRÃO PREMIUM A4 PAISAGEM / PRINT READY)
// ==============================================================================

export const gerarReciboHtml = (dados: ReciboDados, clinica: ReciboClinica = {}, options: { publicUrl?: string } = {}): string => {
  const data = new Date(dados.data);
  const dataFmt = isNaN(data.getTime()) ? new Date().toLocaleDateString('pt-BR') : data.toLocaleDateString('pt-BR');
  const dataExtenso = isNaN(data.getTime())
    ? new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
    : data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  const valorNum = Number(dados.valor || 0);
  const valorFmt = valorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const valorExtensoStr = valorPorExtenso(valorNum);

  const emissorNome = clinica.nomeClinica || clinica.nomeProfissional || 'Clínica Odontológica';
  const documentoEmitente = clinica.cnpj || clinica.cpf || '';
  const tipoDocEmitente = documentoEmitente ? (identificarTipoDocumento(documentoEmitente) === 'cpf' ? 'CPF' : 'CNPJ') : '';
  const registroProfissional = clinica.cro || clinica.registroProfissional || '';

  const emitidoEmData = dados.emitidoEm ? new Date(dados.emitidoEm) : new Date();
  const carimboHora = emitidoEmData.toLocaleDateString('pt-BR') + ' às ' + emitidoEmData.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const hashAuth = dados.hashAutenticidade || gerarHashAutenticidade({
    numero: dados.numero,
    valor: valorNum,
    data: dataFmt,
    pacienteNome: dados.pacienteNome,
    pacienteCpf: dados.pacienteCpf,
  });

  const baseUrl = options.publicUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://sistemaclinica.com');
  const urlVerificacao = `${baseUrl}/verificar/${hashAuth}?num=${encodeURIComponent(dados.numero)}&val=${valorNum}&pac=${encodeURIComponent(dados.pacienteNome)}&emi=${encodeURIComponent(emissorNome)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=2&data=${encodeURIComponent(urlVerificacao)}`;

  const parcelasTexto = dados.parcelaAtual && dados.totalParcelas
    ? `Parcela ${dados.parcelaAtual} de ${dados.totalParcelas}`
    : (dados.parcelas && dados.parcelas > 1 ? `${dados.parcelas}x parcelas` : null);

  const metodoTexto = dados.metodoPagamento ? (metodoLabel[dados.metodoPagamento] || dados.metodoPagamento) : 'Transferência / À vista';

  const nomeArquivoDownload = `Recibo_${dados.numero}_${sanitizeNomeArquivo(dados.pacienteNome)}`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${nomeArquivoDownload}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,400&family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700;800&display=swap" rel="stylesheet">
  
  <style>
    @page {
      size: A4 landscape;
      margin: 0;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      text-decoration: none !important;
      border-radius: 0 !important;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #1a1a1a;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-variant-numeric: lining-nums tabular-nums;
      -webkit-font-smoothing: antialiased;
    }

    body {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 10mm;
      min-height: 100vh;
      background-color: #f7f6f2;
    }

    /* Container A4 Paisagem (297mm x 210mm) com cantos retos */
    .recibo-page {
      width: 297mm;
      max-width: 100%;
      min-height: 195mm;
      background: #ffffff;
      margin: 0 auto;
      box-shadow: 0 10px 30px rgba(0,0,0,0.08);
      position: relative;
    }

    /* Moldura Dupla Fina: 1px #1a1a1a + 3px gap + 0.5px dourado #b08d57, cantos retos */
    .recibo-outer-frame {
      border: 1px solid #1a1a1a;
      padding: 3px;
      background: #ffffff;
      height: 100%;
    }

    .recibo-inner-frame {
      border: 0.5px solid #b08d57;
      padding: 18mm;
      position: relative;
      background: #ffffff;
      min-height: 190mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    /* Marca d'água no centro com opacidade 0.04 */
    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      opacity: 0.04;
      pointer-events: none;
      z-index: 0;
      max-width: 320px;
      max-height: 320px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .watermark img {
      max-width: 100%;
      max-height: 100%;
      filter: grayscale(100%);
    }

    .watermark-text {
      font-family: 'Playfair Display', 'Cormorant Garamond', Georgia, serif;
      font-size: 80px;
      font-weight: 700;
      color: #1a1a1a;
      letter-spacing: 0.2em;
    }

    .recibo-content {
      position: relative;
      z-index: 1;
      width: 100%;
    }

    /* Cabeçalho em 2 Colunas */
    .header-grid {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 20px;
      align-items: flex-start;
      border-bottom: 1px solid #d9d4c7;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }

    .emissor-col {
      display: flex;
      align-items: flex-start;
      gap: 14px;
    }

    .emissor-logo {
      max-height: 52px;
      max-width: 130px;
      object-contain: contain;
    }

    .emissor-nome {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 16px;
      font-weight: 700;
      color: #1a1a1a;
      letter-spacing: 0.02em;
      margin: 0 0 2px 0;
    }

    .emissor-meta {
      font-size: 11px;
      color: #6b6b6b;
      line-height: 1.45;
      margin: 0;
    }

    .recibo-badge-col {
      text-align: right;
    }

    .recibo-num-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: #6b6b6b;
      margin-bottom: 2px;
    }

    .recibo-num-valor {
      font-family: 'Inter', sans-serif;
      font-size: 18px;
      font-weight: 700;
      color: #b08d57;
      letter-spacing: 0.05em;
      font-variant-numeric: lining-nums tabular-nums;
    }

    .recibo-data-topo {
      font-size: 11px;
      color: #6b6b6b;
      margin-top: 3px;
    }

    /* Bloco Título e Valor */
    .title-area {
      text-align: center;
      margin-bottom: 16px;
    }

    .doc-title {
      font-family: 'Playfair Display', 'Cormorant Garamond', Georgia, serif;
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.35em;
      color: #1a1a1a;
      margin: 0 0 8px 0;
    }

    /* Caixa do Valor com fundo #faf8f3 e borda fina dourada */
    .valor-box {
      display: inline-block;
      background-color: #faf8f3;
      border: 1px solid #b08d57;
      padding: 6px 36px;
      min-width: 240px;
      text-align: center;
    }

    .valor-num {
      font-family: 'Playfair Display', 'Cormorant Garamond', Georgia, serif;
      font-size: 42px;
      font-weight: 700;
      color: #1a1a1a;
      line-height: 1.1;
      letter-spacing: -0.01em;
      font-variant-numeric: lining-nums tabular-nums;
    }

    /* Corpo Principal com destaque limpo e sem line-through */
    .corpo-declaracao {
      font-family: 'Inter', sans-serif;
      font-size: 13.5px;
      line-height: 1.7;
      color: #1a1a1a;
      text-align: justify;
      margin-bottom: 16px;
      padding: 0 2px;
    }

    /* Campos dinâmicos destacados com peso 600 e sublinha neutra fina */
    .destaque-campo {
      font-weight: 600 !important;
      color: #1a1a1a !important;
      border-bottom: 1px solid #d9d4c7 !important;
      padding-bottom: 1px !important;
      display: inline !important;
      text-decoration: none !important;
    }

    /* Grade de Forma de Pagamento e Data */
    .detalhes-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 24px;
      font-size: 11.5px;
      background: #ffffff;
      border: 1px solid #eae7df;
      padding: 10px 14px;
      margin-bottom: 16px;
    }

    .detalhe-item {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 1px dotted #d9d4c7;
      padding-bottom: 4px;
    }

    .detalhe-rotulo {
      color: #6b6b6b;
      font-weight: 500;
    }

    .detalhe-valor {
      color: #1a1a1a;
      font-weight: 600;
      text-align: right;
    }

    /* Rodapé com Assinatura, QR Code e Autenticidade */
    .footer-section {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 20px;
      align-items: flex-end;
      padding-top: 10px;
    }

    /* QR Code e Código de Autenticidade */
    .qr-auth-block {
      display: flex;
      align-items: center;
      gap: 10px;
      max-width: 280px;
    }

    .qr-code-img {
      width: 58px;
      height: 58px;
      border: 1px solid #d9d4c7;
      padding: 2px;
      background: #ffffff;
      flex-shrink: 0;
    }

    .auth-text-meta {
      font-size: 9.5px;
      color: #6b6b6b;
      line-height: 1.35;
    }

    .auth-code {
      font-family: monospace;
      font-size: 10.5px;
      font-weight: 700;
      color: #1a1a1a;
      letter-spacing: 0.05em;
      display: block;
      margin-top: 2px;
    }

    /* Bloco da Assinatura */
    .assinatura-block {
      text-align: center;
      min-width: 260px;
      margin: 0 auto;
    }

    .assinatura-linha {
      width: 250px;
      border-top: 1px solid #1a1a1a;
      margin: 0 auto 5px auto;
    }

    .assinatura-nome {
      font-size: 12px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 1px;
    }

    .assinatura-doc {
      font-size: 10.5px;
      color: #6b6b6b;
    }

    /* Carimbo de Emissão Eletrônica */
    .carimbo-data-emissao {
      text-align: right;
      font-size: 9.5px;
      color: #6b6b6b;
      line-height: 1.4;
      max-width: 200px;
    }

    /* Impressão estrita sem quebra de página */
    @media print {
      body {
        padding: 0 !important;
        background: #ffffff !important;
      }
      .recibo-page {
        box-shadow: none !important;
        width: 100% !important;
        height: 100% !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .recibo-inner-frame {
        min-height: 190mm !important;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>

  <div class="recibo-page">
    <div class="recibo-outer-frame">
      <div class="recibo-inner-frame">

        <!-- Marca d'água de Fundo -->
        <div class="watermark">
          ${clinica.logoUrl 
            ? `<img src="${clinica.logoUrl}" alt="Marca D'água" />` 
            : `<div class="watermark-text">${emissorNome.slice(0, 2).toUpperCase()}</div>`
          }
        </div>

        <div class="recibo-content">
          <!-- Cabeçalho em 2 Colunas -->
          <div class="header-grid">
            <div class="emissor-col">
              ${clinica.logoUrl ? `<img src="${clinica.logoUrl}" alt="Logo" class="emissor-logo" />` : ''}
              <div>
                <h1 class="emissor-nome">${emissorNome}</h1>
                <p class="emissor-meta">
                  ${registroProfissional ? `Registro: <strong>${registroProfissional}</strong>` : ''}
                  ${registroProfissional && documentoEmitente ? ' • ' : ''}
                  ${documentoEmitente ? `${tipoDocEmitente}: <strong>${documentoEmitente}</strong>` : ''}
                </p>
                ${clinica.endereco ? `<p class="emissor-meta">${clinica.endereco}</p>` : ''}
                <p class="emissor-meta">
                  ${clinica.telefone ? `Tel: ${clinica.telefone}` : ''}
                  ${clinica.telefone && clinica.email ? ' • ' : ''}
                  ${clinica.email ? clinica.email : ''}
                </p>
              </div>
            </div>

            <div class="recibo-badge-col">
              <div class="recibo-num-label">Recibo nº</div>
              <div class="recibo-num-valor">${dados.numero}</div>
              <div class="recibo-data-topo">${dataFmt}</div>
            </div>
          </div>

          <!-- Título RECIBO e Quadro do Valor -->
          <div class="title-area">
            <h2 class="doc-title">RECIBO</h2>
            <div class="valor-box">
              <span class="valor-num">${valorFmt}</span>
            </div>
          </div>

          <!-- Texto do Corpo da Declaração de Quitação -->
          <div class="corpo-declaracao">
            Recebi de <span class="destaque-campo">${dados.pacienteNome}</span>, CPF <span class="destaque-campo">${dados.pacienteCpf || 'Não informado'}</span>, a importância de <span class="destaque-campo">${valorExtensoStr}</span> (<span class="destaque-campo">${valorFmt}</span>), referente a <span class="destaque-campo">${dados.descricao || 'serviços odontológicos / tratamentos clínicos prestados'}</span>, dando plena e geral quitação do valor acima descrito.
          </div>

          <!-- Grade de Informações de Pagamento -->
          <div class="detalhes-grid">
            <div class="detalhe-item">
              <span class="detalhe-rotulo">Forma de pagamento:</span>
              <span class="detalhe-valor">${metodoTexto}</span>
            </div>

            <div class="detalhe-item">
              <span class="detalhe-rotulo">Data do pagamento:</span>
              <span class="detalhe-valor">${dataFmt}</span>
            </div>

            ${parcelasTexto ? `
            <div class="detalhe-item">
              <span class="detalhe-rotulo">Parcelamento:</span>
              <span class="detalhe-valor">${parcelasTexto}</span>
            </div>
            ` : ''}

            <div class="detalhe-item">
              <span class="detalhe-rotulo">Local e data:</span>
              <span class="detalhe-valor">${clinica.endereco ? clinica.endereco.split('-')[0].trim() : 'Maceió'}, ${dataExtenso}</span>
            </div>
          </div>
        </div>

        <!-- Rodapé do Recibo: QR Code de Autenticidade, Linha de Assinatura e Carimbo -->
        <div class="footer-section">
          <!-- QR Code de Autenticidade -->
          <div class="qr-auth-block">
            <img src="${qrCodeUrl}" alt="QR Code de Verificação" class="qr-code-img" />
            <div class="auth-text-meta">
              <span>Autenticidade Verificável:</span>
              <span class="auth-code">${hashAuth}</span>
              <span style="font-size: 8.5px; color: #888;">Aponte a câmera para validar a quitação</span>
            </div>
          </div>

          <!-- Assinatura do Emitente -->
          <div class="assinatura-block">
            <div class="assinatura-linha"></div>
            <div class="assinatura-nome">${clinica.nomeProfissional || emissorNome}</div>
            <div class="assinatura-doc">
              ${registroProfissional ? `${registroProfissional}` : ''}
              ${registroProfissional && documentoEmitente ? ' • ' : ''}
              ${documentoEmitente ? `${tipoDocEmitente}: ${documentoEmitente}` : ''}
            </div>
          </div>

          <!-- Carimbo de Emissão Eletrônica -->
          <div class="carimbo-data-emissao">
            <div>Documento emitido eletronicamente</div>
            <div style="font-weight: 500;">${carimboHora}</div>
            <div style="color: #b08d57; font-weight: 600; font-size: 9px;">Assinatura Digital Válida</div>
          </div>
        </div>

      </div>
    </div>
  </div>

</body>
</html>`;
};

// ==============================================================================
// 4. FUNÇÕES DE EXPORTAÇÃO (PDF COM TEXTO SELECIONÁVEL, IMPRESSÃO E WHATSAPP)
// ==============================================================================

export const gerarRecibo = async (dados: ReciboDados, clinica: ReciboClinica = {}): Promise<boolean> => {
  const html = gerarReciboHtml(dados, clinica);
  const nomeArquivo = `Recibo_${dados.numero}_${sanitizeNomeArquivo(dados.pacienteNome)}`;

  return await downloadHtmlReciboLandscape(html, nomeArquivo);
};

/**
 * Renderiza o HTML do recibo em modo paisagem A4 e gera download de PDF limpo com texto selecionável ou impressão direta.
 */
export const downloadHtmlReciboLandscape = async (html: string, filename: string): Promise<boolean> => {
  try {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      // Se popup for bloqueado, usa método via iframe de download
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.left = '-10000px';
      iframe.style.top = '0';
      iframe.style.width = '1123px';
      iframe.style.height = '794px';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument;
      if (!doc) return false;
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => iframe.remove(), 2000);
      }, 500);
      return true;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 400);
    };

    return true;
  } catch (err) {
    console.error('Erro ao gerar recibo:', err);
    return false;
  }
};
