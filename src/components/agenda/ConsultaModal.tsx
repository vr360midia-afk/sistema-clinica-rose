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
import {
  calcularHoraFim,
  calcularDuracaoMinutos,
  formatarDuracaoAmigavel,
  formatarIntervaloHorario,
} from '@/utils/horarioConsulta';

// Períodos completos: ocupam e bloqueiam a agenda no intervalo inteiro
const PERIODOS = [
  { value: 'manha', label: 'Manhã inteira (08:00 - 12:00)', horaInicio: '08:00', horaFim: '12:00', duracao: 240 },
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
  const { bloqueios, addBloqueio, reload: reloadBloqueios } = useBloqueios();
  const { procedimentos } = useProcedimentos();
  const procedimentosAtivos = procedimentos.filter((p) => p.ativo);
  const dentistasAtivos = dentistas.filter((d) => d.ativo);
  const [isQuickPatientModalOpen, setIsQuickPatientModalOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [pendingPatientId, setPendingPatientId] = React.useState<string | null>(null);
  const [periodoSelecionado, setPeriodoSelecionado] = React.useState<string | null>(null);


  const horaInicialPadrao = (selectedTime || '09:00').substring(0, 5);
  const duracaoPadrao = 60;

  const form = useForm<ConsultaFormData>({
    resolver: zodResolver(consultaSchema),
    defaultValues: {
      data: selectedDate || new Date(),
      hora: horaInicialPadrao,
      horaFim: calcularHoraFim(horaInicialPadrao, duracaoPadrao),
      duracao: duracaoPadrao,
      status: 'agendado',
      procedimento: '',
      dentista: '',
      pacienteId: '',
      observacoes: ''
    }
  });

  // Inicializar todos os campos somente ao abrir (sem sobrescrever a data
  // escolhida pelo usuário enquanto o modal estiver em uso).
  React.useEffect(() => {
    if (!isOpen) return;
    if (editingConsulta) {
      const horaIni = (editingConsulta.hora || editingConsulta.time || selectedTime || '09:00').substring(0, 5);
      const dur = Number(editingConsulta.duracao) || (typeof editingConsulta.duration === 'string' ? parseInt(editingConsulta.duration, 10) : Number(editingConsulta.duration)) || 60;
      form.reset({
        data: editingConsulta.data ? new Date(editingConsulta.data) : (selectedDate ? new Date(selectedDate) : new Date()),
        hora: horaIni,
        horaFim: calcularHoraFim(horaIni, dur),
        duracao: dur,
        status: editingConsulta.status === 'remarcado' ? 'agendado' : (editingConsulta.status || 'agendado'),
        procedimento: editingConsulta.procedimento || editingConsulta.procedure || '',
        dentista: (editingConsulta.dentista || editingConsulta.dentist || '') === 'none' ? '' : (editingConsulta.dentista || editingConsulta.dentist || ''),
        pacienteId: editingConsulta.pacienteId || editingConsulta.paciente_id || initialPatientId || '',
        observacoes: editingConsulta.observacoes || '',
        valor: editingConsulta.valor !== null && editingConsulta.valor !== undefined && !isNaN(Number(editingConsulta.valor)) ? Number(editingConsulta.valor) : undefined,
      });
    } else {
      const horaIni = (selectedTime || '09:00').substring(0, 5);
      const dur = 60;
      form.reset({
        data: selectedDate ? new Date(selectedDate) : new Date(),
        hora: horaIni,
        horaFim: calcularHoraFim(horaIni, dur),
        duracao: dur,
        status: 'agendado',
        procedimento: '',
        dentista: '',
        pacienteId: initialPatientId || '',
        observacoes: ''
      });
    }
    setPeriodoSelecionado(null);
  }, [isOpen, selectedDate, selectedTime, initialPatientId, editingConsulta, form]);

  const handleHoraInicioChange = (novoInicio: string) => {
    form.setValue('hora', novoInicio, { shouldValidate: true, shouldDirty: true });
    const durAtual = form.getValues('duracao') || 60;
    const novoFim = calcularHoraFim(novoInicio, durAtual);
    form.setValue('horaFim', novoFim, { shouldValidate: true, shouldDirty: true });
  };

  const handleHoraFimChange = (novoFim: string) => {
    form.setValue('horaFim', novoFim, { shouldValidate: true, shouldDirty: true });
    const inicio = form.getValues('hora') || '09:00';
    const novaDuracao = calcularDuracaoMinutos(inicio, novoFim);
    form.setValue('duracao', novaDuracao, { shouldValidate: true, shouldDirty: true });
    setPeriodoSelecionado(null);
  };

  const handleDuracaoChange = (novaDuracao: number) => {
    const durClamped = Math.max(5, novaDuracao || 60);
    form.setValue('duracao', durClamped, { shouldValidate: true, shouldDirty: true });
    const inicio = form.getValues('hora') || '09:00';
    const novoFim = calcularHoraFim(inicio, durClamped);
    form.setValue('horaFim', novoFim, { shouldValidate: true, shouldDirty: true });
    setPeriodoSelecionado(null);
  };

  const handlePeriodoChange = (val: string) => {
    const periodo = PERIODOS.find((p) => p.value === val);
    if (periodo) {
      setPeriodoSelecionado(periodo.value);
      form.setValue('hora', periodo.horaInicio, { shouldValidate: true, shouldDirty: true });
      form.setValue('horaFim', periodo.horaFim, { shouldValidate: true, shouldDirty: true });
      form.setValue('duracao', periodo.duracao, { shouldValidate: true, shouldDirty: true });
    } else {
      setPeriodoSelecionado(null);
    }
  };



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

  // Detecta sobreposição de horário para o mesmo dentista na mesma data
  const findConflito = (data: ConsultaFormData) => {
    const inicio = toMinutes(data.hora);
    const fim = inicio + (data.duracao || 60);
    return consultas.find((c) => {
      // Ignora a própria consulta em edição
      if (editingConsulta && (c.id === editingConsulta.id || c.id === editingConsulta._id)) return false;
      // Ignora consultas canceladas ou remarcadas
      if (c.status === 'cancelado' || c.status === 'remarcado') return false;
      // Se a consulta pertencer à MESMA paciente, permite editar e prolongar!
      if (c.pacienteId && data.pacienteId && c.pacienteId === data.pacienteId) return false;
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

    const pacienteAtual = pacientes.find((p) => p.id === data.pacienteId);
    const pacienteNome = pacienteAtual?.nome;

    // Passa o nome da paciente para que o bloqueio gerado para ela mesma não impeça a edição/prolongamento
    const bloqueio = encontrarBloqueio(
      bloqueios,
      data.data,
      data.hora,
      data.duracao || 60,
      data.dentista,
      pacienteNome
    );
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
        // Se tinha bloqueio antigo gerado para esse paciente neste mesmo dia, limpa para atualizar
        const dia = toISODate(data.data);
        if (pacienteNome) {
          try {
            await supabase
              .from('bloqueios_agenda')
              .delete()
              .eq('data_inicio', dia)
              .ilike('titulo', `%${pacienteNome}%`);
          } catch (e) {
            console.warn('Aviso ao limpar bloqueio anterior:', e);
          }
        }
      } else {
        await addConsulta({ ...consultaData, userId: currentUserId || '' });
      }

      // Período completo: bloquear a agenda no intervalo
      const periodo = PERIODOS.find((p) => p.value === periodoSelecionado);
      if (periodo) {
        const dia = toISODate(data.data);
        await addBloqueio({
          titulo: `${periodo.label.split(' (')[0]} reservada - ${pacienteNome || 'Paciente'}`,
          dentista: data.dentista || null,
          dataInicio: dia,
          dataFim: dia,
          horaInicio: periodo.horaInicio,
          horaFim: periodo.horaFim,
          diaInteiro: false,
          observacoes: data.procedimento || null,
        });
      } else {
        reloadBloqueios();
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

              {/* Seção: Horários de Início, Finalização e Duração Personalizável */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <FormLabel className="text-xs font-semibold flex items-center gap-1.5 text-foreground mb-0">
                    <Clock className="h-4 w-4 text-primary" />
                    Horários e Duração da Consulta
                  </FormLabel>
                  <span className="text-[11px] font-medium text-primary">
                    {formatarIntervaloHorario(form.watch('hora'), form.watch('duracao'))}
                  </span>
                </div>

                {/* Horário de Início e Horário de Finalização */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="hora"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs text-muted-foreground font-medium">
                          Horário de Início
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            value={field.value}
                            onChange={(e) => handleHoraInicioChange(e.target.value)}
                            className="h-9 text-sm font-semibold bg-background"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="horaFim"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs text-muted-foreground font-medium">
                          Horário de Finalização
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            value={field.value || calcularHoraFim(form.watch('hora'), form.watch('duracao'))}
                            onChange={(e) => handleHoraFimChange(e.target.value)}
                            className="h-9 text-sm font-semibold bg-background"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Duração em minutos (editável) e botões rápidos */}
                <div className="space-y-2 pt-1 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">
                      Duração Personalizada:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={5}
                        step={5}
                        value={form.watch('duracao') || 60}
                        onChange={(e) => handleDuracaoChange(Number(e.target.value) || 60)}
                        className="h-7 w-20 text-xs font-bold text-center bg-background"
                      />
                      <span className="text-xs text-muted-foreground">minutos</span>
                    </div>
                  </div>

                  {/* Chips rápidos de duração padrão */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground block">
                      Opções rápidas de duração padrão:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { min: 15, label: '15m' },
                        { min: 30, label: '30m' },
                        { min: 45, label: '45m' },
                        { min: 60, label: '60m (Padrão)' },
                        { min: 90, label: '1h 30m' },
                        { min: 120, label: '2h' },
                        { min: 180, label: '3h' },
                      ].map((item) => {
                        const ativo = form.watch('duracao') === item.min && !periodoSelecionado;
                        return (
                          <button
                            key={item.min}
                            type="button"
                            onClick={() => handleDuracaoChange(item.min)}
                            className={cn(
                              'text-[11px] px-2.5 py-1 rounded-md font-medium border transition-colors',
                              ativo
                                ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                                : 'bg-background hover:bg-muted text-muted-foreground border-border'
                            )}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Período completo especial */}
                  <div className="pt-1">
                    <Select
                      value={periodoSelecionado ?? ''}
                      onValueChange={handlePeriodoChange}
                    >
                      <SelectTrigger className="h-7 text-xs bg-background/80 text-muted-foreground">
                        <SelectValue placeholder="Ou selecionar período completo (Manhã, Tarde, Dia)..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PERIODOS.map((p) => (
                          <SelectItem key={p.value} value={p.value} className="text-xs">
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {periodoSelecionado && (
                      <p className="text-[11px] text-amber-500 font-medium mt-1">
                        ⚠️ A agenda será bloqueada no intervalo inteiro deste período.
                      </p>
                    )}
                  </div>
                </div>
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
                            handleDuracaoChange(proc.duracaoMinutos || 60);
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
                <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingConsulta ? 'Salvar Alterações / Remarcação' : 'Agendar Consulta'}
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




