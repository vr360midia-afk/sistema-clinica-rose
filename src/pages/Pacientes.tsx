
import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import PatientForm from '@/components/pacientes/PatientForm';
import PatientDetails from '@/components/pacientes/PatientDetails';
import { Users, Search, Plus, UserCheck, AlertCircle, Calendar } from 'lucide-react';

const Pacientes = () => {
  const [showForm, setShowForm] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPatient, setEditingPatient] = useState(null);

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
      status: 'Ativo',
      ultimaConsulta: '2024-01-15',
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
      status: 'Inativo',
      ultimaConsulta: '2023-12-20',
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
      status: 'Ativo',
      ultimaConsulta: '2024-01-10',
      historicoMedico: 'Histórico de cáries recorrentes',
      alergias: 'Alergia a latex',
      medicamentos: 'Nenhum',
      observacoes: 'Paciente jovem, necessita orientação sobre higiene'
    },
  ]);

  const filteredPacientes = pacientes.filter(paciente =>
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

  const getStatusBadge = (status: string, proximaConsulta: string | null) => {
    if (status === 'Ativo' && proximaConsulta) {
      return <Badge className="bg-green-100 text-green-800 border-green-200">Ativo</Badge>;
    } else if (status === 'Ativo' && !proximaConsulta) {
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pendente</Badge>;
    } else {
      return <Badge variant="secondary">Inativo</Badge>;
    }
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
                  <p className="text-sm text-gray-600">Pendentes</p>
                  <p className="text-2xl font-bold">{pacientes.filter(p => p.status === 'Ativo' && !p.proximaConsulta).length}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Busca */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Lista de Pacientes */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Pacientes ({filteredPacientes.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredPacientes.map((paciente) => (
                <div
                  key={paciente.id}
                  className="flex items-center space-x-4 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedPatient(paciente)}
                >
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
                    </div>
                    <div className="mt-2 flex items-center text-xs text-gray-400">
                      <span>Última consulta: {paciente.ultimaConsulta}</span>
                      {paciente.proximaConsulta && (
                        <span className="ml-4">Próxima consulta: {paciente.proximaConsulta}</span>
                      )}
                    </div>
                  </div>
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
      </div>
    </Layout>
  );
};

export default Pacientes;
