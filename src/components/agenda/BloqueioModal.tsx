import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Lock, Clock, Calendar as CalendarIcon, User, AlignLeft, Sparkles } from 'lucide-react';
import { BloqueioAgenda, toISODate } from '@/hooks/useBloqueios';
import { useDentistas } from '@/hooks/useDentistas';
import { toast } from 'sonner';

interface BloqueioModalProps {
  isOpen: boolean;
  onClose: () => void;
  bloqueioToEdit?: BloqueioAgenda | null;
  initialDate?: Date;
  initialStartTime?: string;
  initialEndTime?: string;
  onSave: (data: Omit<BloqueioAgenda, 'id'>, id?: string) => Promise<boolean | void>;
}

const PRESET_SUGESTOES = [
  { titulo: 'Almoço', diaInteiro: false, horaInicio: '12:00', horaFim: '13:00', icon: '🍽️', desc: 'Horário reservado para almoço da equipe' },
  { titulo: 'Reunião de Equipe', diaInteiro: false, horaInicio: '08:00', horaFim: '09:00', icon: '👥', desc: 'Alinhamento clínico e operacional' },
  { titulo: 'Manutenção', diaInteiro: false, horaInicio: '14:00', horaFim: '16:00', icon: '🔧', desc: 'Manutenção preventiva de equipamentos e cadeira' },
  { titulo: 'Ausência Particular', diaInteiro: false, horaInicio: '16:00', horaFim: '18:00', icon: '🚗', desc: 'Compromisso pessoal inadiável' },
  { titulo: 'Férias / Recesso', diaInteiro: true, horaInicio: '', horaFim: '', icon: '🏖️', desc: 'Período de recesso / férias' },
  { titulo: 'Curso / Congresso', diaInteiro: true, horaInicio: '', horaFim: '', icon: '📚', desc: 'Participação em congresso ou capacitação' },
];

