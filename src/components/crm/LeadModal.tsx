import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: any;
  onSave: () => void;
}

export default function LeadModal({ isOpen, onClose, lead, onSave }: LeadModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    email: '',
    status: 'novo',
    origem: 'Manual',
    campanha: '',
    observacoes: '',
    valor_estimado: ''
  });

  useEffect(() => {
    if (lead) {
      setFormData({
        nome: lead.nome || '',
        telefone: lead.telefone || '',
        email: lead.email || '',
        status: lead.status || 'novo',
        origem: lead.origem || 'Manual',
        campanha: lead.campanha || '',
        observacoes: lead.observacoes || '',
        valor_estimado: lead.valor_estimado ? lead.valor_estimado.toString() : ''
      });
    } else {
      setFormData({
        nome: '',
        telefone: '',
        email: '',
        status: 'novo',
        origem: 'Manual',
        campanha: '',
        observacoes: '',
        valor_estimado: ''
      });
    }
  }, [lead]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dataToSave = {
        ...formData,
        valor_estimado: formData.valor_estimado ? parseFloat(formData.valor_estimado) : null
      };

      if (lead?.id) {
        const { error } = await supabase
          .from('crm_leads')
          .update(dataToSave)
          .eq('id', lead.id);
        if (error) throw error;
        toast.success('Lead atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('crm_leads')
          .insert([dataToSave]);
        if (error) throw error;
        toast.success('Lead adicionado com sucesso!');
      }

      onSave();
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erro ao salvar lead');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{lead ? 'Editar Lead' : 'Novo Lead'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Nome do Cliente *</Label>
              <Input 
                required 
                value={formData.nome} 
                onChange={e => setFormData({...formData, nome: e.target.value})} 
                placeholder="Ex: Maria Silva"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Telefone (WhatsApp)</Label>
              <Input 
                value={formData.telefone} 
                onChange={e => setFormData({...formData, telefone: e.target.value})} 
                placeholder="(82) 99999-9999"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                type="email"
                value={formData.email} 
                onChange={e => setFormData({...formData, email: e.target.value})} 
                placeholder="email@exemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Origem</Label>
              <Select value={formData.origem} onValueChange={(v) => setFormData({...formData, origem: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manual">Manual</SelectItem>
                  <SelectItem value="Meta Ads">Meta Ads</SelectItem>
                  <SelectItem value="Google Ads">Google Ads</SelectItem>
                  <SelectItem value="Site">Site</SelectItem>
                  <SelectItem value="Instagram (Orgânico)">Instagram (Orgânico)</SelectItem>
                  <SelectItem value="Indicação">Indicação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Valor Estimado (R$)</Label>
              <Input 
                type="number"
                step="0.01"
                value={formData.valor_estimado} 
                onChange={e => setFormData({...formData, valor_estimado: e.target.value})} 
                placeholder="Ex: 5000"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Status Atual</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="novo">Novo Lead</SelectItem>
                  <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
                  <SelectItem value="agendado">Avaliação Agendada</SelectItem>
                  <SelectItem value="negociando">Negociando Orçamento</SelectItem>
                  <SelectItem value="ganho">Ganho (Fechou)</SelectItem>
                  <SelectItem value="perdido">Perdido (Não fechou)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Observações</Label>
              <Textarea 
                value={formData.observacoes} 
                onChange={e => setFormData({...formData, observacoes: e.target.value})} 
                placeholder="Deseja colocar resina em 10 dentes..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
