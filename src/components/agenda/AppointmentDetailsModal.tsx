
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { User, Clock, Phone, Calendar, FileText, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StatusConsulta } from '@/types/shared';

interface AppointmentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: {
    id: string;
    patient: string;
    time: string;
    duration: string;
    procedure: string;
    status: StatusConsulta;
    dentist: string;
    patientData?: {
      phone: string;
      age: number;
      insurance: string;
      lastVisit: string;
      allergies: string;
    };
  } | null;
  onEdit?: (appointment: any) => void;
  onDelete?: (appointmentId: string) => void;
  onStatusChange?: (appointmentId: string, newStatus: StatusConsulta) => void;
}

const AppointmentDetailsModal = ({ 
  isOpen, 
  onClose, 
  appointment, 
  onEdit, 
  onDelete, 
  onStatusChange 
}: AppointmentDetailsModalProps) => {
  if (!appointment) return null;

  const getStatusColor = (status: StatusConsulta) => {
    switch (status) {
      case 'confirmado': return 'bg-green-100 text-green-800';
      case 'agendado': return 'bg-blue-100 text-blue-800';
      case 'realizado': return 'bg-gray-100 text-gray-800';
      case 'cancelado': return 'bg-red-100 text-red-800';
      case 'faltou': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: StatusConsulta) => {
    switch (status) {
      case 'confirmado': return 'Confirmado';
      case 'agendado': return 'Agendado';
      case 'realizado': return 'Realizado';
      case 'cancelado': return 'Cancelado';
      case 'faltou': return 'Faltou';
      default: return status;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Detalhes da Consulta
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status e Ações */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Badge className={getStatusColor(appointment.status)}>
              {getStatusLabel(appointment.status)}
            </Badge>
            
            <div className="flex gap-2">
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(appointment)}
                  className="gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Editar
                </Button>
              )}
              
              {onStatusChange && appointment.status === 'agendado' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStatusChange(appointment.id, 'confirmado')}
                  className="gap-2 text-green-600 hover:text-green-700"
                >
                  <CheckCircle className="h-4 w-4" />
                  Confirmar
                </Button>
              )}
              
              {onStatusChange && appointment.status !== 'cancelado' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStatusChange(appointment.id, 'cancelado')}
                  className="gap-2 text-red-600 hover:text-red-700"
                >
                  <XCircle className="h-4 w-4" />
                  Cancelar
                </Button>
              )}
            </div>
          </div>

          {/* Informações da Consulta */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Informações da Consulta
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">Horário</p>
                    <p className="font-medium">{appointment.time}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">Duração</p>
                    <p className="font-medium">{appointment.duration}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">Procedimento</p>
                    <p className="font-medium">{appointment.procedure}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">Dentista</p>
                    <p className="font-medium">{appointment.dentist}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Informações do Paciente */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Informações do Paciente
              </h3>
              
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Nome</p>
                  <p className="font-medium text-lg">{appointment.patient}</p>
                </div>
                
                {appointment.patientData && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {appointment.patientData.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-500" />
                        <div>
                          <p className="text-sm text-gray-600">Telefone</p>
                          <p className="font-medium">{appointment.patientData.phone}</p>
                        </div>
                      </div>
                    )}
                    
                    {appointment.patientData.age > 0 && (
                      <div>
                        <p className="text-sm text-gray-600">Idade</p>
                        <p className="font-medium">{appointment.patientData.age} anos</p>
                      </div>
                    )}
                    
                    {appointment.patientData.insurance && (
                      <div>
                        <p className="text-sm text-gray-600">Convênio</p>
                        <p className="font-medium">{appointment.patientData.insurance}</p>
                      </div>
                    )}
                    
                    {appointment.patientData.lastVisit && (
                      <div>
                        <p className="text-sm text-gray-600">Última Visita</p>
                        <p className="font-medium">{appointment.patientData.lastVisit}</p>
                      </div>
                    )}
                    
                    {appointment.patientData.allergies && (
                      <div className="sm:col-span-2">
                        <p className="text-sm text-gray-600">Alergias</p>
                        <p className="font-medium text-red-600">{appointment.patientData.allergies}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Ações de Rodapé */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
              Fechar
            </Button>
            
            {onDelete && (
              <Button
                variant="destructive"
                onClick={() => {
                  onDelete(appointment.id);
                  onClose();
                }}
                className="w-full sm:w-auto gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Excluir Consulta
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentDetailsModal;
