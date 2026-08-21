
import React, { useRef, useState } from 'react';
import AuditLogViewer from '@/components/admin/AuditLogViewer';
import { downloadBackupCompleto, lerArquivoBackup, restaurarBackup, type ProgressoBackup } from '@/utils/backup';
import BackupProgress from '@/components/common/BackupProgress';
import { marcarBackupFeito, ultimoBackupEm } from '@/hooks/useBackupAutomatico';
import { useAuth } from '@/context/AuthContext';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2, Download, Upload } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { toast } from 'sonner';
import RolesManager from '@/components/admin/RolesManager';
import SenhaMestreManager from '@/components/admin/SenhaMestreManager';
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

  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [modo, setModo] = useState<'backup' | 'restore' | null>(null);
  const [progresso, setProgresso] = useState<ProgressoBackup | null>(null);
  const [resumoRestauracao, setResumoRestauracao] = useState<string | null>(null);
  const [ultimoBackup, setUltimoBackup] = useState<Date | null>(() => ultimoBackupEm(user?.id));

  const handleBackup = async () => {
    setBusy(true);
    setModo('backup');
    setResumoRestauracao(null);
    setProgresso({ etapa: 'Iniciando backup', percentual: 0 });
    try {
      const total = await downloadBackupCompleto('backup-dental', true, setProgresso);
      marcarBackupFeito(user?.id);
      setUltimoBackup(new Date());
      toast.success(`Backup completo gerado com ${total} registros (100%)`);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar o backup');
    } finally {
      setBusy(false);
      window.setTimeout(() => { setProgresso(null); setModo(null); }, 1500);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setModo('restore');
    setResumoRestauracao(null);
    setProgresso({ etapa: 'Lendo arquivo', percentual: 0 });
    try {
      const payload = await lerArquivoBackup(file);
      const { inseridos, arquivos, erros, porTabela } = await restaurarBackup(payload, setProgresso);
      const detalhes = Object.entries(porTabela).map(([tabela, qtd]) => `${tabela}: ${qtd}`).join(' • ');
      setResumoRestauracao(`${inseridos} registros e ${arquivos} arquivo(s) restaurados.${detalhes ? ` ${detalhes}` : ''}`);
      if (erros.length) {
        toast.warning(`${inseridos} registros e ${arquivos} arquivo(s) restaurados. Falhas: ${erros.map(x => x.tabela).join(', ')}`);
      } else {
        toast.success(`100% concluído: ${inseridos} registros e ${arquivos} arquivo(s) restaurados. Atualizando a página...`);
      }
      setTimeout(() => window.location.reload(), 2500);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Erro ao restaurar backup');
      setProgresso(null);
      setModo(null);
    } finally {
      setBusy(false);
    }
  };


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
          <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Administração</h1>
          <p className="text-muted-foreground">Gerenciamento de dados do sistema</p>
        </div>

        <SenhaMestreManager />

        <RolesManager />

        {/* Status dos dados */}
        <Card>
          <CardHeader>
            <CardTitle>Status dos Dados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-blue-600">{pacientes.length}</div>
                <div className="text-sm text-muted-foreground">Pacientes</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-green-600">{consultas.length}</div>
                <div className="text-sm text-muted-foreground">Consultas</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-purple-600">{transacoes.length}</div>
                <div className="text-sm text-muted-foreground">Transações</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-orange-600">{prontuarios.length}</div>
                <div className="text-sm text-muted-foreground">Prontuários</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-red-600">{anamneses.length}</div>
                <div className="text-sm text-muted-foreground">Anamneses</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-muted-foreground">{documentos.length}</div>
                <div className="text-sm text-muted-foreground">Documentos</div>
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
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O backup completo inclui pacientes, consultas, financeiro, prontuários, anamneses,
              orçamentos, procedimentos, medicamentos, dentistas, parceiros, estoque e configurações.
              Ele é gerado automaticamente conforme a frequência definida em Configurações
              {ultimoBackup && ` (último: ${ultimoBackup.toLocaleString('pt-BR')})`}.
              Para migrar para outra conta, basta restaurar este arquivo estando logado nela.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button variant="outline" className="w-full" onClick={handleBackup} disabled={busy}>
                <Download className="h-4 w-4 mr-2" />
                {busy && modo === 'backup' ? `Gerando... ${progresso?.percentual ?? 0}%` : 'Fazer Backup Completo'}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {busy && modo === 'restore' ? `Restaurando... ${progresso?.percentual ?? 0}%` : 'Restaurar Backup'}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={handleRestore}
              />
            </div>

            <BackupProgress
              progresso={progresso}
              titulo={modo === 'restore' ? 'Restauração' : modo === 'backup' ? 'Backup' : undefined}
            />
            {resumoRestauracao && (
              <p className="text-sm text-muted-foreground">
                Restauração concluída: {resumoRestauracao} Atualizando a página...
              </p>
            )}

          </CardContent>
        </Card>

        <AuditLogViewer />
      </div>
    </Layout>
  );
};

export default Admin;
