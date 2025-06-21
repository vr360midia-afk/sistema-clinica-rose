
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Calendar, ClipboardList } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import EmptyState from '@/components/common/EmptyState';
import AnamneseModal from '@/components/anamnese/AnamneseModal';

interface PatientAnamnesisProps {
  patient: any;
}

const PatientAnamnesis = ({ patient }: PatientAnamnesisProps) => {
  const { anamneses } = useDentalSystem();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const patientAnamnesis = anamneses.filter(a => a.pacienteId === patient.id);

  const handleNewAnamnesis = () => {
    setIsModalOpen(true);
  };

  const handleSaveAnamnesis = (data: any) => {
    // O modal já salva através do contexto
    console.log('Anamnese salva para:', patient.nome);
    setIsModalOpen(false);
  };

  if (patientAnamnesis.length === 0) {
    return (
      <>
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma anamnese encontrada"
          description="Este paciente ainda não possui anamneses cadastradas"
          action={{
            label: 'Nova Anamnese',
            onClick: handleNewAnamnesis
          }}
        />
        <AnamneseModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveAnamnesis}
          preSelectedPatient={patient.id}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Anamneses ({patientAnamnesis.length})</h3>
        <Button onClick={handleNewAnamnesis} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Nova Anamnese
        </Button>
      </div>

      <div className="grid gap-4">
        {patientAnamnesis.map((anamnese) => (
          <Card key={anamnese.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-base">{anamnese.queixaPrincipal}</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(anamnese.data).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {anamnese.historiaAtual && (
                <div>
                  <span className="text-sm font-medium">História Atual:</span>
                  <p className="text-sm text-gray-600 mt-1">{anamnese.historiaAtual}</p>
                </div>
              )}
              
              {anamnese.historiaFamiliar && (
                <div>
                  <span className="text-sm font-medium">História Familiar:</span>
                  <p className="text-sm text-gray-600 mt-1">{anamnese.historiaFamiliar}</p>
                </div>
              )}

              {anamnese.historiaMedica && (
                <div>
                  <span className="text-sm font-medium">História Médica:</span>
                  <p className="text-sm text-gray-600 mt-1">{anamnese.historiaMedica}</p>
                </div>
              )}

              {anamnese.alergias && (
                <div>
                  <span className="text-sm font-medium">Alergias:</span>
                  <p className="text-sm text-gray-600 mt-1">{anamnese.alergias}</p>
                </div>
              )}

              {anamnese.medicamentos && (
                <div>
                  <span className="text-sm font-medium">Medicamentos:</span>
                  <p className="text-sm text-gray-600 mt-1">{anamnese.medicamentos}</p>
                </div>
              )}

              {anamnese.observacoes && (
                <div>
                  <span className="text-sm font-medium">Observações:</span>
                  <p className="text-sm text-gray-600 mt-1">{anamnese.observacoes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <AnamneseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveAnamnesis}
        preSelectedPatient={patient.id}
      />
    </div>
  );
};

export default PatientAnamnesis;
