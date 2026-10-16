import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CalendarCheck2,
  MessageSquare,
  Clock,
  ArrowRight,
  Plus,
  CheckCircle2,
  PhoneCall,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTarefasInternas, TIPO_TAREFA_INFO, TarefaInterna } from '@/hooks/useTarefasInternas';

export const TarefasHojeWidget: React.FC = () => {
  const navigate = useNavigate();
  const { tarefas, alternarConcluida, metricas } = useTarefasInternas();
  const hojeStr = new Date().toISOString().split('T')[0];

  // Tarefas para hoje ou atrasadas
  const tarefasHoje = tarefas
    .filter((t) => t.data <= hojeStr && t.status !== 'concluida')
    .slice(0, 4);

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
    }

    window.open(`https://wa.me/${foneCompleto}?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  return (
    <Card className="shadow-xs border hover:border-primary/40 transition-all flex flex-col justify-between">
      <CardHeader className="p-3 sm:p-4 pb-2 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
            <CalendarCheck2 className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              Tarefas & Leads de Hoje
              {metricas.hoje > 0 && (
                <Badge className="bg-emerald-600 text-white text-[10px] py-0 h-4 font-bold">
                  {metricas.hoje}
                </Badge>
              )}
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">Follow-ups e contatos pendentes</p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/tarefas')}
          className="h-7 text-xs font-semibold text-primary hover:text-primary gap-1 px-2"
        >
          Ver Todas
          <ArrowRight className="h-3 w-3" />
        </Button>
      </CardHeader>

      <CardContent className="p-3 sm:p-4 pt-1 space-y-2 flex-1">
        {tarefasHoje.length === 0 ? (
          <div className="py-6 text-center space-y-1.5">
            <div className="text-lg">🎉</div>
            <p className="text-xs font-medium text-foreground">Todas as tarefas de hoje estão concluídas!</p>
            <p className="text-[11px] text-muted-foreground">Nenhum lead ou contato pendente para hoje.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/tarefas')}
              className="h-7 text-xs font-medium mt-1"
            >
              <Plus className="h-3 w-3 mr-1" />
              Agendar Nova Tarefa
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {tarefasHoje.map((t) => {
              const info = TIPO_TAREFA_INFO[t.tipo] || TIPO_TAREFA_INFO.geral;
              const fone = t.leadTelefone || t.pacienteTelefone;
              const isAtrasada = t.data < hojeStr;

              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => alternarConcluida(t.id, true)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                      title="Concluir tarefa"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-foreground truncate">{t.titulo}</span>
                        {isAtrasada && (
                          <Badge variant="destructive" className="text-[9px] py-0 h-3.5 px-1 uppercase font-bold">
                            Atrasada
                          </Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                        <span>{info.icon} {info.label.split(' ')[0]}</span>
                        {t.hora && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" /> {t.hora}
                          </span>
                        )}
                        {(t.leadNome || t.pacienteNome) && (
                          <span className="font-semibold text-foreground truncate max-w-[100px]">
                            • {t.leadNome || t.pacienteNome}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {fone ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => abrirWhatsApp(t)}
                      className="h-6 text-[10px] px-2 font-semibold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                    >
                      <MessageSquare className="h-3 w-3" />
                      WhatsApp
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/tarefas')}
                      className="h-6 text-[10px] px-1 text-muted-foreground"
                    >
                      Ver
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
