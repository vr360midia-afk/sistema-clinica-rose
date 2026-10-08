import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MessageCircle, Pencil, Trash2, Calendar, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Lead {
  id: string;
  nome: string;
  telefone: string | null;
  status: string;
  origem: string | null;
  valor_estimado: number | null;
  data_criacao: string;
}

interface KanbanBoardProps {
  leads: Lead[];
  onLeadsChange: (leads: Lead[]) => void;
  onEditLead: (lead: Lead) => void;
}

const COLUMNS = [
  { id: 'novo', title: 'Novos', color: 'bg-blue-100 border-blue-200 text-blue-800' },
  { id: 'em_atendimento', title: 'Atendimento', color: 'bg-yellow-100 border-yellow-200 text-yellow-800' },
  { id: 'agendado', title: 'Agendado', color: 'bg-purple-100 border-purple-200 text-purple-800' },
  { id: 'negociando', title: 'Negociando', color: 'bg-orange-100 border-orange-200 text-orange-800' },
  { id: 'ganho', title: 'Ganhos', color: 'bg-green-100 border-green-200 text-green-800' },
  { id: 'perdido', title: 'Perdidos', color: 'bg-red-100 border-red-200 text-red-800' }
];

export default function KanbanBoard({ leads, onLeadsChange, onEditLead }: KanbanBoardProps) {
  const [columns, setColumns] = useState<Record<string, Lead[]>>({});

  useEffect(() => {
    // Group leads by status
    const grouped: Record<string, Lead[]> = {};
    COLUMNS.forEach(col => {
      grouped[col.id] = [];
    });
    
    leads.forEach(lead => {
      if (grouped[lead.status]) {
        grouped[lead.status].push(lead);
      } else {
        // Se vier com status desconhecido, joga no novo
        if (!grouped['novo']) grouped['novo'] = [];
        grouped['novo'].push(lead);
      }
    });
    
    setColumns(grouped);
  }, [leads]);

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;

    const { source, destination } = result;

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const sourceCol = columns[source.droppableId];
    const destCol = columns[destination.droppableId];
    const item = sourceCol[source.index];

    // Update local state immediately
    const newColumns = { ...columns };
    
    if (source.droppableId === destination.droppableId) {
      newColumns[source.droppableId].splice(source.index, 1);
      newColumns[source.droppableId].splice(destination.index, 0, item);
    } else {
      newColumns[source.droppableId].splice(source.index, 1);
      item.status = destination.droppableId; // update item status
      newColumns[destination.droppableId].splice(destination.index, 0, item);
      
      // Save to Supabase
      try {
        const { error } = await supabase
          .from('crm_leads')
          .update({ status: destination.droppableId })
          .eq('id', item.id);
          
        if (error) throw error;
      } catch (e) {
        console.error(e);
        toast.error('Erro ao mover lead no banco');
      }
    }

    setColumns(newColumns);
    
    // Update parent state
    const allLeads = Object.values(newColumns).flat();
    onLeadsChange(allLeads);
  };

  const handleWhatsApp = (lead: Lead) => {
    if (!lead.telefone) {
      toast.error('Lead não tem telefone cadastrado');
      return;
    }
    const tel = lead.telefone.replace(/\D/g, '');
    const text = encodeURIComponent(`Olá ${lead.nome}, tudo bem? Vi que você deixou seus dados conosco.`);
    window.open(`https://wa.me/55${tel}?text=${text}`, '_blank');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este lead?')) return;
    
    try {
      const { error } = await supabase.from('crm_leads').delete().eq('id', id);
      if (error) throw error;
      
      toast.success('Lead excluído');
      onLeadsChange(leads.filter(l => l.id !== id));
    } catch (e) {
      console.error(e);
      toast.error('Erro ao excluir');
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex h-full items-start space-x-4 min-w-max px-2">
        {COLUMNS.map((col) => (
          <div key={col.id} className="flex flex-col w-72 bg-slate-50/50 rounded-xl border border-slate-200 shadow-sm h-full max-h-full">
            <div className={`p-3 border-b rounded-t-xl flex justify-between items-center ${col.color}`}>
              <h3 className="font-semibold text-sm">{col.title}</h3>
              <Badge variant="outline" className="bg-white/50">{columns[col.id]?.length || 0}</Badge>
            </div>
            
            <Droppable droppableId={col.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex-1 p-3 overflow-y-auto min-h-[150px] transition-colors ${
                    snapshot.isDraggingOver ? 'bg-slate-100' : ''
                  }`}
                >
                  {columns[col.id]?.map((lead, index) => (
                    <Draggable key={lead.id} draggableId={lead.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`bg-white p-3 mb-3 rounded-lg border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md transition-all group ${
                            snapshot.isDragging ? 'rotate-2 scale-105 shadow-xl ring-2 ring-primary/20' : ''
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium text-sm text-slate-900 truncate pr-2">{lead.nome}</h4>
                            <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => onEditLead(lead)} className="p-1 text-slate-400 hover:text-blue-500">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => handleDelete(lead.id)} className="p-1 text-slate-400 hover:text-red-500">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          
                          {lead.telefone && (
                            <div className="flex items-center text-xs text-slate-500 mb-2">
                              <Phone className="h-3 w-3 mr-1" />
                              {lead.telefone}
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between mt-3">
                            <Badge variant="secondary" className="text-[10px] px-1.5 font-normal bg-slate-100 text-slate-600">
                              {lead.origem || 'Manual'}
                            </Badge>
                            
                            <Button 
                              size="sm" 
                              className="h-7 w-7 p-0 rounded-full bg-[#25D366] hover:bg-[#128C7E] shadow-sm"
                              onClick={() => handleWhatsApp(lead)}
                            >
                              <MessageCircle className="h-3.5 w-3.5 text-white" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}
