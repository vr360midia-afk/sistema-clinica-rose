
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Activity, 
  DollarSign, 
  Clock, 
  TrendingUp,
  Users,
  Package
} from 'lucide-react';
import { Procedimento } from '@/types/procedimentos';

interface ProcedimentoStatsProps {
  procedimentos: Procedimento[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C', '#8DD1E1', '#D084D0'];

const ProcedimentoStats = ({ procedimentos }: ProcedimentoStatsProps) => {
  // Calcular estatísticas
  const totalProcedimentos = procedimentos.length;
  const procedimentosAtivos = procedimentos.filter(p => p.ativo).length;
  const precoMedio = procedimentos.reduce((acc, p) => acc + p.preco, 0) / totalProcedimentos || 0;
  const duracaoMedia = procedimentos.reduce((acc, p) => acc + p.duracaoMinutos, 0) / totalProcedimentos || 0;

  // Dados por categoria
  const dadosPorCategoria = procedimentos.reduce((acc, proc) => {
    const categoria = proc.categoria;
    if (!acc[categoria]) {
      acc[categoria] = { categoria, count: 0, valor: 0 };
    }
    acc[categoria].count++;
    acc[categoria].valor += proc.preco;
    return acc;
  }, {} as Record<string, { categoria: string; count: number; valor: number }>);

  const chartDataCategoria = Object.values(dadosPorCategoria).map(item => ({
    name: item.categoria,
    quantidade: item.count,
    valor: item.valor
  }));

  // Dados por complexidade
  const dadosPorComplexidade = procedimentos.reduce((acc, proc) => {
    const complexidade = proc.complexidade;
    if (!acc[complexidade]) {
      acc[complexidade] = 0;
    }
    acc[complexidade]++;
    return acc;
  }, {} as Record<string, number>);

  const chartDataComplexidade = Object.entries(dadosPorComplexidade).map(([name, value]) => ({
    name,
    value
  }));

  // Top 5 procedimentos mais caros
  const topProcedimentos = [...procedimentos]
    .sort((a, b) => b.preco - a.preco)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Procedimentos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProcedimentos}</div>
            <p className="text-xs text-muted-foreground">
              {procedimentosAtivos} ativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Preço Médio</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {precoMedio.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Por procedimento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duração Média</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(duracaoMedia)} min</div>
            <p className="text-xs text-muted-foreground">
              Por procedimento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Potencial</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {(precoMedio * totalProcedimentos).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Todos os procedimentos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Procedimentos por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartDataCategoria}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="quantidade" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Complexidade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartDataComplexidade}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartDataComplexidade.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top 5 procedimentos mais caros */}
      <Card>
        <CardHeader>
          <CardTitle>Top 5 Procedimentos Mais Caros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topProcedimentos.map((proc, index) => (
              <div key={proc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{proc.nome}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {proc.categoria}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {proc.duracaoMinutos} min
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">R$ {proc.preco.toFixed(2)}</p>
                  {proc.precoConvenio && (
                    <p className="text-sm text-gray-500">
                      Convênio: R$ {proc.precoConvenio.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProcedimentoStats;
