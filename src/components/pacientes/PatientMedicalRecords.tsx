
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, Calendar } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import EmptyState from '@/components/common/EmptyState';
import ProntuarioModal from '@/components/prontuarios/ProntuarioModal';

interface PatientMedicalRecordsProps {
  patient: any;
}

const PatientMedicalRecords = ({ patient }: PatientMedicalRecordsProps) => {
  const { prontuarios } = useDentalSystem();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const patientProntuarios = prontuarios.filter(p => p.pacienteId === patient.id);

  const handleNewProntuario = () => {
    setIsModalOpen(true);
  };

  const handleSaveProntuario = (data: any) => {
    // O modal já salva através do contexto
    console.log('Prontuário salvo para:', patient.nome);
    setIsModalOpen(false);
  };

  if (patientProntuarios.length === 0) {
    return (
      <>
        <EmptyState
          icon={FileText}
          title="Nenhum prontuário encontrado"
          description="Este paciente ainda não possui prontuários médicos cadastrados"
          action={{
            label: 'Criar Prontuário',
            onClick: handleNewProntuario
          }}
        />
        <ProntuarioModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveProntuario}
          preSelectedPatient={patient.id}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Prontuários Médicos ({patientProntuarios.length})</h3>
        <Button onClick={handleNewProntuario} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Novo Prontuário
        </Button>
      </div>

      <div className="grid gap-4">
        {patientProntuarios.map((prontuario) => (
          <Card key={prontuario.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-base">{prontuario.queixaPrincipal}</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(prontuario.data).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
                {prontuario.diagnostico && (
                  <Badge variant="outline">
                    {prontuario.diagnostico}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {prontuario.historiaDoenca && (
                <div>
                  <span className="text-sm font-medium">História da Doença:</span>
                  <p className="text-sm text-gray-600 mt-1">{prontuario.historiaDoenca}</p>
                </div>
              )}
              
              {prontuario.exameClinico && (
                <div>
                  <span className="text-sm font-medium">Exame Clínico:</span>
                  <p className="text-sm text-gray-600 mt-1">{prontuario.exameClinico}</p>
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

              {prontuario.planoTratamento && (
                <div>
                  <span className="text-sm font-medium">Plano de Tratamento:</span>
                  <p className="text-sm text-gray-600 mt-1">{prontuario.planoTratamento}</p>
                </div>
              )}

              {prontuario.observacoes && (
                <div>
                  <span className="text-sm font-medium">Observações:</span>
                  <p className="text-sm text-gray-600 mt-1">{prontuario.observacoes}</p>
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

      <ProntuarioModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProntuario}
        preSelectedPatient={patient.id}
      />
    </div>
  );
};

export default PatientMedicalRecords;
