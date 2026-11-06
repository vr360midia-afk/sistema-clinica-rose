import { formatMoney } from './exportCsv';
import { calcularTaxaCartao } from '@/hooks/useMaquinasCartao';

export type TipoCondicaoPagamento =
  | 'a_vista'
  | 'cartao'
  | 'entrada_saldo'
  | 'pix_parcelado'
  | 'boleto'
  | 'personalizado';

export interface ItemFormaComposta {
  id: string;
  rotulo: string; // Ex: "Entrada", "Restante", "Forma 2", etc.
  metodo: 'pix' | 'cartao' | 'dinheiro' | 'boleto' | 'transferencia' | 'pix_parcelado';
  valor: number;
  parcelas?: number;
  tipoCartao?: 'credito' | 'debito';
  operadoraCartaoId?: string;
  diaVencimento?: number;
  situacao?: 'A vencer' | 'Quitada' | 'Autorizado';
  prazoDias?: number;
  cartaoAutorizado?: boolean;
  autorizacaoConfirmada?: boolean;
  nsu?: string;
  codigoAutorizacao?: string;
  pago?: boolean;
  quitado?: boolean;
  comprovado?: boolean;
}

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
  dataEntrada?: string;
  situacaoEntrada?: 'Quitada' | 'A vencer';
  saldoTipoPrazo?: 'dias' | 'parcelas' | 'conclusao';
  saldoPrazoDias?: number;
  saldoParcelas?: number;
  saldoMetodo?: 'cartao' | 'pix_parcelado' | 'boleto' | 'conclusao';
  saldoValorParcela?: number;
  dataPrimeiroVencimento?: string;
  situacaoSaldo?: 'A vencer' | 'Quitado' | 'Autorizado';
  diaVencimento?: number;
  descricao: string;
  formasCompostas?: ItemFormaComposta[];
  selecionada?: boolean;
  destaque?: boolean;
  pagamentoConfirmado?: boolean;
  comprovado?: boolean;
  pago?: boolean;
  cartaoAutorizado?: boolean;
  autorizacaoConfirmada?: boolean;
  nsu?: string;
  codigoAutorizacao?: string;
  entradaConfirmada?: boolean;
  saldoConfirmado?: boolean;
}

export interface EstruturaCondicoesPagamento {
  versao: number;
  selecionadaId?: string;
  condicoes: CondicaoPagamento[];
}

