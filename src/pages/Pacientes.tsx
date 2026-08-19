import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { openWhatsApp } from '@/lib/whatsapp';
import { Users, Search, Plus, UserCheck, Calendar, Archive, MoreVertical, Edit2, Trash2, RotateCcw } from 'lucide-react';


const Pacientes = () => {
  const { 
    pacientes, 
    loading, 
    deletePaciente, 
    archivePaciente, 
    reactivatePaciente 
  } = useDentalSystem();
  
  const [showForm, setShowForm] = useState(false);
  const [searchParams] = useSearchParams();
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [editingPatient, setEditingPatient] = useState(null);
  const [activeTab, setActiveTab] = useState('ativos');
  
  // Modals
  const [archiveModal, setArchiveModal] = useState({ isOpen: false, patient: null });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, patient: null });

  const pacientesAtivos = pacientes.filter(p => p.status === 'Ativo' || p.status === 'Inativo');
  const pacientesArquivados = pacientes.filter(p => p.status === 'Arquivado');

  const currentPacientes = activeTab === 'ativos' ? pacientesAtivos : pacientesArquivados;

  const termo = searchTerm.toLowerCase();
  const filteredPacientes = currentPacientes.filter(paciente =>
    (paciente.nome || '').toLowerCase().includes(termo) ||
    (paciente.email || '').toLowerCase().includes(termo) ||
    (paciente.telefone || '').includes(searchTerm)
  );


  const handleEditPatient = (patient: any) => {
    console.log('Editing patient:', patient);
    setEditingPatient(patient);
    setShowForm(true);
    setSelectedPatient(null);
  };

  const handleCloseForm = () => {
    console.log('Closing form');
    setShowForm(false);
    setEditingPatient(null);
  };

  const handleArchivePatient = (patient: any) => {
    setArchiveModal({ isOpen: true, patient });
  };

  const confirmArchive = async (motivo: string) => {
    const patient = archiveModal.patient;
    setArchiveModal({ isOpen: false, patient: null });
    if (patient) {
      try {
        await archivePaciente(patient.id, motivo);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleDeletePatient = (patient: any) => {
    setDeleteModal({ isOpen: true, patient });
  };

  const confirmDelete = async () => {
    const patient = deleteModal.patient;
    setDeleteModal({ isOpen: false, patient: null });
    if (patient) {
      try {
        await deletePaciente(patient.id);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleReactivatePatient = async (patient: any) => {
    await reactivatePaciente(patient.id);
  };

  const getStatusBadge = (status: string, proximaConsulta: Date | null) => {
    if (status === 'Arquivado') {
      return <Badge className="bg-muted text-foreground border-border">Arquivado</Badge>;
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

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" text="Carregando pacientes..." />
        </div>
      </Layout>
    );
  }

  if (showForm) {
    return (
      <Layout>
        <PatientForm
          patient={editingPatient}
          onClose={handleCloseForm}
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
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Pacientes</h1>
          </div>
          <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Novo Paciente
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Pacientes</p>
                  <p className="text-xl sm:text-2xl font-bold">{pacientes.length}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pacientes Ativos</p>
                  <p className="text-xl sm:text-2xl font-bold">{pacientes.filter(p => p.status === 'Ativo').length}</p>
                </div>
                <UserCheck className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Próximas Consultas</p>
                  <p className="text-xl sm:text-2xl font-bold">{pacientes.filter(p => p.proximaConsulta).length}</p>
                </div>
                <Calendar className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Arquivados</p>
                  <p className="text-xl sm:text-2xl font-bold">{pacientes.filter(p => p.status === 'Arquivado').length}</p>
                </div>
                <Archive className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Abas e Busca */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <TabsList className="w-full lg:w-auto">
              <TabsTrigger value="ativos" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Ativos ({pacientesAtivos.length})
              </TabsTrigger>
              <TabsTrigger value="arquivados" className="flex items-center gap-2">
                <Archive className="h-4 w-4" />
                Arquivados ({pacientesArquivados.length})
              </TabsTrigger>
            </TabsList>

            <Card className="w-full lg:w-96">
              <CardContent className="p-2 sm:p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Buscar paciente..."
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
                {filteredPacientes.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="Nenhum paciente encontrado"
                    description={searchTerm ? 'Tente buscar com outros termos' : 'Comece adicionando um novo paciente ao sistema'}
                    action={!searchTerm ? {
                      label: 'Adicionar Paciente',
                      onClick: () => setShowForm(true)
                    } : undefined}
                  />
                ) : (
                  <div className="space-y-4">
                    {filteredPacientes.map((paciente) => (
                      <div
                        key={paciente.id}
                        className="flex items-center space-x-4 p-4 border rounded-lg hover:bg-muted transition-colors"
                      >
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => setSelectedPatient(paciente)}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0">
                              <img
                                src={paciente.foto || '/placeholder.svg'}
                                alt={paciente.nome}
                                className="h-12 w-12 rounded-full object-cover border-2 border-border"
                              />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium text-foreground truncate">
                                  {paciente.nome}
                                </h3>
                                {getStatusBadge(paciente.status, paciente.proximaConsulta)}
                              </div>
                              <div className="mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:space-x-6">
                                <div className="mt-2 flex items-center text-sm text-muted-foreground">
                                  <span>{paciente.email}</span>
                                </div>
                                <div className="mt-2 flex items-center text-sm text-muted-foreground">
                                  {paciente.telefone ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openWhatsApp(paciente.telefone, '');
                                      }}
                                      className="text-primary hover:underline focus:outline-none"
                                      title="Abrir conversa no WhatsApp"
                                    >
                                      {paciente.telefone}
                                    </button>
                                  ) : (
                                    <span>—</span>
                                  )}
                                </div>
                                <div className="mt-2 flex items-center text-sm text-muted-foreground">
                                  <span>Convênio: {paciente.convenio}</span>
                                </div>
                                <div className="mt-2 flex items-center text-sm text-muted-foreground">
                                  <span>Origem: {getOrigemLead(paciente.origemLead)}</span>
                                </div>
                              </div>
                              <div className="mt-2 flex items-center text-xs text-muted-foreground">
                                {paciente.ultimaConsulta && (
                                  <span>Última consulta: {new Date(paciente.ultimaConsulta).toLocaleDateString('pt-BR')}</span>
                                )}
                                {paciente.proximaConsulta && (
                                  <span className="ml-4">Próxima consulta: {new Date(paciente.proximaConsulta).toLocaleDateString('pt-BR')}</span>
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
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="arquivados">
            <Card>
              <CardHeader>
                <CardTitle>Pacientes Arquivados ({filteredPacientes.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredPacientes.length === 0 ? (
                  <EmptyState
                    icon={Archive}
                    title="Nenhum paciente arquivado"
                    description="Pacientes arquivados aparecerão aqui"
                  />
                ) : (
                  <div className="space-y-4">
                    {filteredPacientes.map((paciente) => (
                      <div
                        key={paciente.id}
                        className="flex items-center space-x-4 p-4 border rounded-lg bg-muted"
                      >
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => setSelectedPatient(paciente)}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0">
                              <img
                                src={paciente.foto || '/placeholder.svg'}
                                alt={paciente.nome}
                                className="h-12 w-12 rounded-full object-cover border-2 border-border opacity-60"
                              />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium text-foreground truncate">
                                  {paciente.nome}
                                </h3>
                                {getStatusBadge(paciente.status, paciente.proximaConsulta)}
                              </div>
                              {paciente.dataArquivamento && (
                                <div className="mt-1 text-sm text-muted-foreground">
                                  Arquivado em: {new Date(paciente.dataArquivamento).toLocaleDateString('pt-BR')}
                                </div>
                              )}
                              {paciente.motivoArquivamento && (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  Motivo: {paciente.motivoArquivamento}
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
                  </div>
                )}
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
