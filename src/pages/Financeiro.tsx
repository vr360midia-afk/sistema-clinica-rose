import React, { useState, useMemo } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, TrendingUp, TrendingDown, Plus, CreditCard, Receipt, 
  Pencil, Trash2, Handshake, Target, CheckCircle2, QrCode, Search, 
  Filter, Clock, Check, AlertCircle, ArrowUpRight, ArrowDownRight, Wallet
} from 'lucide-react';
import TransactionForm from '@/components/financeiro/TransactionForm';
import { ModalReceberPagamento } from '@/components/financeiro/ModalReceberPagamento';
import { registrarAuditoria } from '@/hooks/useAuditLog';
import { useSecurityGate } from '@/context/SecurityContext';
import { useDentalSystem } from '@/context/DentalSystemContext';
import Inadimplencia from '@/components/financeiro/Inadimplencia';
import OrcamentosAbertos from '@/components/financeiro/OrcamentosAbertos';
import { FinanceiroDRE } from '@/components/financeiro/FinanceiroDRE';
import { gerarRecibo } from '@/utils/recibo';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { calcularSaldosOrcamentos } from '@/utils/orcamentoSaldo';
import { toast } from 'sonner';
import { formatMoney } from '@/utils/exportCsv';
import { Transacao } from '@/types/shared';

