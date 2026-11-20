import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart as PieIcon,
  BarChart3,
  ArrowDownRight,
  ArrowUpRight,
  Percent,
  FileText,
  Printer,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Stethoscope,
  Scissors,
  CreditCard,
  Building,
  Users,
  Search,
  User,
  Calendar,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Receipt,
  QrCode,
} from 'lucide-react';
import { formatMoney } from '@/utils/exportCsv';
import { isDataNoMesAno, ehTransacaoPaga } from '@/utils/financeiroCalculos';

interface FinanceiroDREProps {
  selectedMonth?: string;
}

// Categorias das especialidades odontológicas oficiais
const ESPECIALIDADES_MAP: Record<string, { label: string; cor: string; keywords: string[] }> = {
  ortodontia: {
    label: 'Ortodontia',
    cor: '#6366F1', // Indigo
    keywords: ['orto', 'aparelho', 'alinhador', 'braquete', 'manutenção', 'arco', 'disjuntor', 'contenção'],
  },
  implante: {
    label: 'Implantodontia',
    cor: '#0EA5E9', // Sky
    keywords: ['implante', 'enxerto', 'abutment', 'cicatrizador', 'cone morse', 'sinus lift', 'protocolo'],
  },
  endodontia: {
    label: 'Endodontia (Canal)',
    cor: '#EC4899', // Pink
    keywords: ['canal', 'endodont', 'retratamento', 'pulpectomia', 'desvitaliza', 'biopulpectomia'],
  },
  protese: {
    label: 'Prótese & Reabilitação',
    cor: '#F59E0B', // Amber
    keywords: ['prótese', 'protese', 'coroa', 'bloco', 'onlay', 'inlay', 'ponte', 'roach', 'dentadura'],
  },
  estetica: {
    label: 'Estética & Facetas',
    cor: '#8B5CF6', // Purple
    keywords: ['faceta', 'lente', 'resina', 'clareamento', 'harmoniza', 'botox', 'preenchimento', 'gengivoplastia'],
  },
  cirurgia: {
    label: 'Cirurgia Oral',
    cor: '#EF4444', // Red
    keywords: ['extração', 'extracao', 'siso', 'frenectomia', 'cirurgia', 'biopsia', 'exodontia'],
  },
  periodontia: {
    label: 'Periodontia',
    cor: '#10B981', // Emerald
    keywords: ['periodont', 'raspagem', 'curetagem', 'gengivite', 'profilaxia periodontal'],
  },
  clinica_geral: {
    label: 'Clínico Geral & Preventivo',
    cor: '#14B8A6', // Teal
    keywords: ['consulta', 'avaliação', 'avaliacao', 'profilaxia', 'limpeza', 'restauração', 'restauracao', 'flúor', 'fluor', 'raio-x', 'panoramica'],
  },
};

const classificarEspecialidade = (texto: string): string => {
  if (!texto) return 'clinica_geral';
  const normalizado = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  for (const [chave, config] of Object.entries(ESPECIALIDADES_MAP)) {
    for (const kw of config.keywords) {
      const kwNorm = kw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      if (normalizado.includes(kwNorm)) {
        return chave;
      }
    }
  }

  return 'clinica_geral';
};

