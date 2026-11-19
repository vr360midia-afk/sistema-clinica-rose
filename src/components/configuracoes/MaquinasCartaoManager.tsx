import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  Plus,
  Trash2,
  Star,
  Settings2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useMaquinasCartao, calcularTaxaCartao } from '@/hooks/useMaquinasCartao';
import { OperadoraCartao } from '@/types/maquinasCartao';
import { formatMoney } from '@/utils/exportCsv';

// Modelos pré-configurados para agilizar o cadastro de novas máquinas
const MODELOS_SUGERIDOS = [
  { nome: 'Stone', cor: '#00A868', debito: 1.25, credito1x: 2.99, baseParc: 4.90, desc: 'Taxas médias Stone / Ton PRO' },
  { nome: 'Cielo', cor: '#00AEEF', debito: 1.99, credito1x: 3.49, baseParc: 5.50, desc: 'Taxas Cielo / Lio padrão' },
  { nome: 'Rede', cor: '#FF5000', debito: 1.49, credito1x: 3.19, baseParc: 5.20, desc: 'Rede Itaú credenciada' },
  { nome: 'Mercado Pago', cor: '#009EE3', debito: 1.99, credito1x: 3.98, baseParc: 5.90, desc: 'Point Pro / Smart Mercado Pago' },
  { nome: 'Ton', cor: '#00C853', debito: 1.39, credito1x: 3.15, baseParc: 5.30, desc: 'Plano Black Ton' },
  { nome: 'SafraPay', cor: '#C69214', debito: 1.30, credito1x: 2.90, baseParc: 4.80, desc: 'SafraPay taxas negociadas' },
  { nome: 'Personalizada', cor: '#6366F1', debito: 1.50, credito1x: 3.20, baseParc: 5.00, desc: 'Configure nome e taxas livremente' },
];

