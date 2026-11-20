import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Printer,
  FileSpreadsheet,
  Building,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  CheckCircle2,
  Calendar,
  CreditCard,
  Receipt,
  FileText,
  User,
  Sparkles,
} from 'lucide-react';
import { formatMoney, downloadCSV } from '@/utils/exportCsv';
import { isDataNoMesAno, ehTransacaoPaga } from '@/utils/financeiroCalculos';
import { Transacao } from '@/types/shared';

interface ModalRelatorioFechamentoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMonth: string;
  transacoes: Transacao[];
  pacientes: any[];
  orcamentos: any[];
  configuracoes: any;
}

export const ModalRelatorioFechamento: React.FC<ModalRelatorioFechamentoProps> = ({
  open,
  onOpenChange,
  selectedMonth,
  transacoes = [],
  pacientes = [],
  orcamentos = [],
  configuracoes,
}) => {
  const [ano, mes] = useMemo(() => {
    if (!selectedMonth) {
      const d = new Date();
      return [d.getFullYear(), d.getMonth() + 1];
    }
    const [y, m] = selectedMonth.split('-').map(Number);
    return [y, m];
  }, [selectedMonth]);

  const mesFormatado = useMemo(() => {
    try {
      const d = new Date(ano, mes - 1, 1);
      const str = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      return str.charAt(0).toUpperCase() + str.slice(1);
    } catch {
      return `${mes}/${ano}`;
    }
  }, [ano, mes]);

  // Transações do mês selecionado
  const transacoesMes = useMemo(() => {
    return (transacoes || []).filter((t) => {
      const dataRef = t?.data || t?.dataPagamento || t?.vencimento;
      if (!dataRef) return false;
      return isDataNoMesAno(dataRef, ano, mes - 1);
    });
  }, [transacoes, ano, mes]);

  // Receitas Pagas
  const receitasPagas = useMemo(() => {
    return transacoesMes.filter((t) => t?.tipo === 'receita' && ehTransacaoPaga(t));
  }, [transacoesMes]);

  // Despesas Pagas
  const despesasPagas = useMemo(() => {
    return transacoesMes.filter((t) => t?.tipo === 'despesa' && ehTransacaoPaga(t));
  }, [transacoesMes]);

  // Cálculos DRE
  const faturamentoBruto = useMemo(() => {
    return receitasPagas.reduce((acc, t) => acc + Number(t?.valor || 0), 0);
  }, [receitasPagas]);

  const taxasCartaoDespesas = useMemo(() => {
    return despesasPagas
      .filter(
        (t) =>
          t.categoria === 'Taxas de Cartão' ||
          String(t?.descricao || '').toLowerCase().includes('taxa da máquina') ||
          String(t?.descricao || '').toLowerCase().includes('taxa maquininha')
      )
      .reduce((acc, t) => acc + Number(t?.valor || 0), 0);
  }, [despesasPagas]);

  const taxasCartaoTransacoes = useMemo(() => {
    return receitasPagas.reduce((acc, t) => acc + Number((t as any)?.taxaCartaoValor || 0), 0);
  }, [receitasPagas]);

  const totalTaxasCartao = Math.max(taxasCartaoDespesas, taxasCartaoTransacoes);
  const receitaLiquida = Math.max(0, faturamentoBruto - totalTaxasCartao);

  const despesasOperacionais = useMemo(() => {
    return despesasPagas.filter(
      (t) =>
        t.categoria !== 'Taxas de Cartão' &&
        !String(t?.descricao || '').toLowerCase().includes('taxa da máquina')
    );
  }, [despesasPagas]);

  const totalDespesasOperacionais = useMemo(() => {
    return despesasOperacionais.reduce((acc, t) => acc + Number(t?.valor || 0), 0);
  }, [despesasOperacionais]);

  const lucroLiquidoReal = receitaLiquida - totalDespesasOperacionais;
  const margemLiquidaPerc = faturamentoBruto > 0 ? (lucroLiquidoReal / faturamentoBruto) * 100 : 0;

  // Meios de Pagamento
  const faturamentoPix = useMemo(() => {
    return receitasPagas
      .filter((t) => (t.metodoPagamento || '').toLowerCase().includes('pix'))
      .reduce((s, t) => s + Number(t.valor || 0), 0);
  }, [receitasPagas]);

  const faturamentoCartao = useMemo(() => {
    return receitasPagas
      .filter((t) => (t.metodoPagamento || '').toLowerCase().includes('cart'))
      .reduce((s, t) => s + Number(t.valor || 0), 0);
  }, [receitasPagas]);

  const faturamentoOutros = Math.max(0, faturamentoBruto - faturamentoPix - faturamentoCartao);

  // Orçamentos aprovados no mês
  const orcamentosFechadosMes = useMemo(() => {
    return (orcamentos || []).filter((o) => {
      if (o?.status !== 'aprovado') return false;
      const dt = o.aprovadoEm || o.aprovado_em || o.dataAssinatura || o.data_assinatura || o.criadoEm || o.criado_em;
      if (!dt) return false;
      return isDataNoMesAno(dt, ano, mes - 1);
    });
  }, [orcamentos, ano, mes]);

  const totalNovasVendas = useMemo(() => {
    return orcamentosFechadosMes.reduce((s, o) => s + Number(o.total || 0), 0);
  }, [orcamentosFechadosMes]);

  // Mapa de pacientes
  const pacientesMap = useMemo(() => {
    const map = new Map<string, any>();
    (pacientes || []).forEach((p) => {
      if (p?.id) map.set(p.id, p);
    });
    return map;
  }, [pacientes]);

  // Ação de Impressão (PDF Executivo)
  const handleImprimir = () => {
    window.print();
  };

  // Ação de Exportação Excel / CSV Completo
  const handleExportarExcel = () => {
    const filename = `Fechamento_Mensal_${String(mes).padStart(2, '0')}_${ano}`;

    // Construção de CSV consolidado em blocos
    const headers = [
      'Bloco / Categoria',
      'Data',
      'Paciente / Favorecido',
      'Descrição / Procedimento',
      'Forma de Pagamento',
      'Valor Bruto (R$)',
      'Taxa Cartão (R$)',
      'Valor Líquido (R$)',
      'Status',
    ];

    const rows: unknown[][] = [];

    // Linhas de Resumo Executivo
    rows.push(['--- RESUMO EXECUTIVO ---', '', '', '', '', '', '', '', '']);
    rows.push(['KPI', 'Período', 'Faturamento Bruto', 'Taxas de Máquinas', 'Receita Líquida', 'Despesas Operacionais', 'Lucro Líquido Real', 'Margem Líquida %', 'Novas Vendas Fechadas']);
    rows.push([
      'RESULTADOS DO MÊS',
      mesFormatado,
      faturamentoBruto.toFixed(2),
      totalTaxasCartao.toFixed(2),
      receitaLiquida.toFixed(2),
      totalDespesasOperacionais.toFixed(2),
      lucroLiquidoReal.toFixed(2),
      `${margemLiquidaPerc.toFixed(1)}%`,
      totalNovasVendas.toFixed(2),
    ]);
    rows.push([]);

    // Bloco Meios de Pagamento
    rows.push(['--- VOLUME POR MEIO DE RECEBIMENTO ---', '', '', '', '', '', '', '', '']);
    rows.push(['MEIO', 'TOTAL (R$)', '% PARTICIPAÇÃO', '', '', '', '', '', '']);
    rows.push(['PIX', faturamentoPix.toFixed(2), `${faturamentoBruto > 0 ? ((faturamentoPix / faturamentoBruto) * 100).toFixed(1) : 0}%`, '', '', '', '', '', '']);
    rows.push(['Cartão (Crédito/Débito)', faturamentoCartao.toFixed(2), `${faturamentoBruto > 0 ? ((faturamentoCartao / faturamentoBruto) * 100).toFixed(1) : 0}%`, '', '', '', '', '', '']);
    rows.push(['Dinheiro / Outros', faturamentoOutros.toFixed(2), `${faturamentoBruto > 0 ? ((faturamentoOutros / faturamentoBruto) * 100).toFixed(1) : 0}%`, '', '', '', '', '', '']);
    rows.push([]);

    // Bloco Receitas e Parcelas
    rows.push(['--- DETALHAMENTO DE RECEITAS & PARCELAS QUITADAS ---', '', '', '', '', '', '', '', '']);
    receitasPagas.forEach((r) => {
      const pac = r.pacienteId ? pacientesMap.get(r.pacienteId) : null;
      const pacNome = pac?.nome || r.pacienteNome || 'Avulso';
      const dt = r.data ? new Date(r.data).toLocaleDateString('pt-BR') : '-';
      const val = Number(r.valor || 0);
      const taxa = Number((r as any).taxaCartaoValor || 0);
      const liq = (r as any).valorLiquido ? Number((r as any).valorLiquido) : val - taxa;

      rows.push([
        'RECEITA',
        dt,
        pacNome,
        r.descricao || 'Recebimento de Tratamento',
        r.metodoPagamento || 'PIX',
        val.toFixed(2),
        taxa > 0 ? taxa.toFixed(2) : '0.00',
        liq.toFixed(2),
        'Quitado',
      ]);
    });
    rows.push([]);

    // Bloco Despesas
    rows.push(['--- DETALHAMENTO DE DESPESAS OPERACIONAIS PAGAS ---', '', '', '', '', '', '', '', '']);
    despesasOperacionais.forEach((d) => {
      const dt = d.data ? new Date(d.data).toLocaleDateString('pt-BR') : '-';
      const val = Number(d.valor || 0);
      rows.push([
        'DESPESA',
        dt,
        d.categoria || 'Geral',
        d.descricao || 'Despesa Operacional',
        d.metodoPagamento || 'PIX / Boleto',
        val.toFixed(2),
        '0.00',
        val.toFixed(2),
        'Pago',
      ]);
    });
    rows.push([]);

    // Bloco Novos Contratos Fechados
    rows.push(['--- CONTRATOS & VENDAS FECHADAS NO MÊS ---', '', '', '', '', '', '', '', '']);
    orcamentosFechadosMes.forEach((o) => {
      const pac = o.pacienteId ? pacientesMap.get(o.pacienteId) : null;
      const dt = o.aprovadoEm || o.dataAssinatura || o.criadoEm;
      const dtStr = dt ? new Date(dt).toLocaleDateString('pt-BR') : '-';
      const val = Number(o.total || 0);
      rows.push([
        'CONTRATO FECHADO',
        dtStr,
        pac?.nome || o.pacienteNome || 'Paciente',
        o.titulo || 'Plano de Tratamento',
        o.formasPagamento || (o as any).formas_pagamento || 'A combinar',
        val.toFixed(2),
        '0.00',
        val.toFixed(2),
        'Aprovado',
      ]);
    });

    downloadCSV(filename, headers, rows);
  };

  const nomeClinica = configuracoes?.nomeClinica || 'Clínica Odontológica Dra. Rose';
  const cnpjClinica = configuracoes?.cnpj ? `CNPJ: ${configuracoes.cnpj}` : '';
  const foneClinica = configuracoes?.telefone ? `Tel: ${configuracoes.telefone}` : '';
  const dataHojeStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-background">
        {/* Barra de Ações Superior (Oculta na Impressão) */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border bg-muted/30 shrink-0 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-500" />
                Relatório Executivo Mensal de Fechamento
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Demonstrativo oficial de fechamento contábil e operacional referente a{' '}
                <strong className="text-foreground">{mesFormatado}</strong>.
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportarExcel}
                className="h-8 text-xs gap-1.5 font-semibold border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                <span>Exportar Excel (CSV)</span>
              </Button>

              <Button
                size="sm"
                onClick={handleImprimir}
                className="h-8 text-xs gap-1.5 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Imprimir / Salvar PDF</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Documento Formatado para Visualização e Impressão Direta */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 print:p-0 print:overflow-visible">
          {/* Cabeçalho Oficial do Relatório */}
          <div className="border-b-2 border-zinc-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-950 dark:text-white uppercase">
                {nomeClinica}
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                {cnpjClinica} {cnpjClinica && foneClinica ? '•' : ''} {foneClinica}
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="inline-block px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                Fechamento: {mesFormatado}
              </span>
              <p className="text-[11px] text-zinc-500 mt-1">Gerado em: {dataHojeStr}</p>
            </div>
          </div>

          {/* 4 Cards de Síntese Executiva */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                Faturamento Bruto
              </span>
              <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 block mt-1">
                {formatMoney(faturamentoBruto)}
              </span>
              <span className="text-[10px] text-zinc-500 mt-0.5 block">
                {receitasPagas.length} recebimento(s) quitado(s)
              </span>
            </div>

            <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                Taxas de Maquininha
              </span>
              <span className="text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400 block mt-1">
                {totalTaxasCartao > 0 ? `-${formatMoney(totalTaxasCartao)}` : 'R$ 0,00'}
              </span>
              <span className="text-[10px] text-zinc-500 mt-0.5 block">
                Líquido Real: {formatMoney(receitaLiquida)}
              </span>
            </div>

            <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                Custos Fixos & Despesas
              </span>
              <span className="text-lg sm:text-xl font-black text-zinc-900 dark:text-zinc-100 block mt-1">
                {formatMoney(totalDespesasOperacionais)}
              </span>
              <span className="text-[10px] text-zinc-500 mt-0.5 block">
                {despesasOperacionais.length} saída(s) operaciona(is)
              </span>
            </div>

            <div className="p-3.5 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/20">
              <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider block">
                Lucro Líquido Real
              </span>
              <span className="text-lg sm:text-xl font-black text-indigo-700 dark:text-indigo-300 block mt-1">
                {formatMoney(lucroLiquidoReal)}
              </span>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mt-0.5 block">
                Margem Líquida: {margemLiquidaPerc.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Resumo de Formas de Pagamento & Novos Contratos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-2">
              <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" />
                Composição por Meio de Recebimento
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-600 dark:text-zinc-400">PIX Direto / Transferência:</span>
                  <strong className="text-emerald-600 dark:text-emerald-400">
                    {formatMoney(faturamentoPix)}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-600 dark:text-zinc-400">Cartão de Crédito / Débito:</span>
                  <strong className="text-blue-600 dark:text-blue-400">
                    {formatMoney(faturamentoCartao)}
                  </strong>
                </div>
                {faturamentoOutros > 0 && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-zinc-600 dark:text-zinc-400">Dinheiro / Outros:</span>
                    <strong className="text-zinc-800 dark:text-zinc-200">
                      {formatMoney(faturamentoOutros)}
                    </strong>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-2">
              <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Novas Vendas & Contratos Fechados no Mês
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-600 dark:text-zinc-400">Total de Contratos Fechados:</span>
                  <strong className="text-foreground">{orcamentosFechadosMes.length} contrato(s)</strong>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-zinc-600 dark:text-zinc-400">Volume Total Fechado:</span>
                  <strong className="text-amber-600 dark:text-amber-400 font-bold">
                    {formatMoney(totalNovasVendas)}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Tabela de Receitas por Paciente */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5 text-emerald-500" />
              Detalhamento de Receitas do Mês ({receitasPagas.length} lançamentos)
            </h3>

            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
                  <tr>
                    <th className="p-2.5">Paciente</th>
                    <th className="p-2.5">Data</th>
                    <th className="p-2.5">Procedimento / Lançamento</th>
                    <th className="p-2.5 text-center">Meio</th>
                    <th className="p-2.5 text-right">Taxa Cartão</th>
                    <th className="p-2.5 text-right">Líquido</th>
                    <th className="p-2.5 text-right">Bruto (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {receitasPagas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-zinc-500">
                        Nenhuma receita registrada neste mês.
                      </td>
                    </tr>
                  ) : (
                    receitasPagas.map((r, idx) => {
                      const pac = r.pacienteId ? pacientesMap.get(r.pacienteId) : null;
                      const pacNome = pac?.nome || r.pacienteNome || 'Lançamento Avulso';
                      const dtStr = r.data ? new Date(r.data).toLocaleDateString('pt-BR') : '-';
                      const val = Number(r.valor || 0);
                      const taxa = Number((r as any).taxaCartaoValor || 0);
                      const liq = (r as any).valorLiquido ? Number((r as any).valorLiquido) : val - taxa;

                      return (
                        <tr key={r.id || idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                          <td className="p-2.5 font-semibold text-zinc-900 dark:text-zinc-100">
                            {pacNome}
                          </td>
                          <td className="p-2.5 text-zinc-500">{dtStr}</td>
                          <td className="p-2.5 text-zinc-600 dark:text-zinc-400 truncate max-w-xs">
                            {r.descricao || 'Recebimento'}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                              {r.metodoPagamento || 'PIX'}
                            </span>
                          </td>
                          <td className="p-2.5 text-right text-rose-600 dark:text-rose-400">
                            {taxa > 0 ? `-${formatMoney(taxa)}` : '-'}
                          </td>
                          <td className="p-2.5 text-right font-medium text-zinc-700 dark:text-zinc-300">
                            {formatMoney(liq)}
                          </td>
                          <td className="p-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {formatMoney(val)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="border-t-2 border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-bold">
                  <tr>
                    <td colSpan={4} className="p-2.5 text-zinc-700 dark:text-zinc-300">
                      TOTAL RECEITAS DO MÊS
                    </td>
                    <td className="p-2.5 text-right text-rose-600 dark:text-rose-400">
                      {totalTaxasCartao > 0 ? `-${formatMoney(totalTaxasCartao)}` : 'R$ 0,00'}
                    </td>
                    <td className="p-2.5 text-right text-zinc-800 dark:text-zinc-200">
                      {formatMoney(receitaLiquida)}
                    </td>
                    <td className="p-2.5 text-right text-emerald-600 dark:text-emerald-400 text-sm">
                      {formatMoney(faturamentoBruto)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Tabela de Despesas */}
          {despesasOperacionais.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                Custos Operacionais Pagos ({despesasOperacionais.length} saídas)
              </h3>

              <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
                    <tr>
                      <th className="p-2.5">Data</th>
                      <th className="p-2.5">Categoria</th>
                      <th className="p-2.5">Descrição</th>
                      <th className="p-2.5 text-right">Valor Pago (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {despesasOperacionais.map((d, idx) => {
                      const dtStr = d.data ? new Date(d.data).toLocaleDateString('pt-BR') : '-';
                      return (
                        <tr key={d.id || idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                          <td className="p-2.5 text-zinc-500">{dtStr}</td>
                          <td className="p-2.5 font-medium text-zinc-700 dark:text-zinc-300">
                            {d.categoria || 'Geral'}
                          </td>
                          <td className="p-2.5 text-zinc-600 dark:text-zinc-400">{d.descricao}</td>
                          <td className="p-2.5 text-right font-bold text-rose-600 dark:text-rose-400">
                            {formatMoney(Number(d.valor || 0))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-bold">
                    <tr>
                      <td colSpan={3} className="p-2.5 text-zinc-700 dark:text-zinc-300">
                        TOTAL DE DESPESAS OPERACIONAIS
                      </td>
                      <td className="p-2.5 text-right text-rose-600 dark:text-rose-400 text-sm">
                        {formatMoney(totalDespesasOperacionais)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Bloco de Assinaturas Executivas para Impressão */}
          <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-2 gap-8 text-center text-xs text-zinc-500">
            <div>
              <div className="border-b border-zinc-400 dark:border-zinc-600 pb-1 mb-1 font-semibold text-zinc-800 dark:text-zinc-200">
                {configuracoes?.nomeProfissional || 'Responsável Financeiro'}
              </div>
              <span>Administração & Gestão Financeira</span>
            </div>
            <div>
              <div className="border-b border-zinc-400 dark:border-zinc-600 pb-1 mb-1 font-semibold text-zinc-800 dark:text-zinc-200">
                {nomeClinica}
              </div>
              <span>Data de Auditoria: {dataHojeStr.split(' ')[0]}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
export default ModalRelatorioFechamento;
