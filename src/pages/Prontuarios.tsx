
import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FileText, Search, Plus, User, Calendar, Camera } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import Odontogram from '@/components/prontuarios/Odontogram';
import ProntuarioModal from '@/components/prontuarios/ProntuarioModal';
import ImageUploadSection from '@/components/prontuarios/ImageUploadSection';
import PDFGenerator from '@/components/prontuarios/PDFGenerator';

const Prontuarios = () => {
  const { prontuarios, pacientes } = useDentalSystem();
  const [selectedProntuario, setSelectedProntuario] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'odontograma' | 'ficha' | 'anexos'>('odontograma');

  const handleNewProntuario = (data: any) => {
    // Modal já salva através do contexto
    setSelectedProntuario(data.pacienteId);
  };

  // Filtrar prontuários baseado na busca
  const filteredProntuarios = prontuarios.filter(prontuario => {
    const paciente = pacientes.find(p => p.id === prontuario.pacienteId);
    if (!paciente) return false;
    
    return paciente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
           prontuario.queixaPrincipal.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const selectedProntuarioData = prontuarios.find(p => p.pacienteId === selectedProntuario);
  const selectedPatient = selectedProntuario ? pacientes.find(p => p.id === selectedProntuario) : null;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Prontuários</h1>
            <p className="text-gray-600">Gerencie prontuários e fichas clínicas</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Prontuário
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Lista de Prontuários */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Prontuários ({filteredProntuarios.length})
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar paciente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredProntuarios.map((prontuario) => {
                  const paciente = pacientes.find(p => p.id === prontuario.pacienteId);
                  if (!paciente) return null;
                  
                  return (
                    <div 
                      key={prontuario.id}
                      className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                        selectedProntuario === prontuario.pacienteId ? 'border-blue-500 bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedProntuario(prontuario.pacienteId)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">{paciente.nome}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <Calendar className="h-3 w-3" />
                        Criado em: {new Date(prontuario.data).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        <strong>Queixa:</strong> {prontuario.queixaPrincipal}
                      </div>
                      {prontuario.procedimentosRealizados.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {prontuario.procedimentosRealizados.slice(0, 2).map((proc, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {proc}
                            </Badge>
                          ))}
                          {prontuario.procedimentosRealizados.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{prontuario.procedimentosRealizados.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {filteredProntuarios.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum prontuário encontrado</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Detalhes do Prontuário */}
          <div className="lg:col-span-2">
            {selectedProntuario && selectedPatient ? (
              <div className="space-y-6">
                {/* Tabs de Navegação */}
                <Card>
                  <CardContent className="p-0">
                    <div className="flex border-b">
                      <button
                        onClick={() => setActiveTab('odontograma')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 ${
                          activeTab === 'odontograma'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Odontograma
                      </button>
                      <button
                        onClick={() => setActiveTab('ficha')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 ${
                          activeTab === 'ficha'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Ficha Clínica
                      </button>
                      <button
                        onClick={() => setActiveTab('anexos')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 ${
                          activeTab === 'anexos'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <Camera className="h-4 w-4 inline mr-1" />
                        Anexos
                      </button>
                    </div>
                  </CardContent>
                </Card>

                {/* Conteúdo das Tabs */}
                {activeTab === 'odontograma' && (
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle>Odontograma - {selectedPatient.nome}</CardTitle>
                        <PDFGenerator 
                          patientData={selectedProntuarioData}
                          teethStatus={{}}
                          images={[]}
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Odontogram />
                    </CardContent>
                  </Card>
                )}

                {activeTab === 'ficha' && selectedProntuarioData && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Ficha Clínica - {selectedPatient.nome}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Queixa Principal</label>
                        <Textarea 
                          placeholder="Descreva a queixa principal do paciente..." 
                          defaultValue={selectedProntuarioData.queixaPrincipal}
                          readOnly
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">História da Doença</label>
                        <Textarea 
                          placeholder="História da doença..." 
                          defaultValue={selectedProntuarioData.historiaDoenca}
                          readOnly
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Exame Clínico</label>
                        <Textarea 
                          placeholder="Descreva os achados do exame clínico..." 
                          defaultValue={selectedProntuarioData.exameClinico}
                          readOnly
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Diagnóstico</label>
                        <Textarea 
                          placeholder="Diagnóstico clínico..." 
                          defaultValue={selectedProntuarioData.diagnostico}
                          readOnly
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Plano de Tratamento</label>
                        <Textarea 
                          placeholder="Descreva o plano de tratamento..." 
                          defaultValue={selectedProntuarioData.planoTratamento}
                          readOnly
                        />
                      </div>
                      <div className="flex gap-2">
                        <PDFGenerator 
                          patientData={selectedProntuarioData}
                          teethStatus={{}}
                          images={[]}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {activeTab === 'anexos' && (
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle>Anexos - {selectedPatient.nome}</CardTitle>
                        <PDFGenerator 
                          patientData={selectedProntuarioData}
                          teethStatus={{}}
                          images={[]}
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ImageUploadSection patientName={selectedPatient.nome} />
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center h-64">
                  <div className="text-center text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Selecione um prontuário para visualizar os detalhes</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <ProntuarioModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleNewProntuario}
        />
      </div>
    </Layout>
  );
};

export default Prontuarios;
