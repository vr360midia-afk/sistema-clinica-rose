import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  CreditCard,
  Percent,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  Zap,
  ChevronDown,
  ChevronUp,
  Settings,
  AlertCircle,
  ArrowRight,
  Receipt,
  Sparkles,
} from 'lucide-react';
import { Transacao } from '@/types/shared';
import { formatMoney } from '@/utils/exportCsv';
import { useMaquinasCartao } from '@/hooks/useMaquinasCartao';

interface RaioXMaquininhasProps {
  transacoesMes?: Transacao[];
  onOpenConfig?: () => void;
}

interface MetricasOperadora {
  id: string;
  nome: string;
  cor: string;
  volumeBruto: number;
  volumeLiquido: number;
  totalTaxas: number;
  taxaMediaPercentual: number;
  qtdTransacoes: number;
  debito: { volume: number; taxas: number; qtd: number };
  creditoAVista: { volume: number; taxas: number; qtd: number };
  parcelado: { volume: number; taxas: number; qtd: number };
}

export const RaioXMaquininhas: React.FC<RaioXMaquininhasProps> = ({
  transacoesMes = [],
  onOpenConfig,
}) => {
  const { operadoras, config } = useMaquinasCartao();
  const [expandido, setExpandido] = useState<boolean>(true);
  const [mostrarTransacoes, setMostrarTransacoes] = useState<boolean>(false);

  // Processamento e conciliação de cartões no mês
  const metricas = useMemo(() => {
    const lista = transacoesMes || [];

    // 1. Receitas de cartão (pagas ou no caixa)
    const receitasCartao = lista.filter(
      (t) =>
        t &&
        t.tipo === 'receita' &&
        t.status === 'pago' &&
        (t.metodoPagamento === 'cartao' ||
          (t.taxaCartaoValor && t.taxaCartaoValor > 0) ||
          t.descricao?.toLowerCase().includes('cartão') ||
          t.descricao?.toLowerCase().includes('credito') ||
          t.descricao?.toLowerCase().includes('debito'))
    );

    // 2. Despesas lançadas especificamente como taxas de maquininha
    const despesasTaxas = lista.filter(
      (t) =>
        t &&
        t.tipo === 'despesa' &&
        (t.categoria === 'Taxas de Cartão' ||
          t.categoria === (config?.categoriaDespesaPadrao || 'Taxas de Cartão') ||
          t.descricao?.toLowerCase().includes('taxa da máquina') ||
          t.descricao?.toLowerCase().includes('taxa de cartão'))
    );

    let totalBrutoGeral = 0;
    let totalLiquidoGeral = 0;
    let totalTaxasGeral = 0;

    // Inicializa métricas por operadora
    const mapaOperadoras: Record<string, MetricasOperadora> = {
      infinitepay: {
        id: 'infinitepay',
        nome: 'InfinitePay',
        cor: '#00D084',
        volumeBruto: 0,
        volumeLiquido: 0,
        totalTaxas: 0,
        taxaMediaPercentual: 0,
        qtdTransacoes: 0,
        debito: { volume: 0, taxas: 0, qtd: 0 },
        creditoAVista: { volume: 0, taxas: 0, qtd: 0 },
        parcelado: { volume: 0, taxas: 0, qtd: 0 },
      },
      pagbank: {
        id: 'pagbank',
        nome: 'PagBank',
        cor: '#00A868',
        volumeBruto: 0,
        volumeLiquido: 0,
        totalTaxas: 0,
        taxaMediaPercentual: 0,
        qtdTransacoes: 0,
        debito: { volume: 0, taxas: 0, qtd: 0 },
        creditoAVista: { volume: 0, taxas: 0, qtd: 0 },
        parcelado: { volume: 0, taxas: 0, qtd: 0 },
      },
      outras: {
        id: 'outras',
        nome: 'Outras Maquininhas',
        cor: '#6366F1',
        volumeBruto: 0,
        volumeLiquido: 0,
        totalTaxas: 0,
        taxaMediaPercentual: 0,
        qtdTransacoes: 0,
        debito: { volume: 0, taxas: 0, qtd: 0 },
        creditoAVista: { volume: 0, taxas: 0, qtd: 0 },
        parcelado: { volume: 0, taxas: 0, qtd: 0 },
      },
    };

    // Detalhamento de cada transação com identificação de adquirente
    const transacoesProcessadas = receitasCartao.map((t) => {
      const bruto = Number(t.valor || 0);
      let taxaValor = Number(t.taxaCartaoValor || 0);
      let taxaPerc = Number(t.taxaCartaoPercentual || 0);

      // Se não havia taxa embutida na receita, busca despesa correspondente
      if (taxaValor <= 0) {
        const taxaCorresp = despesasTaxas.find(
          (d) =>
            (t.orcamentoId && d.orcamentoId === t.orcamentoId) ||
            (d.descricao && d.descricao.includes(t.descricao))
        );
        if (taxaCorresp) {
          taxaValor = Number(taxaCorresp.valor || 0);
        }
      }

      if (taxaPerc <= 0 && bruto > 0 && taxaValor > 0) {
        taxaPerc = (taxaValor / bruto) * 100;
      }

      const liquido = Number(t.valorLiquido || (bruto - taxaValor));

      // Identifica adquirente
      const descLower = (t.descricao || '').toLowerCase();
      let opId = 'outras';
      if (t.operadoraCartao) {
        opId = t.operadoraCartao.toLowerCase().includes('infinite') ? 'infinitepay' : t.operadoraCartao.toLowerCase().includes('pag') ? 'pagbank' : 'outras';
      } else if (descLower.includes('infinite') || descLower.includes('infinitepay')) {
        opId = 'infinitepay';
      } else if (descLower.includes('pagbank') || descLower.includes('pagseguro')) {
        opId = 'pagbank';
      } else if (config?.operadoraPadraoId) {
        // Se a clínica tem InfinitePay como padrão configurada
        opId = config.operadoraPadraoId;
      }

      const parcelas = Number(t.parcelas || 1);
      const isDebito = descLower.includes('débito') || descLower.includes('debito');
      const isParcelado = parcelas > 1;

      // Incrementa gerais
      totalBrutoGeral += bruto;
      totalLiquidoGeral += liquido;
      totalTaxasGeral += taxaValor;

      // Incrementa operadora
      const opObj = mapaOperadoras[opId] || mapaOperadoras.outras;
      opObj.volumeBruto += bruto;
      opObj.volumeLiquido += liquido;
      opObj.totalTaxas += taxaValor;
      opObj.qtdTransacoes += 1;

      if (isDebito) {
        opObj.debito.volume += bruto;
        opObj.debito.taxas += taxaValor;
        opObj.debito.qtd += 1;
      } else if (isParcelado) {
        opObj.parcelado.volume += bruto;
        opObj.parcelado.taxas += taxaValor;
        opObj.parcelado.qtd += 1;
      } else {
        opObj.creditoAVista.volume += bruto;
        opObj.creditoAVista.taxas += taxaValor;
        opObj.creditoAVista.qtd += 1;
      }

      return {
        ...t,
        bruto,
        liquido,
        taxaValor,
        taxaPerc,
        operadoraIdentificada: opObj.nome,
        parcelas,
        modalidade: isDebito ? 'Débito' : isParcelado ? `Crédito ${parcelas}x` : 'Crédito à Vista',
      };
    });

    // Se houver despesas de taxas que não foram vinculadas diretamente
    const totalDespesasTaxasDiretas = despesasTaxas.reduce((acc, d) => acc + Number(d.valor || 0), 0);
    if (totalDespesasTaxasDiretas > totalTaxasGeral) {
      // Ajusta para refletir o total contábil de taxas debitadas
      totalTaxasGeral = totalDespesasTaxasDiretas;
      totalLiquidoGeral = totalBrutoGeral - totalTaxasGeral;
    }

    // Calcula médias percentuais ponderadas
    const taxaMediaGeral = totalBrutoGeral > 0 ? (totalTaxasGeral / totalBrutoGeral) * 100 : 0;

    Object.values(mapaOperadoras).forEach((op) => {
      op.taxaMediaPercentual = op.volumeBruto > 0 ? (op.totalTaxas / op.volumeBruto) * 100 : 0;
    });

    // Economia estimada contra taxa média bancária tradicional (18%)
    const custoTradicional = totalBrutoGeral * 0.18;
    const economiaEstimada = Math.max(0, custoTradicional - totalTaxasGeral);

    return {
      totalBrutoGeral,
      totalLiquidoGeral,
      totalTaxasGeral,
      taxaMediaGeral,
      economiaEstimada,
      mapaOperadoras,
      transacoesProcessadas,
      qtdTotal: transacoesProcessadas.length,
    };
  }, [transacoesMes, config]);

  if (metricas.qtdTotal === 0 && metricas.totalTaxasGeral === 0) {
    return null;
  }

  const {
    totalBrutoGeral,
    totalLiquidoGeral,
    totalTaxasGeral,
    taxaMediaGeral,
    economiaEstimada,
    mapaOperadoras,
    transacoesProcessadas,
    qtdTotal,
  } = metricas;

  return (
    <Card className="border-blue-500/30 bg-gradient-to-br from-blue-50/60 via-slate-50/40 to-white dark:from-blue-950/20 dark:via-zinc-900 dark:to-zinc-900 shadow-md overflow-hidden">
      <CardHeader className="p-4 pb-3 border-b bg-white/40 dark:bg-zinc-900/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-sm">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  Raio-X & Conciliação de Maquininhas
                </CardTitle>
                <Badge className="bg-blue-600/15 text-blue-700 dark:text-blue-300 text-[10px] font-bold border-0">
                  {qtdTotal} venda(s) no cartão
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Auditoria executiva de taxas descontadas por adquirente no mês (InfinitePay vs PagBank vs Outras).
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {onOpenConfig && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenConfig}
                className="h-8 text-xs gap-1 border-muted-foreground/30 hover:bg-muted/40"
                title="Configurar taxas oficiais das maquininhas"
              >
                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">Ajustar</span> Taxas
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExpandido(!expandido)}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              {expandido ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" /> Recolher
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" /> Expandir
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expandido && (
        <CardContent className="p-4 sm:p-5 space-y-5">
          {/* 4 Cards de Resumo Executivo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border shadow-xs space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                Total Bruto Cobrado
              </span>
              <p className="text-xl sm:text-2xl font-black text-foreground">
                {formatMoney(totalBrutoGeral)}
              </p>
              <span className="text-[10px] text-muted-foreground block truncate">
                Valor total passado na máquina
              </span>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-500/20 shadow-xs space-y-1">
              <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                Líquido Real (Cai na Conta)
              </span>
              <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {formatMoney(totalLiquidoGeral)}
              </p>
              <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 block">
                {(totalBrutoGeral > 0 ? (totalLiquidoGeral / totalBrutoGeral) * 100 : 0).toFixed(1)}% do faturamento em cartão
              </span>
            </div>

            <div className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-500/20 shadow-xs space-y-1">
              <span className="text-[11px] font-semibold text-rose-800 dark:text-rose-300 uppercase tracking-wider block">
                Descontos em Taxas
              </span>
              <p className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
                {formatMoney(totalTaxasGeral)}
              </p>
              <span className="text-[10px] text-rose-700/80 dark:text-rose-400/80 block">
                Retido pelas operadoras
              </span>
            </div>

            <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-500/20 shadow-xs space-y-1">
              <span className="text-[11px] font-semibold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider block flex items-center justify-between">
                <span>Taxa Média Efetiva</span>
                <Percent className="h-3 w-3 text-indigo-500" />
              </span>
              <p className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {taxaMediaGeral.toFixed(2)}%
              </p>
              <span className="text-[10px] text-indigo-700/80 dark:text-indigo-400/80 block truncate">
                {taxaMediaGeral <= 10
                  ? '✨ Excelente taxa média'
                  : taxaMediaGeral <= 14
                  ? 'Taxa moderada'
                  : 'Atenção ao custo das parcelas'}
              </span>
            </div>
          </div>

          {/* Comparativo de Maquininhas: InfinitePay vs PagBank vs Outras */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Divisão por Maquininha & Auditoria de Taxas
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* InfinitePay */}
              {(() => {
                const op = mapaOperadoras.infinitepay;
                const percTotal = totalBrutoGeral > 0 ? (op.volumeBruto / totalBrutoGeral) * 100 : 0;
                return (
                  <div className="rounded-xl border border-emerald-500/30 bg-card p-4 space-y-3 shadow-xs relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#00D084]" />
                        <span className="font-bold text-sm text-foreground">InfinitePay</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-bold border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
                        {op.qtdTransacoes} venda(s)
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted-foreground">Volume Bruto:</span>
                        <span className="font-bold text-sm text-foreground">{formatMoney(op.volumeBruto)}</span>
                      </div>
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-muted-foreground">Líquido na Conta:</span>
                        <span className="font-semibold text-emerald-600">{formatMoney(op.volumeLiquido)}</span>
                      </div>
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-muted-foreground">Taxas Descontadas:</span>
                        <span className="font-semibold text-rose-500">{formatMoney(op.totalTaxas)}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Taxa Média Efetiva:</span>
                      <span className="font-bold text-emerald-600 text-sm">
                        {op.taxaMediaPercentual.toFixed(2)}%
                      </span>
                    </div>

                    <Progress value={percTotal} className="h-1.5 bg-muted" />
                    <span className="text-[10px] text-muted-foreground block text-right">
                      {percTotal.toFixed(0)}% do volume em cartão
                    </span>
                  </div>
                );
              })()}

              {/* PagBank */}
              {(() => {
                const op = mapaOperadoras.pagbank;
                const percTotal = totalBrutoGeral > 0 ? (op.volumeBruto / totalBrutoGeral) * 100 : 0;
                return (
                  <div className="rounded-xl border border-amber-500/30 bg-card p-4 space-y-3 shadow-xs relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#00A868]" />
                        <span className="font-bold text-sm text-foreground">PagBank</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-bold border-amber-500/40 text-amber-700 dark:text-amber-400">
                        {op.qtdTransacoes} venda(s)
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted-foreground">Volume Bruto:</span>
                        <span className="font-bold text-sm text-foreground">{formatMoney(op.volumeBruto)}</span>
                      </div>
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-muted-foreground">Líquido na Conta:</span>
                        <span className="font-semibold text-emerald-600">{formatMoney(op.volumeLiquido)}</span>
                      </div>
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-muted-foreground">Taxas Descontadas:</span>
                        <span className="font-semibold text-rose-500">{formatMoney(op.totalTaxas)}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Taxa Média Efetiva:</span>
                      <span className="font-bold text-amber-600 text-sm">
                        {op.taxaMediaPercentual.toFixed(2)}%
                      </span>
                    </div>

                    <Progress value={percTotal} className="h-1.5 bg-muted" />
                    <span className="text-[10px] text-muted-foreground block text-right">
                      {percTotal.toFixed(0)}% do volume em cartão
                    </span>
                  </div>
                );
              })()}

              {/* Outras / Tradicionais */}
              {(() => {
                const op = mapaOperadoras.outras;
                const percTotal = totalBrutoGeral > 0 ? (op.volumeBruto / totalBrutoGeral) * 100 : 0;
                return (
                  <div className="rounded-xl border border-indigo-500/30 bg-card p-4 space-y-3 shadow-xs relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                        <span className="font-bold text-sm text-foreground">Outras Adquirentes</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-bold border-indigo-500/40 text-indigo-700 dark:text-indigo-400">
                        {op.qtdTransacoes} venda(s)
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted-foreground">Volume Bruto:</span>
                        <span className="font-bold text-sm text-foreground">{formatMoney(op.volumeBruto)}</span>
                      </div>
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-muted-foreground">Líquido na Conta:</span>
                        <span className="font-semibold text-emerald-600">{formatMoney(op.volumeLiquido)}</span>
                      </div>
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-muted-foreground">Taxas Descontadas:</span>
                        <span className="font-semibold text-rose-500">{formatMoney(op.totalTaxas)}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Taxa Média Efetiva:</span>
                      <span className="font-bold text-indigo-600 text-sm">
                        {op.taxaMediaPercentual.toFixed(2)}%
                      </span>
                    </div>

                    <Progress value={percTotal} className="h-1.5 bg-muted" />
                    <span className="text-[10px] text-muted-foreground block text-right">
                      {percTotal.toFixed(0)}% do volume em cartão
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Dica de Negociação / Poder de Barganha */}
          <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
              <Zap className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Poder de Negociação:</strong> Com um volume transacionado de <strong>{formatMoney(totalBrutoGeral)}</strong> no mês, você tem margem para solicitar taxas de antecipação reduzidas diretamente com seu gerente InfinitePay ou PagBank.
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMostrarTransacoes(!mostrarTransacoes)}
              className="h-7 text-xs border-emerald-500/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/10 shrink-0 self-start sm:self-auto"
            >
              <Receipt className="h-3 w-3 mr-1" />
              {mostrarTransacoes ? 'Ocultar Lançamentos' : 'Ver Lançamentos do Cartão'}
            </Button>
          </div>

          {/* Listagem detalhada das transações de cartão com conciliação */}
          {mostrarTransacoes && (
            <div className="space-y-2 pt-2 border-t">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Extrato Conciliado de Cartão ({transacoesProcessadas.length} transações)
              </span>

              <div className="border rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/70 text-muted-foreground border-b font-semibold">
                      <tr>
                        <th className="p-2.5">Data</th>
                        <th className="p-2.5">Paciente / Descrição</th>
                        <th className="p-2.5">Maquininha</th>
                        <th className="p-2.5">Modalidade</th>
                        <th className="p-2.5 text-right">Valor Cobrado</th>
                        <th className="p-2.5 text-right">Taxa (R$ / %)</th>
                        <th className="p-2.5 text-right font-bold text-emerald-600">Líquido na Conta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {transacoesProcessadas.map((t) => (
                        <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-2.5 text-muted-foreground whitespace-nowrap">
                            {new Date(t.data).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="p-2.5 font-medium max-w-[200px] truncate">
                            <span className="block text-foreground">{t.pacienteNome || 'Cliente'}</span>
                            <span className="text-[10px] text-muted-foreground truncate block">{t.descricao}</span>
                          </td>
                          <td className="p-2.5 whitespace-nowrap">
                            <Badge variant="outline" className="text-[10px] py-0 font-medium">
                              {t.operadoraIdentificada}
                            </Badge>
                          </td>
                          <td className="p-2.5 text-muted-foreground whitespace-nowrap">
                            {t.modalidade}
                          </td>
                          <td className="p-2.5 text-right font-bold text-foreground whitespace-nowrap">
                            {formatMoney(t.bruto)}
                          </td>
                          <td className="p-2.5 text-right text-rose-500 whitespace-nowrap">
                            {t.taxaValor > 0 ? (
                              <span>
                                -{formatMoney(t.taxaValor)}{' '}
                                <span className="text-[10px] text-muted-foreground">
                                  ({t.taxaPerc.toFixed(1)}%)
                                </span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-[10px]">—</span>
                            )}
                          </td>
                          <td className="p-2.5 text-right font-bold text-emerald-600 whitespace-nowrap">
                            {formatMoney(t.liquido)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};