function formatarDataBr(dStr?: string): string {
  if (!dStr) return '';
  const match = dStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return dStr;
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

  const tagSitEnt = cond.situacaoEntrada ? ` [${cond.situacaoEntrada}]` : '';
  const tagDataEnt = cond.dataEntrada ? ` (em ${formatarDataBr(cond.dataEntrada)})` : '';
  const tagSitSaldo = cond.situacaoSaldo ? ` [${cond.situacaoSaldo}]` : '';
  const tagDataSaldo = cond.dataPrimeiroVencimento ? ` (Vencimento: ${formatarDataBr(cond.dataPrimeiroVencimento)})` : '';

  switch (tipo) {
    case 'a_vista': {
      const perc = cond.descontoPercentual || 0;
      if (perc > 0) {
        let descVal = typeof cond.descontoValor === 'number' && cond.descontoValor > 0 ? cond.descontoValor : 0;
        let valComDesc = typeof cond.valorTotal === 'number' && cond.valorTotal > 0 ? cond.valorTotal : 0;

        if (descVal === 0 && valComDesc > 0 && perc < 100) {
          const baseEst = (valComDesc / (100 - perc)) * 100;
          descVal = Number((baseEst - valComDesc).toFixed(2));
        } else if (descVal === 0 && totalBase > 0) {
          descVal = Number(((totalBase * perc) / 100).toFixed(2));
          if (valComDesc === 0) valComDesc = Math.max(0, totalBase - descVal);
        } else if (valComDesc === 0 && totalBase > 0) {
          valComDesc = Math.max(0, totalBase - descVal);
        }

        const textoEconomia = descVal > 0 ? ` (Economia de ${formatMoney(descVal)})` : '';
        return `Pagamento à vista via PIX com ${perc}% de desconto especial: ${formatMoney(valComDesc)}${textoEconomia}${tagDataEnt}${tagSitEnt}`;
      }
      if (total < totalBase) {
        const descVal = totalBase - total;
        const pDesc = Math.round((descVal / totalBase) * 100);
        return `Pagamento à vista via PIX com desconto especial: ${formatMoney(total)} (Economia de ${formatMoney(descVal)} - ${pDesc}% OFF)${tagDataEnt}${tagSitEnt}`;
      }
      if (total > totalBase) {
        return `Pagamento à vista: ${formatMoney(total)}${tagDataEnt}${tagSitEnt}`;
      }
      return `Pagamento à vista via PIX / Transferência: ${formatMoney(total)}${tagDataEnt}${tagSitEnt}`;
    }

    case 'cartao': {
      const p = Math.max(1, cond.parcelas || 1);
      const valP = typeof cond.valorParcela === 'number' && cond.valorParcela > 0
        ? cond.valorParcela
        : (total > 0 ? Number((total / p).toFixed(2)) : 0);
      const isDebito = cond.tipoCartao === 'debito';
      if (isDebito) {
        return `Cartão de Débito à vista: ${formatMoney(total)}${tagDataSaldo}${tagSitSaldo}`;
      }
      if (p > 1) {
        return `Parcelamento no Cartão de Crédito em ${p}x de ${formatMoney(valP)} sem juros (Total: ${formatMoney(total)})${tagDataSaldo}${tagSitSaldo}`;
      }
      return `Cartão de Crédito à vista: ${formatMoney(total)}${tagDataSaldo}${tagSitSaldo}`;
    }

    case 'entrada_saldo': {
      const ent = (typeof cond.valorEntrada === 'number' && cond.valorEntrada > 0)
        ? cond.valorEntrada
        : (total > 0 ? Number((total * 0.5).toFixed(2)) : 0);
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
          return `Entrada de ${formatMoney(ent)}${strPercEnt} ${metEntrada}${tagDataEnt}${tagSitEnt} + Saldo de ${formatMoney(saldo)}${strPercSaldo} a pagar na conclusão do tratamento${tagSitSaldo}`;
        }
        return `Saldo de ${formatMoney(saldo)} a pagar na conclusão do tratamento${tagSitSaldo}`;
      }

      // Caso com prazo em dias (ex: entrada + saldo para 30 dias / X dias)
      if (cond.saldoTipoPrazo === 'dias' || (cond.saldoPrazoDias && cond.saldoPrazoDias > 0)) {
        const dias = cond.saldoPrazoDias || 30;
        if (ent > 0) {
          return `Entrada de ${formatMoney(ent)}${strPercEnt} ${metEntrada}${tagDataEnt}${tagSitEnt} + Saldo de ${formatMoney(saldo)}${strPercSaldo} para ${dias} dias ${metSaldo}${tagDataSaldo}${tagSitSaldo}`;
        }
        return `Saldo integral de ${formatMoney(total)} para ${dias} dias ${metSaldo}${tagDataSaldo}${tagSitSaldo}`;
      }

      // Caso padrão com parcelas
      const parcSaldo = Math.max(1, cond.saldoParcelas || 1);
      const valParcSaldo = saldo / parcSaldo;
      if (ent > 0) {
        if (parcSaldo === 1) {
          return `Entrada de ${formatMoney(ent)}${strPercEnt} ${metEntrada}${tagDataEnt}${tagSitEnt} + Saldo de ${formatMoney(saldo)}${strPercSaldo} em 1x ${metSaldo}${tagDataSaldo}${tagSitSaldo}`;
        }
        return `Entrada de ${formatMoney(ent)}${strPercEnt} ${metEntrada}${tagDataEnt}${tagSitEnt} + Saldo de ${formatMoney(saldo)}${strPercSaldo} em ${parcSaldo}x de ${formatMoney(valParcSaldo)} ${metSaldo}${tagDataSaldo}${tagSitSaldo}`;
      }
      return `Saldo de ${formatMoney(total)} em ${parcSaldo}x de ${formatMoney(valParcSaldo)} ${metSaldo}${tagDataSaldo}${tagSitSaldo}`;
    }

    case 'pix_parcelado': {
      const p = Math.max(1, Math.min(10, cond.parcelas || cond.saldoParcelas || 3));
      const ent = Math.max(0, cond.valorEntrada || 0);
      const saldo = Math.max(0, total - ent);
      const valP = saldo / p;
      const dia = cond.diaVencimento || 10;
      if (ent > 0) {
        return `Entrada de ${formatMoney(ent)} via PIX${tagDataEnt}${tagSitEnt} + ${p}x de ${formatMoney(valP)} via PIX Parcelado (Vencimento todo dia ${dia})${tagSitSaldo}`;
      }
      if (p === 1) {
        return `Plano em 1x de ${formatMoney(valP)} via PIX (Vencimento todo dia ${dia})${tagSitSaldo}`;
      }
      return `Plano em ${p}x de ${formatMoney(valP)} via PIX Parcelado (Vencimento todo dia ${dia})${tagSitSaldo}`;
    }

    case 'boleto': {
      const p = Math.max(1, cond.parcelas || 1);
      const valP = total / p;
      const dia = cond.diaVencimento || 10;
      return `Boleto Bancário em ${p}x de ${formatMoney(valP)} (Vencimento todo dia ${dia})${tagSitSaldo}`;
    }

    case 'personalizado':
    default:
      if (cond.formasCompostas && cond.formasCompostas.length > 0) {
        return montarTextoFormasCompostas(cond.formasCompostas, total);
      }
      return cond.descricao || `Condição de pagamento: ${formatMoney(total)}`;
  }
}

/**
 * Recalcula de forma inteligente e proporcional todas as entradas, saldos, parcelas
 * e descontos de uma condição quando o usuário ajusta seu valor total.
 */
