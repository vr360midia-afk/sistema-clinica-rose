
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit2, Phone, Mail, Calendar, FileText } from 'lucide-react';

interface PatientDetailsProps {
  patient: any;
  onClose: () => void;
  onEdit: () => void;
}

const PatientDetails = ({ patient, onClose, onEdit }: PatientDetailsProps) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Detalhes do Paciente</h1>
        </div>
        <Button onClick={onEdit} className="bg-blue-600 hover:bg-blue-700">
          <Edit2 className="h-4 w-4 mr-2" />
          Editar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações Pessoais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <img
                    src={patient.foto}
                    alt={patient.nome}
                    className="h-16 w-16 rounded-full object-cover border-2 border-gray-200"
                  />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{patient.nome}</h3>
                  <p className="text-gray-600">{patient.idade} anos</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">{patient.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">{patient.telefone}</span>
                </div>
              </div>
              
              <div>
                <span className="text-sm font-medium">Convênio: </span>
                <Badge variant="outline">{patient.convenio}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico de Tratamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {patient.historico && patient.historico.map((item: string, index: number) => (
                  <div key={index} className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className={patient.status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                {patient.status}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Próximos Agendamentos</CardTitle>
            </CardHeader>
            <CardContent>
              {patient.proximaConsulta ? (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">{patient.proximaConsulta}</span>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Nenhum agendamento</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Último Tratamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-sm">{patient.ultimoTratamento}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PatientDetails;
