import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Transacao, Paciente } from '@/types/shared';
import { formatMoney } from '@/utils/exportCsv';
import { motion } from 'framer-motion';

interface DashboardChartsProps {
  transacoes: Transacao[];
  pacientes: Paciente[];
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({ transacoes, pacientes }) => {
  // Generate data for the last 6 months revenue
  const today = new Date();
  const last6Months = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    return {
      month: d.toLocaleDateString('pt-BR', { month: 'short' }),
      monthIndex: d.getMonth(),
      year: d.getFullYear(),
      receita: 0,
      despesa: 0,
    };
  }).reverse();

  transacoes.forEach(t => {
    const d = new Date(t.data);
    const monthData = last6Months.find(m => m.monthIndex === d.getMonth() && m.year === d.getFullYear());
    if (monthData) {
      if (t.tipo === 'receita') monthData.receita += t.valor;
      if (t.tipo === 'despesa') monthData.despesa += t.valor;
    }
  });

  // Convert revenue data to match AreaChart format and format labels
  const revenueData = last6Months.map(d => ({
    name: d.month.charAt(0).toUpperCase() + d.month.slice(1),
    Receita: d.receita,
    Despesa: d.despesa,
  }));

  // Generate data for Patients: Ativos vs Inativos
  const ativos = pacientes.filter(p => p.status === 'Ativo').length;
  const inativos = pacientes.length - ativos;
  
  const patientsData = [
    { name: 'Pacientes', Ativos: ativos, Inativos: inativos }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="col-span-1 lg:col-span-2"
      >
        <Card className="h-full bg-card/50 backdrop-blur-sm border-border/50 shadow-sm overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader>
            <CardTitle className="text-lg font-medium">Fluxo de Caixa (Últimos 6 meses)</CardTitle>
            <CardDescription>Receitas e despesas consolidadas mês a mês.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(value) => `R$${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [formatMoney(value), '']}
                  />
                  <Area type="monotone" dataKey="Receita" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorReceita)" />
                  <Area type="monotone" dataKey="Despesa" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorDespesa)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="col-span-1"
      >
        <Card className="h-full bg-card/50 backdrop-blur-sm border-border/50 shadow-sm overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader>
            <CardTitle className="text-lg font-medium">Status dos Pacientes</CardTitle>
            <CardDescription>Visão geral da base de clientes.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col justify-center h-[calc(100%-5rem)]">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={patientsData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }} barSize={80}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{fill: 'hsl(var(--muted)/0.5)'}}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="Ativos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Inativos" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default DashboardCharts;
