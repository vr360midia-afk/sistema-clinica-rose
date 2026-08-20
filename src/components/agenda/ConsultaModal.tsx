import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { consultaSchema, ConsultaFormData } from '@/schemas/validations';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { CalendarIcon, Clock, User, UserPlus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import QuickPatientModal from './QuickPatientModal';
import { useDentistas } from '@/hooks/useDentistas';
import { useBloqueios, encontrarBloqueio } from '@/hooks/useBloqueios';
import { Link } from 'react-router-dom';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { buildConsultaMessage, buildConfirmacaoPacienteMessage, openWhatsApp } from '@/lib/whatsapp';


interface ConsultaModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate?: Date;
  selectedTime?: string;
}

const ConsultaModal = ({ isOpen, onClose, selectedDate, selectedTime }: ConsultaModalProps) => {
  const { pacientes, consultas, addConsulta } = useDentalSystem();
  const { user } = useAuth();
  const { dentistas } = useDentistas();
  const { bloqueios } = useBloqueios();
  const dentistasAtivos = dentistas.filter((d) => d.ativo);
  const [isQuickPatientModalOpen, setIsQuickPatientModalOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [pendingPatientId, setPendingPatientId] = React.useState<string | null>(null);

  const form = useForm<ConsultaFormData>({
    resolver: zodResolver(consultaSchema),
    defaultValues: {
      data: selectedDate || new Date(),
      hora: selectedTime || '09:00',
      duracao: 60,
      status: 'agendado',
      procedimento: '',
      dentista: '',
      pacienteId: '',
      observacoes: ''
    }
  });

  // Atualizar a data do formulário quando selectedDate mudar
  React.useEffect(() => {
    if (selectedDate && isOpen) {
      form.setValue('data', selectedDate);
    }
  }, [selectedDate, isOpen, form]);

  // Atualizar o horário do formulário quando selectedTime mudar
  React.useEffect(() => {
    if (selectedTime && isOpen) {
      form.setValue('hora', selectedTime);
    }
  }, [selectedTime, isOpen, form]);

  // Quando um paciente acabou de ser criado e apareceu na lista, seleciona-o
  React.useEffect(() => {
    if (!pendingPatientId) return;
    if (pacientes.some((p) => p.id === pendingPatientId)) {
      form.setValue('pacienteId', pendingPatientId, { shouldValidate: true, shouldDirty: true });
      setPendingPatientId(null);
    }
  }, [pendingPatientId, pacientes, form]);

  // Resetar formulário quando fechar
  React.useEffect(() => {
    if (!isOpen) {
      form.reset({
        data: selectedDate || new Date(),
        hora: selectedTime || '09:00',
        duracao: 60,
        status: 'agendado',
        procedimento: '',
        dentista: '',
        pacienteId: '',
        observacoes: ''
      });
    }
  }, [isOpen, selectedDate, selectedTime, form]);

  const toMinutes = (hora: string) => {
    const [h, m] = (hora || '0:0').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  // Detecta sobreposição de horário para o mesmo dentista na mesma data
  const findConflito = (data: ConsultaFormData) => {
    const inicio = toMinutes(data.hora);
    const fim = inicio + (data.duracao || 60);
    return consultas.find((c) => {
      if (c.status === 'cancelado') return false;
      if (!c.dentista || !data.dentista) return false;
      if (c.dentista !== data.dentista) return false;
      const cData = new Date(c.data);
      if (format(cData, 'yyyy-MM-dd') !== format(data.data, 'yyyy-MM-dd')) return false;
      const cInicio = toMinutes(c.hora);
      const cFim = cInicio + (c.duracao || 60);
      return inicio < cFim && cInicio < fim;
    });
  };

  const onSubmit = async (data: ConsultaFormData) => {
    if (!user?.id) return;

    const bloqueio = encontrarBloqueio(bloqueios, data.data, data.hora, data.duracao || 60, data.dentista);
    if (bloqueio) {
      toast.error(`Horário bloqueado: ${bloqueio.titulo || 'indisponível'}.`);
      return;
    }

    const conflito = findConflito(data);
    if (conflito) {
      const nomeConflito = pacientes.find((p) => p.id === conflito.pacienteId)?.nome || 'outro paciente';
      toast.error(
        `Conflito de horário: ${data.dentista} já tem consulta às ${conflito.hora} (${conflito.duracao || 60}min) com ${nomeConflito}.`
      );
      return;
    }

    try {
      setIsLoading(true);
      const consultaData = {
        pacienteId: data.pacienteId,
        data: data.data,
        hora: data.hora,
        duracao: data.duracao,
        procedimento: data.procedimento,
        status: data.status,
        dentista: data.dentista,
        observacoes: data.observacoes || '',
        valor: data.valor,
        confirmacaoStatus: 'pendente' as const,
        userId: user.id
      };
      await addConsulta(consultaData);

      // Avisar a dentista pelo WhatsApp
      const dentista = dentistasAtivos.find((d) => d.nome === data.dentista);
      const paciente = pacientes.find((p) => p.id === data.pacienteId);
      if (dentista) {
        const mensagem = buildConsultaMessage({
          dentistaNome: dentista.nome,
          pacienteNome: paciente?.nome,
          data: data.data,
          hora: data.hora,
          duracao: data.duracao,
          procedimento: data.procedimento,
          observacoes: data.observacoes || undefined,
        });
        const aberto = openWhatsApp(dentista.telefone, mensagem);
        if (!aberto) {
          toast.warning(`Sem WhatsApp válido para ${dentista.nome}. Cadastre o telefone em Configurações > Dentistas.`);
        }
      }

      onClose();
      form.reset();
    } catch (error) {
      console.error('Erro ao criar consulta:', error);
    } finally {
      setIsLoading(false);
    }
  };


  const handlePatientCreated = (patientId: string) => {
    // Seta imediatamente; o useEffect garante a seleção quando a lista atualizar
    form.setValue('pacienteId', patientId, { shouldValidate: true, shouldDirty: true });
    setPendingPatientId(patientId);
    setIsQuickPatientModalOpen(false);
  };

  const handleSendPatientWhatsApp = () => {
    const values = form.getValues();
    const paciente = pacientes.find((p) => p.id === values.pacienteId);
    if (!paciente) {
      toast.warning('Selecione um paciente para enviar a mensagem.');
      return;
    }
    const dentista = dentistasAtivos.find((d) => d.nome === values.dentista);
    const mensagem = buildConfirmacaoPacienteMessage({
      pacienteNome: paciente.nome,
      data: values.data,
      hora: values.hora,
      dentistaNome: dentista?.nome,
      procedimento: values.procedimento || undefined,
    });
    const aberto = openWhatsApp(paciente.telefone, mensagem);
    if (!aberto) {
      toast.warning(`Paciente ${paciente.nome} não tem telefone válido para WhatsApp.`);
    }
  };

  const pacienteSelecionado = pacientes.find((p) => p.id === form.watch('pacienteId'));
  const podeEnviarWhatsAppPaciente = !!pacienteSelecionado?.telefone;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Nova Consulta
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="pacienteId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Paciente
                    </FormLabel>
                    <div className="flex gap-2">
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Selecione um paciente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {pacientes.map((paciente) => (
                            <SelectItem key={paciente.id} value={paciente.id}>
                              {paciente.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setIsQuickPatientModalOpen(true)}
                        className="shrink-0"
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="data"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Data</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(field.value, 'dd/MM/yyyy')
                              ) : (
                                <span>Selecione uma data</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => date && field.onChange(date)}
                            initialFocus
                            className={cn('p-3 pointer-events-auto')}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hora"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Hora
                      </FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="duracao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duração (min)</FormLabel>
                      <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="30">30 min</SelectItem>
                          <SelectItem value="60">60 min</SelectItem>
                          <SelectItem value="90">90 min</SelectItem>
                          <SelectItem value="120">120 min</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="agendado">Agendado</SelectItem>
                          <SelectItem value="confirmado">Confirmado</SelectItem>
                          <SelectItem value="realizado">Realizado</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                          <SelectItem value="faltou">Faltou</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="procedimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Procedimento</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Limpeza, Canal, Restauração..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dentista"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dentista</FormLabel>
                    {dentistasAtivos.length > 0 ? (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um dentista" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {dentistasAtivos.map((d) => (
                            <SelectItem key={d.id} value={d.nome}>
                              {d.nome}{d.especialidade ? ` — ${d.especialidade}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Nenhum dentista cadastrado.{' '}
                        <Link to="/configuracoes" className="text-primary underline" onClick={onClose}>
                          Cadastrar agora
                        </Link>
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Observações adicionais..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col-reverse sm:flex-row gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!podeEnviarWhatsAppPaciente}
                  onClick={handleSendPatientWhatsApp}
                  className="w-full sm:w-auto text-green-600 hover:text-green-700 hover:bg-green-950/30 border-green-600/30 disabled:text-muted-foreground"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  WhatsApp Paciente
                </Button>
                <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Agendar Consulta
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <QuickPatientModal
        isOpen={isQuickPatientModalOpen}
        onClose={() => setIsQuickPatientModalOpen(false)}
        onPatientCreated={handlePatientCreated}
      />
    </>
  );
};

export default ConsultaModal;
