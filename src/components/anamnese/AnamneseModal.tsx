
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useDentalSystem } from '@/context/DentalSystemContext';
import PatientSelector from './PatientSelector';

interface AnamneseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  preSelectedPatient?: string;
}

const AnamneseModal = ({ isOpen, onClose, onSave, preSelectedPatient }: AnamneseModalProps) => {
  const { addAnamnese, pacientes } = useDentalSystem();
  const [selectedPatient, setSelectedPatient] = useState(preSelectedPatient || '');
  const [queixaPrincipal, setQueixaPrincipal] = useState('');
  const [historiaAtual, setHistoriaAtual] = useState('');
  const [historiaFamiliar, setHistoriaFamiliar] = useState('');
  const [historiaMedica, setHistoriaMedica] = useState('');
  const [alergias, setAlergias] = useState('');
  const [medicamentos, setMedicamentos] = useState('');
  const [habitosViciosPositivos, setHabitosViciosPositivos] = useState('');
  const [habitosViciosNegativos, setHabitosViciosNegativos] = useState('');
  const [exameExtraBucal, setExameExtraBucal] = useState('');
  const [exameIntraBucal, setExameIntraBucal] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const handleSave = async () => {
    if (!selectedPatient) {
      toast.error('Selecione um paciente');
      return;
    }

    if (!queixaPrincipal.trim()) {
      toast.error('Informe a queixa principal');
      return;
    }

    try {
      const patient = pacientes.find(p => p.id === selectedPatient);
      
      const anamneseData = {
        pacienteId: selectedPatient,
        data: new Date(),
        queixaPrincipal: queixaPrincipal.trim(),
        historiaAtual: historiaAtual.trim(),
        historiaFamiliar: historiaFamiliar.trim(),
        historiaMedica: historiaMedica.trim(),
        alergias: alergias.trim(),
        medicamentos: medicamentos.trim(),
        habitosViciosPositivos: habitosViciosPositivos.trim(),
        habitosViciosNegativos: habitosViciosNegativos.trim(),
        exameExtraBucal: exameExtraBucal.trim(),
        exameIntraBucal: exameIntraBucal.trim(),
        observacoes: observacoes.trim()
      };

      await addAnamnese(anamneseData);
      onSave(anamneseData);
      
      // Reset form
      setSelectedPatient(preSelectedPatient || '');
      setQueixaPrincipal('');
      setHistoriaAtual('');
      setHistoriaFamiliar('');
      setHistoriaMedica('');
      setAlergias('');
      setMedicamentos('');
      setHabitosViciosPositivos('');
      setHabitosViciosNegativos('');
      setExameExtraBucal('');
      setExameIntraBucal('');
      setObservacoes('');
      
      onClose();
    } catch (error) {
      console.error('Erro ao salvar anamnese:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Anamnese</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!preSelectedPatient && (
            <PatientSelector value={selectedPatient} onChange={setSelectedPatient} />
          )}

          <div>
            <Label htmlFor="queixa">Queixa Principal *</Label>
            <Textarea
              id="queixa"
              placeholder="Descreva a queixa principal do paciente..."
              value={queixaPrincipal}
              onChange={(e) => setQueixaPrincipal(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="historia-atual">História Atual</Label>
            <Textarea
              id="historia-atual"
              placeholder="Descreva a história atual da doença..."
              value={historiaAtual}
              onChange={(e) => setHistoriaAtual(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="historia-familiar">História Familiar</Label>
            <Textarea
              id="historia-familiar"
              placeholder="Descreva a história familiar relevante..."
              value={historiaFamiliar}
              onChange={(e) => setHistoriaFamiliar(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="historia-medica">História Médica</Label>
            <Textarea
              id="historia-medica"
              placeholder="Descreva a história médica pregressa..."
              value={historiaMedica}
              onChange={(e) => setHistoriaMedica(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="alergias">Alergias</Label>
              <Textarea
                id="alergias"
                placeholder="Liste alergias conhecidas..."
                value={alergias}
                onChange={(e) => setAlergias(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="medicamentos">Medicamentos</Label>
              <Textarea
                id="medicamentos"
                placeholder="Liste medicamentos em uso..."
                value={medicamentos}
                onChange={(e) => setMedicamentos(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="habitos-positivos">Hábitos e Vícios (Positivos)</Label>
              <Textarea
                id="habitos-positivos"
                placeholder="Hábitos saudáveis..."
                value={habitosViciosPositivos}
                onChange={(e) => setHabitosViciosPositivos(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="habitos-negativos">Hábitos e Vícios (Negativos)</Label>
              <Textarea
                id="habitos-negativos"
                placeholder="Hábitos prejudiciais..."
                value={habitosViciosNegativos}
                onChange={(e) => setHabitosViciosNegativos(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="exame-extra">Exame Extra-Bucal</Label>
              <Textarea
                id="exame-extra"
                placeholder="Achados do exame extra-bucal..."
                value={exameExtraBucal}
                onChange={(e) => setExameExtraBucal(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="exame-intra">Exame Intra-Bucal</Label>
              <Textarea
                id="exame-intra"
                placeholder="Achados do exame intra-bucal..."
                value={exameIntraBucal}
                onChange={(e) => setExameIntraBucal(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              placeholder="Observações adicionais..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Salvar Anamnese
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AnamneseModal;
