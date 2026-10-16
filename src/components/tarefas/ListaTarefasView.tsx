import React from 'react';
import {
  TarefaInterna,
  TIPO_TAREFA_INFO,
} from '@/hooks/useTarefasInternas';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Phone,
  Clock,
  Calendar,
  User,
  Trash2,
  Edit,
  CheckCircle2,
  AlertCircle,
  Plus,
} from 'lucide-react';

interface ListaTarefasViewProps {
  tarefas: TarefaInterna[];
  onOpenNovaTarefa: () => void;
  onEditTarefa: (tarefa: TarefaInterna) => void;
  onToggleConcluida: (id: string, concluida: boolean) => void;
  onRemoverTarefa: (id: string) => void;
}

export const ListaTarefasView: React.FC<ListaTarefasViewProps> = ({
  tarefas,
  onOpenNovaTarefa,
  onEditTarefa,
  onToggleConcluida,
  onRemoverTarefa,
}) => {
  const hojeStr = new Date().toISOString().split('T')[0];

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

  if (tarefas.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center space-y-3 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto text-xl">
          ✨
        </div>
        <h3 className="text-sm font-bold text-foreground">Nenhuma tarefa encontrada neste filtro</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Tudo em dia! Você pode criar novas tarefas para agendar follow-up de leads, orçamentos ou pós-operatório.
        </p>
        <Button
          onClick={onOpenNovaTarefa}
          size="sm"
          className="h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova Tarefa
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tarefas.map((t) => {
        const info = TIPO_TAREFA_INFO[t.tipo] || TIPO_TAREFA_INFO.geral;
        const isConcluida = t.status === 'concluida';
        const isAtrasada = !isConcluida && t.data < hojeStr;
        const isHoje = t.data === hojeStr;
        const fone = t.leadTelefone || t.pacienteTelefone;

        return (
          <div
            key={t.id}
            className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isConcluida
                ? 'bg-muted/30 border-muted opacity-75'
                : isAtrasada
                ? 'bg-rose-500/5 border-rose-500/30 shadow-xs'
                : 'bg-card hover:border-primary/40 shadow-xs'
            }`}
          >
            {/* Lado Esquerdo: Checkbox + Título + Detalhes */}
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <input
                type="checkbox"
                checked={isConcluida}
                onChange={(e) => onToggleConcluida(t.id, e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                title="Marcar como concluída"
              />

              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    onClick={() => onEditTarefa(t)}
                    className={`text-xs font-bold truncate cursor-pointer hover:underline ${
                      isConcluida ? 'line-through text-muted-foreground' : 'text-foreground'
                    }`}
                  >
                    {t.titulo}
                  </span>

                  <Badge variant="outline" className={`text-[10px] font-semibold ${info.badgeClass}`}>
                    {info.icon} {info.label}
                  </Badge>

                  {t.prioridade === 'alta' && (
                    <Badge variant="destructive" className="text-[10px] uppercase font-bold py-0 h-4">
                      Alta
                    </Badge>
                  )}

                  {isAtrasada && (
                    <Badge className="bg-rose-500 text-white text-[10px] py-0 h-4 font-bold flex items-center gap-0.5">
                      <AlertCircle className="h-3 w-3" /> Atrasada
                    </Badge>
                  )}

                  {isHoje && !isConcluida && (
                    <Badge className="bg-primary text-primary-foreground text-[10px] py-0 h-4 font-bold">
                      Hoje
                    </Badge>
                  )}
                </div>

                {t.descricao && (
                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    {t.descricao}
                  </p>
                )}

                {/* Metadados: Contato vinculado, Data, Horário e Responsável */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
                  {(t.leadNome || t.pacienteNome) && (
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      <User className="h-3 w-3 text-primary" />
                      {t.leadNome || t.pacienteNome}
                      {fone && <span className="font-normal text-muted-foreground text-[10px]">({fone})</span>}
                    </span>
                  )}

                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {t.data.split('-').reverse().join('/')}
                    {t.hora && <span className="font-medium">• {t.hora}</span>}
                  </span>

                  {t.responsavel && (
                    <span>• Resp: <strong className="text-foreground">{t.responsavel}</strong></span>
                  )}
                </div>
              </div>
            </div>

            {/* Lado Direito: Ações */}
            <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-0 w-full sm:w-auto justify-end">
              {fone && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => abrirWhatsApp(t)}
                  className="h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Chamar no WhatsApp
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onEditTarefa(t)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                title="Editar Tarefa"
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemoverTarefa(t.id)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                title="Excluir Tarefa"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
