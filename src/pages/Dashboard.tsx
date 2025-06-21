
import React from 'react';
import Layout from '@/components/layout/Layout';
import StatsCard from '@/components/dashboard/StatsCard';
import AppointmentsList from '@/components/dashboard/AppointmentsList';
import RecentActivity from '@/components/dashboard/RecentActivity';
import { Users, Calendar, CreditCard, TrendingUp } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';

const Dashboard = () => {
  const { pacientes, consultas, transacoes } = useDentalSystem();

  // Calcular estatísticas reais
  const pacientesAtivos = pacientes.filter(p => p.status === 'Ativo').length;
  
  const today = new Date();
  const consultasHoje = consultas.filter(consulta => {
    const consultaDate = new Date(consulta.data);
    return consultaDate.toDateString() === today.toDateString();
  }).length;

  const consultasPendentes = consultas.filter(c => c.status === 'agendado').length;

  // Receita mensal atual
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const receitaMensal = transacoes
    .filter(t => {
      const transacaoDate = new Date(t.data);
      return transacaoDate.getMonth() === currentMonth && 
             transacaoDate.getFullYear() === currentYear &&
             t.tipo === 'receita';
    })
    .reduce((sum, t) => sum + t.valor, 0);

  // Taxa de ocupação (consultas realizadas vs agendadas no mês)
  const consultasMes = consultas.filter(c => {
    const consultaDate = new Date(c.data);
    return consultaDate.getMonth() === currentMonth && consultaDate.getFullYear() === currentYear;
  });
  const consultasRealizadas = consultasMes.filter(c => c.status === 'realizado').length;
  const taxaOcupacao = consultasMes.length > 0 ? Math.round((consultasRealizadas / consultasMes.length) * 100) : 0;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Visão geral da sua clínica odontológica</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Pacientes Ativos"
            value={pacientesAtivos.toString()}
            change={`${pacientes.length} total`}
            changeType="neutral"
            icon={Users}
            iconBg="bg-blue-500"
          />
          <StatsCard
            title="Consultas Hoje"
            value={consultasHoje.toString()}
            change={consultasPendentes > 0 ? `${consultasPendentes} pendentes` : 'Nenhuma pendente'}
            changeType="neutral"
            icon={Calendar}
            iconBg="bg-green-500"
          />
          <StatsCard
            title="Receita Mensal"
            value={`R$ ${receitaMensal.toFixed(2)}`}
            change="Mês atual"
            changeType="neutral"
            icon={CreditCard}
            iconBg="bg-purple-500"
          />
          <StatsCard
            title="Taxa de Ocupação"
            value={`${taxaOcupacao}%`}
            change="Mês atual"
            changeType={taxaOcupacao >= 70 ? "positive" : taxaOcupacao >= 50 ? "neutral" : "negative"}
            icon={TrendingUp}
            iconBg="bg-orange-500"
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AppointmentsList />
          <RecentActivity />
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
