
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, Calendar, FileText } from 'lucide-react';
import { openWhatsApp } from '@/lib/whatsapp';
import { calcularIdade } from '@/utils/idade';
import { useDentalSystem } from '@/context/DentalSystemContext';


interface PatientPersonalInfoProps {
  patient: any;
}

const PatientPersonalInfo = ({ patient }: PatientPersonalInfoProps) => {
  const idade = calcularIdade(patient.dataNascimento) ?? patient.idade;
  const { consultas } = useDentalSystem();
  const proximasConsultas = consultas
    .filter((consulta) => {
      if (consulta.pacienteId !== patient.id || consulta.status === 'cancelado') return false;
      const dataHora = new Date(consulta.data);
      const [hora, minuto] = (consulta.hora || '00:00').split(':').map(Number);
      dataHora.setHours(hora || 0, minuto || 0, 0, 0);
      return dataHora.getTime() >= Date.now();
    })
    .sort((a, b) => {
      const dataA = new Date(a.data);
      const dataB = new Date(b.data);
      const [horaA, minutoA] = (a.hora || '00:00').split(':').map(Number);
      const [horaB, minutoB] = (b.hora || '00:00').split(':').map(Number);
      dataA.setHours(horaA || 0, minutoA || 0, 0, 0);
      dataB.setHours(horaB || 0, minutoB || 0, 0, 0);
      return dataA.getTime() - dataB.getTime();
    });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                  className="h-16 w-16 rounded-full object-cover border-2 border-border"
                />
              </div>
              <div>
                <h3 className="text-xl font-semibold">{patient.nome}</h3>
                <p className="text-muted-foreground">
                  {idade !== undefined && idade !== null ? `${idade} anos` : 'Idade não informada'}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{patient.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => openWhatsApp(patient.telefone, '')}
                  className="text-sm text-primary hover:underline focus:outline-none"
                  title="Abrir conversa no WhatsApp"
                >
                  {patient.telefone}
                </button>
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
                <p className="text-sm text-muted-foreground mt-1">{patient.historicoMedico}</p>
              </div>
            )}
            
            {patient.alergias && (
              <div>
                <span className="text-sm font-medium">Alergias: </span>
                <p className="text-sm text-muted-foreground mt-1">{patient.alergias}</p>
              </div>
            )}
            
            {patient.medicamentos && (
              <div>
                <span className="text-sm font-medium">Medicamentos: </span>
                <p className="text-sm text-muted-foreground mt-1">{patient.medicamentos}</p>
              </div>
            )}

            {patient.observacoes && (
              <div>
                <span className="text-sm font-medium">Observações: </span>
                <p className="text-sm text-muted-foreground mt-1">{patient.observacoes}</p>
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
            <Badge className={patient.status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-muted text-foreground'}>
              {patient.status}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximos Agendamentos</CardTitle>
          </CardHeader>
          <CardContent>
            {proximasConsultas.length > 0 ? (
              <div className="space-y-3">
                {proximasConsultas.map((consulta) => (
                  <div key={consulta.id} className="flex items-start gap-2">
                    <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">
                        {new Date(consulta.data).toLocaleDateString('pt-BR')} às {consulta.hora}
                      </p>
                      <p className="truncate text-muted-foreground">
                        {consulta.procedimento || 'Consulta'}{consulta.dentista ? ` • ${consulta.dentista}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum agendamento</p>
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
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{new Date(patient.ultimaConsulta).toLocaleDateString('pt-BR')}</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma consulta anterior</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PatientPersonalInfo;
