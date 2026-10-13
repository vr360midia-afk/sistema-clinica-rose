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
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/context/AuthContext';
import QuickPatientModal from './QuickPatientModal';
import { useDentistas } from '@/hooks/useDentistas';
import { useProcedimentos } from '@/hooks/useProcedimentos';
import { useBloqueios, encontrarBloqueio, toISODate } from '@/hooks/useBloqueios';
import { Link } from 'react-router-dom';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { buildConsultaMessage, openWhatsApp } from '@/lib/whatsapp';


// PerÃ­odos completos: ocupam e bloqueiam a agenda no intervalo inteiro
const PERIODOS = [
  { value: 'manha', label: 'ManhÃ£ inteira (08:00 - 12:00)', horaInicio: '08:00', horaFim: '12:00', duracao: 240 },
  { value: 'tarde', label: 'Tarde inteira (13:00 - 18:00)', horaInicio: '13:00', horaFim: '18:00', duracao: 300 },
  { value: 'noite', label: 'Noite inteira (18:00 - 22:00)', horaInicio: '18:00', horaFim: '22:00', duracao: 240 },
  { value: 'dia', label: 'Dia inteiro (08:00 - 22:00)', horaInicio: '08:00', horaFim: '22:00', duracao: 840 },
] as const;

interface ConsultaModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate?: Date;
  selectedTime?: string;
  initialPatientId?: string;
  editingConsulta?: any;
  onSaved?: (data: Date) => void;
}

