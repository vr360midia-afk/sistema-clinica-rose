import { supabase } from '@/integrations/supabase/client';
import { valorPorExtenso } from './recibo';
import { formatMoney } from './exportCsv';
import {
  identificarTipoDocumento,
  obterRotuloDocumento,
  formatarDocumento,
  somarMesesSeguro,
  temValorValido,
  formatarEnderecoCompleto,
  formatarTelefone,
} from './documentoFormat';
import type { Paciente, Transacao, AvaliacaoRestauracoesPreexistentes } from '@/types/shared';
import type { Orcamento } from '@/hooks/useOrcamentos';
import type { ConfiguracoesGerais } from '@/hooks/useConfiguracoes';
import { carregarConfiguracoesContratoSync, type ConfiguracoesContrato } from '@/hooks/useConfiguracoesContrato';
import { gerarFragmentoHtmlTermoUsoImagem } from './termoUsoImagem';
import { gerarPayloadPix, gerarQrCodePixUrl } from './pixPayload';
import {
  gerarHtmlContratoEndodontia,
  downloadContratoEndodontiaPdf,
  gerarHtmlTcleEndodontia,
  downloadTcleEndodontiaPdf,
} from './contratoEndodontia';
import { slugifyNome } from './anamneseEngine';
import {
  obterTextoCondicaoParaContrato,
  parseCondicoesPagamento,
  obterCondicaoAtiva,
  extrairCondicaoEscolhida,
  type CondicaoPagamento,
} from './orcamentoCondicoes';

export {
  identificarTipoDocumento,
  obterRotuloDocumento,
  formatarDocumento,
  somarMesesSeguro,
  temValorValido,
  formatarEnderecoCompleto,
  formatarTelefone,
  gerarHtmlContratoEndodontia,
  downloadContratoEndodontiaPdf,
  gerarHtmlTcleEndodontia,
  downloadTcleEndodontiaPdf,
};

export type TipoModeloContrato = 'geral' | 'lentes_resina' | 'endodontia';

export interface ContratoDadosParceiro {
  id?: string;
  nome: string;
  croUf: string;
  documento?: string; // CPF ou CNPJ
  especialidade?: string;
  telefone?: string;
}

export interface ContratoDadosEndodontia {
  ativo: boolean;
  executorTipo: 'dentista_titular' | 'parceiro';
  parceiro?: ContratoDadosParceiro | null;
  dentes?: string;
  diagnostico?: string;
  etapasPrevistas?: string;
  procedimentosIncluidos?: string;
  procedimentosNaoIncluidos?: string;
  procedimentosAprovados?: string;
}

export interface ContratoItem {
  id?: string;
  nome?: string;
  descricao?: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  denteOuRegiao?: string;
  dente?: string;
}

export interface ContratoParcela {
  numero: number;
  descricao?: string;
  vencimento: string;
  valor: number;
  metodo?: string;
  status?: string;
  payloadPix?: string;
  qrCodePixUrl?: string;
}

export interface ContratoDadosPaciente {
  id: string;
  nome: string;
  cpf: string;
  rg: string;
  dataNascimento: string;
  idade: string;
  endereco: string;
  telefone: string;
  email: string;
  profissao: string;
  estadoCivil: string;
}

export interface ContratoDadosClinica {
  nome: string;
  cnpj: string;
  cro: string;
  endereco: string;
  telefone: string;
  email: string;
  logoUrl?: string;
  cidade: string;
  dentistaResponsavel: string;
  chavePix?: string;
  tipoChavePix?: string;
  favorecidoPix?: string;
  cnpjCpfFavorecidoPix?: string;
  bancoPix?: string;
  instrucoesPix?: string;
}

export interface ValidacaoDadosContratadaResult {
  valido: boolean;
  erros: string[];
}

/**
 * Valida os dados obrigatórios da Contratada cadastrados em Configurações → Contrato & PIX.
 * Garante que razão social, CNPJ/CPF, endereço, contatos e responsável técnica estejam preenchidos.
 */
export const validarDadosContratada = (
  clinica: Partial<ContratoDadosClinica> | Partial<ConfiguracoesContrato> | any
): ValidacaoDadosContratadaResult => {
  const erros: string[] = [];
  const nome = (clinica?.nome || clinica?.nomeClinicaContrato || '').trim();
  const cnpj = (clinica?.cnpj || clinica?.cnpjClinicaContrato || '').trim();
  const endereco = (clinica?.endereco || clinica?.enderecoContrato || '').trim();
  const telefone = (clinica?.telefone || clinica?.telefoneContrato || '').trim();
  const email = (clinica?.email || clinica?.emailContrato || '').trim();
  const dentista = (clinica?.dentistaResponsavel || clinica?.dentistaResponsavelContrato || '').trim();
  const cro = (clinica?.cro || clinica?.croResponsavelContrato || '').trim();

  if (!temValorValido(nome) || nome === 'Clínica Odontológica') {
    erros.push('Razão Social / Nome da Contratada é obrigatório (Configurações → Contrato & PIX).');
  }
  if (!temValorValido(cnpj) || cnpj === 'Não informado') {
    erros.push('CNPJ ou CPF da Contratada é obrigatório (Configurações → Contrato & PIX).');
  }
  if (!temValorValido(endereco) || endereco === 'Endereço da clínica') {
    erros.push('Endereço completo da Contratada é obrigatório (Configurações → Contrato & PIX).');
  }
  if (!temValorValido(telefone) || telefone === 'Não informado') {
    erros.push('Telefone / WhatsApp de contato é obrigatório (Configurações → Contrato & PIX).');
  }
  if (!temValorValido(email) || email === 'Não informado') {
    erros.push('E-mail oficial de contato é obrigatório (Configurações → Contrato & PIX).');
  }
  if (!temValorValido(dentista) || dentista === 'Cirurgião-Dentista Responsável') {
    erros.push('Cirurgião-Dentista Responsável Técnico(a) é obrigatório (Configurações → Contrato & PIX).');
  }
  if (!temValorValido(cro) || cro === 'CRO sob consulta') {
    erros.push('Número do CRO do Responsável Técnico é obrigatório (Configurações → Contrato & PIX).');
  }

  return {
    valido: erros.length === 0,
    erros,
  };
};

export interface ContratoDadosOrcamento {
  id: string;
  numeroIdentificador: string;
  titulo: string;
  subtotal: number;
  desconto: number;
  total: number;
  totalExtenso: string;
  formasPagamento: string;
  validade: string;
  dataAprovacao: string;
  itens: ContratoItem[];
  observacoes?: string;
}

export interface ContratoCardPagamento {
  id: string;
  rotulo: string;
  valorFormatado: string;
  tipo: 'entrada' | 'parcelamento' | 'final' | 'vencimento' | 'unico';
  metodo?: string;
  detalhe?: string;
  pago?: boolean;
  statusBadge?: string;
}

export interface ContratoDadosFinanceiro {
  subtotal: number;
  desconto: number;
  total: number;
  totalExtenso: string;
  formaPagamento: string;
  entrada: number;
  parcelas: ContratoParcela[];
  quantidadeParcelas: number;
  valorParcela: number;
  metodoParcelamento?: string;
  cardsPagamento?: ContratoCardPagamento[];
}

export interface ContratoTermoUsoImagem {
  ativo?: boolean; // Se a opção de inclusão/gestão está ativa
  autorizado: boolean; // Se o paciente optou por autorizar (true) ou recusar (false)
  usoDidaticoCientifico?: boolean; // Item B: didático e científico
  usoPublicitarioRedesSociais?: boolean; // Item C: publicitário e redes sociais
  identificacaoFacialVoz?: 'rosto_e_voz' | 'apenas_voz' | 'apenas_bucal' | 'nao_autoriza_identificacao'; // Item D
  depoimentos?: boolean; // Item E: depoimentos voluntários
  canalContatoLgpd?: string;
  responsavelLegal?: {
    nome?: string;
    cpf?: string;
    vinculo?: string;
  };
}

export interface ContratoSnapshot {
  contratoId: string;
  orcamentoId: string;
  pacienteId: string;
  versao: string;
  status: 'emitido' | 'assinado' | 'cancelado' | 'pendente' | 'aguardando_assinatura_dentista' | 'aguardando_assinatura_paciente' | 'formalizado';
  token?: string;
  tokenValidoAte?: string;
  emitidoEm: string;
  pacienteNome?: string;
  numero?: string;
  tipoModeloContrato?: TipoModeloContrato;
  paciente: ContratoDadosPaciente;
  clinica: ContratoDadosClinica;
  orcamento: ContratoDadosOrcamento;
  financeiro: ContratoDadosFinanceiro;
  observacoesCustomizadas?: string;
  incluiLentesResina?: boolean;
  dadosRestauracoesPreexistentes?: AvaliacaoRestauracoesPreexistentes;
  dadosEndodontia?: ContratoDadosEndodontia;
  termoUsoImagem?: ContratoTermoUsoImagem;
  assinaturaPaciente?: {
    assinaturaData: string;
    nome: string;
    dataHora: string;
    email?: string;
    cpf?: string;
    rg?: string;
    selfie?: string;
  } | null;
  assinaturaDentista?: {
    assinaturaData: string;
    nome: string;
    dataHora: string;
    cro?: string;
  } | null;
}

const formatarData = (d: Date | string | undefined | null): string => {
  if (!d) return 'Não informada';
  const data = d instanceof Date ? d : new Date(String(d));
  if (isNaN(data.getTime())) return String(d);
  return data.toLocaleDateString('pt-BR');
};

export const formatarDataPorExtenso = (d: Date = new Date(), cidade = 'Maceió'): string => {
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  const dia = d.getDate();
  const mes = meses[d.getMonth()];
  const ano = d.getFullYear();
  return `${cidade}, ${dia} de ${mes} de ${ano}`;
};

/**
 * Converte com precisão strings monetárias em formato brasileiro (ex: "R$ 3.709,00", "370,90", "291") em números válidos.
 */
export const parseBrMoney = (valStr: string | number | undefined | null): number => {
  if (typeof valStr === 'number') return isNaN(valStr) ? 0 : valStr;
  if (!valStr) return 0;
  const limpo = String(valStr).trim().replace(/[^\d.,-]/g, '');
  if (!limpo) return 0;
  if (limpo.includes(',')) {
    return Number(limpo.replace(/\./g, '').replace(',', '.')) || 0;
  }
  const partesPonto = limpo.split('.');
  if (partesPonto.length > 2) {
    return Number(limpo.replace(/\./g, '')) || 0;
  }
  if (partesPonto.length === 2 && partesPonto[1].length === 3) {
    return Number(limpo.replace(/\./g, '')) || 0;
  }
  return Number(limpo) || 0;
};

/**
 * Verifica se o método de pagamento ou a descrição corresponde a Cartão de Crédito
 */
export const isMetodoCartao = (metodo?: string | null, descricao?: string | null): boolean => {
  const m = metodo || '';
  const d = descricao || '';
  return /cart[aã]o|cr[eé]dito/i.test(m) || /cart[aã]o|cr[eé]dito/i.test(d);
};

/**
 * Verifica se o método de pagamento ou a descrição corresponde a PIX
 */
export const isMetodoPix = (metodo?: string | null, descricao?: string | null): boolean => {
  const m = (metodo || '').toLowerCase();
  const d = (descricao || '').toLowerCase();
  return m.includes('pix') || d.includes('pix');
};

/**
 * Verifica se o contrato abrange tratamento com lentes em resina composta,
 * facetas em resina, laminados em resina ou restaurações estéticas similares.
 */
export const isContratoLenteResina = (snapshot?: ContratoSnapshot | null): boolean => {
  if (!snapshot) return false;
  // Se o contrato já foi assinado sem essa indicação prévia, mantém o documento original preservado
  if (snapshot?.status === 'assinado' && snapshot.incluiLentesResina !== true) {
    return false;
  }

  // 1. Se explicitamente sinalizado no snapshot
  if (snapshot.incluiLentesResina === true) return true;
  if (snapshot.incluiLentesResina === false) return false;

  // 2. Se o paciente possui restaurações preexistentes cadastradas no snapshot
  if (snapshot.dadosRestauracoesPreexistentes?.possuiPreexistentes) {
    return true;
  }

  // 3. Verifica dados do orçamento (itens, título e observações)
  const itens = snapshot.orcamento?.itens || [];
  const textao = [
    snapshot.orcamento?.titulo || '',
    snapshot.orcamento?.observacoes || '',
    snapshot.observacoesCustomizadas || '',
    ...itens.map((i) => `${i.nome} ${i.denteOuRegiao || ''}`),
  ]
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const temLente = textao.includes('lente') || textao.includes('faceta') || textao.includes('laminado');
  const temResina = textao.includes('resina');

  if (temLente && temResina) return true;
  if (
    textao.includes('lente de contato') ||
    textao.includes('lentes em resina') ||
    textao.includes('facetas em resina') ||
    textao.includes('lentes resina')
  ) {
    return true;
  }

  return false;
};

/**
 * Verifica se o contrato abrange tratamento endodôntico (tratamento de canal).
 */
export const isContratoEndodontia = (snapshot?: ContratoSnapshot | null): boolean => {
  if (!snapshot) return false;

  // 1. Se explicitamente sinalizado pelo tipo de modelo
  if (snapshot.tipoModeloContrato === 'endodontia') return true;
  if (snapshot.tipoModeloContrato === 'lentes_resina' || snapshot.tipoModeloContrato === 'geral') return false;

  // 2. Se explicitamente configurado no objeto de endodontia
  if (snapshot.dadosEndodontia?.ativo === true) return true;
  if (snapshot.dadosEndodontia?.ativo === false) return false;

  // 3. Se o contrato já foi assinado sem indicação explícita, não altera retroativamente
  if (snapshot.status === 'assinado') return false;

  // 4. Auto-detecção por palavras-chave no orçamento, itens ou observações
  const itens = snapshot.orcamento?.itens || [];
  const textao = [
    snapshot.orcamento?.titulo || '',
    snapshot.orcamento?.observacoes || '',
    snapshot.observacoesCustomizadas || '',
    ...itens.map((i) => `${i.nome} ${i.denteOuRegiao || ''}`),
  ]
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (
    textao.includes('canal') ||
    textao.includes('endodont') ||
    textao.includes('retratamento endod') ||
    textao.includes('biopulpectomia') ||
    textao.includes('necropulpectomia') ||
    textao.includes('pulpotomia')
  ) {
    return true;
  }

  return false;
};

/**
 * Remove menções a operadoras/maquininhas de cartão (PagBank, InfinitePay, Stone, etc.) e taxas da máquina
 * de qualquer texto destinado ao contrato do paciente (cláusulas, resumo, parcelas, etc.).
 */
export const limparFormaPagamentoParaContrato = (texto?: any): string => {
  if (!texto) return '';
  let str = '';
  if (typeof texto === 'object') {
    try {
      str = JSON.stringify(texto);
    } catch (_) {
      str = '';
    }
  } else {
    str = String(texto).trim();
  }
  if (!str) return '';

  // Desempacota stringified JSON com aspas externas se houver
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    try {
      str = JSON.parse(str);
    } catch (_) {
      str = str.slice(1, -1).trim();
    }
  }

  // Se o texto contiver qualquer indício de JSON estruturado, converte para texto legível
  if (
    typeof str === 'string' && (
      str.includes('{') ||
      str.includes('}') ||
      str.includes('condicoes') ||
      str.includes('versao') ||
      str.includes('selecionadaId')
    )
  ) {
    str = obterTextoCondicaoParaContrato(str);
  }

  const limpo = String(str)
    // 1. Remove blocos de taxa como "(Taxa PagBank: 10.7% / R$ 267,50)", "(Taxa 10.7%: R$ 267,50)", "(Taxa: 10.7%)", etc.
    .replace(/\s*\(\s*Taxa[^)]*\)/gi, '')
    // 2. Remove padrões como " - Taxa 10.7%: R$ 267,50"
    .replace(/\s*-\s*Taxa[^\n,;+\[\]]*/gi, '')
    // 3. Remove menções explícitas de taxas sem parênteses
    .replace(/\s*Taxa\s+(?:da\s+m[aá]quina|de\s+cart[aã]o|[A-Za-z0-9_-]+)?(?::|\s+)[^,;+\[\]\n\)]*/gi, '')
    // 4. Remove menções a nomes de operadoras/maquininhas entre parênteses: "(PagBank)", "(InfinitePay)", "(Stone)", etc.
    .replace(/\s*\(\s*(?:PagBank|PagSeguro|InfinitePay|Infinite\s*Pay|Stone|Cielo|Rede|Getnet|SumUp|SafraPay|Moderninha|Ton|Mercado\s*Pago|Maquininha|M[aá]quina)\s*\)/gi, '')
    // 5. Remove menções com hífen: "- PagBank", "- InfinitePay", etc.
    .replace(/\s*-\s*(?:PagBank|PagSeguro|InfinitePay|Infinite\s*Pay|Stone|Cielo|Rede|Getnet|SumUp|SafraPay|Moderninha|Ton|Mercado\s*Pago|Maquininha|M[aá]quina)(?=\s|$|,|\+|\)|\])/gi, '')
    // 6. Remove parênteses vazios resultantes
    .replace(/\(\s*\)/g, '')
    // 7. Normaliza espaços múltiplos e pontuação
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.:;])/g, '$1')
    .trim();

  // Safeguard absoluto: se após a limpeza ainda houver JSON residual ({ ou }), retorna fallback legível
  if (
    limpo.includes('{') ||
    limpo.includes('}') ||
    limpo.includes('condicoes') ||
    limpo.includes('versao') ||
    limpo.includes('selecionadaId') ||
    limpo.includes('[object')
  ) {
    return 'Conforme acordado no orçamento';
  }

  return limpo;
};

/**
 * Extrai os cartões visuais do resumo financeiro e condições de pagamento para exibição na tela de assinatura
 * e na pré-visualização do contrato. Trata de forma inteligente entradas, parcelamentos e opções finais (ex: PIX Final).
 */