const Financeiro = () => {
  const { transacoes, pacientes, deleteTransacao, updateTransacao } = useDentalSystem();
  const { requireMasterPassword } = useSecurityGate();
  const { configuracoes } = useConfiguracoes();
  const { orcamentos } = useOrcamentos();

  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingTransacao, setEditingTransacao] = useState<any | null>(null);
  const [showModalReceber, setShowModalReceber] = useState(false);
  const [transacaoParaReceber, setTransacaoParaReceber] = useState<Transacao | null>(null);

  // Filtros
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const dataAtual = new Date();
    return `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
  });

  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'receita' | 'despesa' | 'pix' | 'cartao' | 'pago' | 'pendente'>('todos');
  const [buscaTexto, setBuscaTexto] = useState('');

  const handleMudarParaMesAtual = () => {
    const dataAtual = new Date();
    setSelectedMonth(`${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleDelete = async (id: string) => {
    const autorizado = await requireMasterPassword('O lançamento será movido para a lixeira por 30 dias.');
    if (!autorizado) return;
    try {
      await deleteTransacao(id);
      await registrarAuditoria({ acao: 'excluir', entidade: 'transacao', entidadeId: id, descricao: 'Transação excluída' });
      toast.success('Transação excluída');
    } catch {
      toast.error('Erro ao excluir transação');
    }
  };

  // Filtragem básica por mês
  const filteredTransacoes = useMemo(() => {
    return (transacoes || []).filter(t => {
      if (!t.data) return false;
      const tData = new Date(t.data);
      const tMesAno = `${tData.getFullYear()}-${String(tData.getMonth() + 1).padStart(2, '0')}`;
      return tMesAno === selectedMonth;
    });
  }, [transacoes, selectedMonth]);

  // Totais do Caixa Real (Efetivamente Pagos)
  const receitasPagas = filteredTransacoes.filter(t => t?.status === 'pago' && t?.tipo === 'receita');
  const totalReceived = receitasPagas.reduce((sum, t) => sum + Number(t?.valor || 0), 0);
  
  // Breakdown de Receitas por Método
  const totalPix = receitasPagas.filter(t => t?.metodoPagamento === 'pix' || t?.metodoPagamento === 'pix_parcelado').reduce((s, t) => s + Number(t?.valor || 0), 0);
  const totalCartao = receitasPagas.filter(t => t?.metodoPagamento === 'cartao').reduce((s, t) => s + Number(t?.valor || 0), 0);
  const totalDinheiro = receitasPagas.filter(t => t?.metodoPagamento === 'dinheiro').reduce((s, t) => s + Number(t?.valor || 0), 0);
  const totalOutros = receitasPagas.filter(t => !['pix', 'pix_parcelado', 'cartao', 'dinheiro'].includes(t?.metodoPagamento || '')).reduce((s, t) => s + Number(t?.valor || 0), 0);

  // Pendentes e Despesas
  const totalPending = filteredTransacoes.filter(t => t?.status === 'pendente' && t?.tipo === 'receita').reduce((sum, t) => sum + Number(t?.valor || 0), 0);
  const despesas = filteredTransacoes.filter(t => t?.tipo === 'despesa');
  const totalDespesas = despesas.reduce((sum, t) => sum + Number(t?.valor || 0), 0);
  const totalRepasses = despesas
    .filter(t => t?.parceiroId || t?.parceiroNome || t?.categoria === 'parceria')
    .reduce((sum, t) => sum + Number(t?.valor || 0), 0);
  const saldoLiquido = totalReceived - totalDespesas;

  // Função para verificar se a data pertence ao mês selecionado
  const isNoMes = (data: Date) => {
    if (!data || isNaN(data.getTime())) return false;
    const mesAno = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
    return mesAno === selectedMonth;
  };

  // Vendas (Orçamentos Fechados no Mês Selecionado)
  const orcamentosFechadosNoMes = (orcamentos || []).filter(o => 
    o && o.status?.toLowerCase() === 'aprovado' && isNoMes(new Date(o.atualizadoEm || o.criadoEm))
  );
  const totalFechadoMes = orcamentosFechadosNoMes.reduce((sum, o) => sum + Number(o?.total || 0), 0);

  // Projeção (Orçamentos Abertos no Mês Selecionado)
  const orcamentosPendentes = (orcamentos || []).filter(o => 
    o && o.status?.toLowerCase() !== 'aprovado' && o.status?.toLowerCase() !== 'recusado' && isNoMes(new Date(o.atualizadoEm || o.criadoEm))
  );
  const totalProjecao = orcamentosPendentes.reduce((sum, o) => sum + Number(o?.total || 0), 0);

  // A Receber (Todo o saldo em aberto, independente do mês, mais pendentes do mês)
  const saldosOrcamentos = calcularSaldosOrcamentos(orcamentos, transacoes);
  const totalOrcamentosAberto = (orcamentos || [])
    .filter((o) => o?.status?.toLowerCase() === 'aprovado')
    .reduce((sum, o) => sum + (saldosOrcamentos.get(o.id)?.saldo || 0), 0);
  const totalAReceber = totalPending + totalOrcamentosAberto;

  const getPacienteName = (pacienteId: string) => {
    const paciente = pacientes.find(p => p.id === pacienteId);
    return paciente?.nome || 'Paciente não informado';
  };

  const emitirRecibo = async (transacao: any) => {
    const t = toast.loading('Gerando recibo oficial...');
    const ok = await gerarRecibo(
      {
        numero: String(transacao.id).slice(0, 8).toUpperCase(),
        pacienteNome: transacao.pacienteNome || getPacienteName(transacao.pacienteId),
        descricao: transacao.descricao,
        valor: Number(transacao.valor || 0),
        data: transacao.data,
        metodoPagamento: transacao.metodoPagamento,
        parcelas: transacao.parcelas,
        valorParcela: transacao.valorParcela,
      },
      configuracoes
    );
    toast.dismiss(t);
    if (ok) toast.success('Recibo baixado!');
    else toast.error('Não foi possível gerar o recibo');
  };

  // Filtragem avançada para a tabela de fluxo de caixa
  const transacoesExibicao = useMemo(() => {
    return filteredTransacoes.filter((t) => {
      // Filtro por texto
      if (buscaTexto.trim()) {
        const query = buscaTexto.toLowerCase();
        const pacNome = getPacienteName(t.pacienteId).toLowerCase();
        const desc = (t.descricao || '').toLowerCase();
        const parcNome = (t.parceiroNome || '').toLowerCase();
        const match = pacNome.includes(query) || desc.includes(query) || parcNome.includes(query);
        if (!match) return false;
      }

      // Filtro por categoria/método/status
      if (filtroTipo === 'receita') return t.tipo === 'receita';
      if (filtroTipo === 'despesa') return t.tipo === 'despesa';
      if (filtroTipo === 'pix') return t.metodoPagamento === 'pix' || t.metodoPagamento === 'pix_parcelado';
      if (filtroTipo === 'cartao') return t.metodoPagamento === 'cartao';
      if (filtroTipo === 'pago') return t.status === 'pago';
      if (filtroTipo === 'pendente') return t.status === 'pendente';

      return true;
    }).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [filteredTransacoes, buscaTexto, filtroTipo, pacientes]);

  const renderMetodoIcon = (metodo?: string) => {
    switch (metodo) {
      case 'pix':
      case 'pix_parcelado':
        return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">PIX</Badge>;
      case 'cartao':
        return <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-[10px] font-bold">Cartão</Badge>;
      case 'dinheiro':
        return <Badge className="bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30 text-[10px] font-bold">Dinheiro</Badge>;
      case 'boleto':
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold">Boleto</Badge>;
      case 'transferencia':
        return <Badge className="bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-[10px] font-bold">TED / Transf</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{metodo || 'Outro'}</Badge>;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header Principal */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Wallet className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              Financeiro & Fluxo de Caixa
            </h1>
            <p className="text-sm text-muted-foreground">
              Recebimentos em PIX, caixa do consultório, orçamentos e despesas integrados.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-background border rounded-lg p-1 shadow-sm">
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-8 text-xs border-0 focus-visible:ring-0 w-36"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMudarParaMesAtual}
                className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
              >
                Hoje
              </Button>
            </div>

            <Button
              onClick={() => {
                setTransacaoParaReceber(null);
                setShowModalReceber(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 gap-1.5 shadow-sm"
            >
              <QrCode className="h-4 w-4" />
              Receber c/ PIX (Caixa)
            </Button>

            <Button 
              onClick={() => { 
                setEditingTransacao(null); 
                setShowTransactionForm(true); 
              }} 
              variant="outline"
              className="text-xs h-9 gap-1.5 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Novo Lançamento
            </Button>
          </div>
        </div>

        {/* Cards de Resumo Executivo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* 1. Receita Caixa (Realizado) */}
          <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-teal-500/10 dark:from-emerald-950/20 dark:to-teal-950/20">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                  <ArrowUpRight className="h-4 w-4 text-emerald-600" /> Total Recebido (Caixa)
                </span>
                <span className="p-1.5 rounded-full bg-emerald-500/20 text-emerald-600">
                  <TrendingUp className="h-4 w-4" />
                </span>
              </div>
              <div>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {formatMoney(totalReceived)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {receitasPagas.length} recebimento(s) no mês
                </p>
              </div>
              <div className="pt-2 border-t border-emerald-500/20 flex flex-wrap gap-1.5 text-[10px]">
                {totalPix > 0 && (
                  <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold px-1.5 py-0.5 rounded">
                    PIX: {formatMoney(totalPix)}
                  </span>
                )}
                {totalCartao > 0 && (
                  <span className="bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold px-1.5 py-0.5 rounded">
                    Cartão: {formatMoney(totalCartao)}
                  </span>
                )}
                {totalDinheiro > 0 && (
                  <span className="bg-green-500/15 text-green-700 dark:text-green-300 font-semibold px-1.5 py-0.5 rounded">
                    Dinheiro: {formatMoney(totalDinheiro)}
                  </span>
                )}
                {totalOutros > 0 && (
                  <span className="bg-muted text-muted-foreground font-semibold px-1.5 py-0.5 rounded">
                    Outros: {formatMoney(totalOutros)}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 2. A Receber / Pendente */}
          <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/10 dark:from-amber-950/20 dark:to-orange-950/20">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="h-4 w-4 text-amber-600" /> A Receber (Previsão)
                </span>
                <span className="p-1.5 rounded-full bg-amber-500/20 text-amber-600">
                  <TrendingDown className="h-4 w-4" />
                </span>
              </div>
              <div>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                  {formatMoney(totalAReceber)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {totalOrcamentosAberto > 0 ? `Orçamentos abertos: ${formatMoney(totalOrcamentosAberto)}` : 'Sem pendências críticas'}
                </p>
              </div>
              <div className="pt-2 border-t border-amber-500/20 text-[10px] text-amber-700 dark:text-amber-300">
                Pendentes do mês: {formatMoney(totalPending)}
              </div>
            </CardContent>
          </Card>

          {/* 3. Despesas do Mês */}
          <Card className="border-red-500/30 bg-gradient-to-br from-red-500/5 to-rose-500/10 dark:from-red-950/20 dark:to-rose-950/20">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wider flex items-center gap-1">
                  <ArrowDownRight className="h-4 w-4 text-red-600" /> Despesas & Custos
                </span>
                <span className="p-1.5 rounded-full bg-red-500/20 text-red-600">
                  <Handshake className="h-4 w-4" />
                </span>
              </div>
              <div>
                <p className="text-2xl font-black text-red-600 dark:text-red-400">
                  {formatMoney(totalDespesas)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {despesas.length} saída(s) registradas
                </p>
              </div>
              <div className="pt-2 border-t border-red-500/20 text-[10px] text-red-700 dark:text-red-300">
                Repasses a parceiros: {formatMoney(totalRepasses)}
              </div>
            </CardContent>
          </Card>

          {/* 4. Saldo Líquido do Caixa */}
          <Card className={`border-border ${saldoLiquido >= 0 ? 'bg-background' : 'bg-red-500/5'}`}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <DollarSign className="h-4 w-4 text-primary" /> Saldo Líquido Caixa
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  (Receitas - Despesas)
                </span>
              </div>
              <div>
                <p className={`text-2xl font-black ${saldoLiquido >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatMoney(saldoLiquido)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Vendas aprovadas: <strong className="text-foreground">{formatMoney(totalFechadoMes)}</strong>
                </p>
              </div>
              <div className="pt-2 border-t border-border text-[10px] text-muted-foreground">
                Previsto total com saldo a receber: {formatMoney(saldoLiquido + totalAReceber)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Abas de Navegação */}
        <Tabs defaultValue="fluxo" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto p-1 bg-muted/60">
            <TabsTrigger value="fluxo" className="py-2.5 text-xs font-semibold gap-1.5">
              <Receipt className="h-4 w-4" /> Extrato & Fluxo de Caixa
            </TabsTrigger>
            <TabsTrigger value="orcamentos" className="py-2.5 text-xs font-semibold gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Orçamentos & Parcelas
            </TabsTrigger>
            <TabsTrigger value="cobrancas" className="py-2.5 text-xs font-semibold gap-1.5">
              <Clock className="h-4 w-4" /> Cobrança & Inadimplência
            </TabsTrigger>
            <TabsTrigger value="dre" className="py-2.5 text-xs font-semibold gap-1.5">
              <TrendingUp className="h-4 w-4" /> DRE & Lucratividade
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: EXTRATO & FLUXO DE CAIXA */}
          <TabsContent value="fluxo" className="space-y-4">
            <Card>
              <CardHeader className="p-4 pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      Lançamentos do Mês
                      <Badge variant="secondary" className="text-xs">
                        {transacoesExibicao.length} lançamento(s)
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Histórico detalhado de entradas e saídas no mês de {selectedMonth}.
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative w-full sm:w-60">
                      <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar paciente, descrição..."
                        value={buscaTexto}
                        onChange={(e) => setBuscaTexto(e.target.value)}
                        className="h-8 pl-8 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Filtros Rápidos */}
                <div className="flex flex-wrap items-center gap-1.5 pt-3">
                  <span className="text-[11px] text-muted-foreground mr-1 flex items-center gap-1">
                    <Filter className="h-3 w-3" /> Filtrar:
                  </span>
                  {[
                    { id: 'todos', label: 'Todos' },
                    { id: 'receita', label: 'Receitas (+)' },
                    { id: 'despesa', label: 'Despesas (-)' },
                    { id: 'pix', label: '💎 Só PIX' },
                    { id: 'cartao', label: '💳 Só Cartão' },
                    { id: 'pago', label: '✅ No Caixa (Pago)' },
                    { id: 'pendente', label: '⏳ Pendentes' },
                  ].map((f) => (
                    <Button
                      key={f.id}
                      type="button"
                      variant={filtroTipo === f.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFiltroTipo(f.id as any)}
                      className={`h-7 text-xs px-2.5 rounded-full ${
                        filtroTipo === f.id ? 'font-bold' : 'text-muted-foreground'
                      }`}
                    >
                      {f.label}
                    </Button>
                  ))}
                </div>
              </CardHeader>

              <CardContent className="p-4 pt-0">
                {transacoesExibicao.length === 0 ? (
                  <div className="text-center py-12 border border-dashed rounded-lg space-y-3">
                    <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/60" />
                    <div>
                      <p className="font-medium text-foreground text-sm">Nenhum lançamento encontrado</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {buscaTexto ? 'Tente mudar os termos da busca.' : 'Não há registros para os filtros selecionados neste mês.'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setTransacaoParaReceber(null);
                        setShowModalReceber(true);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
                    >
                      <QrCode className="h-3.5 w-3.5" /> Registrar Recebimento PIX
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {transacoesExibicao.map((transacao) => {
                      const isReceita = transacao.tipo === 'receita';
                      const isPago = transacao.status === 'pago';
                      const pacNome = getPacienteName(transacao.pacienteId);

                      return (
                        <div
                          key={transacao.id}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border transition-all gap-3 ${
                            isPago ? 'bg-card hover:bg-muted/30' : 'bg-amber-500/5 border-amber-500/30'
                          }`}
                        >
                          <div className="flex items-start sm:items-center gap-3 min-w-0">
                            <div
                              className={`p-2 rounded-lg shrink-0 ${
                                isReceita
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-red-500/10 text-red-600 dark:text-red-400'
                              }`}
                            >
                              {isReceita ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                            </div>

                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-foreground truncate">
                                  {!isReceita && transacao.parceiroNome ? transacao.parceiroNome : pacNome}
                                </span>
                                {renderMetodoIcon(transacao.metodoPagamento)}
                                {transacao.orcamentoId && (
                                  <Badge variant="outline" className="text-[10px] text-muted-foreground border-dashed">
                                    Orçamento vinculado
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {transacao.descricao || 'Sem descrição'}
                              </p>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                                <span>{new Date(transacao.data).toLocaleDateString('pt-BR')}</span>
                                {transacao.vencimento && !isPago && (
                                  <span className="text-amber-600 font-medium">
                                    • Venc: {new Date(transacao.vencimento).toLocaleDateString('pt-BR')}
                                  </span>
                                )}
                                {transacao.parcelas && transacao.parcelas > 1 && (
                                  <span>• {transacao.parcelas}x</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0">
                            <div className="text-left sm:text-right space-y-0.5">
                              <p className={`font-bold text-base ${isReceita ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {isReceita ? '+' : '-'} {formatMoney(transacao.valor || 0)}
                              </p>
                              <div>
                                {isPago ? (
                                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px] font-semibold gap-1">
                                    <Check className="h-3 w-3" /> No Caixa
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 text-[10px] font-semibold gap-1">
                                    <Clock className="h-3 w-3" /> Pendente
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              {/* Botão rápido para dar baixa no Caixa se pendente */}
                              {!isPago && isReceita && (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setTransacaoParaReceber(transacao);
                                    setShowModalReceber(true);
                                  }}
                                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 font-semibold"
                                  title="Confirmar recebimento e lançar no caixa"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">Dar Baixa</span>
                                </Button>
                              )}

                              {isReceita && isPago && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs gap-1"
                                  onClick={() => emitirRecibo(transacao)}
                                  title="Baixar recibo oficial"
                                >
                                  <Receipt className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">Recibo</span>
                                </Button>
                              )}

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  setEditingTransacao(transacao);
                                  setShowTransactionForm(true);
                                }}
                                title="Editar transação"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(transacao.id)}
                                title="Excluir transação"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA 2: ORÇAMENTOS & PARCELAS */}
          <TabsContent value="orcamentos" className="space-y-4">
            <OrcamentosAbertos
              onLancarPagamento={(prefill) => {
                setTransacaoParaReceber(null);
                setEditingTransacao(prefill);
                setShowTransactionForm(true);
              }}
            />
          </TabsContent>

          {/* ABA 3: COBRANÇAS & INADIMPLÊNCIA */}
          <TabsContent value="cobrancas" className="space-y-4">
            <Inadimplencia />
          </TabsContent>

          {/* ABA 4: DRE & LUCRATIVIDADE */}
          <TabsContent value="dre" className="space-y-4">
            <FinanceiroDRE selectedMonth={selectedMonth} />
          </TabsContent>
        </Tabs>

        {/* Modal de Nova / Editar Transação Completa */}
        <TransactionForm
          isOpen={showTransactionForm}
          onClose={() => {
            setShowTransactionForm(false);
            setEditingTransacao(null);
          }}
          onSave={() => {
            setShowTransactionForm(false);
            setEditingTransacao(null);
          }}
          transacao={editingTransacao}
        />

        {/* Modal Rápido de Recebimento PIX / Baixa Direta */}
        <ModalReceberPagamento
          isOpen={showModalReceber}
          onClose={() => {
            setShowModalReceber(false);
            setTransacaoParaReceber(null);
          }}
          transacaoPendente={transacaoParaReceber}
        />
      </div>
    </Layout>
  );
};

export default Financeiro;
