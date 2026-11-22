/**
 * Utilitários para extração, agregação e exportação de dados para Nota Fiscal (NFS-e)
 * e Contabilidade Odontológica (de cada paciente e do fechamento mensal).
 */

import { Transacao, Paciente } from '@/types/shared';
import { Orcamento } from '@/hooks/useOrcamentos';
import { formatMoney, downloadCSV } from '@/utils/exportCsv';
import { isDataNoMesString, ehTransacaoPaga } from '@/utils/financeiroCalculos';

export interface ProcedimentoItemNF {
  nome: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface DadosNotaFiscalPaciente {
  pacienteId: string;
  pacienteNome: string;
  cpf: string;
  rg?: string;
  endereco?: string;
  telefone?: string;
  email?: string;
  orcamentoId?: string;
  orcamentoTitulo: string;
  procedimentos: ProcedimentoItemNF[];
  tratamentoDescricao: string;
  valorTotalTratamento: number;
  valorRecebidoNoMes: number;
  valorTotalPagoHistorico: number;
  saldoRestante: number;
  metodosPagamento: string[];
  contasEntrada: string[];
  datasPagamentoMes: string[];
  transacoesIds: string[];
  possuiCpf: boolean;
  statusNota?: 'emitida' | 'pendente';
  numeroNota?: string;
}

export interface ResumoNotaFiscalMes {
  selectedMonth: string;
  mesFormatado: string;
  totalRecebidoMes: number;
  totalPacientes: number;
  totalComCpf: number;
  totalSemCpf: number;
  itens: DadosNotaFiscalPaciente[];
}

/**
 * Normaliza e limpa string de CPF
 */
export const formatarCpf = (cpf?: string): string => {
  if (!cpf) return '';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return cpf;
};

/**
 * Gera texto formatado para o campo "Discriminação dos Serviços" da Nota Fiscal de Serviço (NFS-e)
 */
export const gerarTextoDiscriminacaoNF = (
  dados: DadosNotaFiscalPaciente,
  clinicaInfo?: { nome?: string; cnpj?: string; cfo?: string }
): string => {
  const procsTexto =
    dados.procedimentos.length > 0
      ? dados.procedimentos
          .map(
            (p) =>
              `- ${p.nome} (Qtd: ${p.quantidade || 1} | ${formatMoney(p.valorTotal || p.valorUnitario || 0)})`
          )
          .join('\n')
      : `- ${dados.tratamentoDescricao || 'Procedimentos Odontológicos Clínicos'}`;

  const formas = dados.metodosPagamento.length > 0 ? dados.metodosPagamento.join(', ') : 'PIX / Dinheiro';
  const datas = dados.datasPagamentoMes.length > 0 ? dados.datasPagamentoMes.join(', ') : 'No mês';

  return `PRESTAÇÃO DE SERVIÇOS ODONTOLÓGICOS
Paciente / Tomador: ${dados.pacienteNome}
CPF: ${dados.cpf ? formatarCpf(dados.cpf) : 'Não informado'}
${dados.endereco ? `Endereço: ${dados.endereco}\n` : ''}${dados.telefone ? `Telefone: ${dados.telefone}\n` : ''}
DISCRIMINAÇÃO DOS PROCEDIMENTOS:
${procsTexto}

VALORES FISCAIS:
- Valor Recebido (Base da NFS-e): ${formatMoney(dados.valorRecebidoNoMes)}
- Valor Total do Tratamento: ${formatMoney(dados.valorTotalTratamento)}
${dados.saldoRestante > 0 ? `- Saldo a Pagar Futuro: ${formatMoney(dados.saldoRestante)}\n` : ''}- Forma(s) de Pagamento: ${formas}
- Data(s) de Quitação: ${datas}
${dados.orcamentoId ? `- Ref. Orçamento/Contrato: #${dados.orcamentoId.slice(0, 8).toUpperCase()}` : ''}`;
};

/**
 * Agrega os dados fiscais de todos os recebimentos de um determinado mês
 */
export const gerarDadosNotaFiscalMes = ({
  transacoes = [],
  orcamentos = [],
  pacientes = [],
  selectedMonth,
}: {
  transacoes: Transacao[];
  orcamentos: Orcamento[];
  pacientes: Paciente[];
  selectedMonth: string;
}): ResumoNotaFiscalMes => {
  // Filtra apenas receitas quitadas/pagas no mês de competência
  const receitasMes = transacoes.filter((t) => {
    if (t?.tipo !== 'receita') return false;
    if (!ehTransacaoPaga(t)) return false;
    const dataRef = t?.data || (t as any)?.dataPagamento || t?.vencimento;
    if (!dataRef) return false;
    return isDataNoMesString(dataRef, selectedMonth);
  });

  // Mapa de orçamentos por ID
  const orcamentosMap = new Map<string, Orcamento>();
  orcamentos.forEach((o) => {
    if (o?.id) orcamentosMap.set(o.id, o);
  });

  // Mapa de pacientes por ID
  const pacientesMap = new Map<string, Paciente>();
  pacientes.forEach((p) => {
    if (p?.id) pacientesMap.set(p.id, p);
  });

  // Agrupa receitas por chave única (pacienteId + orcamentoId) para não duplicar linhas
  const gruposMap = new Map<string, {
    pacienteId: string;
    orcamentoId?: string;
    transacoes: Transacao[];
  }>();

  receitasMes.forEach((t) => {
    const pId = t.pacienteId || 'sem_paciente';
    const oId = t.orcamentoId || 'avulso';
    const chave = `${pId}_${oId}`;

    if (!gruposMap.has(chave)) {
      gruposMap.set(chave, {
        pacienteId: pId,
        orcamentoId: t.orcamentoId,
        transacoes: [],
      });
    }
    gruposMap.get(chave)!.transacoes.push(t);
  });

  const itens: DadosNotaFiscalPaciente[] = [];
  let totalRecebidoMes = 0;
  let totalComCpf = 0;
  let totalSemCpf = 0;

  gruposMap.forEach((grupo) => {
    const paciente = pacientesMap.get(grupo.pacienteId);
    const orcamento = grupo.orcamentoId ? orcamentosMap.get(grupo.orcamentoId) : undefined;

    const valorRecebidoNoMes = grupo.transacoes.reduce((acc, t) => acc + (t.valor || 0), 0);
    totalRecebidoMes += valorRecebidoNoMes;

    // Métodos e contas de entrada
    const metodosSet = new Set<string>();
    const contasSet = new Set<string>();
    const datasSet = new Set<string>();
    const ids: string[] = [];

    grupo.transacoes.forEach((t) => {
      ids.push(t.id);
      if (t.metodoPagamento) metodosSet.add(t.metodoPagamento.toUpperCase());
      if (t.contaBancariaNome) contasSet.add(t.contaBancariaNome);
      const dataObj = t.data ? new Date(t.data) : new Date();
      if (!isNaN(dataObj.getTime())) {
        datasSet.add(dataObj.toLocaleDateString('pt-BR'));
      }
    });

    // Procedimentos e descrição do tratamento
    let procedimentos: ProcedimentoItemNF[] = [];
    let tratamentoDescricao = '';
    let valorTotalTratamento = valorRecebidoNoMes;

    if (orcamento) {
      tratamentoDescricao = orcamento.titulo || 'Tratamento Odontológico';
      valorTotalTratamento = orcamento.total || valorRecebidoNoMes;
      if (orcamento.itens && Array.isArray(orcamento.itens) && orcamento.itens.length > 0) {
        procedimentos = orcamento.itens.map((it) => ({
          nome: it.nome,
          quantidade: it.quantidade || 1,
          valorUnitario: it.valor || 0,
          valorTotal: (it.quantidade || 1) * (it.valor || 0),
        }));
      }
    } else {
      // Receita avulsa: extrai da descrição da primeira transação
      tratamentoDescricao = grupo.transacoes[0]?.descricao || 'Atendimento / Procedimento Odontológico';
      procedimentos = [
        {
          nome: tratamentoDescricao,
          quantidade: 1,
          valorUnitario: valorRecebidoNoMes,
          valorTotal: valorRecebidoNoMes,
        },
      ];
    }

    // Calcula histórico de quitações totais desse orçamento ou paciente
    let valorTotalPagoHistorico = valorRecebidoNoMes;
    if (grupo.orcamentoId) {
      const todasTransacoesOrc = transacoes.filter(
        (t) => t.orcamentoId === grupo.orcamentoId && t.tipo === 'receita' && ehTransacaoPaga(t)
      );
      valorTotalPagoHistorico = todasTransacoesOrc.reduce((acc, t) => acc + (t.valor || 0), 0);
    }
    const saldoRestante = Math.max(0, valorTotalTratamento - valorTotalPagoHistorico);

    const cpfLimpo = paciente?.cpf || (grupo.transacoes[0] as any)?.pacienteCpf || '';
    const temCpf = Boolean(cpfLimpo && cpfLimpo.trim().length >= 11);

    if (temCpf) {
      totalComCpf++;
    } else {
      totalSemCpf++;
    }

    const pacienteNome =
      paciente?.nome ||
      grupo.transacoes[0]?.pacienteNome ||
      orcamento?.pacienteNome ||
      'Paciente não identificado';

    itens.push({
      pacienteId: grupo.pacienteId,
      pacienteNome,
      cpf: cpfLimpo,
      rg: paciente?.rg,
      endereco: paciente?.endereco,
      telefone: paciente?.telefone,
      email: paciente?.email,
      orcamentoId: grupo.orcamentoId,
      orcamentoTitulo: tratamentoDescricao,
      procedimentos,
      tratamentoDescricao,
      valorTotalTratamento,
      valorRecebidoNoMes,
      valorTotalPagoHistorico,
      saldoRestante,
      metodosPagamento: Array.from(metodosSet),
      contasEntrada: Array.from(contasSet),
      datasPagamentoMes: Array.from(datasSet),
      transacoesIds: ids,
      possuiCpf: temCpf,
    });
  });

  // Ordena por maior valor recebido no mês
  itens.sort((a, b) => b.valorRecebidoNoMes - a.valorRecebidoNoMes);

  // Formatação do nome do mês
  let mesFormatado = selectedMonth;
  try {
    const [anoStr, mesStr] = selectedMonth.split('-');
    const d = new Date(Number(anoStr), Number(mesStr) - 1, 1);
    mesFormatado = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    mesFormatado = mesFormatado.charAt(0).toUpperCase() + mesFormatado.slice(1);
  } catch {}

  return {
    selectedMonth,
    mesFormatado,
    totalRecebidoMes,
    totalPacientes: itens.length,
    totalComCpf,
    totalSemCpf,
    itens,
  };
};

/**
 * Exporta a planilha em CSV compatível com Excel para a contabilidade
 */
export const exportarPlanilhaNotaFiscalCSV = (
  itens: DadosNotaFiscalPaciente[],
  nomeArquivo: string
) => {
  const headers = [
    'Nome do Paciente',
    'CPF',
    'RG',
    'Endereço',
    'Telefone',
    'E-mail',
    'Tratamento / Procedimentos',
    'Detalhe Procedimentos (Qtd x Valor)',
    'Valor Recebido no Mês (R$)',
    'Valor Total Contratado (R$)',
    'Total Pago Histórico (R$)',
    'Saldo a Pagar (R$)',
    'Forma(s) de Pagamento',
    'Conta(s) de Entrada',
    'Data(s) de Recebimento',
    'Nº Orçamento',
    'Status CPF',
  ];

  const rows = itens.map((item) => {
    const procsFormatados = item.procedimentos
      .map((p) => `${p.nome} (${p.quantidade}x R$ ${p.valorUnitario.toFixed(2)})`)
      .join('; ');

    return [
      item.pacienteNome,
      item.cpf ? formatarCpf(item.cpf) : 'SEM CPF CADASTRADO',
      item.rg || '',
      item.endereco || '',
      item.telefone || '',
      item.email || '',
      item.tratamentoDescricao,
      procsFormatados || item.tratamentoDescricao,
      item.valorRecebidoNoMes.toFixed(2).replace('.', ','),
      item.valorTotalTratamento.toFixed(2).replace('.', ','),
      item.valorTotalPagoHistorico.toFixed(2).replace('.', ','),
      item.saldoRestante.toFixed(2).replace('.', ','),
      item.metodosPagamento.join(', ') || 'PIX',
      item.contasEntrada.join(', ') || 'Caixa Geral',
      item.datasPagamentoMes.join(', '),
      item.orcamentoId ? `#${item.orcamentoId.slice(0, 8).toUpperCase()}` : 'Avulso',
      item.possuiCpf ? 'OK' : 'PENDENTE (SEM CPF)',
    ];
  });

  downloadCSV(nomeArquivo, headers, rows);
};