export const obterCardsResumoPagamento = (snapshot?: Partial<ContratoSnapshot> | null): ContratoCardPagamento[] => {
  if (!snapshot || !snapshot.financeiro) return [];
  const financeiro = snapshot.financeiro;
  const formasTexto = limparFormaPagamentoParaContrato(
    obterTextoCondicaoParaContrato(financeiro.formaPagamento || snapshot.orcamento?.formasPagamento) || ''
  ).trim();
  const parcelas = financeiro.parcelas || [];
  const cards: ContratoCardPagamento[] = [];

  // 1. Detectar Entrada
  const temEntradaNumerica = typeof financeiro.entrada === 'number' && financeiro.entrada > 0;
  const parcelaEntrada = parcelas.find((p) =>
    (p?.descricao || '').toLowerCase().includes('entrada') ||
    (p?.descricao || '').toLowerCase().includes('sinal')
  ) || (temEntradaNumerica && parcelas.length > 0 ? parcelas[0] : undefined);

  let entradaValor = temEntradaNumerica ? financeiro.entrada : (parcelaEntrada ? parcelaEntrada.valor : 0);
  let metodoEntrada = 'PIX';
  let isEntradaPaga = false; // Situação reflete comprovante ou registro real

  if (parcelaEntrada) {
    if (!entradaValor) entradaValor = parcelaEntrada.valor;
    if (parcelaEntrada.metodo) {
      metodoEntrada = parcelaEntrada.metodo.replace(/\s*\(Entrada\)/i, '').trim() || 'PIX';
    }
    if (parcelaEntrada.status) {
      isEntradaPaga = /quitad|pago|paga/i.test(parcelaEntrada.status);
    }
  }

  let partesTexto: string[] = [];
  if (formasTexto.includes('+')) {
    partesTexto = formasTexto.split('+').map((p) => p.trim()).filter(Boolean);
    const parteEntrada = partesTexto.find((p) => /entrada|sinal/i.test(p));
    if (parteEntrada) {
      if (/cart[aã]o/i.test(parteEntrada)) metodoEntrada = 'Cartão';
      else if (/dinheiro/i.test(parteEntrada)) metodoEntrada = 'Dinheiro';
      else if (/pix/i.test(parteEntrada)) metodoEntrada = 'PIX';
      else if (/transfer/i.test(parteEntrada)) metodoEntrada = 'Transferência';

      if (/quitad|pago|paga/i.test(parteEntrada)) {
        isEntradaPaga = true;
      }
    }
  } else if (/entrada/i.test(formasTexto)) {
    const entMatch = formasTexto.match(/entrada[^\d]*?(?:r\$)?\s*([\d.,]+)/i);
    if (entMatch && !entradaValor) {
      entradaValor = parseBrMoney(entMatch[1]);
    }
    if (/cart[aã]o/i.test(formasTexto.split(/,|e|\+/)[0])) metodoEntrada = 'Cartão';
  }

  if (entradaValor > 0) {
    cards.push({
      id: 'entrada',
      rotulo: `Entrada (${metodoEntrada}):`,
      valorFormatado: formatMoney(entradaValor),
      tipo: 'entrada',
      metodo: metodoEntrada,
      pago: isEntradaPaga,
      statusBadge: isEntradaPaga ? 'Paga' : 'A pagar',
    });
  }

  // 2. Detectar Parcelamento Recorrente (Cartão de Crédito, PIX Parcelado, Boleto)
  let qtdParcelas = 0;
  let valorParcela = 0;
  let metodoParcelamento = '';

  // Procura nas partes do compositor misto (+):
  if (partesTexto.length > 0) {
    for (const parte of partesTexto) {
      if (/entrada|sinal/i.test(parte)) continue;

      const parcMatch = parte.match(/(\d+)\s*x(?:\s+(?:de\s+)?(?:r\$)?\s*([\d.,]+))?/i);
      if (parcMatch) {
        qtdParcelas = parseInt(parcMatch[1], 10);
        if (parcMatch[2]) {
          valorParcela = parseBrMoney(parcMatch[2]);
        }
        if (/cart[aã]o/i.test(parte)) metodoParcelamento = 'Cartão de Crédito';
        else if (/pix/i.test(parte)) metodoParcelamento = 'PIX';
        else if (/boleto/i.test(parte)) metodoParcelamento = 'Boleto Bancário';
        break;
      }
    }
  }

  // Se não achou em partesTexto, procura no texto simples de formasTexto:
  if (qtdParcelas <= 1 && formasTexto) {
    const parcMatch = formasTexto.match(/(\d+)\s*x(?:\s+(?:de\s+)?(?:r\$)?\s*([\d.,]+))?/i);
    if (parcMatch) {
      qtdParcelas = parseInt(parcMatch[1], 10);
      if (parcMatch[2]) {
        valorParcela = parseBrMoney(parcMatch[2]);
      }
      if (/cart[aã]o/i.test(formasTexto)) metodoParcelamento = 'Cartão de Crédito';
      else if (/pix/i.test(formasTexto)) metodoParcelamento = 'PIX';
      else if (/boleto/i.test(formasTexto)) metodoParcelamento = 'Boleto Bancário';
    }
  }

  // Se ainda não achou, inspeciona as parcelas da snapshot:
  if (qtdParcelas <= 1 && parcelas.length > 0) {
    const parcNumerada = parcelas.find((p) => /\(\d+\/(\d+)\s*-\s*([^)]+)\)/.test(p.descricao || ''));
    if (parcNumerada && parcNumerada.descricao) {
      const matchNum = parcNumerada.descricao.match(/\(\d+\/(\d+)\s*-\s*([^)]+)\)/);
      if (matchNum) {
        qtdParcelas = parseInt(matchNum[1], 10);
        valorParcela = parcNumerada.valor;
        metodoParcelamento = matchNum[2].trim();
      }
    }
  }

  // Fallback para financeiro.quantidadeParcelas
  if (qtdParcelas <= 1 && financeiro.quantidadeParcelas && financeiro.quantidadeParcelas > 1) {
    qtdParcelas = financeiro.quantidadeParcelas;
    valorParcela = financeiro.valorParcela;
    metodoParcelamento = financeiro.metodoParcelamento || (isMetodoCartao(formasTexto) ? 'Cartão de Crédito' : 'PIX');
  }

  if (qtdParcelas > 1) {
    const isCartao = isMetodoCartao(metodoParcelamento, formasTexto);
    if (!metodoParcelamento) {
      metodoParcelamento = isCartao ? 'Cartão de Crédito' : (/pix/i.test(formasTexto) ? 'PIX' : 'Boleto Bancário');
    }

    const detalhe = isCartao
      ? 'Fatura do Cartão'
      : (formasTexto.match(/(?:vencimento|dia)\s*(?:todo\s*dia)?\s*(\d{1,2})/i)
        ? `Vencimento todo dia ${formasTexto.match(/(?:vencimento|dia)\s*(?:todo\s*dia)?\s*(\d{1,2})/i)![1]} do mês`
        : undefined);

    cards.push({
      id: 'parcelamento',
      rotulo: `Parcelamento Restante (${metodoParcelamento}):`,
      valorFormatado: `${qtdParcelas}x de ${formatMoney(valorParcela)}`,
      tipo: 'parcelamento',
      metodo: metodoParcelamento,
      detalhe,
      statusBadge: isCartao ? 'Autorizado' : undefined,
    });
  }

  // 3. Detectar a terceira opção (ex: PIX Final ou qualquer outra opção do compositor misto)
  if (partesTexto.length > 0) {
    for (const parte of partesTexto) {
      // Ignora a entrada e ignora a parte do parcelamento (com X parcelas)
      const isEntrada = /entrada|sinal/i.test(parte);
      const isParc = /(\d+)\s*x/i.test(parte);
      if (isEntrada || isParc) continue;

      // É a terceira opção (ex: "PIX Final: R$ 500,00 via PIX (em 10/11/2026)")
      const rotuloMatch = parte.match(/^([^:]+):/);
      let rotuloParte = rotuloMatch ? rotuloMatch[1].trim() : 'PIX Final';
      if (/^forma\s*\d+/i.test(rotuloParte) || /^op[çc][aã]o\s*\d+/i.test(rotuloParte)) {
        if (/pix/i.test(parte)) rotuloParte = 'PIX Final';
        else if (/saldo/i.test(parte)) rotuloParte = 'Saldo Final';
      } else if (/pix/i.test(rotuloParte) && !/final/i.test(rotuloParte)) {
        rotuloParte = 'PIX Final';
      } else if (!rotuloMatch) {
        if (/pix.*final|final.*pix/i.test(parte)) rotuloParte = 'PIX Final';
        else if (/saldo/i.test(parte)) rotuloParte = 'Saldo Final';
      }

      const valComMoeda = parte.match(/r\$\s*([\d.,]+)/i);
      const valSemMoeda = parte.match(/^[^:]+:\s*([\d.,]+)/);
      const valStr = valComMoeda ? valComMoeda[1] : (valSemMoeda ? valSemMoeda[1] : '');
      let valorParte = parseBrMoney(valStr);

      if (valorParte <= 0) {
        const saldoCalculado = financeiro.total - entradaValor - (qtdParcelas * valorParcela);
        if (saldoCalculado > 0) valorParte = saldoCalculado;
      }

      let metodoParte = 'PIX';
      if (/cart[aã]o/i.test(parte)) metodoParte = 'Cartão de Crédito';
      else if (/boleto/i.test(parte)) metodoParte = 'Boleto Bancário';
      else if (/dinheiro/i.test(parte)) metodoParte = 'Dinheiro';
      else if (/pix/i.test(parte)) metodoParte = 'PIX';

      const dataMatch = parte.match(/\(em\s*(\d{1,2}\/\d{1,2}\/\d{4})\)/i);
      const detalheParte = dataMatch ? `Vencimento em ${dataMatch[1]}` : `via ${metodoParte}`;

      const sitMatch = parte.match(/\[(?:situa[çc][aã]o:\s*)?([^\]]+)\]/i);
      const sitParte = sitMatch ? sitMatch[1].trim() : undefined;
      const isPartePaga = /quitad|pago|paga/i.test(sitParte || '');

      cards.push({
        id: `opcao_${cards.length + 1}`,
        rotulo: `${rotuloParte}:`,
        valorFormatado: formatMoney(valorParte),
        tipo: 'final',
        metodo: metodoParte,
        detalhe: detalheParte,
        statusBadge: sitParte,
        pago: isPartePaga,
      });
    }
  }

  // 4. Se NÃO houver opção final (como PIX Final) e o parcelamento NÃO for cartão
  // (ou seja, se for PIX Parcelado ou Boleto Bancário que REALMENTE precisa de vencimento na clínica)
  const temOpcaoFinal = cards.some((c) => c.tipo === 'final');
  const temCartao = cards.some((c) => c.tipo === 'parcelamento' && isMetodoCartao(c.metodo, c.detalhe));

  if (!temOpcaoFinal && !temCartao && qtdParcelas > 1) {
    const diaMatch = formasTexto.match(/(?:vencimento|dia)\s*(?:todo\s*dia)?\s*(\d{1,2})/i);
    const diaVenc = diaMatch ? diaMatch[1] : (snapshot.orcamento?.validade?.match(/\d+/) || ['10'])[0];
    cards.push({
      id: 'vencimento',
      rotulo: 'Dia de Vencimento:',
      valorFormatado: `Todo dia ${diaVenc} do mês`,
      tipo: 'vencimento',
      detalhe: 'Vencimento mensal das parcelas',
    });
  }

  // Se nenhum card foi montado (ex: pagamento à vista sem parcelamento e sem entrada)
  if (cards.length === 0) {
    cards.push({
      id: 'total',
      rotulo: 'Condição Acordada:',
      valorFormatado: formatMoney(financeiro.total),
      tipo: 'unico',
      detalhe: formasTexto || 'Pagamento Único',
    });
  }

  return cards.map((c) => ({
    ...c,
    rotulo: limparFormaPagamentoParaContrato(c.rotulo),
    metodo: c.metodo ? limparFormaPagamentoParaContrato(c.metodo) : c.metodo,
    detalhe: c.detalhe ? limparFormaPagamentoParaContrato(c.detalhe) : undefined,
  }));
};

export interface AutorizacaoAssinaturaProfissional {
  id: string;
  profissionalNome: string;
  profissionalCro: string;
  profissionalDocumento: string;
  autorizacaoExpressa: string;
  modelosAutorizados: string[];
  condicoesAbrangidas: Record<string, any>;
  assinaturaGrafica?: string | null;
  ativo: boolean;
  autorizadoEm: string;
  revogadoEm?: string | null;
  revogadoPor?: string | null;
  motivoRevogacao?: string | null;
  evidencias?: Record<string, any>;
}

export const STORAGE_KEY_AUTORIZACAO = 'sistema_clinica_autorizacao_profissional_dra_rosangela';

export async function obterAutorizacaoAtivaProfissional(cro: string = '06267-AL'): Promise<AutorizacaoAssinaturaProfissional | null> {
  // 1. Tenta Edge Function 'contrato-publico' (action: 'autorizacao_obter')
  try {
    const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('contrato-publico', {
      body: { action: 'autorizacao_obter', cro },
    });
    if (!edgeErr && edgeData?.ok) {
      if (edgeData.temAutorizacao && edgeData.autorizacao) {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(STORAGE_KEY_AUTORIZACAO, JSON.stringify(edgeData.autorizacao));
        }
        return edgeData.autorizacao;
      }
      return null;
    }
  } catch (_) {}

  // 2. Tenta RPC do PostgreSQL
  try {
    const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)('obter_autorizacao_ativa_profissional', {
      p_cro: cro,
    });
    if (!rpcErr && rpcData?.ok) {
      if (rpcData.temAutorizacao) {
        const authObj: AutorizacaoAssinaturaProfissional = {
          id: rpcData.id,
          profissionalNome: rpcData.profissionalNome,
          profissionalCro: rpcData.profissionalCro,
          profissionalDocumento: rpcData.profissionalDocumento,
          autorizacaoExpressa: rpcData.autorizacaoExpressa,
          modelosAutorizados: rpcData.modelosAutorizados || ['geral', 'lentes_resina', 'endodontia'],
          condicoesAbrangidas: rpcData.condicoesAbrangidas || { apenas_orcamentos_aprovados: true },
          assinaturaGrafica: rpcData.assinaturaGrafica,
          ativo: Boolean(rpcData.ativo),
          autorizadoEm: rpcData.autorizadoEm,
          evidencias: rpcData.evidencias,
        };
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(STORAGE_KEY_AUTORIZACAO, JSON.stringify(authObj));
        }
        return authObj;
      }
      return null;
    }
  } catch (_) {}

  // 3. Tenta consulta direta no Supabase
  try {
    const { data: authRows, error: dbErr } = await supabase
      .from('autorizacoes_assinatura_profissional')
      .select('*')
      .eq('ativo', true)
      .is('revogado_em', null)
      .order('autorizado_em', { ascending: false })
      .limit(1);

    if (!dbErr && authRows && authRows.length > 0) {
      const row = authRows[0];
      const authObj: AutorizacaoAssinaturaProfissional = {
        id: row.id,
        profissionalNome: row.profissional_nome,
        profissionalCro: row.profissional_cro,
        profissionalDocumento: row.profissional_documento,
        autorizacaoExpressa: row.autorizacao_expressa,
        modelosAutorizados: row.modelos_autorizados || ['geral', 'lentes_resina', 'endodontia'],
        condicoesAbrangidas: row.condicoes_abrangidas || { apenas_orcamentos_aprovados: true },
        assinaturaGrafica: row.assinatura_grafica,
        ativo: Boolean(row.ativo),
        autorizadoEm: row.autorizado_em,
        evidencias: row.evidencias,
      };
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEY_AUTORIZACAO, JSON.stringify(authObj));
      }
      return authObj;
    }
  } catch (_) {}

  // 4. Fallback no cache local
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AUTORIZACAO);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.ativo && !parsed.revogadoEm) {
          return parsed;
        }
      }
    } catch (_) {}
  }

  return null;
}

export function validarAutorizacaoAssinatura(
  autorizacao: AutorizacaoAssinaturaProfissional | any | null,
  modeloId: string = 'geral'
): boolean {
  if (!autorizacao) return false;
  if (!autorizacao.ativo) return false;
  if (autorizacao.revogadoEm || autorizacao.revogado_em) return false;

  const croRaw = autorizacao.profissionalCro || autorizacao.profissional_cro || '';
  const croLimpo = String(croRaw).replace(/[^0-9]/g, '');
  if (croLimpo !== '06267') return false;

  const modelos = autorizacao.modelosAutorizados || autorizacao.modelos_autorizados;
  if (Array.isArray(modelos) && modelos.length > 0) {
    const modeloNorm = modeloId.toLowerCase();
    const permite = modelos.some(
      (m: string) => m.toLowerCase() === modeloNorm || m.toLowerCase() === 'todos' || m.toLowerCase() === 'geral'
    );
    if (!permite) return false;
  }

  return true;
}

export async function concederAutorizacaoProfissional(params: {
  profissionalNome?: string;
  profissionalCro?: string;
  profissionalDocumento?: string;
  autorizacaoExpressa: string;
  modelosAutorizados?: string[];
  assinaturaGrafica?: string;
  evidencias?: Record<string, any>;
}): Promise<{ ok: boolean; autorizacao?: AutorizacaoAssinaturaProfissional; error?: string }> {
  const profissionalNome = params.profissionalNome || 'Dra. Rosângela Santos Pereira';
  const profissionalCro = params.profissionalCro || '06267-AL';
  const profissionalDocumento = params.profissionalDocumento || '032.663.962-43';
  const modelosAutorizados = params.modelosAutorizados || ['geral', 'lentes_resina', 'endodontia'];
  const nowIso = new Date().toISOString();
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'auth-' + Date.now();

  const authObj: AutorizacaoAssinaturaProfissional = {
    id,
    profissionalNome,
    profissionalCro,
    profissionalDocumento,
    autorizacaoExpressa: params.autorizacaoExpressa,
    modelosAutorizados,
    condicoesAbrangidas: { apenas_orcamentos_aprovados: true },
    assinaturaGrafica: params.assinaturaGrafica || null,
    ativo: true,
    autorizadoEm: nowIso,
    evidencias: {
      ...params.evidencias,
      timestamp: nowIso,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'web',
    },
  };

  try {
    const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('contrato-publico', {
      body: {
        action: 'autorizacao_conceder',
        profissionalNome,
        profissionalCro,
        profissionalDocumento,
        autorizacaoExpressa: params.autorizacaoExpressa,
        modelosAutorizados,
        assinaturaGrafica: params.assinaturaGrafica,
        evidencias: authObj.evidencias,
      },
    });
    if (!edgeErr && edgeData?.ok && edgeData.autorizacao?.id) {
      authObj.id = edgeData.autorizacao.id;
    }
  } catch (_) {}

  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(STORAGE_KEY_AUTORIZACAO, JSON.stringify(authObj));
    if (params.assinaturaGrafica) {
      localStorage.setItem('assinatura_padrao_dentista', params.assinaturaGrafica);
    }
    window.dispatchEvent(new Event('autorizacao-profissional-updated'));
  }

  return { ok: true, autorizacao: authObj };
}

export async function revogarAutorizacaoProfissional(
  autorizacaoId?: string,
  motivo: string = 'Revogação manual da profissional pelo painel administrativo'
): Promise<{ ok: boolean; error?: string }> {
  const nowIso = new Date().toISOString();

  try {
    await supabase.functions.invoke('contrato-publico', {
      body: {
        action: 'autorizacao_revogar',
        autorizacaoId,
        motivo,
      },
    });
  } catch (_) {}

  if (autorizacaoId) {
    try {
      await (supabase.rpc as any)('revogar_autorizacao_assinatura_profissional', {
        p_autorizacao_id: autorizacaoId,
        p_motivo: motivo,
      });
    } catch (_) {}
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AUTORIZACAO);
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.ativo = false;
        parsed.revogadoEm = nowIso;
        parsed.motivoRevogacao = motivo;
        localStorage.setItem(STORAGE_KEY_AUTORIZACAO, JSON.stringify(parsed));
      } else {
        localStorage.removeItem(STORAGE_KEY_AUTORIZACAO);
      }
      window.dispatchEvent(new Event('autorizacao-profissional-updated'));
    } catch (_) {}
  }

  return { ok: true };
}

/**
 * Gera uma assinatura vetorial caligráfica estilizada e fluida para a Dra. Responsável
 * caso nenhuma assinatura física tenha sido desenhada ou carregada previamente.
 */
