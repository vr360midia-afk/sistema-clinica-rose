
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, Calendar, Pencil, Sparkles } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import EmptyState from '@/components/common/EmptyState';
import ProntuarioModal from '@/components/prontuarios/ProntuarioModal';
import { PatientIA } from './PatientIA';
import { EvolucaoSorriso } from './EvolucaoSorriso';
import { Odontograma } from './Odontograma';

interface PatientMedicalRecordsProps {
  patient: any;
}

const PatientMedicalRecords = ({ patient }: PatientMedicalRecordsProps) => {
  const { prontuarios } = useDentalSystem();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [prontuarioEmEdicao, setProntuarioEmEdicao] = useState<any>(null);
  
  const patientProntuarios = prontuarios.filter(p => p.pacienteId === patient.id);

  const handleNewProntuario = () => {
    setProntuarioEmEdicao(null);
    setIsModalOpen(true);
  };

  const handleEditProntuario = (prontuario: any) => {
    setProntuarioEmEdicao(prontuario);
    setIsModalOpen(true);
  };

  const handleSaveProntuario = (data: any) => {
    // O modal já salva através do contexto
    console.log('Prontuário salvo para:', patient.nome);
    setIsModalOpen(false);
    setProntuarioEmEdicao(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Prontuários Médicos ({patientProntuarios.length})</h3>
        <Button onClick={handleNewProntuario} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Novo Prontuário
        </Button>
      </div>

      <PatientIA patient={patient} />

      {patientProntuarios.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum prontuário encontrado"
          description="Este paciente ainda não possui prontuários médicos cadastrados"
          action={{
            label: 'Criar Prontuário',
            onClick: handleNewProntuario
          }}
        />
      ) : (
        <div className="grid gap-4">
        {patientProntuarios.map((prontuario) => (
          <Card key={prontuario.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-base">{prontuario.queixaPrincipal}</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(prontuario.data).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
                {prontuario.diagnostico && (
                  <Badge variant="outline">
                    {prontuario.diagnostico}
                  </Badge>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="ml-2 text-indigo-600 hover:text-indigo-800"
                  onClick={() => handleEditProntuario(prontuario)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {prontuario.historiaDoenca && (
                <div>
                  <span className="text-sm font-medium">História da Doença:</span>
                  <p className="text-sm text-muted-foreground mt-1">{prontuario.historiaDoenca}</p>
                </div>
              )}
              
              {prontuario.exameClinico && (
                <div>
                  <span className="text-sm font-medium">Exame Clínico:</span>
                  <p className="text-sm text-muted-foreground mt-1">{prontuario.exameClinico}</p>
                </div>
              )}

              {prontuario.procedimentosRealizados.length > 0 && (
                <div>
                  <span className="text-sm font-medium">Procedimentos Realizados:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {prontuario.procedimentosRealizados.map((proc, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {proc}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {prontuario.restauracoesPreexistentes?.possuiPreexistentes && (
                <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs space-y-1.5 text-foreground">
                  <div className="flex items-center justify-between font-semibold text-amber-700 dark:text-amber-400">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Restaurações Preexistentes & Lentes em Resina
                    </span>
                    {prontuario.restauracoesPreexistentes.dataProximaManutencaoSemestral && (
                      <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-100/50 dark:bg-amber-950/50">
                        📅 Manutenção: {new Date(`${prontuario.restauracoesPreexistentes.dataProximaManutencaoSemestral}T12:00:00`).toLocaleDateString('pt-BR')}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-muted-foreground">
                    <div><strong>Tipo:</strong> {prontuario.restauracoesPreexistentes.tipoRestauracao || 'Lentes/Facetas em Resina'}</div>
                    <div><strong>Dentes:</strong> {prontuario.restauracoesPreexistentes.dentesEnvolvidos || 'Conforme exame'}</div>
                    <div><strong>Remoção Prevista:</strong> {prontuario.restauracoesPreexistentes.remocaoPrevista ? 'Sim' : 'Não'}</div>
                    <div><strong>Tratamento Adicional:</strong> {prontuario.restauracoesPreexistentes.necessidadeTratamentoAdicional ? 'Sim' : 'Não'}</div>
                    {prontuario.restauracoesPreexistentes.condicoesAposRemocao && (
                      <div className="sm:col-span-2"><strong>Condições pós-remoção:</strong> {prontuario.restauracoesPreexistentes.condicoesAposRemocao}</div>
                    )}
                    {prontuario.restauracoesPreexistentes.orcamentoComplementar && (
                      <div className="sm:col-span-2 text-primary font-medium">
                        <strong>Orçamento Complementar:</strong> R$ {prontuario.restauracoesPreexistentes.orcamentoComplementar} ({prontuario.restauracoesPreexistentes.aprovacaoPaciente || 'Pendente de aprovação'})
                      </div>
                    )}
                  </div>
                </div>
              )}

              {prontuario.planoTratamento && (
                <div>
                  <span className="text-sm font-medium">Plano de Tratamento:</span>
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{prontuario.planoTratamento}</p>
                </div>
              )}

              {prontuario.observacoes && (
                <div>
                  <span className="text-sm font-medium">Observações:</span>
                  <p className="text-sm text-muted-foreground mt-1">{prontuario.observacoes}</p>
                </div>
              )}

              {prontuario.anexos && prontuario.anexos.length > 0 && (
                <div>
                  <span className="text-sm font-medium">Anexos:</span>
                  <div className="flex gap-2 mt-1">
                    {prontuario.anexos.map((anexo, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        📎 Anexo {index + 1}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      )}

      <Odontograma patient={patient} />
      <EvolucaoSorriso patient={patient} />

      <ProntuarioModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setProntuarioEmEdicao(null);
        }}
        onSave={handleSaveProntuario}
        preSelectedPatient={patient.id}
        prontuario={prontuarioEmEdicao}
      />
    </div>
  );
};

export default PatientMedicalRecords;
