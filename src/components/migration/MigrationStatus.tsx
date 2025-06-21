
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { localStorageService } from '@/services/localStorage';
import { toast } from 'sonner';

const MigrationStatus = () => {
  const { migrateFromLocalStorage, pacientes, loading } = useDentalSystem();
  const [migrating, setMigrating] = useState(false);
  const [hasLocalData, setHasLocalData] = useState(false);
  const [localDataCount, setLocalDataCount] = useState({
    pacientes: 0,
    consultas: 0,
    transacoes: 0,
    prontuarios: 0,
    anamneses: 0,
    documentos: 0
  });

  useEffect(() => {
    // Verificar se há dados no localStorage
    const localPacientes = localStorageService.getPacientes();
    const localConsultas = localStorageService.getConsultas();
    const localTransacoes = localStorageService.getTransacoes();
    const localProntuarios = localStorageService.getProntuarios();
    const localAnamneses = localStorageService.getAnamneses();
    const localDocumentos = localStorageService.getDocumentos();

    const counts = {
      pacientes: localPacientes.length,
      consultas: localConsultas.length,
      transacoes: localTransacoes.length,
      prontuarios: localProntuarios.length,
      anamneses: localAnamneses.length,
      documentos: localDocumentos.length
    };

    setLocalDataCount(counts);
    
    const hasData = Object.values(counts).some(count => count > 0);
    setHasLocalData(hasData);
  }, []);

  const handleMigration = async () => {
    try {
      setMigrating(true);
      await migrateFromLocalStorage();
      setHasLocalData(false); // Dados foram migrados
      toast.success('Migração concluída! Seus dados agora estão no Supabase.');
    } catch (error) {
      console.error('Erro na migração:', error);
      toast.error('Erro durante a migração. Tente novamente.');
    } finally {
      setMigrating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Carregando...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Status da Migração
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Dados no Supabase</p>
            <p className="text-sm text-gray-600">
              {pacientes.length} registros sincronizados
            </p>
          </div>
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Ativo
          </Badge>
        </div>

        {hasLocalData && (
          <>
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-medium text-orange-600">Dados Locais Encontrados</p>
                  <p className="text-sm text-gray-600">
                    Dados ainda no localStorage do navegador
                  </p>
                </div>
                <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Pendente
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                <div>Pacientes: {localDataCount.pacientes}</div>
                <div>Consultas: {localDataCount.consultas}</div>
                <div>Transações: {localDataCount.transacoes}</div>
                <div>Prontuários: {localDataCount.prontuarios}</div>
                <div>Anamneses: {localDataCount.anamneses}</div>
                <div>Documentos: {localDataCount.documentos}</div>
              </div>

              <Button 
                onClick={handleMigration}
                disabled={migrating}
                className="w-full"
              >
                {migrating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Migrando dados...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Migrar Dados para Supabase
                  </>
                )}
              </Button>

              <p className="text-xs text-gray-500 mt-2">
                ⚠️ Esta operação irá transferir todos os seus dados locais para o Supabase. 
                Certifique-se de estar conectado à internet.
              </p>
            </div>
          </>
        )}

        {!hasLocalData && pacientes.length === 0 && (
          <div className="text-center py-4">
            <Database className="h-12 w-12 mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500">
              Sistema configurado e pronto para uso!
            </p>
            <p className="text-sm text-gray-400">
              Seus dados serão salvos automaticamente no Supabase.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MigrationStatus;
