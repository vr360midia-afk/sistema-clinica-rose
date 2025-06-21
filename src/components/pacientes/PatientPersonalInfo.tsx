
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, Calendar, FileText } from 'lucide-react';

interface PatientPersonalInfoProps {
  patient: any;
}

const PatientPersonalInfo = ({ patient }: PatientPersonalInfoProps) => {
  return (
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
                  src={patient.foto || '/placeholder.svg'}
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
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium">CPF: </span>
                <span className="text-sm">{patient.cpf || 'Não informado'}</span>
              </div>
              <div>
                <span className="text-sm font-medium">RG: </span>
                <span className="text-sm">{patient.rg || 'Não informado'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium">Profissão: </span>
                <span className="text-sm">{patient.profissao || 'Não informado'}</span>
              </div>
              <div>
                <span className="text-sm font-medium">Estado Civil: </span>
                <span className="text-sm">{patient.estadoCivil || 'Não informado'}</span>
              </div>
            </div>

            <div>
              <span className="text-sm font-medium">Endereço: </span>
              <span className="text-sm">{patient.endereco || 'Não informado'}</span>
            </div>
            
            <div>
              <span className="text-sm font-medium">Convênio: </span>
              <Badge variant="outline">{patient.convenio}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico Médico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {patient.historicoMedico && (
              <div>
                <span className="text-sm font-medium">Histórico: </span>
                <p className="text-sm text-gray-600 mt-1">{patient.historicoMedico}</p>
              </div>
            )}
            
            {patient.alergias && (
              <div>
                <span className="text-sm font-medium">Alergias: </span>
                <p className="text-sm text-gray-600 mt-1">{patient.alergias}</p>
              </div>
            )}
            
            {patient.medicamentos && (
              <div>
                <span className="text-sm font-medium">Medicamentos: </span>
                <p className="text-sm text-gray-600 mt-1">{patient.medicamentos}</p>
              </div>
            )}

            {patient.observacoes && (
              <div>
                <span className="text-sm font-medium">Observações: </span>
                <p className="text-sm text-gray-600 mt-1">{patient.observacoes}</p>
              </div>
            )}
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
                <span className="text-sm">{new Date(patient.proximaConsulta).toLocaleDateString('pt-BR')}</span>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Nenhum agendamento</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Última Consulta</CardTitle>
          </CardHeader>
          <CardContent>
            {patient.ultimaConsulta ? (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-sm">{new Date(patient.ultimaConsulta).toLocaleDateString('pt-BR')}</span>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Nenhuma consulta anterior</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PatientPersonalInfo;
