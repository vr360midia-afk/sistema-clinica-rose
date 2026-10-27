
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Phone, Mail, Calendar, FileText } from 'lucide-react';
import { openWhatsApp } from '@/lib/whatsapp';
import { calcularIdade } from '@/utils/idade';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { StatusPaciente } from '@/types/shared';
import { toast } from 'sonner';
import AgendarRetornoCard from './AgendarRetornoCard';


interface PatientPersonalInfoProps {
  patient: any;
  onSchedule?: () => void;
}

const PatientPersonalInfo = ({ patient, onSchedule }: PatientPersonalInfoProps) => {
  const idade = calcularIdade(patient.dataNascimento) ?? patient.idade;
  const { consultas, updatePaciente } = useDentalSystem();

  const handleStatusChange = async (newStatus: StatusPaciente) => {
    try {
      await updatePaciente(patient.id, { status: newStatus });
      toast.success(`Status atualizado para "${newStatus}"`);
    } catch (err: any) {
      toast.error('Erro ao atualizar status: ' + (err?.message || 'Erro desconhecido'));
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'Ativo':
        return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300">Ativo</Badge>;
      case 'Pendente':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300">Pendente</Badge>;
      case 'Em Tratamento':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300">Em Tratamento</Badge>;
      case 'Tratamento Concluido':
        return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300">Tratamento Concluído</Badge>;
      case 'Arquivado':
        return <Badge className="bg-muted text-foreground border-border">Arquivado</Badge>;
      case 'Inativo':
        return <Badge variant="secondary">Inativo</Badge>;
      default:
        return <Badge variant="secondary">{status || 'Ativo'}</Badge>;
    }
  };
  const getConsultaDateTime = (consulta: { data: Date; hora: string }) => {
    const dataHora = new Date(consulta.data);
    const [hora, minuto] = (consulta.hora || '00:00').split(':').map(Number);
    dataHora.setHours(hora || 0, minuto || 0, 0, 0);
    return dataHora;
  };
  const consultasDoPaciente = (consultas || []).filter(
    (consulta) => consulta && consulta.pacienteId === patient?.id && consulta?.status !== 'cancelado'
  );
  const hojeInicio = new Date();
  hojeInicio.setHours(0, 0, 0, 0);

  const proximasConsultas = consultasDoPaciente
    .filter((consulta) => {
      if (consulta?.status === 'cancelado' || consulta?.status === 'faltou') return false;
      const dataHora = getConsultaDateTime(consulta);
      return (consulta?.status === 'agendado' || consulta?.status === 'confirmado') && dataHora.getTime() >= hojeInicio.getTime();
    })
    .sort((a, b) => getConsultaDateTime(a).getTime() - getConsultaDateTime(b).getTime());
  const ultimaConsulta = consultasDoPaciente
    .filter((consulta) => {
      if (consulta?.status !== 'realizado') return false;
      const dataHora = new Date(consulta.data);
      const [hora, minuto] = (consulta.hora || '00:00').split(':').map(Number);
      dataHora.setHours(hora || 0, minuto || 0, 0, 0);
      return dataHora.getTime() < Date.now();
    })
    .sort((a, b) => getConsultaDateTime(b).getTime() - getConsultaDateTime(a).getTime())[0];

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
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate" title={patient.email || ''}>
                  {patient.email || 'E-mail não informado'}
                </span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                {patient.telefone ? (
                  <button
                    type="button"
                    onClick={() => openWhatsApp(patient.telefone, '')}
                    className="text-sm text-primary hover:underline focus:outline-none truncate"
                    title="Abrir conversa no WhatsApp"
                  >
                    {patient.telefone}
                  </button>
                ) : (
                  <span className="text-sm text-muted-foreground">Telefone não informado</span>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="min-w-0">
                <span className="text-sm font-medium">CPF: </span>
                <span className="text-sm">{patient.cpf || 'Não informado'}</span>
              </div>
              <div className="min-w-0">
                <span className="text-sm font-medium">RG: </span>
                <span className="text-sm">{patient.rg || 'Não informado'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="min-w-0">
                <span className="text-sm font-medium">Profissão: </span>
                <span className="text-sm">{patient.profissao || 'Não informado'}</span>
              </div>
              <div className="min-w-0">
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
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Status do Paciente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status Atual</span>
              {renderStatusBadge(patient?.status || 'Ativo')}
            </div>
            <div className="pt-2 border-t">
              <Label className="text-xs text-muted-foreground block mb-1.5 font-medium">
                Alterar status:
              </Label>
              <Select
                value={patient?.status || 'Ativo'}
                onValueChange={(val) => handleStatusChange(val as StatusPaciente)}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Em Tratamento">Em Tratamento</SelectItem>
                  <SelectItem value="Tratamento Concluido">Tratamento Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
 
        {/* Agendamento de Retorno com prazos pré-estabelecidos e data personalizada */}
        <AgendarRetornoCard patient={patient} onOpenFullModal={onSchedule} />

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
            {ultimaConsulta ? (
              <div className="flex items-start gap-2">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 text-sm">
                  <p className="font-medium">
                    {new Date(ultimaConsulta.data).toLocaleDateString('pt-BR')} às {ultimaConsulta.hora}
                  </p>
                  <p className="truncate text-muted-foreground">
                    {ultimaConsulta.procedimento || 'Consulta'}
                  </p>
                </div>
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
