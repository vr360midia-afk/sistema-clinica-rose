
import React from 'react';
import Layout from '@/components/layout/Layout';
import StatsCard from '@/components/dashboard/StatsCard';
import ConfirmacoesPendentes from '@/components/dashboard/ConfirmacoesPendentes';
import AppointmentsList from '@/components/dashboard/AppointmentsList';
import RecentActivity from '@/components/dashboard/RecentActivity';
import LembretesWhatsApp from '@/components/dashboard/LembretesWhatsApp';
import { Users, Calendar, CreditCard } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { useAuth } from '@/context/AuthContext';
import { formatMoney } from '@/utils/exportCsv';

const Dashboard = () => {
  const { user } = useAuth();
  const { pacientes, consultas, transacoes } = useDentalSystem();

  // Só mostrar dados se o usuário estiver autenticado
  if (!user) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Dashboard</h1>
            <p className="text-muted-foreground">Faça login para acessar seus dados</p>
          </div>
        </div>
      </Layout>
    );
  }

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


  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Dashboard Odontológico</h1>
          <p className="text-muted-foreground">Bem-vindo de volta! Seus dados estão sincronizados na nuvem.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
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
            value={`${formatMoney(receitaMensal)}`}
            change="Mês atual"
            changeType="neutral"
            icon={CreditCard}
            iconBg="bg-purple-500"
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AppointmentsList />
          <LembretesWhatsApp />
          <ConfirmacoesPendentes />
          <RecentActivity />
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
