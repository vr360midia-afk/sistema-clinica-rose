import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, TrendingUp, TrendingDown, Plus, CreditCard, Receipt, 
  Pencil, Trash2, Handshake, Target, CheckCircle2, QrCode, Search, 
  Filter, Clock, Check, AlertCircle, ArrowUpRight, ArrowDownRight, Wallet,
  ArrowRightLeft
} from 'lucide-react';
import TransactionForm from '@/components/financeiro/TransactionForm';
import { ModalReceberPagamento } from '@/components/financeiro/ModalReceberPagamento';
import { registrarAuditoria } from '@/hooks/useAuditLog';
import { useSecurityGate } from '@/context/SecurityContext';
import { useDentalSystem } from '@/context/DentalSystemContext';
import Inadimplencia from '@/components/financeiro/Inadimplencia';
import OrcamentosAbertos from '@/components/financeiro/OrcamentosAbertos';
import { FinanceiroDRE } from '@/components/financeiro/FinanceiroDRE';
import { RaioXMaquininhas } from '@/components/financeiro/RaioXMaquininhas';
import { gerarRecibo, ReciboDados } from '@/utils/recibo';
import { ReciboModal } from '@/components/financeiro/ReciboModal';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { useMaquinasCartao, calcularTaxaCartao } from '@/hooks/useMaquinasCartao';
import { calcularSaldosOrcamentos } from '@/utils/orcamentoSaldo';
import { toast } from 'sonner';
import { formatMoney } from '@/utils/exportCsv';
import { Transacao } from '@/types/shared';