export function recalcularValoresCondicaoComNovoTotal(
  cond: Partial<CondicaoPagamento>,
  novoTotal: number,
  totalBase: number
): Partial<CondicaoPagamento> {
  const vNovo = Math.max(0, Number(novoTotal) || 0);
  const vAnterior = typeof cond.valorTotal === 'number' && cond.valorTotal > 0 ? cond.valorTotal : totalBase;
  const descVal = Math.max(0, totalBase - vNovo);
  const descPerc = totalBase > 0 && descVal > 0 ? Number(((descVal / totalBase) * 100).toFixed(1)) : 0;

  const updated: Partial<CondicaoPagamento> = {
    ...cond,
    valorTotal: vNovo,
    descontoValor: descVal,
    descontoPercentual: descPerc,
  };

  switch (updated.tipo) {
    case 'a_vista':
      break;

    case 'cartao': {
      const p = Math.max(1, updated.parcelas || 1);
      updated.valorParcela = Number((vNovo / p).toFixed(2));
      break;
    }

    case 'entrada_saldo': {
      // Proporção de entrada que existia antes (ex: 50% de entrada)
      let propEntrada = 0.5;
      if (typeof cond.valorEntrada === 'number' && vAnterior > 0) {
        propEntrada = cond.valorEntrada / vAnterior;
      }
      propEntrada = Math.min(1, Math.max(0, propEntrada));

      // Aplica o desconto proporcionalmente tanto na entrada quanto no saldo
      const novaEntrada = Number((vNovo * propEntrada).toFixed(2));
      const novoSaldo = Math.max(0, Number((vNovo - novaEntrada).toFixed(2)));
      const parc = Math.max(1, updated.saldoParcelas || 1);
      const valParc = Number((novoSaldo / parc).toFixed(2));

      updated.valorEntrada = novaEntrada;
      updated.saldoValorParcela = valParc;
      break;
    }

    case 'pix_parcelado': {
      let novaEntrada = 0;
      if (typeof cond.valorEntrada === 'number' && cond.valorEntrada > 0 && vAnterior > 0) {
        const prop = Math.min(1, Math.max(0, cond.valorEntrada / vAnterior));
        novaEntrada = Number((vNovo * prop).toFixed(2));
      }
      const novoSaldo = Math.max(0, Number((vNovo - novaEntrada).toFixed(2)));
      const p = Math.max(1, updated.parcelas || updated.saldoParcelas || 3);
      updated.valorEntrada = novaEntrada;
      updated.valorParcela = Number((novoSaldo / p).toFixed(2));
      break;
    }

    case 'boleto': {
      const p = Math.max(1, updated.parcelas || 1);
      updated.valorParcela = Number((vNovo / p).toFixed(2));
      break;
    }

    case 'personalizado':
    default: {
      if (updated.formasCompostas && updated.formasCompostas.length > 0 && vAnterior > 0) {
        const fator = vAnterior > 0 ? vNovo / vAnterior : 1;
        let somaAjustada = 0;
        const novas = updated.formasCompostas.map((f, i) => {
          if (i === updated.formasCompostas!.length - 1) {
            const valRest = Math.max(0, Number((vNovo - somaAjustada).toFixed(2)));
            return { ...f, valor: valRest };
          }
          const v = Number((f.valor * fator).toFixed(2));
          somaAjustada += v;
          return { ...f, valor: v };
        });
        updated.formasCompostas = novas;
      }
      break;
    }
  }

  // Recalcula o descritivo textual oficial da condição
  updated.descricao = calcularDescricaoCondicao(updated, totalBase);
  return updated;
}

/**
 * Monta o descritivo de uma condição composta por múltiplas formas de pagamento
 */
export function montarTextoFormasCompostas(
  formas: ItemFormaComposta[],
  _totalOrcamento?: number
): string {
  if (!formas || formas.length === 0) return '';
  const partes: string[] = [];

  for (const f of formas) {
    if (!f.valor || f.valor <= 0) continue;
    const isDeb = f.tipoCartao === 'debito';
    const rotulo = f.rotulo?.trim() || 'Parcela';
    const sitPadrao = f.situacao || (f.metodo === 'cartao' ? 'Autorizado' : 'A vencer');
    const sitStr = ` [${sitPadrao}]`;

    if (f.metodo === 'cartao') {
      if (isDeb) {
        partes.push(`${rotulo}: ${formatMoney(f.valor)} via Cartão de Débito${sitStr}`);
      } else {
        const p = Math.max(1, f.parcelas || 1);
        const valParc = f.valor / p;
        if (p > 1) {
          partes.push(`${rotulo}: ${formatMoney(f.valor)} em ${p}x de ${formatMoney(valParc)} no Cartão de Crédito${sitStr}`);
        } else {
          partes.push(`${rotulo}: ${formatMoney(f.valor)} via Cartão de Crédito à vista${sitStr}`);
        }
      }
    } else if (f.metodo === 'pix') {
      partes.push(`${rotulo}: ${formatMoney(f.valor)} via PIX${sitStr}`);
    } else if (f.metodo === 'dinheiro') {
      partes.push(`${rotulo}: ${formatMoney(f.valor)} em Dinheiro${sitStr}`);
    } else if (f.metodo === 'pix_parcelado') {
      const p = Math.max(1, f.parcelas || 1);
      const valParc = f.valor / p;
      const dia = f.diaVencimento || 10;
      partes.push(`${rotulo}: ${formatMoney(f.valor)} em ${p}x de ${formatMoney(valParc)} no PIX Parcelado (Vencimento todo dia ${dia})${sitStr}`);
    } else if (f.metodo === 'boleto') {
      const p = Math.max(1, f.parcelas || 1);
      const valParc = f.valor / p;
      const dia = f.diaVencimento || 10;
      partes.push(`${rotulo}: ${formatMoney(f.valor)} em ${p}x de ${formatMoney(valParc)} no Boleto Bancário (Vencimento todo dia ${dia})${sitStr}`);
    } else if (f.metodo === 'transferencia') {
      partes.push(`${rotulo}: ${formatMoney(f.valor)} via Transferência Bancária${sitStr}`);
    } else {
      partes.push(`${rotulo}: ${formatMoney(f.valor)}${sitStr}`);
    }
  }

  return partes.join(' + ');
}

