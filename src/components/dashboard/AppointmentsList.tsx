
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, Phone, Check, CalendarClock, X, Play } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const AppointmentsList = () => {
  const navigate = useNavigate();
  const { consultas, pacientes, updateConsulta } = useDentalSystem();

  const handleConfirmar = async (id: string) => {
    try {
      await updateConsulta(id, { status: 'confirmado', confirmacaoStatus: 'confirmado', confirmadoEm: new Date() });
      toast.success('Consulta confirmada com sucesso!');
    } catch {
      toast.error('Erro ao confirmar consulta');
    }
  };

  const handleCancelar = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja cancelar esta consulta?')) return;
    try {
      await updateConsulta(id, { status: 'cancelado' });
      toast.success('Consulta cancelada');
    } catch {
      toast.error('Erro ao cancelar consulta');
    }
  };

  // Filtrar consultas de hoje
  const today = new Date();
  const todayConsultas = consultas.filter(consulta => {
    const consultaDate = new Date(consulta.data);
    return consultaDate.toDateString() === today.toDateString();
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmado':
        return 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400';
      case 'agendado':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400';
      case 'realizado':
        return 'bg-muted text-foreground';
      case 'cancelado':
        return 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400';
      case 'faltou':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-400';
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
              <div key={consulta.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 border rounded-lg hover:bg-muted gap-3">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground truncate">
                        {getPacienteName(consulta.pacienteId)}
                      </p>
                      <Badge className={getStatusColor(consulta.status)}>
                        {getStatusLabel(consulta.status)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4 mt-1 flex-wrap text-xs sm:text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {consulta.hora}
                      </div>
                      <div className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {getPacientePhone(consulta.pacienteId)}
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">{consulta.procedimento}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  {consulta.status === 'agendado' && (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-500/30"
                        onClick={() => handleConfirmar(consulta.id)}
                        title="Confirmar Consulta"
                        aria-label="Confirmar Consulta"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 border-blue-500/30"
                        onClick={() => navigate('/agenda')}
                        title="Reagendar Consulta"
                        aria-label="Reagendar Consulta"
                      >
                        <CalendarClock className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-500/30"
                        onClick={() => handleCancelar(consulta.id)}
                        title="Cancelar Consulta"
                        aria-label="Cancelar Consulta"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {consulta.status === 'confirmado' && (
                    <>
                      <Button
                        size="icon"
                        className="h-8 w-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                        onClick={() => {
                          const id = consulta.pacienteId || (consulta as any).paciente_id;
                          if (!id) {
                            alert('Erro: ID do paciente ausente.');
                            return;
                          }
                          navigate("/pacientes?id=" + id);
                        }}
                        title="Iniciar Atendimento"
                        aria-label="Iniciar Atendimento"
                      >
                        <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 border-blue-500/30"
                        onClick={() => navigate('/agenda')}
                        title="Reagendar Consulta"
                        aria-label="Reagendar Consulta"
                      >
                        <CalendarClock className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-500/30"
                        onClick={() => handleCancelar(consulta.id)}
                        title="Cancelar Consulta"
                        aria-label="Cancelar Consulta"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {consulta.status === 'cancelado' && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 border-blue-500/30"
                      onClick={() => navigate('/agenda')}
                      title="Reagendar Consulta"
                      aria-label="Reagendar Consulta"
                    >
                      <CalendarClock className="h-4 w-4" />
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



