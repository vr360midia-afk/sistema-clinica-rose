
import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FileText, Search, Plus, User, Calendar, Camera, FileDown } from 'lucide-react';
import Odontogram from '@/components/prontuarios/Odontogram';
import ProntuarioModal from '@/components/prontuarios/ProntuarioModal';
import ImageUploadSection from '@/components/prontuarios/ImageUploadSection';
import PDFGenerator from '@/components/prontuarios/PDFGenerator';

const mockProntuarios = [
  {
    id: 1,
    patient: 'Maria Silva',
    lastVisit: '15/01/2024',
    procedures: ['Limpeza', 'Restauração'],
    status: 'Em tratamento'
  },
  {
    id: 2,
    patient: 'Carlos Santos',
    lastVisit: '10/01/2024',
    procedures: ['Consulta'],
    status: 'Finalizado'
  }
];

const Prontuarios = () => {
  const [selectedPatient, setSelectedPatient] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'odontograma' | 'ficha' | 'anexos'>('odontograma');
  const [prontuarios, setProntuarios] = useState(mockProntuarios);
  const [currentProntuarioData, setCurrentProntuarioData] = useState<any>(null);

  const handleNewProntuario = (data: any) => {
    const newProntuario = {
      id: Date.now(),
      patient: data.patientName,
      lastVisit: data.date,
      procedures: ['Consulta Inicial'],
      status: 'Em tratamento'
    };
    
    setProntuarios(prev => [...prev, newProntuario]);
    setCurrentProntuarioData(data);
    setSelectedPatient(newProntuario.id);
  };

  const selectedProntuario = prontuarios.find(p => p.id === selectedPatient);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Prontuários</h1>
            <p className="text-gray-600">Gerencie prontuários e fichas clínicas</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Prontuário
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de Prontuários */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Prontuários
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
                {prontuarios
                  .filter(p => p.patient.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((prontuario) => (
                    <div 
                      key={prontuario.id}
                      className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                        selectedPatient === prontuario.id ? 'border-blue-500 bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedPatient(prontuario.id)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">{prontuario.patient}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <Calendar className="h-3 w-3" />
                        Última visita: {prontuario.lastVisit}
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {prontuario.procedures.map((proc, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {proc}
                          </Badge>
                        ))}
                      </div>
                      <Badge 
                        className={prontuario.status === 'Em tratamento' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-green-100 text-green-800'
                        }
                      >
                        {prontuario.status}
                      </Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Detalhes do Prontuário */}
          <div className="lg:col-span-2">
            {selectedPatient ? (
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
                        <CardTitle>Odontograma - {selectedProntuario?.patient}</CardTitle>
                        <PDFGenerator 
                          patientData={currentProntuarioData}
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

                {activeTab === 'ficha' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Ficha Clínica - {selectedProntuario?.patient}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Queixa Principal</label>
                        <Textarea 
                          placeholder="Descreva a queixa principal do paciente..." 
                          defaultValue={currentProntuarioData?.queixaPrincipal || ''}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Exame Clínico</label>
                        <Textarea 
                          placeholder="Descreva os achados do exame clínico..." 
                          defaultValue={currentProntuarioData?.exameClinico || ''}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Diagnóstico</label>
                        <Textarea 
                          placeholder="Diagnóstico clínico..." 
                          defaultValue={currentProntuarioData?.diagnostico || ''}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Plano de Tratamento</label>
                        <Textarea 
                          placeholder="Descreva o plano de tratamento..." 
                          defaultValue={currentProntuarioData?.planoTratamento || ''}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button className="flex-1">Salvar Alterações</Button>
                        <PDFGenerator 
                          patientData={currentProntuarioData}
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
                        <CardTitle>Anexos - {selectedProntuario?.patient}</CardTitle>
                        <PDFGenerator 
                          patientData={currentProntuarioData}
                          teethStatus={{}}
                          images={[]}
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ImageUploadSection patientName={selectedProntuario?.patient} />
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center h-64">
                  <div className="text-center text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Selecione um paciente para visualizar o prontuário</p>
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
