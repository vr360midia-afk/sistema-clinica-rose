/**
 * Utilitário para Extração e Previsão de Parcelas de Orçamentos
 * Permite:
 * 1. Manter pacientes quitados estritamente no mês em que foram quitados.
 * 2. Calcular a parcela do mês vigente e projetar expectativas nos meses futuros (PIX Parcelado, Boleto, etc.).
 * 3. Identificar e marcar claramente quando o paciente é de outro mês (fechado em período anterior).
 */

import { extrairAnoMes, isDataNoMesAno, ehTransacaoPaga, ehTransacaoPendente } from './financeiroCalculos';
import { calcularSaldoOrcamento } from './orcamentoSaldo';

export interface ParcelaProgramada {
  orcamentoId: string;
  pacienteId?: string | null;
  pacienteNome: string;
  numeroParcela?: number;
  totalParcelas?: number;
  valor: number;
  dataVencimento: string; // YYYY-MM-DD ou ISO
  dataBr: string; // DD/MM/YYYY
  ano: number;
  mes0Indexed: number;
  metodo: string; // 'pix_parcelado' | 'boleto' | 'cartao' | 'pix' | 'dinheiro' | 'outro'
  status: 'pago' | 'pendente' | 'a_vencer';
  origemFechamentoAnoMes?: string; // Ex: "10/2026"
  isPacienteOutroMes: boolean; // Se o orçamento foi fechado em mês anterior ao da parcela
  descricao: string;
}

export interface AnaliseOrcamentoMes {
  orcamento: any;
  saldoGeral: {
    total: number;
    pago: number;
    saldo: number;
    percentual: number;
  };
  pertenceAoMes: boolean;
  isQuitadoGlobal: boolean;
  quitadoNoMes: boolean;
  quitadoEmOutroMes: boolean;
  mesQuitacao?: string; // Ex: "10/2026"
  isFechadoNesteMes: boolean;
  isPacienteOutroMes: boolean;
  mesFechamento: string; // Ex: "10/2026"
  dataFechamento?: any;
  parcelaDoMes: {
    temParcela: boolean;
    valor: number;
    pagoNoMes: number;
    aVencerNoMes: number;
    statusNoMes: 'quitada' | 'a_vencer' | 'parcial' | 'sem_movimento';
    descricao: string;
    vencimento?: string;
  };
  proximasParcelas: ParcelaProgramada[];
}

/**
 * Converte data DD/MM/YYYY para YYYY-MM-DD
 */
export function brToIso(dStr: string): string {
  if (!dStr) return '';
  const match = dStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const d = match[1].padStart(2, '0');
    const m = match[2].padStart(2, '0');
    const y = match[3];
    return `${y}-${m}-${d}`;
  }
  return dStr;
}

/**
 * Converte data YYYY-MM-DD para DD/MM/YYYY
 */
export function isoToBr(dStr: string): string {
  if (!dStr) return '';
  const match = dStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return dStr;
}

/**
 * Extrai todas as parcelas programadas de um orçamento (via transações vinculadas e/ou formas de pagamento)
 */
