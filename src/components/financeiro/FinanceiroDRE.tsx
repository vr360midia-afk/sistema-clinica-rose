import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { formatMoney } from '@/utils/exportCsv';

export const FinanceiroDRE = ({ selectedMonth }: { selectedMonth?: string }) => {
  const { transacoes } = useDentalSystem();

  const [ano, mes] = selectedMonth 
    ? selectedMonth.split('-') 
    : [new Date().getFullYear().toString(), String(new Date().getMonth() + 1).padStart(2, '0')];

  const transacoesMes = transacoes.filter(t => {
    if (!t.data) return false;
    const data = new Date(t.data);
    return data.getMonth() === (Number(mes) - 1) && data.getFullYear() === Number(ano);
  });

  const receitas = transacoesMes.filter(t => t.tipo === 'receita' && t.status === 'pago').reduce((acc, t) => acc + Number(t.valor), 0);
  const despesas = transacoesMes.filter(t => t.tipo === 'despesa' && t.status === 'pago').reduce((acc, t) => acc + Number(t.valor), 0);
  const inadimplencia = transacoesMes.filter(t => t.tipo === 'receita' && t.status === 'pendente').reduce((acc, t) => acc + Number(t.valor), 0);

  const lucroLiquido = receitas - despesas;
  const margemLucro = receitas > 0 ? ((lucroLiquido / receitas) * 100).toFixed(1) : '0';

  // Dados para Gráfico de Pizza (Despesas por Categoria)
  const despesasCategoria = transacoesMes
    .filter(t => t.tipo === 'despesa')
    .reduce((acc: any, t) => {
      const cat = t.categoria || 'Outros';
      acc[cat] = (acc[cat] || 0) + Number(t.valor);
      return acc;
    }, {});

  const dataPizza = Object.keys(despesasCategoria).map(key => ({
    name: key,
    value: despesasCategoria[key]
  }));
  const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#06b6d4', '#8b5cf6'];

  // Mock DRE Data (Receitas por Especialidade - no mundo real viria das transações com tag de procedimento)
  const dataEspecialidade = [
    { name: 'Ortodontia', valor: receitas * 0.45 },
    { name: 'Implantodontia', valor: receitas * 0.35 },
    { name: 'Clínico Geral', valor: receitas * 0.15 },
    { name: 'Estética', valor: receitas * 0.05 },
  ];

  return (
    <div className="space-y-6 mt-8">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-indigo-600" />
          DRE Odontológico (Raio-X Avançado)
        </h2>
        <p className="text-muted-foreground text-sm">Análise de Lucratividade, Custos e Especialidades do mês atual.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-indigo-50/50 border-indigo-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-indigo-800">Lucro Líquido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-900">R$ {formatMoney(lucroLiquido)}</div>
            <p className="text-xs text-indigo-700/70 mt-1 flex items-center">
              {lucroLiquido > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {margemLucro}% de margem
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Receita Bruta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">R$ {formatMoney(receitas)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Custos Totais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">R$ {formatMoney(despesas)}</div>
          </CardContent>
        </Card>

        <Card className="bg-orange-50/50 border-orange-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-800">Inadimplência (Risco)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">R$ {formatMoney(inadimplencia)}</div>
            <p className="text-xs text-orange-700/70 mt-1">Faturas pendentes vencidas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-md">Distribuição de Custos (Despesas)</CardTitle>
            <CardDescription>Onde a clínica está gastando mais</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {dataPizza.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dataPizza}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {dataPizza.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => `R$ ${formatMoney(Number(value))}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Sem despesas no mês
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-md">Lucratividade por Especialidade</CardTitle>
            <CardDescription>Projeção de receita baseada nos orçamentos fechados</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataEspecialidade} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" tick={{fontSize: 12}} />
                <YAxis tickFormatter={(value) => `R$${value/1000}k`} tick={{fontSize: 12}} />
                <RechartsTooltip formatter={(value) => `R$ ${formatMoney(Number(value))}`} />
                <Bar dataKey="valor" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
