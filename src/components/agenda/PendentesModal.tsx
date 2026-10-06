import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, Phone, FileText, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PendentesModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendentes: any[];
  onApprove: (pendente: any) => void;
  onRefresh: () => void;
}

const PendentesModal = ({ isOpen, onClose, pendentes, onApprove, onRefresh }: PendentesModalProps) => {
  const handleReject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('agendamentos_pendentes')
        .update({ status: 'recusado' })
        .eq('id', id);

      if (error) throw error;
      toast.success('Solicitação recusada.');
      onRefresh();
    } catch (e) {
      toast.error('Erro ao recusar solicitação.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Solicitações de Agendamento Online</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {pendentes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma solicitação pendente no momento.
            </div>
          ) : (
            pendentes.map((p) => (
              <div key={p.id} className="p-4 border rounded-lg bg-card shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-lg">{p.nome}</h4>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Phone className="w-4 h-4" /> {p.telefone}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                    Novo
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm bg-slate-50 dark:bg-slate-900 p-3 rounded-md">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <span>{new Date(p.data).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span>{p.hora}</span>
                  </div>
                  <div className="flex items-start gap-2 col-span-2 mt-1">
                    <FileText className="w-4 h-4 text-blue-500 mt-0.5" />
                    <span className="text-muted-foreground">{p.motivo || 'Nenhum motivo informado'}</span>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" size="sm" onClick={() => handleReject(p.id)}>
                    Recusar
                  </Button>
                  <Button 
                    size="sm" 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={() => {
                      onApprove(p);
                      onClose();
                    }}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Aprovar e Agendar
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PendentesModal;