export const gerarRubricaPadraoDra = (nome?: string, cro?: string): string => {
  const nomeExibicao = (nome || 'Dra. Rosangela Santos').trim();
  const croTexto = cro ? ` • CRO ${cro}` : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 100" width="380" height="100">
    <!-- Traço gestual inicial fluido da caneta -->
    <path d="M 28,60 C 42,24 64,28 76,52 C 86,70 104,66 120,46 C 138,24 154,38 170,54 C 188,72 216,48 238,44 C 265,40 295,54 322,46 C 334,42 344,34 352,40" 
          fill="none" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
    
    <!-- Assinatura caligráfica legível e refinada -->
    <text x="32" y="56" 
          font-family="'Brush Script MT', 'Dancing Script', 'Caveat', 'Great Vibes', 'Segoe Script', cursive, sans-serif" 
          font-size="30" 
          font-weight="600" 
          font-style="italic" 
          fill="#0f172a" 
          letter-spacing="0.5px">
      ${nomeExibicao}
    </text>
    
    <!-- Sublinhado orgânico de rubrica -->
    <path d="M 26,68 Q 155,80 300,66 T 352,58" 
          fill="none" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round" opacity="0.85"/>
    <path d="M 110,76 Q 205,82 320,72" 
          fill="none" stroke="#0f172a" stroke-width="1.2" stroke-linecap="round" opacity="0.45"/>
          
    <!-- Chancela digital discreta e segura -->
    <text x="32" y="88" 
          font-family="system-ui, -apple-system, sans-serif" 
          font-size="9" 
          font-weight="500" 
          fill="#059669" 
          letter-spacing="0.4px">
      ✓ Assinado Digitalmente${croTexto}
    </text>
  </svg>`.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

/**
 * Obtém ou sintetiza a assinatura padrão da Dra. Responsável para pré-assinatura
 * automática de contratos, termos e consentimentos na emissão.
 */
export const obterAssinaturaPadraoDentista = (params?: {
  dentistaNome?: string;
  dentistaCro?: string;
  emitidoEm?: string;
  configContrato?: any;
}): {
  assinaturaData: string;
  nome: string;
  cro: string;
  dataHora: string;
} => {
  const nome = params?.dentistaNome || params?.configContrato?.dentistaResponsavelContrato || 'Dra. Rosangela Santos';
  const cro = params?.dentistaCro || params?.configContrato?.croResponsavelContrato || '06267-AL';
  const dataHora = params?.emitidoEm || new Date().toISOString();

  // 1. Tenta carregar assinatura desenhada salva no localStorage ou nas configurações
  let assinaturaData = '';
  if (typeof window !== 'undefined' && window.localStorage) {
    assinaturaData =
      params?.configContrato?.assinaturaPadraoDentista ||
      localStorage.getItem('assinatura_padrao_dentista') ||
      localStorage.getItem('assinatura_padrao_doutor') ||
      '';
  }

  // 2. Se ainda não houver assinatura desenhada salva, gera a rubrica caligráfica vetorial oficial
  if (!assinaturaData) {
    assinaturaData = gerarRubricaPadraoDra(nome, cro);
  }

  return {
    assinaturaData,
    nome,
    cro,
    dataHora,
  };
};

/**
 * Mapeia os dados existentes no sistema para o modelo padronizado do contrato.
 * NUNCA inventa dados fictícios; preserva rigorosamente a integridade dos registros.
 */

/**
 * Parâmetros para geração rigorosa do cronograma financeiro do contrato
 */
export interface ParamsGerarParcelasCronograma {
  condicao: CondicaoPagamento;
  total: number;
  hoje?: Date;
  dataAprovacao?: Date | string;
  clinica?: Partial<ContratoDadosClinica>;
  contratoId?: string;
}

/**
 * Gera as linhas do cronograma financeiro conforme as 4 condições contratadas pelo paciente:
 * 1. PIX à vista (1 parcela líquida com "Pagamento Único via PIX")
 * 2. Entrada + Saldo (linha de entrada + linhas de saldo com arredondamento seguro)
 * 3. Cartão Parcelado (número real de parcelas com arredondamento seguro)
 * 4. PIX Parcelado (parcelas mensais sucessivas com QR Code por parcela)
 * A soma das parcelas corresponde rigorosamente ao valor total contratado.
 */
export function gerarParcelasCronogramaFinanceiro(params: ParamsGerarParcelasCronograma): {
  parcelas: ContratoParcela[];
  entrada: number;
  quantidadeParcelas: number;
  valorParcela: number;
  metodoParcelamento: string;
} {
  const { condicao, total, hoje = new Date(), dataAprovacao, clinica, contratoId = '' } = params;
  const diaVencPadrao = Math.min(28, Math.max(1, condicao.diaVencimento || 10));
  const dataBaseVenc = condicao.dataPrimeiroVencimento ? new Date(condicao.dataPrimeiroVencimento) : hoje;

  let parcelas: ContratoParcela[] = [];
  let entrada = 0;
  let quantidadeParcelas = 1;
  let valorParcela = total;
  let metodoParcelamento = 'PIX';

  // Identifica tipo da condição mesmo se gravada como personalizada com texto descritivo
  let tipoEfetivo = condicao.tipo || 'personalizado';
  if (tipoEfetivo === 'personalizado') {
    const descLower = (condicao.descricao || condicao.titulo || '').toLowerCase();
    if (descLower.includes('entrada') && (descLower.includes('saldo') || descLower.includes('+') || descLower.includes('restante'))) {
      tipoEfetivo = 'entrada_saldo';
    } else if (descLower.includes('pix parcelado') || descLower.includes('pix em')) {
      tipoEfetivo = 'pix_parcelado';
    } else if (descLower.includes('cartao') || descLower.includes('cartão') || descLower.includes('crédito')) {
      tipoEfetivo = 'cartao';
    } else if (descLower.includes('vista') || descLower.includes('pix')) {
      tipoEfetivo = 'a_vista';
    }
  }

  switch (tipoEfetivo) {
    case 'a_vista': {
      const valFinal = typeof condicao.valorTotal === 'number' && condicao.valorTotal > 0
        ? condicao.valorTotal
        : total;
      const dataVencVista = condicao.dataEntrada
        ? formatarData(condicao.dataEntrada)
        : (condicao.dataPrimeiroVencimento ? formatarData(condicao.dataPrimeiroVencimento) : formatarData(dataAprovacao || hoje));
      // Situação rigorosa: PIX não pode ser marcado como Quitada sem comprovação efetiva de pagamento
      const pixComprovado = Boolean(condicao.pagamentoConfirmado || condicao.pago || (condicao.situacaoEntrada === 'Quitada' && condicao.comprovado));
      const sitVista = pixComprovado ? 'Quitada' : 'Pendente';

      const p1: ContratoParcela = {
        numero: 1,
        descricao: 'Pagamento Único via PIX',
        vencimento: dataVencVista,
        valor: valFinal,
        metodo: 'PIX',
        status: sitVista,
      };

      if (sitVista !== 'Quitada' && clinica?.chavePix && clinica.chavePix !== 'Chave da clínica sob consulta' && valFinal > 0) {
        const payload = gerarPayloadPix({
          chave: clinica.chavePix,
          tipoChave: clinica.tipoChavePix,
          nomeFavorecido: clinica.favorecidoPix || clinica.nome,
          cidade: (clinica.cidade && !clinica.cidade.toUpperCase().includes('SAO PAULO')) ? clinica.cidade : 'MACEIO',
          valor: valFinal,
          descricao: `Parc 1 CTR-${contratoId}`.slice(0, 25),
        });
        p1.payloadPix = payload || undefined;
        p1.qrCodePixUrl = payload ? gerarQrCodePixUrl(payload, 280) : undefined;
      }

      parcelas = [p1];
      entrada = 0;
      quantidadeParcelas = 1;
      valorParcela = valFinal;
      metodoParcelamento = 'PIX';
      break;
    }

    case 'cartao': {
      const qtd = Math.max(1, condicao.parcelas || 1);
      const isDebito = condicao.tipoCartao === 'debito';
      const metodoNome = isDebito ? 'Cartão de Débito' : 'Cartão de Crédito';
      // Situação rigorosa: Cartão não pode ser marcado como Autorizado sem confirmação da operadora ou registro financeiro confiável
      const cartaoAutorizado = Boolean(condicao.cartaoAutorizado || condicao.autorizacaoConfirmada || condicao.nsu || condicao.codigoAutorizacao);
      const sitCartao = cartaoAutorizado ? (isDebito ? 'Quitada' : 'Autorizado') : 'Pendente';

      // Arredondamento monetário seguro: distribuição exata dos centavos
      const valBase = Math.floor((total / qtd) * 100) / 100;
      const centavos = Math.round((total - (valBase * qtd)) * 100);

      entrada = 0;
      parcelas = [];
      for (let i = 0; i < qtd; i++) {
        const valParc = Number((valBase + (i < centavos ? 0.01 : 0)).toFixed(2));
        parcelas.push({
          numero: i + 1,
          descricao: qtd === 1 ? `Pagamento em ${metodoNome}` : `Parcela ${i + 1} de ${qtd} (${metodoNome})`,
          vencimento: 'Fatura do Cartão',
          valor: valParc,
          metodo: metodoNome,
          status: sitCartao,
        });
      }
      quantidadeParcelas = qtd;
      valorParcela = parcelas[0]?.valor || Number((total / qtd).toFixed(2));
      metodoParcelamento = metodoNome;
      break;
    }

    case 'entrada_saldo': {
      const entVal = Number(condicao.valorEntrada || 0);
      const saldoTotal = Math.max(0, Number((total - entVal).toFixed(2)));
      const qtdSaldo = Math.max(1, condicao.saldoParcelas || 1);

      let mEntrada = 'PIX';
      if (condicao.metodoEntrada === 'dinheiro') mEntrada = 'Dinheiro';
      else if (condicao.metodoEntrada === 'cartao_debito') mEntrada = 'Cartão de Débito';
      else if (condicao.metodoEntrada === 'cartao_credito') mEntrada = 'Cartão de Crédito';
      else if (condicao.metodoEntrada === 'transferencia') mEntrada = 'Transferência Bancária';

      let mSaldo = 'Cartão de Crédito';
      if (condicao.saldoMetodo === 'pix_parcelado') mSaldo = 'PIX Parcelado';
      else if (condicao.saldoMetodo === 'boleto') mSaldo = 'Boleto Bancário';
      else if (condicao.saldoMetodo === 'conclusao') mSaldo = 'Na Conclusão do Tratamento';

      const isCartaoSaldo = isMetodoCartao(mSaldo);
      const isPixSaldo = isMetodoPix(mSaldo);
      const dataEntradaFmt = condicao.dataEntrada ? formatarData(condicao.dataEntrada) : formatarData(hoje);
      // Situações refletindo pagamentos efetivamente registrados
      const entComprovada = Boolean(condicao.entradaConfirmada || condicao.pagamentoConfirmado || condicao.pago || (condicao.situacaoEntrada === 'Quitada' && condicao.comprovado));
      const sitEntrada = entComprovada ? 'Quitada' : 'Pendente';

      const cartaoSaldoAut = isCartaoSaldo && Boolean(condicao.cartaoAutorizado || condicao.autorizacaoConfirmada || condicao.nsu || condicao.codigoAutorizacao);
      const outroSaldoComprovado = !isCartaoSaldo && Boolean(condicao.saldoConfirmado || condicao.pagamentoConfirmado || condicao.pago || (condicao.situacaoSaldo === 'Quitado' && condicao.comprovado));
      const sitSaldoPadrao = isCartaoSaldo
        ? (cartaoSaldoAut ? 'Autorizado' : 'Pendente')
        : (outroSaldoComprovado ? 'Quitada' : 'Pendente');

      entrada = entVal;
      parcelas = [];

      // Linha 1: Entrada
      if (entVal > 0) {
        const pEntrada: ContratoParcela = {
          numero: 1,
          descricao: `Entrada Inicial (${mEntrada})`,
          vencimento: dataEntradaFmt,
          valor: entVal,
          metodo: mEntrada,
          status: sitEntrada,
        };

        if (sitEntrada !== 'Quitada' && isMetodoPix(mEntrada) && clinica?.chavePix && clinica.chavePix !== 'Chave da clínica sob consulta' && entVal > 0) {
          const pay = gerarPayloadPix({
            chave: clinica.chavePix,
            tipoChave: clinica.tipoChavePix,
            nomeFavorecido: clinica.favorecidoPix || clinica.nome,
            cidade: (clinica.cidade && !clinica.cidade.toUpperCase().includes('SAO PAULO')) ? clinica.cidade : 'MACEIO',
            valor: entVal,
            descricao: `Entrada CTR-${contratoId}`.slice(0, 25),
          });
          pEntrada.payloadPix = pay || undefined;
          pEntrada.qrCodePixUrl = pay ? gerarQrCodePixUrl(pay, 280) : undefined;
        }

        parcelas.push(pEntrada);
      }

      // Linhas do Saldo com arredondamento monetário seguro
      const valBaseSaldo = Math.floor((saldoTotal / qtdSaldo) * 100) / 100;
      const centavosSaldo = Math.round((saldoTotal - (valBaseSaldo * qtdSaldo)) * 100);

      for (let i = 0; i < qtdSaldo; i++) {
        const valParc = Number((valBaseSaldo + (i < centavosSaldo ? 0.01 : 0)).toFixed(2));
        let venc = '';
        if (isCartaoSaldo) {
          venc = 'Fatura do Cartão';
        } else if (mSaldo.toLowerCase().includes('conclus')) {
          venc = 'Na Conclusão do Tratamento';
        } else {
          venc = formatarData(somarMesesSeguro(dataBaseVenc, i + 1, diaVencPadrao));
        }

        const descSaldo = qtdSaldo === 1
          ? `Saldo Restante (${mSaldo})`
          : `Saldo Restante (${i + 1}/${qtdSaldo} - ${mSaldo})`;

        const pSaldo: ContratoParcela = {
          numero: parcelas.length + 1,
          descricao: descSaldo,
          vencimento: venc,
          valor: valParc,
          metodo: mSaldo,
          status: sitSaldoPadrao,
        };

        if (sitSaldoPadrao !== 'Quitada' && isPixSaldo && clinica?.chavePix && clinica.chavePix !== 'Chave da clínica sob consulta' && valParc > 0) {
          const pay = gerarPayloadPix({
            chave: clinica.chavePix,
            tipoChave: clinica.tipoChavePix,
            nomeFavorecido: clinica.favorecidoPix || clinica.nome,
            cidade: (clinica.cidade && !clinica.cidade.toUpperCase().includes('SAO PAULO')) ? clinica.cidade : 'MACEIO',
            valor: valParc,
            descricao: `Parc ${pSaldo.numero} CTR-${contratoId}`.slice(0, 25),
          });
          pSaldo.payloadPix = pay || undefined;
          pSaldo.qrCodePixUrl = pay ? gerarQrCodePixUrl(pay, 280) : undefined;
        }

        parcelas.push(pSaldo);
      }

      quantidadeParcelas = qtdSaldo;
      valorParcela = parcelas.find((p) => !p.descricao.toLowerCase().includes('entrada'))?.valor || saldoTotal;
      metodoParcelamento = mSaldo;
      break;
    }

    case 'pix_parcelado': {
      const qtd = Math.max(1, condicao.parcelas || 1);
      const pixSaldoPago = Boolean(condicao.saldoConfirmado || condicao.pagamentoConfirmado || condicao.pago || (condicao.situacaoSaldo === 'Quitado' && condicao.comprovado));
      const sitPadrao = pixSaldoPago ? 'Quitada' : 'Pendente';

      // Arredondamento monetário seguro
      const valBase = Math.floor((total / qtd) * 100) / 100;
      const centavos = Math.round((total - (valBase * qtd)) * 100);

      entrada = 0;
      parcelas = [];
      for (let i = 0; i < qtd; i++) {
        const valParc = Number((valBase + (i < centavos ? 0.01 : 0)).toFixed(2));
        const venc = condicao.dataPrimeiroVencimento && i === 0
          ? formatarData(condicao.dataPrimeiroVencimento)
          : formatarData(somarMesesSeguro(dataBaseVenc, i + 1, diaVencPadrao));

        const pItem: ContratoParcela = {
          numero: i + 1,
          descricao: `Parcela ${i + 1} de ${qtd} (PIX Parcelado)`,
          vencimento: venc,
          valor: valParc,
          metodo: 'PIX Parcelado',
          status: sitPadrao,
        };

        if (sitPadrao !== 'Quitada' && clinica?.chavePix && clinica.chavePix !== 'Chave da clínica sob consulta' && valParc > 0) {
          const pay = gerarPayloadPix({
            chave: clinica.chavePix,
            tipoChave: clinica.tipoChavePix,
            nomeFavorecido: clinica.favorecidoPix || clinica.nome,
            cidade: (clinica.cidade && !clinica.cidade.toUpperCase().includes('SAO PAULO')) ? clinica.cidade : 'MACEIO',
            valor: valParc,
            descricao: `Parc ${i + 1} CTR-${contratoId}`.slice(0, 25),
          });
          pItem.payloadPix = pay || undefined;
          pItem.qrCodePixUrl = pay ? gerarQrCodePixUrl(pay, 280) : undefined;
        }

        parcelas.push(pItem);
      }
      quantidadeParcelas = qtd;
      valorParcela = parcelas[0]?.valor || Number((total / qtd).toFixed(2));
      metodoParcelamento = 'PIX Parcelado';
      break;
    }

    default: {
      if (condicao.formasCompostas && condicao.formasCompostas.length > 0) {
        parcelas = [];
        entrada = 0;
        for (const fc of condicao.formasCompostas) {
          const rotulo = fc.rotulo || 'Parcela';
          const val = Number(fc.valor || 0);
          const qtdP = Math.max(1, fc.parcelas || 1);
          const isEnt = rotulo.toLowerCase().includes('entrada') || /entrada/i.test(fc.rotulo);
          if (isEnt) entrada += val;

          let m = 'PIX';
          if (fc.metodo === 'cartao') m = fc.tipoCartao === 'debito' ? 'Cartão de Débito' : 'Cartão de Crédito';
          else if (fc.metodo === 'dinheiro') m = 'Dinheiro';
          else if (fc.metodo === 'boleto') m = 'Boleto Bancário';
          else if (fc.metodo === 'pix_parcelado') m = 'PIX Parcelado';
          else if (fc.metodo === 'transferencia') m = 'Transferência';

          const isCart = isMetodoCartao(m);
          const valBase = Math.floor((val / qtdP) * 100) / 100;
          const centavos = Math.round((val - (valBase * qtdP)) * 100);

          for (let j = 0; j < qtdP; j++) {
            const venc = isCart ? 'Fatura do Cartão' : formatarData(somarMesesSeguro(dataBaseVenc, j + 1, diaVencPadrao));
            const valUnit = Number((valBase + (j < centavos ? 0.01 : 0)).toFixed(2));
            parcelas.push({
              numero: parcelas.length + 1,
              descricao: qtdP > 1 ? `${rotulo} (${j + 1}/${qtdP} - ${m})` : `${rotulo} (${m})`,
              vencimento: venc,
              valor: valUnit,
              metodo: m,
              status: isCart
                ? (Boolean(fc.cartaoAutorizado || fc.autorizacaoConfirmada || fc.nsu || fc.codigoAutorizacao) ? 'Autorizado' : 'Pendente')
                : (Boolean(fc.pago || fc.quitado || (fc.situacao === 'Quitada' && fc.comprovado)) ? 'Quitada' : 'Pendente'),
            });
          }
        }
        quantidadeParcelas = parcelas.length;
        valorParcela = parcelas[0]?.valor || total;
        metodoParcelamento = parcelas[0]?.metodo || 'PIX';
      }
      break;
    }
  }

  // Validação matemática estrita de soma: garante fechamento com total exato
  if (parcelas.length > 0) {
    const soma = parcelas.reduce((acc, p) => acc + p.valor, 0);
    const diff = Number((total - soma).toFixed(2));
    if (Math.abs(diff) > 0 && Math.abs(diff) <= 0.1) {
      parcelas[parcelas.length - 1].valor = Number((parcelas[parcelas.length - 1].valor + diff).toFixed(2));
    }
  }

  return {
    parcelas,
    entrada,
    quantidadeParcelas,
    valorParcela,
    metodoParcelamento,
  };
}

/**
 * Validação rigorosa do cronograma financeiro do contrato antes de qualquer emissão.
 * Se faltar condição aprovada ou dados obrigatórios, exibe erros claros e bloqueia.
 */
export function validarCronogramaFinanceiroContrato(
  snapshot: ContratoSnapshot | Partial<ContratoSnapshot> | null | undefined
): {
  valido: boolean;
  erros: string[];
} {
  const erros: string[] = [];
  if (!snapshot) {
    return { valido: false, erros: ['Snapshot do contrato inexistente.'] };
  }

  const fin = snapshot.financeiro;
  if (!fin) {
    return { valido: false, erros: ['Dados financeiros do contrato não encontrados.'] };
  }

  const total = Number(fin.total ?? fin.valorTotal ?? 0);
  if (total <= 0) {
    erros.push('Valor total do contrato deve ser maior que zero');
  }

  const parcelas = fin.parcelas;
  if (!Array.isArray(parcelas) || parcelas.length === 0) {
    erros.push('O cronograma financeiro está vazio: nenhuma parcela foi preenchida');
  } else {
    const soma = parcelas.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
    if (Math.abs(soma - total) > 0.05) {
      erros.push(`A soma das parcelas (${formatMoney(soma)}) diverge do total do contrato (${formatMoney(total)})`);
    }

    parcelas.forEach((p, idx) => {
      if (typeof p.valor !== 'number' || p.valor <= 0) {
        erros.push(`Parcela ${p.numero || idx + 1} possui valor inválido (${p.valor})`);
      }
      if (!p.descricao || /a\s*combinar/i.test(p.descricao) || p.descricao === 'Condição de Pagamento') {
        erros.push(`Parcela ${p.numero || idx + 1} com descrição indefinida`);
      }
      if (!p.vencimento || p.vencimento === '-' || /a\s*combinar/i.test(p.vencimento)) {
        erros.push(`Parcela ${p.numero || idx + 1} sem data de vencimento definida`);
      }
    });
  }

  const forma = String(fin.formaPagamento || '').trim();
  if (!forma || /a\s*combinar/i.test(forma) || /a\s*definir/i.test(forma) || /^condi[çc][aã]o de pagamento$/i.test(forma)) {
    erros.push('Condição de pagamento aprovada não foi especificada (consta "A combinar" ou "Condição de Pagamento")');
  }

  return {
    valido: erros.length === 0,
    erros,
  };
}

export const mapearDadosContrato = ({
  patient,
  orcamento,
  transacoes = [],
  configuracoes,
  configuracoesContrato,
  configContrato,
  dentistaNome,
  dentistaCro,
  cidadeLocal = 'Maceió',
  incluiLentesResina,
  tipoModeloContrato,
  dadosRestauracoesPreexistentes,
  dadosEndodontia,
  parceiro,
  termoUsoImagem,
  assinaturaDentista,
  autorizacaoProfissional,
}: {
  patient: Partial<Paciente> | any;
  orcamento: Orcamento | any;
  transacoes?: Transacao[] | any[];
  configuracoes?: Partial<ConfiguracoesGerais> | any;
  configuracoesContrato?: Partial<ConfiguracoesContrato> | any;
  configContrato?: Partial<ConfiguracoesContrato> | any;
  dentistaNome?: string;
  dentistaCro?: string;
  cidadeLocal?: string;
  incluiLentesResina?: boolean;
  tipoModeloContrato?: TipoModeloContrato;
  dadosRestauracoesPreexistentes?: AvaliacaoRestauracoesPreexistentes;
  dadosEndodontia?: ContratoDadosEndodontia;
  parceiro?: ContratoDadosParceiro;
  termoUsoImagem?: ContratoTermoUsoImagem;
  assinaturaDentista?: any;
  autorizacaoProfissional?: AutorizacaoAssinaturaProfissional | null;
}): ContratoSnapshot => {
  const emitidoEmData = new Date();
  const emitidoEm = emitidoEmData.toISOString();
  const contratoId = `CTR-${orcamento?.id ? orcamento.id.slice(0, 8).toUpperCase() : Date.now().toString(36).toUpperCase()}`;

  const cfgParam = configuracoesContrato || configContrato;
  const cfgContrato = (cfgParam && Object.keys(cfgParam).length > 0)
    ? cfgParam
    : carregarConfiguracoesContratoSync(null, configuracoes);

  // 1. Dados cadastrais do Paciente
  const enderecoCompleto = formatarEnderecoCompleto(patient) || (typeof patient?.endereco === 'string' && temValorValido(patient.endereco) ? patient.endereco.trim() : '');
  const dadosPaciente: ContratoDadosPaciente = {
    id: patient?.id || '',
    nome: patient?.nome || 'Nome não informado',
    cpf: temValorValido(patient?.cpf) ? formatarDocumento(patient.cpf) : (patient?.cpf || 'Não informado'),
    rg: temValorValido(patient?.rg) ? String(patient.rg).trim() : '',
    dataNascimento: formatarData(patient?.dataNascimento || patient?.data_nascimento),
    idade: patient?.idade ? `${patient.idade} anos` : 'Não informada',
    endereco: enderecoCompleto || 'Não informado',
    telefone: temValorValido(patient?.telefone) ? formatarTelefone(patient.telefone) : (patient?.telefone || 'Não informado'),
    email: patient?.email || 'Não informado',
    profissao: temValorValido(patient?.profissao) ? String(patient.profissao).trim() : '',
    estadoCivil: temValorValido(patient?.estadoCivil || patient?.estado_civil) ? String(patient.estadoCivil || patient.estado_civil).trim() : '',
  };

  const cidadeLimpa = cidadeLocal && !cidadeLocal.toLowerCase().includes('são paulo') && !cidadeLocal.toLowerCase().includes('sao paulo')
    ? cidadeLocal
    : (cfgContrato.cidadeForoContrato || 'Maceió');
  const cidadeDefinida = cidadeLimpa && !cidadeLimpa.toLowerCase().includes('são paulo') && !cidadeLimpa.toLowerCase().includes('sao paulo')
    ? cidadeLimpa
    : 'Maceió';

  // 2. Dados da Contratada extraídos obrigatoriamente de Configurações → Contrato & PIX
  const dadosClinica: ContratoDadosClinica = {
    nome: cfgContrato.nomeClinicaContrato?.trim() || configuracoes?.nomeClinica?.trim() || 'Clínica Odontológica',
    cnpj: cfgContrato.cnpjClinicaContrato?.trim() || configuracoes?.cnpj?.trim() || 'Não informado',
    cro: cfgContrato.croResponsavelContrato?.trim() || configuracoes?.croResponsavel?.trim() || dentistaCro?.trim() || 'CRO sob consulta',
    endereco: cfgContrato.enderecoContrato?.trim() || configuracoes?.endereco?.trim() || 'Endereço da clínica',
    telefone: cfgContrato.telefoneContrato?.trim() || configuracoes?.telefone?.trim() || configuracoes?.whatsappNumero?.trim() || 'Não informado',
    email: cfgContrato.emailContrato?.trim() || configuracoes?.email?.trim() || 'Não informado',
    logoUrl: configuracoes?.logoUrl || undefined,
    cidade: cidadeDefinida,
    dentistaResponsavel: cfgContrato.dentistaResponsavelContrato?.trim() || configuracoes?.dentistaResponsavel?.trim() || dentistaNome?.trim() || 'Cirurgião-Dentista Responsável',
    chavePix: cfgContrato?.chavePix?.trim() || '',
    tipoChavePix: cfgContrato?.tipoChavePix || 'telefone',
    favorecidoPix: cfgContrato?.favorecidoPix?.trim() || cfgContrato?.nomeClinicaContrato?.trim() || configuracoes?.nomeClinica?.trim() || 'Titular da Conta',
    cnpjCpfFavorecidoPix: cfgContrato?.cnpjCpfFavorecidoPix?.trim() || cfgContrato?.cnpjClinicaContrato?.trim() || configuracoes?.cnpj?.trim() || '',
    bancoPix: cfgContrato?.bancoPix?.trim() || '',
    instrucoesPix: cfgContrato?.instrucoesPix?.trim() || 'O(A) CONTRATANTE poderá utilizar a câmera do smartphone para leitura do QR Code acima ou efetuar a transferência direta para a chave informada, encaminhando o comprovante para confirmação da baixa da parcela.',
  };

  // 3. Procedimentos aprovados do Orçamento
  const itensOrcamento: ContratoItem[] = (orcamento?.itens || []).map((item: any) => {
    const nome = String(item?.nome || 'Procedimento odontológico');
    const quantidade = Number(item?.quantidade || 1);
    const valorUnitario = Number(item?.valor || 0);
    const valorTotal = valorUnitario * quantidade;

    // Detecta menção a dente ou região se presente na descrição (ex.: "Dente 16", "Região anterior")
    const denteMatch = nome.match(/(?:dente|elemento|regi[aã]o)\s*([0-9a-zA-Z\s-]+)/i);
    const denteOuRegiao = denteMatch ? denteMatch[0] : undefined;

    return {
      nome,
      quantidade,
      valorUnitario,
      valorTotal,
      denteOuRegiao,
    };
  });

  const subtotal = itensOrcamento.reduce((acc, i) => acc + i.valorTotal, 0);
  const desconto = Number(orcamento?.desconto || 0);
  const total = Number(orcamento?.total ?? Math.max(0, subtotal - desconto));
  const totalExtenso = valorPorExtenso(total);

  const dadosOrcamento: ContratoDadosOrcamento = {
    id: orcamento?.id || '',
    numeroIdentificador: orcamento?.id ? orcamento.id.slice(0, 8).toUpperCase() : 'S/N',
    titulo: orcamento?.titulo || 'Plano de Tratamento Odontológico',
    subtotal,
    desconto,
    total,
    totalExtenso,
    formasPagamento: limparFormaPagamentoParaContrato(
      obterTextoCondicaoParaContrato(orcamento?.formasPagamento || orcamento?.formas_pagamento) || 'Conforme acordado entre as partes'
    ),
    validade: formatarData(orcamento?.validade),
    dataAprovacao: formatarData(orcamento?.atualizadoEm || orcamento?.criadoEm),
    itens: itensOrcamento,
    observacoes: orcamento?.observacoes || undefined,
  };

  // 4. Dados Financeiros e Cronograma de Parcelas
  // Prioridade 1: buscar transações vinculadas ao orçamento (receitas) consistentes
  const transacoesOrcamento = (transacoes || []).filter(
    (t: any) => t?.orcamentoId === orcamento?.id && t?.tipo === 'receita'
  );

  let parcelas: ContratoParcela[] = [];
  let entrada = 0;
  let parcelamentoQtdDetectada = 0;
  let parcelamentoValorDetectado = 0;
  let parcelamentoMetodoDetectado = '';

  // Extrai a condição de pagamento estruturada e aprovada com rastreabilidade total
  const formasRaw = orcamento?.formasPagamento || orcamento?.formas_pagamento || '';
  const condicoesParsed = parseCondicoesPagamento(formasRaw, total);
  const condicaoAtiva: CondicaoPagamento | null =
    extrairCondicaoEscolhida(orcamento) ||
    ('condicaoEscolhida' in orcamento && orcamento.condicaoEscolhida) ||
    obterCondicaoAtiva(condicoesParsed);

  // Validação rigorosa de consistência das transações com o orçamento:
  const somaTransacoes = transacoesOrcamento.reduce((acc, t) => acc + (Number(t.valor) || 0), 0);
  const temValorZeradoOuSuspeito = transacoesOrcamento.some((t: any) => Number(t.valor) < 0.5 && total > 10);
  const transacoesConsistentes =
    transacoesOrcamento.length > 0 &&
    Math.abs(somaTransacoes - total) < 0.5 &&
    !temValorZeradoOuSuspeito;

  const hoje = new Date();

  if (transacoesConsistentes) {
    // 4.1 Utiliza transações consistentes sincronizadas no financeiro
    const ordenadas = [...transacoesOrcamento].sort(
      (a, b) => new Date(a.vencimento || a.data).getTime() - new Date(b.vencimento || b.data).getTime()
    );

    parcelas = ordenadas.map((t, idx) => {
      const valor = Number(t.valor || 0);
      const isEntrada = (t?.descricao || '').toLowerCase().includes('entrada') || (idx === 0 && t?.status === 'pago');
      if (isEntrada && entrada === 0) {
        entrada = valor;
      }

      const isCartao = isMetodoCartao(t?.metodoPagamento, t?.descricao);
      const vencFormatado = isCartao ? 'Fatura do Cartão' : formatarData(t?.vencimento || t?.data);

      return {
        numero: idx + 1,
        descricao: t?.descricao || `Parcela ${idx + 1}`,
        vencimento: vencFormatado,
        valor,
        metodo: t?.metodoPagamento || (isCartao ? 'Cartão de Crédito' : 'PIX'),
        status: isCartao
          ? (t?.status === 'pago' ? 'Quitada' : 'Autorizado')
          : (t?.status === 'pago' ? 'Quitada' : t?.status === 'vencido' ? 'Vencida' : 'A vencer'),
      };
    });

    const parcelasSemEntradaLocal = parcelas.filter((p) => !(p?.descricao || '').toLowerCase().includes('entrada'));
    parcelamentoQtdDetectada = parcelasSemEntradaLocal.length || parcelas.length;
    if (parcelasSemEntradaLocal.length > 0) {
      parcelamentoValorDetectado = parcelasSemEntradaLocal[0].valor;
      parcelamentoMetodoDetectado = parcelasSemEntradaLocal[0].metodo;
    }
  } else if (condicaoAtiva) {
    // 4.2 Utiliza exclusivamente a condição de pagamento estruturada aprovada pelo paciente
    const cronoGerado = gerarParcelasCronogramaFinanceiro({
      condicao: condicaoAtiva,
      total,
      hoje,
      dataAprovacao: orcamento?.atualizadoEm || orcamento?.criadoEm,
      clinica: dadosClinica,
      contratoId,
    });
    parcelas = cronoGerado.parcelas;
    entrada = cronoGerado.entrada;
    parcelamentoQtdDetectada = cronoGerado.quantidadeParcelas;
    parcelamentoValorDetectado = cronoGerado.valorParcela;
    parcelamentoMetodoDetectado = cronoGerado.metodoParcelamento;
  } else {
    // 4.3 Fallback histórico para orçamentos legados de texto livre
    const formas = obterTextoCondicaoParaContrato(orcamento?.formasPagamento || orcamento?.formas_pagamento || '');
    const hoje = new Date();

    // Se possui múltiplas formas separadas por '+' (Compositor de Pagamento Misto)
    parcelamentoQtdDetectada = 0;
    parcelamentoValorDetectado = 0;
    parcelamentoMetodoDetectado = '';

    if (formas.includes('+')) {
      const partes = formas.split('+').map((p) => p.trim()).filter(Boolean);
      const listaMultiplas: ContratoParcela[] = [];
      let entradaDetectada = 0;

      for (const parte of partes) {
        const rotuloMatch = parte.match(/^([^:]+):/);
        const rotulo = rotuloMatch ? rotuloMatch[1].trim() : (/entrada/i.test(parte) ? 'Entrada' : 'Parcela');
        const conteudo = rotuloMatch ? parte.slice(rotuloMatch[0].length).trim() : parte.trim();

        const isEntrada = /entrada/i.test(rotulo) || (/entrada/i.test(parte) && !parte.includes('+'));
        const isACombinar = /a combinar|a definir|pendente/i.test(conteudo) || /a combinar|a definir|pendente/i.test(parte);

        let metodo = 'PIX';
        if (isACombinar) metodo = 'A combinar';
        else if (/cart[aã]o/i.test(conteudo) || /cart[aã]o/i.test(parte)) metodo = 'Cartão de Crédito';
        else if (/boleto/i.test(conteudo) || /boleto/i.test(parte)) metodo = 'Boleto Bancário';
        else if (/pix\s*parcelado/i.test(conteudo) || /pix\s*parcelado/i.test(parte)) metodo = 'PIX Parcelado';
        else if (/pix/i.test(conteudo) || /pix/i.test(parte)) metodo = 'PIX';
        else if (/dinheiro/i.test(conteudo) || /dinheiro/i.test(parte)) metodo = 'Dinheiro';
        else if (/transfer[eê]ncia/i.test(conteudo) || /transfer[eê]ncia/i.test(parte)) metodo = 'Transferência';

        // Detecta parcelas e valores explícitos no conteúdo (nunca no rótulo!)
        const parcMatch = conteudo.match(/(\d+)\s*x(?:\s+(?:de\s+)?(?:r\$)?\s*([\d.,]+))?/i);
        const qtdParc = parcMatch ? Math.max(1, parseInt(parcMatch[1], 10)) : 1;
        const valParcExpl = parcMatch && parcMatch[2] ? parseBrMoney(parcMatch[2]) : 0;

        // Procura primeiro por "R$ valor" no conteúdo após o rótulo
        const valComMoedaMatch = conteudo.match(/r\$\s*([\d.,]+)/i);
        const valSemMoedaMatch = conteudo.match(/^([\d.,]+)/);
        const valStr = valComMoedaMatch ? valComMoedaMatch[1] : (valSemMoedaMatch ? valSemMoedaMatch[1] : '');
        let valorTotalParte = parseBrMoney(valStr);

        // Se houver parcelamento explícito (ex: 10x de R$ 370,90) e o valor total não foi detectado ou for menor que a parcela:
        if (qtdParc > 1 && valParcExpl > 0) {
          if (valorTotalParte <= 0 || valorTotalParte < valParcExpl) {
            valorTotalParte = valParcExpl * qtdParc;
          }
        }

        const valorParc = qtdParc > 1
          ? (valParcExpl > 0 ? valParcExpl : (valorTotalParte / qtdParc))
          : valorTotalParte;

        if (qtdParc > 1) {
          parcelamentoQtdDetectada = qtdParc;
          parcelamentoValorDetectado = valorParc;
          parcelamentoMetodoDetectado = metodo;
        }

        // Datas de vencimento para essa parte
        const datasParte: string[] = [];
        const trechoVenc = conteudo.match(/vencimentos?(?:\s*todo\s*dia\s*\d{1,2})?:\s*([^\)]+)/i);
        if (trechoVenc) {
          const regexDatas = /\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g;
          const matches = trechoVenc[1].match(regexDatas);
          if (matches) {
            datasParte.push(...matches.map((d) => (d.includes('-') ? formatarData(d) : d)));
          }
        }

        // Data única (em DD/MM/YYYY)
        const dataUnicaMatch = conteudo.match(/\(em\s*(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\)/i);
        const dataUnica = dataUnicaMatch
          ? (dataUnicaMatch[1].includes('-') ? formatarData(dataUnicaMatch[1]) : dataUnicaMatch[1])
          : formatarData(hoje);

        if (isEntrada) {
          entradaDetectada += valorTotalParte;
        }

        // Detecta situação se explicitada: ex: [Quitada], [A vencer], [Autorizado], [Pago]
        const sitMatch = parte.match(/\[(?:situa[çc][aã]o:\s*)?([^\]]+)\]/i);
        let situacaoDetectada = '';
        const situacoesIndividuais: string[] = [];

        if (sitMatch) {
          const rawSit = sitMatch[1].trim();
          if (rawSit.includes(',')) {
            const partesSit = rawSit.split(',').map((s) => s.trim());
            for (const ps of partesSit) {
              if (/quitad|pago|paga/i.test(ps)) situacoesIndividuais.push('Quitada');
              else if (/autoriz/i.test(ps)) situacoesIndividuais.push('Autorizado');
              else if (/vencid/i.test(ps)) situacoesIndividuais.push('Vencida');
              else situacoesIndividuais.push('A vencer');
            }
          } else {
            if (/quitad|pago|paga/i.test(rawSit)) situacaoDetectada = 'Quitada';
            else if (/autoriz/i.test(rawSit)) situacaoDetectada = 'Autorizado';
            else if (/vencid/i.test(rawSit)) situacaoDetectada = 'Vencida';
            else if (/vencer|pend/i.test(rawSit)) situacaoDetectada = 'A vencer';
          }
        }

        const isCartao = isMetodoCartao(metodo, rotulo) || isMetodoCartao(metodo, conteudo);

        if (qtdParc > 1) {
          const diaMatch = conteudo.match(/(?:vencimento|dia)\s*(?:todo\s*dia)?\s*(\d{1,2})/i);
          const diaVenc = diaMatch ? Math.min(28, Math.max(1, parseInt(diaMatch[1], 10))) : 10;

          for (let i = 0; i < qtdParc; i++) {
            let venc = '';
            if (isCartao) {
              venc = 'Fatura do Cartão';
            } else {
              venc = datasParte[i];
              if (!venc) {
                const dataVenc = somarMesesSeguro(hoje, i + 1, diaVenc);
                venc = formatarData(dataVenc);
              }
            }
            const sitFinal = situacoesIndividuais[i] || situacaoDetectada || 'Pendente';
            listaMultiplas.push({
              numero: listaMultiplas.length + 1,
              descricao: `${rotulo} (${i + 1}/${qtdParc} - ${metodo})`,
              vencimento: venc,
              valor: valorParc,
              metodo,
              status: sitFinal,
            });
          }
        } else {
          const sitFinal = isACombinar ? 'Pendente' : (situacaoDetectada || 'Pendente');
          const vencFinal = isACombinar ? 'A combinar' : (isCartao && !isEntrada ? 'Fatura do Cartão' : dataUnica);
          listaMultiplas.push({
            numero: listaMultiplas.length + 1,
            descricao: isEntrada ? `${rotulo} (${metodo})` : `${rotulo} (${metodo})`,
            vencimento: vencFinal,
            valor: valorTotalParte,
            metodo,
            status: sitFinal,
          });
        }
      }

      if (listaMultiplas.length > 0) {
        entrada = entradaDetectada;
        parcelas = listaMultiplas;
      }
    }

    if (parcelas.length === 0) {
      // 1. Detecta Entrada (ex: "Entrada de R$ 500,00", "Entrada: R$ 500", "Entrada: R$ 500,00 via PIX")
      const entradaComMoeda = formas.match(/entrada[^\d\n\r]*?(?:de|:)?\s*(?:r\$)\s*([\d.,]+)/i);
      const entradaSemMoeda = formas.match(/entrada(?:\s*(?:de|:))?\s*([\d.,]+)/i);
      const entradaMatch = entradaComMoeda || entradaSemMoeda;
      let entradaDetectada = 0;
      if (entradaMatch) {
        entradaDetectada = parseBrMoney(entradaMatch[1]);
      }
      entrada = entradaDetectada;

      // Detecta método da entrada
      const parteEntrada = formas.split(/\+|\be\b/i)[0] || '';
      let metodoEntrada = 'PIX (Entrada)';
      if (/cart[aã]o/i.test(parteEntrada)) metodoEntrada = 'Cartão (Entrada)';
      else if (/dinheiro/i.test(parteEntrada)) metodoEntrada = 'Dinheiro (Entrada)';
      else if (/transfer[eê]ncia/i.test(parteEntrada)) metodoEntrada = 'Transferência (Entrada)';
      else if (/pix/i.test(parteEntrada)) metodoEntrada = 'PIX (Entrada)';

      // 2. Detecta Qtd. de Parcelas e Valor da Parcela: ex: "4x de R$ 250,00", "3x", "4 parcelas"
      const parcValorMatch = formas.match(/(\d+)\s*x(?:\s+(?:de\s+)?(?:r\$)?\s*([\d.,]+))?/i) || formas.match(/(\d+)\s*parcelas/i);
      const qtdParcelas = parcValorMatch ? Math.max(1, parseInt(parcValorMatch[1], 10)) : 1;
      const valParcExpl = parcValorMatch && parcValorMatch[2] ? parseBrMoney(parcValorMatch[2]) : 0;

      // Detecta se há datas específicas discriminadas:
      const datasDetectadas: string[] = [];
      const trechoVencimentos = formas.match(/vencimentos?(?:\s*todo\s*dia\s*\d{1,2})?:\s*([^\)]+)/i);
      if (trechoVencimentos) {
        const regexDatas = /\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g;
        const matches = trechoVencimentos[1].match(regexDatas);
        if (matches) {
          datasDetectadas.push(...matches.map((d) => (d.includes('-') ? formatarData(d) : d)));
        }
      }

      // Detecta se há data específica para a entrada:
      const dataEntradaMatch = formas.match(/entrada[^\+]*?(?:em|\:)?\s*\(?em\s*(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\)?/i);
      const dataEntradaFormatada = dataEntradaMatch
        ? (dataEntradaMatch[1].includes('-') ? formatarData(dataEntradaMatch[1]) : dataEntradaMatch[1])
        : formatarData(hoje);

      // 3. Detecta Dia do Vencimento:
      const diaMatch = formas.match(/(?:vencimento|dia)\s*(?:todo\s*dia)?\s*(\d{1,2})/i);
      const diaVencimento = diaMatch ? Math.min(28, Math.max(1, parseInt(diaMatch[1], 10))) : 10;

      // Detecta método do restante/parcelas
      const parteRestante = formas.includes('+') ? formas.split('+').slice(1).join('+') : formas;
      let metodoRestante = 'A definir';
      if (/cart[aã]o/i.test(parteRestante)) metodoRestante = 'Cartão de Crédito';
      else if (/boleto/i.test(parteRestante)) metodoRestante = 'Boleto Bancário';
      else if (/pix/i.test(parteRestante)) metodoRestante = 'PIX Parcelado';
      else if (/dinheiro/i.test(parteRestante)) metodoRestante = 'Dinheiro';
      else if (/transfer[eê]ncia/i.test(parteRestante)) metodoRestante = 'Transferência';

      // 4. Saldo a parcelar e valor da parcela mensal
      const saldo = Math.max(0, total - entrada);
      const valorParcela = valParcExpl > 0 ? valParcExpl : (saldo / qtdParcelas);

      const listaParcelas: ContratoParcela[] = [];

      const sitEntradaMatch = parteEntrada.match(/\[(?:situa[çc][aã]o:\s*)?([^\]]+)\]/i);
      const sitEntrada = sitEntradaMatch && /quitad|pago|paga/i.test(sitEntradaMatch[1]) ? 'Quitada' : 'Pendente';

      if (entrada > 0) {
        listaParcelas.push({
          numero: 1,
          descricao: `Entrada Inicial (${metodoEntrada.replace(' (Entrada)', '')})`,
          vencimento: dataEntradaFormatada,
          valor: entrada,
          metodo: metodoEntrada,
          status: sitEntrada,
        });
      }

      const isCartaoRestante = isMetodoCartao(metodoRestante);
      const sitRestanteMatch = parteRestante.match(/\[(?:situa[çc][aã]o:\s*)?([^\]]+)\]/i);
      let sitRestantePadrao = 'Pendente';
      const sitsRestanteIndividuais: string[] = [];

      if (sitRestanteMatch) {
        const rawSit = sitRestanteMatch[1].trim();
        if (rawSit.includes(',')) {
          const partesSit = rawSit.split(',').map((s) => s.trim());
          for (const ps of partesSit) {
            if (/quitad|pago|paga/i.test(ps)) sitsRestanteIndividuais.push('Quitada');
            else if (/autoriz/i.test(ps)) sitsRestanteIndividuais.push('Autorizado');
            else sitsRestanteIndividuais.push('A vencer');
          }
        } else {
          if (/quitad|pago|paga/i.test(rawSit)) sitRestantePadrao = 'Quitada';
          else if (/autoriz/i.test(rawSit)) sitRestantePadrao = 'Autorizado';
          else if (/venc/i.test(rawSit)) sitRestantePadrao = 'A vencer';
        }
      }

      for (let idx = 0; idx < qtdParcelas; idx++) {
        let vencimentoFormatado = '';
        if (isCartaoRestante) {
          vencimentoFormatado = 'Fatura do Cartão';
        } else if (datasDetectadas[idx]) {
          vencimentoFormatado = datasDetectadas[idx];
        } else {
          const dataVenc = somarMesesSeguro(hoje, idx + 1, diaVencimento);
          vencimentoFormatado = formatarData(dataVenc);
        }

        const statusFinal = sitsRestanteIndividuais[idx] || sitRestantePadrao;

        const isSaldoACombinar = entrada > 0 && qtdParcelas === 1 && (/combinar|definir/i.test(metodoRestante) || /combinar|definir/i.test(formas) || metodoRestante === 'A definir');
        const descFinal = qtdParcelas === 1 && entrada === 0
          ? `Pagamento Único (${metodoRestante})`
          : isSaldoACombinar
            ? `Saldo Restante (A combinar)`
            : `Parcela ${idx + 1} de ${qtdParcelas} (${metodoRestante})`;

        const vencFinal = isSaldoACombinar ? 'A combinar' : vencimentoFormatado;

        listaParcelas.push({
          numero: listaParcelas.length + 1,
          descricao: descFinal,
          vencimento: vencFinal,
          valor: valorParcela,
          metodo: isSaldoACombinar ? 'A combinar' : metodoRestante,
          status: statusFinal,
        });
      }

      parcelas = listaParcelas;
    }
  }

  // Garante que nenhuma parcela em Cartão de Crédito retenha vencimento de calendário fixo,
  // e gera o Payload PIX e QR Code individual Bacen para cada parcela via PIX com o valor exato
  const chavePixParaParcela = (dadosClinica?.chavePix && dadosClinica?.chavePix !== 'Chave da clínica sob consulta')
    ? (dadosClinica?.chavePix || '')
    : '';
  const formaTemPix = (orcamento?.formasPagamento || orcamento?.formas_pagamento || '').toLowerCase().includes('pix');

  parcelas = parcelas.map((parc) => {
    const isCartao = isMetodoCartao(parc.metodo, parc.descricao);
    if (isCartao) {
      return {
        ...parc,
        vencimento: 'Fatura do Cartão',
      };
    }

    const isPaga = Boolean(parc.status && /paga|pago|quitad/i.test(parc.status));
    if (isPaga) {
      return {
        ...parc,
        payloadPix: undefined,
        qrCodePixUrl: undefined,
      };
    }

    const isPix = isMetodoPix(parc.metodo, parc.descricao) || (formaTemPix && !/boleto|dinheiro|transfer/i.test(parc.metodo || ''));
    if (chavePixParaParcela && isPix && parc.valor > 0) {
      const payload = gerarPayloadPix({
        chave: chavePixParaParcela,
        tipoChave: dadosClinica?.tipoChavePix,
        nomeFavorecido: dadosClinica?.favorecidoPix || dadosClinica?.nome,
        cidade: dadosClinica?.cidade || 'MACEIO',
        valor: parc.valor,
        descricao: `Parc ${parc.numero} CTR-${dadosOrcamento.numeroIdentificador}`.slice(0, 25),
      });

      const qrCodeUrl = payload ? gerarQrCodePixUrl(payload, 280) : undefined;

      return {
        ...parc,
        payloadPix: payload || undefined,
        qrCodePixUrl: qrCodeUrl || undefined,
      };
    }

    return parc;
  });

  if (parcelamentoQtdDetectada <= 1) {
    const parcNumerada = parcelas.find((p) => /\(\d+\/(\d+)\s*-\s*([^)]+)\)/.test(p.descricao || ''));
    if (parcNumerada && parcNumerada.descricao) {
      const matchNum = parcNumerada.descricao.match(/\(\d+\/(\d+)\s*-\s*([^)]+)\)/);
      if (matchNum) {
        parcelamentoQtdDetectada = parseInt(matchNum[1], 10);
        parcelamentoValorDetectado = parcNumerada.valor;
        parcelamentoMetodoDetectado = matchNum[2].trim();
      }
    }
  }

  const parcelasSemEntrada = parcelas.filter((p) => !(p?.descricao || '').toLowerCase().includes('entrada'));
  const quantidadeParcelas = parcelamentoQtdDetectada > 0
    ? parcelamentoQtdDetectada
    : (parcelasSemEntrada.length || parcelas.length);
  const valorParcela = parcelamentoValorDetectado > 0
    ? parcelamentoValorDetectado
    : (parcelasSemEntrada.length > 0 ? parcelasSemEntrada[0].valor : (parcelas.length > 0 ? parcelas[0].valor : total));

  const textoFormaFinal = condicaoAtiva?.descricao && !condicaoAtiva.descricao.includes('{')
    ? condicaoAtiva.descricao
    : (condicaoAtiva?.titulo || obterTextoCondicaoParaContrato(formasRaw));

  let formaLimpa = limparFormaPagamentoParaContrato(textoFormaFinal || 'Conforme acordado entre as partes');
  if (!formaLimpa || /^condi[çc][aã]o de pagamento$/i.test(formaLimpa) || /a\s*combinar/i.test(formaLimpa) || /a\s*definir/i.test(formaLimpa)) {
    if (condicaoAtiva?.descricao && !condicaoAtiva.descricao.includes('{')) {
      formaLimpa = condicaoAtiva.descricao;
    } else if (condicaoAtiva?.titulo && !/^condi[çc][aã]o de pagamento$/i.test(condicaoAtiva.titulo)) {
      formaLimpa = condicaoAtiva.titulo;
    } else if (condicaoAtiva) {
      formaLimpa = calcularDescricaoCondicao(condicaoAtiva, total);
    } else {
      formaLimpa = 'Conforme negociação financeira formalmente acordada';
    }
  }

  const dadosFinanceiro: ContratoDadosFinanceiro = {
    subtotal,
    desconto,
    total,
    totalExtenso,
    formaPagamento: formaLimpa,
    entrada,
    parcelas: parcelas.map((p) => {
      let m = p.metodo ? limparFormaPagamentoParaContrato(p.metodo) : p.metodo;
      let d = limparFormaPagamentoParaContrato(p.descricao);
      if (condicaoAtiva && (/combinar/i.test(m || '') || /definir/i.test(m || ''))) {
        m = condicaoAtiva.tipo === 'cartao' ? 'Cartão de Crédito' : 'PIX';
      }
      if (condicaoAtiva && (/combinar/i.test(d || '') || /definir/i.test(d || ''))) {
        d = d.replace(/a combinar|a definir/gi, m || 'PIX');
      }
      return {
        ...p,
        descricao: d,
        metodo: m,
      };
    }),
    quantidadeParcelas,
    valorParcela,
    metodoParcelamento: parcelamentoMetodoDetectado ? limparFormaPagamentoParaContrato(parcelamentoMetodoDetectado) : undefined,
  };

  // Detecção e estruturação do modelo de contrato (Endodontia / Lentes / Geral)
  const itensDesc = (orcamento?.itens || []).map((i: any) => `${i?.nome || ''} ${i?.denteOuRegiao || ''}`).join(' ');
  const textoDetectarEndo = `${orcamento?.titulo || ''} ${orcamento?.observacoes || ''} ${itensDesc}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const temPalavrasEndo =
    textoDetectarEndo.includes('canal') ||
    textoDetectarEndo.includes('endodont') ||
    textoDetectarEndo.includes('pulpotomia') ||
    textoDetectarEndo.includes('biopulpectomia');

  const modeloFinal: TipoModeloContrato = tipoModeloContrato || (dadosEndodontia?.ativo ? 'endodontia' : (temPalavrasEndo ? 'endodontia' : (incluiLentesResina ? 'lentes_resina' : 'geral')));

  // Identificação do profissional parceiro
  const parceiroFinal: ContratoDadosParceiro | undefined = parceiro || (orcamento?.parceiroNome ? {
    id: orcamento?.parceiroId,
    nome: orcamento?.parceiroNome,
    croUf: '',
    documento: '',
  } : undefined);

  const dentesExtraidos = (orcamento?.itens || [])
    .map((i: any) => i?.denteOuRegiao)
    .filter(Boolean)
    .join(', ');

  const procedimentosAprovadosExtraidos = (orcamento?.itens || [])
    .map((i: any) => `${i?.nome || ''}${i?.denteOuRegiao ? ` (${i.denteOuRegiao})` : ''}`)
    .filter(Boolean)
    .join(', ') || orcamento?.titulo || 'Tratamento Endodôntico';

  const dadosEndodontiaFinal: ContratoDadosEndodontia | undefined = dadosEndodontia ? {
    ...dadosEndodontia,
    ativo: dadosEndodontia.ativo ?? (modeloFinal === 'endodontia'),
    parceiro: dadosEndodontia.parceiro || parceiroFinal,
  } : (modeloFinal === 'endodontia' ? {
    ativo: true,
    executorTipo: parceiroFinal?.nome ? 'parceiro' : 'dentista_titular',
    parceiro: parceiroFinal || null,
    dentes: dentesExtraidos || 'Elemento(s) dentário(s) indicado(s) na avaliação clínica',
    diagnostico: 'Avaliação clínica compatível com necessidade de intervenção endodôntica',
    etapasPrevistas: 'Abertura coronária, localização dos canais, limpeza, instrumentação biomecânica, desinfecção e obturação radicular',
    procedimentosIncluidos: 'Tratamento endodôntico (canal), instrumentação, medicação intracanal (quando indicada) e obturação dos canais radiculares',
    procedimentosNaoIncluidos: 'Restaurações definitivas, coroas protéticas, pinos/núcleos intracanais, reconstruções estéticas ou cirurgias parendodônticas',
    procedimentosAprovados: procedimentosAprovadosExtraidos,
  } : undefined);

  // Avalia autorização prévia da profissional
  let authEfetiva: AutorizacaoAssinaturaProfissional | null = autorizacaoProfissional || null;
  if (!authEfetiva && typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AUTORIZACAO);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.ativo && !parsed.revogadoEm) {
          authEfetiva = parsed;
        }
      }
    } catch (_) {}
  }

  const isAutorizadoValido = validarAutorizacaoAssinatura(authEfetiva, modeloFinal);
  const profNome = authEfetiva?.profissionalNome || (authEfetiva as any)?.profissional_nome || dadosClinica.dentistaResponsavel;
  const profCro = authEfetiva?.profissionalCro || (authEfetiva as any)?.profissional_cro || dadosClinica.cro;

  let assinaturaDentistaFinal: any = null;
  if (assinaturaDentista !== undefined) {
    assinaturaDentistaFinal = assinaturaDentista;
  } else if (isAutorizadoValido && authEfetiva) {
    const profDoc = authEfetiva.profissionalDocumento || (authEfetiva as any).profissional_documento || '032.663.962-43';
    const profAssinatura = authEfetiva.assinaturaGrafica || (authEfetiva as any).assinatura_grafica || gerarRubricaPadraoDra(profNome, profCro);
    const profAutorizadoEm = authEfetiva.autorizadoEm || (authEfetiva as any).autorizado_em || emitidoEm;
    const profExpressa = authEfetiva.autorizacaoExpressa ?? (authEfetiva as any).autorizacao_expressa ?? true;

    assinaturaDentistaFinal = {
      assinaturaData: profAssinatura,
      nome: profNome,
      cro: profCro,
      documento: profDoc,
      dataHora: emitidoEm,
      metodo: 'assinatura_automatica_autorizada',
      autorizacaoId: authEfetiva.id,
      autorizadoEm: profAutorizadoEm,
      autorizacaoExpressa: profExpressa,
    };
  }

  const statusInicial = assinaturaDentistaFinal ? 'aguardando_assinatura_paciente' : 'aguardando_assinatura_dentista';

  return {
    contratoId,
    orcamentoId: orcamento?.id || '',
    pacienteId: patient?.id || '',
    versao: '1.0',
    status: statusInicial,
    statusAssinaturaDentista: assinaturaDentistaFinal ? 'assinado' : 'pendente',
    statusAssinaturaPaciente: 'pendente',
    isFormalizadoTotal: false,
    emitidoEm,
    tipoModeloContrato: modeloFinal,
    paciente: dadosPaciente,
    clinica: {
      ...dadosClinica,
      dentistaResponsavel: dadosClinica.dentistaResponsavel || profNome,
      cro: dadosClinica.cro || profCro,
    },
    orcamento: dadosOrcamento,
    financeiro: dadosFinanceiro,
    observacoesCustomizadas: orcamento?.observacoes || undefined,
    incluiLentesResina: modeloFinal === 'lentes_resina' ? true : (incluiLentesResina !== undefined ? incluiLentesResina : undefined),
    dadosRestauracoesPreexistentes: dadosRestauracoesPreexistentes || patient?.restauracoesPreexistentes || undefined,
    dadosEndodontia: dadosEndodontiaFinal,
    termoUsoImagem: termoUsoImagem !== undefined ? termoUsoImagem : {
      ativo: true,
      autorizado: true, // Por padrão: autorizado por primeiro, com faculdade do paciente optar por não autorizar
      usoDidaticoCientifico: true,
      usoPublicitarioRedesSociais: true,
      identificacaoFacialVoz: 'rosto_e_voz',
      depoimentos: true,
    },
    assinaturaPaciente: null,
    assinaturaDentista: assinaturaDentistaFinal,
  };
};