export const MaquinasCartaoManager: React.FC = () => {
  const {
    config,
    operadoras,
    salvarConfig,
    atualizarTaxasOperadora,
    adicionarOperadora,
    removerOperadora,
    restaurarPadrao,
    salvando,
  } = useMaquinasCartao();

  const [activeOperadoraId, setActiveOperadoraId] = useState<string>(() => {
    return config.operadoraPadraoId || operadoras[0]?.id || 'infinitepay';
  });

  const [simuladorValor, setSimuladorValor] = useState<number>(1000);
  const [simuladorParcelas, setSimuladorParcelas] = useState<number>(10);

  // Estados do Modal "Adicionar Nova Máquina"
  const [modalNovaMaquinaOpen, setModalNovaMaquinaOpen] = useState(false);
  const [novaNome, setNovaNome] = useState('');
  const [novaCor, setNovaCor] = useState('#00A868');
  const [novaDebito, setNovaDebito] = useState('1.40');
  const [novaCredito1x, setNovaCredito1x] = useState('3.10');
  const [novaTaxaFixa, setNovaTaxaFixa] = useState('0');
  const [novaObservacoes, setNovaObservacoes] = useState('');

  // Taxas parceladas padrão do formulário (2x a 18x)
  const [novaParcelado, setNovaParcelado] = useState<Record<number, number>>({
    2: 5.39,
    3: 6.44,
    4: 7.48,
    5: 8.52,
    6: 9.55,
    7: 10.57,
    8: 11.59,
    9: 12.60,
    10: 13.60,
    11: 14.59,
    12: 15.58,
    18: 19.90,
  });

  // Estado para exclusão de máquina
  const [maquinaParaExcluir, setMaquinaParaExcluir] = useState<OperadoraCartao | null>(null);

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

  const handleAplicarModelo = (mod: typeof MODELOS_SUGERIDOS[0]) => {
    setNovaNome(mod.nome === 'Personalizada' ? '' : mod.nome);
    setNovaCor(mod.cor);
    setNovaDebito(String(mod.debito));
    setNovaCredito1x(String(mod.credito1x));
    setNovaObservacoes(mod.desc);

    // Gera curva estimada de parcelas com base na taxa de 2x
    const parcelasGeradas: Record<number, number> = {};
    parcelasChaves.forEach((n, idx) => {
      parcelasGeradas[n] = Number((mod.baseParc + idx * 1.05).toFixed(2));
    });
    setNovaParcelado(parcelasGeradas);
  };

  const handleCriarNovaMaquina = async () => {
    const nomeLimpo = novaNome.trim();
    if (!nomeLimpo) {
      toast.error('Informe o nome da nova máquina de cartão.');
      return;
    }

    const idGerado = nomeLimpo
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_');

    const novaOperadora: OperadoraCartao = {
      id: idGerado,
      nome: nomeLimpo,
      ativa: true,
      cor: novaCor || '#00A868',
      isCustom: true,
      taxas: {
        debito: parseFloat(novaDebito) || 0,
        creditoAVista: parseFloat(novaCredito1x) || 0,
        taxaFixaTransacao: parseFloat(novaTaxaFixa) || 0,
        parcelado: novaParcelado,
      },
      observacoes: novaObservacoes.trim() || `Taxas da máquina ${nomeLimpo}`,
    };

    const sucesso = await adicionarOperadora(novaOperadora);
    if (sucesso) {
      setActiveOperadoraId(idGerado);
      setModalNovaMaquinaOpen(false);
      setNovaNome('');
      toast.success(`Máquina "${nomeLimpo}" adicionada com sucesso!`);
    }
  };

  const handleConfirmarExclusao = async () => {
    if (!maquinaParaExcluir) return;
    const nome = maquinaParaExcluir.nome;
    const sucesso = await removerOperadora(maquinaParaExcluir.id);
    if (sucesso) {
      toast.success(`Máquina "${nome}" removida.`);
      if (activeOperadoraId === maquinaParaExcluir.id) {
        setActiveOperadoraId(config.operadoraPadraoId || 'infinitepay');
      }
    }
    setMaquinaParaExcluir(null);
  };

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
            Cadastre as operadoras da clínica (InfinitePay, PagBank, Stone, Cielo, etc.). Ao lançar um orçamento ou transação, as taxas calculadas podem ser preenchidas automaticamente ou personalizadas em valor (R$) e percentual (%).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => setModalNovaMaquinaOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 font-semibold shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova Máquina
          </Button>

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
              toast.success('Taxas de cartão salvas com sucesso!');
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 font-medium"
            disabled={salvando}
          >
            <Save className="h-3.5 w-3.5" />
            Salvar Tudo
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
                Quando ativado, cada venda no cartão gera automaticamente um lançamento de despesa equivalente ao valor descontado da taxa pela maquininha, mantendo o DRE e o caixa líquidos e corretos.
              </p>
            </div>
            <Switch
              checked={config.lancarTaxaComoDespesa}
              onCheckedChange={(checked) => salvarConfig({ lancarTaxaComoDespesa: checked })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Maquininha Padrão nos Orçamentos</Label>
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
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: op.cor || '#10b981' }} />
                        <span>{op.nome}</span>
                        {config.operadoraPadraoId === op.id && (
                          <span className="text-[10px] text-muted-foreground font-normal">(Padrão)</span>
                        )}
                      </div>
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

            <div className="space-y-1.5 flex flex-col justify-end">
              <span className="text-[11px] text-muted-foreground">Total de Máquinas Cadastradas:</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs font-semibold">
                  {operadoras.length} máquinas ({operadoras.filter((o) => o.ativa !== false).length} ativas)
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs das Operadoras (Dinâmicas: InfinitePay, PagBank, Stone, etc.) */}
      <Tabs value={activeOperadoraId} onValueChange={setActiveOperadoraId}>
        <div className="flex items-center justify-between border-b pb-2 gap-2 overflow-x-auto">
          <TabsList className="h-auto p-1 bg-muted flex flex-wrap gap-1">
            {operadoras.map((op) => {
              const isPadrao = config.operadoraPadraoId === op.id;
              return (
                <TabsTrigger
                  key={op.id}
                  value={op.id}
                  className="text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground gap-1.5 px-3 py-1.5"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: op.cor || '#10b981' }}
                  />
                  <span>{op.nome}</span>
                  {isPadrao && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                      Padrão
                    </Badge>
                  )}
                  {op.ativa === false && (
                    <span className="text-[9px] text-muted-foreground">(Inativa)</span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setModalNovaMaquinaOpen(true)}
            className="text-xs font-semibold gap-1 shrink-0 h-8 border-dashed border-emerald-500/50 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar Máquina
          </Button>
        </div>

        {operadoras.map((op) => (
          <TabsContent key={op.id} value={op.id} className="space-y-5 pt-3">
            <Card className="border-border">
              <CardHeader className="pb-3 border-b border-border/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: op.cor || '#00D084' }}
                    />
                    <div>
                      <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                        <span>Tabela de Taxas — {op.nome}</span>
                        {config.operadoraPadraoId === op.id ? (
                          <Badge className="bg-emerald-600 text-white text-[10px] font-medium">
                            Padrão do Sistema
                          </Badge>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              salvarConfig({ operadoraPadraoId: op.id });
                              toast.success(`${op.nome} definida como máquina padrão!`);
                            }}
                            className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground gap-1"
                          >
                            <Star className="h-3 w-3" />
                            Definir como Padrão
                          </Button>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {op.observacoes || 'Taxas cobradas por transação e repasse de parcelas.'}
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`op-ativa-${op.id}`} className="text-xs text-muted-foreground cursor-pointer">
                        {op.ativa !== false ? 'Habilitada' : 'Desabilitada'}
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

                    {/* Botão de Excluir Máquina Personalizada */}
                    {!['infinitepay', 'pagbank'].includes(op.id) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setMaquinaParaExcluir(op)}
                        className="h-8 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 gap-1"
                        title="Remover máquina personalizada"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remover
                      </Button>
                    )}
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
                      <p className="text-[10px] text-muted-foreground">Ex: 1.38%</p>
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
                      <p className="text-[10px] text-muted-foreground">Ex: 3.15%</p>
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
                      <Label className="text-xs text-muted-foreground">Valor Cobrado (Bruto) (R$)</Label>
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
                      <span className="text-[10px] text-muted-foreground block">Valor Descontado da Taxa:</span>
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
                    ℹ️ Ao aprovar um orçamento de <strong>{formatMoney(simuladorValor)}</strong> em <strong>{simuladorParcelas}x</strong> pelo <strong>{op.nome}</strong>, o sistema lançará a receita de {formatMoney(simuladorValor)} e criará automaticamente a despesa de <strong>{simulacao ? formatMoney(simulacao.taxaValor) : 'R$ 0,00'}</strong> na categoria <em>"{config.categoriaDespesaPadrao}"</em>. No lançamento ou orçamento, você também pode digitar diretamente o valor exato da taxa desejada!
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* MODAL ADICIONAR NOVA MÁQUINA DE CARTÃO */}
      <Dialog open={modalNovaMaquinaOpen} onOpenChange={setModalNovaMaquinaOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <CreditCard className="h-5 w-5 text-emerald-600" />
              Adicionar Nova Máquina de Cartão
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cadastre uma nova maquininha com nome, cor e suas taxas padrão.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Modelos rápidos */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                Modelos Sugeridos (Clique para Preencher Rápido):
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {MODELOS_SUGERIDOS.map((mod) => (
                  <Button
                    key={mod.nome}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAplicarModelo(mod)}
                    className="h-7 text-xs px-2.5 gap-1.5 border-border hover:border-emerald-500"
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: mod.cor }} />
                    {mod.nome}
                  </Button>
                ))}
              </div>
            </div>

            {/* Nome e Cor */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold">Nome da Máquina / Operadora *</Label>
                <Input
                  value={novaNome}
                  onChange={(e) => setNovaNome(e.target.value)}
                  placeholder="Ex: Stone, Cielo, Rede, Mercado Pago..."
                  className="h-9 text-xs font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Cor de Identificação</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={novaCor}
                    onChange={(e) => setNovaCor(e.target.value)}
                    className="h-9 w-12 p-1 cursor-pointer"
                  />
                  <Input
                    value={novaCor}
                    onChange={(e) => setNovaCor(e.target.value)}
                    className="h-9 text-xs font-mono"
                    maxLength={7}
                  />
                </div>
              </div>
            </div>

            {/* Taxas Básicas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg border bg-muted/20">
              <div className="space-y-1">
                <Label className="text-xs">Taxa Débito (%)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={novaDebito}
                    onChange={(e) => setNovaDebito(e.target.value)}
                    className="h-8 text-xs font-semibold pr-7"
                  />
                  <span className="absolute right-2 top-2 text-xs text-muted-foreground">%</span>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Crédito 1x (%)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={novaCredito1x}
                    onChange={(e) => setNovaCredito1x(e.target.value)}
                    className="h-8 text-xs font-semibold pr-7"
                  />
                  <span className="absolute right-2 top-2 text-xs text-muted-foreground">%</span>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Custo Fixo (R$)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={novaTaxaFixa}
                    onChange={(e) => setNovaTaxaFixa(e.target.value)}
                    className="h-8 text-xs font-semibold pl-7"
                  />
                  <span className="absolute left-2 top-2 text-xs text-muted-foreground">R$</span>
                </div>
              </div>
            </div>

            {/* Taxas Parceladas 2x a 18x */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Taxas de Parcelamento (2x a 18x no Crédito)</span>
                <span className="text-[10px] text-muted-foreground font-normal">Pode ajustar agora ou depois</span>
              </Label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {parcelasChaves.map((num) => (
                  <div key={num} className="p-1.5 rounded border bg-card text-center space-y-1">
                    <span className="text-[11px] font-bold block">{num}x</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={novaParcelado[num] ?? 0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setNovaParcelado((prev) => ({ ...prev, [num]: val }));
                      }}
                      className="h-7 text-xs text-center p-1 font-semibold"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1">
              <Label className="text-xs">Observações / Detalhes de Repasse (Opcional)</Label>
              <Input
                value={novaObservacoes}
                onChange={(e) => setNovaObservacoes(e.target.value)}
                placeholder="Ex: Recebimento em 1 dia útil, plano Pro, antecipação automática..."
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalNovaMaquinaOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCriarNovaMaquina}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
            >
              <Save className="h-4 w-4" />
              Salvar Máquina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRMAÇÃO DE EXCLUSÃO DE MÁQUINA */}
      <AlertDialog open={!!maquinaParaExcluir} onOpenChange={(open) => !open && setMaquinaParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Excluir Máquina de Cartão?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente remover a máquina <strong>{maquinaParaExcluir?.nome}</strong> das configurações?
              Os lançamentos já existentes no sistema permanecerão inalterados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarExclusao}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
            >
              Sim, Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MaquinasCartaoManager;