export const FinanceiroDRE: React.FC<FinanceiroDREProps> = ({ selectedMonth }) => {
  const { transacoes, pacientes } = useDentalSystem();
  const { orcamentos } = useOrcamentos();
  const [visaoVisual, setVisaoVisual] = useState<'gerencial' | 'tabela'>('gerencial');
  const [buscaPaciente, setBuscaPaciente] = useState('');
  const [pacientesExpandidos, setPacientesExpandidos] = useState<Record<string, boolean>>({});

  const toggleExpandirPaciente = (pacId: string) => {
    setPacientesExpandidos((prev) => ({
      ...prev,
      [pacId]: !prev[pacId],
    }));
  };

  const [ano, mes] = selectedMonth
    ? selectedMonth.split('-')
    : [new Date().getFullYear().toString(), String(new Date().getMonth() + 1).padStart(2, '0')];

  // 1. Filtragem das transações REAIS do mês (imune a UTC)
  const transacoesMes = useMemo(() => {
    return (transacoes || []).filter((t) => {
      const dataRef = t?.data || t?.dataPagamento || t?.vencimento;
      if (!dataRef) return false;
      return isDataNoMesAno(dataRef, Number(ano), Number(mes) - 1);
    });
  }, [transacoes, mes, ano]);

  // 2. Cálculos Contábeis do DRE Real
  const calculosDRE = useMemo(() => {
    const receitasPagas = transacoesMes.filter((t) => t?.tipo === 'receita' && ehTransacaoPaga(t));
    const despesasPagas = transacoesMes.filter((t) => t?.tipo === 'despesa' && ehTransacaoPaga(t));

    // A. FATURAMENTO BRUTO (RECEITA OPERACIONAL BRUTA)
    const faturamentoBruto = receitasPagas.reduce((acc, t) => acc + Number(t?.valor || 0), 0);

    // B. DEDUÇÕES / TAXAS DE MÁQUINA DE CARTÃO REAIS
    const taxasCartaoDespesas = despesasPagas
      .filter(
        (t) =>
          t.categoria === 'Taxas de Cartão' ||
          (t.descricao && t.descricao.toLowerCase().includes('taxa da máquina')) ||
          (t.descricao && t.descricao.toLowerCase().includes('taxa de cartão'))
      )
      .reduce((acc, t) => acc + Number(t.valor || 0), 0);

    const taxasCartaoEmbutidas = receitasPagas.reduce((acc, t) => {
      if (t.taxaCartaoValor && t.taxaCartaoValor > 0) {
        return acc + Number(t.taxaCartaoValor);
      }
      return acc;
    }, 0);

    // Evita duplicidade se a taxa foi lançada como despesa separada
    const totalTaxasCartao = Math.max(taxasCartaoDespesas, taxasCartaoEmbutidas);

    // C. RECEITA OPERACIONAL LÍQUIDA
    const receitaLiquida = faturamentoBruto - totalTaxasCartao;

    // D. REPASSES A PARCEIROS E DENTISTAS (CUSTOS OPERACIONAIS VARIÁVEIS)
    const despesasRepasses = despesasPagas
      .filter(
        (t) =>
          t.categoria === 'parceria' ||
          (t.parceiroId && t.parceiroId.length > 0) ||
          (t.valorParceiro && t.valorParceiro > 0) ||
          (t.descricao && t.descricao.toLowerCase().includes('repasse parceiro'))
      )
      .reduce((acc, t) => acc + Number(t.valor || 0), 0);

    const repassesEmbutidos = receitasPagas.reduce((acc, t) => {
      if (t.valorParceiro && t.valorParceiro > 0) {
        return acc + Number(t.valorParceiro);
      }
      return acc;
    }, 0);

    const totalRepasses = Math.max(despesasRepasses, repassesEmbutidos);

    // E. MARGEM DE CONTRIBUIÇÃO ODONTOLÓGICA
    const margemContribuicao = receitaLiquida - totalRepasses;
    const margemContribuicaoPerc = faturamentoBruto > 0 ? (margemContribuicao / faturamentoBruto) * 100 : 0;

    // F. CUSTOS FIXOS & DESPESAS OPERACIONAIS
    // Exclui taxas e repasses já descontados acima para manter precisão cirúrgica
    const despesasFixas = despesasPagas.filter(
      (t) =>
        t.categoria !== 'Taxas de Cartão' &&
        t.categoria !== 'parceria' &&
        !t.descricao?.toLowerCase().includes('taxa da máquina') &&
        !String(t?.descricao || '').toLowerCase().includes('repasse parceiro')
    );

    const totalCustosFixos = despesasFixas.reduce((acc, t) => acc + Number(t.valor || 0), 0);

    // Agrupamento por Categoria das Despesas Fixas
    const custosPorCategoria: Record<string, number> = {};
    despesasFixas.forEach((t) => {
      const cat = t.categoria || 'Geral / Outros';
      custosPorCategoria[cat] = (custosPorCategoria[cat] || 0) + Number(t.valor || 0);
    });

    // G. LUCRO LÍQUIDO REAL DA CLÍNICA
    const lucroLiquidoReal = margemContribuicao - totalCustosFixos;
    const margemLiquidaPerc = faturamentoBruto > 0 ? (lucroLiquidoReal / faturamentoBruto) * 100 : 0;

    // Faturas pendentes no mês (inadimplência / risco)
    const faturasPendentes = transacoesMes
      .filter((t) => t?.tipo === 'receita' && (t?.status === 'pendente' || t?.status === 'vencido'))
      .reduce((acc, t) => acc + Number(t?.valor || 0), 0);

    // 3. APURAÇÃO 100% REAL POR ESPECIALIDADE ODONTOLÓGICA
    // Cruzamento das receitas pagas com orçamentos e procedimentos
    const especialidadesAcumulador: Record<
      string,
      { chave: string; nome: string; cor: string; valor: number; qtd: number }
    > = {};

    Object.entries(ESPECIALIDADES_MAP).forEach(([chave, conf]) => {
      especialidadesAcumulador[chave] = {
        chave,
        nome: conf.label,
        cor: conf.cor,
        valor: 0,
        qtd: 0,
      };
    });

    receitasPagas.forEach((r) => {
      const val = Number(r.valor || 0);

      // Tenta achar orçamento associado
      let especialidadeAlvo = 'clinica_geral';
      if (r.orcamentoId) {
        const orc = orcamentos.find((o) => o.id === r.orcamentoId);
        if (orc?.itens && orc.itens.length > 0) {
          // Pega o item de maior valor do orçamento
          const topItem = [...orc.itens].sort((a, b) => (b.valor || 0) - (a.valor || 0))[0];
          if (topItem?.nome) {
            especialidadeAlvo = classificarEspecialidade(topItem.nome);
          }
        }
      }

      // Se não identificou por orçamento, classifica pela descrição da transação
      if (especialidadeAlvo === 'clinica_geral' && r.descricao) {
        especialidadeAlvo = classificarEspecialidade(r.descricao);
      }

      if (especialidadesAcumulador[especialidadeAlvo]) {
        especialidadesAcumulador[especialidadeAlvo].valor += val;
        especialidadesAcumulador[especialidadeAlvo].qtd += 1;
      } else {
        especialidadesAcumulador.clinica_geral.valor += val;
        especialidadesAcumulador.clinica_geral.qtd += 1;
      }
    });

    // Filtra apenas especialidades que tiveram receita real no mês e ordena
    const dadosEspecialidadesReais = Object.values(especialidadesAcumulador)
      .filter((e) => e.valor > 0)
      .sort((a, b) => b.valor - a.valor)
      .map((e) => ({
        ...e,
        percentual: faturamentoBruto > 0 ? (e.valor / faturamentoBruto) * 100 : 0,
        ticketMedio: e.qtd > 0 ? e.valor / e.qtd : 0,
      }));

    // Dados para Gráfico de Pizza de Despesas
    const dadosPizzaDespesas = Object.entries(custosPorCategoria)
      .map(([nome, valor]) => ({
        name: nome,
        value: valor,
        percentual: totalCustosFixos > 0 ? (valor / totalCustosFixos) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    // Cascata DRE para o Gráfico de Barras Comparativo
    const dadosCascataDRE = [
      { etapa: '1. Fat. Bruto', valor: faturamentoBruto, fill: '#10B981' },
      { etapa: '2. (-) Taxas Cartão', valor: totalTaxasCartao, fill: '#F43F5E' },
      { etapa: '3. Fat. Líquido', valor: receitaLiquida, fill: '#0EA5E9' },
      { etapa: '4. (-) Repasses', valor: totalRepasses, fill: '#F59E0B' },
      { etapa: '5. Margem Contrib.', valor: margemContribuicao, fill: '#8B5CF6' },
      { etapa: '6. (-) Custos Fixos', valor: totalCustosFixos, fill: '#EF4444' },
      { etapa: '7. Lucro Líquido', valor: lucroLiquidoReal, fill: lucroLiquidoReal >= 0 ? '#6366F1' : '#DC2626' },
    ];

    // 4. DETALHAMENTO DE FATURAMENTO POR PACIENTE (PARA CONFERÊNCIA ESPECIFICADA DO DRE)
    const pacientesMap = new Map<string, any>();
    (pacientes || []).forEach((p) => {
      if (p?.id) pacientesMap.set(p.id, p);
    });

    const gruposPacientes = new Map<string, {
      pacienteId: string;
      pacienteNome: string;
      totalBruto: number;
      totalTaxas: number;
      totalLiquido: number;
      transacoes: any[];
      metodos: Set<string>;
      orcamentosIds: Set<string>;
      procedimentos: Set<string>;
    }>();

    receitasPagas.forEach((r) => {
      const pacId = r.pacienteId || r.paciente_id || 'avulso';
      const pac = pacId !== 'avulso' ? pacientesMap.get(pacId) : null;
      const pacNome = pac?.nome || r.pacienteNome || (pacId === 'avulso' ? 'Lançamento Avulso (Sem Paciente)' : 'Paciente');
      const val = Number(r.valor || 0);
      const taxa = Number(r.taxaCartaoValor || 0);
      const liq = r.valorLiquido ? Number(r.valorLiquido) : (val - taxa);

      if (!gruposPacientes.has(pacId)) {
        gruposPacientes.set(pacId, {
          pacienteId: pacId,
          pacienteNome: pacNome,
          totalBruto: 0,
          totalTaxas: 0,
          totalLiquido: 0,
          transacoes: [],
          metodos: new Set<string>(),
          orcamentosIds: new Set<string>(),
          procedimentos: new Set<string>(),
        });
      }

      const g = gruposPacientes.get(pacId)!;
      g.totalBruto += val;
      g.totalTaxas += taxa;
      g.totalLiquido += liq;
      g.transacoes.push(r);
      const m = r.metodoPagamento || r.metodo_pagamento;
      if (m) g.metodos.add(m);
      if (r.descricao) g.procedimentos.add(r.descricao);
      const orcId = r.orcamentoId || r.orcamento_id;
      if (orcId) g.orcamentosIds.add(orcId);
    });

    const listaPacientesDRE = Array.from(gruposPacientes.values())
      .map((g) => ({
        ...g,
        percentualDoTotal: faturamentoBruto > 0 ? (g.totalBruto / faturamentoBruto) * 100 : 0,
        metodosArray: Array.from(g.metodos),
        procedimentosArray: Array.from(g.procedimentos),
      }))
      .sort((a, b) => b.totalBruto - a.totalBruto);

    return {
      faturamentoBruto,
      totalTaxasCartao,
      receitaLiquida,
      totalRepasses,
      margemContribuicao,
      margemContribuicaoPerc,
      totalCustosFixos,
      custosPorCategoria,
      lucroLiquidoReal,
      margemLiquidaPerc,
      faturasPendentes,
      dadosEspecialidadesReais,
      dadosPizzaDespesas,
      dadosCascataDRE,
      qtdReceitas: receitasPagas.length,
      qtdDespesas: despesasPagas.length,
      listaPacientesDRE,
      receitasPagas,
    };
  }, [transacoesMes, orcamentos, pacientes]);

  const {
    faturamentoBruto,
    totalTaxasCartao,
    receitaLiquida,
    totalRepasses,
    margemContribuicao,
    margemContribuicaoPerc,
    totalCustosFixos,
    custosPorCategoria,
    lucroLiquidoReal,
    margemLiquidaPerc,
    faturasPendentes,
    dadosEspecialidadesReais,
    dadosPizzaDespesas,
    dadosCascataDRE,
    listaPacientesDRE,
    receitasPagas,
  } = calculosDRE;

  const handleImprimir = () => {
    window.print();
  };

  const renderMetodoBadge = (metodo: string) => {
    const m = (metodo || '').toLowerCase();
    if (m === 'pix' || m === 'pix_parcelado') {
      return (
        <Badge key={metodo} className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
          PIX
        </Badge>
      );
    }
    if (m === 'cartao' || m.includes('cart')) {
      return (
        <Badge key={metodo} className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-[10px] font-bold">
          Cartão
        </Badge>
      );
    }
    if (m === 'dinheiro') {
      return (
        <Badge key={metodo} className="bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30 text-[10px] font-bold">
          Dinheiro
        </Badge>
      );
    }
    return (
      <Badge key={metodo} variant="outline" className="text-[10px]">
        {metodo || 'Outro'}
      </Badge>
    );
  };

  const pacientesFiltrados = useMemo(() => {
    if (!buscaPaciente.trim()) return listaPacientesDRE || [];
    const q = buscaPaciente.toLowerCase();
    return (listaPacientesDRE || []).filter((p) => {
      const matchNome = p.pacienteNome.toLowerCase().includes(q);
      const matchProc = p.procedimentosArray.some((desc: string) => desc.toLowerCase().includes(q));
      const matchMetodo = p.metodosArray.some((m: string) => m.toLowerCase().includes(q));
      return matchNome || matchProc || matchMetodo;
    });
  }, [listaPacientesDRE, buscaPaciente]);

  const COLORS_PIE = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#06b6d4', '#8b5cf6', '#ec4899', '#64748b'];

  return (
    <div className="space-y-6">
      {/* Cabeçalho do DRE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
              <DollarSign className="h-6 w-6 text-indigo-600" />
              DRE Odontológico 100% Real
            </h2>
            <Badge className="bg-indigo-600/15 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border-0">
              Mês: {mes}/{ano}
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            Demonstrativo de Resultado cruzando Faturamento Real ➔ Taxas de Maquininha ➔ Repasses a Dentistas ➔ Custos Fixos ➔ Lucro Líquido Real.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <Tabs value={visaoVisual} onValueChange={(v: any) => setVisaoVisual(v)}>
            <TabsList className="h-8 p-1 bg-muted/60">
              <TabsTrigger value="gerencial" className="text-xs font-semibold px-2.5 py-1">
                <BarChart3 className="h-3.5 w-3.5 mr-1" /> Visão Gráfica
              </TabsTrigger>
              <TabsTrigger value="tabela" className="text-xs font-semibold px-2.5 py-1">
                <FileText className="h-3.5 w-3.5 mr-1" /> Tabela DRE
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleImprimir}
            className="h-8 text-xs gap-1"
            title="Imprimir relatório gerencial do DRE"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Imprimir</span>
          </Button>
        </div>
      </div>

      {/* 4 Cards de Síntese Financeira */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Lucro Líquido Real */}
        <Card
          className={`border ${
            lucroLiquidoReal >= 0
              ? 'bg-gradient-to-br from-indigo-50/70 to-indigo-100/40 border-indigo-200 dark:from-indigo-950/20 dark:to-zinc-900 dark:border-indigo-900/40'
              : 'bg-red-50/70 border-red-200 dark:bg-red-950/20'
          }`}
        >
          <CardHeader className="pb-1.5 p-4">
            <span className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider flex items-center justify-between">
              <span>Lucro Líquido Real</span>
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            </span>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div
              className={`text-2xl sm:text-3xl font-black ${
                lucroLiquidoReal >= 0 ? 'text-indigo-900 dark:text-indigo-200' : 'text-red-600'
              }`}
            >
              {formatMoney(lucroLiquidoReal)}
            </div>
            <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80 mt-1 flex items-center font-medium">
              {lucroLiquidoReal >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 mr-1 text-red-600" />
              )}
              Margem Líquida da Clínica: <strong>{margemLiquidaPerc.toFixed(1)}%</strong>
            </p>
          </CardContent>
        </Card>

        {/* 2. Faturamento Bruto */}
        <Card className="border bg-card">
          <CardHeader className="pb-1.5 p-4">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Faturamento Bruto</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
            </span>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {formatMoney(faturamentoBruto)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Receita operacional líquida: {formatMoney(receitaLiquida)}
            </p>
          </CardContent>
        </Card>

        {/* 3. Margem de Contribuição */}
        <Card className="border bg-card">
          <CardHeader className="pb-1.5 p-4">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Margem de Contribuição</span>
              <Percent className="h-3.5 w-3.5 text-purple-500" />
            </span>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400">
              {formatMoney(margemContribuicao)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {margemContribuicaoPerc.toFixed(1)}% após taxas ({formatMoney(totalTaxasCartao)}) e repasses ({formatMoney(totalRepasses)})
            </p>
          </CardContent>
        </Card>

        {/* 4. Custos Fixos & Despesas */}
        <Card className="border bg-card">
          <CardHeader className="pb-1.5 p-4">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Custos Fixos da Clínica</span>
              <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
            </span>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl sm:text-3xl font-black text-red-600 dark:text-red-400">
              {formatMoney(totalCustosFixos)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Inadimplência pendente no mês: {formatMoney(faturasPendentes)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Visão 1: Gráficos Gerenciais Reais */}
      {visaoVisual === 'gerencial' && (
        <div className="space-y-6">
          {/* Gráfico 1: Cascata Oficial do DRE */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Cascata do Resultado (Como o Faturamento vira Lucro Líquido)
              </CardTitle>
              <CardDescription className="text-xs">
                Visualização do funil financeiro: Faturamento Bruto ➔ (-) Taxas ➔ (-) Repasses ➔ (-) Custos Fixos ➔ Lucro Líquido Real.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[280px] sm:h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosCascataDRE} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="etapa" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <RechartsTooltip formatter={(val) => [`R$ ${formatMoney(Number(val))}`, 'Valor']} />
                  <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                    {dadosCascataDRE.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gráfico 2 e 3: Lado a Lado (Especialidades Reais e Despesas por Categoria) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Rentabilidade Real por Especialidade */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-indigo-600" />
                  Faturamento Real por Especialidade Odontológica
                </CardTitle>
                <CardDescription className="text-xs">
                  Valores apurados com base nos procedimentos reais faturados no mês.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[320px]">
                {dadosEspecialidadesReais.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dadosEspecialidadesReais}
                      layout="vertical"
                      margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                      <YAxis dataKey="nome" type="category" tick={{ fontSize: 11 }} width={120} />
                      <RechartsTooltip
                        formatter={(val, name, item) => [
                          `R$ ${formatMoney(Number(val))} (${item.payload.percentual.toFixed(1)}%)`,
                          'Faturamento Real',
                        ]}
                      />
                      <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                        {dadosEspecialidadesReais.map((entry, index) => (
                          <Cell key={`cell-esp-${index}`} fill={entry.cor} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs text-center p-4">
                    <AlertCircle className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <span>Nenhuma receita por procedimento computada no mês selecionado.</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Distribuição Real de Despesas por Categoria */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                  <PieIcon className="h-4 w-4 text-rose-500" />
                  Distribuição de Custos Fixos & Despesas
                </CardTitle>
                <CardDescription className="text-xs">
                  Onde a clínica está consumindo seus recursos no mês ({formatMoney(totalCustosFixos)} total).
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[320px]">
                {dadosPizzaDespesas.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dadosPizzaDespesas}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {dadosPizzaDespesas.map((_, index) => (
                          <Cell key={`cell-pie-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(val, _, item) => [
                          `R$ ${formatMoney(Number(val))} (${item.payload.percentual.toFixed(1)}%)`,
                          'Total Gasto',
                        ]}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs text-center p-4">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500/40 mb-2" />
                    <span>Sem despesas operacionais registradas neste mês.</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Visão 2: Tabela DRE Contábil Oficial */}
      {visaoVisual === 'tabela' && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Demonstrativo de Resultado do Exercício (DRE Gerencial)
            </CardTitle>
            <CardDescription className="text-xs">
              Estrutura padrão de contabilidade gerencial com análise vertical (% sobre o Faturamento Bruto).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-muted/70 text-muted-foreground border-b font-semibold">
                  <tr>
                    <th className="p-3 text-left">Estrutura de Contas</th>
                    <th className="p-3 text-right">Valor Real (R$)</th>
                    <th className="p-3 text-right">Análise Vertical (% AV)</th>
                    <th className="p-3 text-center">Classificação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {/* 1. FATURAMENTO BRUTO */}
                  <tr className="bg-emerald-500/10 font-bold text-foreground">
                    <td className="p-3 pl-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      (+) FATURAMENTO BRUTO (RECEITA OPERACIONAL BRUTA)
                    </td>
                    <td className="p-3 text-right text-emerald-600 font-black">
                      {formatMoney(faturamentoBruto)}
                    </td>
                    <td className="p-3 text-right font-bold">100.0%</td>
                    <td className="p-3 text-center">
                      <Badge className="bg-emerald-600 text-white text-[10px]">Entrada</Badge>
                    </td>
                  </tr>

                  {/* 2. DEDUÇÕES / TAXAS DE MÁQUINA */}
                  <tr className="hover:bg-muted/30">
                    <td className="p-2.5 pl-8 text-muted-foreground">
                      (-) Deduções da Receita / Taxas de Máquinas de Cartão
                    </td>
                    <td className="p-2.5 text-right font-medium text-rose-500">
                      -{formatMoney(totalTaxasCartao)}
                    </td>
                    <td className="p-2.5 text-right text-muted-foreground">
                      {(faturamentoBruto > 0 ? (totalTaxasCartao / faturamentoBruto) * 100 : 0).toFixed(1)}%
                    </td>
                    <td className="p-2.5 text-center text-muted-foreground text-xs">Dedução</td>
                  </tr>

                  {/* 3. RECEITA OPERACIONAL LÍQUIDA */}
                  <tr className="bg-blue-50/50 dark:bg-blue-950/20 font-bold text-foreground">
                    <td className="p-3 pl-6">(=) RECEITA OPERACIONAL LÍQUIDA</td>
                    <td className="p-3 text-right text-blue-600 dark:text-blue-400 font-black">
                      {formatMoney(receitaLiquida)}
                    </td>
                    <td className="p-3 text-right font-bold">
                      {(faturamentoBruto > 0 ? (receitaLiquida / faturamentoBruto) * 100 : 0).toFixed(1)}%
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className="text-blue-600 text-[10px]">
                        Líquido
                      </Badge>
                    </td>
                  </tr>

                  {/* 4. REPASSES A PARCEIROS */}
                  <tr className="hover:bg-muted/30">
                    <td className="p-2.5 pl-8 text-muted-foreground">
                      (-) Custos Variáveis / Repasses aos Dentistas Parceiros & Protéticos
                    </td>
                    <td className="p-2.5 text-right font-medium text-amber-600">
                      -{formatMoney(totalRepasses)}
                    </td>
                    <td className="p-2.5 text-right text-muted-foreground">
                      {(faturamentoBruto > 0 ? (totalRepasses / faturamentoBruto) * 100 : 0).toFixed(1)}%
                    </td>
                    <td className="p-2.5 text-center text-muted-foreground text-xs">Custo Variável</td>
                  </tr>

                  {/* 5. MARGEM DE CONTRIBUIÇÃO */}
                  <tr className="bg-purple-50/50 dark:bg-purple-950/20 font-bold text-foreground">
                    <td className="p-3 pl-6">(=) MARGEM DE CONTRIBUIÇÃO ODONTOLÓGICA</td>
                    <td className="p-3 text-right text-purple-600 dark:text-purple-400 font-black">
                      {formatMoney(margemContribuicao)}
                    </td>
                    <td className="p-3 text-right font-bold">{margemContribuicaoPerc.toFixed(1)}%</td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className="text-purple-600 text-[10px]">
                        Margem
                      </Badge>
                    </td>
                  </tr>

                  {/* 6. CUSTOS FIXOS */}
                  <tr className="font-semibold text-muted-foreground bg-muted/20">
                    <td className="p-2.5 pl-6" colSpan={4}>
                      (-) CUSTOS FIXOS & DESPESAS OPERACIONAIS DA CLÍNICA
                    </td>
                  </tr>

                  {Object.entries(custosPorCategoria).map(([cat, val]) => (
                    <tr key={cat} className="hover:bg-muted/30">
                      <td className="p-2.5 pl-10 text-muted-foreground">• {cat}</td>
                      <td className="p-2.5 text-right text-red-500 font-medium">-{formatMoney(val)}</td>
                      <td className="p-2.5 text-right text-muted-foreground">
                        {(faturamentoBruto > 0 ? (val / faturamentoBruto) * 100 : 0).toFixed(1)}%
                      </td>
                      <td className="p-2.5 text-center text-muted-foreground text-[11px]">Fixo</td>
                    </tr>
                  ))}

                  {Object.keys(custosPorCategoria).length === 0 && (
                    <tr>
                      <td className="p-2.5 pl-10 text-muted-foreground italic" colSpan={4}>
                        Nenhuma despesa fixa registrada no mês.
                      </td>
                    </tr>
                  )}

                  {/* 7. LUCRO LÍQUIDO REAL */}
                  <tr
                    className={`font-black text-base border-t-2 ${
                      lucroLiquidoReal >= 0
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                        : 'bg-red-50/80 dark:bg-red-950/40 text-red-700'
                    }`}
                  >
                    <td className="p-3.5 pl-4 flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          lucroLiquidoReal >= 0 ? 'bg-indigo-600' : 'bg-red-600'
                        }`}
                      />
                      (=) LUCRO LÍQUIDO REAL DO EXERCÍCIO (RESULTADO DA CLÍNICA)
                    </td>
                    <td
                      className={`p-3.5 text-right font-black ${
                        lucroLiquidoReal >= 0 ? 'text-indigo-600 dark:text-indigo-300' : 'text-red-600'
                      }`}
                    >
                      {formatMoney(lucroLiquidoReal)}
                    </td>
                    <td className="p-3.5 text-right font-black">{margemLiquidaPerc.toFixed(1)}%</td>
                    <td className="p-3.5 text-center">
                      <Badge
                        className={`${
                          lucroLiquidoReal >= 0 ? 'bg-indigo-600' : 'bg-red-600'
                        } text-white text-xs`}
                      >
                        {lucroLiquidoReal >= 0 ? 'Lucro' : 'Prejuízo'}
                      </Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SEÇÃO DE CONFERÊNCIA: DETALHAMENTO DE FATURAMENTO POR PACIENTE */}
      <Card className="border border-border shadow-xs">
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-foreground">
                <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Conferência de Faturamento por Paciente
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                  {calculosDRE.listaPacientesDRE.length} paciente(s)
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Especificação individual de cada paciente e lançamentos que somam exatamente o <strong>Faturamento Bruto ({formatMoney(faturamentoBruto)})</strong> no mês.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar paciente ou procedimento..."
                  value={buscaPaciente}
                  onChange={(e) => setBuscaPaciente(e.target.value)}
                  className="h-8 pl-8 text-xs bg-muted/40"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b bg-muted/40 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
                  <th className="p-3 pl-4">Paciente</th>
                  <th className="p-3">Procedimento / Lançamento</th>
                  <th className="p-3 text-center">Forma Pagto</th>
                  <th className="p-3 text-right">Taxas Retidas</th>
                  <th className="p-3 text-right">Líquido Clínica</th>
                  <th className="p-3 text-right">Faturamento Bruto</th>
                  <th className="p-3 text-right pr-4">% Participação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {pacientesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground text-xs">
                      Nenhum recebimento encontrado para o filtro informado.
                    </td>
                  </tr>
                ) : (
                  pacientesFiltrados.map((item) => {
                    const isExpandido = Boolean(pacientesExpandidos[item.pacienteId]);
                    const temMultiplasTransacoes = item.transacoes.length > 1;

                    return (
                      <React.Fragment key={item.pacienteId}>
                        <tr 
                          onClick={() => temMultiplasTransacoes && toggleExpandirPaciente(item.pacienteId)}
                          className={`hover:bg-muted/40 transition-colors ${temMultiplasTransacoes ? 'cursor-pointer' : ''}`}
                        >
                          <td className="p-3 pl-4 font-bold text-foreground">
                            <div className="flex items-center gap-2">
                              {temMultiplasTransacoes ? (
                                <button
                                  type="button"
                                  className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-transform"
                                  title={isExpandido ? 'Recolher parcelas' : 'Ver parcelas'}
                                >
                                  {isExpandido ? (
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              ) : (
                                <User className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                              )}
                              <span>{item.pacienteNome}</span>
                              {temMultiplasTransacoes && (
                                <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
                                  {item.transacoes.length}x
                                </Badge>
                              )}
                            </div>
                          </td>

                          <td className="p-3 text-muted-foreground max-w-xs truncate" title={item.procedimentosArray.join(', ')}>
                            {item.procedimentosArray.length > 0 ? item.procedimentosArray.join(', ') : 'Tratamento odontológico'}
                          </td>

                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              {item.metodosArray.map((m: string) => renderMetodoBadge(m))}
                            </div>
                          </td>

                          <td className="p-3 text-right">
                            {item.totalTaxas > 0 ? (
                              <span className="text-rose-600 dark:text-rose-400 font-medium">
                                -{formatMoney(item.totalTaxas)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/60">-</span>
                            )}
                          </td>

                          <td className="p-3 text-right font-medium text-foreground">
                            {formatMoney(item.totalLiquido)}
                          </td>

                          <td className="p-3 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                            {formatMoney(item.totalBruto)}
                          </td>

                          <td className="p-3 text-right pr-4">
                            <div className="flex items-center justify-end gap-2">
                              <Progress value={item.percentualDoTotal} className="h-1.5 w-12 hidden sm:block" />
                              <span className="font-semibold text-muted-foreground text-[11px] tabular-nums">
                                {item.percentualDoTotal.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Linhas filhas caso tenha múltiplas parcelas ou queira ver detalhes */}
                        {isExpandido && item.transacoes.map((t: any, idx: number) => {
                          const dataStr = t.data ? new Date(t.data).toLocaleDateString('pt-BR') : '-';
                          const tVal = Number(t.valor || 0);
                          const tTaxa = Number(t.taxaCartaoValor || 0);
                          const tLiq = t.valorLiquido ? Number(t.valorLiquido) : (tVal - tTaxa);

                          return (
                            <tr key={t.id || idx} className="bg-muted/20 text-[11px] text-muted-foreground">
                              <td className="p-2 pl-10 font-normal">
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                  <Receipt className="h-3 w-3 text-muted-foreground/60" />
                                  Parcela / Lançamento #{idx + 1} • {dataStr}
                                </span>
                              </td>
                              <td className="p-2 truncate max-w-xs">{t.descricao || 'Recebimento'}</td>
                              <td className="p-2 text-center">{renderMetodoBadge(t.metodoPagamento)}</td>
                              <td className="p-2 text-right text-rose-500">
                                {tTaxa > 0 ? `-${formatMoney(tTaxa)}` : '-'}
                              </td>
                              <td className="p-2 text-right">{formatMoney(tLiq)}</td>
                              <td className="p-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                                {formatMoney(tVal)}
                              </td>
                              <td className="p-2 text-right pr-4 text-[10px] text-muted-foreground/80">
                                {(faturamentoBruto > 0 ? (tVal / faturamentoBruto) * 100 : 0).toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/50 font-bold text-foreground text-xs">
                  <td className="p-3 pl-4">
                    TOTAL CONFERÊNCIA ({pacientesFiltrados.length} pacientes)
                  </td>
                  <td className="p-3 text-muted-foreground font-normal">
                    {receitasPagas.length} recebimento(s) quitado(s) no mês
                  </td>
                  <td className="p-3 text-center">-</td>
                  <td className="p-3 text-right text-rose-600 dark:text-rose-400">
                    {totalTaxasCartao > 0 ? `-${formatMoney(totalTaxasCartao)}` : 'R$ 0,00'}
                  </td>
                  <td className="p-3 text-right">
                    {formatMoney(receitaLiquida)}
                  </td>
                  <td className="p-3 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                    {formatMoney(faturamentoBruto)}
                  </td>
                  <td className="p-3 text-right pr-4 text-emerald-600 dark:text-emerald-400 font-black">
                    100.0%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceiroDRE;
