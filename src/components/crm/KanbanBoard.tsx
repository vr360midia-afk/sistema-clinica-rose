import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  MessageCircle,
  Pencil,
  Trash2,
  Phone,
  ArrowRightLeft,
  Check,
  ChevronDown,
  DollarSign,
  MoveRight,
  User,
  Calendar,
  Clock,
  MessageSquare,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import WhatsAppLeadMenu from './WhatsAppLeadMenu';
import LeadChatModal from './LeadChatModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export interface Lead {
  id: string;
  name?: string | null;
  nome?: string | null;
  phone?: string | null;
  telefone?: string | null;
  stage?: string | null;
  status?: string | null;
  origin?: string | null;
  origem?: string | null;
  last_inbound_at?: string | null;
  last_outbound_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  data_criacao?: string | null;
  campanha?: string | null;
  observacoes?: string | null;
  valor_estimado?: number | null;
  ultima_mensagem?: string | null;
  last_message_direction?: 'in' | 'out' | null;
  last_message_at?: string | null;
}

interface KanbanBoardProps {
  leads: Lead[];
  onLeadsChange: (leads: Lead[]) => void;
  onEditLead: (lead: Lead) => void;
}

export interface ColumnDef {
  id: string;
  title: string;
  color: string;
  headerBg: string;
  badgeBg: string;
  dotColor: string;
}

export const COLUMNS: ColumnDef[] = [
  {
    id: 'novo_lead',
    title: 'Novo Lead',
    color: 'text-blue-700 dark:text-blue-300',
    headerBg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
    badgeBg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200',
    dotColor: 'bg-blue-500',
  },
  {
    id: 'primeiro_contato',
    title: 'Primeiro Contato',
    color: 'text-indigo-700 dark:text-indigo-300',
    headerBg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800',
    badgeBg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200',
    dotColor: 'bg-indigo-500',
  },
  {
    id: 'followup_1',
    title: '1º F-up (3h)',
    color: 'text-slate-700 dark:text-slate-300',
    headerBg: 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800',
    badgeBg: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    dotColor: 'bg-slate-400',
  },
  {
    id: 'followup_2',
    title: '2º F-up (18h)',
    color: 'text-slate-700 dark:text-slate-300',
    headerBg: 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800',
    badgeBg: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    dotColor: 'bg-slate-400',
  },
  {
    id: 'fu_2d',
    title: '3º F-up (2d)',
    color: 'text-slate-700 dark:text-slate-300',
    headerBg: 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800',
    badgeBg: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    dotColor: 'bg-slate-400',
  },
  {
    id: 'fu_5d',
    title: '4º F-up (5d)',
    color: 'text-slate-700 dark:text-slate-300',
    headerBg: 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800',
    badgeBg: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    dotColor: 'bg-slate-400',
  },
  {
    id: 'fu_7d',
    title: '5º F-up (7d)',
    color: 'text-slate-700 dark:text-slate-300',
    headerBg: 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800',
    badgeBg: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    dotColor: 'bg-slate-400',
  },
  {
    id: 'fu_14d',
    title: '6º F-up (14d)',
    color: 'text-slate-700 dark:text-slate-300',
    headerBg: 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800',
    badgeBg: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    dotColor: 'bg-slate-400',
  },
  {
    id: 'fu_21d',
    title: '7º F-up (21d)',
    color: 'text-slate-700 dark:text-slate-300',
    headerBg: 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800',
    badgeBg: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    dotColor: 'bg-slate-400',
  },
  {
    id: 'fu_30d',
    title: '8º F-up (30d)',
    color: 'text-slate-700 dark:text-slate-300',
    headerBg: 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800',
    badgeBg: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    dotColor: 'bg-slate-400',
  },
  {
    id: 'mensal',
    title: 'Mensal',
    color: 'text-amber-700 dark:text-amber-300',
    headerBg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
    badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
    dotColor: 'bg-amber-500',
  },
  {
    id: 'agendado',
    title: 'Consulta Agendada',
    color: 'text-emerald-700 dark:text-emerald-300',
    headerBg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
    badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
    dotColor: 'bg-emerald-500',
  },
  {
    id: 'perdido',
    title: 'Perdido',
    color: 'text-red-700 dark:text-red-300',
    headerBg: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800',
    badgeBg: 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200',
    dotColor: 'bg-red-500',
  },
];

