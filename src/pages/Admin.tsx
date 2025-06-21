
import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle, BarChart3 } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/common/ConfirmDialog';

const Admin = () => {
  const { 
    clearAllData, 
    clearPacientes, 
    clearTransacoes,
    pacientes,
    consultas,
    transacoes,
    prontuarios,
    anamneses,
    documentos
  } = useDentalSystem();

  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: 'all' | 'pacientes' | 'transacoes' | null;
    title: string;
    description: string;
  }>({
    isOpen: false,
    type: null,
    title: '',
    description: ''
  });

  const openConfirmDialog = (
    type: 'all' | 'pacientes' | 'transacoes',
    title: string,
    description: string
  ) => {
    setDialogState({
      isOpen: true,
      type,
      title,
      description
    });
  };

  const closeDialog = () => {
    setDialogState({
      isOpen: false,
      type: null,
      title: '',
      description: ''
    });
  };

  const handleConfirmAction = async () => {
    try {
      switch (dialogState.type) {
        case 'all':
          await clearAllData();
          toast.success('Todos os dados foram limpos com sucesso!');
          break;
        case 'pacientes':
          await clearPacientes();
          toast.success('Dados de pacientes limpos com sucesso!');
          break;
        case 'transacoes':
          await clearTransacoes();
          toast.success('Dados financeiros limpos com sucesso!');
          break;
      }
    } catch (error) {
      toast.error('Erro ao limpar dados');
      console.error('Erro:', error);
    }
  };

  const handleClearAllData = () => {
    openConfirmDialog(
      'all',
      'Excluir TODOS os Dados',
      'Esta ação irá deletar permanentemente todos os dados do sistema: pacientes, consultas, prontuários, anamneses, transações e documentos. Esta ação não pode ser desfeita.'
    );
  };

  const handleClearPacientes = () => {
    openConfirmDialog(
      'pacientes',
      'Excluir Dados de Pacientes',
      'Esta ação irá deletar permanentemente todos os dados de pacientes. Esta ação não pode ser desfeita.'
    );
  };

  const handleClearTransacoes = () => {
    openConfirmDialog(
      'transacoes',
      'Excluir Dados Financeiros',
      'Esta ação irá deletar permanentemente todas as transações financeiras. Esta ação não pode ser desfeita.'
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Administração</h1>
          <p className="text-gray-600">Gerenciar dados do sistema</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Status do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{pacientes.length}</p>
                <p className="text-sm text-gray-600">Pacientes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{consultas.length}</p>
                <p className="text-sm text-gray-600">Consultas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{prontuarios.length}</p>
                <p className="text-sm text-gray-600">Prontuários</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{transacoes.length}</p>
                <p className="text-sm text-gray-600">Transações</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-cyan-600">{anamneses.length}</p>
                <p className="text-sm text-gray-600">Anamneses</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-pink-600">{documentos.length}</p>
                <p className="text-sm text-gray-600">Documentos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Zona de Perigo - Exclusão de Dados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-sm text-red-700 mb-4">
                <strong>⚠️ Atenção:</strong> As ações abaixo irão deletar dados permanentemente. 
                Esta ação não pode ser desfeita. Certifique-se de ter um backup antes de prosseguir.
              </p>
              
              <div className="space-y-3">
                <Button
                  onClick={handleClearAllData}
                  variant="destructive"
                  className="w-full"
                  size="lg"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir TODOS os Dados do Sistema
                </Button>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Button
                    onClick={handleClearPacientes}
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir Dados de Pacientes
                  </Button>
                  
                  <Button
                    onClick={handleClearTransacoes}
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir Dados Financeiros
                  </Button>
                </div>
              </div>

              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800">
                  <strong>Dica:</strong> Você pode exportar seus dados antes de excluí-los na seção de Relatórios.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <ConfirmDialog
          isOpen={dialogState.isOpen}
          onClose={closeDialog}
          onConfirm={handleConfirmAction}
          title={dialogState.title}
          description={dialogState.description}
          confirmText="Sim, Excluir"
          cancelText="Cancelar"
          variant="destructive"
        />
      </div>
    </Layout>
  );
};

export default Admin;