export const BloqueioModal: React.FC<BloqueioModalProps> = ({
  isOpen,
  onClose,
  bloqueioToEdit,
  initialDate,
  initialStartTime,
  initialEndTime,
  onSave,
}) => {
  const { dentistas } = useDentistas();

  const [titulo, setTitulo] = useState('');
  const [dentista, setDentista] = useState('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [diaInteiro, setDiaInteiro] = useState(false);
  const [horaInicio, setHoraInicio] = useState('12:00');
  const [horaFim, setHoraFim] = useState('13:00');
  const [observacoes, setObservacoes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (bloqueioToEdit) {
      setTitulo(bloqueioToEdit.titulo || '');
      setDentista(bloqueioToEdit.dentista || 'todos');
      setDataInicio(bloqueioToEdit.dataInicio || toISODate(new Date()));
      setDataFim(bloqueioToEdit.dataFim || bloqueioToEdit.dataInicio || toISODate(new Date()));
      setDiaInteiro(!!bloqueioToEdit.diaInteiro);
      setHoraInicio(bloqueioToEdit.horaInicio || '12:00');
      setHoraFim(bloqueioToEdit.horaFim || '13:00');
      setObservacoes(bloqueioToEdit.observacoes || '');
    } else {
      const defaultDate = initialDate ? toISODate(initialDate) : toISODate(new Date());
      setTitulo('');
      setDentista('todos');
      setDataInicio(defaultDate);
      setDataFim(defaultDate);
      setDiaInteiro(false);
      setHoraInicio(initialStartTime || '12:00');
      setHoraFim(initialEndTime || '13:00');
      setObservacoes('');
    }
  }, [isOpen, bloqueioToEdit, initialDate, initialStartTime, initialEndTime]);

  const handleApplyPreset = (preset: typeof PRESET_SUGESTOES[0]) => {
    setTitulo(preset.titulo);
    setDiaInteiro(preset.diaInteiro);
    if (!preset.diaInteiro) {
      setHoraInicio(preset.horaInicio);
      setHoraFim(preset.horaFim);
    }
    if (!observacoes) {
      setObservacoes(preset.desc);
    }
  };

  const handleDataInicioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDataInicio(val);
    if (!dataFim || dataFim < val) {
      setDataFim(val);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!titulo.trim()) {
      toast.error('Informe o título do bloqueio.');
      return;
    }

    if (!dataInicio) {
      toast.error('Informe a data de início.');
      return;
    }

    const dataFinal = dataFim || dataInicio;
    if (dataFinal < dataInicio) {
      toast.error('A data final não pode ser anterior à data inicial.');
      return;
    }

    if (!diaInteiro) {
      if (!horaInicio || !horaFim) {
        toast.error('Informe os horários de início e término.');
        return;
      }
      if (dataInicio === dataFinal && horaFim <= horaInicio) {
        toast.error('O horário de término deve ser após o horário de início.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload: Omit<BloqueioAgenda, 'id'> = {
        titulo: titulo.trim(),
        dentista: dentista === 'todos' ? null : dentista,
        dataInicio,
        dataFim: dataFinal,
        diaInteiro,
        horaInicio: diaInteiro ? null : horaInicio,
        horaFim: diaInteiro ? null : horaFim,
        observacoes: observacoes.trim() || null,
      };

      const success = await onSave(payload, bloqueioToEdit?.id);
      if (success !== false) {
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg w-full max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                {bloqueioToEdit ? 'Editar Bloqueio de Horário' : 'Bloquear Horário na Agenda'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Impeça novos agendamentos e indique claramente o motivo do bloqueio.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Sugestões Rápidas */}
        {!bloqueioToEdit && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Sugestões rápidas:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_SUGESTOES.map((preset) => (
                <button
                  key={preset.titulo}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-border bg-muted/40 hover:bg-amber-500/10 hover:border-amber-500/40 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                >
                  <span>{preset.icon}</span>
                  <span>{preset.titulo}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Título do Bloqueio */}
          <div className="space-y-1.5">
            <Label htmlFor="titulo" className="text-xs font-semibold">
              Título / Motivo <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="titulo"
                placeholder="Ex.: Almoço, Reunião de Equipe, Manutenção..."
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={100}
                required
                className="pl-9"
              />
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Dentista Afetado */}
          <div className="space-y-1.5">
            <Label htmlFor="dentista" className="text-xs font-semibold flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              Profissional / Dentista
            </Label>
            <Select value={dentista} onValueChange={setDentista}>
              <SelectTrigger id="dentista" className="w-full">
                <SelectValue placeholder="Selecione o profissional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os profissionais (Clínica toda)</SelectItem>
                {dentistas
                  .filter((d) => d.ativo)
                  .map((d) => (
                    <SelectItem key={d.id} value={d.nome}>
                      Dr(a). {d.nome} {d.especialidade ? `(${d.especialidade})` : ''}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Selecione &quot;Todos&quot; para travar o horário em todas as cadeiras ou escolha um dentista específico.
            </p>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dataInicio" className="text-xs font-semibold flex items-center gap-1">
                <CalendarIcon className="h-3.5 w-3.5" />
                Data de Início
              </Label>
              <Input
                id="dataInicio"
                type="date"
                value={dataInicio}
                onChange={handleDataInicioChange}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dataFim" className="text-xs font-semibold flex items-center gap-1">
                <CalendarIcon className="h-3.5 w-3.5" />
                Data de Término
              </Label>
              <Input
                id="dataFim"
                type="date"
                value={dataFim}
                min={dataInicio}
                onChange={(e) => setDataFim(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Dia inteiro switch */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/20">
            <div className="space-y-0.5">
              <Label htmlFor="dia-inteiro-toggle" className="text-sm font-medium cursor-pointer">
                Dia Inteiro
              </Label>
              <p className="text-xs text-muted-foreground">
                Bloqueia a jornada completa para os dias selecionados
              </p>
            </div>
            <Switch
              id="dia-inteiro-toggle"
              checked={diaInteiro}
              onCheckedChange={setDiaInteiro}
            />
          </div>

          {/* Horários (se não for dia inteiro) */}
          {!diaInteiro && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-muted/20 rounded-lg border border-border">
              <div className="space-y-1.5">
                <Label htmlFor="horaInicio" className="text-xs font-semibold flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                  Hora Início
                </Label>
                <Input
                  id="horaInicio"
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="horaFim" className="text-xs font-semibold flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                  Hora Término
                </Label>
                <Input
                  id="horaFim"
                  type="time"
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {/* Descrição detalhada (Requisito fundamental do usuário) */}
          <div className="space-y-1.5">
            <Label htmlFor="observacoes" className="text-xs font-semibold flex items-center gap-1">
              <AlignLeft className="h-3.5 w-3.5 text-primary" />
              Descrição / Observações
            </Label>
            <Textarea
              id="observacoes"
              placeholder="Descreva o motivo do bloqueio (ex.: Manutenção preventiva da cadeira 2, almoço da equipe, reunião de fechamento de mês, etc.)..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              maxLength={500}
              className="resize-none text-sm"
            />
            <div className="flex justify-between items-center text-[11px] text-muted-foreground">
              <span>Esta descrição será exibida no calendário e nos detalhes do bloqueio.</span>
              <span>{observacoes.length}/500</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            >
              {submitting ? 'Salvando...' : (bloqueioToEdit ? 'Atualizar Bloqueio' : 'Confirmar Bloqueio')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BloqueioModal;
