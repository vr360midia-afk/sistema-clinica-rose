
import React from 'react';
import Layout from '@/components/layout/Layout';
import StatsCard from '@/components/dashboard/StatsCard';
import ConfirmacoesPendentes from '@/components/dashboard/ConfirmacoesPendentes';
import AppointmentsList from '@/components/dashboard/AppointmentsList';
import { RetornosPendentes } from '@/components/dashboard/RetornosPendentes';
import RecentActivity from '@/components/dashboard/RecentActivity';
import LembretesWhatsApp from '@/components/dashboard/LembretesWhatsApp';
import LembretesPix from '@/components/dashboard/LembretesPix';
import DashboardCharts from '@/components/dashboard/DashboardCharts';
import { Users, Calendar, CreditCard } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { useAuth } from '@/context/AuthContext';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { formatMoney } from '@/utils/exportCsv';
import { motion } from 'framer-motion';

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
  const consultasHojeList = consultas.filter(consulta => {
    const consultaDate = new Date(consulta.data);
    return consultaDate.toDateString() === today.toDateString();
  });
  const consultasHoje = consultasHojeList.length;

  const consultasPendentes = consultasHojeList.filter(c => c.status === 'agendado').length;
  const consultasCanceladas = consultasHojeList.filter(c => c.status === 'cancelado').length;
  const consultasFaltou = consultasHojeList.filter(c => c.status === 'faltou').length;
  const consultasRemarcadas = consultasHojeList.filter(c => c.status === 'remarcado').length;

  // Receita mensal atual (Transações pagas)
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const receitaMensal = transacoes
    .filter(t => {
      const transacaoDate = new Date(t.data);
      return transacaoDate.getMonth() === currentMonth && 
             transacaoDate.getFullYear() === currentYear &&
             t.tipo === 'receita' && t.status === 'pago';
    })
    .reduce((sum, t) => sum + t.valor, 0);

  const { orcamentos } = useOrcamentos();
  
  // Orçamentos Fechados (Vendas)
  const vendasMes = orcamentos
    .filter(o => {
      if (o.status?.toLowerCase() !== 'aprovado') return false;
      const data = new Date(o.atualizadoEm || o.criadoEm);
      return data.getMonth() === currentMonth && data.getFullYear() === currentYear;
    })
    .reduce((sum, o) => sum + Number(o.total || 0), 0);


  return (
    <Layout>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mb-1">
            {(() => {
              const hora = today.getHours();
              const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
              const nome = (user.user_metadata as any)?.nome?.split(' ')[0];
              return nome ? `${saudacao}, ${nome}` : `${saudacao}!`;
            })()}
          </h1>
          <p className="text-sm text-muted-foreground capitalize">
            {today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' · '}Seus dados estão sincronizados na nuvem.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, staggerChildren: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4"
        >
          <StatsCard
            title="Pacientes Ativos"
            value={pacientesAtivos.toString()}
            change={`${pacientes.length} total`}
            changeType="neutral"
            icon={Users}
            iconBg="bg-blue-500/15 text-blue-400"
          />
          <StatsCard
            title="Vendas (Fechados)"
            value={`${formatMoney(vendasMes)}`}
            change="Mês atual"
            changeType="neutral"
            icon={CreditCard}
            iconBg="bg-amber-500/15 text-amber-500"
          />
          <StatsCard
            title="Consultas Hoje"
            value={consultasHoje.toString()}
            change={
              <div className="flex flex-col gap-0.5 mt-1">
                {consultasPendentes > 0 && <span>{consultasPendentes} pendentes</span>}
                {consultasCanceladas > 0 && <span className="text-red-500">{consultasCanceladas} cancelada(s)</span>}
                {consultasFaltou > 0 && <span className="text-red-500">{consultasFaltou} faltou</span>}
                {consultasRemarcadas > 0 && <span className="text-orange-500">{consultasRemarcadas} reagendada(s)</span>}
                {consultasHoje === 0 && <span>Nenhuma consulta hoje</span>}
              </div>
            }
            changeType="neutral"
            icon={Calendar}
            iconBg="bg-green-500/15 text-green-400"
          />
          <StatsCard
            title="Receita (Caixa)"
            value={`${formatMoney(receitaMensal)}`}
            change="Mês atual"
            changeType="neutral"
            icon={CreditCard}
            iconBg="bg-purple-500/15 text-purple-400"
          />
        </motion.div>

        {/* Dashboard Charts */}
        <DashboardCharts transacoes={transacoes} pacientes={pacientes} />

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="lg:col-span-2">
            <LembretesPix />
          </div>
          <AppointmentsList />
          <LembretesWhatsApp />
          <ConfirmacoesPendentes />
          <RetornosPendentes />
          <RecentActivity />
        </div>
      </motion.div>
    </Layout>
  );
};

export default Dashboard;