// Normaliza possíveis variações salvas no banco
export const normalizarStatus = (statusOrStage?: string | null): string => {
  if (!statusOrStage) return 'novo_lead';
  if (statusOrStage === 'novo' || statusOrStage === 'novo_lead') return 'novo_lead';
  if (
    statusOrStage === '1_contato' ||
    statusOrStage === 'primeiro-contato' ||
    statusOrStage === 'primeiro_contato' ||
    statusOrStage === 'contato_inicial'
  ) {
    return 'primeiro_contato';
  }
  if (statusOrStage === 'fu_3h' || statusOrStage === 'followup_1') return 'followup_1';
  if (statusOrStage === 'fu_18h' || statusOrStage === 'followup_2') return 'followup_2';
  if (
    statusOrStage === 'consulta_agendada' ||
    statusOrStage === 'agendado_ganho' ||
    statusOrStage === 'agendado'
  ) {
    return 'agendado';
  }
  return statusOrStage;
};

// Formata tempo relativo de contato ("há 15 min", "ontem", etc.)
export function formatTempoRelativo(dataStr?: string | null): string {
  if (!dataStr) return '';
  try {
    const diffMs = Date.now() - new Date(dataStr).getTime();
    if (diffMs < 0) return 'agora';
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `há ${diffMin} min`;
    const diffHoras = Math.floor(diffMin / 60);
    if (diffHoras < 24) return `há ${diffHoras}h`;
    const diffDias = Math.floor(diffHoras / 24);
    if (diffDias === 1) return 'ontem';
    if (diffDias < 7) return `há ${diffDias} dias`;
    return new Date(dataStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return '';
  }
}

export default function KanbanBoard({ leads, onLeadsChange, onEditLead }: KanbanBoardProps) {
  const [columns, setColumns] = useState<Record<string, Lead[]>>({});
  const [leadSelecionadoParaMover, setLeadSelecionadoParaMover] = useState<Lead | null>(null);
  const [leadSelecionadoParaChat, setLeadSelecionadoParaChat] = useState<Lead | null>(null);

  useEffect(() => {
    // Agrupa leads por coluna com normalização
    const grouped: Record<string, Lead[]> = {};
    COLUMNS.forEach((col) => {
      grouped[col.id] = [];
    });

    leads.forEach((lead) => {
      const st = normalizarStatus(lead.stage || lead.status);
      if (grouped[st]) {
        grouped[st].push(lead);
      } else {
        if (!grouped['novo_lead']) grouped['novo_lead'] = [];
        grouped['novo_lead'].push(lead);
      }
    });

    setColumns(grouped);
  }, [leads]);

  // Transfere o lead para uma coluna selecionada
  const handleMoveLeadToColumn = async (lead: Lead, targetColumnId: string) => {
    const statusAtual = normalizarStatus(lead.stage || lead.status);
    if (statusAtual === targetColumnId) {
      setLeadSelecionadoParaMover(null);
      return;
    }

    const targetColDef = COLUMNS.find((c) => c.id === targetColumnId);
    const targetTitle = targetColDef?.title || targetColumnId;

    // Atualização otimista local
    const newColumns: Record<string, Lead[]> = {};
    COLUMNS.forEach((col) => {
      newColumns[col.id] = [...(columns[col.id] || [])];
    });

    Object.keys(newColumns).forEach((colKey) => {
      newColumns[colKey] = newColumns[colKey].filter((l) => l.id !== lead.id);
    });

    const updatedLead: Lead = {
      ...lead,
      stage: targetColumnId,
      status: targetColumnId,
      updated_at: new Date().toISOString(),
    };
    if (!newColumns[targetColumnId]) {
      newColumns[targetColumnId] = [];
    }
    newColumns[targetColumnId].unshift(updatedLead);

    setColumns(newColumns);
    const allLeads = Object.values(newColumns).flat();
    onLeadsChange(allLeads);
    setLeadSelecionadoParaMover(null);

    toast.success(`Lead "${lead.name || lead.nome}" movido para "${targetTitle}"!`);

    try {
      const { error } = await supabase
        .from('crm_leads')
        .update({
          stage: targetColumnId,
          status: targetColumnId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id);

      if (error) throw error;
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao atualizar status do lead no banco');
    }
  };

  // Drag and drop nativo
  const onDragEnd = async (result: any) => {
    if (!result.destination) return;

    const { source, destination } = result;
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const sourceCol = columns[source.droppableId] || [];
    const destCol = columns[destination.droppableId] || [];
    const item = sourceCol[source.index];
    if (!item) return;

    const newColumns = { ...columns };

    if (source.droppableId === destination.droppableId) {
      const reordered = [...newColumns[source.droppableId]];
      reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, item);
      newColumns[source.droppableId] = reordered;
    } else {
      newColumns[source.droppableId] = newColumns[source.droppableId].filter(
        (_, idx) => idx !== source.index
      );
      const updatedItem = {
        ...item,
        stage: destination.droppableId,
        status: destination.droppableId,
        updated_at: new Date().toISOString(),
      };
      const destItems = [...(newColumns[destination.droppableId] || [])];
      destItems.splice(destination.index, 0, updatedItem);
      newColumns[destination.droppableId] = destItems;

      try {
        const { error } = await supabase
          .from('crm_leads')
          .update({
            stage: destination.droppableId,
            status: destination.droppableId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        if (error) throw error;
        const targetColDef = COLUMNS.find((c) => c.id === destination.droppableId);
        toast.success(`Lead movido para "${targetColDef?.title || destination.droppableId}"`);
      } catch (e) {
        console.error(e);
        toast.error('Erro ao mover lead no banco');
      }
    }

    setColumns(newColumns);
    const allLeads = Object.values(newColumns).flat();
    onLeadsChange(allLeads);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este lead?')) return;

    try {
      const { error } = await supabase.from('crm_leads').delete().eq('id', id);
      if (error) throw error;

      toast.success('Lead excluído');
      onLeadsChange(leads.filter((l) => l.id !== id));
      if (leadSelecionadoParaMover?.id === id) {
        setLeadSelecionadoParaMover(null);
      }
      if (leadSelecionadoParaChat?.id === id) {
        setLeadSelecionadoParaChat(null);
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao excluir lead');
    }
  };

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex h-full items-start space-x-3.5 min-w-max px-2 py-1 select-none">
          {COLUMNS.map((col) => {
            const leadsInCol = columns[col.id] || [];
            return (
              <div
                key={col.id}
                className="flex flex-col w-72 bg-slate-50/80 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm h-full max-h-full shrink-0"
              >
                {/* Cabeçalho da Coluna */}
                <div
                  className={`p-3 border-b rounded-t-xl flex justify-between items-center ${col.headerBg}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor} shrink-0`} />
                    <h3 className={`font-semibold text-xs sm:text-sm tracking-tight ${col.color}`}>
                      {col.title}
                    </h3>
                  </div>
                  <Badge
                    variant="outline"
                    className={`font-mono text-xs px-2 py-0.5 border-0 ${col.badgeBg}`}
                  >
                    {leadsInCol.length}
                  </Badge>
                </div>

                {/* Área Droppable */}
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 p-2.5 overflow-y-auto min-h-[160px] transition-colors rounded-b-xl ${
                        snapshot.isDraggingOver
                          ? 'bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-primary/30 ring-inset'
                          : ''
                      }`}
                    >
                      {leadsInCol.map((lead, index) => {
                        const statusLead = normalizarStatus(lead.stage || lead.status);
                        const nomeExibicao = lead.name || lead.nome || 'Paciente';
                        const telefoneExibicao = lead.phone || lead.telefone;
                        const dataUltimoContato =
                          lead.last_message_at ||
                          lead.last_inbound_at ||
                          lead.last_outbound_at ||
                          lead.updated_at ||
                          lead.created_at ||
                          lead.data_criacao;
                        const tempoRelativo = formatTempoRelativo(dataUltimoContato);
                        const origemExibicao = lead.origin || lead.origem || 'WhatsApp';

                        return (
                          <Draggable key={lead.id} draggableId={lead.id} index={index}>
                            {(providedDrag, snapshotDrag) => (
                              <div
                                ref={providedDrag.innerRef}
                                {...providedDrag.draggableProps}
                                {...providedDrag.dragHandleProps}
                                onClick={(e) => {
                                  // Evita acionar ao clicar em botões específicos dentro do card
                                  const target = e.target as HTMLElement;
                                  if (
                                    target.closest(
                                      'button, a, [role="menuitem"], [data-radix-dropdown-menu-content]'
                                    )
                                  ) {
                                    return;
                                  }
                                  // Clique no card abre o Chat do WhatsApp
                                  setLeadSelecionadoParaChat(lead);
                                }}
                                className={`group relative bg-white dark:bg-card p-3 mb-2.5 rounded-lg border border-slate-200 dark:border-border shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer ${
                                  snapshotDrag.isDragging
                                    ? 'rotate-1 scale-105 shadow-xl ring-2 ring-primary/40'
                                    : ''
                                }`}
                              >
                                {/* Linha 1: Nome do Lead + Ações rápidas */}
                                <div className="flex justify-between items-start gap-2 mb-1">
                                  <div className="min-w-0 flex-1">
                                    <h4
                                      className="font-semibold text-xs sm:text-sm text-foreground truncate group-hover:text-primary transition-colors flex items-center gap-1.5"
                                      title={nomeExibicao}
                                    >
                                      <span>{nomeExibicao}</span>
                                    </h4>
                                  </div>

                                  <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity shrink-0">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onEditLead(lead);
                                      }}
                                      className="p-1 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded transition-colors"
                                      title="Editar Informações"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(lead.id);
                                      }}
                                      className="p-1 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded transition-colors"
                                      title="Excluir Lead"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Linha 2: Telefone + Tempo Relativo */}
                                <div className="flex items-center justify-between gap-1 text-xs text-muted-foreground mb-1.5">
                                  {telefoneExibicao && (
                                    <div className="flex items-center font-mono text-[11px] truncate">
                                      <Phone className="h-3 w-3 mr-1 text-slate-400 shrink-0" />
                                      {telefoneExibicao}
                                    </div>
                                  )}
                                  {tempoRelativo && (
                                    <span
                                      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0 font-medium"
                                      title={`Último contato: ${dataUltimoContato ? new Date(dataUltimoContato).toLocaleString('pt-BR') : ''}`}
                                    >
                                      <Clock className="h-2.5 w-2.5 text-slate-400" />
                                      {tempoRelativo}
                                    </span>
                                  )}
                                </div>

                                {/* Linha 3: Trecho da Última Mensagem */}
                                {lead.ultima_mensagem && (
                                  <div className="mb-2 p-1.5 rounded bg-muted/60 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 flex items-start gap-1.5">
                                    {lead.last_message_direction === 'out' ? (
                                      <ArrowUpRight className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                                    ) : (
                                      <ArrowDownLeft className="h-3 w-3 text-blue-500 shrink-0 mt-0.5" />
                                    )}
                                    <span className="truncate italic leading-snug">
                                      "{lead.ultima_mensagem}"
                                    </span>
                                  </div>
                                )}

                                {/* Linha 4: Valor se houver */}
                                {lead.valor_estimado && lead.valor_estimado > 0 ? (
                                  <div className="mb-2">
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800/40">
                                      <DollarSign className="h-3 w-3" />
                                      R${' '}
                                      {Number(lead.valor_estimado).toLocaleString('pt-BR', {
                                        minimumFractionDigits: 2,
                                      })}
                                    </span>
                                  </div>
                                ) : null}

                                {/* Linha 5: Origem + Seletor Mover + Ação WhatsApp */}
                                <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] px-1.5 py-0 font-normal bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 truncate"
                                    >
                                      {origemExibicao}
                                    </Badge>

                                    {/* Mover rápido */}
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button
                                          type="button"
                                          onClick={(e) => e.stopPropagation()}
                                          className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted px-1.5 py-0.5 rounded transition-colors"
                                          title="Mover para outra etapa"
                                        >
                                          <ArrowRightLeft className="h-2.5 w-2.5 mr-0.5 text-primary" />
                                          Mover
                                          <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent
                                        align="start"
                                        className="w-56 max-h-72 overflow-y-auto"
                                      >
                                        <DropdownMenuLabel className="text-xs">
                                          Mover para coluna:
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        {COLUMNS.map((targetCol) => {
                                          const isCurrent = targetCol.id === statusLead;
                                          return (
                                            <DropdownMenuItem
                                              key={targetCol.id}
                                              disabled={isCurrent}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleMoveLeadToColumn(lead, targetCol.id);
                                              }}
                                              className="flex items-center justify-between text-xs py-1.5 cursor-pointer"
                                            >
                                              <span className="flex items-center gap-2 truncate">
                                                <span
                                                  className={`w-2 h-2 rounded-full ${targetCol.dotColor} shrink-0`}
                                                />
                                                <span className={isCurrent ? 'font-bold' : ''}>
                                                  {targetCol.title}
                                                </span>
                                              </span>
                                              {isCurrent && (
                                                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                                              )}
                                            </DropdownMenuItem>
                                          );
                                        })}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <WhatsAppLeadMenu
                                      lead={{
                                        id: lead.id,
                                        nome: nomeExibicao,
                                        telefone: telefoneExibicao || null,
                                        status: statusLead,
                                      }}
                                      buttonVariant="icon"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Modal Interativo de Chat do WhatsApp (Abre ao Clicar no Card) */}
      {leadSelecionadoParaChat && (
        <LeadChatModal
          isOpen={!!leadSelecionadoParaChat}
          onClose={() => setLeadSelecionadoParaChat(null)}
          lead={leadSelecionadoParaChat}
          onLeadUpdated={(leadAtualizado) => {
            const allLeads = Object.values(columns)
              .flat()
              .map((l) => (l.id === leadAtualizado.id ? { ...l, ...leadAtualizado } : l));
            onLeadsChange(allLeads);
          }}
        />
      )}

      {/* Modal de Mover Lead */}
      {leadSelecionadoParaMover && (
        <Dialog
          open={!!leadSelecionadoParaMover}
          onOpenChange={(open) => {
            if (!open) setLeadSelecionadoParaMover(null);
          }}
        >
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <ArrowRightLeft className="h-5 w-5 text-primary" />
                Mover Lead de Coluna
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Selecione abaixo para qual etapa do funil deseja mover o contato{' '}
                <strong className="text-foreground">
                  {leadSelecionadoParaMover.name || leadSelecionadoParaMover.nome}
                </strong>
                :
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[340px] overflow-y-auto p-1">
                {COLUMNS.map((col) => {
                  const isCurrent =
                    col.id ===
                    normalizarStatus(
                      leadSelecionadoParaMover.stage || leadSelecionadoParaMover.status
                    );
                  return (
                    <button
                      key={col.id}
                      type="button"
                      disabled={isCurrent}
                      onClick={() => handleMoveLeadToColumn(leadSelecionadoParaMover, col.id)}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-left text-xs transition-all ${
                        isCurrent
                          ? 'border-primary/50 bg-primary/10 text-primary font-semibold shadow-sm cursor-default opacity-90'
                          : 'border-border bg-card hover:bg-accent hover:border-primary/40 text-foreground cursor-pointer shadow-sm active:scale-[0.98]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor} shrink-0`} />
                        <span className="truncate">{col.title}</span>
                      </div>
                      {isCurrent ? (
                        <span className="flex items-center gap-1 text-[10px] text-primary shrink-0">
                          <Check className="h-3.5 w-3.5" /> Atual
                        </span>
                      ) : (
                        <MoveRight className="h-3.5 w-3.5 text-muted-foreground opacity-60 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t pt-3 mt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLeadSelecionadoParaMover(null)}
                className="h-8 text-xs"
              >
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
