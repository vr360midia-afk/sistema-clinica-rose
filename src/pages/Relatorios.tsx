
import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Download, Calendar, DollarSign, Users, FileText } from 'lucide-react';

const Relatorios = () => {
  const [periodo, setPeriodo] = useState('mes');

  const dadosFinanceiros = [
    { mes: 'Jan', receita: 15000, despesas: 5000 },
    { mes: 'Fev', receita: 18000, despesas: 6000 },
    { mes: 'Mar', receita: 22000, despesas: 7000 },
    { mes: 'Abr', receita: 19000, despesas: 5500 },
    { mes: 'Mai', receita: 25000, despesas: 8000 },
    { mes: 'Jun', receita: 28000, despesas: 9000 },
  ];

  const procedimentosMaisRealizados = [
    { name: 'Limpeza', value: 35, color: '#3B82F6' },
    { name: 'Restauração', value: 25, color: '#10B981' },
    { name: 'Extração', value: 20, color: '#F59E0B' },
    { name: 'Canal', value: 15, color: '#EF4444' },
    { name: 'Outros', value: 5, color: '#8B5CF6' },
  ];

  const agendamentosPorDia = [
    { dia: 'Seg', agendamentos: 8 },
    { dia: 'Ter', agendamentos: 12 },
    { dia: 'Qua', agendamentos: 10 },
    { dia: 'Qui', agendamentos: 15 },
    { dia: 'Sex', agendamentos: 14 },
    { dia: 'Sab', agendamentos: 6 },
  ];

  const estatisticas = [
    { titulo: 'Receita Total', valor: 'R$ 127.000', variacao: '+12%', icon: DollarSign, cor: 'text-green-600' },
    { titulo: 'Pacientes Ativos', valor: '248', variacao: '+8%', icon: Users, cor: 'text-blue-600' },
    { titulo: 'Consultas Realizadas', valor: '1.234', variacao: '+15%', icon: Calendar, cor: 'text-purple-600' },
    { titulo: 'Prontuários', valor: '189', variacao: '+5%', icon: FileText, cor: 'text-orange-600' },
  ];

  const gerarRelatorio = (tipo: string) => {
    console.log(`Gerando relatório: ${tipo}`);
    // Aqui implementaria a geração do PDF/Excel
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Relatórios e Análises</h1>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {estatisticas.map((stat, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">{stat.titulo}</p>
                    <p className="text-2xl font-bold">{stat.valor}</p>
                  </div>
                  <div className="flex flex-col items-end">
                    <stat.icon className={`h-6 w-6 ${stat.cor}`} />
                    <Badge className="mt-1 bg-green-100 text-green-800 border-green-200">
                      {stat.variacao}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                      <p className="text-sm text-gray-500">{relatorio.descricao}</p>
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
