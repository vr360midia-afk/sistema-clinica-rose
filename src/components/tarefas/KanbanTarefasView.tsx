import React from 'react';
import {
  TarefaInterna,
  StatusTarefa,
  TIPO_TAREFA_INFO,
} from '@/hooks/useTarefasInternas';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Clock,
  Calendar,
  User,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Plus,
} from 'lucide-react';

interface KanbanTarefasViewProps {
  tarefas: TarefaInterna[];
  onOpenNovaTarefa: () => void;
  onEditTarefa: (tarefa: TarefaInterna) => void;
  onUpdateStatus: (id: string, novoStatus: StatusTarefa) => void;
}

const COLUNAS: { status: StatusTarefa; titulo: string; cor: string; badge: string }[] = [
  { status: 'pendente', titulo: 'A Fazer / Pendentes', cor: 'border-amber-500/30 bg-amber-500/5', badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  { status: 'em_andamento', titulo: 'Em Andamento', cor: 'border-blue-500/30 bg-blue-500/5', badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  { status: 'concluida', titulo: 'Concluídas', cor: 'border-emerald-500/30 bg-emerald-500/5', badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
];

export const KanbanTarefasView: React.FC<KanbanTarefasViewProps> = ({
  tarefas,
  onOpenNovaTarefa,
  onEditTarefa,
  onUpdateStatus,
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
    }

    window.open(`https://wa.me/${foneCompleto}?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
      {COLUNAS.map((col) => {
        const tarefasDaColuna = tarefas.filter((t) => t.status === col.status);

        return (
          <div
            key={col.status}
            className={`rounded-xl border ${col.cor} p-3 space-y-3 flex flex-col min-h-[450px] shadow-xs`}
          >
            {/* Cabeçalho da Coluna */}
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">{col.titulo}</span>
                <Badge variant="secondary" className={`text-[10px] font-bold ${col.badge}`}>
                  {tarefasDaColuna.length}
                </Badge>
              </div>

              {col.status === 'pendente' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onOpenNovaTarefa}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  title="Nova Tarefa"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* Lista de Cards da Coluna */}
            <div className="space-y-2 flex-1 overflow-y-auto max-h-[72vh] pr-0.5">
              {tarefasDaColuna.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  Nenhuma tarefa nesta etapa
                </div>
              ) : (
                tarefasDaColuna.map((t) => {
                  const info = TIPO_TAREFA_INFO[t.tipo] || TIPO_TAREFA_INFO.geral;
                  const isAtrasada = col.status !== 'concluida' && t.data < hojeStr;
                  const fone = t.leadTelefone || t.pacienteTelefone;

                  return (
                    <div
                      key={t.id}
                      className="rounded-lg border bg-card p-3 shadow-xs space-y-2 hover:border-primary/50 transition-all cursor-pointer"
                      onClick={() => onEditTarefa(t)}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <Badge variant="outline" className={`text-[10px] font-semibold ${info.badgeClass}`}>
                          {info.icon} {info.label.split(' ')[0]}
                        </Badge>

                        {isAtrasada && (
                          <Badge className="bg-rose-500 text-white text-[9px] py-0 h-4 font-bold">
                            Atrasada
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs font-bold text-foreground leading-snug">
                        {t.titulo}
                      </div>

                      {t.descricao && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                          {t.descricao}
                        </p>
                      )}

                      {(t.leadNome || t.pacienteNome) && (
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-foreground">
                          <User className="h-3 w-3 text-primary shrink-0" />
                          <span className="truncate">{t.leadNome || t.pacienteNome}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t">
                        <span className="flex items-center gap-1 font-medium">
                          <Calendar className="h-3 w-3" />
                          {t.data.split('-').reverse().join('/')}
                          {t.hora && ` • ${t.hora}`}
                        </span>

                        {t.responsavel && (
                          <span className="truncate max-w-[80px]">{t.responsavel}</span>
                        )}
                      </div>

                      {/* Botões de Ação Rápida */}
                      <div
                        className="pt-1 flex items-center justify-between gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {fone ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => abrirWhatsApp(t)}
                            className="h-6 text-[10px] px-2 font-semibold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <MessageSquare className="h-3 w-3" />
                            WhatsApp
                          </Button>
                        ) : (
                          <div />
                        )}

                        <div className="flex items-center gap-1">
                          {col.status !== 'pendente' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                onUpdateStatus(t.id, col.status === 'concluida' ? 'em_andamento' : 'pendente')
                              }
                              className="h-6 text-[10px] px-1.5 text-muted-foreground"
                              title="Voltar etapa"
                            >
                              <ArrowLeft className="h-3 w-3" />
                            </Button>
                          )}

                          {col.status !== 'concluida' && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                onUpdateStatus(t.id, col.status === 'pendente' ? 'em_andamento' : 'concluida')
                              }
                              className="h-6 text-[10px] px-2 font-semibold gap-1"
                            >
                              {col.status === 'pendente' ? 'Iniciar' : 'Concluir'}
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
