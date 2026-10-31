import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  RotateCcw, 
  Calendar as CalendarIcon, 
  Clock, 
  Check, 
  AlertTriangle, 
  MessageCircle, 
  CalendarPlus, 
  ChevronRight,
  User,
  Sparkles,
  Loader2,
  CalendarCheck
} from 'lucide-react';
import { format, addDays, addMonths, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { useDentistas } from '@/hooks/useDentistas';
import { openWhatsApp } from '@/lib/whatsapp';
import { cn } from '@/lib/utils';

export const PRAZOS_RETORNO = [
  { id: '15d', label: '15 dias', dias: 15 },
  { id: '30d', label: '30 dias', dias: 30 },
  { id: '60d', label: '60 dias', dias: 60 },
  { id: '90d', label: '90 dias', dias: 90 },
  { id: '120d', label: '120 dias', dias: 120 },
  { id: '6m', label: '6 meses', meses: 6 },
] as const;

export const MOTIVOS_RETORNO = [
  'Consulta de Retorno',
  'Revisão Pós-Operatório',
  'Manutenção Preventiva',
  'Retirada de Pontos',
  'Avaliação de Tratamento',
  'Limpeza / Profilaxia',
  'Controle Ortodôntico',
] as const;

const HORARIOS_SUGERIDOS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00'
];

interface AgendarRetornoCardProps {
  patient: any;
  onOpenFullModal?: () => void;
  onSuccess?: () => void;
  compact?: boolean;
}

const toISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseISODate = (str: string): Date => {
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date();
  date.setFullYear(y, m - 1, d);
  date.setHours(9, 0, 0, 0);
  return date;
};

