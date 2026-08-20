
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
import { useOrcamentos } from '@/hooks/useOrcamentos';

const Relatorios = () => {
  const { pacientes, consultas, transacoes, prontuarios } = useDentalSystem();
  const { orcamentos } = useOrcamentos();
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

  // Indicadores: conversão de orçamento, faltas por período, ticket médio por dentista/parceiro
  const indicadores = useMemo(() => {
    const hoje = new Date();
    const inicio = new Date(hoje);
    if (periodo === 'semana') inicio.setDate(hoje.getDate() - 7);
    else if (periodo === 'mes') inicio.setMonth(hoje.getMonth() - 1);
    else if (periodo === 'trimestre') inicio.setMonth(hoje.getMonth() - 3);
    else inicio.setFullYear(hoje.getFullYear() - 1);

    const noPeriodo = (d: any) => {
      const data = new Date(d);
      return !isNaN(data.getTime()) && data >= inicio && data <= hoje;
    };

    // Conversão de orçamento
    const orcPeriodo = orcamentos.filter((o) => noPeriodo(o.criadoEm));
    const enviados = orcPeriodo.filter((o) => o.status !== 'rascunho');
    const aprovados = orcPeriodo.filter((o) => o.status === 'aprovado');
    const recusados = orcPeriodo.filter((o) => o.status === 'recusado');
    const taxaConversao = enviados.length ? (aprovados.length / enviados.length) * 100 : 0;
    const valorAprovado = aprovados.reduce((s, o) => s + (o.total || 0), 0);
    const valorEmAberto = orcPeriodo
      .filter((o) => o.status === 'enviado')
      .reduce((s, o) => s + (o.total || 0), 0);

    // Faltas por período
    const consultasPeriodo = consultas.filter((c: any) => noPeriodo(c.data));
    const faltas = consultasPeriodo.filter((c: any) => c.status === 'faltou');
    const cancelamentos = consultasPeriodo.filter((c: any) => c.status === 'cancelado');
    const taxaFalta = consultasPeriodo.length ? (faltas.length / consultasPeriodo.length) * 100 : 0;
    const faltasPorDentista = Object.values(
      faltas.reduce((acc: any, c: any) => {
        const key = c.dentista || 'não informado';
        acc[key] = acc[key] || { chave: key, qtd: 0 };
        acc[key].qtd += 1;
        return acc;
      }, {})
    ).sort((a: any, b: any) => b.qtd - a.qtd) as any[];

    // Ticket médio por dentista (consultas realizadas com valor) e por parceiro (receitas)
    const realizadas = consultasPeriodo.filter((c: any) => c.status === 'realizado');
    const ticketDentista = Object.values(
      realizadas.reduce((acc: any, c: any) => {
        const key = c.dentista || 'não informado';
        acc[key] = acc[key] || { chave: key, qtd: 0, total: 0 };
        acc[key].qtd += 1;
        acc[key].total += c.valor || 0;
        return acc;
      }, {})
    )
      .map((d: any) => ({ ...d, ticket: d.qtd ? d.total / d.qtd : 0 }))
      .sort((a: any, b: any) => b.ticket - a.ticket) as any[];

    const receitasPeriodo = transacoes.filter(
      (t: any) => t.tipo === 'receita' && noPeriodo(t.data) && t.parceiroNome
    );
    const ticketParceiro = Object.values(
      receitasPeriodo.reduce((acc: any, t: any) => {
        const key = t.parceiroNome;
        acc[key] = acc[key] || { chave: key, qtd: 0, total: 0, repasse: 0 };
        acc[key].qtd += 1;
        acc[key].total += t.valor || 0;
        acc[key].repasse += t.valorParceiro || 0;
        return acc;
      }, {})
    )
      .map((d: any) => ({ ...d, ticket: d.qtd ? d.total / d.qtd : 0 }))
      .sort((a: any, b: any) => b.total - a.total) as any[];

    return {
      taxaConversao,
      totalOrcamentos: orcPeriodo.length,
      enviados: enviados.length,
      aprovados: aprovados.length,
      recusados: recusados.length,
      valorAprovado,
      valorEmAberto,
      faltas: faltas.length,
      cancelamentos: cancelamentos.length,
      taxaFalta,
      faltasPorDentista,
      ticketDentista,
      ticketParceiro,
    };
  }, [orcamentos, consultas, transacoes, periodo]);


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

        {/* Indicadores avançados */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Conversão de orçamentos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-3xl font-bold text-green-600">
                {indicadores.taxaConversao.toFixed(1)}%
              </p>
              <p className="text-sm text-muted-foreground">
                {indicadores.aprovados} aprovados de {indicadores.enviados} enviados
                {indicadores.recusados > 0 && ` · ${indicadores.recusados} recusados`}
              </p>
              <div className="text-sm pt-2 border-t border-border space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor aprovado</span>
                  <span className="font-medium">R$ {indicadores.valorAprovado.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Em aberto</span>
                  <span className="font-medium">R$ {indicadores.valorEmAberto.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Faltas no período</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-3xl font-bold text-red-500">{indicadores.taxaFalta.toFixed(1)}%</p>
              <p className="text-sm text-muted-foreground">
                {indicadores.faltas} faltas · {indicadores.cancelamentos} cancelamentos
              </p>
              <div className="text-sm pt-2 border-t border-border space-y-1">
                {indicadores.faltasPorDentista.length === 0 && (
                  <p className="text-muted-foreground">Nenhuma falta registrada.</p>
                )}
                {indicadores.faltasPorDentista.slice(0, 4).map((d: any) => (
                  <div key={d.chave} className="flex justify-between">
                    <span className="text-muted-foreground truncate">{d.chave}</span>
                    <span className="font-medium">{d.qtd}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ticket médio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-1">Por dentista</p>
                {indicadores.ticketDentista.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sem consultas realizadas.</p>
                )}
                {indicadores.ticketDentista.slice(0, 4).map((d: any) => (
                  <div key={d.chave} className="flex justify-between text-sm">
                    <span className="text-muted-foreground truncate">{d.chave} ({d.qtd})</span>
                    <span className="font-medium">R$ {d.ticket.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-border">
                <p className="text-xs uppercase text-muted-foreground mb-1">Por parceiro</p>
                {indicadores.ticketParceiro.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sem receitas com parceiros.</p>
                )}
                {indicadores.ticketParceiro.slice(0, 4).map((d: any) => (
                  <div key={d.chave} className="flex justify-between text-sm">
                    <span className="text-muted-foreground truncate">{d.chave} ({d.qtd})</span>
                    <span className="font-medium">R$ {d.ticket.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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

          {/* Faturamento detalhado */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Faturamento (bruto x líquido)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-sm text-muted-foreground">Bruto recebido</p>
                  <p className="text-lg font-semibold">{formatMoney(faturamento.totalBruto)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-sm text-muted-foreground">Taxas / descontos</p>
                  <p className="text-lg font-semibold text-red-500">-{formatMoney(faturamento.totalTaxas)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-sm text-muted-foreground">Líquido</p>
                  <p className="text-lg font-semibold text-green-600">{formatMoney(faturamento.totalLiquido)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Por forma de pagamento</h4>
                  <div className="space-y-2">
                    {faturamento.porMetodo.length === 0 && (
                      <p className="text-sm text-muted-foreground">Sem recebimentos registrados.</p>
                    )}
                    {faturamento.porMetodo.map((m: any) => (
                      <div key={m.chave} className="flex items-center justify-between text-sm border rounded-md p-2">
                        <span className="capitalize">{m.chave}</span>
                        <span className="text-right">
                          {formatMoney(m.bruto)}
                          <span className="block text-xs text-muted-foreground">líq. {formatMoney(m.liquido)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Por dentista</h4>
                  <div className="space-y-2">
                    {faturamento.porDentista.length === 0 && (
                      <p className="text-sm text-muted-foreground">Sem consultas realizadas.</p>
                    )}
                    {faturamento.porDentista.map((d: any) => (
                      <div key={d.chave} className="flex items-center justify-between text-sm border rounded-md p-2">
                        <span>{d.chave}</span>
                        <span className="text-right">
                          {formatMoney(d.bruto)}
                          <span className="block text-xs text-muted-foreground">{d.qtd} consultas</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Por procedimento</h4>
                  <div className="space-y-2">
                    {faturamento.porProcedimento.length === 0 && (
                      <p className="text-sm text-muted-foreground">Sem consultas realizadas.</p>
                    )}
                    {faturamento.porProcedimento.slice(0, 8).map((p: any) => (
                      <div key={p.chave} className="flex items-center justify-between text-sm border rounded-md p-2">
                        <span>{p.chave}</span>
                        <span className="text-right">
                          {formatMoney(p.bruto)}
                          <span className="block text-xs text-muted-foreground">{p.qtd}x</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
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
