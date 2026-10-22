
import React, { useMemo } from 'react';
import Layout from '@/components/layout/Layout';
import StatsCard from '@/components/dashboard/StatsCard';
import ConfirmacoesPendentes from '@/components/dashboard/ConfirmacoesPendentes';
import AppointmentsList from '@/components/dashboard/AppointmentsList';
import { RetornosPendentes } from '@/components/dashboard/RetornosPendentes';
import RecentActivity from '@/components/dashboard/RecentActivity';
import LembretesWhatsApp from '@/components/dashboard/LembretesWhatsApp';
import LembretesPix from '@/components/dashboard/LembretesPix';
import { TarefasHojeWidget } from '@/components/dashboard/TarefasHojeWidget';
import DashboardCharts from '@/components/dashboard/DashboardCharts';
import { Users, Calendar, CreditCard, TrendingUp, Wallet } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { useAuth } from '@/context/AuthContext';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { formatMoney } from '@/utils/exportCsv';
import { calcularResumoFinanceiroMes } from '@/utils/financeiroCalculos';
import { motion } from 'framer-motion';

const Dashboard = () => {
  const { user } = useAuth();
  const { pacientes, consultas, transacoes } = useDentalSystem();
  const { orcamentos } = useOrcamentos();

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
  const pacientesAtivos = (pacientes || []).filter(p => p && p.status !== 'Arquivado' && p.status !== 'Inativo').length;
  
  const today = new Date();
  const consultasHojeList = (consultas || []).filter(consulta => {
    if (!consulta?.data) return false;
    const consultaDate = new Date(consulta.data);
    return consultaDate.toDateString() === today.toDateString();
  });
  const consultasHoje = consultasHojeList.length;

  const consultasPendentes = consultasHojeList.filter(c => c?.status === 'agendado').length;
  const consultasCanceladas = consultasHojeList.filter(c => c?.status === 'cancelado').length;
  const consultasFaltou = consultasHojeList.filter(c => c?.status === 'faltou').length;
  const consultasRemarcadas = consultasHojeList.filter(c => c?.status === 'remarcado').length;

  // Cálculos financeiros unificados e padronizados (imunes a problemas de fuso e inconsistências)
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const resumoMes = useMemo(() => {
    return calcularResumoFinanceiroMes({
      transacoes,
      orcamentos,
      ano: currentYear,
      mes0Indexed: currentMonth,
    });
  }, [transacoes, orcamentos, currentYear, currentMonth]);

  const receitaMensal = resumoMes.receitaCaixa;
  const receitaPix = resumoMes.receitaPix;
  const totalCustosMes = resumoMes.despesasPagas;
  const financeiroLiquido = resumoMes.financeiroLiquido;
  const vendasMes = resumoMes.vendasFechadas;
  const orcamentosFechadosMes = resumoMes.orcamentosAprovadosQtd;
  const transacoesMesPagas = resumoMes.receitasPagasQtd;


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
          <p className="text-xs sm:text-sm text-muted-foreground capitalize">
            {today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' · '}Seus dados estão sincronizados na nuvem.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, staggerChildren: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 w-full min-w-0"
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
            title="Vendas (Fechados)"
            value={`${formatMoney(vendasMes)}`}
            change={`${orcamentosFechadosMes} orçamento(s) aprovado(s)`}
            changeType={vendasMes > 0 ? "positive" : "neutral"}
            icon={TrendingUp}
            iconBg="bg-amber-500/15 text-amber-500"
            isMaskable={true}
            defaultMasked={true}
            storageKey="dashboard_privacy_vendas"
          />
          <StatsCard
            title="Receita (Caixa)"
            value={`${formatMoney(receitaMensal)}`}
            change={
              transacoesMesPagas > 0
                ? `${transacoesMesPagas} quitado(s)${receitaPix > 0 ? ` · PIX: ${formatMoney(receitaPix)}` : ''}`
                : "Apenas valores quitados"
            }
            changeType={receitaMensal > 0 ? "positive" : "neutral"}
            icon={CreditCard}
            iconBg="bg-emerald-500/15 text-emerald-500 dark:text-emerald-400"
            isMaskable={true}
            defaultMasked={true}
            storageKey="dashboard_privacy_receita"
          />
          <StatsCard
            title="Financeiro Líquido"
            value={`${formatMoney(financeiroLiquido)}`}
            change={
              totalCustosMes > 0
                ? `Despesas: -${formatMoney(totalCustosMes)}`
                : "Caixa real sem despesas"
            }
            changeType={financeiroLiquido >= 0 ? "positive" : "negative"}
            icon={Wallet}
            iconBg="bg-teal-500/15 text-teal-500 dark:text-teal-400"
            isMaskable={true}
            defaultMasked={true}
            storageKey="dashboard_privacy_liquido"
          />
        </motion.div>

        {/* Dashboard Charts */}
        <DashboardCharts transacoes={transacoes} pacientes={pacientes} />

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="lg:col-span-2">
            <LembretesPix />
          </div>
          <TarefasHojeWidget />
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