export const buildMensagemConfirmacaoRetorno = (info: {
  pacienteNome?: string;
  data: Date;
  hora: string;
  dentistaNome?: string;
  motivo?: string;
}): string => {
  const dataFmt = format(info.data, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const primeiroNome = info.pacienteNome ? info.pacienteNome.trim().split(' ')[0] : 'Olá';
  
  return [
    `Olá, *${primeiroNome}*! Tudo bem?`,
    '',
    `Passando para confirmar o agendamento do seu *retorno*:`,
    `📅 *Data:* ${dataFmt}`,
    `⏰ *Horário:* às ${info.hora}`,
    info.dentistaNome ? `👨‍⚕️ *Profissional:* ${info.dentistaNome}` : null,
    info.motivo ? `📋 *Procedimento:* ${info.motivo}` : null,
    '',
    `Caso precise reagendar ou tenha alguma dúvida, basta nos responder por aqui. Te esperamos! 😊`
  ].filter(Boolean).join('\n');
};

export const AgendarRetornoCard = ({
  patient,
  onOpenFullModal,
  onSuccess,
  compact = false
}: AgendarRetornoCardProps) => {
  const { consultas, addConsulta, updateConsulta, updatePaciente } = useDentalSystem();
  const { dentistas } = useDentistas();
  const dentistasAtivos = dentistas.filter((d) => d.ativo);

  // Data inicial padrão: +30 dias
  const [prazoAtivo, setPrazoAtivo] = useState<string | null>('30d');
  const [dataSelecionada, setDataSelecionada] = useState<Date>(() => addDays(new Date(), 30));
  const [hora, setHora] = useState<string>('09:00');
  const [motivo, setMotivo] = useState<string>('Consulta de Retorno');
  const [dentista, setDentista] = useState<string>('');
  const [observacoes, setObservacoes] = useState<string>('');
  const [notificarWhatsApp, setNotificarWhatsApp] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [modoEdicao, setModoEdicao] = useState<boolean>(false);

  // Identificar se há retorno/consulta futura já agendada para este paciente
  const proximaConsultaFutura = useMemo(() => {
    if (!patient?.id || !consultas) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const consultasPaciente = consultas
      .filter((c) => c && c.pacienteId === patient.id && c.status !== 'cancelado' && c.status !== 'faltou')
      .map((c) => {
        const d = new Date(c.data);
        const [h, m] = (c.hora || '00:00').split(':').map(Number);
        d.setHours(h || 0, m || 0, 0, 0);
        return { ...c, dataHora: d };
      })
      .filter((c) => c.dataHora.getTime() >= hoje.getTime())
      .sort((a, b) => a.dataHora.getTime() - b.dataHora.getTime());

    // Prioriza consultas com "retorno" no procedimento ou pega a próxima futura
    const retornoEspecifico = consultasPaciente.find((c) => 
      c.procedimento?.toLowerCase().includes('retorno') || 
      c.observacoes?.toLowerCase().includes('retorno')
    );

    return retornoEspecifico || consultasPaciente[0] || null;
  }, [consultas, patient?.id]);

  // Pré-selecionar dentista baseado no histórico recente do paciente
  React.useEffect(() => {
    if (!dentista && consultas && patient?.id) {
      const ultima = consultas
        .filter((c) => c && c.pacienteId === patient.id && c.dentista)
        .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0];
      if (ultima?.dentista) {
        setDentista(ultima.dentista);
      } else if (dentistasAtivos.length > 0) {
        setDentista(dentistasAtivos[0].nome);
      }
    }
  }, [consultas, patient?.id, dentistasAtivos, dentista]);

  const aplicarPrazo = (prazo: typeof PRAZOS_RETORNO[number]) => {
    const base = new Date();
    let novaData = new Date();
    if ('meses' in prazo && prazo.meses) {
      novaData = addMonths(base, prazo.meses);
    } else if ('dias' in prazo && prazo.dias) {
      novaData = addDays(base, prazo.dias);
    }
    novaData.setHours(9, 0, 0, 0);
    setDataSelecionada(novaData);
    setPrazoAtivo(prazo.id);
  };

  const handleDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    const d = parseISODate(val);
    setDataSelecionada(d);
    
    // Verifica se coincide com algum prazo
    const diasDiff = differenceInCalendarDays(d, new Date());
    const prazoEncontrado = PRAZOS_RETORNO.find(p => 'dias' in p && p.dias === diasDiff);
    setPrazoAtivo(prazoEncontrado ? prazoEncontrado.id : null);
  };

  const isDomingo = dataSelecionada.getDay() === 0;
  const isSabado = dataSelecionada.getDay() === 6;

  const moverParaSegunda = () => {
    const nova = new Date(dataSelecionada);
    const dias = isDomingo ? 1 : 2;
    nova.setDate(nova.getDate() + dias);
    setDataSelecionada(nova);
    setPrazoAtivo(null);
    toast.info(`Data movida para segunda-feira: ${format(nova, 'dd/MM/yyyy')}`);
  };

  const diasAteRetorno = differenceInCalendarDays(dataSelecionada, new Date());

  const handleSalvarRetorno = async () => {
    if (!patient?.id) {
      toast.error('Paciente não identificado');
      return;
    }

    if (!dataSelecionada || isNaN(dataSelecionada.getTime())) {
      toast.error('Selecione uma data válida para o retorno');
      return;
    }

    setLoading(true);
    try {
      const dataFormatadaStr = format(dataSelecionada, 'dd/MM/yyyy');

      if (modoEdicao && proximaConsultaFutura?.id) {
        // Atualiza a consulta futura existente
        await updateConsulta(proximaConsultaFutura.id, {
          data: dataSelecionada,
          hora,
          procedimento: motivo || 'Consulta de Retorno',
          dentista: dentista || proximaConsultaFutura.dentista || '',
          observacoes: observacoes ? `[Retorno] ${observacoes}` : proximaConsultaFutura.observacoes || '[Retorno]',
          status: 'agendado'
        });
        toast.success(`Retorno remarcado para ${dataFormatadaStr} às ${hora}!`);
      } else {
        // Cria nova consulta de retorno
        await addConsulta({
          pacienteId: patient.id,
          pacienteNome: patient.nome,
          data: dataSelecionada,
          hora,
          duracao: 30,
          procedimento: motivo || 'Consulta de Retorno',
          status: 'agendado',
          dentista: dentista || '',
          observacoes: observacoes ? `[Retorno] ${observacoes}` : '[Retorno agendado]',
          valor: 0
        });
        toast.success(`Retorno agendado com sucesso para ${dataFormatadaStr} às ${hora}!`);
      }

      // Atualiza a proximaConsulta no paciente
      if (updatePaciente) {
        await updatePaciente(patient.id, {
          proximaConsulta: dataSelecionada
        });
      }

      // Envia notificação por WhatsApp se habilitado
      if (notificarWhatsApp && patient.telefone) {
        const msg = buildMensagemConfirmacaoRetorno({
          pacienteNome: patient.nome,
          data: dataSelecionada,
          hora,
          dentistaNome: dentista,
          motivo
        });
        openWhatsApp(patient.telefone, msg);
      }

      setModoEdicao(false);
      onSuccess?.();
    } catch (err: any) {
      console.error('Erro ao agendar retorno:', err);
      toast.error('Erro ao agendar retorno: ' + (err?.message || 'Tente novamente'));
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarLembreteExistente = () => {
    if (!patient?.telefone || !proximaConsultaFutura) return;
    const msg = buildMensagemConfirmacaoRetorno({
      pacienteNome: patient.nome,
      data: new Date(proximaConsultaFutura.data),
      hora: proximaConsultaFutura.hora || '09:00',
      dentistaNome: proximaConsultaFutura.dentista,
      motivo: proximaConsultaFutura.procedimento
    });
    openWhatsApp(patient.telefone, msg);
  };

  return (
    <Card className={cn(
      "shadow-xs transition-all",
      compact
        ? "border-0 shadow-none bg-transparent p-0"
        : "border border-blue-200 dark:border-blue-900/60 bg-gradient-to-br from-card via-card to-blue-50/30 dark:to-blue-950/20"
    )}>
      {!compact && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <RotateCcw className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  Agendar Retorno
                  {proximaConsultaFutura && !modoEdicao && (
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300">
                      Agendado
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  Prazos pré-estabelecidos ou data personalizada
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
      )}

      <CardContent className={cn("space-y-4", compact && "p-0")}>
        {/* Banner de Retorno já existente */}
        {proximaConsultaFutura && !modoEdicao && (
          <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/30 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <CalendarCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                    Próximo retorno agendado:
                  </p>
                  <p className="text-sm font-bold text-foreground">
                    {format(new Date(proximaConsultaFutura.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} às {proximaConsultaFutura.hora}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {proximaConsultaFutura.procedimento || 'Consulta de Retorno'}
                    {proximaConsultaFutura.dentista ? ` • ${proximaConsultaFutura.dentista}` : ''}
                  </p>
                </div>
              </div>

              {patient.telefone && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleEnviarLembreteExistente}
                  className="h-7 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 shrink-0"
                  title="Enviar lembrete no WhatsApp do paciente"
                >
                  <MessageCircle className="h-3 w-3" />
                  <span>Avisar</span>
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-emerald-200/60 dark:border-emerald-800/40 text-xs">
              <span className="text-emerald-700 dark:text-emerald-300 font-medium text-[11px]">
                {differenceInCalendarDays(new Date(proximaConsultaFutura.data), new Date()) === 0
                  ? 'Hoje!'
                  : differenceInCalendarDays(new Date(proximaConsultaFutura.data), new Date()) === 1
                  ? 'Amanhã'
                  : `Em ${differenceInCalendarDays(new Date(proximaConsultaFutura.data), new Date())} dias`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setModoEdicao(true);
                  setDataSelecionada(new Date(proximaConsultaFutura.data));
                  setHora(proximaConsultaFutura.hora || '09:00');
                  setMotivo(proximaConsultaFutura.procedimento || 'Consulta de Retorno');
                  if (proximaConsultaFutura.dentista) setDentista(proximaConsultaFutura.dentista);
                }}
                className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40"
              >
                Remarcar data
              </Button>
            </div>
          </div>
        )}

        {/* Formulário de agendamento (visível se não há retorno ou se em modo de edição) */}
        {(!proximaConsultaFutura || modoEdicao) && (
          <div className="space-y-3.5">
            {modoEdicao && (
              <div className="flex items-center justify-between text-xs pb-1">
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  Modo de Remarcação de Retorno
                </span>
                <button
                  type="button"
                  onClick={() => setModoEdicao(false)}
                  className="text-muted-foreground hover:underline"
                >
                  Cancelar
                </button>
              </div>
            )}

            {/* 1. Prazos Pré-estabelecidos */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Prazos Pré-estabelecidos:</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  A partir de hoje
                </span>
              </Label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {PRAZOS_RETORNO.map((prazo) => {
                  const isSelected = prazoAtivo === prazo.id;
                  return (
                    <Button
                      key={prazo.id}
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => aplicarPrazo(prazo)}
                      className={`h-8 text-xs font-medium px-1 transition-all ${
                        isSelected
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs font-semibold'
                          : 'hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950/50'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 mr-0.5" />}
                      {prazo.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* 2. Campo de Data Personalizada */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="dataRetornoInput" className="text-xs font-semibold text-foreground">
                  Data do Retorno:
                </Label>
                <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                  {diasAteRetorno === 0
                    ? 'Hoje'
                    : diasAteRetorno === 1
                    ? 'Amanhã'
                    : diasAteRetorno > 0
                    ? `Em ${diasAteRetorno} dias`
                    : 'Data passada'}
                </span>
              </div>
              <div className="relative">
                <Input
                  id="dataRetornoInput"
                  type="date"
                  value={toISODate(dataSelecionada)}
                  min={toISODate(new Date())}
                  onChange={handleDataChange}
                  className="h-9 text-xs font-medium pl-3 bg-background border-slate-300 dark:border-slate-700"
                />
              </div>

              {/* Data formatada amigável */}
              <div className="text-[11px] text-muted-foreground capitalize flex items-center gap-1.5 pt-0.5">
                <CalendarIcon className="h-3 w-3 text-blue-500 shrink-0" />
                <span>
                  {format(dataSelecionada, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              </div>

              {/* Aviso se cair em fim de semana */}
              {(isDomingo || isSabado) && (
                <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2 mt-1">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span>A data cai em um {isDomingo ? 'domingo' : 'sábado'}.</span>
                  </div>
                  <button
                    type="button"
                    onClick={moverParaSegunda}
                    className="font-semibold underline hover:text-amber-950 dark:hover:text-amber-100 shrink-0 cursor-pointer"
                  >
                    Mover p/ Segunda
                  </button>
                </div>
              )}
            </div>

            {/* 3. Horário e Profissional */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Clock className="h-3 w-3 text-muted-foreground" /> Horário
                </Label>
                <Select value={hora} onValueChange={setHora}>
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {HORARIOS_SUGERIDOS.map((h) => (
                      <SelectItem key={h} value={h} className="text-xs">
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <User className="h-3 w-3 text-muted-foreground" /> Profissional
                </Label>
                <Select value={dentista} onValueChange={setDentista}>
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder="Selecione o profissional" />
                  </SelectTrigger>
                  <SelectContent>
                    {dentistasAtivos.length > 0 ? (
                      dentistasAtivos.map((d) => (
                        <SelectItem key={d.id} value={d.nome} className="text-xs">
                          {d.nome}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" className="text-xs">
                        Profissional da Clínica
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 4. Motivo / Procedimento do Retorno */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Motivo do Retorno</Label>
              <Input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex: Consulta de Retorno, Pós-Operatório..."
                className="h-9 text-xs bg-background"
                list="motivos-retorno-sugeridos"
              />
              <datalist id="motivos-retorno-sugeridos">
                {MOTIVOS_RETORNO.map((m, idx) => (
                  <option key={idx} value={m} />
                ))}
              </datalist>

              {/* Chips rápidos de motivo */}
              <div className="flex flex-wrap gap-1 pt-1">
                {['Revisão', 'Pós-Op', 'Manutenção', 'Pontos', 'Ortodontia'].map((chip, idx) => {
                  const nomeCompleto = 
                    chip === 'Revisão' ? 'Revisão / Avaliação Geral' :
                    chip === 'Pós-Op' ? 'Revisão Pós-Operatório' :
                    chip === 'Manutenção' ? 'Manutenção Preventiva' :
                    chip === 'Pontos' ? 'Retirada de Pontos' :
                    'Controle Ortodôntico';
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setMotivo(nomeCompleto)}
                      className="text-[10px] px-1.5 py-0.5 rounded border border-border/80 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. Observações Opcionais */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">
                Observações Clínicas (Opcional)
              </Label>
              <Input
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Checar cicatrização, remoção de suturas..."
                className="h-8 text-xs bg-background"
              />
            </div>

            {/* 6. Opção WhatsApp */}
            {patient.telefone && (
              <label className="flex items-center gap-2 cursor-pointer pt-0.5 select-none text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={notificarWhatsApp}
                  onChange={(e) => setNotificarWhatsApp(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                />
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                  Enviar confirmação por WhatsApp para {patient.telefone}
                </span>
              </label>
            )}

            {/* 7. Botões de Ação */}
            <div className="space-y-2 pt-2">
              <Button
                onClick={handleSalvarRetorno}
                disabled={loading}
                className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs gap-1.5"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <CalendarCheck className="h-3.5 w-3.5" />
                    <span>{modoEdicao ? 'Confirmar Remarcação' : 'Confirmar Agendamento de Retorno'}</span>
                  </>
                )}
              </Button>

              {onOpenFullModal && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onOpenFullModal}
                  className="w-full h-7 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Abrir na Agenda Completa
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AgendarRetornoCard;
