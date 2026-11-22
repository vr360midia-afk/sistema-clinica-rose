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
  ArrowRightLeft, ChevronRight, ChevronLeft, Calendar, FileSpreadsheet, FileText, Building2, LayoutGrid, Eye
} from 'lucide-react';
import TransactionForm from '@/components/financeiro/TransactionForm';
import { ModalReceberPagamento } from '@/components/financeiro/ModalReceberPagamento';
import { ModalResumoVendasFechadas } from '@/components/financeiro/ModalResumoVendasFechadas';
import { ModalRelatorioFechamento } from '@/components/financeiro/ModalRelatorioFechamento';
import { ModalContasBancarias } from '@/components/financeiro/ModalContasBancarias';
import { useContasBancarias } from '@/hooks/useContasBancarias';
import ModalApresentarOrcamento from '@/components/orcamentos/ModalApresentarOrcamento';
import { registrarAuditoria } from '@/hooks/useAuditLog';
import { useSecurityGate } from '@/context/SecurityContext';
import { useDentalSystem } from '@/context/DentalSystemContext';
import Inadimplencia from '@/components/financeiro/Inadimplencia';
import { TratamentosEmPagamento } from '@/components/financeiro/TratamentosEmPagamento';
import OrcamentosAbertos from '@/components/financeiro/OrcamentosAbertos';
import { FinanceiroDRE } from '@/components/financeiro/FinanceiroDRE';
import { RaioXMaquininhas } from '@/components/financeiro/RaioXMaquininhas';
import { gerarRecibo, ReciboDados } from '@/utils/recibo';
import { ReciboModal } from '@/components/financeiro/ReciboModal';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { useMaquinasCartao, calcularTaxaCartao } from '@/hooks/useMaquinasCartao';
import { calcularSaldosOrcamentos } from '@/utils/orcamentoSaldo';
import { 
  calcularResumoFinanceiroMes, 
  isDataNoMesString, 
  isDataNoMesAno,
  ehTransacaoPaga, 
  ehTransacaoPendente 
} from '@/utils/financeiroCalculos';
import { toast } from 'sonner';
import { formatMoney } from '@/utils/exportCsv';
import { Transacao } from '@/types/shared';