/**
 * Gera o documento HTML do contrato completo, pronto para renderização,
 * pré-visualização, impressão (window.print) e conversão para PDF A4 via html2canvas/jsPDF.
 */
export const gerarHtmlContrato = (snapshot: ContratoSnapshot): string => {
  // Se o contrato for do modelo de Endodontia (Canal), renderiza o documento específico
  if (isContratoEndodontia(snapshot)) {
    return gerarHtmlContratoEndodontia(snapshot);
  }

  const { paciente, clinica, orcamento, financeiro } = snapshot;
  const dataHojeExtenso = formatarDataPorExtenso(new Date(snapshot.emitidoEm), clinica.cidade || 'Local');

  const incluiLentes = isContratoLenteResina(snapshot);
  let numeroClausula = 0;
  const numClausula = () => {
    numeroClausula += 1;
    return `CLÁUSULA ${numeroClausula}ª`;
  };

  const parcelasSemEntrada = financeiro.parcelas.filter(
    (p) => !(p?.descricao || '').toLowerCase().includes('entrada')
  );
  const todasIguais =
    parcelasSemEntrada.length > 0 &&
    parcelasSemEntrada.every(
      (p) => Math.abs(p.valor - parcelasSemEntrada[0].valor) < 0.05
    );
  const temAlgumPix =
    financeiro.parcelas.some((p) =>
      (p?.metodo || p?.descricao || '').toLowerCase().includes('pix')
    ) || /pix/i.test(financeiro.formaPagamento);
  const temAlgumCartao =
    financeiro.parcelas.some((p) => isMetodoCartao(p.metodo, p.descricao)) ||
    isMetodoCartao(financeiro.formaPagamento);
  const apenasCartao =
    temAlgumCartao &&
    !temAlgumPix &&
    !financeiro.parcelas.some((p) => /boleto|dinheiro|transfer/i.test(p.metodo || ''));

  let tituloClausulaPagamento = 'DO PAGAMENTO, PARCELAMENTO E CONDIÇÕES ACORDADAS';
  if (apenasCartao) {
    tituloClausulaPagamento = 'DO PAGAMENTO VIA CARTÃO DE CRÉDITO E CONDIÇÕES ACORDADAS';
  } else if (temAlgumPix && !temAlgumCartao) {
    tituloClausulaPagamento = 'DO PAGAMENTO MENSAL VIA PIX E FORMAS ACORDADAS NO ORÇAMENTO';
  } else if (temAlgumPix && temAlgumCartao) {
    tituloClausulaPagamento = 'DO PAGAMENTO (PIX, CARTÃO DE CRÉDITO E DEMAIS FORMAS ACORDADAS)';
  }

  const tipoDocClinica = identificarTipoDocumento(clinica.cnpj);
  const labelDocClinica = tipoDocClinica === 'cpf' ? 'CPF' : 'CNPJ';

  // Identificação do titular/favorecido PIX
  const tipoDocFavorecido = clinica.cnpjCpfFavorecidoPix ? identificarTipoDocumento(clinica.cnpjCpfFavorecidoPix) : null;
  const labelDocFavorecido = tipoDocFavorecido === 'cpf' ? 'CPF' : 'CNPJ';

  // Identificação do documento do contratante / paciente
  const tipoDocPaciente = identificarTipoDocumento(paciente.cpf);
  const labelDocPaciente = tipoDocPaciente === 'cnpj' ? 'CNPJ' : 'CPF/MF';

  // Verifica se o profissional responsável é a mesma pessoa física que o nome cadastrado
  const nomeNormClinica = (clinica.nome || '')
    .trim()
    .toLowerCase()
    .replace(/^(dra?\.?|cirurgi[aã]o?-?dentista)\s+/i, '');
  const nomeNormDentista = (clinica.dentistaResponsavel || '')
    .trim()
    .toLowerCase()
    .replace(/^(dra?\.?|cirurgi[aã]o?-?dentista)\s+/i, '');
  const ehMesmoProfissional =
    !clinica.dentistaResponsavel ||
    clinica.dentistaResponsavel === 'Cirurgião-Dentista Responsável' ||
    nomeNormClinica === nomeNormDentista ||
    (nomeNormClinica.length > 3 && nomeNormDentista.includes(nomeNormClinica)) ||
    (nomeNormDentista.length > 3 && nomeNormClinica.includes(nomeNormDentista));

  let preambuloContratadaHtml = '';
  if (tipoDocClinica === 'cpf') {
    if (ehMesmoProfissional) {
      preambuloContratadaHtml = `<strong>CONTRATADA:</strong> <strong>${(clinica.nome || '').trim()}</strong>, cirurgiã(o)-dentista inscrita(o) no CPF/MF sob o nº <strong>${(clinica.cnpj || '').trim()}</strong> e no Conselho Regional de Odontologia sob o CRO nº <strong>${(clinica.cro || '').trim()}</strong>, com consultório estabelecido em <strong>${(clinica.endereco || '').trim()}</strong>, telefone: <strong>${(clinica.telefone || '').trim()}</strong>, e-mail: <strong>${(clinica.email || '').trim()}</strong>.`;
    } else {
      preambuloContratadaHtml = `<strong>CONTRATADA:</strong> <strong>${(clinica.nome || '').trim()}</strong>, inscrita(o) no CPF/MF sob o nº <strong>${(clinica.cnpj || '').trim()}</strong>, com consultório estabelecido em <strong>${(clinica.endereco || '').trim()}</strong>, telefone: <strong>${(clinica.telefone || '').trim()}</strong>, e-mail: <strong>${(clinica.email || '').trim()}</strong>, representada pelo(a) Cirurgião(ã)-Dentista <strong>${(clinica.dentistaResponsavel || '').trim()}</strong>, inscrito(a) no Conselho Regional de Odontologia sob o CRO nº <strong>${(clinica.cro || '').trim()}</strong>.`;
    }
  } else {
    preambuloContratadaHtml = `<strong>CONTRATADA:</strong> <strong>${(clinica.nome || '').trim()}</strong>, pessoa jurídica de direito privado inscrita no CNPJ sob o nº <strong>${(clinica.cnpj || '').trim()}</strong>, com sede e consultório estabelecido em <strong>${(clinica.endereco || '').trim()}</strong>, telefone: <strong>${(clinica.telefone || '').trim()}</strong>, e-mail: <strong>${(clinica.email || '').trim()}</strong>, tendo como Responsável Técnico(a) o(a) Cirurgião(ã)-Dentista <strong>${(clinica.dentistaResponsavel || '').trim()}</strong>, inscrito(a) no Conselho Regional de Odontologia sob o CRO nº <strong>${(clinica.cro || '').trim()}</strong>.`;
  }

  // Preâmbulo do Paciente - omite campos não informados (RG, Estado Civil, Profissão)
  const partesPreambuloPaciente: string[] = [
    `<strong>CONTRATANTE / PACIENTE:</strong> <strong>${(paciente.nome || '').trim()}</strong>`
  ];

  if (temValorValido(paciente.estadoCivil)) {
    partesPreambuloPaciente.push(`estado civil: <strong>${paciente.estadoCivil.trim()}</strong>`);
  }

  if (temValorValido(paciente.profissao)) {
    partesPreambuloPaciente.push(`profissão: <strong>${paciente.profissao.trim()}</strong>`);
  }

  if (temValorValido(paciente.rg)) {
    partesPreambuloPaciente.push(`portador(a) do RG nº <strong>${paciente.rg.trim()}</strong>`);
  }

  const docPacienteFmt = temValorValido(paciente.cpf) ? formatarDocumento(paciente.cpf) : (paciente.cpf || 'Não informado');
  partesPreambuloPaciente.push(`inscrito(a) no ${labelDocPaciente} sob o nº <strong>${docPacienteFmt}</strong>`);

  if (temValorValido(paciente.dataNascimento)) {
    partesPreambuloPaciente.push(`data de nascimento: <strong>${paciente.dataNascimento.trim()}</strong>`);
  }

  const endPacienteFmt = formatarEnderecoCompleto(paciente.endereco) || (temValorValido(paciente.endereco) ? paciente.endereco.trim() : 'Não informado');
  partesPreambuloPaciente.push(`residente e domiciliado(a) em <strong>${endPacienteFmt}</strong>`);

  if (temValorValido(paciente.telefone)) {
    partesPreambuloPaciente.push(`telefone: <strong>${formatarTelefone(paciente.telefone)}</strong>`);
  }

  if (temValorValido(paciente.email)) {
    partesPreambuloPaciente.push(`e-mail: <strong>${paciente.email.trim()}</strong>`);
  }

  const preambuloPacienteHtml = partesPreambuloPaciente.join(', ') + '.';

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Contrato de Prestação de Serviços Odontológicos - ${paciente.nome}</title>
  <style>
    @page {
      size: A4;
      margin: 12mm 14mm 12mm 14mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-size: 12.5px;
      line-height: 1.48;
      color: #111827;
      background: #ffffff;
      margin: 0;
      padding: 16px 20px;
    }
    .contrato-container {
      max-width: 100%;
      margin: 0 auto;
    }
    .cabecalho {
      border-bottom: 2px solid #111827;
      padding-bottom: 10px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .cabecalho-logo img {
      max-height: 55px;
      max-width: 170px;
      object-fit: contain;
    }
    .cabecalho-clinica h1 {
      font-size: 16px;
      margin: 0 0 2px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .cabecalho-clinica p {
      margin: 1px 0;
      font-size: 10.5px;
      color: #4b5563;
      font-family: Arial, sans-serif;
    }
    .cabecalho-doc-id {
      text-align: right;
      font-family: Arial, sans-serif;
      font-size: 10.5px;
      color: #374151;
    }
    .cabecalho-doc-id strong {
      font-size: 12px;
      color: #111827;
    }
    .titulo-principal {
      text-align: center;
      margin: 12px 0 10px;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .titulo-principal h2 {
      font-size: 15px;
      margin: 0 0 3px;
      font-weight: bold;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      text-decoration: underline;
    }
    .titulo-principal p {
      margin: 0;
      font-size: 11.5px;
      color: #4b5563;
      font-style: italic;
    }
    .clausula-bloco {
      margin-bottom: 10px;
      text-align: justify;
    }
    .clausula-titulo {
      font-weight: bold;
      margin-top: 10px;
      margin-bottom: 4px;
      text-transform: uppercase;
      font-size: 11.5px;
      letter-spacing: 0.5px;
      page-break-after: avoid !important;
      break-after: avoid !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .paragrafo {
      margin: 0 0 5px;
      text-indent: 22px;
      orphans: 2;
      widows: 2;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .tabela-dados {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
      font-size: 11px;
      font-family: Arial, sans-serif;
    }
    .tabela-dados thead {
      display: table-header-group;
    }
    .tabela-dados tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .tabela-dados th, .tabela-dados td {
      border: 1px solid #d1d5db;
      padding: 5px 6px;
      text-align: left;
    }
    .tabela-dados th {
      background-color: #f3f4f6;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 9.5px;
      letter-spacing: 0.5px;
    }
    .tabela-dados tr:nth-child(even) {
      background-color: #fafafa;
    }
    .tabela-dados .col-num {
      text-align: center;
      width: 36px;
    }
    .tabela-dados .col-money {
      text-align: right;
      width: 90px;
    }
    .totais-resumo {
      margin: 8px 0 12px auto;
      width: 300px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      padding: 8px 10px;
      background-color: #f9fafb;
      font-family: Arial, sans-serif;
      font-size: 11.5px;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .totais-linha {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3px;
      color: #4b5563;
    }
    .totais-linha.destaque {
      border-top: 1px solid #111827;
      margin-top: 5px;
      padding-top: 5px;
      font-size: 13px;
      font-weight: bold;
      color: #111827;
    }
    .box-pix,
    .evitar-corte,
    [class*="box-pix"],
    [class*="evitar-corte"] {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .bloco-assinaturas {
      margin-top: 22px;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .data-local {
      text-align: right;
      margin-bottom: 16px;
      font-style: italic;
      font-size: 11.5px;
    }
    .grid-assinaturas {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      margin-top: 16px;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .campo-assinatura {
      flex: 1;
      text-align: center;
      font-family: Arial, sans-serif;
    }
    .campo-assinatura img {
      max-height: 60px;
      margin: 0 auto 3px;
      display: block;
    }
    .linha-assinatura {
      border-top: 1px solid #111827;
      margin: 0 auto 5px;
      width: 90%;
    }
    .assinatura-nome {
      font-weight: bold;
      font-size: 11.5px;
    }
    .assinatura-papel {
      font-size: 10.5px;
      color: #4b5563;
    }
    .assinatura-detalhes {
      font-size: 8.5px;
      color: #6b7280;
      margin-top: 2px;
    }
    .rodape-documento {
      margin-top: 20px;
      padding-top: 8px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 9.5px;
      color: #9ca3af;
      font-family: Arial, sans-serif;
    }
    @media screen and (max-width: 640px) {
      body {
        padding: 12px 10px;
        font-size: 11.5px;
      }
      .cabecalho {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
      }
      .cabecalho-doc-id {
        text-align: left;
      }
      .tabela-procedimentos, .tabela-parcelas {
        display: block;
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }
      .grid-assinaturas {
        flex-direction: column;
        gap: 20px;
      }
    }
    @media print {
      body {
        padding: 0 !important;
      }
      .contrato-container {
        max-width: 100%;
      }
      .box-pix,
      .evitar-corte,
      .cabecalho,
      .bloco-assinaturas,
      .totais-resumo,
      .tabela-dados tr,
      .clausula-titulo {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
  </style>
</head>
<body>
  <div class="contrato-container">
    <!-- Cabeçalho Institucional -->
    <div class="cabecalho">
      <div style="display: flex; align-items: center; gap: 14px;">
        ${clinica.logoUrl ? `<div class="cabecalho-logo"><img src="${clinica.logoUrl}" alt="Logo" /></div>` : ''}
        <div class="cabecalho-clinica">
          <h1>${clinica.nome}</h1>
          <p>${labelDocClinica}: ${clinica.cnpj} • CRO: ${clinica.cro}</p>
          <p>${clinica.endereco}</p>
          <p>Telefone: ${clinica.telefone} • E-mail: ${clinica.email}</p>
        </div>
      </div>
      <div class="cabecalho-doc-id">
        <div>Contrato Nº <strong>${snapshot.contratoId}</strong></div>
        <div>Orçamento Ref.: <strong>#${orcamento.numeroIdentificador}</strong></div>
        <div style="margin-top: 4px; font-size: 10px;">Versão ${snapshot.versao}</div>
      </div>
    </div>

    <!-- Título Principal -->
    <div class="titulo-principal">
      <h2>Contrato de Prestação de Serviços Odontológicos</h2>
      <p>Termo de Adesão, Plano de Tratamento e Acordo Financeiro</p>
    </div>

    <!-- Preâmbulo - Da Qualificação das Partes -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">PREÂMBULO — DA QUALIFICAÇÃO DAS PARTES</div>
      <p class="paragrafo">
        Por este instrumento particular de prestação de serviços odontológicos, têm entre si justo e avençado:
      </p>
      <p class="paragrafo">
        ${preambuloContratadaHtml}
      </p>
      <p class="paragrafo">
        E de outro lado:
      </p>
      <p class="paragrafo">
        ${preambuloPacienteHtml}
      </p>
      <p class="paragrafo">
        As partes acima qualificadas celebram o presente contrato, mediante as cláusulas e condições seguintes:
      </p>
    </div>

    <!-- Cláusula 1 - Do Objeto -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">${numClausula()} — DO OBJETO E PROCEDIMENTOS APROVADOS</div>
      <p class="paragrafo">
        O presente contrato tem por objeto a prestação de serviços profissionais odontológicos pela <strong>CONTRATADA</strong> em favor do(a) <strong>CONTRATANTE</strong>, conforme diagnóstico clínico prévio e plano de tratamento formalmente aprovado no <strong>Orçamento nº #${orcamento.numeroIdentificador}</strong> (${orcamento.titulo}), compreendendo a realização dos seguintes atos e procedimentos clínicos:
      </p>

      <table class="tabela-dados">
        <thead>
          <tr>
            <th class="col-num">Item</th>
            <th>Procedimento / Tratamento</th>
            <th class="col-num">Qtd.</th>
            <th class="col-money">Valor Unit.</th>
            <th class="col-money">Total</th>
          </tr>
        </thead>
        <tbody>
          ${orcamento.itens.map((item, idx) => `
            <tr class="evitar-corte" style="page-break-inside: avoid !important; break-inside: avoid !important;">
              <td class="col-num">${idx + 1}</td>
              <td>
                <strong>${item.nome}</strong>
                ${item.denteOuRegiao ? `<br/><span style="font-size: 9.5px; color: #4b5563;">Região/Elemento: ${item.denteOuRegiao}</span>` : ''}
              </td>
              <td class="col-num">${item.quantidade}</td>
              <td class="col-money">${formatMoney(item.valorUnitario)}</td>
              <td class="col-money">${formatMoney(item.valorTotal)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${orcamento.observacoes && orcamento.observacoes.trim() ? `
      <div class="evitar-corte" style="margin: 8px 0; padding: 8px 12px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #0284c7; border-radius: 4px; font-family: Arial, sans-serif; font-size: 10.5px; line-height: 1.45; color: #334155; page-break-inside: avoid !important; break-inside: avoid !important;">
        <strong style="color: #0369a1; text-transform: uppercase; font-size: 9.5px; letter-spacing: 0.5px;">Observações do Orçamento / Especificações Clínicas:</strong><br/>
        <span style="display: block; margin-top: 3px; white-space: pre-wrap;">${orcamento.observacoes.trim()}</span>
      </div>
      ` : ''}

      <p class="paragrafo" style="font-size: 11px; color: #4b5563;">
        <strong>Parágrafo Único:</strong> Modificações clínicas decorrentes de diagnósticos imprevistos durante o decorrer do tratamento, bem como necessidades adicionais não contempladas nesta relação, serão previamente comunicadas e orçadas à parte em termo aditivo.
      </p>
    </div>

    <!-- CLÁUSULA — DO VALOR TOTAL -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">${numClausula()} — DO VALOR TOTAL</div>
      <p class="paragrafo">
        Pela execução integral dos procedimentos odontológicos pactuados na Cláusula 1ª, o(a) <strong>CONTRATANTE</strong> pagará à <strong>CONTRATADA</strong> o valor total global e líquido de <strong>${formatMoney(financeiro.total)}</strong> (<em>${financeiro.totalExtenso}</em>).
      </p>

      <div class="totais-resumo">
        <div class="totais-linha">
          <span>Subtotal dos Procedimentos:</span>
          <strong>${formatMoney(financeiro.subtotal)}</strong>
        </div>
        ${financeiro.desconto > 0 ? `
          <div class="totais-linha" style="color: #059669;">
            <span>Desconto Concedido:</span>
            <strong>- ${formatMoney(financeiro.desconto)}</strong>
          </div>
        ` : ''}
        <div class="totais-linha destaque">
          <span>VALOR TOTAL APROVADO:</span>
          <span>${formatMoney(financeiro.total)}</span>
        </div>
        <div style="font-size: 11px; color: #374151; margin-top: 4px; font-weight: 500;">
          Valor por extenso: ${financeiro.totalExtenso}
        </div>
      </div>

      <p class="paragrafo">
        <strong>Parágrafo Único:</strong> O valor total estabelecido nesta cláusula é certo, líquido e ajustado entre as partes, compreendendo os honorários profissionais e insumos inerentes aos atos clínicos pactuados, permanecendo irreajustável durante a vigência do plano de tratamento orçado.
      </p>
    </div>

    <!-- CLÁUSULA — DO PAGAMENTO E FORMAS ACORDADAS NO ORÇAMENTO -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">${numClausula()} — ${tituloClausulaPagamento}</div>
      <p class="paragrafo">
        O adimplemento do valor total avençado na Cláusula 2ª dar-se-á estritamente em conformidade com o acordado no <strong>Orçamento nº #${orcamento.numeroIdentificador}</strong> e com as formas de pagamento convencionadas entre as partes, registradas como: <strong>"${(() => {
          let f = limparFormaPagamentoParaContrato(financeiro.formaPagamento);
          if (!f || /^condi[çc][aã]o de pagamento$/i.test(f) || /a\s*combinar/i.test(f) || /a\s*definir/i.test(f)) {
            f = (orcamento.formasPagamento && !/^condi[çc][aã]o de pagamento$/i.test(orcamento.formasPagamento) && !/a\s*combinar/i.test(orcamento.formasPagamento))
              ? orcamento.formasPagamento
              : 'Conforme negociação financeira formalmente aprovada';
          }
          return f;
        })()}"</strong>.
      </p>

      ${financeiro.entrada > 0 ? `
        <p class="paragrafo">
          ${todasIguais ? `
            O plano financeiro pactuado compreende o pagamento de uma <strong>Entrada inicial de ${formatMoney(financeiro.entrada)}</strong> e o saldo remanescente de <strong>${formatMoney(financeiro.total - financeiro.entrada)}</strong> dividido em <strong>${financeiro.quantidadeParcelas} (${financeiro.quantidadeParcelas === 1 ? 'uma única parcela' : `${financeiro.quantidadeParcelas} parcelas mensais sucessivas`})</strong> no valor de <strong>${formatMoney(financeiro.valorParcela)}</strong>${financeiro.quantidadeParcelas > 1 ? ' cada' : ''}, ${apenasCartao ? 'com lançamentos processados na fatura do cartão conforme cronograma oficial a seguir:' : 'com vencimentos discriminados no cronograma oficial a seguir:'}
          ` : `
            O plano financeiro pactuado compreende o pagamento de uma <strong>Entrada inicial de ${formatMoney(financeiro.entrada)}</strong> e o saldo remanescente de <strong>${formatMoney(financeiro.total - financeiro.entrada)}</strong>, distribuído nas etapas e formas discriminadas detalhadamente no cronograma oficial a seguir:
          `}
        </p>
      ` : `
        <p class="paragrafo">
          ${todasIguais ? `
            O plano financeiro compreende a quitação em <strong>${financeiro.quantidadeParcelas} (${financeiro.quantidadeParcelas === 1 ? 'uma única parcela' : `${financeiro.quantidadeParcelas} parcelas mensais sucessivas`})</strong>, no valor de <strong>${formatMoney(financeiro.valorParcela)}</strong>${financeiro.quantidadeParcelas > 1 ? ' cada' : ''}, ${apenasCartao ? 'com cobrança na fatura do cartão conforme discriminado no cronograma a seguir:' : 'com vencimentos conforme discriminado no cronograma a seguir:'}
          ` : `
            O plano financeiro compreende as etapas e parcelas discriminadas detalhadamente com seus respectivos valores, vencimentos e formas no cronograma a seguir:
          `}
        </p>
      `}

      ${temAlgumPix ? (() => {
      const chavePixContrato = clinica?.chavePix || clinica?.cnpj || clinica?.telefone || '';
      const parcelaEntrada = financeiro.parcelas?.find((p) =>
        /entrada|sinal/i.test(p.descricao || '')
      ) || (financeiro.entrada > 0 && financeiro.parcelas?.length > 0 ? financeiro.parcelas[0] : undefined);
      const isEntradaPaga = parcelaEntrada?.status ? /quitad|pago|paga/i.test(parcelaEntrada.status) : false;

      const parcelasPixNaoPagas = (financeiro.parcelas || []).filter((p) => {
        const isCartao = isMetodoCartao(p.metodo, p.descricao) || (p.vencimento && /fatura/i.test(p.vencimento));
        const isPix = !isCartao && (isMetodoPix(p.metodo, p.descricao) || temAlgumPix);
        const isPaga = Boolean(p.status && /paga|pago|quitad/i.test(p.status));
        return isPix && !isPaga;
      });

      const todasPixPagas = (financeiro.parcelas || []).length > 0 && parcelasPixNaoPagas.length === 0;

      if (todasPixPagas) {
        return `
      <!-- Status Oficial de Quitação PIX -->
      <div class="evitar-corte" style="margin: 8px 0; padding: 10px 14px; border: 1.5px solid #10b981; background-color: #f0fdf4; border-radius: 8px; font-family: Arial, sans-serif; font-size: 11px; color: #065f46; page-break-inside: avoid !important; break-inside: avoid !important;">
        <div style="font-weight: bold; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 13px; color: #059669;">✔</span>
          <span>PAGAMENTO VIA PIX DEVIDAMENTE QUITADO</span>
        </div>
        <div style="margin-top: 3px; font-size: 10.5px; color: #047857; line-height: 1.4;">
          ${financeiro.entrada > 0 ? `A Entrada de <strong>${formatMoney(financeiro.entrada)}</strong> e os pagamentos acordados via PIX constam como <strong>QUITADOS</strong>.` : 'Os pagamentos pactuados via PIX constam como <strong>QUITADOS</strong>.'} Não há cobrança pendente de PIX nesta etapa.
        </div>
      </div>
          `;
      }

      const valorPixContrato = (!isEntradaPaga && financeiro.entrada && financeiro.entrada > 0)
        ? financeiro.entrada
        : (parcelasPixNaoPagas.length === 1 ? parcelasPixNaoPagas[0].valor : undefined);

      const numIdContrato = orcamento?.numeroIdentificador || snapshot?.contratoId || '';
      const payloadPixContrato = chavePixContrato ? gerarPayloadPix({
        chave: chavePixContrato,
        tipoChave: clinica?.tipoChavePix,
        nomeFavorecido: clinica?.favorecidoPix || clinica?.nome,
        cidade: (clinica?.cidade && !clinica.cidade.toUpperCase().includes('SAO PAULO')) ? clinica.cidade : 'MACEIO',
        valor: valorPixContrato,
        descricao: `Contrato ${numIdContrato}`.trim(),
      }) : '';
      const qrCodeSrc = payloadPixContrato
        ? gerarQrCodePixUrl(payloadPixContrato, 280)
        : `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=4&data=${encodeURIComponent(chavePixContrato || 'pix')}`;
      const qrCodeGrandeSrc = payloadPixContrato
        ? gerarQrCodePixUrl(payloadPixContrato, 450)
        : qrCodeSrc;

      return `
      <!-- Detalhamento Oficial para Pagamento via PIX com QR Code -->
      <div class="box-pix evitar-corte" style="margin: 8px 0; padding: 10px 14px; border: 1.5px dashed #0284c7; background-color: #f0f9ff; border-radius: 8px; font-family: Arial, sans-serif; font-size: 11px; color: #0369a1; page-break-inside: avoid !important; break-inside: avoid !important;">
        <div style="font-weight: bold; margin-bottom: 6px; text-transform: uppercase; font-size: 10.5px; letter-spacing: 0.5px; display: flex; align-items: center; justify-content: space-between;">
          <span>✦ Instruções e QR Code Oficial para Pagamento via PIX${isEntradaPaga ? ' (Entrada Quitada ✔)' : valorPixContrato ? ` (Valor Inicial/Total: ${formatMoney(valorPixContrato)})` : ''}</span>
          <span style="font-size: 9.5px; color: #0369a1; font-weight: normal;">Padrão Oficial Banco Central (Bacen)</span>
        </div>
        ${isEntradaPaga ? `
        <div style="margin-bottom: 6px; padding: 5px 8px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; font-size: 10.5px; color: #065f46; font-weight: 500;">
          ✔ A <strong>Entrada de ${formatMoney(financeiro.entrada)}</strong> já foi devidamente <strong>QUITADA</strong>.
        </div>
        ` : ''}
        <div style="display: flex; align-items: flex-start; gap: 14px;">
          <div style="background: #ffffff; padding: 5px; border: 1.5px solid #bae6fd; border-radius: 6px; text-align: center; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <a href="${qrCodeGrandeSrc}" target="_blank" rel="noopener noreferrer" title="Clique para abrir o QR Code em tela cheia" style="text-decoration: none; display: block;">
              <img
                src="${qrCodeSrc}"
                alt="QR Code PIX Bacen"
                style="width: 90px; height: 90px; display: block;"
              />
              <div style="font-size: 7.5px; color: #0284c7; font-weight: bold; margin-top: 3px; letter-spacing: 0.5px;">🔍 CLIQUE P/ AMPLIAR</div>
            </a>
          </div>
          <div style="flex: 1;">
            <div style="padding: 6px 10px; background-color: #ffffff; border-radius: 6px; border: 1px solid #bae6fd; font-size: 10.5px; color: #0c4a6e; line-height: 1.45;">
              <strong>Chave PIX:</strong> <span style="font-family: monospace; font-weight: bold; font-size: 11.5px;">${clinica?.chavePix || clinica?.cnpj || clinica?.telefone || 'Chave da clínica sob consulta'}</span> <br/>
              <strong>Titular / Favorecido:</strong> ${clinica?.favorecidoPix || clinica?.nome} ${clinica?.cnpjCpfFavorecidoPix
          ? `• ${labelDocFavorecido}: ${clinica.cnpjCpfFavorecidoPix}`
          : (clinica?.cnpj ? `• ${labelDocClinica}: ${clinica.cnpj}` : '')
        }
              ${clinica?.bancoPix ? `<br/><strong>Instituição / Banco:</strong> ${clinica.bancoPix}` : ''}
              ${valorPixContrato ? `<br/><strong>Valor Configurado no QR Code:</strong> <span style="color: #059669; font-weight: bold;">${formatMoney(valorPixContrato)}</span>` : ''}

              ${payloadPixContrato ? `
                <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #bae6fd;">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px;">
                    <span style="font-size: 9.5px; font-weight: bold; color: #0369a1;">Código PIX Copia e Cola:</span>
                    <button type="button" onclick="navigator.clipboard.writeText('${payloadPixContrato}');alert('Código PIX Copia e Cola copiado com sucesso! Abra o app do seu banco e cole na opção Pix Copia e Cola.');" style="background: #0284c7; color: #ffffff; border: none; padding: 3px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; cursor: pointer;">
                      📋 Copiar Código PIX
                    </button>
                  </div>
                  <div style="font-family: monospace; font-size: 8.5px; color: #334155; word-break: break-all; max-height: 34px; overflow-y: auto; background: #f8fafc; padding: 3px 5px; border: 1px solid #cbd5e1; border-radius: 4px; user-select: all;" title="Código PIX Copia e Cola Oficial">
                    ${payloadPixContrato}
                  </div>
                </div>
              ` : ''}
            </div>
            <div style="margin-top: 5px; font-size: 10px; color: #0284c7; line-height: 1.35;">
              ${clinica.instrucoesPix || 'O(A) CONTRATANTE poderá utilizar a câmera do smartphone ou app bancário para leitura do QR Code acima (o valor e favorecido já serão preenchidos automaticamente), ou utilizar o botão Copiar Código PIX.'}
            </div>
          </div>
        </div>
      </div>
      `;
    })() : ''}

      ${financeiro.parcelas && financeiro.parcelas.length > 0 ? `
      <p class="paragrafo">
        Segue o cronograma oficial com as parcelas, vencimentos e formas de pagamento estabelecidas:
      </p>

      <table class="tabela-dados">
        <thead>
          <tr>
            <th class="col-num">Parc.</th>
            <th>Descrição / Forma de Pagamento</th>
            <th style="width: 120px; text-align: center;">Vencimento</th>
            <th class="col-money">Valor da Parcela</th>
            ${temAlgumPix ? `<th style="width: 160px; text-align: center;">PIX (QR Code / Copia e Cola)</th>` : ''}
            <th style="width: 80px; text-align: center;">Situação</th>
          </tr>
        </thead>
        <tbody>
          ${financeiro.parcelas.map((parc) => {
      const isCartao = isMetodoCartao(parc.metodo, parc.descricao) || (parc.vencimento && /fatura/i.test(parc.vencimento));
      const vencTexto = isCartao ? 'Fatura do Cartão' : (parc.vencimento || '-');
      const isPix = !isCartao && (isMetodoPix(parc.metodo, parc.descricao) || temAlgumPix);
      const isPaga = Boolean(parc.status && /paga|pago|quitad/i.test(parc.status));

      let parcPayload = isPaga ? '' : (parc.payloadPix || '');
      let parcQrCode = isPaga ? '' : (parc.qrCodePixUrl || '');

      if (!isPaga && isPix && !parcPayload && clinica?.chavePix && clinica?.chavePix !== 'Chave da clínica sob consulta' && parc.valor > 0) {
        const numIdContrato = orcamento?.numeroIdentificador || snapshot?.contratoId || '';
        parcPayload = gerarPayloadPix({
          chave: clinica?.chavePix || '',
          tipoChave: clinica?.tipoChavePix,
          nomeFavorecido: clinica?.favorecidoPix || clinica?.nome,
          cidade: (clinica?.cidade && !clinica.cidade.toUpperCase().includes('SAO PAULO')) ? clinica.cidade : 'MACEIO',
          valor: parc.valor,
          descricao: `Parc ${parc.numero} CTR-${numIdContrato}`.slice(0, 25),
        });
        parcQrCode = parcPayload ? gerarQrCodePixUrl(parcPayload, 280) : '';
      }

      return `
            <tr class="evitar-corte" style="page-break-inside: avoid !important; break-inside: avoid !important;">
              <td class="col-num">${parc.numero}</td>
              <td><strong>${limparFormaPagamentoParaContrato(parc.descricao || `Parcela ${parc.numero}`)}</strong> ${parc.metodo ? `— ${limparFormaPagamentoParaContrato(parc.metodo)}` : ''}</td>
              <td style="text-align: center;"><strong>${vencTexto}</strong></td>
              <td class="col-money"><strong>${formatMoney(parc.valor)}</strong></td>
              ${temAlgumPix ? `
                <td style="text-align: center; vertical-align: middle; padding: 4px 6px;">
                  ${isPaga ? `
                    <span style="display: inline-block; padding: 2px 6px; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; border-radius: 4px; font-size: 9.5px; font-weight: bold;">
                      ✔ Quitado
                    </span>
                  ` : isPix && parcQrCode ? `
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 3px;">
                      <a href="${parcQrCode}" target="_blank" rel="noopener noreferrer" title="Clique para abrir o QR Code em tela cheia" style="text-decoration: none; display: inline-block;">
                        <img src="${parcQrCode}" alt="QR Code PIX ${formatMoney(parc.valor)}" style="width: 46px; height: 46px; border: 1px solid #bae6fd; border-radius: 4px; display: block;" />
                        <span style="font-size: 7.5px; color: #0284c7; font-weight: bold; display: block; margin-top: 1px;">🔍 Abrir QR Code</span>
                      </a>
                      ${parcPayload ? `
                        <button type="button" onclick="navigator.clipboard.writeText('${parcPayload}');alert('Código PIX Copia e Cola da parcela ${parc.numero} (${formatMoney(parc.valor)}) copiado com sucesso! Abra o app do seu banco e cole na opção Pix Copia e Cola.');" style="background: #0284c7; color: #ffffff; border: none; padding: 2px 5px; border-radius: 3px; font-size: 8.5px; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 2px;">
                          📋 Copiar PIX
                        </button>
                      ` : ''}
                    </div>
                  ` : `
                    <span style="font-size: 9.5px; color: #94a3b8;">${isCartao ? '— (Cartão)' : '—'}</span>
                  `}
                </td>
              ` : ''}
              <td style="text-align: center; font-size: 10.5px;">${isPaga ? `<strong style="color: #059669;">Quitada</strong>` : (parc.status === 'Autorizado' ? `<strong style="color: #0284c7;">Autorizado</strong>` : `<span style="color: #64748b;">${parc.status || 'Pendente'}</span>`)}</td>
            </tr>
          `;
    }).join('')}
        </tbody>
      </table>
      ` : `
      <div style="margin: 12px 0; padding: 12px 14px; background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 4px; font-size: 11px; color: #991b1b; line-height: 1.45;">
        <strong>Atenção (Cronograma Pendente):</strong> As parcelas detalhadas deste contrato ainda não foram geradas no sistema. A formalização e emissão do contrato exigem a prévia aprovação e definição do cronograma financeiro completo.
      </div>
      `}

      ${temAlgumCartao ? `
      <p class="paragrafo" style="font-size: 11px; color: #4b5563;">
        <strong>Parágrafo (Cobrança via Cartão de Crédito):</strong> Para as parcelas ajustadas na modalidade Cartão de Crédito, os lançamentos ocorrem de forma continuada na fatura emitida pela administradora do cartão do(a) <strong>CONTRATANTE</strong>, dispensando emissão de boletos ou controle de vencimento com datas clínicas pré-fixadas por parte da <strong>CONTRATADA</strong>.
      </p>
      ` : ''}

      <p class="paragrafo" style="font-size: 11px; color: #4b5563;">
        <strong>Parágrafo Primeiro (Mora e Encargos):</strong> O não pagamento de qualquer das parcelas mensais na data de seus respectivos vencimentos sujeitará o(a) <strong>CONTRATANTE</strong> à incidência de multa moratória de 2% (dois por cento) sobre o montante em atraso, acrescida de juros de mora legais de 1% (um por cento) ao mês calculados <em>pro rata die</em>, nos termos do art. 52, § 1º do Código de Defesa do Consumidor e art. 406 do Código Civil.
      </p>
      <p class="paragrafo" style="font-size: 11px; color: #4b5563;">
        <strong>Parágrafo Segundo (Inadimplência Superior a 30 dias):</strong> Ocorrendo atraso superior a 30 (trinta) dias no pagamento de qualquer parcela mensal acordada, a <strong>CONTRATADA</strong> poderá suspender temporariamente a continuidade dos procedimentos eletivos não emergenciais até a regularização financeira das parcelas em aberto, assegurados os atendimentos de urgência indispensáveis à saúde do paciente.
      </p>
    </div>

    ${incluiLentes ? `
    <!-- CLÁUSULA — DA MANUTENÇÃO SEMESTRAL DAS LENTES EM RESINA COMPOSTA -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">${numClausula()} — DA MANUTENÇÃO SEMESTRAL DAS LENTES EM RESINA COMPOSTA</div>
      <p class="paragrafo">
        O(A) <strong>CONTRATANTE</strong> declara estar ciente de que, após a realização do tratamento estético com lentes em resina composta, recomenda-se o comparecimento a consultas de manutenção preventiva <strong>a cada 6 (seis) meses</strong>, ou em intervalos menores quando houver indicação clínica da cirurgiã-dentista responsável.
      </p>
      <p class="paragrafo">
        As consultas de manutenção têm como finalidade avaliar a integridade das restaurações, condições gengivais, adaptação marginal, oclusão, higiene bucal, pigmentação, desgaste, necessidade de polimento e eventuais reparos.
      </p>
      <p class="paragrafo">
        <strong>Parágrafo Primeiro:</strong> O(A) <strong>CONTRATANTE</strong> compromete-se a observar as orientações profissionais e comparecer às consultas periódicas recomendadas, visando à preservação da saúde bucal e à conservação das restaurações estéticas.
      </p>
      <p class="paragrafo">
        <strong>Parágrafo Segundo:</strong> A ausência de manutenção periódica poderá contribuir para a evolução de alterações clínicas, acúmulo de pigmentos, desgaste e outras intercorrências, devendo a relação entre essas circunstâncias e eventuais danos ser avaliada individualmente.
      </p>
      <p class="paragrafo">
        <strong>Parágrafo Terceiro:</strong> As consultas de manutenção, procedimentos de polimento, reparos, ajustes ou substituições não estão automaticamente incluídos no valor do tratamento inicial, salvo previsão expressa em orçamento ou acordo específico. Eventuais custos deverão ser previamente informados e autorizados pelo(a) paciente, respeitados os direitos e garantias legais.
      </p>
      <p class="paragrafo">
        <strong>Parágrafo Quarto:</strong> O acompanhamento semestral não constitui garantia de durabilidade permanente das restaurações nem substitui a necessidade de consultas extraordinárias diante de sintomas, fraturas, desconfortos ou outras alterações.
      </p>
    </div>

    <!-- CLÁUSULA — DAS RESTAURAÇÕES PREEXISTENTES, CONDIÇÕES CLÍNICAS OCULTAS E REVISÃO DO ORÇAMENTO -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">${numClausula()} — DAS RESTAURAÇÕES PREEXISTENTES, CONDIÇÕES CLÍNICAS OCULTAS E REVISÃO DO ORÇAMENTO</div>
      <p class="paragrafo">
        O(A) <strong>CONTRATANTE</strong> declara estar ciente de que a existência de lentes dentais, facetas, coroas, restaurações em resina composta ou outros materiais restauradores previamente instalados poderá limitar a avaliação clínica completa das estruturas dentárias subjacentes.
      </p>
      <p class="paragrafo">
        <strong>Parágrafo Primeiro:</strong> Determinadas condições, incluindo lesões de cárie, infiltrações, fraturas, alterações da estrutura dentária, comprometimento de restaurações preexistentes e outras necessidades clínicas, poderão não ser integralmente identificáveis durante o exame inicial, mesmo mediante avaliação criteriosa e utilização dos recursos diagnósticos indicados.
      </p>
      <p class="paragrafo">
        <strong>Parágrafo Segundo:</strong> Quando houver indicação clínica de remoção de lentes, facetas ou restaurações preexistentes, o(a) <strong>CONTRATANTE</strong> reconhece que determinadas condições dos dentes e das estruturas subjacentes poderão ser identificadas ou confirmadas somente após a remoção desses materiais.
      </p>
      <p class="paragrafo">
        <strong>Parágrafo Terceiro:</strong> Caso sejam identificadas condições clínicas não diagnosticáveis previamente, que exijam procedimentos adicionais ou modificações no planejamento inicialmente aprovado, a <strong>CONTRATADA</strong> comunicará ao(à) <strong>CONTRATANTE</strong> os achados clínicos, apresentará as alternativas de tratamento e fornecerá orçamento complementar discriminado.
      </p>
      <p class="paragrafo">
        <strong>Parágrafo Quarto:</strong> A execução de procedimentos adicionais e a eventual alteração do valor inicialmente contratado dependerão de informação adequada e <strong>aprovação prévia e expressa do(a) CONTRATANTE</strong>, mediante termo aditivo, novo orçamento ou registro documental equivalente, ressalvadas as situações de urgência previstas em lei.
      </p>
      <p class="paragrafo">
        <strong>Parágrafo Quinto:</strong> O(A) <strong>CONTRATANTE</strong> declara compreender que o orçamento inicial é elaborado com base nas condições clínicas identificáveis no momento da avaliação, não incluindo automaticamente tratamentos adicionais decorrentes de condições ocultas que não poderiam ser adequadamente identificadas antes da remoção das estruturas restauradoras existentes.
      </p>
      <p class="paragrafo">
        <strong>Parágrafo Sexto:</strong> A identificação de condições clínicas ocultas não implica autorização automática para a realização de procedimentos adicionais, tampouco afasta a responsabilidade profissional pela adequada avaliação, execução e acompanhamento dos serviços prestados.
      </p>
      ${snapshot.dadosRestauracoesPreexistentes && snapshot.dadosRestauracoesPreexistentes.possuiPreexistentes ? `
      <div class="evitar-corte" style="margin: 8px 0; padding: 8px 12px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #0284c7; border-radius: 4px; font-family: Arial, sans-serif; font-size: 10.5px; line-height: 1.45; color: #334155; page-break-inside: avoid !important; break-inside: avoid !important;">
        <strong style="color: #0369a1; text-transform: uppercase; font-size: 9.5px; letter-spacing: 0.5px;">Registro Clínico de Restaurações Preexistentes:</strong><br/>
        • <strong>Tipo de Restauração Preexistente:</strong> ${snapshot.dadosRestauracoesPreexistentes.tipoRestauracao || 'Informado no prontuário'}<br/>
        • <strong>Dentes Envolvidos:</strong> ${snapshot.dadosRestauracoesPreexistentes.dentesEnvolvidos || 'Conforme exame clínico'}<br/>
        • <strong>Remoção Prevista:</strong> ${snapshot.dadosRestauracoesPreexistentes.remocaoPrevista ? 'Sim' : 'Não'}<br/>
        ${snapshot.dadosRestauracoesPreexistentes.condicoesAposRemocao ? `• <strong>Condições Identificadas pós-remoção:</strong> ${snapshot.dadosRestauracoesPreexistentes.condicoesAposRemocao}<br/>` : ''}
        ${snapshot.dadosRestauracoesPreexistentes.necessidadeTratamentoAdicional ? `• <strong>Tratamento Adicional Necessário:</strong> Sim<br/>` : ''}
        ${snapshot.dadosRestauracoesPreexistentes.orcamentoComplementar ? `• <strong>Orçamento Complementar:</strong> ${typeof snapshot.dadosRestauracoesPreexistentes.orcamentoComplementar === 'number' ? formatMoney(snapshot.dadosRestauracoesPreexistentes.orcamentoComplementar) : snapshot.dadosRestauracoesPreexistentes.orcamentoComplementar} (${snapshot.dadosRestauracoesPreexistentes.aprovacaoPaciente ? `Aprovação: ${snapshot.dadosRestauracoesPreexistentes.aprovacaoPaciente}` : 'Pendente de aprovação'})<br/>` : ''}
        ${snapshot.dadosRestauracoesPreexistentes.dataProximaManutencaoSemestral ? `• <strong>Próxima Manutenção Preventiva Semestral:</strong> ${formatarData(snapshot.dadosRestauracoesPreexistentes.dataProximaManutencaoSemestral)}` : ''}
      </div>
      ` : ''}
    </div>
    ` : ''}

    <!-- Cláusula - Das Obrigações da Contratada e dos Padrões Técnicos Profissionais -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">${numClausula()} — DAS OBRIGAÇÕES DA CONTRATADA E DOS PADRÕES TÉCNICOS PROFISSIONAIS</div>
      <p class="paragrafo">
        A <strong>CONTRATADA</strong> compromete-se a prestar os serviços odontológicos com estrita observância às normas do Código de Ética Odontológica (Resolução CFO nº 118/2012) e às boas práticas científicas, empregando técnica apurada, materiais biocompatíveis certificados pela ANVISA e diligência profissional para a obtenção da melhor adequação clínica, estética e funcional para o caso diagnosticado.
      </p>
      <p class="paragrafo">
        <strong>Parágrafo Primeiro:</strong> Em conformidade com a legislação consumerista e as peculiaridades dos tratamentos de reabilitação e estética odontológica (tais como lentes em resina composta, facetas e restaurações estéticas), o(a) <strong>CONTRATANTE</strong> declara ter sido devidamente informado(a) sobre o plano de tratamento proposto, suas indicações, etapas clínicas, benefícios esperados e limitações inerentes.
      </p>
      <p class="paragrafo">
        <strong>Parágrafo Segundo:</strong> O(A) <strong>CONTRATANTE</strong> reconhece que a resposta aos procedimentos odontológicos interage de forma indissociável com características biológicas individuais (substrato dentário, gengiva, cicatrização, oclusão), forças mastigatórias, hábitos parafuncionais (apertamento, bruxismo), higiene oral diária e o comparecimento às consultas periódicas de manutenção preventiva, fatores que influenciam diretamente a preservação, adaptação e durabilidade dos trabalhos executados.
      </p>
      <p class="paragrafo">
        <strong>Parágrafo Terceiro:</strong> A <strong>CONTRATADA</strong> assegura a prestação de assistência profissional, esclarecimento de dúvidas e a realização dos ajustes clínicos necessários durante as etapas do tratamento e no pós-operatório imediato, ressalvadas as hipóteses de danos supervenientes decorrentes de traumas mecânicos externos, intervenção de terceiros não autorizados ou descumprimento das orientações profissionais e do cronograma de manutenção preventiva semestral.
      </p>
    </div>

    <!-- Cláusula - Das Obrigações do Contratante -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">${numClausula()} — DAS OBRIGAÇÕES DO CONTRATANTE / PACIENTE</div>
      <p class="paragrafo">
        O(A) <strong>CONTRATANTE</strong> compromete-se a:
        <br/>a) Comparecer pontualmente a todas as consultas e sessões clínicas agendadas, comunicando eventual impossibilidade de comparecimento com antecedência mínima de 24 (vinte e quatro) horas;
        <br/>b) Seguir rigorosamente as orientações pré e pós-operatórias, recomendações de higiene oral e prescrições de medicamentos indicados pelo cirurgião-dentista;
        <br/>c) Comunicar imediatamente à clínica qualquer alteração em seu estado de saúde, gravidez, reações alérgicas ou sintomas anormais;
        <br/>d) Efetuar os pagamentos nas datas de vencimento estipuladas no cronograma financeiro.
      </p>
    </div>

    <!-- Cláusula - Da Rescisão e Desistência -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">${numClausula()} — DA RESCISÃO E DESISTÊNCIA</div>
      <p class="paragrafo">
        Em caso de desistência imotivada ou solicitação de rescisão antes do término completo do tratamento por qualquer das partes, haverá o acerto de contas exclusivo dos procedimentos já executados e das custas de materiais protéticos e laboratoriais já confeccionados, restituindo-se eventual saldo positivo ou exigindo-se o pagamento dos valores correspondentes às etapas já concluídas.
      </p>
    </div>

    <!-- Cláusula - Proteção de Dados (LGPD) -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">${numClausula()} — DA PROTEÇÃO DE DADOS PESSOAIS (LGPD)</div>
      <p class="paragrafo">
        As partes declaram ciência e anuência ao tratamento de dados pessoais e dados sensíveis de saúde para fins exclusivos de atendimento assistencial, prontuário médico-odontológico, faturamento e cumprimento de deveres legais impostos pelo CFO e pela Lei Federal nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais).
      </p>
    </div>

    <!-- Cláusula - Do Foro e Eficácia Executiva -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">${numClausula()} — DO FORO E EFICÁCIA DE TÍTULO EXECUTIVO EXTRAJUDICIAL</div>
      <p class="paragrafo">
        As partes expressamente reconhecem e atribuem ao presente contrato a eficácia de <strong>Título Executivo Extrajudicial</strong>, nos termos do <strong>Artigo 784, inciso III, do Código de Processo Civil brasileiro (Lei nº 13.105/2015)</strong>, declarando líquidas, certas e exigíveis as obrigações pecuniárias ora assumidas. Para dirimir eventuais controvérsias decorrentes deste instrumento, as partes elegem o foro da Comarca de <strong>${clinica.cidade || 'Domicílio da Clínica'}</strong>, renunciando expressamente a qualquer outro, por mais privilegiado que seja.
      </p>
    </div>

    ${snapshot.observacoesCustomizadas && snapshot.observacoesCustomizadas.trim() && snapshot.observacoesCustomizadas.trim() !== orcamento.observacoes?.trim() ? `
    <!-- Cláusula Especial / Observações Complementares -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">CLÁUSULA ESPECIAL — DAS DISPOSIÇÕES COMPLEMENTARES E CONVENCIONADAS</div>
      <p class="paragrafo">
        ${snapshot.observacoesCustomizadas.trim().replace(/\n/g, '<br/>')}
      </p>
    </div>
    ` : ''}

    <!-- Data e Assinaturas -->
    <div class="bloco-assinaturas">
      <div class="data-local">
        ${dataHojeExtenso}.
      </div>

      <div class="grid-assinaturas">
        <!-- Assinatura Contratante -->
        <div class="campo-assinatura">
          ${snapshot.assinaturaPaciente?.assinaturaData ? `
            <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 6px;">
              ${snapshot.assinaturaPaciente?.selfie ? `
                <div style="text-align: center;">
                  <img src="${snapshot.assinaturaPaciente.selfie}" alt="Selfie do Paciente" style="width: 54px; height: 54px; object-fit: cover; border-radius: 6px; border: 1.5px solid #10b981; box-shadow: 0 1px 3px rgba(0,0,0,0.12);" />
                  <div style="font-size: 8px; color: #059669; font-weight: bold; margin-top: 1px;">Selfie Biométrica</div>
                </div>
              ` : ''}
              <img src="${snapshot.assinaturaPaciente.assinaturaData}" alt="Assinatura Paciente" style="max-height: 52px; max-width: 170px;" />
            </div>
          ` : '<div style="height: 50px;"></div>'}
          <div class="linha-assinatura"></div>
          <div class="assinatura-nome">${snapshot.assinaturaPaciente?.nome || paciente.nome}</div>
          <div class="assinatura-papel">Contratante / Paciente</div>
          <div class="assinatura-detalhes">CPF: ${snapshot.assinaturaPaciente?.cpf || paciente.cpf}${temValorValido(snapshot.assinaturaPaciente?.rg) ? ` • RG: ${snapshot.assinaturaPaciente.rg}` : (temValorValido(paciente.rg) ? ` • RG: ${paciente.rg}` : '')}</div>
          ${snapshot.assinaturaPaciente?.email ? `
            <div class="assinatura-detalhes">E-mail: ${snapshot.assinaturaPaciente.email}</div>
          ` : ''}
          ${snapshot.assinaturaPaciente?.dataHora ? `
            <div class="assinatura-detalhes" style="color: #059669; font-weight: 500;">✓ Assinado digitalmente em ${new Date(snapshot.assinaturaPaciente.dataHora).toLocaleString('pt-BR')}</div>
          ` : ''}
        </div>

        <!-- Assinatura Contratada -->
        <div class="campo-assinatura">
          ${snapshot.assinaturaDentista?.assinaturaData ? `
            <img src="${snapshot.assinaturaDentista.assinaturaData}" alt="Assinatura Dentista" />
          ` : '<div style="height: 50px;"></div>'}
          <div class="linha-assinatura"></div>
          <div class="assinatura-nome">${clinica.dentistaResponsavel}</div>
          <div class="assinatura-papel">${clinica.nome} — Contratada</div>
          <div class="assinatura-detalhes">${labelDocClinica}: ${clinica.cnpj} • CRO: ${clinica.cro}</div>
          ${snapshot.assinaturaDentista?.dataHora ? `
            <div class="assinatura-detalhes" style="color: #059669; font-weight: 500;">✓ Assinado digitalmente em ${new Date(snapshot.assinaturaDentista.dataHora).toLocaleString('pt-BR')}</div>
          ` : ''}
        </div>
      </div>

      <!-- Testemunhas Instrumentais (Art. 784, III CPC) -->
      <div style="margin-top: 36px; padding-top: 16px; border-top: 1px dashed #d1d5db;">
        <div style="text-align: center; font-size: 10px; color: #6b7280; font-family: Arial, sans-serif; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold;">
          Testemunhas Instrumentais (Art. 784, III do Código de Processo Civil)
        </div>
        <div class="grid-assinaturas" style="margin-top: 0;">
          <div class="campo-assinatura">
            <div style="height: 35px;"></div>
            <div class="linha-assinatura"></div>
            <div class="assinatura-nome">Testemunha 1</div>
            <div class="assinatura-papel">Nome: ____________________________</div>
            <div class="assinatura-detalhes">CPF: _____________________________</div>
          </div>
          <div class="campo-assinatura">
            <div style="height: 35px;"></div>
            <div class="linha-assinatura"></div>
            <div class="assinatura-nome">Testemunha 2</div>
            <div class="assinatura-papel">Nome: ____________________________</div>
            <div class="assinatura-detalhes">CPF: _____________________________</div>
          </div>
        </div>
      </div>
    </div>

    ${incluiLentes ? `
    <!-- ANEXO I: TCLE ESPECÍFICO PARA LENTES EM RESINA COMPOSTA (RECOMENDAÇÃO CFO) -->
    <div style="page-break-before: always; margin-top: 36px; padding-top: 24px; border-top: 2px solid #0284c7;">
      <div style="background-color: #0284c7; color: #ffffff; padding: 5px 12px; font-weight: bold; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; border-radius: 3px; display: inline-block; margin-bottom: 12px;">
        Documento Integrante • Anexo I (TCLE)
      </div>
      <div class="titulo-principal" style="margin: 10px 0 16px;">
        <h2>TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO (TCLE)</h2>
        <p>Procedimento de Lentes em Resina Composta e Facetas Estéticas (Resolução CFO nº 118/2012)</p>
      </div>

      <div class="clausula-bloco">
        <div class="clausula-titulo">1. NATUREZA E ESCOPO DO TRATAMENTO ESTÉTICO</div>
        <p class="paragrafo">
          O presente termo complementa e integra indissociavelmente o Contrato de Prestação de Serviços Odontológicos nº <strong>${snapshot.contratoId}</strong>. O tratamento compreende a confecção de lentes e/ou facetas em resina composta sobre os elementos dentários indicados no planejamento clínico (<strong>${snapshot.dadosRestauracoesPreexistentes?.dentesEnvolvidos || orcamento.titulo}</strong>), visando à harmonização do sorriso, fechamento de diastemas, alinhamento visual e luminosidade.
        </p>
      </div>

      <div class="clausula-bloco">
        <div class="clausula-titulo">2. ESCLARECIMENTO DE RISCOS INERENTES, LIMITAÇÕES E FATORES BIOLÓGICOS</div>
        <p class="paragrafo">
          O(A) <strong>CONTRATANTE / PACIENTE</strong> declara ter sido amplamente orientado(a) pela cirurgiã-dentista responsável sobre as propriedades do material restaurador e os seguintes riscos previsíveis:
        </p>
        <ul style="margin: 6px 0 10px 20px; padding-left: 10px; font-size: 12px; line-height: 1.55;">
          <li><strong>Sobrecarga Mastigatória e Fraturas:</strong> A resina composta é um material restaurador de alta estética, suscetível a lascamentos (chipping), trincas ou fraturas se submetida a alimentos muito duros, hábitos parafuncionais (bruxismo, apertamento dental, roer unhas/objetos) ou traumas mecânicos externos.</li>
          <li><strong>Manchamento e Pigmentação Superficial:</strong> Os compósitos resinosos podem absorver gradualmente corantes externos provenientes de tabaco, café, vinho tinto, refrigerantes escuros e molhos pigmentados, exigindo higiene rigorosa e polimentos periódicos em consultório.</li>
          <li><strong>Desgaste Fisiológico e Perda Gradual de Brilho:</strong> O atrito oclusal diário promove desgaste microscópico superficial, restabelecido nas sessões de manutenção e repolimento semestral.</li>
          <li><strong>Sensibilidade Dentinária Transitória:</strong> Poderá ocorrer sensibilidade térmica pós-operatória ao frio ou ao calor nos primeiros dias, de natureza passageira.</li>
          <li><strong>Interação com o Substrato Natural:</strong> A espessura delgada das lentes reflete a cor de fundo do dente natural, podendo demandar opacificadores em dentes escurecidos.</li>
          <li><strong>Saúde Gengival:</strong> A conservação das margens cervicais exige higiene diária com fio dental para prevenir inflamação gengival.</li>
        </ul>
      </div>

      <div class="clausula-bloco">
        <div class="clausula-titulo">3. DEVERES DE CUIDADO E MANUTENÇÃO PREVENTIVA SEMESTRAL</div>
        <div style="margin: 8px 0; padding: 10px 14px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #0284c7; border-radius: 4px; font-family: Arial, sans-serif; font-size: 11px; line-height: 1.5; color: #334155;">
          • <strong>Manutenção Semestral Obrigatória:</strong> Retornar a cada <strong>6 (seis) meses</strong> para consulta de revisão, controle oclusal, profilaxia e polimento preventivo especializado.<br/>
          • <strong>Placa Miorrelaxante:</strong> Caso diagnosticado bruxismo ou apertamento dental, o uso da placa oclusal noturna prescrita é condição indispensável para preservação das restaurações.<br/>
          • <strong>Comunicação de Intercorrências:</strong> Qualquer lascamento, sensibilidade anormal ou alteração deve ser comunicado de imediato à clínica.
        </div>
      </div>

      <div class="clausula-bloco">
        <div class="clausula-titulo">4. MANIFESTAÇÃO FORMAL DE CONSENTIMENTO LIVRE E ESCLARECIDO</div>
        <p class="paragrafo">
          Declaro que li, compreendi todas as orientações prestadas, tive a oportunidade de sanar quaisquer dúvidas e, ciente dos benefícios, limitações e riscos, manifesto expressamente meu pleno <strong>CONSENTIMENTO</strong> para a realização do tratamento com lentes em resina composta.
        </p>
      </div>

      <div class="grid-assinaturas" style="margin-top: 24px;">
        <div class="campo-assinatura">
          ${snapshot.assinaturaPaciente?.assinaturaData ? `
            <img src="${snapshot.assinaturaPaciente.assinaturaData}" alt="Assinatura Paciente" />
          ` : '<div style="height: 45px;"></div>'}
          <div class="linha-assinatura"></div>
          <div class="assinatura-nome">${snapshot.assinaturaPaciente?.nome || paciente.nome}</div>
          <div class="assinatura-papel">Paciente / Consentinte (TCLE)</div>
          <div class="assinatura-detalhes">CPF: ${snapshot.assinaturaPaciente?.cpf || paciente.cpf}</div>
        </div>
        <div class="campo-assinatura">
          ${snapshot.assinaturaDentista?.assinaturaData ? `
            <img src="${snapshot.assinaturaDentista.assinaturaData}" alt="Assinatura Dentista" />
          ` : '<div style="height: 45px;"></div>'}
          <div class="linha-assinatura"></div>
          <div class="assinatura-nome">${clinica.dentistaResponsavel}</div>
          <div class="assinatura-papel">Cirurgiã(o)-Dentista Responsável</div>
          <div class="assinatura-detalhes">${labelDocClinica}: ${clinica.cnpj} • CRO: ${clinica.cro}</div>
        </div>
      </div>
    </div>
    ` : ''}

    ${snapshot.termoUsoImagem?.autorizado === true ? `
      ${gerarFragmentoHtmlTermoUsoImagem(snapshot, incluiLentes ? 'ANEXO II' : 'ANEXO I')}
    ` : ''}

    <!-- Rodapé -->
    <div class="rodape-documento">
      Documento emitido eletronicamente pelo Sistema Odontológico • Identificador Imutável: ${snapshot.contratoId} • Emitido em: ${new Date(snapshot.emitidoEm).toLocaleString('pt-BR')}
    </div>
  </div>
</body>
</html>`;
};

/**
 * Codifica o snapshot do contrato em uma string compacta e segura para URL (base64url).
 * Suporta caracteres UTF-8 e acentuação brasileira perfeitamente.
 */
export function codificarContratoUrl(snapshot: ContratoSnapshot): string {
  try {
    // Clona e limpa campos nulos/vazios para deixar o payload mais leve na URL
    const copia: any = JSON.parse(JSON.stringify(snapshot));
    if (!copia.assinaturaPaciente?.assinaturaData) {
      delete copia.assinaturaPaciente;
    }
    const json = JSON.stringify(copia);
    const utf8Bytes = new TextEncoder().encode(json);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch (e) {
    console.error('Erro ao codificar contrato:', e);
    return '';
  }
}

/**
 * Decodifica a string da URL de volta para o ContratoSnapshot.
 */
export function decodificarContratoUrl(encoded: string): ContratoSnapshot | null {
  try {
    if (!encoded) return null;
    let clean = decodeURIComponent(encoded).trim();
    clean = clean.replace(/-/g, '+').replace(/_/g, '/');
    while (clean.length % 4) {
      clean += '=';
    }
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === 'object' && (parsed.contratoId || parsed.paciente || parsed.orcamento)) {
      return parsed as ContratoSnapshot;
    }
    return null;
  } catch (e) {
    console.error('Erro ao decodificar contrato:', e);
    return null;
  }
}

/**
 * Gera o link público oficial para visualização e assinatura digital do contrato pelo paciente.
 * Gera uma URL resiliente contendo o ID e o payload comprimido 'c', garantindo que o contrato
 * abra perfeitamente em qualquer smartphone de paciente via WhatsApp mesmo sem autenticação.
 */
/**
 * Recupera o ID do usuário/clínica ativo no sistema autenticado.
 */
export async function obterUserIdAtivo(): Promise<string | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user?.id) return sessionData.session.user.id;
  } catch (_) { }
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user?.id) return userData.user.id;
  } catch (_) { }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && (k.startsWith('dental_clinica_id_') || k === 'supabase_user_id' || k === 'clinica_id')) {
          const v = window.localStorage.getItem(k);
          if (v && v.length > 10) return v;
        }
      }
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.includes('auth-token')) {
          const v = window.localStorage.getItem(k);
          if (v) {
            const parsed = JSON.parse(v);
            const uid = parsed?.user?.id || parsed?.currentSession?.user?.id;
            if (uid) return uid;
          }
        }
      }
    } catch (_) { }
  }
  try {
    const { data: rpcId } = await (supabase.rpc as any)('clinica_id');
    if (rpcId && typeof rpcId === 'string') return rpcId;
  } catch (_) { }
  return null;
}

/**
 * Gera um snapshot completo demonstrativo para testes rápidos da assinatura digital
 * (Selfie biométrica, desenho de assinatura, visualização financeira e PDF).
 */
export function gerarSnapshotDemonstracao(nome = 'Diego Duracenski'): ContratoSnapshot {
  const isDiego = nome.toLowerCase().includes('diego') || nome.toLowerCase().includes('duracenski');
  const slug = slugifyNome(nome);
  const idSuffix = isDiego ? 'DEMO-DURACENSKI' : slug.toUpperCase().slice(0, 20);

  return {
    contratoId: `CTR-${idSuffix}`,
    orcamentoId: `ORC-${idSuffix}`,
    pacienteId: `PAC-${idSuffix}`,
    versao: '2.0',
    status: 'emitido',
    emitidoEm: new Date().toISOString(),
    tipoModeloContrato: 'lentes_resina',
    incluiLentesResina: true,
    paciente: {
      id: `PAC-${idSuffix}`,
      nome: nome,
      cpf: isDiego ? '123.456.789-00' : '000.000.000-00',
      rg: isDiego ? '34.567.890-1' : '',
      dataNascimento: isDiego ? '15/05/1992' : '',
      idade: isDiego ? '34 anos' : '',
      endereco: 'Maceió - AL',
      telefone: isDiego ? '(82) 99740-0221' : '',
      email: isDiego ? 'diego@duracenskiodontologia.com.br' : '',
      profissao: isDiego ? 'Empresário' : 'Paciente',
      estadoCivil: 'Solteiro(a)',
    },
    clinica: {
      nome: 'Duracenski Odontologia',
      cro: 'CRO-AL 3456',
      dentistaResponsavel: 'Dra. Rosangela Santos',
      cnpj: '69.890.045/0001-85',
      endereco: 'JTR - Edifício Espanha - R. Comerc. José Pontes de Magalhães, 70 - Sl 405 - Jatiúca, Maceió - AL, 57036-250',
      telefone: '82974002213',
      email: 'contato@duracenskiodontologia.com.br',
      cidade: 'Maceió',
      chavePix: '69.890.045/0001-85',
      favorecidoPix: 'Duracenski Odontologia',
      bancoPix: 'Banco do Brasil',
    },
    orcamento: {
      id: 'ORC-DEMO-2026',
      numeroIdentificador: '2026-DEMO',
      titulo: 'Plano de Tratamento Estético - Lentes em Resina Composta de Alta Carga',
      subtotal: 6000,
      desconto: 500,
      total: 5500,
      totalExtenso: 'cinco mil e quinhentos reais',
      formasPagamento: 'Entrada via PIX + Saldo em até 10x sem juros no Cartão',
      validade: '30 dias',
      dataAprovacao: new Date().toLocaleDateString('pt-BR'),
      itens: [
        {
          id: 'item-1',
          descricao: 'Lentes de Contato em Resina Composta Estética Premium (10 Dentes Superiores 15 ao 25)',
          dente: '15 ao 25',
          quantidade: 10,
          valorUnitario: 550,
          valorTotal: 5500,
        },
      ],
      observacoes: 'Planejamento estético com estratificação anatômica, fechamento de diastemas e acabamento de alto brilho.',
    },
    financeiro: {
      subtotal: 6000,
      desconto: 500,
      total: 5500,
      totalExtenso: 'cinco mil e quinhentos reais',
      formaPagamento: 'Entrada via PIX + Saldo em até 10x no Cartão',
      entrada: 1500,
      parcelas: [
        { numero: 1, valor: 400, vencimento: '30 dias', metodo: 'Cart�o de Cr�dito (10x)', descricao: 'Parcela 1 de 10' },
        { numero: 2, valor: 400, vencimento: '60 dias', metodo: 'Cart�o de Cr�dito (10x)', descricao: 'Parcela 2 de 10' },
        { numero: 3, valor: 400, vencimento: '90 dias', metodo: 'Cart�o de Cr�dito (10x)', descricao: 'Parcela 3 de 10' },
        { numero: 4, valor: 400, vencimento: '120 dias', metodo: 'Cart�o de Cr�dito (10x)', descricao: 'Parcela 4 de 10' },
        { numero: 5, valor: 400, vencimento: '150 dias', metodo: 'Cart�o de Cr�dito (10x)', descricao: 'Parcela 5 de 10' },
        { numero: 6, valor: 400, vencimento: '180 dias', metodo: 'Cart�o de Cr�dito (10x)', descricao: 'Parcela 6 de 10' },
        { numero: 7, valor: 400, vencimento: '210 dias', metodo: 'Cart�o de Cr�dito (10x)', descricao: 'Parcela 7 de 10' },
        { numero: 8, valor: 400, vencimento: '240 dias', metodo: 'Cart�o de Cr�dito (10x)', descricao: 'Parcela 8 de 10' },
        { numero: 9, valor: 400, vencimento: '270 dias', metodo: 'Cart�o de Cr�dito (10x)', descricao: 'Parcela 9 de 10' },
        { numero: 10, valor: 400, vencimento: '300 dias', metodo: 'Cart�o de Cr�dito (10x)', descricao: 'Parcela 10 de 10' },
      ],
      quantidadeParcelas: 10,
      valorParcela: 400,
      metodoParcelamento: 'Cartão de Crédito (10x)',
    },
    termoUsoImagem: {
      ativo: true,
      autorizado: true,
      usoDidaticoCientifico: true,
      usoPublicitarioRedesSociais: true,
      identificacaoFacialVoz: 'rosto_e_voz',
      depoimentos: true,
      canalContatoLgpd: 'contato@duracenskiodontologia.com.br',
    },
  };
}

/**
 * Gera um identificador de contrato humanamente legível e único (ex: CTR-B98666CE).
 */
export function gerarIdentificadorContrato(): string {
  const chars = '0123456789ABCDEF';
  let code = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < 4; i++) {
      code += chars[bytes[i] >> 4] + chars[bytes[i] & 0x0f];
    }
  } else {
    code = Math.random().toString(16).substring(2, 10).toUpperCase();
  }
  return `CTR-${code}`;
}