/**
 * Converte um texto composto existente em uma lista estruturada de formas de pagamento
 */
export function parseTextoParaFormasCompostas(
  texto: string,
  totalBase: number = 0
): ItemFormaComposta[] {
  if (!texto || !texto.trim()) {
    const meia = totalBase > 0 ? Number((totalBase * 0.5).toFixed(2)) : 0;
    const rest = Math.max(0, totalBase - meia);
    return [
      { id: '1', rotulo: 'Entrada', metodo: 'pix', valor: meia, parcelas: 1, situacao: 'A vencer' },
      { id: '2', rotulo: 'Restante', metodo: 'cartao', valor: rest, parcelas: 3, tipoCartao: 'credito', situacao: 'Autorizado' },
    ];
  }

  // Tenta quebrar por " + " ou quebras de linha
  const pedacos = texto.split(/\s+\+\s+|\n+/).map((p) => p.trim()).filter(Boolean);

  if (pedacos.length >= 2) {
    const resultado: ItemFormaComposta[] = [];
    pedacos.forEach((p, idx) => {
      // Ex: "Entrada: R$ 3.059,00 via Cartão de Crédito à vista [Autorizado]"
      // Ex: "Restante: R$ 12.238,00 em 3x de R$ 4.079,33 no Cartão de Crédito [Autorizado]"
      const rotuloMatch = p.match(/^([^:]+):/);
      const rotulo = rotuloMatch ? rotuloMatch[1].trim() : (idx === 0 ? 'Entrada' : `Forma ${idx + 1}`);

      // Valor R$
      const valMatch = p.match(/R\$\s*([\d.,]+)/);
      let valor = 0;
      if (valMatch) {
        valor = Number(valMatch[1].replace(/\./g, '').replace(',', '.')) || 0;
      }

      // Parcelas
      const parcMatch = p.match(/(\d+)x/i);
      const parcelas = parcMatch ? Number(parcMatch[1]) : 1;

      // Método
      const pLower = p.toLowerCase();
      let metodo: ItemFormaComposta['metodo'] = 'cartao';
      let tipoCartao: 'credito' | 'debito' = 'credito';

      if (pLower.includes('pix parcelado')) {
        metodo = 'pix_parcelado';
      } else if (pLower.includes('pix')) {
        metodo = 'pix';
      } else if (pLower.includes('dinheiro')) {
        metodo = 'dinheiro';
      } else if (pLower.includes('boleto')) {
        metodo = 'boleto';
      } else if (pLower.includes('transfer')) {
        metodo = 'transferencia';
      } else if (pLower.includes('cart') || pLower.includes('crédito') || pLower.includes('credito') || pLower.includes('debito') || pLower.includes('débito')) {
        metodo = 'cartao';
        tipoCartao = pLower.includes('deb') ? 'debito' : 'credito';
      }

      // Situação
      let situacao: ItemFormaComposta['situacao'] = 'Autorizado';
      if (pLower.includes('[a vencer]')) {
        situacao = 'A vencer';
      } else if (pLower.includes('[quitada]') || pLower.includes('[pago]')) {
        situacao = 'Quitada';
      }

      resultado.push({
        id: String(idx + 1),
        rotulo,
        metodo,
        valor,
        parcelas,
        tipoCartao,
        situacao,
      });
    });

    if (resultado.length > 0) {
      return resultado;
    }
  }

  // Fallback caso seja 1 texto simples
  const meia = totalBase > 0 ? Number((totalBase * 0.5).toFixed(2)) : 0;
  const rest = Math.max(0, totalBase - meia);
  return [
    { id: '1', rotulo: 'Entrada', metodo: 'pix', valor: meia, parcelas: 1, situacao: 'A vencer' },
    { id: '2', rotulo: 'Restante', metodo: 'cartao', valor: rest, parcelas: 3, tipoCartao: 'credito', situacao: 'Autorizado' },
  ];
}

/**
 * Converte qualquer formato armazenado no campo formas_pagamento para a lista de Condicoes
 */
