
import React from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2, Download, Upload } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const Admin = () => {
  const { 
    clearAllData, 
    clearPacientes, 
    clearTransacoes, 
    clearAnamneses,
    pacientes, 
    consultas, 
    transacoes, 
    prontuarios, 
    anamneses, 
    documentos 
  } = useDentalSystem();

  const handleClearAnamneses = async () => {
    try {
      await clearAnamneses();
    } catch (error) {
      console.error('Erro ao limpar anamneses:', error);
    }
  };

  const handleClearAllData = async () => {
    try {
      await clearAllData();
    } catch (error) {
      console.error('Erro ao limpar todos os dados:', error);
    }
  };

  const handleClearPacientes = async () => {
    try {
      await clearPacientes();
    } catch (error) {
      console.error('Erro ao limpar pacientes:', error);
    }
  };

  const handleClearTransacoes = async () => {
    try {
      await clearTransacoes();
    } catch (error) {
      console.error('Erro ao limpar transações:', error);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Administração</h1>
          <p className="text-gray-600">Gerenciamento de dados do sistema</p>
        </div>

        {/* Status dos dados */}
        <Card>
          <CardHeader>
            <CardTitle>Status dos Dados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-blue-600">{pacientes.length}</div>
                <div className="text-sm text-gray-600">Pacientes</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-green-600">{consultas.length}</div>
                <div className="text-sm text-gray-600">Consultas</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-purple-600">{transacoes.length}</div>
                <div className="text-sm text-gray-600">Transações</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-orange-600">{prontuarios.length}</div>
                <div className="text-sm text-gray-600">Prontuários</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-red-600">{anamneses.length}</div>
                <div className="text-sm text-gray-600">Anamneses</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-gray-600">{documentos.length}</div>
                <div className="text-sm text-gray-600">Documentos</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Limpeza de dados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Limpeza de Dados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Zerar Anamneses
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar limpeza de anamneses</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação irá excluir permanentemente todas as {anamneses.length} anamneses cadastradas. 
                      Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAnamneses} className="bg-red-600 hover:bg-red-700">
                      Confirmar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Zerar Pacientes
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar limpeza de pacientes</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação irá excluir permanentemente todos os {pacientes.length} pacientes cadastrados. 
                      Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearPacientes} className="bg-red-600 hover:bg-red-700">
                      Confirmar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Zerar Transações
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar limpeza de transações</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação irá excluir permanentemente todas as {transacoes.length} transações cadastradas. 
                      Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearTransacoes} className="bg-red-600 hover:bg-red-700">
                      Confirmar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Zerar Todos os Dados
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar limpeza completa</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação irá excluir permanentemente TODOS os dados do sistema: pacientes, consultas, 
                      transações, prontuários, anamneses e documentos. Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAllData} className="bg-red-600 hover:bg-red-700">
                      Confirmar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        {/* Backup e Restauração */}
        <Card>
          <CardHeader>
            <CardTitle>Backup e Restauração</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button variant="outline" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Fazer Backup dos Dados
              </Button>
              <Button variant="outline" className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                Restaurar Backup
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Admin;
