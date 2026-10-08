import React, { useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import KanbanBoard from '@/components/crm/KanbanBoard';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import LeadModal from '@/components/crm/LeadModal';

export default function CRM() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<any>(null);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('crm_leads')
        .select('*')
        .order('data_criacao', { ascending: false });
        
      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao buscar leads');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (lead: any) => {
    setEditingLead(lead);
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setEditingLead(null);
    setIsModalOpen(true);
  };

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-6rem)] overflow-hidden">
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">CRM & Leads</h1>
            <p className="text-muted-foreground mt-1">Gerencie seus contatos do site e Meta Ads</p>
          </div>
          <Button onClick={handleNew}>
            <Plus className="mr-2 h-4 w-4" /> Novo Lead
          </Button>
        </div>
        
        <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">Carregando CRM...</div>
          ) : (
            <KanbanBoard leads={leads} onLeadsChange={setLeads} onEditLead={handleEdit} />
          )}
        </div>
      </div>
      
      {isModalOpen && (
        <LeadModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          lead={editingLead}
          onSave={fetchLeads}
        />
      )}
    </Layout>
  );
}