export function extrairTodasParcelasOrcamento(orcamento: any, transacoes: any[] = []): ParcelaProgramada[] {
  if (!orcamento) return [];
  const parcelas: ParcelaProgramada[] = [];

  const transVinculadas = (transacoes || []).filter(
    (t) => (t?.orcamentoId && t.orcamentoId === orcamento.id) || t?.orcamento_id === orcamento.id
  );

  const snap = (orcamento as any).assinatura_paciente || (orcamento as any).assinaturaPaciente || {};
  const dataAprovacao =
    (orcamento as any).dataAssinatura ||
    (orcamento as any).data_assinatura ||
    orcamento.aprovadoEm ||
    (orcamento as any).aprovado_em ||
    snap.aprovadoEm ||
    orcamento.criadoEm ||
    (orcamento as any).criado_em;

  const amAprovacao = extrairAnoMes(dataAprovacao) || { ano: 2026, mes: 9 };
  const mesFechamentoStr = `${String(amAprovacao.mes + 1).padStart(2, '0')}/${amAprovacao.ano}`;

  const formasRaw = orcamento.formasPagamento || (orcamento as any).formas_pagamento || '';

  // 1. Parser de Vencimentos Explícitos em texto: ex: "(Vencimentos: 05/11/2026, 05/12/2026, 05/01/2027...)"
  if (typeof formasRaw === 'string' && /Vencimentos:/i.test(formasRaw)) {
    const matchVencs = formasRaw.match(/Vencimentos:\s*([^)]+)/i);
    if (matchVencs) {
      const datesStr = matchVencs[1];
      const dateMatches = datesStr.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || [];
      const matchVal = formasRaw.match(/em\s+(\d+)x\s+de\s+R\$\s*([\d.,]+)/i);
      let valorParcela = 0;
      if (matchVal) {
        valorParcela = parseFloat(matchVal[2].replace(/\./g, '').replace(',', '.'));
      } else if (dateMatches.length > 0 && Number(orcamento.total || 0) > 0) {
        valorParcela = Number((Number(orcamento.total || 0) / dateMatches.length).toFixed(2));
      }

      let metodo = 'pix_parcelado';
      if (/boleto/i.test(formasRaw)) metodo = 'boleto';
      else if (/cart[aã]o/i.test(formasRaw)) metodo = 'cartao';
      else if (/pix/i.test(formasRaw)) metodo = 'pix';

      dateMatches.forEach((dStr, idx) => {
        const dataIso = brToIso(dStr);
        const amParcela = extrairAnoMes(dataIso);
        if (!amParcela) return;

        // Verifica se há transação paga correspondente a este mês
        const txPagaNoMes = transVinculadas.find((t) => {
          if (!ehTransacaoPaga(t)) return false;
          const amT = extrairAnoMes(t.data || t.dataPagamento);
          return amT && amT.ano === amParcela.ano && amT.mes === amParcela.mes;
        });

        const status: 'pago' | 'a_vencer' = txPagaNoMes ? 'pago' : 'a_vencer';
        const valorReal = txPagaNoMes ? Number(txPagaNoMes.valor || valorParcela) : valorParcela;
        const isPacienteOutroMes = amParcela.ano !== amAprovacao.ano || amParcela.mes !== amAprovacao.mes;

        parcelas.push({
          orcamentoId: orcamento.id,
          pacienteId: orcamento.pacienteId,
          pacienteNome: orcamento.pacienteNome || 'Paciente',
          numeroParcela: idx + 1,
          totalParcelas: dateMatches.length,
          valor: valorReal,
          dataVencimento: dataIso,
          dataBr: dStr,
          ano: amParcela.ano,
          mes0Indexed: amParcela.mes,
          metodo,
          status,
          origemFechamentoAnoMes: mesFechamentoStr,
          isPacienteOutroMes,
          descricao: `Parcela ${idx + 1}/${dateMatches.length} (${metodo})`,
        });
      });
    }
  }

  // 2. Parser para JSON ou quando não houver vencimentos explícitos em texto
  if (parcelas.length === 0 && transVinculadas.length > 0) {
    transVinculadas.forEach((t, idx) => {
      const dt = t.vencimento || t.data || t.dataPagamento;
      const am = extrairAnoMes(dt);
      if (!am) return;
      const isPaga = ehTransacaoPaga(t);
      const isPacienteOutroMes = am.ano !== amAprovacao.ano || am.mes !== amAprovacao.mes;

      parcelas.push({
        orcamentoId: orcamento.id,
        pacienteId: orcamento.pacienteId || t.pacienteId,
        pacienteNome: orcamento.pacienteNome || t.pacienteNome || 'Paciente',
        numeroParcela: idx + 1,
        totalParcelas: transVinculadas.length,
        valor: Number(t.valor || 0),
        dataVencimento: typeof dt === 'string' ? dt : new Date(dt).toISOString().slice(0, 10),
        dataBr: isoToBr(typeof dt === 'string' ? dt : new Date(dt).toISOString().slice(0, 10)),
        ano: am.ano,
        mes0Indexed: am.mes,
        metodo: t.metodoPagamento || t.metodo_pagamento || 'receita',
        status: isPaga ? 'pago' : 'a_vencer',
        origemFechamentoAnoMes: mesFechamentoStr,
        isPacienteOutroMes,
        descricao: t.descricao || `Lançamento ${idx + 1}`,
      });
    });
  }

  return parcelas;
}

/**
 * Analisa a situação completa de um orçamento sob a ótica de um mês específico
 */
