import React, { useState, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Phone, Mail, Calendar, FileText, History, RotateCcw } from 'lucide-react';
import { openWhatsApp } from '@/lib/whatsapp';
import { calcularIdade } from '@/utils/idade';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { StatusPaciente } from '@/types/shared';
import { toast } from 'sonner';
import AgendarRetornoCard from './AgendarRetornoCard';
import { isConsultaRetorno } from '@/utils/retornoUtils';

interface PatientPersonalInfoProps {
  patient: any;
  onSchedule?: () => void;
}

const PatientPersonalInfo = ({ patient, onSchedule }: PatientPersonalInfoProps) => {
  const idade = calcularIdade(patient.dataNascimento) ?? patient.idade;
  const { consultas, updatePaciente } = useDentalSystem();
  
  const [consultaOrigemParaRetorno, setConsultaOrigemParaRetorno] = useState<any>(null);
  const agendarRetornoCardRef = useRef<HTMLDivElement>(null);

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

  const getConsultaDateTime = (consulta: { data: Date | string; hora?: string }) => {
    const dataHora = new Date(consulta.data);
    const [hora, minuto] = (consulta.hora || '00:00').split(':').map(Number);
    dataHora.setHours(hora || 0, minuto || 0, 0, 0);
    return dataHora;
  };

  const consultasDoPaciente = useMemo(() => {
    return (consultas || []).filter(
      (consulta) => consulta && consulta.pacienteId === patient?.id && consulta?.status !== 'cancelado'
    );
  }, [consultas, patient?.id]);

  const hojeInicio = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // 1. Próximos Agendamentos: Consultas futuras (incluindo retornos reais, ordenadas pela mais próxima)
  const proximasConsultas = useMemo(() => {
    return consultasDoPaciente
      .filter((consulta) => {
        if (consulta?.status === 'cancelado' || consulta?.status === 'faltou' || consulta?.status === 'realizado') {
          return false;
        }
        const dataHora = getConsultaDateTime(consulta);
        return (consulta?.status === 'agendado' || consulta?.status === 'confirmado') && 
               dataHora.getTime() >= hojeInicio.getTime();
      })
      .sort((a, b) => getConsultaDateTime(a).getTime() - getConsultaDateTime(b).getTime());
  }, [consultasDoPaciente, hojeInicio]);

  // 3. Últimas Consultas: Consultas realizadas no passado, da mais recente para a mais antiga
  const consultasRealizadas = useMemo(() => {
    const agora = new Date();
    return consultasDoPaciente
      .filter((consulta) => {
        if (consulta?.status === 'cancelado' || consulta?.status === 'faltou') return false;
        const dataHora = getConsultaDateTime(consulta);
        // Não mostrar agendamentos futuros
        if (dataHora.getTime() > agora.getTime()) return false;
        // Consultas efetivamente realizadas
        return consulta?.status === 'realizado';
      })
      .sort((a, b) => getConsultaDateTime(b).getTime() - getConsultaDateTime(a).getTime());
  }, [consultasDoPaciente]);

  const handleAgendarRetornoDeConsulta = (consulta: any) => {
    setConsultaOrigemParaRetorno(consulta);
    if (agendarRetornoCardRef.current) {
      agendarRetornoCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    const dataFmt = new Date(consulta.data).toLocaleDateString('pt-BR');
    toast.info(`Configurando retorno para a consulta de ${dataFmt} (${consulta.procedimento || 'Procedimento'}).`);
  };

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

        {/* 1. PRÓXIMOS AGENDAMENTOS */}
        <Card className="shadow-xs border border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Próximos Agendamentos
              </CardTitle>
              {proximasConsultas.length > 0 && (
                <Badge variant="secondary" className="text-xs font-medium">
                  {proximasConsultas.length} {proximasConsultas.length === 1 ? 'agendamento' : 'agendamentos'}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {proximasConsultas.length > 0 ? (
              <div className="space-y-2.5">
                {proximasConsultas.map((consulta) => {
                  const ehRetorno = isConsultaRetorno(consulta);
                  return (
                    <div 
                      key={consulta.id} 
                      className="flex items-start justify-between gap-2 p-2.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                        <div className="min-w-0 text-sm">
                          <p className="font-semibold text-foreground">
                            {new Date(consulta.data).toLocaleDateString('pt-BR')} às {consulta.hora}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {consulta.procedimento || 'Consulta'}{consulta.dentista ? ` • ${consulta.dentista}` : ''}
                          </p>
                        </div>
                      </div>
                      {ehRetorno && (
                        <Badge 
                          variant="outline" 
                          className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 shrink-0 font-medium"
                        >
                          Retorno
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum agendamento</p>
            )}
          </CardContent>
        </Card>

        {/* 2. AGENDAR RETORNO */}
        <div ref={agendarRetornoCardRef}>
          <AgendarRetornoCard 
            patient={patient} 
            consultaOrigem={consultaOrigemParaRetorno}
            onClearConsultaOrigem={() => setConsultaOrigemParaRetorno(null)}
          />
        </div>

        {/* 3. ÚLTIMAS CONSULTAS */}
        <Card className="shadow-xs border border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                Últimas Consultas
              </CardTitle>
              {consultasRealizadas.length > 0 && (
                <Badge variant="secondary" className="text-xs font-medium">
                  {consultasRealizadas.length} {consultasRealizadas.length === 1 ? 'realizada' : 'realizadas'}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {consultasRealizadas.length > 0 ? (
              <div className="space-y-2.5">
                {consultasRealizadas.slice(0, 5).map((consulta) => {
                  const ehRetorno = isConsultaRetorno(consulta);
                  return (
                    <div 
                      key={consulta.id} 
                      className="flex items-start justify-between gap-2 p-2.5 rounded-lg border border-border/50 bg-muted/10 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 text-sm">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-foreground">
                              {new Date(consulta.data).toLocaleDateString('pt-BR')} às {consulta.hora}
                            </p>
                            {ehRetorno && (
                              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 font-medium">
                                Retorno
                              </Badge>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {consulta.procedimento || 'Consulta'}{consulta.dentista ? ` • ${consulta.dentista}` : ''}
                          </p>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAgendarRetornoDeConsulta(consulta)}
                        className="h-7 px-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 shrink-0 gap-1"
                        title="Agendar retorno a partir desta consulta realizada"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span className="hidden sm:inline">Agendar Retorno</span>
                      </Button>
                    </div>
                  );
                })}
                {consultasRealizadas.length > 5 && (
                  <p className="text-center text-xs text-muted-foreground pt-1">
                    Exibindo as 5 mais recentes de {consultasRealizadas.length} consultas realizadas
                  </p>
                )}
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
