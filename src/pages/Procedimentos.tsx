
import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Filter, Download, Upload } from 'lucide-react';
import ProcedimentoForm from '@/components/procedimentos/ProcedimentoForm';
import ProcedimentosList from '@/components/procedimentos/ProcedimentosList';
import ProcedimentoStats from '@/components/procedimentos/ProcedimentoStats';
import { Procedimento } from '@/types/procedimentos';

const Procedimentos = () => {
  const [showForm, setShowForm] = useState(false);
  const [selectedProcedimento, setSelectedProcedimento] = useState<Procedimento | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('lista');

  // Mock data - in real app this would come from API/database
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([
    {
      id: '1',
      nome: 'Limpeza Dental',
      categoria: 'preventivo',
      descricao: 'Profilaxia dental completa com remoção de tártaro e polimento',
      preco: 150.00,
      precoConvenio: 120.00,
      duracaoMinutos: 60,
      complexidade: 'baixa',
      requererAnestesia: false,
      requererRaioX: false,
      materiaisNecessarios: ['Pasta profilática', 'Escova Robinson'],
      equipamentosNecessarios: ['Ultrassom', 'Micromotor'],
      ativo: true,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      criadoPor: 'Dr. Silva'
    }
  ]);

  const handleAddProcedimento = () => {
    setSelectedProcedimento(null);
    setShowForm(true);
  };

  const handleEditProcedimento = (procedimento: Procedimento) => {
    setSelectedProcedimento(procedimento);
    setShowForm(true);
  };

  const handleSaveProcedimento = (procedimentoData: Omit<Procedimento, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    if (selectedProcedimento) {
      // Edit existing
      setProcedimentos(prev => prev.map(p => 
        p.id === selectedProcedimento.id 
          ? { ...procedimentoData, id: p.id, criadoEm: p.criadoEm, atualizadoEm: new Date() }
          : p
      ));
    } else {
      // Add new
      const newProcedimento: Procedimento = {
        ...procedimentoData,
        id: Date.now().toString(),
        criadoEm: new Date(),
        atualizadoEm: new Date()
      };
      setProcedimentos(prev => [...prev, newProcedimento]);
    }
    setShowForm(false);
  };

  const handleDeleteProcedimento = (id: string) => {
    setProcedimentos(prev => prev.filter(p => p.id !== id));
  };

  const filteredProcedimentos = procedimentos.filter(p =>
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.categoria.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Procedimentos</h1>
            <p className="text-gray-600">Gerencie todos os procedimentos e serviços do consultório</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button onClick={handleAddProcedimento}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Procedimento
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="lista">Lista de Procedimentos</TabsTrigger>
            <TabsTrigger value="estatisticas">Estatísticas</TabsTrigger>
            <TabsTrigger value="pacotes">Pacotes</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Procedimentos Cadastrados ({filteredProcedimentos.length})</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Buscar procedimentos..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 w-64"
                      />
                    </div>
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      Filtros
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ProcedimentosList
                  procedimentos={filteredProcedimentos}
                  onEdit={handleEditProcedimento}
                  onDelete={handleDeleteProcedimento}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="estatisticas">
            <ProcedimentoStats procedimentos={procedimentos} />
          </TabsContent>

          <TabsContent value="pacotes">
            <Card>
              <CardHeader>
                <CardTitle>Pacotes de Procedimentos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <p>Funcionalidade de pacotes em desenvolvimento</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {showForm && (
          <ProcedimentoForm
            procedimento={selectedProcedimento}
            onSave={handleSaveProcedimento}
            onCancel={() => setShowForm(false)}
          />
        )}
      </div>
    </Layout>
  );
};

export default Procedimentos;
