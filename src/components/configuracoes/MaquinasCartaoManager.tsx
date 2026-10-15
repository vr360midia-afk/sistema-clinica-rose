import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CreditCard,
  Percent,
  DollarSign,
  Save,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  TrendingDown,
  Calculator,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { useMaquinasCartao, calcularTaxaCartao } from '@/hooks/useMaquinasCartao';
import { OperadoraCartao } from '@/types/maquinasCartao';
import { formatMoney } from '@/utils/exportCsv';

export const MaquinasCartaoManager: React.FC = () => {
  const {
    config,
    operadoras,
    salvarConfig,
    atualizarTaxasOperadora,
    restaurarPadrao,
    salvando,
  } = useMaquinasCartao();

  const [activeOperadoraId, setActiveOperadoraId] = useState<string>('infinitepay');
  const [simuladorValor, setSimuladorValor] = useState<number>(1000);
  const [simuladorParcelas, setSimuladorParcelas] = useState<number>(10);

  const operadoraAtiva =
    operadoras.find((o) => o.id === activeOperadoraId) || operadoras[0];

  // Cálculo da simulação em tempo real
  const simulacao = operadoraAtiva
    ? calcularTaxaCartao(operadoraAtiva, simuladorParcelas, simuladorValor)
    : null;

  const handleUpdateOperadoraCampo = (
    opId: string,
    campo: 'debito' | 'creditoAVista' | 'taxaFixaTransacao',
    valor: number
  ) => {
    const op = operadoras.find((o) => o.id === opId);
    if (!op) return;
    atualizarTaxasOperadora(opId, { [campo]: valor });
  };

  const handleUpdateTaxaParcela = (
    opId: string,
    numParcela: number,
    valorPercentual: number
  ) => {
    const op = operadoras.find((o) => o.id === opId);
    if (!op) return;
    const novasParcelas = {
      ...op.taxas.parcelado,
      [numParcela]: valorPercentual,
    };
    atualizarTaxasOperadora(opId, { parcelado: novasParcelas });
  };

  const parcelasChaves = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18];

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
            <CreditCard className="h-6 w-6 text-emerald-500" />
            Configuração de Taxas das Máquinas de Cartão
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cadastre as taxas do <strong>PagBank</strong> e <strong>InfinitePay</strong>. Ao lançar um orçamento no cartão, as taxas são calculadas automaticamente e inseridas como despesas no fluxo financeiro da clínica.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={restaurarPadrao}
            className="text-xs gap-1.5"
            disabled={salvando}
            title="Redefinir todas as taxas para a tabela padrão de mercado"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar Padrão
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => {
              salvarConfig(config);
              toast.success('Taxas de cartão atualizadas com sucesso!');
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 font-medium"
            disabled={salvando}
          >
            <Save className="h-3.5 w-3.5" />
            Salvar Taxas
          </Button>
        </div>
      </div>

      {/* Opções Gerais de Integração Financeira */}
      <Card className="border-border">
        <CardContent className="pt-5 pb-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 rounded-lg bg-muted/40 border border-border">
            <div className="space-y-0.5">
              <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                <span>Lançar Taxa Automaticamente como Despesa no Financeiro</span>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                  Recomendado
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Quando ativado, cada venda parcelada no cartão gera automaticamente um lançamento de despesa equivalente ao valor descontado pela maquininha, mantendo o DRE e o fluxo de caixa precisos.
              </p>
            </div>
            <Switch
              checked={config.lancarTaxaComoDespesa}
              onCheckedChange={(checked) => salvarConfig({ lancarTaxaComoDespesa: checked })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Maquininha Padrão no Orçamento</Label>
              <Select
                value={config.operadoraPadraoId}
                onValueChange={(val) => salvarConfig({ operadoraPadraoId: val })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {operadoras.map((op) => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.nome} {op.id === 'infinitepay' ? '(InfinitePay)' : '(PagBank)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Categoria da Despesa Financeira</Label>
              <Input
                value={config.categoriaDespesaPadrao || 'Taxas de Cartão'}
                onChange={(e) => salvarConfig({ categoriaDespesaPadrao: e.target.value })}
                placeholder="Ex: Taxas de Cartão, Custos Financeiros..."
                className="h-9 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs das Operadoras (InfinitePay e PagBank) */}
      <Tabs value={activeOperadoraId} onValueChange={setActiveOperadoraId}>
        <TabsList className="grid grid-cols-2 max-w-md h-10 p-1 bg-muted">
          <TabsTrigger value="infinitepay" className="text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00D084] mr-2 inline-block" />
            InfinitePay
          </TabsTrigger>
          <TabsTrigger value="pagbank" className="text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00A868] mr-2 inline-block" />
            PagBank
          </TabsTrigger>
        </TabsList>

        {operadoras.map((op) => (
          <TabsContent key={op.id} value={op.id} className="space-y-5 pt-3">
            <Card className="border-border">
              <CardHeader className="pb-3 border-b border-border/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: op.cor || '#00D084' }}
                    />
                    <div>
                      <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                        <span>Tabela de Taxas — {op.nome}</span>
                        {config.operadoraPadraoId === op.id && (
                          <Badge className="bg-emerald-600 text-white text-[10px] font-medium">
                            Padrão do Sistema
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {op.observacoes || 'Taxas cobradas por transação e repasse de parcelas.'}
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label htmlFor={`op-ativa-${op.id}`} className="text-xs text-muted-foreground cursor-pointer">
                      {op.ativa !== false ? 'Operadora Habilitada' : 'Desabilitada'}
                    </Label>
                    <Switch
                      id={`op-ativa-${op.id}`}
                      checked={op.ativa !== false}
                      onCheckedChange={(checked) => {
                        const novas = operadoras.map((item) =>
                          item.id === op.id ? { ...item, ativa: checked } : item
                        );
                        salvarConfig({ operadoras: novas });
                      }}
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-6">
                {/* Taxas Básicas: Débito e Crédito à Vista */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Percent className="h-3.5 w-3.5 text-primary" />
                    1. Operações à Vista (Débito e Crédito 1x)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-3 rounded-lg border border-border bg-card space-y-1.5">
                      <Label className="text-xs font-medium text-foreground">Taxa Débito (%)</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={op.taxas.debito ?? 0}
                          onChange={(e) =>
                            handleUpdateOperadoraCampo(op.id, 'debito', Number(e.target.value) || 0)
                          }
                          className="h-8 text-xs font-semibold pr-8"
                        />
                        <span className="absolute right-2.5 top-2 text-xs text-muted-foreground">%</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Ex: {op.id === 'infinitepay' ? '1.38%' : '1.99%'}</p>
                    </div>

                    <div className="p-3 rounded-lg border border-border bg-card space-y-1.5">
                      <Label className="text-xs font-medium text-foreground">Crédito à Vista 1x (%)</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={op.taxas.creditoAVista ?? 0}
                          onChange={(e) =>
                            handleUpdateOperadoraCampo(op.id, 'creditoAVista', Number(e.target.value) || 0)
                          }
                          className="h-8 text-xs font-semibold pr-8"
                        />
                        <span className="absolute right-2.5 top-2 text-xs text-muted-foreground">%</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Ex: {op.id === 'infinitepay' ? '3.15%' : '3.19%'}</p>
                    </div>

                    <div className="p-3 rounded-lg border border-border bg-card space-y-1.5">
                      <Label className="text-xs font-medium text-foreground">Taxa Fixa por Transação (R$)</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={op.taxas.taxaFixaTransacao ?? 0}
                          onChange={(e) =>
                            handleUpdateOperadoraCampo(op.id, 'taxaFixaTransacao', Number(e.target.value) || 0)
                          }
                          className="h-8 text-xs font-semibold pl-8"
                        />
                        <span className="absolute left-2.5 top-2 text-xs text-muted-foreground">R$</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Custo fixo por venda (geralmente R$ 0,00)</p>
                    </div>
                  </div>
                </div>

                {/* Tabela de Taxas por Número de Parcelas (2x a 18x) */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-primary" />
                    2. Parcelamento no Cartão de Crédito (Taxa Total Retida pela Operadora)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {parcelasChaves.map((num) => {
                      const taxaAtual = op.taxas.parcelado?.[num] ?? 0;
                      return (
                        <div
                          key={num}
                          className="p-2.5 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors space-y-1"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-foreground">{num}x</span>
                            <span className="text-[10px] text-muted-foreground">Parcelas</span>
                          </div>
                          <div className="relative">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={taxaAtual}
                              onChange={(e) =>
                                handleUpdateTaxaParcela(op.id, num, Number(e.target.value) || 0)
                              }
                              className="h-8 text-xs font-semibold pr-7 text-right"
                            />
                            <span className="absolute right-2 top-2 text-xs text-muted-foreground">%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Simulador Interativo em Tempo Real */}
                <div className="p-4 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                    <Calculator className="h-4 w-4 text-emerald-600" />
                    Simulador em Tempo Real ({op.nome})
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Valor Bruto do Procedimento (R$)</Label>
                      <Input
                        type="number"
                        step="10"
                        min="0"
                        value={simuladorValor}
                        onChange={(e) => setSimuladorValor(Number(e.target.value) || 0)}
                        className="h-8 text-xs font-semibold"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Parcelamento no Cartão</Label>
                      <Select
                        value={String(simuladorParcelas)}
                        onValueChange={(v) => setSimuladorParcelas(Number(v) || 1)}
                      >
                        <SelectTrigger className="h-8 text-xs font-semibold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1x (Crédito à Vista)</SelectItem>
                          {parcelasChaves.map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n}x Parcelado
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1 bg-background/80 p-2 rounded border border-border">
                      <span className="text-[10px] text-muted-foreground block">Taxa Retida (Despesa):</span>
                      <p className="text-sm font-bold text-rose-600 dark:text-rose-400">
                        {simulacao ? `- ${formatMoney(simulacao.taxaValor)}` : 'R$ 0,00'}{' '}
                        <span className="text-xs font-normal">({simulacao?.taxaPercentual.toFixed(2)}%)</span>
                      </p>
                    </div>

                    <div className="space-y-1 bg-background/80 p-2 rounded border border-border">
                      <span className="text-[10px] text-muted-foreground block">Valor Líquido da Clínica:</span>
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {simulacao ? formatMoney(simulacao.valorLiquido) : 'R$ 0,00'}
                      </p>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    ℹ️ Ao aprovar um orçamento de <strong>{formatMoney(simuladorValor)}</strong> em <strong>{simuladorParcelas}x</strong> pelo <strong>{op.nome}</strong>, o sistema lançará a receita de {formatMoney(simuladorValor)} e criará automaticamente a despesa de <strong>{simulacao ? formatMoney(simulacao.taxaValor) : 'R$ 0,00'}</strong> na categoria <em>"{config.categoriaDespesaPadrao}"</em>.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default MaquinasCartaoManager;
