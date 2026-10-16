import React, { useState, useMemo } from 'react';
import {
  TarefaInterna,
  TIPO_TAREFA_INFO,
} from '@/hooks/useTarefasInternas';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Phone,
  MessageSquare,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface CalendarioTarefasViewProps {
  tarefas: TarefaInterna[];
  onOpenNovaTarefa: (dataDefault?: string) => void;
  onEditTarefa: (tarefa: TarefaInterna) => void;
  onToggleConcluida: (id: string, concluida: boolean) => void;
  dataSelecionada: string;
  onSelectData: (dataStr: string) => void;
}

const DIAS_DA_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const CalendarioTarefasView: React.FC<CalendarioTarefasViewProps> = ({
  tarefas,
  onOpenNovaTarefa,
  onEditTarefa,
  onToggleConcluida,
  dataSelecionada,
  onSelectData,
}) => {
  const hoje = new Date();
  const hojeStr = hoje.toISOString().split('T')[0];

  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear());
  const [mesAtual, setMesAtual] = useState(hoje.getMonth()); // 0-11

  const mesAnterior = () => {
    if (mesAtual === 0) {
      setMesAtual(11);
      setAnoAtual((prev) => prev - 1);
    } else {
      setMesAtual((prev) => prev - 1);
    }
  };

  const proximoMes = () => {
    if (mesAtual === 11) {
      setMesAtual(0);
      setAnoAtual((prev) => prev + 1);
    } else {
      setMesAtual((prev) => prev + 1);
    }
  };

  const irParaHoje = () => {
    setAnoAtual(hoje.getFullYear());
    setMesAtual(hoje.getMonth());
    onSelectData(hojeStr);
  };

  // Mapeia tarefas por data (YYYY-MM-DD -> TarefaInterna[])
  const tarefasPorData = useMemo(() => {
    const map: Record<string, TarefaInterna[]> = {};
    tarefas.forEach((t) => {
      if (!map[t.data]) map[t.data] = [];
      map[t.data].push(t);
    });
    return map;
  }, [tarefas]);

  // Monta a matriz de dias do mês
  const matrizDias = useMemo(() => {
    const primeiroDiaSemana = new Date(anoAtual, mesAtual, 1).getDay(); // 0 a 6
    const totalDiasMes = new Date(anoAtual, mesAtual + 1, 0).getDate();
    const totalDiasMesAnterior = new Date(anoAtual, mesAtual, 0).getDate();

    const dias: {
      dia: number;
      mesOffset: number; // -1 anterior, 0 atual, 1 proximo
      dateStr: string;
      isHoje: boolean;
      isSelected: boolean;
    }[] = [];

    // Dias do mês anterior para preencher a primeira semana
    for (let i = primeiroDiaSemana - 1; i >= 0; i--) {
      const d = totalDiasMesAnterior - i;
      const prevMonth = mesAtual === 0 ? 11 : mesAtual - 1;
      const prevYear = mesAtual === 0 ? anoAtual - 1 : anoAtual;
      const dStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      dias.push({
        dia: d,
        mesOffset: -1,
        dateStr: dStr,
        isHoje: dStr === hojeStr,
        isSelected: dStr === dataSelecionada,
      });
    }

    // Dias do mês atual
    for (let d = 1; d <= totalDiasMes; d++) {
      const dStr = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      dias.push({
        dia: d,
        mesOffset: 0,
        dateStr: dStr,
        isHoje: dStr === hojeStr,
        isSelected: dStr === dataSelecionada,
      });
    }

    // Dias do próximo mês para completar a grade de 35 ou 42 células
    const totalSlots = dias.length > 35 ? 42 : 35;
    const restantes = totalSlots - dias.length;
    for (let d = 1; d <= restantes; d++) {
      const nextMonth = mesAtual === 11 ? 0 : mesAtual + 1;
      const nextYear = mesAtual === 11 ? anoAtual + 1 : anoAtual;
      const dStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      dias.push({
        dia: d,
        mesOffset: 1,
        dateStr: dStr,
        isHoje: dStr === hojeStr,
        isSelected: dStr === dataSelecionada,
      });
    }

    return dias;
  }, [anoAtual, mesAtual, hojeStr, dataSelecionada]);

  // Tarefas do dia selecionado
  const tarefasDoDiaSelecionado = useMemo(() => {
    return (tarefasPorData[dataSelecionada] || []).sort((a, b) => {
      // Pendentes primeiro, depois por horário
      if (a.status === 'concluida' && b.status !== 'concluida') return 1;
      if (a.status !== 'concluida' && b.status === 'concluida') return -1;
      return (a.hora || '23:59').localeCompare(b.hora || '23:59');
    });
  }, [tarefasPorData, dataSelecionada]);

  // Disparar WhatsApp para Lead ou Paciente
  const abrirWhatsApp = (tarefa: TarefaInterna) => {
    const fone = tarefa.leadTelefone || tarefa.pacienteTelefone;
    if (!fone) return;
    const numeros = fone.replace(/\D/g, '');
    const foneCompleto = numeros.startsWith('55') ? numeros : `55${numeros}`;
    const nome = tarefa.leadNome || tarefa.pacienteNome || 'tudo bem?';

    let mensagem = `Olá ${nome}, tudo bem? Aqui é da equipe da Clínica. Entramos em contato a respeito da sua solicitação. Como podemos te ajudar?`;
    if (tarefa.tipo === 'chamar_lead') {
      mensagem = `Olá ${nome}! Vimos seu interesse em cuidar do seu sorriso conosco. Gostaria de agendar uma avaliação inicial sem compromisso?`;
    } else if (tarefa.tipo === 'followup_orcamento') {
      mensagem = `Olá ${nome}! Passando para saber se você ficou com alguma dúvida sobre o plano de tratamento ou formas de pagamento que conversamos?`;
    } else if (tarefa.tipo === 'pos_operatorio') {
      mensagem = `Olá ${nome}! Estamos passando para saber como você está se sentindo hoje após o procedimento? Está conseguindo repousar e tomar os medicamentos prescritos?`;
    } else if (tarefa.tipo === 'confirmar_paciente') {
      mensagem = `Olá ${nome}! Confirmando seu horário de atendimento conosco amanhã na clínica. Podemos confirmar sua presença?`;
    }

    window.open(`https://wa.me/${foneCompleto}?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Barra de Navegação do Mês */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-xl border shadow-xs">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={mesAnterior} className="h-8 w-8 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-base font-bold text-foreground min-w-[170px] text-center sm:text-left">
            {MESES[mesAtual]} <span className="text-primary font-extrabold">{anoAtual}</span>
          </h2>
          <Button variant="outline" size="sm" onClick={proximoMes} className="h-8 w-8 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={irParaHoje} className="h-8 text-xs font-semibold text-primary ml-1">
            Hoje
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => onOpenNovaTarefa(dataSelecionada)}
            className="h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar Tarefa
          </Button>
        </div>
      </div>

      {/* Grade do Calendário */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        {/* Cabeçalho dos Dias da Semana */}
        <div className="grid grid-cols-7 border-b bg-muted/30 text-center text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-2">
          {DIAS_DA_SEMANA.map((dia, idx) => (
            <div key={dia} className={idx === 0 || idx === 6 ? 'text-amber-600 dark:text-amber-400' : ''}>
              {dia}
            </div>
          ))}
        </div>

        {/* Células de Dias */}
        <div className="grid grid-cols-7 divide-x divide-y border-b text-xs">
          {matrizDias.map((item, idx) => {
            const tarefasDoDia = tarefasPorData[item.dateStr] || [];
            const temAtrasadas = item.dateStr < hojeStr && tarefasDoDia.some((t) => t.status !== 'concluida');
            const totalPendentes = tarefasDoDia.filter((t) => t.status !== 'concluida').length;

            return (
              <div
                key={idx}
                onClick={() => onSelectData(item.dateStr)}
                className={`min-h-[92px] sm:min-h-[115px] p-1.5 transition-colors relative cursor-pointer flex flex-col justify-between group ${
                  item.mesOffset !== 0 ? 'bg-muted/20 text-muted-foreground/60' : 'bg-card text-foreground'
                } ${item.isSelected ? 'ring-2 ring-inset ring-primary bg-primary/5' : 'hover:bg-muted/40'}`}
              >
                {/* Linha do Topo da Célula */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-[11px] font-semibold inline-flex items-center justify-center w-6 h-6 rounded-full ${
                        item.isHoje
                          ? 'bg-primary text-primary-foreground font-extrabold shadow-xs'
                          : item.isSelected
                          ? 'bg-muted text-foreground font-bold'
                          : 'text-foreground'
                      }`}
                    >
                      {item.dia}
                    </span>
                    {temAtrasadas && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" title="Tarefas atrasadas!" />
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {totalPendentes > 0 && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1 py-0 h-4 font-bold bg-muted text-muted-foreground"
                      >
                        {totalPendentes}
                      </Badge>
                    )}
                    {/* Botão rápido + ao passar o mouse */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenNovaTarefa(item.dateStr);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      title="Adicionar tarefa neste dia"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Lista de Pills das Tarefas */}
                <div className="space-y-1 my-1 overflow-hidden">
                  {tarefasDoDia.slice(0, 3).map((t) => {
                    const info = TIPO_TAREFA_INFO[t.tipo] || TIPO_TAREFA_INFO.geral;
                    const isConcluida = t.status === 'concluida';
                    return (
                      <div
                        key={t.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditTarefa(t);
                        }}
                        className={`text-[10px] px-1.5 py-0.5 rounded truncate border font-medium flex items-center gap-1 transition-transform hover:scale-[1.02] ${
                          isConcluida
                            ? 'line-through text-muted-foreground bg-muted/30 border-muted'
                            : info.badgeClass
                        }`}
                        title={`${t.titulo} ${t.hora ? `(${t.hora})` : ''}`}
                      >
                        <span className="shrink-0">{info.icon}</span>
                        <span className="truncate">{t.titulo}</span>
                      </div>
                    );
                  })}

                  {tarefasDoDia.length > 3 && (
                    <div className="text-[9px] text-muted-foreground font-semibold px-1">
                      +{tarefasDoDia.length - 3} mais
                    </div>
                  )}
                </div>

                {/* Marcador de rodapé do dia */}
                <div className="h-1" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Painel do Dia Selecionado */}
      <div className="rounded-xl border bg-card p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                Tarefas para {dataSelecionada === hojeStr ? 'Hoje' : dataSelecionada.split('-').reverse().join('/')}
                <Badge variant="outline" className="text-xs font-semibold">
                  {tarefasDoDiaSelecionado.length} {tarefasDoDiaSelecionado.length === 1 ? 'tarefa' : 'tarefas'}
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground">
                Clique na tarefa para editar ou no botão verde para chamar o lead diretamente no WhatsApp.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => onOpenNovaTarefa(dataSelecionada)}
            className="h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 self-start sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova Tarefa para este dia
          </Button>
        </div>

        {/* Lista de Tarefas do Dia */}
        {tarefasDoDiaSelecionado.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto text-lg">
              ✨
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              Nenhuma tarefa agendada para este dia.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenNovaTarefa(dataSelecionada)}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Agendar Tarefa
            </Button>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tarefasDoDiaSelecionado.map((t) => {
              const info = TIPO_TAREFA_INFO[t.tipo] || TIPO_TAREFA_INFO.geral;
              const isConcluida = t.status === 'concluida';
              const fone = t.leadTelefone || t.pacienteTelefone;

              return (
                <div
                  key={t.id}
                  className={`p-3 rounded-lg border transition-all space-y-2 flex flex-col justify-between ${
                    isConcluida
                      ? 'bg-muted/30 border-muted opacity-75'
                      : 'bg-card hover:border-primary/50 shadow-xs'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={isConcluida}
                          onChange={(e) => onToggleConcluida(t.id, e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                          title="Marcar como concluída"
                        />
                        <span
                          onClick={() => onEditTarefa(t)}
                          className={`text-xs font-bold truncate cursor-pointer hover:underline ${
                            isConcluida ? 'line-through text-muted-foreground' : 'text-foreground'
                          }`}
                        >
                          {t.titulo}
                        </span>
                      </div>

                      <Badge variant="outline" className={`text-[10px] shrink-0 font-semibold ${info.badgeClass}`}>
                        {info.icon} {t.tipo === 'chamar_lead' ? 'Lead' : info.label.split(' ')[0]}
                      </Badge>
                    </div>

                    {t.descricao && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 pl-5">
                        {t.descricao}
                      </p>
                    )}

                    {/* Vínculo Lead / Paciente */}
                    {(t.leadNome || t.pacienteNome) && (
                      <div className="pl-5 flex items-center gap-1.5 text-[11px] text-foreground font-semibold">
                        <span className="text-muted-foreground text-[10px]">Contato:</span>
                        <span className="truncate">{t.leadNome || t.pacienteNome}</span>
                      </div>
                    )}

                    {/* Horário e Responsável */}
                    <div className="pl-5 flex items-center gap-2 text-[10px] text-muted-foreground">
                      {t.hora && (
                        <span className="flex items-center gap-0.5 font-medium">
                          <Clock className="h-3 w-3" /> {t.hora}
                        </span>
                      )}
                      {t.responsavel && (
                        <span className="truncate">• {t.responsavel}</span>
                      )}
                    </div>
                  </div>

                  {/* Ações Rápidas no Rodapé do Card */}
                  <div className="pt-2 border-t flex items-center justify-between gap-1 pl-5">
                    {fone ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => abrirWhatsApp(t)}
                        className="h-7 text-[11px] px-2 font-semibold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      >
                        <MessageSquare className="h-3 w-3" />
                        Chamar no WhatsApp
                      </Button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground italic">
                        Sem telefone vinculado
                      </span>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditTarefa(t)}
                      className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                    >
                      Editar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
