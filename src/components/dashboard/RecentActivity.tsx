
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, User, Calendar, CreditCard, FileText } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';

const RecentActivity = () => {
  const { pacientes, consultas, transacoes, prontuarios } = useDentalSystem();

  // Criar lista de atividades recentes
  const recentActivities = React.useMemo(() => {
    const activities: Array<{
      id: string;
      type: 'patient' | 'appointment' | 'transaction' | 'record';
      title: string;
      description: string;
      time: Date;
      icon: React.ReactNode;
      color: string;
    }> = [];

    // Adicionar pacientes recentes
    pacientes
      .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
      .slice(0, 3)
      .forEach(paciente => {
        activities.push({
          id: `patient-${paciente.id}`,
          type: 'patient',
          title: 'Novo paciente cadastrado',
          description: paciente.nome,
          time: new Date(paciente.criadoEm),
          icon: <User className="h-4 w-4" />,
          color: 'bg-blue-100 text-blue-600'
        });
      });

    // Adicionar consultas recentes
    consultas
      .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
      .slice(0, 3)
      .forEach(consulta => {
        const paciente = pacientes.find(p => p.id === consulta.pacienteId);
        activities.push({
          id: `appointment-${consulta.id}`,
          type: 'appointment',
          title: 'Consulta agendada',
          description: `${paciente?.nome || 'Paciente'} - ${consulta.procedimento}`,
          time: new Date(consulta.criadoEm),
          icon: <Calendar className="h-4 w-4" />,
          color: 'bg-green-100 text-green-600'
        });
      });

    // Adicionar transações recentes
    transacoes
      .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
      .slice(0, 3)
      .forEach(transacao => {
        const paciente = pacientes.find(p => p.id === transacao.pacienteId);
        activities.push({
          id: `transaction-${transacao.id}`,
          type: 'transaction',
          title: transacao.tipo === 'receita' ? 'Pagamento recebido' : 'Despesa registrada',
          description: `${paciente?.nome || 'N/A'} - R$ ${transacao.valor.toFixed(2)}`,
          time: new Date(transacao.criadoEm),
          icon: <CreditCard className="h-4 w-4" />,
          color: transacao.tipo === 'receita' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
        });
      });

    // Adicionar prontuários recentes
    prontuarios
      .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
      .slice(0, 2)
      .forEach(prontuario => {
        const paciente = pacientes.find(p => p.id === prontuario.pacienteId);
        activities.push({
          id: `record-${prontuario.id}`,
          type: 'record',
          title: 'Prontuário atualizado',
          description: `${paciente?.nome || 'Paciente'} - ${prontuario.queixaPrincipal.slice(0, 50)}...`,
          time: new Date(prontuario.criadoEm),
          icon: <FileText className="h-4 w-4" />,
          color: 'bg-purple-100 text-purple-600'
        });
      });

    // Ordenar por data mais recente e limitar a 10 itens
    return activities
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 10);
  }, [pacientes, consultas, transacoes, prontuarios]);

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Agora';
    if (diffInMinutes < 60) return `${diffInMinutes}min atrás`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h atrás`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d atrás`;
    
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Atividade Recente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentActivities.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma atividade recente</p>
            </div>
          ) : (
            recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className={`flex-shrink-0 p-2 rounded-full ${activity.color}`}>
                  {activity.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{activity.title}</p>
                  <p className="text-sm text-muted-foreground truncate">{activity.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatTimeAgo(activity.time)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentActivity;
