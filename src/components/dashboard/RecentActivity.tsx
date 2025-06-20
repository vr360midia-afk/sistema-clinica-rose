
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, FileText, Users, CreditCard } from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'patient' | 'payment' | 'appointment' | 'document';
  description: string;
  time: string;
  user: string;
}

const activities: ActivityItem[] = [
  {
    id: '1',
    type: 'patient',
    description: 'Novo paciente cadastrado: Maria Santos',
    time: '10 min atrás',
    user: 'Recepção'
  },
  {
    id: '2',
    type: 'payment',
    description: 'Pagamento recebido - R$ 150,00',
    time: '25 min atrás',
    user: 'Sistema'
  },
  {
    id: '3',
    type: 'appointment',
    description: 'Consulta finalizada: João Oliveira',
    time: '1h atrás',
    user: 'Dr. Carlos Lima'
  },
  {
    id: '4',
    type: 'document',
    description: 'Prontuário atualizado: Ana Costa',
    time: '2h atrás',
    user: 'Dr. Ana Silva'
  }
];

const RecentActivity = () => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'patient':
        return <Users className="h-4 w-4 text-blue-600" />;
      case 'payment':
        return <CreditCard className="h-4 w-4 text-green-600" />;
      case 'appointment':
        return <Activity className="h-4 w-4 text-purple-600" />;
      case 'document':
        return <FileText className="h-4 w-4 text-orange-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Atividades Recentes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="mt-0.5">
              {getIcon(activity.type)}
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-900 mb-1">{activity.description}</p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{activity.time}</span>
                <span>•</span>
                <span>{activity.user}</span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default RecentActivity;
