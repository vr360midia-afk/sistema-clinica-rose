import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Transacao, Paciente } from '@/types/shared';
import { formatMoney } from '@/utils/exportCsv';
import { extrairAnoMes, ehTransacaoPaga } from '@/utils/financeiroCalculos';
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
    // Apenas transações quitadas/pagas entram no Fluxo de Caixa Real
    if (!ehTransacaoPaga(t)) return;
    const am = extrairAnoMes(t.data);
    if (!am) return;
    const monthData = last6Months.find(m => m.monthIndex === am.mes && m.year === am.ano);
    if (monthData) {
      if (t.tipo === 'receita') monthData.receita += Number(t.valor || 0);
      if (t.tipo === 'despesa') monthData.despesa += Number(t.valor || 0);
    }
  });

  // Convert revenue data to match AreaChart format and format labels
  const revenueData = last6Months.map(d => ({
    name: d.month.charAt(0).toUpperCase() + d.month.slice(1),
    Receita: d.receita,
    Despesa: d.despesa,
    Líquido: d.receita - d.despesa,
  }));

  // Generate data for Patients: Ativos vs Inativos
  const ativos = pacientes.filter(p => p.status !== 'Arquivado' && p.status !== 'Inativo').length;
  const inativos = pacientes.length - ativos;
  
  const patientsData = [
    { name: 'Pacientes', Ativos: ativos, Inativos: inativos }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 min-w-0 w-full">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="col-span-1 lg:col-span-2 min-w-0 w-full overflow-hidden"
      >
        <Card className="h-full bg-card/50 backdrop-blur-sm border-border/50 shadow-sm overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
            <CardTitle className="text-base sm:text-lg font-medium">Fluxo de Caixa (Últimos 6 meses)</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Receitas, despesas e saldo líquido consolidado mês a mês.</CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0">
            <div className="h-[250px] sm:h-[300px] w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorLiquido" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false}
                    width={42}
                    tickFormatter={(value) => `R$${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [formatMoney(value), '']}
                  />
                  <Area type="monotone" dataKey="Receita" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorReceita)" />
                  <Area type="monotone" dataKey="Despesa" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorDespesa)" />
                  <Area type="monotone" dataKey="Líquido" stroke="#0ea5e9" strokeWidth={2} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorLiquido)" />
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
        className="col-span-1 min-w-0 w-full overflow-hidden"
      >
        <Card className="h-full bg-card/50 backdrop-blur-sm border-border/50 shadow-sm overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
            <CardTitle className="text-base sm:text-lg font-medium">Status dos Pacientes</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Visão geral da base de clientes.</CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0 flex flex-col justify-center">
            <div className="h-[220px] sm:h-[250px] w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={patientsData} margin={{ top: 15, right: 0, left: 0, bottom: 0 }} barSize={60}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{fill: 'hsl(var(--muted)/0.5)'}}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }} />
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
