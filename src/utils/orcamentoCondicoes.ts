import { formatMoney } from './exportCsv';

export type TipoCondicaoPagamento =
  | 'a_vista'
  | 'cartao'
  | 'entrada_saldo'
  | 'pix_parcelado'
  | 'boleto'
  | 'personalizado';

export interface CondicaoPagamento {
  id: string;
  titulo: string;
  tipo: TipoCondicaoPagamento;
  descontoPercentual?: number;
  descontoValor?: number;
  valorTotal: number;
  parcelas?: number;
  valorParcela?: number;
  operadoraCartaoId?: string;
  tipoCartao?: 'credito' | 'debito';
  valorEntrada?: number;
  metodoEntrada?: 'pix' | 'dinheiro' | 'cartao_debito' | 'cartao_credito' | 'transferencia';
  saldoTipoPrazo?: 'dias' | 'parcelas' | 'conclusao';
  saldoPrazoDias?: number;
  saldoParcelas?: number;
  saldoMetodo?: 'cartao' | 'pix_parcelado' | 'boleto' | 'conclusao';
  saldoValorParcela?: number;
  diaVencimento?: number;
  descricao: string;
  selecionada?: boolean;
  destaque?: boolean;
}

export interface EstruturaCondicoesPagamento {
  versao: number;
  selecionadaId?: string;
  condicoes: CondicaoPagamento[];
}

/**
 * Calcula a descrição textual detalhada de uma condição com base em seus parâmetros
 */
export function calcularDescricaoCondicao(
  cond: Partial<CondicaoPagamento>,
  totalBase: number
): string {
  const tipo = cond.tipo || 'personalizado';
  const total = typeof cond.valorTotal === 'number' && cond.valorTotal > 0 ? cond.valorTotal : totalBase;

  switch (tipo) {
    case 'a_vista': {
      const perc = cond.descontoPercentual || 0;
      if (perc > 0) {
        const descVal = cond.descontoValor ?? (totalBase * perc) / 100;
        const valComDesc = Math.max(0, totalBase - descVal);
        return `Pagamento à vista via PIX com ${perc}% de desconto especial: ${formatMoney(valComDesc)} (Economia de ${formatMoney(descVal)})`;
      }
      return `Pagamento à vista via PIX / Transferência: ${formatMoney(total)}`;
    }

    case 'cartao': {
      const p = Math.max(1, cond.parcelas || 1);
      const valP = cond.valorParcela ?? (total / p);
      const isDebito = cond.tipoCartao === 'debito';
      if (isDebito) {
        return `Cartão de Débito à vista: ${formatMoney(total)}`;
      }
      if (p > 1) {
        return `Parcelamento no Cartão de Crédito em ${p}x de ${formatMoney(valP)} sem juros (Total: ${formatMoney(total)})`;
      }
      return `Cartão de Crédito à vista: ${formatMoney(total)}`;
    }

    case 'entrada_saldo': {
      const ent = Math.max(0, cond.valorEntrada || 0);
      const saldo = Math.max(0, total - ent);
      const percEnt = total > 0 ? Math.round((ent / total) * 100) : 0;
      const percSaldo = Math.max(0, 100 - percEnt);
      const strPercEnt = percEnt > 0 && percEnt < 100 ? ` (${percEnt}%)` : '';
      const strPercSaldo = percSaldo > 0 && percSaldo < 100 ? ` (${percSaldo}%)` : '';

      const metEntrada =
        cond.metodoEntrada === 'dinheiro'
          ? 'em Dinheiro'
          : cond.metodoEntrada === 'cartao_credito'
          ? 'no Cartão de Crédito'
          : cond.metodoEntrada === 'cartao_debito'
          ? 'no Débito'
          : cond.metodoEntrada === 'transferencia'
          ? 'via Transferência'
          : 'via PIX';

      const metSaldo =
        cond.saldoMetodo === 'pix_parcelado'
          ? 'via PIX'
          : cond.saldoMetodo === 'boleto'
          ? 'no Boleto Bancário'
          : cond.saldoMetodo === 'conclusao'
          ? 'na conclusão do tratamento'
          : 'no Cartão';

      if (cond.saldoMetodo === 'conclusao' || cond.saldoTipoPrazo === 'conclusao') {
        if (ent > 0) {
          return `Entrada de ${formatMoney(ent)}${strPercEnt} ${metEntrada} + Saldo de ${formatMoney(saldo)}${strPercSaldo} a pagar na conclusão do tratamento`;
        }
        return `Saldo de ${formatMoney(saldo)} a pagar na conclusão do tratamento`;
      }

      // Caso com prazo em dias (ex: entrada + saldo para 30 dias / X dias)
      if (cond.saldoTipoPrazo === 'dias' || (cond.saldoPrazoDias && cond.saldoPrazoDias > 0)) {
        const dias = cond.saldoPrazoDias || 30;
        if (ent > 0) {
          return `Entrada de ${formatMoney(ent)}${strPercEnt} ${metEntrada} + Saldo de ${formatMoney(saldo)}${strPercSaldo} para ${dias} dias ${metSaldo}`;
        }
        return `Saldo integral de ${formatMoney(total)} para ${dias} dias ${metSaldo}`;
      }

      // Caso padrão com parcelas
      const parcSaldo = Math.max(1, cond.saldoParcelas || 1);
      const valParcSaldo = cond.saldoValorParcela ?? (saldo / parcSaldo);
      if (ent > 0) {
        if (parcSaldo === 1) {
          return `Entrada de ${formatMoney(ent)}${strPercEnt} ${metEntrada} + Saldo de ${formatMoney(saldo)}${strPercSaldo} em 1x ${metSaldo}`;
        }
        return `Entrada de ${formatMoney(ent)}${strPercEnt} ${metEntrada} + Saldo de ${formatMoney(saldo)}${strPercSaldo} em ${parcSaldo}x de ${formatMoney(valParcSaldo)} ${metSaldo}`;
      }
      return `Saldo de ${formatMoney(total)} em ${parcSaldo}x de ${formatMoney(valParcSaldo)} ${metSaldo}`;
    }

    case 'pix_parcelado': {
      const p = Math.max(1, cond.parcelas || cond.saldoParcelas || 3);
      const ent = Math.max(0, cond.valorEntrada || 0);
      const saldo = Math.max(0, total - ent);
      const valP = saldo / p;
      const dia = cond.diaVencimento || 10;
      if (ent > 0) {
        return `Entrada de ${formatMoney(ent)} via PIX + ${p}x de ${formatMoney(valP)} via PIX Parcelado (Vencimento todo dia ${dia})`;
      }
      return `Plano em ${p}x de ${formatMoney(valP)} via PIX Parcelado (Vencimento todo dia ${dia})`;
    }

    case 'boleto': {
      const p = Math.max(1, cond.parcelas || 1);
      const valP = total / p;
      const dia = cond.diaVencimento || 10;
      return `Boleto Bancário em ${p}x de ${formatMoney(valP)} (Vencimento todo dia ${dia})`;
    }

    case 'personalizado':
    default:
      return cond.descricao || `Condição de pagamento: ${formatMoney(total)}`;
  }
}

