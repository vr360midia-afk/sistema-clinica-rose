
import React from 'react';
import Layout from '@/components/layout/Layout';
import StatsCard from '@/components/dashboard/StatsCard';
import AppointmentsList from '@/components/dashboard/AppointmentsList';
import RecentActivity from '@/components/dashboard/RecentActivity';
import { Users, Calendar, CreditCard, TrendingUp } from 'lucide-react';

const Dashboard = () => {
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
            value="1,234"
            change="+12% este mês"
            changeType="positive"
            icon={Users}
            iconBg="bg-blue-500"
          />
          <StatsCard
            title="Consultas Hoje"
            value="18"
            change="3 pendentes"
            changeType="neutral"
            icon={Calendar}
            iconBg="bg-green-500"
          />
          <StatsCard
            title="Receita Mensal"
            value="R$ 45.230"
            change="+8% vs mês anterior"
            changeType="positive"
            icon={CreditCard}
            iconBg="bg-purple-500"
          />
          <StatsCard
            title="Taxa de Ocupação"
            value="85%"
            change="+5% esta semana"
            changeType="positive"
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
