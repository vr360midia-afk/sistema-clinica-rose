import React, { useMemo, useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Download, Trash2, Loader2 } from 'lucide-react';
import ProcedimentoForm from '@/components/procedimentos/ProcedimentoForm';
import ProcedimentosList from '@/components/procedimentos/ProcedimentosList';
import ProcedimentoStats from '@/components/procedimentos/ProcedimentoStats';
import PacoteForm from '@/components/procedimentos/PacoteForm';
import { Procedimento } from '@/types/procedimentos';
import { useProcedimentos } from '@/hooks/useProcedimentos';

const Procedimentos = () => {
  const [showForm, setShowForm] = useState(false);
  const [showPacoteForm, setShowPacoteForm] = useState(false);
  const [selectedProcedimento, setSelectedProcedimento] = useState<Procedimento | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('lista');

  const {
    procedimentos,
    pacotes,
    loading,
    addProcedimento,
    updateProcedimento,
    deleteProcedimento,
    duplicateProcedimento,
    addPacote,
    deletePacote,
  } = useProcedimentos();

  const handleAddProcedimento = () => {
    setSelectedProcedimento(null);
    setShowForm(true);
  };

  const handleEditProcedimento = (procedimento: Procedimento) => {
    setSelectedProcedimento(procedimento);
    setShowForm(true);
  };

  const handleSaveProcedimento = async (
    procedimentoData: Omit<Procedimento, 'id' | 'criadoEm' | 'atualizadoEm'>
  ) => {
    setShowForm(false);
    if (selectedProcedimento) {
      await updateProcedimento(selectedProcedimento.id, procedimentoData);
    } else {
      await addProcedimento(procedimentoData);
    }
  };

  const filteredProcedimentos = useMemo(
    () =>
      procedimentos.filter(
        (p) =>
          p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.categoria.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [procedimentos, searchTerm]
  );

  const handleExport = () => {
    const header = ['Nome', 'Categoria', 'Preço', 'Preço Convênio', 'Duração (min)', 'Complexidade', 'Ativo'];
    const rows = procedimentos.map((p) => [
      p.nome,
      p.categoria,
      p.preco.toFixed(2),
      (p.precoConvenio ?? 0).toFixed(2),
      String(p.duracaoMinutos),
      p.complexidade,
      p.ativo ? 'Sim' : 'Não',
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `procedimentos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">Procedimentos</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Gerencie todos os procedimentos e serviços do consultório
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button onClick={handleAddProcedimento} className="flex-1 sm:flex-none">
              <Plus className="h-4 w-4 mr-2" />
              Novo Procedimento
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="lista">Lista</TabsTrigger>
            <TabsTrigger value="estatisticas">Estatísticas</TabsTrigger>
            <TabsTrigger value="pacotes">Pacotes</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <CardTitle className="text-base sm:text-lg">
                    Procedimentos Cadastrados ({filteredProcedimentos.length})
                  </CardTitle>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar procedimentos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ProcedimentosList
                    procedimentos={filteredProcedimentos}
                    onEdit={handleEditProcedimento}
                    onDelete={deleteProcedimento}
                    onDuplicate={duplicateProcedimento}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="estatisticas">
            <ProcedimentoStats procedimentos={procedimentos} />
          </TabsContent>

          <TabsContent value="pacotes">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <CardTitle className="text-base sm:text-lg">Pacotes de Procedimentos ({pacotes.length})</CardTitle>
                  <Button size="sm" onClick={() => setShowPacoteForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Pacote
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {pacotes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Nenhum pacote cadastrado</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pacotes.map((pacote) => {
                      const itens = procedimentos.filter((p) => pacote.procedimentos.includes(p.id));
                      const bruto = itens.reduce((s, p) => s + p.preco, 0);
                      return (
                        <Card key={pacote.id}>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0">
                                <h3 className="font-semibold text-foreground truncate">{pacote.nome}</h3>
                                <p className="text-sm text-muted-foreground line-clamp-2">{pacote.descricao}</p>
                              </div>
                              {!pacote.ativo && <Badge variant="secondary">Inativo</Badge>}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {itens.map((p) => (
                                <Badge key={p.id} variant="outline" className="text-xs">
                                  {p.nome}
                                </Badge>
                              ))}
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t">
                              <div className="text-sm">
                                {bruto > pacote.precoTotal && (
                                  <span className="line-through text-muted-foreground mr-2">R$ {bruto.toFixed(2)}</span>
                                )}
                                <span className="font-semibold text-green-700">R$ {pacote.precoTotal.toFixed(2)}</span>
                                {pacote.desconto > 0 && (
                                  <span className="text-xs text-muted-foreground ml-2">-{pacote.desconto}%</span>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600"
                                onClick={() => deletePacote(pacote.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
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

        {showPacoteForm && (
          <PacoteForm
            procedimentos={procedimentos}
            onSave={async (p) => {
              setShowPacoteForm(false);
              await addPacote(p);
            }}
            onCancel={() => setShowPacoteForm(false)}
          />
        )}
      </div>
    </Layout>
  );
};

export default Procedimentos;