const Financeiro = () => {
  const { transacoes, pacientes, deleteTransacao, updateTransacao, addTransacao, reloadTransacoes } = useDentalSystem();
  const { requireMasterPassword } = useSecurityGate();
  const { configuracoes } = useConfiguracoes();
  const { orcamentos, reload: reloadOrcamentos } = useOrcamentos();
  const { operadoras, operadoraPadrao, config: configMaquinas } = useMaquinasCartao();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'fluxo' | 'orcamentos' | 'cobrancas' | 'dre'>('fluxo');
  const [modalVendasFechadasOpen, setModalVendasFechadasOpen] = useState(false);
  const [modalVendasFechadasTab, setModalVendasFechadasTab] = useState<'parcelas_mes' | 'contratos_fechados'>('parcelas_mes');
  const [apresentarOrcamento, setApresentarOrcamento] = useState<any | null>(null);
  const [modalRelatorioOpen, setModalRelatorioOpen] = useState(false);

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

  const inputMonthRef = React.useRef<HTMLInputElement>(null);

  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'receita' | 'despesa' | 'pix' | 'cartao' | 'pago' | 'pendente'>('todos');
  const [buscaTexto, setBuscaTexto] = useState('');
  const {
    contas,
    contasAtivas,
    getContaById,
    calcularSaldosContas,
    calcularSaldoProgressivoTransacoes,
    obterContaIdParaTransacao,
  } = useContasBancarias();
  const [modalContasOpen, setModalContasOpen] = useState(false);
  const [contaParaAbrirExtrato, setContaParaAbrirExtrato] = useState<string | null>(null);
  const [filtroConta, setFiltroConta] = useState<string>('todas');
  const [modoVisualizacaoExtrato, setModoVisualizacaoExtrato] = useState<'cards' | 'tabela'>('cards');

  const handleMudarParaMesAtual = () => {
    const dataAtual = new Date();
    setSelectedMonth(`${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleMesAnterior = () => {
    const [anoStr, mesStr] = (selectedMonth || '').split('-');
    let ano = Number(anoStr) || new Date().getFullYear();
    let mes = (Number(mesStr) || (new Date().getMonth() + 1)) - 1;
    if (mes < 1) {
      mes = 12;
      ano -= 1;
    }
    setSelectedMonth(`${ano}-${String(mes).padStart(2, '0')}`);
  };

  const handleProximoMes = () => {
    const [anoStr, mesStr] = (selectedMonth || '').split('-');
    let ano = Number(anoStr) || new Date().getFullYear();
    let mes = (Number(mesStr) || (new Date().getMonth() + 1)) + 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
    setSelectedMonth(`${ano}-${String(mes).padStart(2, '0')}`);
  };

  const handleAbrirPicker = () => {
    const el = inputMonthRef.current as any;
    if (el) {
      if (typeof el.showPicker === 'function') {
        try {
          el.showPicker();
          return;
        } catch {
          // fallback to focus
        }
      }
      el.focus?.();
    }
  };

  const mesFormatadoExtenso = useMemo(() => {
    try {
      const [ano, mes] = (selectedMonth || '').split('-');
      if (!ano || !mes) return selectedMonth;
      const data = new Date(Number(ano), Number(mes) - 1, 1);
      const str = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      return str.charAt(0).toUpperCase() + str.slice(1);
    } catch {
      return selectedMonth;
    }
  }, [selectedMonth]);

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

  // Filtragem básica por mês (imune a desvios de fuso horário)
  const filteredTransacoes = useMemo(() => {
    return (transacoes || []).filter(t => {
      const dataRef = t?.data || t?.dataPagamento || t?.vencimento;
      if (!dataRef) return false;
      return isDataNoMesString(dataRef, selectedMonth);
    });
  }, [transacoes, selectedMonth]);

  // Alias seguro para evitar ReferenceError em qualquer contexto de renderização
  const transacoesMes = filteredTransacoes;

  // Saldos por Conta Bancária no Mês
  const saldosContasMes = useMemo(() => {
    return calcularSaldosContas(filteredTransacoes);
  }, [calcularSaldosContas, filteredTransacoes]);

  // Mapa de Saldo Progressivo (Running Balance): cada receita soma (+) e cada despesa desconta (-)
  const mapaSaldoProgressivo = useMemo(() => {
    return calcularSaldoProgressivoTransacoes(transacoes || []);
  }, [calcularSaldoProgressivoTransacoes, transacoes]);

  // Extração do ano e mês 0-indexed a partir de selectedMonth ("YYYY-MM")
  const { selectedAno, selectedMes0 } = useMemo(() => {
    const match = (selectedMonth || '').match(/^(\d{4})-(\d{2})/);
    if (match) {
      return { selectedAno: Number(match[1]), selectedMes0: Number(match[2]) - 1 };
    }
    const d = new Date();
    return { selectedAno: d.getFullYear(), selectedMes0: d.getMonth() };
  }, [selectedMonth]);

  // Motor Central Unificado de Cálculos Financeiros
  const resumoFinanceiro = useMemo(() => {
    return calcularResumoFinanceiroMes({
      transacoes,
      orcamentos,
      ano: selectedAno,
      mes0Indexed: selectedMes0,
    });
  }, [transacoes, orcamentos, selectedAno, selectedMes0]);

  // Totais do Caixa Real (Efetivamente Quitados / Pagos)
  const receitasPagas = useMemo(() => {
    return filteredTransacoes.filter(t => t?.tipo === 'receita' && ehTransacaoPaga(t));
  }, [filteredTransacoes]);

  const totalReceived = resumoFinanceiro.receitaCaixa;
  const totalPix = resumoFinanceiro.receitaPix;
  const totalCartao = resumoFinanceiro.receitaCartao;
  const totalDinheiro = resumoFinanceiro.receitaDinheiro;
  const totalOutros = resumoFinanceiro.receitaOutros;

  // Despesas Pagas no Caixa vs Pendentes
  const despesas = filteredTransacoes.filter(t => t?.tipo === 'despesa');
  const despesasPagas = filteredTransacoes.filter(t => t?.tipo === 'despesa' && ehTransacaoPaga(t));
  const despesasPendentes = resumoFinanceiro.despesasPendentes;
  const totalDespesas = resumoFinanceiro.despesasPagas;
  const totalTaxasCartao = resumoFinanceiro.totalTaxasCartao;
  const saldoLiquido = resumoFinanceiro.financeiroLiquido;

  const totalRepasses = despesasPagas
    .filter(t => t?.parceiroId || t?.parceiroNome || t?.categoria === 'parceria')
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

  // Vendas Comerciais (Orçamentos Fechados/Aprovados no Mês Selecionado)
  const orcamentosFechadosNoMes = useMemo(() => {
    return (orcamentos || []).filter(o => {
      if (!o || String(o.status || '').toLowerCase() !== 'aprovado') return false;
      const snap = (o as any).assinatura_paciente || (o as any).assinaturaPaciente || {};
      if (
        (o as any).statusFinanceiro === 'cancelado' ||
        (o as any).statusFinanceiro === 'arquivado' ||
        snap.statusFinanceiro === 'cancelado' ||
        snap.statusFinanceiro === 'arquivado'
      ) {
        return false;
      }
      const dataRef =
        (o as any).dataAssinatura ||
        (o as any).data_assinatura ||
        o.aprovadoEm ||
        (o as any).aprovado_em ||
        snap.aprovadoEm ||
        o.criadoEm ||
        (o as any).criado_em ||
        (o as any).created_at;
      return isDataNoMesAno(dataRef, selectedAno, selectedMes0);
    });
  }, [orcamentos, selectedAno, selectedMes0]);
  const totalFechadoMes = resumoFinanceiro.vendasFechadas;

  // Projeção (Orçamentos em Aberto criados/atualizados no Mês Selecionado)
  const orcamentosPendentes = (orcamentos || []).filter(o => 
    o && String(o.status || '').toLowerCase() !== 'aprovado' && String(o.status || '').toLowerCase() !== 'recusado' && isDataNoMesString(o.atualizadoEm || o.criadoEm, selectedMonth)
  );
  const totalProjecao = orcamentosPendentes.reduce((sum, o) => sum + Number(o?.total || 0), 0);

  // A Receber / Saldos em Aberto (Orçamentos aprovados + pendências avulsas sem duplicidade)
  const totalOrcamentosAberto = resumoFinanceiro.totalOrcamentosAberto;
  const totalAReceber = resumoFinanceiro.totalAReceber;
  const totalPendenteCartao = resumoFinanceiro.totalPendenteCartao;

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

  const handleGerarRecibo = (transacao: any) => {
    emitirRecibo(transacao);
  };

  const handleEdit = (transacao: any) => {
    setEditingTransacao(transacao);
    setShowTransactionForm(true);
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
      if (filtroTipo === 'pago') return ehTransacaoPaga(t);
      if (filtroTipo === 'pendente') return ehTransacaoPendente(t);

      // Filtro por Conta Bancária
      if (filtroConta !== 'todas') {
        const cId = t.contaBancaria || (
          t.tipo === 'despesa' ? 'itau' :
          (t.metodoPagamento === 'pix' || t.metodoPagamento === 'pix_parcelado') ? 'inter' :
          t.metodoPagamento === 'cartao' ? 'infinitepay' :
          t.metodoPagamento === 'dinheiro' ? 'caixa_fisico' : 'inter'
        );
        if (cId !== filtroConta) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [filteredTransacoes, buscaTexto, filtroTipo, filtroConta, pacientes]);

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
            {/* Seletor de Mês Inteligente com Navegação por Setas e Calendário Nativo */}
            <div className="flex items-center gap-1 bg-background border rounded-lg p-1 shadow-sm">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleMesAnterior}
                className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                title="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div 
                onClick={handleAbrirPicker} 
                className="relative flex items-center gap-1.5 px-2.5 py-1 rounded cursor-pointer hover:bg-muted/60 transition-colors select-none"
                title="Clique para escolher qualquer mês no calendário"
              >
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0 pointer-events-none" />
                <span className="text-xs font-semibold capitalize shrink-0 pointer-events-none">
                  {mesFormatadoExtenso}
                </span>
                <input
                  ref={inputMonthRef}
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  aria-label="Selecionar mês"
                />
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleProximoMes}
                className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                title="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleMudarParaMesAtual}
                className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground border-l ml-1 rounded-l-none"
                title="Voltar para o mês vigente de hoje"
              >
                Hoje
              </Button>
            </div>

            <Button
              onClick={() => setModalRelatorioOpen(true)}
              variant="outline"
              className="border-indigo-500/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/10 font-semibold text-xs h-9 gap-1.5 shadow-sm"
              title="Gerar relatório executivo mensal com demonstrativo contábil e exportação para Excel ou PDF"
            >
              <FileSpreadsheet className="h-4 w-4 text-indigo-500" />
              <span>Relatório Executivo</span>
            </Button>

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

        {/* Cards de Resumo Executivo: Faturamento do Mês por Parcelas, Vendas Comerciais, Caixa Quitado e Previsão */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          {/* 1. Parcelas do Mês Vigente (Sem inflar com contratos fechados no passado) */}
          <Card 
            onClick={() => {
              setModalVendasFechadasTab('parcelas_mes');
              setModalVendasFechadasOpen(true);
            }}
            className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-yellow-500/10 dark:from-amber-950/20 dark:to-yellow-950/20 cursor-pointer hover:border-amber-500 hover:shadow-md transition-all group select-none"
            title="Clique para ver o detalhamento completo das parcelas do mês"
          >
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-amber-600" /> Parcelas do Mês
                </span>
                <span className="p-1.5 rounded-full bg-amber-500/20 text-amber-600 group-hover:scale-110 transition-transform">
                  <TrendingUp className="h-4 w-4" />
                </span>
              </div>
              <div>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                  {formatMoney(resumoFinanceiro.parcelasMesTotal)}
                </p>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-0.5">
                  <span>{resumoFinanceiro.receitasPagasQtd} paga(s) • {resumoFinanceiro.parcelasVencendoNoMesQtd} a vencer</span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold group-hover:underline flex items-center gap-0.5 text-[10px]">
                    Ver lista <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-amber-500/20 text-[10px] text-amber-700 dark:text-amber-300 font-medium flex items-center justify-between">
                <span className="truncate">Previsto do mês (Caixa + A Receber)</span>
                <span className="shrink-0 bg-amber-500/20 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded text-[9px] font-bold">
                  Clique para abrir
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 2. Vendas Comerciais (Novos Contratos Fechados no Mês) */}
          <Card 
            onClick={() => {
              setModalVendasFechadasTab('contratos_fechados');
              setModalVendasFechadasOpen(true);
            }}
            className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/10 dark:from-amber-950/20 dark:to-orange-950/20 cursor-pointer hover:border-amber-500 hover:shadow-md transition-all group select-none"
            title="Clique para ver os contratos formalizados no mês (alinhado com o Dashboard)"
          >
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-amber-600" /> Vendas (Fechado)
                </span>
                <span className="p-1.5 rounded-full bg-amber-500/20 text-amber-600 group-hover:scale-110 transition-transform">
                  <TrendingUp className="h-4 w-4" />
                </span>
              </div>
              <div>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                  {formatMoney(totalFechadoMes)}
                </p>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-0.5">
                  <span>{orcamentosFechadosNoMes.length} orçamento(s) aprovado(s)</span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold group-hover:underline flex items-center gap-0.5 text-[10px]">
                    Ver contratos <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-amber-500/20 text-[10px] text-amber-700 dark:text-amber-300 font-medium flex items-center justify-between">
                <span className="truncate">Total comercial contratado no mês</span>
                <span className="shrink-0 bg-amber-500/20 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded text-[9px] font-bold">
                  Clique para abrir
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 3. Receita Caixa (Realizado / Efetivamente Quitado) */}
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

          {/* 3. A Receber no Mês */}
          <Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-amber-500/10 dark:from-orange-950/20 dark:to-amber-950/20">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="h-4 w-4 text-orange-600" /> A Receber no Mês
                </span>
                <span className="p-1.5 rounded-full bg-orange-500/20 text-orange-600">
                  <TrendingDown className="h-4 w-4" />
                </span>
              </div>
              <div>
                <p className="text-2xl font-black text-orange-600 dark:text-orange-400">
                  {formatMoney(resumoFinanceiro.aReceberNoMes)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {resumoFinanceiro.parcelasVencendoNoMesQtd} parcela(s) vencendo no mês
                </p>
              </div>
              <div className="pt-2 border-t border-orange-500/20 text-[10px] text-orange-700 dark:text-orange-300 truncate">
                Carteira total a receber: {formatMoney(totalAReceber)}
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
                  {despesasPagas.length} saída(s) quitada(s){despesasPendentes > 0 ? ` · A pagar: ${formatMoney(despesasPendentes)}` : ''}
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
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} id="tabs-financeiro" className="space-y-6">
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
            {/* Widget de Saldos por Conta Bancária */}
            <div className="p-3.5 bg-muted/20 border rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <Building2 className="h-4 w-4 text-primary" />
                  Saldos por Conta Financeira no Mês ({selectedMonth})
                </span>
                <div className="flex items-center gap-2">
                  {filtroConta !== 'todas' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFiltroConta('todas')}
                      className="h-6 text-[11px] text-muted-foreground hover:text-foreground px-2"
                    >
                      ✕ Limpar filtro de conta
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setModalContasOpen(true)}
                    className="h-6 text-[11px] px-2.5 font-semibold text-primary border-primary/30 hover:bg-primary/10 gap-1"
                  >
                    <Plus className="h-3 w-3" /> Gerenciar Contas
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {saldosContasMes.map(({ conta, totalEntradas, totalSaidas, saldoAtual }) => {
                  const isSelected = filtroConta === conta.id;
                  return (
                    <div
                      key={conta.id}
                      onClick={() => setFiltroConta(isSelected ? 'todas' : conta.id)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-all select-none ${
                        isSelected
                          ? 'bg-primary/15 border-primary shadow-sm ring-1 ring-primary'
                          : 'bg-card hover:bg-muted/40 hover:border-primary/40'
                      }`}
                      title={`Clique para filtrar lançamentos de ${conta.nome}`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: conta.cor || '#3b82f6' }}
                          />
                          <span className="text-[11px] font-bold text-foreground truncate">
                            {conta.nome}
                          </span>
                        </div>
                        {conta.padraoPara?.[0] && (
                          <span className="text-[9px] uppercase px-1 py-0 rounded bg-muted font-bold text-muted-foreground shrink-0">
                            {conta.padraoPara[0]}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-black text-foreground">
                        {formatMoney(saldoAtual)}
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground mt-0.5">
                        <span className="text-emerald-500 font-semibold">+{formatMoney(totalEntradas)}</span>
                        {totalSaidas > 0 && <span className="text-rose-500">-{formatMoney(totalSaidas)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Banner de foco quando uma conta bancária está filtrada */}
              {filtroConta !== 'todas' && (() => {
                const contaSel = getContaById(filtroConta);
                const resumoSel = saldosContasMes.find((s) => s.conta.id === filtroConta);
                if (!contaSel) return null;
                return (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg bg-card border border-primary/30 gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: contaSel.cor }} />
                      <div>
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          Extrato Bancário: {contaSel.nome} ({selectedMonth})
                        </span>
                        <p className="text-[11px] text-muted-foreground">
                          Cada receita adiciona (+) e cada despesa desconta (-) diretamente do saldo deste banco.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <span className="text-emerald-600">+{formatMoney(resumoSel?.totalEntradas || 0)}</span>
                        <span className="text-rose-600">-{formatMoney(resumoSel?.totalSaidas || 0)}</span>
                        <span className="px-2 py-0.5 rounded bg-muted text-foreground border font-black">
                          Saldo: {formatMoney(resumoSel?.saldoAtual || 0)}
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setContaParaAbrirExtrato(contaSel.id);
                          setModalContasOpen(true);
                        }}
                        className="h-7 text-xs font-semibold gap-1 text-primary border-primary/40 hover:bg-primary/10"
                      >
                        <FileText className="h-3.5 w-3.5" /> Extrato Completo
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>

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
                    <div className="relative w-full sm:w-56">
                      <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar paciente, descrição..."
                        value={buscaTexto}
                        onChange={(e) => setBuscaTexto(e.target.value)}
                        className="h-8 pl-8 text-xs"
                      />
                    </div>

                    {/* Alternador de Modo de Visualização: Cartões vs Tabela de Extrato */}
                    <div className="hidden sm:flex items-center border rounded-lg p-0.5 bg-muted/40 shrink-0">
                      <Button
                        type="button"
                        variant={modoVisualizacaoExtrato === 'cards' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setModoVisualizacaoExtrato('cards')}
                        className="h-7 text-xs px-2 gap-1"
                        title="Visualização em Lista de Cartões"
                      >
                        <LayoutGrid className="h-3.5 w-3.5" /> Cartões
                      </Button>
                      <Button
                        type="button"
                        variant={modoVisualizacaoExtrato === 'tabela' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setModoVisualizacaoExtrato('tabela')}
                        className="h-7 text-xs px-2 gap-1 font-semibold"
                        title="Visualização em Tabela / Livro-Caixa com Saldo Progressivo"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" /> Tabela Extrato
                      </Button>
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
                ) : modoVisualizacaoExtrato === 'tabela' ? (
                  <div className="overflow-x-auto rounded-lg border bg-card">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
                        <tr>
                          <th className="py-2.5 px-3 text-left">Data</th>
                          <th className="py-2.5 px-3 text-left">Conta / Banco</th>
                          <th className="py-2.5 px-3 text-left">Descrição / Paciente</th>
                          <th className="py-2.5 px-3 text-left">Método</th>
                          <th className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">Entrada (+)</th>
                          <th className="py-2.5 px-3 text-right text-rose-600 dark:text-rose-400 font-bold">Despesa (-)</th>
                          <th className="py-2.5 px-3 text-right font-black text-foreground">Saldo da Conta</th>
                          <th className="py-2.5 px-3 text-center">Situação</th>
                          <th className="py-2.5 px-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {transacoesExibicao.map((transacao) => {
                          const isReceita = transacao.tipo === 'receita';
                          const isPago = ehTransacaoPaga(transacao);
                          const cId = obterContaIdParaTransacao(transacao);
                          const cObj = getContaById(cId);
                          const info = mapaSaldoProgressivo.get(transacao.id);
                          const pacNome = transacao.pacienteId ? getPacienteName(transacao.pacienteId) : '';
                          const valorReal = isReceita && transacao.valorLiquido !== undefined ? Number(transacao.valorLiquido) : Number(transacao.valor) || 0;

                          return (
                            <tr key={transacao.id} className="hover:bg-muted/30 transition-colors">
                              <td className="py-2 px-3 whitespace-nowrap text-muted-foreground font-medium">
                                {new Date(transacao.data).toLocaleDateString('pt-BR')}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5 font-semibold text-xs" style={{ color: cObj?.cor || '#64748B' }}>
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cObj?.cor || '#64748B' }} />
                                  {cObj?.nome || transacao.contaBancariaNome || cId}
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                <div className="font-semibold text-foreground truncate max-w-[220px]">
                                  {pacNome || transacao.descricao}
                                </div>
                                {pacNome && transacao.descricao && (
                                  <div className="text-[10px] text-muted-foreground truncate max-w-[220px]">
                                    {transacao.descricao}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                {renderMetodoIcon(transacao.metodoPagamento)}
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap font-bold text-emerald-600 dark:text-emerald-400">
                                {isReceita ? `+${formatMoney(valorReal)}` : '-'}
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap font-bold text-rose-600 dark:text-rose-400">
                                {!isReceita ? `-${formatMoney(transacao.valor)}` : '-'}
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap font-black">
                                {info && !info.isPendente ? (
                                  <span className={info.saldoApos >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                    {formatMoney(info.saldoApos)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-[10px]">-</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center whitespace-nowrap">
                                {isPago ? (
                                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0 text-[10px] py-0">
                                    No Caixa
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0 text-[10px] py-0">
                                    Pendente
                                  </Badge>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1">
                                  {!isPago && isReceita && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 text-[10px] gap-1"
                                      onClick={() => {
                                        setTransacaoParaReceber(transacao);
                                        setShowModalReceber(true);
                                      }}
                                      title="Dar baixa e receber no caixa"
                                    >
                                      <CheckCircle2 className="h-3 w-3" /> Receber
                                    </Button>
                                  )}
                                  {isPago && isReceita && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                      onClick={() => handleGerarRecibo(transacao)}
                                      title="Gerar recibo oficial"
                                    >
                                      <Receipt className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                    onClick={() => handleEdit(transacao)}
                                    title="Editar lançamento"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-rose-500"
                                    onClick={() => handleDelete(transacao.id)}
                                    title="Excluir lançamento"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {transacoesExibicao.map((transacao) => {
                      const isReceita = transacao.tipo === 'receita';
                      const isPago = ehTransacaoPaga(transacao);
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
                                {(() => {
                                  const cId = transacao.contaBancaria || (
                                    transacao.tipo === 'despesa' ? 'itau' :
                                    (transacao.metodoPagamento === 'pix' || transacao.metodoPagamento === 'pix_parcelado') ? 'inter' :
                                    transacao.metodoPagamento === 'cartao' ? 'infinitepay' :
                                    transacao.metodoPagamento === 'dinheiro' ? 'caixa_fisico' : 'inter'
                                  );
                                  const cObj = getContaById(cId);
                                  const cNome = transacao.contaBancariaNome || cObj?.nome || cId;
                                  const cCor = cObj?.cor || '#64748B';
                                  return (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] gap-1 px-1.5 py-0 font-medium cursor-pointer hover:opacity-80 transition-opacity"
                                      style={{
                                        borderColor: `${cCor}40`,
                                        backgroundColor: `${cCor}12`,
                                        color: cCor,
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setFiltroConta(filtroConta === cId ? 'todas' : cId);
                                      }}
                                      title={`Filtrar por ${cNome}`}
                                    >
                                      <Building2 className="h-2.5 w-2.5 shrink-0" />
                                      {cNome}
                                    </Badge>
                                  );
                                })()}
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
              selectedMonth={selectedMonth}
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

        {/* Modal de Detalhamento e Resumo das Vendas Fechadas e Parcelas do Mês */}
        <ModalResumoVendasFechadas
          open={modalVendasFechadasOpen}
          onOpenChange={setModalVendasFechadasOpen}
          initialTab={modalVendasFechadasTab}
          orcamentos={orcamentos}
          orcamentosFechadosNoMes={orcamentosFechadosNoMes}
          transacoes={transacoes}
          pacientes={pacientes}
          selectedMonth={selectedMonth}
          totalFechadoMes={totalFechadoMes}
          resumoFinanceiro={resumoFinanceiro}
          onVerOrcamento={(orc) => setApresentarOrcamento(orc)}
          onIrParaAbaOrcamentos={() => {
            setActiveTab('orcamentos');
            setTimeout(() => {
              const el = document.getElementById('tabs-financeiro');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }, 50);
          }}
        />

        {/* Modal Relatório Executivo Mensal de Fechamento (PDF / Excel) */}
        <ModalRelatorioFechamento
          open={modalRelatorioOpen}
          onOpenChange={setModalRelatorioOpen}
          selectedMonth={selectedMonth}
          transacoes={transacoes}
          pacientes={pacientes}
          orcamentos={orcamentos}
          configuracoes={configuracoes}
        />

        {/* Modal Apresentar / Imprimir Orçamento & Contrato */}
        {apresentarOrcamento && (
          <ModalApresentarOrcamento
            isOpen={!!apresentarOrcamento}
            onClose={() => setApresentarOrcamento(null)}
            orcamento={apresentarOrcamento}
            patient={pacientes.find((p) => p.id === apresentarOrcamento.pacienteId)}
          />
        )}

        {/* Modal de Gestão de Contas Bancárias e Financeiras */}
        <ModalContasBancarias
          isOpen={modalContasOpen}
          onClose={() => {
            setModalContasOpen(false);
            setContaParaAbrirExtrato(null);
          }}
          contaInicialId={contaParaAbrirExtrato || undefined}
        />
      </div>
    </Layout>
  );
};

export default Financeiro;