export function parseCondicoesPagamento(
  formasPagamentoStr?: string | null | any,
  totalBase: number = 0
): CondicaoPagamento[] {
  if (!formasPagamentoStr) {
    return [];
  }

  // Se já for array ou objeto fornecido diretamente
  if (typeof formasPagamentoStr === 'object') {
    if (Array.isArray(formasPagamentoStr)) {
      return formasPagamentoStr as CondicaoPagamento[];
    }
    if (Array.isArray((formasPagamentoStr as any).condicoes)) {
      return (formasPagamentoStr as any).condicoes as CondicaoPagamento[];
    }
    if ((formasPagamentoStr as any).tipo) {
      return [formasPagamentoStr as CondicaoPagamento];
    }
    try {
      formasPagamentoStr = JSON.stringify(formasPagamentoStr);
    } catch (_) {
      return [];
    }
  }

  if (typeof formasPagamentoStr !== 'string' || !formasPagamentoStr.trim()) {
    return [];
  }

  let str = formasPagamentoStr.trim();

  // 0. Remove aspas externas se houver (ex: stringified JSON ou JSON armazenado como string com aspas)
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    try {
      str = JSON.parse(str);
    } catch (_) {
      str = str.slice(1, -1).trim();
    }
  }

  // Desescapa aspas com barra invertida e entidades HTML
  if (typeof str === 'string') {
    if (str.includes('\\"')) str = str.replace(/\\"/g, '"');
    if (str.includes('&quot;')) str = str.replace(/&quot;/g, '"');
  }

  // 1. Tentar parse como JSON estruturado (mesmo que haja texto antes ou depois)
  if (typeof str === 'string' && (str.includes('{') || str.includes('condicoes') || str.includes('versao'))) {
    const startIdx = str.indexOf('{');
    const endIdx = str.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const jsonCandidate = str.substring(startIdx, endIdx + 1);
      try {
        const parsed = JSON.parse(jsonCandidate);
        if (parsed && typeof parsed === 'object' && parsed.tipo && !parsed.condicoes) {
          const vTotal = typeof parsed.valorTotal === 'number' && parsed.valorTotal > 0 ? parsed.valorTotal : (totalBase > 0 ? totalBase : (parsed.valorTotal ?? 0));
          return [{
            id: parsed.id || '1',
            titulo: parsed.titulo && parsed.titulo !== 'Condição de Pagamento' ? parsed.titulo : (parsed.descricao ? parsed.descricao.slice(0, 35) : 'Condição de Pagamento Aprovada'),
            tipo: parsed.tipo || 'personalizado',
            descontoPercentual: parsed.descontoPercentual,
            descontoValor: parsed.descontoValor,
            valorTotal: vTotal,
            parcelas: parsed.parcelas,
            valorParcela: parsed.valorParcela,
            operadoraCartaoId: parsed.operadoraCartaoId,
            tipoCartao: parsed.tipoCartao,
            valorEntrada: parsed.valorEntrada,
            metodoEntrada: parsed.metodoEntrada,
            saldoTipoPrazo: parsed.saldoTipoPrazo,
            saldoPrazoDias: parsed.saldoPrazoDias,
            saldoParcelas: parsed.saldoParcelas,
            saldoMetodo: parsed.saldoMetodo,
            saldoValorParcela: parsed.saldoValorParcela,
            dataEntrada: parsed.dataEntrada,
            situacaoEntrada: parsed.situacaoEntrada,
            dataPrimeiroVencimento: parsed.dataPrimeiroVencimento,
            situacaoSaldo: parsed.situacaoSaldo,
            diaVencimento: parsed.diaVencimento,
            formasCompostas: Array.isArray(parsed.formasCompostas) ? parsed.formasCompostas : undefined,
            descricao: parsed.descricao || calcularDescricaoCondicao(parsed, totalBase),
            selecionada: true,
            destaque: parsed.destaque,
          }];
        }
        if (Array.isArray(parsed.condicoes) && parsed.condicoes.length > 0) {
          return parsed.condicoes.map((c: any, index: number) => {
            const isSelecionada = Boolean(parsed.selecionadaId && String(c.id) === String(parsed.selecionadaId)) || Boolean(c.selecionada);

            let vTotal = typeof c.valorTotal === 'number' && c.valorTotal > 0 ? c.valorTotal : (totalBase > 0 ? totalBase : (c.valorTotal ?? 0));
            let dValor = c.descontoValor;
            let vParcela = c.valorParcela;
            let vEntrada = c.valorEntrada;
            let vSaldoParc = c.saldoValorParcela;
            let desc = c.descricao;

            // Para orçamentos em aberto / rascunhos onde houve inicialização com total=0:
            // Saneia os valores zerados usando o totalBase real, sem alterar orçamentos já aprovados/formalizados
            if (!isSelecionada && totalBase > 0) {
              if (c.tipo === 'a_vista') {
                const perc = typeof c.descontoPercentual === 'number' ? c.descontoPercentual : 0;
                if (perc > 0 && (!dValor || dValor === 0 || vTotal === totalBase)) {
                  dValor = Number(((totalBase * perc) / 100).toFixed(2));
                  vTotal = Math.max(0, Number((totalBase - dValor).toFixed(2)));
                }
              } else if (c.tipo === 'cartao') {
                const p = Math.max(1, c.parcelas || 1);
                if (!vParcela || vParcela === 0) {
                  vParcela = Number((totalBase / p).toFixed(2));
                }
                vTotal = totalBase;
              } else if (c.tipo === 'entrada_saldo') {
                if (!vEntrada || vEntrada === 0) {
                  vEntrada = Number((totalBase * 0.5).toFixed(2));
                }
                const saldoRestante = Math.max(0, Number((totalBase - vEntrada).toFixed(2)));
                const parcSaldo = Math.max(1, c.saldoParcelas || 1);
                if (!vSaldoParc || vSaldoParc === 0) {
                  vSaldoParc = Number((saldoRestante / parcSaldo).toFixed(2));
                }
                vTotal = totalBase;
              }

              if (!desc || /R\$\s*0[,.]00/i.test(desc)) {
                desc = calcularDescricaoCondicao({
                  ...c,
                  valorTotal: vTotal,
                  descontoValor: dValor,
                  valorParcela: vParcela,
                  valorEntrada: vEntrada,
                  saldoValorParcela: vSaldoParc,
                }, totalBase);
              }
            }

            return {
              id: c.id || String(index + 1),
              titulo: c.titulo || `Opção ${index + 1}`,
              tipo: c.tipo || 'personalizado',
              descontoPercentual: c.descontoPercentual,
              descontoValor: dValor,
              valorTotal: vTotal,
              parcelas: c.parcelas,
              valorParcela: vParcela,
              operadoraCartaoId: c.operadoraCartaoId,
              tipoCartao: c.tipoCartao,
              valorEntrada: vEntrada,
              metodoEntrada: c.metodoEntrada,
              saldoTipoPrazo: c.saldoTipoPrazo,
              saldoPrazoDias: c.saldoPrazoDias,
              saldoParcelas: c.saldoParcelas,
              saldoMetodo: c.saldoMetodo,
              saldoValorParcela: vSaldoParc,
              dataEntrada: c.dataEntrada,
              situacaoEntrada: c.situacaoEntrada,
              dataPrimeiroVencimento: c.dataPrimeiroVencimento,
              situacaoSaldo: c.situacaoSaldo,
              diaVencimento: c.diaVencimento,
              formasCompostas: Array.isArray(c.formasCompostas) ? c.formasCompostas : undefined,
              descricao: desc || calcularDescricaoCondicao(c, totalBase),
              selecionada: isSelecionada,
              destaque: c.destaque,
            };
          });
        }
      } catch (_) {
        // Falhou o parse JSON, prossegue para análise de texto
      }
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
        selecionada: false,
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
      selecionada: false,
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

  const idAtivo =
    selecionadaId !== undefined
      ? (selecionadaId.trim() !== '' ? selecionadaId.trim() : undefined)
      : condicoes.find((c) => c.selecionada)?.id;

  const payload: EstruturaCondicoesPagamento = {
    versao: 2,
    selecionadaId: idAtivo,
    condicoes: condicoes.map((c) => ({
      ...c,
      selecionada: Boolean(idAtivo && String(c.id) === String(idAtivo)),
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
  const raw = String(formasPagamento).trim();
  if (!raw) return 'A combinar';

  // Se não contém qualquer vestígio de JSON estruturado, retorna o próprio texto
  if (!raw.includes('{') && !raw.includes('}') && !raw.includes('condicoes') && !raw.includes('versao') && !raw.includes('selecionadaId')) {
    return raw;
  }

  const condicoes = parseCondicoesPagamento(raw);
  const ativa = obterCondicaoAtiva(condicoes);
  if (ativa) {
    // Se a descrição guardada contiver R$ 0,00, erro de cálculo ou resíduos de JSON, recalcula com base nos dados reais
    if (ativa.descricao && (ativa.descricao.includes('R$ 0,00') || ativa.descricao.includes('Economia de R$ 0,00') || ativa.descricao.includes('{') || ativa.descricao.includes('}'))) {
      const descRecalc = calcularDescricaoCondicao(ativa, ativa.valorTotal);
      if (!descRecalc.includes('R$ 0,00') && !descRecalc.includes('{')) {
        return descRecalc;
      }
    }

    if (ativa.descricao && !ativa.descricao.includes('R$ 0,00') && !ativa.descricao.includes('{') && !ativa.descricao.includes('}')) {
      return ativa.descricao;
    }

    if (ativa.titulo && !ativa.titulo.includes('{') && !ativa.titulo.includes('}')) {
      return ativa.valorTotal > 0 ? `${ativa.titulo}: ${formatMoney(ativa.valorTotal)}` : ativa.titulo;
    }
  }

  // Fallback seguro caso seja um JSON com array de condições
  try {
    let unescaped = raw;
    if (unescaped.includes('\\"')) unescaped = unescaped.replace(/\\"/g, '"');
    const sIdx = unescaped.indexOf('{');
    const eIdx = unescaped.lastIndexOf('}');
    if (sIdx !== -1 && eIdx !== -1 && eIdx > sIdx) {
      const parsed = JSON.parse(unescaped.substring(sIdx, eIdx + 1));
      if (Array.isArray(parsed.condicoes) && parsed.condicoes.length > 0) {
        const c = parsed.condicoes.find((item: any) => item.selecionada) || parsed.condicoes[0];
        const res = c.titulo || c.descricao;
        if (res && !res.includes('{') && !res.includes('}')) return res;
      }
    }
  } catch (_) {}

  return 'Conforme acordado no orçamento';
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
    destaque: false,
    selecionada: false,
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

export interface ResumoTaxaCartaoCondicao {
  temCartao: boolean;
  valorBrutoCartao: number;
  taxaValorTotal: number;
  taxaPercentual: number;
  valorLiquidoTotal: number;
  operadoraNome: string;
  operadoraId: string;
  detalhes?: string;
}

/**
 * Calcula a taxa da máquina de cartão e o valor líquido que ficará para a clínica.
 * Esta informação é de uso estritamente INTERNO da clínica e não é exibida ao cliente.
 */
export function calcularResumoCartaoCondicao(
  cond: Partial<CondicaoPagamento>,
  totalBase: number,
  operadoras: any[] = [],
  operadoraPadrao?: any
): ResumoTaxaCartaoCondicao {
  const opId = cond.operadoraCartaoId || operadoraPadrao?.id || 'infinitepay';
  const op = operadoras.find((o) => o.id === opId) || operadoraPadrao;
  const opNome = op?.nome || 'Cartão';
  const total = typeof cond.valorTotal === 'number' && cond.valorTotal > 0 ? cond.valorTotal : totalBase;

  // 1. Tipo Cartão Direto
  if (cond.tipo === 'cartao') {
    const isDebito = cond.tipoCartao === 'debito';
    const parcelas = Math.max(1, cond.parcelas || 1);
    const calc = calcularTaxaCartao(op, parcelas, total, isDebito);
    return {
      temCartao: true,
      valorBrutoCartao: total,
      taxaValorTotal: calc.taxaValor,
      taxaPercentual: calc.taxaPercentual,
      valorLiquidoTotal: calc.valorLiquido,
      operadoraNome: opNome,
      operadoraId: opId,
      detalhes: parcelas > 1 ? `${parcelas}x de ${formatMoney(calc.valorParcelaLiquido)}` : undefined,
    };
  }

  // 2. Tipo Entrada + Saldo
  if (cond.tipo === 'entrada_saldo') {
    const ent = Math.max(0, cond.valorEntrada || 0);
    const saldo = Math.max(0, total - ent);
    let taxaTotal = 0;
    let brutoCartao = 0;
    let tem = false;

    // Se entrada for cartão
    if (cond.metodoEntrada === 'cartao_credito' || cond.metodoEntrada === 'cartao_debito') {
      tem = true;
      brutoCartao += ent;
      const isDeb = cond.metodoEntrada === 'cartao_debito';
      const cEnt = calcularTaxaCartao(op, 1, ent, isDeb);
      taxaTotal += cEnt.taxaValor;
    }

    // Se saldo for cartão
    if (cond.saldoMetodo === 'cartao' && saldo > 0) {
      tem = true;
      brutoCartao += saldo;
      const p = Math.max(1, cond.saldoParcelas || 1);
      const cSaldo = calcularTaxaCartao(op, p, saldo, false);
      taxaTotal += cSaldo.taxaValor;
    }

    if (tem) {
      const percMedia = brutoCartao > 0 ? (taxaTotal / brutoCartao) * 100 : 0;
      return {
        temCartao: true,
        valorBrutoCartao: brutoCartao,
        taxaValorTotal: taxaTotal,
        taxaPercentual: Number(percMedia.toFixed(2)),
        valorLiquidoTotal: total - taxaTotal,
        operadoraNome: opNome,
        operadoraId: opId,
      };
    }
  }

  // 3. Tipo Personalizado com Formas Compostas
  if (cond.tipo === 'personalizado' && cond.formasCompostas && cond.formasCompostas.length > 0) {
    let taxaTotal = 0;
    let brutoCartao = 0;
    let tem = false;

    for (const f of cond.formasCompostas) {
      if (f.metodo === 'cartao' && f.valor > 0) {
        tem = true;
        brutoCartao += f.valor;
        const isDeb = f.tipoCartao === 'debito';
        const p = Math.max(1, f.parcelas || 1);
        const cForma = calcularTaxaCartao(op, p, f.valor, isDeb);
        taxaTotal += cForma.taxaValor;
      }
    }

    if (tem) {
      const percMedia = brutoCartao > 0 ? (taxaTotal / brutoCartao) * 100 : 0;
      return {
        temCartao: true,
        valorBrutoCartao: brutoCartao,
        taxaValorTotal: taxaTotal,
        taxaPercentual: Number(percMedia.toFixed(2)),
        valorLiquidoTotal: total - taxaTotal,
        operadoraNome: opNome,
        operadoraId: opId,
      };
    }
  }

  return {
    temCartao: false,
    valorBrutoCartao: 0,
    taxaValorTotal: 0,
    taxaPercentual: 0,
    valorLiquidoTotal: total,
    operadoraNome: opNome,
    operadoraId: opId,
  };
}

/**
 * Extrai a condição de pagamento aprovada de qualquer representação de orçamento/snapshot
 * com máxima abrangência e rastreabilidade total.
 */
export function extrairCondicaoEscolhida(orcamento: any): CondicaoPagamento | null {
  if (!orcamento) return null;

  const rawCandidatos = [
    orcamento.condicaoEscolhida,
    orcamento.condicao_escolhida,
    orcamento.condicaoAprovada,
    orcamento.condicao_aprovada,
    orcamento.snapshotAprovacao?.condicaoEscolhida,
    orcamento.snapshotAprovacao?.condicao,
    orcamento.snapshot_aprovacao?.condicaoEscolhida,
    orcamento.snapshot_aprovacao?.condicao,
    orcamento.assinatura_paciente?.condicaoEscolhida,
    orcamento.assinatura_paciente?.condicao,
    orcamento.assinatura_paciente?.condicaoAprovada,
    orcamento.assinatura_paciente?.snapshotAprovacao?.condicao,
    orcamento.snapshot?.condicaoEscolhida,
    orcamento.snapshot?.financeiro?.condicaoEscolhida,
    orcamento.financeiro?.condicaoEscolhida,
    orcamento.itens?.financeiro?.condicaoEscolhida,
    orcamento.itens?.condicaoEscolhida,
  ];

  for (let c of rawCandidatos) {
    if (!c) continue;
    if (typeof c === 'string' && (c.startsWith('{') || c.startsWith('['))) {
      try { c = JSON.parse(c); } catch (_) {}
    }
    if (c && typeof c === 'object') {
      if (c.tipo || c.titulo || c.descricao) {
        const valTot = typeof c.valorTotal === 'number' && c.valorTotal > 0
          ? c.valorTotal
          : (typeof orcamento.total === 'number' && orcamento.total > 0 ? orcamento.total : 0);

        return {
          ...c,
          id: c.id || '1',
          titulo: c.titulo && c.titulo !== 'Condição de Pagamento' ? c.titulo : (c.descricao ? c.descricao.slice(0, 35) : 'Condição Aprovada'),
          tipo: c.tipo || 'personalizado',
          descontoPercentual: c.descontoPercentual,
          descontoValor: c.descontoValor,
          valorTotal: valTot,
          parcelas: c.parcelas,
          valorParcela: c.valorParcela,
          operadoraCartaoId: c.operadoraCartaoId,
          tipoCartao: c.tipoCartao,
          valorEntrada: c.valorEntrada,
          metodoEntrada: c.metodoEntrada,
          saldoTipoPrazo: c.saldoTipoPrazo,
          saldoPrazoDias: c.saldoPrazoDias,
          saldoParcelas: c.saldoParcelas,
          saldoMetodo: c.saldoMetodo,
          saldoValorParcela: c.saldoValorParcela,
          dataEntrada: c.dataEntrada,
          situacaoEntrada: c.situacaoEntrada,
          dataPrimeiroVencimento: c.dataPrimeiroVencimento,
          situacaoSaldo: c.situacaoSaldo,
          diaVencimento: c.diaVencimento,
          formasCompostas: Array.isArray(c.formasCompostas) ? c.formasCompostas : undefined,
          descricao: c.descricao || calcularDescricaoCondicao(c, valTot),
          selecionada: true,
          destaque: c.destaque,
          pagamentoConfirmado: Boolean(c.pagamentoConfirmado || c.pago || c.comprovado),
          comprovado: Boolean(c.comprovado || c.pagamentoConfirmado),
          pago: Boolean(c.pago || c.pagamentoConfirmado),
          cartaoAutorizado: Boolean(c.cartaoAutorizado || c.autorizacaoConfirmada || c.nsu || c.codigoAutorizacao),
          autorizacaoConfirmada: Boolean(c.autorizacaoConfirmada || c.cartaoAutorizado),
          nsu: c.nsu,
          codigoAutorizacao: c.codigoAutorizacao,
          entradaConfirmada: Boolean(c.entradaConfirmada || c.situacaoEntrada === 'Quitada'),
          saldoConfirmado: Boolean(c.saldoConfirmado || c.situacaoSaldo === 'Quitado'),
        };
      }
    }
  }

  // 2. Se houver array explícito de condições
  if (Array.isArray(orcamento.condicoes) && orcamento.condicoes.length > 0) {
    const sel = orcamento.condicoes.find((item: any) => item.selecionada) || orcamento.condicoes[0];
    if (sel && sel.tipo && sel.tipo !== 'personalizado') return sel;
  }

  // 3. Parse das formas de pagamento
  const formasRaw = orcamento.formasPagamento || orcamento.formas_pagamento;
  if (formasRaw) {
    const parsed = parseCondicoesPagamento(formasRaw, orcamento.total || 0);
    const ativa = obterCondicaoAtiva(parsed);
    if (ativa && ativa.tipo && ativa.tipo !== 'personalizado') {
      return ativa;
    }
    if (ativa && ativa.descricao && !/a\s*combinar/i.test(ativa.descricao) && ativa.titulo !== 'Condição de Pagamento') {
      return ativa;
    }
  }

  return null;
}