const Financeiro = () => {
  const { transacoes, pacientes, deleteTransacao, updateTransacao, addTransacao } = useDentalSystem();
  const { requireMasterPassword } = useSecurityGate();
  const { configuracoes } = useConfiguracoes();
  const { orcamentos } = useOrcamentos();
  const { operadoras, operadoraPadrao, config: configMaquinas } = useMaquinasCartao();
  const navigate = useNavigate();

  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [tipoInicialTransacao, setTipoInicialTransacao] = useState<'receita' | 'despesa'>('receita');
  const [editingTransacao, setEditingTransacao] = useState<any | null>(null);
  const [showModalReceber, setShowModalReceber] = useState(false);
  const [transacaoParaReceber, setTransacaoParaReceber] = useState<Transacao | null>(null);
  const [reciboModalOpen, setReciboModalOpen] = useState(false);
  const [reciboSelecionado, setReciboSelecionado] = useState<ReciboDados | null>(null);

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

  const handleBaixaImediata = async (transacao: Transacao) => {
    try {
      await updateTransacao(transacao.id, {
        status: 'pago',
        data: new Date(),
      });

      // Se for cartão, lança a taxa da máquina como despesa se configurado
      const isCartao = transacao.metodoPagamento === 'cartao' || (transacao.descricao || '').toLowerCase().includes('cart');
      if (isCartao && configMaquinas?.lancarTaxaComoDespesa !== false) {
        const det = getDetalhesCartao(transacao);
        if (det && det.taxaValor > 0) {
          const catDespesa = configMaquinas?.categoriaDespesaPadrao || 'Taxas de Cartão';
          const opNome = operadoras.find(o => o.id === transacao.operadoraCartao)?.nome || 'Cartão';
          await addTransacao({
            pacienteId: transacao.pacienteId,
            pacienteNome: transacao.pacienteNome,
            valor: Number(det.taxaValor.toFixed(2)),
            tipo: 'despesa',
            status: 'pago',
            metodoPagamento: 'cartao',
            operadoraCartao: transacao.operadoraCartao,
            data: new Date(),
            vencimento: new Date(),
            descricao: `Taxa da Máquina (${opNome}) - ${transacao.descricao}`,
            categoria: catDespesa,
            orcamentoId: transacao.orcamentoId,
          });
        }
      }

      await registrarAuditoria({
        acao: 'editar',
        entidade: 'transacao',
        entidadeId: transacao.id,
        descricao: `Baixa imediata confirmada: ${formatMoney(transacao.valor || 0)} no Caixa`,
      });
      toast.success(`Baixa confirmada! ${formatMoney(transacao.valor || 0)} recebido e lançado no Caixa.`);
    } catch (err) {
      console.error('Erro ao dar baixa imediata:', err);
      toast.error('Erro ao dar baixa imediata na transação');
    }
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

  // Alias seguro para evitar ReferenceError em qualquer contexto de renderização
  const transacoesMes = filteredTransacoes;

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

  // Identifica taxas de cartão lançadas como transação de despesa avulsa
  const taxasLancadasComoDespesa = despesas
    .filter(t => t?.categoria === 'Taxas de Cartão' || (typeof t?.descricao === 'string' && (t.descricao.toLowerCase().includes('taxa da máquina') || t.descricao.toLowerCase().includes('taxa cartão'))))
    .reduce((sum, t) => sum + Number(t?.valor || 0), 0);

  const getDetalhesCartao = (t: any) => {
    const descLower = (t?.descricao || '').toLowerCase();
    const isCartao =
      t?.metodoPagamento === 'cartao' ||
      descLower.includes('cartão') ||
      descLower.includes('cartao') ||
      descLower.includes('crédito') ||
      descLower.includes('debito');

    if (!isCartao || t?.tipo !== 'receita') return null;

    const valorBruto = Number(t?.valor || 0);
    const parcelas = Math.max(1, parseInt(t?.parcelas) || 1);

    let taxaPerc = Number(t?.taxaCartaoPercentual || 0);
    let taxaValor = Number(t?.taxaCartaoValor || 0);
    let valorLiquido = Number(t?.valorLiquido || 0);

    // Se a taxa não foi salva explicitamente no banco, calcula dinamicamente com base nas operadoras cadastradas
    if (taxaValor <= 0 && valorBruto > 0) {
      const calc = calcularTaxaCartao(operadoraPadrao, parcelas, valorBruto, false);
      taxaPerc = calc.taxaPercentual;
      taxaValor = calc.taxaValor;
      valorLiquido = calc.valorLiquido;
    } else if (valorLiquido <= 0) {
      valorLiquido = Math.max(0, Number((valorBruto - taxaValor).toFixed(2)));
    }

    return {
      valorBruto,
      parcelas,
      taxaPerc,
      taxaValor,
      valorLiquido,
    };
  };

  // Identifica taxas de cartão embutidas em receitas pagas que ainda NÃO possuem transação de despesa separada (retrocompatibilidade imediata)
  const taxasEmbutidasSemDespesa = receitasPagas
    .filter(r => !despesas.some(d => 
      (typeof d?.descricao === 'string' && d.descricao.includes(r.descricao || '')) ||
      (r.orcamentoId && d.orcamentoId === r.orcamentoId && (d.categoria === 'Taxas de Cartão' || d.descricao?.toLowerCase().includes('taxa')))
    ))
    .reduce((sum, r) => {
      const det = getDetalhesCartao(r);
      return sum + (det ? det.taxaValor : 0);
    }, 0);

  const totalTaxasCartao = taxasLancadasComoDespesa + taxasEmbutidasSemDespesa;
  const totalDespesas = despesas.reduce((sum, t) => sum + Number(t?.valor || 0), 0) + taxasEmbutidasSemDespesa;
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
  const orcamentosFechadosNoMes = (orcamentos || []).filter(o => {
    if (!o || o.status?.toLowerCase() !== 'aprovado') return false;
    const data = new Date((o as any).dataAssinatura || o.atualizadoEm || o.criadoEm);
    return isNoMes(data);
  });
  const totalFechadoMes = orcamentosFechadosNoMes.reduce((sum, o) => sum + Number(o?.total || 0), 0);

  // Projeção (Orçamentos Abertos no Mês Selecionado)
  const orcamentosPendentes = (orcamentos || []).filter(o => 
    o && o.status?.toLowerCase() !== 'aprovado' && o.status?.toLowerCase() !== 'recusado' && isNoMes(new Date(o.atualizadoEm || o.criadoEm))
  );
  const totalProjecao = orcamentosPendentes.reduce((sum, o) => sum + Number(o?.total || 0), 0);

  // A Receber / Passar Cartão (Saldo em aberto de orçamentos aprovados + pendentes avulsos sem duplicidade)
  const saldosOrcamentos = calcularSaldosOrcamentos(orcamentos, transacoes);
  const totalOrcamentosAberto = (orcamentos || [])
    .filter((o) => o?.status?.toLowerCase() === 'aprovado')
    .reduce((sum, o) => sum + (saldosOrcamentos.get(o.id)?.saldo || 0), 0);

  const idsOrcamentosAprovados = new Set(
    (orcamentos || []).filter(o => o?.status?.toLowerCase() === 'aprovado').map(o => o.id)
  );

  // Transações a receber avulsas que NÃO fazem parte de nenhum orçamento aprovado (evita duplicidade no total a receber)
  const totalPendingAvulso = filteredTransacoes
    .filter(t => t?.status === 'pendente' && t?.tipo === 'receita' && (!t.orcamentoId || !idsOrcamentosAprovados.has(t.orcamentoId)))
    .reduce((sum, t) => sum + Number(t?.valor || 0), 0);

  const totalAReceber = totalOrcamentosAberto + totalPendingAvulso;

  // Total de receitas pendentes com cartão no mês (aguardando passar cartão)
  const receitasPendentesCartao = filteredTransacoes.filter(
    t => t?.status === 'pendente' && t?.tipo === 'receita' && (
      t?.metodoPagamento === 'cartao' || (t?.descricao || '').toLowerCase().includes('cart')
    )
  );
  const totalPendenteCartao = receitasPendentesCartao.reduce((s, t) => s + Number(t?.valor || 0), 0);

  const getPacienteName = (pacienteId: string) => {
    const paciente = pacientes.find(p => p.id === pacienteId);
    return paciente?.nome || 'Paciente não informado';
  };

  const emitirRecibo = (transacao: any) => {
    const paciente = pacientes.find(p => p.id === transacao.pacienteId);
    setReciboSelecionado({
      numero: String(transacao.id).slice(0, 8).toUpperCase(),
      pacienteNome: transacao.pacienteNome || getPacienteName(transacao.pacienteId),
      pacienteCpf: paciente?.cpf || transacao.pacienteCpf || '',
      descricao: transacao.descricao || 'Tratamento odontológico prestado',
      valor: Number(transacao.valor || 0),
      data: transacao.data || new Date(),
      metodoPagamento: transacao.metodoPagamento || 'pix',
      parcelas: transacao.parcelas,
      valorParcela: transacao.valorParcela,
    });
    setReciboModalOpen(true);
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
      <div className="space-y-6 pb-16 lg:pb-6">
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
                setTipoInicialTransacao('despesa');
                setShowTransactionForm(true);
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs h-9 gap-1.5 shadow-sm"
            >
              <TrendingDown className="h-4 w-4" />
              Lançar Despesa
            </Button>

            <Button 
              onClick={() => { 
                setEditingTransacao(null); 
                setTipoInicialTransacao('receita');
                setShowTransactionForm(true); 
              }} 
              variant="outline"
              className="text-xs h-9 gap-1.5 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Nova Receita
            </Button>
          </div>
        </div>

        {/* Cards de Resumo Executivo: Separação Clara entre Vendas (Fechado) e Caixa (Quitado) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* 1. Vendas Fechadas (Comercial / Contratado) */}
          <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-yellow-500/10 dark:from-amber-950/20 dark:to-yellow-950/20">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-amber-600" /> Vendas (Fechado)
                </span>
                <span className="p-1.5 rounded-full bg-amber-500/20 text-amber-600">
                  <TrendingUp className="h-4 w-4" />
                </span>
              </div>
              <div>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                  {formatMoney(totalFechadoMes)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {orcamentosFechadosNoMes.length} orçamento(s) aprovado(s)
                </p>
              </div>
              <div className="pt-2 border-t border-amber-500/20 text-[10px] text-amber-700 dark:text-amber-300 font-medium truncate">
                Total comercial contratado no mês
              </div>
            </CardContent>
          </Card>

          {/* 2. Receita Caixa (Realizado / Efetivamente Quitado) */}
          <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-teal-500/10 dark:from-emerald-950/20 dark:to-teal-950/20">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                  <ArrowUpRight className="h-4 w-4 text-emerald-600" /> Recebido (Caixa)
                </span>
                <span className="p-1.5 rounded-full bg-emerald-500/20 text-emerald-600">
                  <Wallet className="h-4 w-4" />
                </span>
              </div>
              <div>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {formatMoney(totalReceived)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {receitasPagas.length} recebimento(s) quitado(s)
                </p>
              </div>
              <div className="pt-2 border-t border-emerald-500/20 flex flex-wrap gap-1 text-[10px]">
                {totalPix > 0 && (
                  <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold px-1 py-0.5 rounded">
                    PIX: {formatMoney(totalPix)}
                  </span>
                )}
                {totalCartao > 0 && (
                  <span className="bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold px-1 py-0.5 rounded">
                    Cartão: {formatMoney(totalCartao)}
                  </span>
                )}
                {totalDinheiro > 0 && (
                  <span className="bg-green-500/15 text-green-700 dark:text-green-300 font-semibold px-1 py-0.5 rounded">
                    Dinheiro: {formatMoney(totalDinheiro)}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 3. A Receber / Passar Cartão */}
          <Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-amber-500/10 dark:from-orange-950/20 dark:to-amber-950/20">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="h-4 w-4 text-orange-600" /> A Receber / Cartão
                </span>
                <span className="p-1.5 rounded-full bg-orange-500/20 text-orange-600">
                  <TrendingDown className="h-4 w-4" />
                </span>
              </div>
              <div>
                <p className="text-2xl font-black text-orange-600 dark:text-orange-400">
                  {formatMoney(totalAReceber)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {totalPendenteCartao > 0 ? `Passar cartão: ${formatMoney(totalPendenteCartao)}` : 'Aguardando quitação'}
                </p>
              </div>
              <div className="pt-2 border-t border-orange-500/20 text-[10px] text-orange-700 dark:text-orange-300 truncate">
                {totalOrcamentosAberto > 0 ? `Orçamentos abertos: ${formatMoney(totalOrcamentosAberto)}` : 'Sem pendências críticas'}
              </div>
            </CardContent>
          </Card>

          {/* 4. Despesas do Mês */}
          <Card className="border-red-500/30 bg-gradient-to-br from-red-500/5 to-rose-500/10 dark:from-red-950/20 dark:to-rose-950/20">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wider flex items-center gap-1">
                  <ArrowDownRight className="h-4 w-4 text-red-600" /> Despesas Pagas
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingTransacao(null);
                    setTipoInicialTransacao('despesa');
                    setShowTransactionForm(true);
                  }}
                  className="h-6 text-[10px] text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-500/10 gap-1 px-1.5 font-medium"
                >
                  <Plus className="h-3 w-3" /> Despesa
                </Button>
              </div>
              <div>
                <p className="text-2xl font-black text-red-600 dark:text-red-400">
                  {formatMoney(totalDespesas)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {despesas.length + (taxasEmbutidasSemDespesa > 0 ? 1 : 0)} saída(s) e custo(s)
                </p>
              </div>
              <div className="pt-2 border-t border-red-500/20 flex flex-wrap items-center justify-between gap-1 text-[10px] text-red-700 dark:text-red-300">
                <span>Repasses: {formatMoney(totalRepasses)}</span>
                {totalTaxasCartao > 0 && (
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    Taxas: {formatMoney(totalTaxasCartao)}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 5. Saldo Líquido do Caixa */}
          <Card className={`border-border ${saldoLiquido >= 0 ? 'bg-background' : 'bg-red-500/5'}`}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <DollarSign className="h-4 w-4 text-primary" /> Saldo Líquido Caixa
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  (Caixa - Despesas)
                </span>
              </div>
              <div>
                <p className={`text-2xl font-black ${saldoLiquido >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatMoney(saldoLiquido)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Disponível real em caixa
                </p>
              </div>
              <div className="pt-2 border-t border-border text-[10px] text-muted-foreground truncate">
                Projetado com a receber: {formatMoney(saldoLiquido + totalAReceber)}
              </div>
            </CardContent>
          </Card>
        </div>
 
        {/* Raio-X & Conciliação de Maquininhas de Cartão (InfinitePay vs PagBank vs Outras) */}
        <RaioXMaquininhas
          transacoesMes={filteredTransacoes}
          onOpenConfig={() => navigate('/configuracoes?tab=maquinas')}
        />

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
                    { id: 'pago', label: '✅ No Caixa (Quitado)' },
                    { id: 'pendente', label: '⏳ A Receber / Cartão' },
                    { id: 'receita', label: 'Receitas (+)' },
                    { id: 'despesa', label: 'Despesas (-)' },
                    { id: 'pix', label: '💎 Só PIX' },
                    { id: 'cartao', label: '💳 Só Cartão' },
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
                    <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditingTransacao(null);
                          setTipoInicialTransacao('despesa');
                          setShowTransactionForm(true);
                        }}
                        className="bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5"
                      >
                        <TrendingDown className="h-3.5 w-3.5" /> Lançar Despesa
                      </Button>
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
                  </div>
                ) : (
                  <div className="space-y-2">
                    {transacoesExibicao.map((transacao) => {
                      const isReceita = transacao.tipo === 'receita';
                      const isPago = transacao.status === 'pago';
                      const pacNome = transacao.pacienteId ? getPacienteName(transacao.pacienteId) : '';
                      const detalhesCartao = getDetalhesCartao(transacao);

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
                                  {!isReceita
                                    ? (transacao.parceiroNome || pacNome || transacao.descricao || 'Despesa')
                                    : (pacNome || transacao.descricao || 'Receita')}
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
                            {detalhesCartao && isReceita ? (
                              <div className="text-left sm:text-right space-y-1">
                                <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                                  {/* Valor Cobrado */}
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/60">
                                    <span className="text-[11px] font-normal text-muted-foreground">Cobrado:</span>
                                    <span className="font-semibold text-foreground/90">{formatMoney(detalhesCartao.valorBruto)}</span>
                                  </div>

                                  <span className="text-muted-foreground/60 text-xs font-bold">➔</span>

                                  {/* Saldo Líquido Descontando as Taxas */}
                                  <div className="flex items-center gap-1 bg-emerald-500/10 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded border border-emerald-500/30">
                                    <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Líquido:</span>
                                    <span className="font-black text-sm sm:text-base text-emerald-600 dark:text-emerald-400">
                                      +{formatMoney(detalhesCartao.valorLiquido)}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 sm:justify-end text-[11px] text-muted-foreground">
                                  <span className="text-rose-600 dark:text-rose-400 font-medium">
                                    Taxa máq: -{formatMoney(detalhesCartao.taxaValor)} ({detalhesCartao.taxaPerc}%)
                                  </span>
                                  <span>•</span>
                                  {isPago ? (
                                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px] font-semibold gap-1 py-0 px-1.5">
                                      <Check className="h-3 w-3" /> No Caixa (Pago)
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 text-[10px] font-semibold gap-1 py-0 px-1.5">
                                      <Clock className="h-3 w-3" /> Passar Cartão
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="text-left sm:text-right space-y-0.5">
                                <p className={`font-bold text-base ${isReceita ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {isReceita ? '+' : '-'} {formatMoney(transacao.valor || 0)}
                                </p>
                                <div>
                                  {isPago ? (
                                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px] font-semibold gap-1">
                                      <Check className="h-3 w-3" /> No Caixa (Pago)
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 text-[10px] font-semibold gap-1">
                                      <Clock className="h-3 w-3" /> A Receber
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-1">
                              {/* Ações para transação pendente: Baixa Imediata no Caixa ou Baixa Personalizada/Mista */}
                              {!isPago && isReceita && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    onClick={() => handleBaixaImediata(transacao)}
                                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 font-semibold shadow-xs"
                                    title="Confirmar recebimento no Caixa agora (1 clique)"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span>Dar Baixa</span>
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setTransacaoParaReceber(transacao);
                                      setShowModalReceber(true);
                                    }}
                                    className="h-8 text-xs gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 px-2 font-medium"
                                    title="Dividir em Misto (PIX + Cartão), alterar forma de pagamento ou abater orçamento"
                                  >
                                    <ArrowRightLeft className="h-3.5 w-3.5" />
                                    <span className="hidden xl:inline">Misto / Alterar</span>
                                  </Button>
                                </div>
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
          tipoInicial={tipoInicialTransacao}
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

        {/* Modal Oficial de Emissão de Recibo Premium */}
        {reciboSelecionado && (
          <ReciboModal
            isOpen={reciboModalOpen}
            onClose={() => {
              setReciboModalOpen(false);
              setReciboSelecionado(null);
            }}
            dados={reciboSelecionado}
            clinica={configuracoes}
          />
        )}
      </div>
    </Layout>
  );
};

export default Financeiro;