/**
 * Converte qualquer formato armazenado no campo formas_pagamento para a lista de Condicoes
 */
export function parseCondicoesPagamento(
  formasPagamentoStr?: string | null,
  totalBase: number = 0
): CondicaoPagamento[] {
  if (!formasPagamentoStr || typeof formasPagamentoStr !== 'string' || !formasPagamentoStr.trim()) {
    return [];
  }

  const str = formasPagamentoStr.trim();

  // 1. Tentar parse como JSON estruturado
  if (str.startsWith('{') && str.endsWith('}')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed.condicoes) && parsed.condicoes.length > 0) {
        return parsed.condicoes.map((c: any, index: number) => ({
          id: c.id || String(index + 1),
          titulo: c.titulo || `Opção ${index + 1}`,
          tipo: c.tipo || 'personalizado',
          descontoPercentual: c.descontoPercentual,
          descontoValor: c.descontoValor,
          valorTotal: typeof c.valorTotal === 'number' ? c.valorTotal : totalBase,
          parcelas: c.parcelas,
          valorParcela: c.valorParcela,
          operadoraCartaoId: c.operadoraCartaoId,
          tipoCartao: c.tipoCartao,
          valorEntrada: c.valorEntrada,
          metodoEntrada: c.metodoEntrada,
          saldoParcelas: c.saldoParcelas,
          saldoMetodo: c.saldoMetodo,
          saldoValorParcela: c.saldoValorParcela,
          diaVencimento: c.diaVencimento,
          descricao: c.descricao || calcularDescricaoCondicao(c, totalBase),
          selecionada: c.selecionada ?? (parsed.selecionadaId ? c.id === parsed.selecionadaId : index === 0),
          destaque: c.destaque,
        }));
      }
    } catch (_) {
      // Falhou o parse JSON, prossegue para análise de texto
    }
  }

  // 2. Tentar detectar múltiplas opções separadas por marcadores de bloco comuns:
  // Ex: "Opção 1:", "Opção 2:", "Condição 1:", "---", "• Opção", etc.
  const regexOpcao = /(?:^|\n+)(?:(?:🔹|▪️|•|\*|#)?\s*(?:Op[çc][aã]o|Condi[çc][aã]o)\s*(\d+|[A-Z]):?\s*([^\n]+)?)/gi;
  const matches = Array.from(str.matchAll(regexOpcao));

  if (matches.length >= 2) {
    const condicoesExtraidas: CondicaoPagamento[] = [];
    for (let i = 0; i < matches.length; i++) {
      const matchAtual = matches[i];
      const startIdx = matchAtual.index! + matchAtual[0].length;
      const endIdx = i + 1 < matches.length ? matches[i + 1].index! : str.length;
      const numOrLetter = matchAtual[1];
      const subTitulo = matchAtual[2] ? matchAtual[2].trim() : '';
      const corpo = str.substring(startIdx, endIdx).trim();
      const tituloFinal = subTitulo ? `Opção ${numOrLetter}: ${subTitulo.replace(/^[*_~]+|[*_~]+$/g, '')}` : `Opção ${numOrLetter}`;
      const textoFinal = corpo ? `${subTitulo ? '' : ''}${corpo}`.trim() : subTitulo;

      condicoesExtraidas.push({
        id: String(i + 1),
        titulo: tituloFinal,
        tipo: /pix.*desconto|vista/i.test(textoFinal)
          ? 'a_vista'
          : /entrada/i.test(textoFinal)
          ? 'entrada_saldo'
          : /cart[aã]o|cr[eé]dito/i.test(textoFinal)
          ? 'cartao'
          : 'personalizado',
        valorTotal: totalBase,
        descricao: textoFinal,
        selecionada: i === 0,
      });
    }

    if (condicoesExtraidas.length > 0) {
      return condicoesExtraidas;
    }
  }

  // 3. Fallback: Texto único legado. Retorna como única condição padrão.
  return [
    {
      id: '1',
      titulo: 'Condição de Pagamento',
      tipo: 'personalizado',
      valorTotal: totalBase,
      descricao: str,
      selecionada: true,
    },
  ];
}

/**
 * Serializa a lista de condições para armazenamento seguro em formas_pagamento
 */
export function serializarCondicoesPagamento(
  condicoes: CondicaoPagamento[],
  selecionadaId?: string
): string {
  if (!condicoes || condicoes.length === 0) {
    return '';
  }

  // Se tiver apenas 1 condição do tipo personalizado e texto simples, salva o próprio texto simples para máxima compatibilidade
  if (condicoes.length === 1 && condicoes[0].tipo === 'personalizado' && !condicoes[0].destaque) {
    return condicoes[0].descricao;
  }

  const idAtivo = selecionadaId || condicoes.find((c) => c.selecionada)?.id || condicoes[0]?.id;

  const payload: EstruturaCondicoesPagamento = {
    versao: 2,
    selecionadaId: idAtivo,
    condicoes: condicoes.map((c) => ({
      ...c,
      selecionada: c.id === idAtivo,
    })),
  };

  return JSON.stringify(payload);
}

/**
 * Retorna a condição ativa / selecionada (ou a primeira disponível)
 */
export function obterCondicaoAtiva(condicoes: CondicaoPagamento[]): CondicaoPagamento | null {
  if (!condicoes || condicoes.length === 0) return null;
  const sel = condicoes.find((c) => c.selecionada);
  return sel || condicoes[0];
}

/**
 * Retorna o texto formatado limpo para exibição ou para inclusão no contrato/financeiro
 */
export function obterTextoCondicaoParaContrato(formasPagamento?: string | null): string {
  if (!formasPagamento) return 'A combinar';
  const condicoes = parseCondicoesPagamento(formasPagamento);
  const ativa = obterCondicaoAtiva(condicoes);
  if (ativa) {
    return ativa.descricao || ativa.titulo;
  }
  return formasPagamento;
}

/**
 * Monta texto profissional com múltiplas condições para ser enviado via WhatsApp
 */
export function gerarTextoWhatsAppCondicoes(
  condicoes: CondicaoPagamento[],
  totalOrcamento: number
): string {
  if (!condicoes || condicoes.length === 0) {
    return `💳 *Condições de Pagamento:* ${formatMoney(totalOrcamento)} (A combinar)`;
  }

  if (condicoes.length === 1) {
    return `💳 *Condições de Pagamento:*\n${condicoes[0].descricao}`;
  }

  const linhas: string[] = [];
  linhas.push(`💳 *OPÇÕES DE CONDIÇÕES DE NEGOCIAÇÃO:*`);
  linhas.push(`Apresentamos abaixo as condições disponíveis para sua escolha:`);
  linhas.push('');

  condicoes.forEach((c, idx) => {
    const selMarcador = c.selecionada ? ' ✅ *(Opção Recomendada/Pactuada)*' : '';
    linhas.push(`🔹 *${c.titulo}*${selMarcador}`);
    linhas.push(`   ${c.descricao}`);
    if (idx < condicoes.length - 1) {
      linhas.push('');
    }
  });

  return linhas.join('\n');
}

/**
 * Filtra EXCLUSIVAMENTE a condição selecionada/escolhida,
 * descartando automaticamente todas as outras opções da negociação.
 * Retorna a condição única e o payload serializado limpo para o contrato e financeiro.
 */
export function filtrarApenasCondicaoEscolhida(
  condicoes: CondicaoPagamento[],
  selecionadaId?: string
): { condicaoEscolhida: CondicaoPagamento; formasPagamentoFinal: string } {
  if (!condicoes || condicoes.length === 0) {
    const fallback: CondicaoPagamento = {
      id: '1',
      titulo: 'Condição de Pagamento',
      tipo: 'personalizado',
      valorTotal: 0,
      descricao: 'A combinar',
      selecionada: true,
    };
    return {
      condicaoEscolhida: fallback,
      formasPagamentoFinal: 'A combinar',
    };
  }

  const idAlvo = selecionadaId || condicoes.find((c) => c.selecionada)?.id || condicoes[0]?.id;
  const encontrada = condicoes.find((c) => c.id === idAlvo) || condicoes[0];

  const condicaoEscolhida: CondicaoPagamento = {
    ...encontrada,
    selecionada: true,
    destaque: true,
  };

  // Serializa estritamente esta condição única, para que as outras não existam mais no registro
  const formasPagamentoFinal = serializarCondicoesPagamento([condicaoEscolhida], condicaoEscolhida.id);

  return {
    condicaoEscolhida,
    formasPagamentoFinal,
  };
}

/**
 * Gera um trio de propostas padrão inteligentes com base no valor do orçamento
 */
export function gerarTrioPropostasSugeridas(totalOrcamento: number): CondicaoPagamento[] {
  const total = Math.max(0, totalOrcamento);

  // 1. À Vista Especial no PIX com 10% de desconto
  const percDesc = 10;
  const valDesc = Number(((total * percDesc) / 100).toFixed(2));
  const totalAVista = Math.max(0, total - valDesc);

  const opt1: CondicaoPagamento = {
    id: '1',
    titulo: 'Opção 1: À Vista no PIX (10% de Desconto)',
    tipo: 'a_vista',
    descontoPercentual: percDesc,
    descontoValor: valDesc,
    valorTotal: totalAVista,
    descricao: `Pagamento à vista via PIX com ${percDesc}% de desconto especial: ${formatMoney(totalAVista)} (Economia de ${formatMoney(valDesc)})`,
    destaque: false,
    selecionada: false,
  };

  // 2. Entrada de 50% + Saldo de 50% para 30 dias (ou parcelado)
  const entSugerida = Number((total * 0.5).toFixed(2));
  const saldoSugerido = Math.max(0, Number((total - entSugerida).toFixed(2)));

  const opt2: CondicaoPagamento = {
    id: '2',
    titulo: 'Opção 2: Entrada 50% + Saldo para 30 dias',
    tipo: 'entrada_saldo',
    valorEntrada: entSugerida,
    metodoEntrada: 'pix',
    saldoTipoPrazo: 'dias',
    saldoPrazoDias: 30,
    saldoParcelas: 1,
    saldoMetodo: 'cartao',
    saldoValorParcela: saldoSugerido,
    valorTotal: total,
    descricao: `Entrada de ${formatMoney(entSugerida)} (50%) via PIX + Saldo de ${formatMoney(saldoSugerido)} (50%) para 30 dias no Cartão`,
    destaque: true,
    selecionada: true,
  };

  // 3. Parcelamento em 10x ou 12x no Cartão sem juros
  const parcCartao = total >= 1500 ? 10 : total >= 600 ? 6 : 3;
  const valParcCartao = total > 0 ? Number((total / parcCartao).toFixed(2)) : 0;

  const opt3: CondicaoPagamento = {
    id: '3',
    titulo: `Opção 3: Parcelado em ${parcCartao}x no Cartão`,
    tipo: 'cartao',
    parcelas: parcCartao,
    valorParcela: valParcCartao,
    tipoCartao: 'credito',
    valorTotal: total,
    descricao: `Parcelamento no Cartão de Crédito em ${parcCartao}x de ${formatMoney(valParcCartao)} sem juros (Total: ${formatMoney(total)})`,
    destaque: false,
    selecionada: false,
  };

  return [opt1, opt2, opt3];
}