export function analisarOrcamentoNoMes(
  orcamento: any,
  transacoes: any[] = [],
  orcamentos: any[] = [],
  ano: number,
  mes0Indexed: number
): AnaliseOrcamentoMes {
  const saldoGeral = calcularSaldoOrcamento(orcamento, transacoes, orcamentos);
  const isQuitadoGlobal = saldoGeral.saldo <= 0.009;

  const snap = (orcamento as any).assinatura_paciente || (orcamento as any).assinaturaPaciente || {};
  const dataFechamento =
    (orcamento as any).dataAssinatura ||
    (orcamento as any).data_assinatura ||
    orcamento.aprovadoEm ||
    (orcamento as any).aprovado_em ||
    snap.aprovadoEm ||
    orcamento.criadoEm ||
    (orcamento as any).criado_em;

  const amFechamento = extrairAnoMes(dataFechamento) || { ano, mes: mes0Indexed };
  const mesFechamento = `${String(amFechamento.mes + 1).padStart(2, '0')}/${amFechamento.ano}`;
  const isFechadoNesteMes = amFechamento.ano === ano && amFechamento.mes === mes0Indexed;
  const isPacienteOutroMes = !isFechadoNesteMes && (amFechamento.ano < ano || (amFechamento.ano === ano && amFechamento.mes < mes0Indexed));

  // Transações vinculadas pagas para identificar a data em que foi quitado
  const transVinculadas = (transacoes || []).filter(
    (t) => (t?.orcamentoId && t.orcamentoId === orcamento.id) || t?.orcamento_id === orcamento.id
  );

  const datasPagas = transVinculadas
    .filter(ehTransacaoPaga)
    .map((t) => t.data || t.dataPagamento)
    .filter(Boolean) as string[];

  datasPagas.sort();
  const ultimaDataPagamento = datasPagas[datasPagas.length - 1] || dataFechamento;
  const amUltimoPagamento = extrairAnoMes(ultimaDataPagamento);

  const mesQuitacao = amUltimoPagamento
    ? `${String(amUltimoPagamento.mes + 1).padStart(2, '0')}/${amUltimoPagamento.ano}`
    : mesFechamento;

  const quitadoNoMes = isQuitadoGlobal && Boolean(amUltimoPagamento && amUltimoPagamento.ano === ano && amUltimoPagamento.mes === mes0Indexed);
  const quitadoEmOutroMes = isQuitadoGlobal && !quitadoNoMes;

  // Extrai todas as parcelas programadas
  const todasParcelas = extrairTodasParcelasOrcamento(orcamento, transacoes);

  // Filtra parcelas do mês em análise
  const parcelasDesteMes = todasParcelas.filter((p) => p.ano === ano && p.mes0Indexed === mes0Indexed);

  // Também considera transações de caixa reais vinculadas ao orçamento neste mês
  const transPagasNoMes = transVinculadas.filter((t) => {
    if (!ehTransacaoPaga(t)) return false;
    const amT = extrairAnoMes(t.data || t.dataPagamento);
    return amT && amT.ano === ano && amT.mes === mes0Indexed;
  });

  const somaPagaNoMes = transPagasNoMes.reduce((s, t) => s + Number(t.valor || 0), 0);

  const transPendentesNoMes = transVinculadas.filter((t) => {
    if (!ehTransacaoPendente(t)) return false;
    const amT = extrairAnoMes(t.vencimento || t.data);
    return amT && amT.ano === ano && amT.mes === mes0Indexed;
  });

  let somaAVencerNoMes = transPendentesNoMes.reduce((s, t) => s + Number(t.valor || 0), 0);

  // Se não houver transações pendentes no banco mas houver parcelas programadas 'a_vencer' do texto:
  if (somaAVencerNoMes === 0) {
    const parcelasAVencerTexto = parcelasDesteMes.filter((p) => p.status === 'a_vencer');
    somaAVencerNoMes = parcelasAVencerTexto.reduce((s, p) => s + p.valor, 0);
  }

  const valorParcelaMes = Math.max(somaPagaNoMes + somaAVencerNoMes, parcelasDesteMes.reduce((s, p) => s + p.valor, 0));

  let statusNoMes: 'quitada' | 'a_vencer' | 'parcial' | 'sem_movimento' = 'sem_movimento';
  if (valorParcelaMes > 0) {
    if (somaAVencerNoMes === 0 && somaPagaNoMes > 0) statusNoMes = 'quitada';
    else if (somaPagaNoMes > 0 && somaAVencerNoMes > 0) statusNoMes = 'parcial';
    else if (somaAVencerNoMes > 0) statusNoMes = 'a_vencer';
  } else if (isFechadoNesteMes) {
    statusNoMes = isQuitadoGlobal ? 'quitada' : 'a_vencer';
  }

  // Define se o orçamento "pertence" à visão ativa deste mês:
  // 1. Se tem saldo a receber globalmente (está em tratamento/pagamento ativo);
  // 2. OU se foi quitado exatamente neste mês;
  // 3. OU se teve pagamento realizado neste mês;
  // 4. OU se tem parcela a vencer programada para este mês;
  // 5. OU se é novo contrato fechado neste mês.
  // IMPORTANTE: Se está 100% quitado e a quitação foi em OUTRO mês, pertenceAoMes é FALSE!
  let pertenceAoMes = false;
  if (!isQuitadoGlobal) {
    pertenceAoMes = true;
  } else if (quitadoNoMes) {
    pertenceAoMes = true;
  } else if (somaPagaNoMes > 0) {
    pertenceAoMes = true;
  }

  // Próximas parcelas nos meses futuros
  const proximasParcelas = todasParcelas.filter((p) => {
    return p.ano > ano || (p.ano === ano && p.mes0Indexed > mes0Indexed);
  });

  return {
    orcamento,
    saldoGeral,
    pertenceAoMes,
    isQuitadoGlobal,
    quitadoNoMes,
    quitadoEmOutroMes,
    mesQuitacao,
    isFechadoNesteMes,
    isPacienteOutroMes,
    mesFechamento,
    dataFechamento,
    parcelaDoMes: {
      temParcela: valorParcelaMes > 0,
      valor: valorParcelaMes,
      pagoNoMes: somaPagaNoMes,
      aVencerNoMes: somaAVencerNoMes,
      statusNoMes,
      descricao: parcelasDesteMes[0]?.descricao || (valorParcelaMes > 0 ? `Parcela do Mês` : 'Sem parcela agendada no mês'),
      vencimento: parcelasDesteMes[0]?.dataBr,
    },
    proximasParcelas,
  };
}
