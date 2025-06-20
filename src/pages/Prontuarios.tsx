
import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FileText, Search, Plus, User, Calendar } from 'lucide-react';
import Odontogram from '@/components/prontuarios/Odontogram';

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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Prontuários</h1>
            <p className="text-gray-600">Gerencie prontuários e fichas clínicas</p>
          </div>
          <Button className="flex items-center gap-2">
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
                {mockProntuarios.map((prontuario) => (
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
                {/* Odontograma */}
                <Card>
                  <CardHeader>
                    <CardTitle>Odontograma - Maria Silva</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Odontogram />
                  </CardContent>
                </Card>

                {/* Ficha Clínica */}
                <Card>
                  <CardHeader>
                    <CardTitle>Ficha Clínica</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Queixa Principal</label>
                      <Textarea placeholder="Descreva a queixa principal do paciente..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Exame Clínico</label>
                      <Textarea placeholder="Descreva os achados do exame clínico..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Diagnóstico</label>
                      <Textarea placeholder="Diagnóstico clínico..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Plano de Tratamento</label>
                      <Textarea placeholder="Descreva o plano de tratamento..." />
                    </div>
                    <Button className="w-full">Salvar Prontuário</Button>
                  </CardContent>
                </Card>
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
      </div>
    </Layout>
  );
};

export default Prontuarios;
