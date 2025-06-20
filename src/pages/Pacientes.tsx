import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import PatientForm from '@/components/pacientes/PatientForm';
import PatientDetails from '@/components/pacientes/PatientDetails';
import PatientArchiveModal from '@/components/pacientes/PatientArchiveModal';
import PatientDeleteModal from '@/components/pacientes/PatientDeleteModal';
import { Users, Search, Plus, UserCheck, AlertCircle, Calendar, Archive, MoreVertical, Edit2, Trash2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const Pacientes = () => {
  const [showForm, setShowForm] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPatient, setEditingPatient] = useState(null);
  const [activeTab, setActiveTab] = useState('ativos');
  
  // Modals
  const [archiveModal, setArchiveModal] = useState({ isOpen: false, patient: null });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, patient: null });

  const [pacientes, setPacientes] = useState([
    {
      id: 1,
      nome: 'Maria Silva Santos',
      email: 'maria.silva@email.com',
      telefone: '(11) 99999-9999',
      idade: 32,
      foto: '/placeholder.svg',
      ultimoTratamento: '2024-01-15',
      proximaConsulta: '2024-02-15',
      convenio: 'Unimed',
      origemLead: 'indicacao',
      status: 'Ativo',
      ultimaConsulta: '6 meses atrás',
      historicoMedico: 'Pressão alta controlada com medicamento',
      alergias: 'Alergia a penicilina',
      medicamentos: 'Losartana 50mg - 1x ao dia',
      observacoes: 'Paciente colaborativa, boa higiene bucal'
    },
    {
      id: 2,
      nome: 'João Santos Oliveira',
      email: 'joao.santos@email.com',
      telefone: '(11) 88888-8888',
      idade: 45,
      foto: '/placeholder.svg',
      ultimoTratamento: '2023-12-20',
      proximaConsulta: null,
      convenio: 'Particular',
      origemLead: 'google',
      status: 'Inativo',
      ultimaConsulta: '1 ano atrás',
      historicoMedico: 'Diabetes tipo 2',
      alergias: 'Nenhuma alergia conhecida',
      medicamentos: 'Metformina 850mg - 2x ao dia',
      observacoes: 'Precisa retomar tratamento periodontal'
    },
    {
      id: 3,
      nome: 'Ana Costa Lima',
      email: 'ana.costa@email.com',
      telefone: '(11) 77777-7777',
      idade: 28,
      foto: '/placeholder.svg',
      ultimoTratamento: '2024-01-10',
      proximaConsulta: '2024-02-10',
      convenio: 'Bradesco Dental',
      origemLead: 'instagram',
      status: 'Ativo',
      ultimaConsulta: '3 meses atrás',
      historicoMedico: 'Histórico de cáries recorrentes',
      alergias: 'Alergia a latex',
      medicamentos: 'Nenhum',
      observacoes: 'Paciente jovem, necessita orientação sobre higiene'
    },
  ]);

  const pacientesAtivos = pacientes.filter(p => p.status === 'Ativo' || p.status === 'Inativo');
  const pacientesArquivados = pacientes.filter(p => p.status === 'Arquivado');

  const currentPacientes = activeTab === 'ativos' ? pacientesAtivos : pacientesArquivados;
  
  const filteredPacientes = currentPacientes.filter(paciente =>
    paciente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    paciente.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    paciente.telefone.includes(searchTerm)
  );

  const handleSavePatient = (patientData: any) => {
    if (editingPatient) {
      setPacientes(prev => prev.map(p => p.id === editingPatient.id ? patientData : p));
    } else {
      setPacientes(prev => [...prev, patientData]);
    }
    setShowForm(false);
    setEditingPatient(null);
  };

  const handleEditPatient = (patient: any) => {
    setEditingPatient(patient);
    setShowForm(true);
    setSelectedPatient(null);
  };

  const handleArchivePatient = (patient: any) => {
    setArchiveModal({ isOpen: true, patient });
  };

  const confirmArchive = (motivo: string) => {
    const patient = archiveModal.patient;
    if (patient) {
      setPacientes(prev => prev.map(p => 
        p.id === patient.id 
          ? { 
              ...p, 
              status: 'Arquivado', 
              dataArquivamento: new Date().toLocaleDateString('pt-BR'),
              motivoArquivamento: motivo
            }
          : p
      ));
      toast.success(`Paciente ${patient.nome} foi arquivado`);
    }
  };

  const handleDeletePatient = (patient: any) => {
    setDeleteModal({ isOpen: true, patient });
  };

  const confirmDelete = () => {
    const patient = deleteModal.patient;
    if (patient) {
      setPacientes(prev => prev.filter(p => p.id !== patient.id));
      toast.success(`Paciente ${patient.nome} foi excluído`);
    }
  };

  const handleReactivatePatient = (patient: any) => {
    setPacientes(prev => prev.map(p => 
      p.id === patient.id 
        ? { ...p, status: 'Ativo', dataArquivamento: undefined, motivoArquivamento: undefined }
        : p
    ));
    toast.success(`Paciente ${patient.nome} foi reativado`);
  };

  const getStatusBadge = (status: string, proximaConsulta: string | null) => {
    if (status === 'Arquivado') {
      return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Arquivado</Badge>;
    } else if (status === 'Ativo' && proximaConsulta) {
      return <Badge className="bg-green-100 text-green-800 border-green-200">Ativo</Badge>;
    } else if (status === 'Ativo' && !proximaConsulta) {
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pendente</Badge>;
    } else {
      return <Badge variant="secondary">Inativo</Badge>;
    }
  };

  const getOrigemLead = (origem: string) => {
    const origens: { [key: string]: string } = {
      'indicacao': 'Indicação',
      'google': 'Google',
      'facebook': 'Facebook',
      'instagram': 'Instagram',
      'site': 'Site',
      'whatsapp': 'WhatsApp',
      'panfleto': 'Panfleto',
      'outros': 'Outros'
    };
    return origens[origem] || origem;
  };

  if (showForm) {
    return (
      <Layout>
        <PatientForm
          patient={editingPatient}
          onClose={() => {
            setShowForm(false);
            setEditingPatient(null);
          }}
          onSave={handleSavePatient}
        />
      </Layout>
    );
  }

  if (selectedPatient) {
    return (
      <Layout>
        <PatientDetails
          patient={selectedPatient}
          onClose={() => setSelectedPatient(null)}
          onEdit={() => handleEditPatient(selectedPatient)}
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
          </div>
          <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Novo Paciente
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total de Pacientes</p>
                  <p className="text-2xl font-bold">{pacientes.length}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pacientes Ativos</p>
                  <p className="text-2xl font-bold">{pacientes.filter(p => p.status === 'Ativo').length}</p>
                </div>
                <UserCheck className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Próximas Consultas</p>
                  <p className="text-2xl font-bold">{pacientes.filter(p => p.proximaConsulta).length}</p>
                </div>
                <Calendar className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Arquivados</p>
                  <p className="text-2xl font-bold">{pacientes.filter(p => p.status === 'Arquivado').length}</p>
                </div>
                <Archive className="h-8 w-8 text-gray-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Abas e Busca */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="ativos" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Pacientes Ativos ({pacientesAtivos.length})
              </TabsTrigger>
              <TabsTrigger value="arquivados" className="flex items-center gap-2">
                <Archive className="h-4 w-4" />
                Arquivados ({pacientesArquivados.length})
              </TabsTrigger>
            </TabsList>

            <Card className="w-96">
              <CardContent className="p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Buscar por nome, email ou telefone..."
                    className="pl-10 border-0"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <TabsContent value="ativos">
            <Card>
              <CardHeader>
                <CardTitle>Pacientes Ativos ({filteredPacientes.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredPacientes.map((paciente) => (
                    <div
                      key={paciente.id}
                      className="flex items-center space-x-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => setSelectedPatient(paciente)}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <img
                              src={paciente.foto}
                              alt={paciente.nome}
                              className="h-12 w-12 rounded-full object-cover border-2 border-gray-200"
                            />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-medium text-gray-900 truncate">
                                {paciente.nome}
                              </h3>
                              {getStatusBadge(paciente.status, paciente.proximaConsulta)}
                            </div>
                            <div className="mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:space-x-6">
                              <div className="mt-2 flex items-center text-sm text-gray-500">
                                <span>{paciente.email}</span>
                              </div>
                              <div className="mt-2 flex items-center text-sm text-gray-500">
                                <span>{paciente.telefone}</span>
                              </div>
                              <div className="mt-2 flex items-center text-sm text-gray-500">
                                <span>Convênio: {paciente.convenio}</span>
                              </div>
                              <div className="mt-2 flex items-center text-sm text-gray-500">
                                <span>Origem: {getOrigemLead(paciente.origemLead)}</span>
                              </div>
                            </div>
                            <div className="mt-2 flex items-center text-xs text-gray-400">
                              <span>Última consulta: {paciente.ultimaConsulta}</span>
                              {paciente.proximaConsulta && (
                                <span className="ml-4">Próxima consulta: {paciente.proximaConsulta}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditPatient(paciente)}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleArchivePatient(paciente)}>
                            <Archive className="h-4 w-4 mr-2" />
                            Arquivar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeletePatient(paciente)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                  
                  {filteredPacientes.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>Nenhum paciente encontrado</p>
                      {searchTerm && (
                        <p className="text-sm mt-2">
                          Tente buscar com outros termos ou{' '}
                          <button
                            onClick={() => setSearchTerm('')}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            limpar a busca
                          </button>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="arquivados">
            <Card>
              <CardHeader>
                <CardTitle>Pacientes Arquivados ({filteredPacientes.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredPacientes.map((paciente) => (
                    <div
                      key={paciente.id}
                      className="flex items-center space-x-4 p-4 border rounded-lg bg-gray-50"
                    >
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => setSelectedPatient(paciente)}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <img
                              src={paciente.foto}
                              alt={paciente.nome}
                              className="h-12 w-12 rounded-full object-cover border-2 border-gray-200 opacity-60"
                            />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-medium text-gray-700 truncate">
                                {paciente.nome}
                              </h3>
                              {getStatusBadge(paciente.status, paciente.proximaConsulta)}
                            </div>
                            {(paciente as any).dataArquivamento && (
                              <div className="mt-1 text-sm text-gray-500">
                                Arquivado em: {(paciente as any).dataArquivamento}
                              </div>
                            )}
                            {(paciente as any).motivoArquivamento && (
                              <div className="mt-1 text-xs text-gray-400">
                                Motivo: {(paciente as any).motivoArquivamento}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleReactivatePatient(paciente)}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Reativar
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeletePatient(paciente)}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {filteredPacientes.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Archive className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>Nenhum paciente arquivado encontrado</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modals */}
        <PatientArchiveModal
          isOpen={archiveModal.isOpen}
          onClose={() => setArchiveModal({ isOpen: false, patient: null })}
          onConfirm={confirmArchive}
          patientName={archiveModal.patient?.nome || ''}
        />

        <PatientDeleteModal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal({ isOpen: false, patient: null })}
          onConfirm={confirmDelete}
          patientName={deleteModal.patient?.nome || ''}
          isArchived={deleteModal.patient?.status === 'Arquivado'}
        />
      </div>
    </Layout>
  );
};

export default Pacientes;
