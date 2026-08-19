
import React, { useState, useMemo } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Download, Calendar, DollarSign, Users, FileText } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { downloadCSV, formatMoney } from '@/utils/exportCsv';
import { toast } from 'sonner';
import { supabaseService } from '@/services/supabaseService';

const Relatorios = () => {
  const { pacientes, consultas, transacoes, prontuarios } = useDentalSystem();
  const [periodo, setPeriodo] = useState('mes');

  // Calcular dados financeiros baseados nos dados reais
  const dadosFinanceiros = useMemo(() => {
    const hoje = new Date();
    const meses = [];
    
    for (let i = 5; i >= 0; i--) {
      const mes = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const mesNome = mes.toLocaleDateString('pt-BR', { month: 'short' });
      
      const receitaMes = transacoes
        .filter(t => {
          const tData = new Date(t.data);
          return tData.getMonth() === mes.getMonth() && 
                 tData.getFullYear() === mes.getFullYear() &&
                 t.tipo === 'receita' && t.status === 'pago';
        })
        .reduce((sum, t) => sum + t.valor, 0);

      const despesasMes = transacoes
        .filter(t => {
          const tData = new Date(t.data);
          return tData.getMonth() === mes.getMonth() && 
                 tData.getFullYear() === mes.getFullYear() &&
                 t.tipo === 'despesa' && t.status === 'pago';
        })
        .reduce((sum, t) => sum + t.valor, 0);

      meses.push({
        mes: mesNome,
        receita: receitaMes,
        despesas: despesasMes
      });
    }
    
    return meses;
  }, [transacoes]);

  // Calcular procedimentos mais realizados
  const procedimentosMaisRealizados = useMemo(() => {
    const procedimentos: { [key: string]: number } = {};
    
    consultas
      .filter(c => c.status === 'realizado')
      .forEach(c => {
        procedimentos[c.procedimento] = (procedimentos[c.procedimento] || 0) + 1;
      });

    const procedimentosArray = Object.entries(procedimentos)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const cores = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
    
    return procedimentosArray.map((proc, index) => ({
      ...proc,
      color: cores[index] || '#6B7280'
    }));
  }, [consultas]);

  // Calcular agendamentos por dia da semana
  const agendamentosPorDia = useMemo(() => {
    const dias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
    const agendamentos = Array(7).fill(0);

    consultas.forEach(c => {
      const data = new Date(c.data);
      const diaSemana = data.getDay();
      agendamentos[diaSemana === 0 ? 6 : diaSemana - 1]++;
    });

    return dias.map((dia, index) => ({
      dia,
      agendamentos: agendamentos[index]
    }));
  }, [consultas]);

  // Calcular estatísticas gerais
  const estatisticas = useMemo(() => {
    const receitaTotal = transacoes
      .filter(t => t.tipo === 'receita' && t.status === 'pago')
      .reduce((sum, t) => sum + t.valor, 0);

    const pacientesAtivos = pacientes.filter(p => p.status === 'Ativo').length;
    const consultasRealizadas = consultas.filter(c => c.status === 'realizado').length;
    const totalProntuarios = prontuarios.length;

    return [
      { 
        titulo: 'Receita Total', 
        valor: `R$ ${receitaTotal.toFixed(2)}`, 
        variacao: '+0%', 
        icon: DollarSign, 
        cor: 'text-green-600' 
      },
      { 
        titulo: 'Pacientes Ativos', 
        valor: pacientesAtivos.toString(), 
        variacao: '+0%', 
        icon: Users, 
        cor: 'text-blue-600' 
      },
      { 
        titulo: 'Consultas Realizadas', 
        valor: consultasRealizadas.toString(), 
        variacao: '+0%', 
        icon: Calendar, 
        cor: 'text-purple-600' 
      },
      { 
        titulo: 'Prontuários', 
        valor: totalProntuarios.toString(), 
        variacao: '+0%', 
        icon: FileText, 
        cor: 'text-orange-600' 
      },
    ];
  }, [transacoes, pacientes, consultas, prontuarios]);

  // Faturamento detalhado: por dentista, procedimento e forma de pagamento (bruto x líquido)
  const faturamento = useMemo(() => {
    const receitas = transacoes.filter((t) => t.tipo === 'receita' && t.status === 'pago');
    const liquidoDe = (t: any) => (t.valorLiquido ?? t.valor) || 0;

    const porMetodo = Object.values(
      receitas.reduce((acc: any, t: any) => {
        const key = t.metodoPagamento || 'não informado';
        acc[key] = acc[key] || { chave: key, bruto: 0, liquido: 0, qtd: 0 };
        acc[key].bruto += t.valor || 0;
        acc[key].liquido += liquidoDe(t);
        acc[key].qtd += 1;
        return acc;
      }, {})
    ) as any[];

    const consultasRealizadas = consultas.filter((c) => c.status === 'realizado');
    const agrupar = (campo: 'dentista' | 'procedimento') =>
      Object.values(
        consultasRealizadas.reduce((acc: any, c: any) => {
          const key = c[campo] || 'não informado';
          acc[key] = acc[key] || { chave: key, qtd: 0, bruto: 0 };
          acc[key].qtd += 1;
          acc[key].bruto += c.valor || 0;
          return acc;
        }, {})
      ).sort((a: any, b: any) => b.bruto - a.bruto) as any[];

    const totalBruto = receitas.reduce((s, t: any) => s + (t.valor || 0), 0);
    const totalLiquido = receitas.reduce((s, t: any) => s + liquidoDe(t), 0);

    return {
      porMetodo: porMetodo.sort((a, b) => b.bruto - a.bruto),
      porDentista: agrupar('dentista'),
      porProcedimento: agrupar('procedimento'),
      totalBruto,
      totalLiquido,
      totalTaxas: totalBruto - totalLiquido,
    };
  }, [transacoes, consultas]);

  const gerarRelatorio = async (tipo: string) => {
    const hoje = new Date().toISOString().slice(0, 10);
    try {
      switch (tipo) {
        case 'Relatório Financeiro Completo':
          downloadCSV(
            `financeiro-${hoje}`,
            ['Data', 'Tipo', 'Descrição', 'Paciente', 'Categoria', 'Método', 'Parcelas', 'Valor bruto', 'Taxa cartão', 'Valor líquido', 'Status'],
            transacoes.map((t: any) => [
              new Date(t.data),
              t.tipo,
              t.descricao,
              t.pacienteNome || pacientes.find((p) => p.id === t.pacienteId)?.nome || '',
              t.categoria,
              t.metodoPagamento,
              t.parcelas ?? 1,
              t.valor,
              t.taxaCartaoValor ?? 0,
              t.valorLiquido ?? t.valor,
              t.status,
            ])
          );
          break;
        case 'Relatório de Pacientes':
          downloadCSV(
            `pacientes-${hoje}`,
            ['Nome', 'Telefone', 'E-mail', 'Idade', 'CPF', 'Convênio', 'Origem', 'Status', 'Última consulta', 'Próxima consulta'],
            pacientes.map((p: any) => [
              p.nome, p.telefone, p.email, p.idade, p.cpf, p.convenio, p.origemLead, p.status,
              p.ultimaConsulta ? new Date(p.ultimaConsulta) : '',
              p.proximaConsulta ? new Date(p.proximaConsulta) : '',
            ])
          );
          break;
        case 'Relatório de Produtividade':
          downloadCSV(
            `produtividade-${hoje}`,
            ['Dentista', 'Consultas realizadas', 'Faturamento'],
            faturamento.porDentista.map((d: any) => [d.chave, d.qtd, d.bruto])
          );
          break;
        case 'Relatório de Agendamentos':
          downloadCSV(
            `agendamentos-${hoje}`,
            ['Data', 'Hora', 'Paciente', 'Dentista', 'Procedimento', 'Duração (min)', 'Status', 'Confirmação', 'Valor'],
            consultas.map((c: any) => [
              new Date(c.data), c.hora,
              c.pacienteNome || pacientes.find((p) => p.id === c.pacienteId)?.nome || '',
              c.dentista, c.procedimento, c.duracao, c.status, c.confirmacaoStatus || 'pendente', c.valor ?? 0,
            ])
          );
          break;
        case 'Relatório de Estoque': {
          const produtos = await supabaseService.getProdutos();
          downloadCSV(
            `estoque-${hoje}`,
            ['Produto', 'Categoria', 'Quantidade', 'Mínimo', 'Preço'],
            produtos.map((p: any) => [p.nome, p.categoria, p.quantidade, p.minimo, p.preco])
          );
          break;
        }
        default:
          return;
      }
      toast.success('Relatório exportado em CSV');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível gerar o relatório');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Relatórios e Análises</h1>
          </div>
          <div className="flex gap-2">
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semana">Esta Semana</SelectItem>
                <SelectItem value="mes">Este Mês</SelectItem>
                <SelectItem value="trimestre">Trimestre</SelectItem>
                <SelectItem value="ano">Este Ano</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => gerarRelatorio('completo')} className="bg-blue-600 hover:bg-blue-700">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Estatísticas Gerais */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {estatisticas.map((stat, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.titulo}</p>
                    <p className="text-xl sm:text-2xl font-bold">{stat.valor}</p>
                  </div>
                  <div className="flex flex-col items-end">
                    <stat.icon className={`h-6 w-6 ${stat.cor}`} />
                    <Badge className="mt-1 bg-muted text-foreground border-border">
                      {stat.variacao}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Gráfico Financeiro */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Financeira</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dadosFinanceiros}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`R$ ${value}`, '']} />
                  <Bar dataKey="receita" fill="#3B82F6" name="Receita" />
                  <Bar dataKey="despesas" fill="#EF4444" name="Despesas" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gráfico de Procedimentos */}
          <Card>
            <CardHeader>
              <CardTitle>Procedimentos Mais Realizados</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                {procedimentosMaisRealizados.length > 0 ? (
                  <PieChart>
                    <Pie
                      data={procedimentosMaisRealizados}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {procedimentosMaisRealizados.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Nenhum procedimento realizado
                  </div>
                )}
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Gráfico de Agendamentos */}
          <Card>
            <CardHeader>
              <CardTitle>Agendamentos por Dia da Semana</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={agendamentosPorDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="agendamentos" stroke="#10B981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Relatórios Disponíveis */}
          <Card>
            <CardHeader>
              <CardTitle>Relatórios Disponíveis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { nome: 'Relatório Financeiro Completo', descricao: 'Receitas, despesas e fluxo de caixa' },
                  { nome: 'Relatório de Pacientes', descricao: 'Lista completa com histórico' },
                  { nome: 'Relatório de Produtividade', descricao: 'Procedimentos realizados por período' },
                  { nome: 'Relatório de Agendamentos', descricao: 'Consultas marcadas e realizadas' },
                  { nome: 'Relatório de Estoque', descricao: 'Movimentação e status atual' },
                ].map((relatorio, index) => (
                  <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{relatorio.nome}</h4>
                      <p className="text-sm text-muted-foreground">{relatorio.descricao}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => gerarRelatorio(relatorio.nome)}>
                      <Download className="h-4 w-4 mr-2" />
                      Gerar
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Relatorios;
