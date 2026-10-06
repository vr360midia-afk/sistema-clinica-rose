
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, Phone } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { useNavigate } from 'react-router-dom';

const AppointmentsList = () => {
  const navigate = useNavigate();
  const { consultas, pacientes } = useDentalSystem();

  // Filtrar consultas de hoje
  const today = new Date();
  const todayConsultas = consultas.filter(consulta => {
    const consultaDate = new Date(consulta.data);
    return consultaDate.toDateString() === today.toDateString();
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmado':
        return 'bg-green-100 text-green-800';
      case 'agendado':
        return 'bg-blue-100 text-blue-800';
      case 'realizado':
        return 'bg-muted text-foreground';
      case 'cancelado':
        return 'bg-red-100 text-red-800';
      case 'faltou':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmado':
        return 'Confirmado';
      case 'agendado':
        return 'Agendado';
      case 'realizado':
        return 'Realizado';
      case 'cancelado':
        return 'Cancelado';
      case 'faltou':
        return 'Faltou';
      default:
        return status;
    }
  };

  const getPacienteName = (pacienteId: string) => {
    const paciente = pacientes.find(p => p.id === pacienteId);
    return paciente?.nome || 'Paciente não encontrado';
  };

  const getPacientePhone = (pacienteId: string) => {
    const paciente = pacientes.find(p => p.id === pacienteId);
    return paciente?.telefone || '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Consultas de Hoje ({todayConsultas.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {todayConsultas.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma consulta agendada para hoje</p>
            </div>
          ) : (
            todayConsultas.map((consulta) => (
              <div key={consulta.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {getPacienteName(consulta.pacienteId)}
                      </p>
                      <Badge className={getStatusColor(consulta.status)}>
                        {getStatusLabel(consulta.status)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {consulta.hora}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        {getPacientePhone(consulta.pacienteId)}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{consulta.procedimento}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {consulta.status === 'agendado' && (
                    <>
                      <Button variant="outline" size="sm">
                        Confirmar
                      </Button>
                      <Button variant="outline" size="sm">
                        Reagendar
                      </Button>
                    </>
                  )}
                  {consulta.status === 'confirmado' && (
                    <Button variant="outline" size="sm" onClick={() => {
                        const id = consulta.pacienteId || (consulta as any).paciente_id;
                        if (!id) {
                          alert('Erro: ID do paciente ausente.');
                          return;
                        }
                        navigate("/pacientes?id=" + id);
                    }}>
                      Iniciar
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AppointmentsList;