/**
 * Gera um token de acesso criptograficamente seguro e aleatório para assinatura pública.
 */
export function gerarTokenAcesso(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return Array.from({ length: 48 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/**
 * Retorna a URL base oficial de produção ou o origin local em ambiente de desenvolvimento.
 */
export function obterBaseUrlOficial(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.')) {
      return window.location.origin;
    }
  }
  return 'https://app.lentesemresinamaceio.com.br';
}

/**
 * Constrói a URL pública oficial do contrato (função única e centralizada para todo o sistema):
 * Formato padrão: https://app.lentesemresinamaceio.com.br/{slug-do-paciente}/contrato/{identificador}?token={token}
 * É expressamente proibido transportar payloads de contratos, dados pessoais, imagens ou base64 na URL.
 */
export function construirUrlPublicaContrato(params: {
  pacienteNome?: string;
  identificador: string;
  token?: string;
}): string {
  const base = obterBaseUrlOficial();
  const slug = slugifyNome(params.pacienteNome || 'paciente');
  const tokenParam = params.token ? `token=${encodeURIComponent(params.token)}` : '';
  const queryStr = tokenParam ? `?${tokenParam}` : '';
  return `${base}/${slug}/contrato/${params.identificador}${queryStr}`;
}

/**
 * Emite e persiste definitivamente o contrato no Supabase antes de gerar o link curto.
 * Retorna o identificador, o token e a URL oficial para compartilhamento seguro.
 */
export async function emitirContratoPersistido(
  snapshot: ContratoSnapshot,
  docId?: string
): Promise<{
  ok: boolean;
  link: string;
  identificador: string;
  token: string;
  id?: string | null;
  snapshot: ContratoSnapshot;
  error?: string;
}> {
  try {
    const pacienteNome = snapshot.pacienteNome || snapshot.paciente?.nome || 'Paciente';
    const rawPacienteId = snapshot.pacienteId || snapshot.paciente?.id || null;
    const isDocIdUuid = Boolean(
      docId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(docId)
    );
    const safePacienteUuid = Boolean(
      rawPacienteId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawPacienteId)
    )
      ? rawPacienteId
      : null;

    // 1. Gera ou preserva o identificador oficial do contrato (ex: CTR-B98666CE)
    const identificador =
      snapshot.contratoId && snapshot.contratoId.startsWith('CTR-')
        ? snapshot.contratoId
        : docId && !isDocIdUuid
          ? docId
          : gerarIdentificadorContrato();

    // 2. Gera ou preserva o token criptográfico exclusivo de acesso
    const token = snapshot.token && snapshot.token.length >= 16 ? snapshot.token : gerarTokenAcesso();

    // 3. Define a validade do token (30 dias padrão)
    const tokenValidoAte =
      snapshot.tokenValidoAte || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // 4. Constrói o snapshot imutável com todos os termos, dados e valores (garantindo sanitização total de pagamento)
    const snapshotFinal: ContratoSnapshot = {
      ...snapshot,
      contratoId: identificador,
      pacienteId: rawPacienteId || undefined,
      token,
      tokenValidoAte,
      status: snapshot.status || (snapshot.assinaturaDentista ? 'aguardando_assinatura_paciente' : 'pendente'),
      statusAssinaturaDentista: snapshot.statusAssinaturaDentista || (snapshot.assinaturaDentista ? 'assinado' : 'pendente'),
      statusAssinaturaPaciente: snapshot.statusAssinaturaPaciente || (snapshot.assinaturaPaciente ? 'assinado' : 'pendente'),
      emitidoEm: snapshot.emitidoEm || new Date().toISOString(),
      financeiro: snapshot.financeiro ? {
        ...snapshot.financeiro,
        formaPagamento: limparFormaPagamentoParaContrato(snapshot.financeiro.formaPagamento),
        metodoParcelamento: snapshot.financeiro.metodoParcelamento ? limparFormaPagamentoParaContrato(snapshot.financeiro.metodoParcelamento) : undefined,
        parcelas: (snapshot.financeiro.parcelas || []).map((p) => ({
          ...p,
          descricao: limparFormaPagamentoParaContrato(p.descricao),
          metodo: p.metodo ? limparFormaPagamentoParaContrato(p.metodo) : p.metodo,
        })),
      } : snapshot.financeiro,
      orcamento: snapshot.orcamento ? {
        ...snapshot.orcamento,
        formasPagamento: limparFormaPagamentoParaContrato(snapshot.orcamento.formasPagamento),
      } : snapshot.orcamento,
    };

    // Hidrata dados completos do paciente caso estejam ausentes no snapshot
    if (rawPacienteId && (!temValorValido(snapshotFinal.paciente?.cpf) || !temValorValido(snapshotFinal.paciente?.endereco) || !temValorValido(snapshotFinal.paciente?.telefone))) {
      try {
        const { data: pDb } = await supabase.from('pacientes').select('*').eq('id', rawPacienteId).maybeSingle();
        if (pDb) {
          const endDb = formatarEnderecoCompleto(pDb) || (temValorValido(pDb.endereco) ? pDb.endereco : '');
          snapshotFinal.paciente = {
            ...snapshotFinal.paciente,
            nome: snapshotFinal.paciente?.nome || pDb.nome,
            cpf: temValorValido(snapshotFinal.paciente?.cpf) ? snapshotFinal.paciente.cpf : (pDb.cpf ? formatarDocumento(pDb.cpf) : 'Não informado'),
            rg: temValorValido(snapshotFinal.paciente?.rg) ? snapshotFinal.paciente.rg : (pDb.rg || ''),
            telefone: temValorValido(snapshotFinal.paciente?.telefone) ? snapshotFinal.paciente.telefone : (pDb.telefone ? formatarTelefone(pDb.telefone) : 'Não informado'),
            email: temValorValido(snapshotFinal.paciente?.email) ? snapshotFinal.paciente.email : (pDb.email || 'Não informado'),
            endereco: temValorValido(snapshotFinal.paciente?.endereco) ? snapshotFinal.paciente.endereco : (endDb || 'Não informado'),
            dataNascimento: temValorValido(snapshotFinal.paciente?.dataNascimento) ? snapshotFinal.paciente.dataNascimento : (pDb.data_nascimento ? formatarData(pDb.data_nascimento) : 'Não informada'),
            profissao: temValorValido(snapshotFinal.paciente?.profissao) ? snapshotFinal.paciente.profissao : (pDb.profissao || ''),
            estadoCivil: temValorValido(snapshotFinal.paciente?.estadoCivil) ? snapshotFinal.paciente.estadoCivil : (pDb.estado_civil || ''),
          };
        }
      } catch (_) {}
    }

    // Bloqueio rigoroso de emissão de NOVO contrato com dados financeiros incompletos
    const isNovoContrato = snapshot.status !== 'assinado' && !snapshot.assinaturaPaciente?.assinaturaData;
    if (isNovoContrato) {
      const validacaoCronograma = validarCronogramaFinanceiroContrato(snapshotFinal);
      if (!validacaoCronograma.valido) {
        const msgErro = `Emissão do contrato bloqueada: cronograma financeiro incompleto (${validacaoCronograma.erros.join('; ')}). É obrigatório registrar a condição de pagamento aprovada com as respectivas parcelas antes de emitir o contrato.`;
        console.error('[ContratoEngine]', msgErro);
        return {
          ok: false,
          link: '',
          identificador,
          token,
          id: null,
          snapshot: snapshotFinal,
          error: msgErro,
        };
      }
    }

    const titulo = `Contrato Odontológico - ${pacienteNome} (${identificador})`;
    const html = gerarHtmlContrato(snapshotFinal);

    let finalId: string | null = isDocIdUuid && docId ? docId : null;
    let persistidoComSucesso = false;

    // 5. Tentativa 1: Persistência prioritária via Edge Function (usa service_role)
    try {
      const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('contrato-publico', {
        body: {
          action: 'save',
          id: finalId || identificador,
          identificador,
          token,
          pacienteNome,
          pacienteId: safePacienteUuid,
          titulo,
          html,
          snapshot: snapshotFinal,
        },
      });

      if (!edgeErr && edgeData?.ok) {
        persistidoComSucesso = true;
        if (edgeData.id) finalId = edgeData.id;
      }
    } catch (_) { }

    // 6. Tentativa 2: Persistência direta no banco de dados Supabase (documentos_clinicos)
    if (!persistidoComSucesso) {
      try {
        const effectiveUserId = await obterUserIdAtivo();

        // Se tiver UUID prévio, atualiza
        if (finalId) {
          const { error: updErr } = await supabase
            .from('documentos_clinicos')
            .update({
              paciente_nome: pacienteNome,
              paciente_id: safePacienteUuid,
              titulo,
              conteudo: html,
              itens: snapshotFinal as never,
              atualizado_em: new Date().toISOString(),
            })
            .eq('id', finalId);

          if (!updErr) {
            persistidoComSucesso = true;
          }
        }

        // Se ainda não persistido, verifica se já existe registro com esse contratoId
        if (!persistidoComSucesso) {
          const idUpper = identificador.toUpperCase();
          const idLower = identificador.toLowerCase();

          const { data: exist } = await supabase
            .from('documentos_clinicos')
            .select('id')
            .or(`itens->>contratoId.eq.${idUpper},itens->>contratoId.eq.${idLower},itens->>contratoId.eq.${identificador}`)
            .maybeSingle();

          if (exist?.id) {
            finalId = exist.id;
            const { error: updErr } = await supabase
              .from('documentos_clinicos')
              .update({
                paciente_nome: pacienteNome,
                paciente_id: safePacienteUuid,
                titulo,
                conteudo: html,
                itens: snapshotFinal as never,
                atualizado_em: new Date().toISOString(),
              })
              .eq('id', exist.id);

            if (!updErr) {
              persistidoComSucesso = true;
            }
          }
        }

        // Se ainda não existe, insere novo registro
        if (!persistidoComSucesso) {
          const insertPayload: Record<string, unknown> = {
            paciente_id: safePacienteUuid,
            paciente_nome: pacienteNome,
            tipo: 'contrato',
            titulo,
            conteudo: html,
            itens: snapshotFinal as never,
            dentista: snapshotFinal.clinica?.dentistaResponsavel || null,
            ...(effectiveUserId ? { user_id: effectiveUserId } : {}),
          };
          if (finalId) {
            insertPayload.id = finalId;
          }

          let { data: insData, error: insErr } = await supabase
            .from('documentos_clinicos')
            .insert(insertPayload as never)
            .select('id')
            .maybeSingle();

          // Se falhou por violação de RLS (42501), tenta recuperar sessão direta e salvar com user.id
          if (insErr && (insErr.code === '42501' || insErr.message?.includes('policy'))) {
            try {
              const sessionRes = await supabase.auth.getSession();
              const sessionUid = sessionRes.data?.session?.user?.id;
              if (sessionUid && sessionUid !== effectiveUserId) {
                const retryPayload = { ...insertPayload, user_id: sessionUid };
                const retry = await supabase
                  .from('documentos_clinicos')
                  .insert(retryPayload as never)
                  .select('id')
                  .maybeSingle();
                if (!retry.error && retry.data?.id) {
                  insData = retry.data;
                  insErr = null;
                }
              }
            } catch (_) { }
          }

          if (!insErr && insData?.id) {
            finalId = insData.id;
            persistidoComSucesso = true;
          } else if (insErr) {
            console.error('[ContratoEngine] Falha ao persistir contrato no banco:', insErr);
          }
        }
      } catch (err) {
        console.warn('[ContratoEngine] Erro na gravação direta:', err);
      }
    }

    // 7. Salva no cache local para contingência offline imediata no dispositivo emissor
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const snapJson = JSON.stringify(snapshotFinal);
        window.localStorage.setItem(`contrato_${identificador}`, snapJson);
        if (finalId) window.localStorage.setItem(`contrato_${finalId}`, snapJson);
        const slug = slugifyNome(pacienteNome);
        window.localStorage.setItem(`contrato_slug_${slug}`, snapJson);
      } catch (_) { }
    }

    // 7.1 Vincula o contrato ao orçamento de origem se houver orcamentoId
    const orcId = snapshot.orcamento?.id;
    if (orcId) {
      try {
        supabase
          .from('orcamentos')
          .update({
            contrato_id: identificador,
            contrato_token: token,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', orcId)
          .then(() => {});
      } catch (_) { }
    }

    // 8. Constrói o link oficial curto e seguro com token (sem payload base64 na URL)
    const link = construirUrlPublicaContrato({
      pacienteNome,
      identificador,
      token,
    });

    return {
      ok: persistidoComSucesso,
      link,
      identificador,
      token,
      id: finalId,
      snapshot: snapshotFinal,
      ...(!persistidoComSucesso
        ? { error: 'Contrato salvo no cache local, mas a confirmação no banco Supabase falhou.' }
        : {}),
    };
  } catch (err) {
    console.error('[ContratoEngine] Erro ao emitir contrato persistido:', err);
    const pacienteNome = snapshot.pacienteNome || snapshot.paciente?.nome || 'paciente';
    const identificador = snapshot.contratoId || gerarIdentificadorContrato();
    const token = snapshot.token || gerarTokenAcesso();
    const link = construirUrlPublicaContrato({ pacienteNome, identificador, token });

    return {
      ok: false,
      link,
      identificador,
      token,
      snapshot,
      error: (err && err.message) || 'Erro inesperado',
    };
  }
}