const ConsultaModal = ({ isOpen, onClose, selectedDate, selectedTime, initialPatientId, editingConsulta, onSaved }: ConsultaModalProps) => {
  const { pacientes, consultas, addConsulta, updateConsulta } = useDentalSystem();
  const { user } = useAuth();
  const { dentistas } = useDentistas();
  const { bloqueios, addBloqueio } = useBloqueios();
  const { procedimentos } = useProcedimentos();
  const procedimentosAtivos = procedimentos.filter((p) => p.ativo);
  const dentistasAtivos = dentistas.filter((d) => d.ativo);
  const [isQuickPatientModalOpen, setIsQuickPatientModalOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [pendingPatientId, setPendingPatientId] = React.useState<string | null>(null);
  const [periodoSelecionado, setPeriodoSelecionado] = React.useState<string | null>(null);


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

  // Inicializar todos os campos somente ao abrir (sem sobrescrever a data
  // escolhida pelo usuÃ¡rio enquanto o modal estiver em uso).
  React.useEffect(() => {
    if (!isOpen) return;
    if (editingConsulta) {
      form.reset({
        data: editingConsulta.data ? new Date(editingConsulta.data) : (selectedDate ? new Date(selectedDate) : new Date()),
        hora: (editingConsulta.hora || editingConsulta.time || selectedTime || '09:00').substring(0, 5),
        duracao: Number(editingConsulta.duracao) || (typeof editingConsulta.duration === 'string' ? parseInt(editingConsulta.duration, 10) : Number(editingConsulta.duration)) || 60,
        status: editingConsulta.status === 'remarcado' ? 'agendado' : (editingConsulta.status || 'agendado'),
        procedimento: editingConsulta.procedimento || editingConsulta.procedure || '',
        dentista: (editingConsulta.dentista || editingConsulta.dentist || '') === 'none' ? '' : (editingConsulta.dentista || editingConsulta.dentist || ''),
        pacienteId: editingConsulta.pacienteId || editingConsulta.paciente_id || initialPatientId || '',
        observacoes: editingConsulta.observacoes || '',
        valor: editingConsulta.valor !== null && editingConsulta.valor !== undefined && !isNaN(Number(editingConsulta.valor)) ? Number(editingConsulta.valor) : undefined,
      });
    } else {
      form.reset({
        data: selectedDate ? new Date(selectedDate) : new Date(),
        hora: selectedTime || '09:00',
        duracao: 60,
        status: 'agendado',
        procedimento: '',
        dentista: '',
        pacienteId: initialPatientId || '',
        observacoes: ''
      });
    }
    setPeriodoSelecionado(null);
  }, [isOpen, selectedDate, selectedTime, initialPatientId, editingConsulta, form]);



  // Quando um paciente acabou de ser criado e apareceu na lista, seleciona-o
  React.useEffect(() => {
    if (!pendingPatientId) return;
    if (pacientes.some((p) => p.id === pendingPatientId)) {
      form.setValue('pacienteId', pendingPatientId, { shouldValidate: true, shouldDirty: true });
      setPendingPatientId(null);
    }
  }, [pendingPatientId, pacientes, form]);

  const toMinutes = (hora: string) => {
    const [h, m] = (hora || '0:0').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  // Detecta sobreposiÃ§Ã£o de horÃ¡rio para o mesmo dentista na mesma data
  const findConflito = (data: ConsultaFormData) => {
    const inicio = toMinutes(data.hora);
    const fim = inicio + (data.duracao || 60);
    return consultas.find((c) => {
      if (editingConsulta && c.id === editingConsulta.id) return false;
      if (c.status === 'cancelado' || c.status === 'remarcado') return false;
      if (!c.dentista || !data.dentista) return false;
      if (c.dentista !== data.dentista) return false;
      if (toISODate(c.data) !== toISODate(data.data)) return false;
      const cInicio = toMinutes(c.hora);
      const cFim = cInicio + (c.duracao || 60);
      return inicio < cFim && cInicio < fim;
    });
  };

  const onSubmit = async (data: ConsultaFormData) => {
    const currentUserId = user?.id || (await supabase.auth.getSession()).data.session?.user?.id;
    if (!currentUserId && !editingConsulta?.id) {
      toast.error('Usuário não autenticado. Por favor, recarregue a página.');
      return;
    }

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
        dentista: data.dentista === 'none' ? '' : (data.dentista || ''),
        observacoes: data.observacoes || '',
        valor: data.valor ?? undefined,
        confirmacaoStatus: 'pendente' as const,
      };
      if (editingConsulta?.id) {
        await updateConsulta(editingConsulta.id, consultaData);
      } else {
        await addConsulta({ ...consultaData, userId: currentUserId || '' });
      }

      // Período completo: bloquear a agenda no intervalo
      const periodo = PERIODOS.find((p) => p.value === periodoSelecionado);
      if (periodo) {
        const dia = toISODate(data.data);
        const pacienteNome = pacientes.find((p) => p.id === data.pacienteId)?.nome || 'Paciente';
        await addBloqueio({
          titulo: `${periodo.label.split(' (')[0]} reservada - ${pacienteNome}`,
          dentista: data.dentista || null,
          dataInicio: dia,
          dataFim: dia,
          horaInicio: periodo.horaInicio,
          horaFim: periodo.horaFim,
          diaInteiro: false,
          observacoes: data.procedimento || null,
        });
      }

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

      onSaved?.(data.data);
      onClose();
      form.reset();
    } catch (error: any) {
      console.error('Erro ao salvar consulta:', error);
      toast.error('Erro ao salvar remarcação: ' + (error?.message || 'Tente novamente'));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePatientCreated = (patientId: string) => {
    // Seta imediatamente; o useEffect garante a seleção quando a lista atualizar
    form.setValue('pacienteId', patientId, { shouldValidate: true, shouldDirty: true });
    setPendingPatientId(patientId);
    setIsQuickPatientModalOpen(false);
    toast.success('Paciente selecionado! Complete o agendamento da consulta.');
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              {editingConsulta ? 'Remarcar Consulta' : 'Nova Consulta'}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={(e) => {
                form.handleSubmit(
                  async (formData) => {
                    await onSubmit(formData);
                  },
                  (errors) => {
                    console.error('Erros no formulário de consulta:', errors);
                    const errorMsgs = Object.entries(errors)
                      .map(([key, err]) => `${key}: ${err?.message || 'inválido'}`)
                      .join(' | ');
                    toast.error(`Verifique os campos: ${errorMsgs}`);
                  }
                )(e);
              }}
              className="space-y-4"
            >
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
                            onSelect={(date) => {
                              if (!date) return;
                              field.onChange(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
                            }}
                            locale={ptBR}
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
                      <FormLabel>DuraÃ§Ã£o / PerÃ­odo</FormLabel>
                      <Select
                        onValueChange={(val) => {
                          const periodo = PERIODOS.find((p) => p.value === val);
                          if (periodo) {
                            setPeriodoSelecionado(periodo.value);
                            form.setValue('hora', periodo.horaInicio, { shouldValidate: true });
                            field.onChange(periodo.duracao);
                          } else {
                            setPeriodoSelecionado(null);
                            field.onChange(Number(val));
                          }
                        }}
                        value={periodoSelecionado ?? field.value?.toString()}
                      >
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
                          <SelectItem value="180">180 min</SelectItem>
                          {PERIODOS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {periodoSelecionado && (
                        <p className="text-xs text-muted-foreground">
                          A agenda serÃ¡ bloqueada nesse perÃ­odo (ex.: casos de lentes).
                        </p>
                      )}
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
                          <SelectItem value="remarcado">Remarcado</SelectItem>
                          <SelectItem value="faltou">Faltou</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
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
                      <Input
                        placeholder="Selecione ou digite um procedimento..."
                        list="lista-procedimentos"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          const proc = procedimentosAtivos.find(
                            (p) => p.nome.toLowerCase() === e.target.value.toLowerCase()
                          );
                          if (proc) {
                            form.setValue('duracao', proc.duracaoMinutos || 60);
                            if (proc.preco > 0) form.setValue('valor', proc.preco);
                          }
                        }}
                      />
                    </FormControl>
                    <datalist id="lista-procedimentos">
                      {procedimentosAtivos.map((p) => (
                        <option key={p.id} value={p.nome} />
                      ))}
                    </datalist>
                    <FormMessage />
                  </FormItem>
                )}
              />

                            <FormField
                control={form.control}
                name="dentista"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dentista (Opcional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "none"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um dentista" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sem dentista específico</SelectItem>
                        {dentistasAtivos.map((d) => (
                          <SelectItem key={d.id} value={d.nome}>
                            {d.nome}{d.especialidade ? " - " + d.especialidade : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {dentistasAtivos.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Dica: Você pode <Link to="/configuracoes" className="underline" onClick={onClose}>cadastrar dentistas</Link> para associá-los às consultas.
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
                    <FormLabel>ObservaÃ§Ãµes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="ObservaÃ§Ãµes adicionais..."
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
                <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingConsulta ? 'Salvar RemarcaÃ§Ã£o' : 'Agendar Consulta'}
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




