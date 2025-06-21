
import React from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { toast } from 'sonner';

const Admin = () => {
  const { clearAllData, clearPacientes, clearTransacoes } = useDentalSystem();

  const handleClearAllData = async () => {
    if (window.confirm('Tem certeza que deseja apagar TODOS os dados? Esta ação não pode ser desfeita.')) {
      try {
        await clearAllData();
        toast.success('Todos os dados foram limpos com sucesso!');
      } catch (error) {
        toast.error('Erro ao limpar dados');
      }
    }
  };

  const handleClearPacientes = async () => {
    if (window.confirm('Tem certeza que deseja apagar todos os dados de pacientes?')) {
      try {
        await clearPacientes();
        toast.success('Dados de pacientes limpos com sucesso!');
      } catch (error) {
        toast.error('Erro ao limpar dados de pacientes');
      }
    }
  };

  const handleClearTransacoes = async () => {
    if (window.confirm('Tem certeza que deseja apagar todos os dados financeiros?')) {
      try {
        await clearTransacoes();
        toast.success('Dados financeiros limpos com sucesso!');
      } catch (error) {
        toast.error('Erro ao limpar dados financeiros');
      }
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Administração</h1>
          <p className="text-gray-600">Gerenciar dados do sistema</p>
        </div>

        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Zona de Perigo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-sm text-red-700 mb-4">
                <strong>Atenção:</strong> As ações abaixo irão deletar dados permanentemente. 
                Esta ação não pode ser desfeita.
              </p>
              
              <div className="space-y-3">
                <Button
                  onClick={handleClearAllData}
                  variant="destructive"
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpar TODOS os Dados
                </Button>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Button
                    onClick={handleClearPacientes}
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Limpar Pacientes
                  </Button>
                  
                  <Button
                    onClick={handleClearTransacoes}
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Limpar Financeiro
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status do Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">0</p>
                <p className="text-sm text-gray-600">Pacientes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">0</p>
                <p className="text-sm text-gray-600">Consultas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">0</p>
                <p className="text-sm text-gray-600">Prontuários</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">0</p>
                <p className="text-sm text-gray-600">Transações</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Admin;