/**
 * Garante que o contrato esteja gravado no banco de dados Supabase (documentos_clinicos).
 */
export async function garantirContratoPersistido(
  snapshot: ContratoSnapshot,
  docId?: string
): Promise<string | null> {
  const res = await emitirContratoPersistido(snapshot, docId);
  return res.id || res.identificador;
}

/**
 * Gera o link público oficial para visualização e assinatura digital do contrato pelo paciente.
 * Gera uma URL curta, limpa e 100% amigável com token de acesso criptograficamente seguro:
 * Formato padrão: https://app.lentesemresinamaceio.com.br/{slug-do-paciente}/contrato/{identificador}?token={token}
 */
export function gerarLinkAssinaturaContrato(snapshot: ContratoSnapshot, docId?: string): string {
  const pacienteNome = snapshot.pacienteNome || snapshot.paciente?.nome || 'paciente';

  // Garante identificador e token presentes no snapshot
  if (!snapshot.contratoId) {
    snapshot.contratoId = docId && !docId.includes('-') ? docId : gerarIdentificadorContrato();
  }
  if (!snapshot.token) {
    snapshot.token = gerarTokenAcesso();
  }
  if (!snapshot.tokenValidoAte) {
    snapshot.tokenValidoAte = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  // Dispara a persistência no Supabase para garantir disponibilidade imediata
  if (typeof window !== 'undefined') {
    emitirContratoPersistido(snapshot, docId).catch((err) => {
      console.warn('[ContratoEngine] Persistência em segundo plano:', err);
    });
  }

  return construirUrlPublicaContrato({
    pacienteNome,
    identificador: snapshot.contratoId,
    token: snapshot.token,
  });
}
