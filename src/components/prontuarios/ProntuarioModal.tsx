
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useDentalSystem } from '@/context/DentalSystemContext';
import PatientSelector from '@/components/anamnese/PatientSelector';
import ProcedimentoSelector from './ProcedimentoSelector';
import { DictationTextarea } from '@/components/common/DictationTextarea';

interface ProntuarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  preSelectedPatient?: string;
}

const mockProcedimentos = [
  { id: '1', nome: 'Limpeza Dental', preco: 150.00 },
  { id: '2', nome: 'Restauração', preco: 280.00 },
  { id: '3', nome: 'Canal', preco: 450.00 },
  { id: '4', nome: 'Extração', preco: 200.00 },
  { id: '5', nome: 'Clareamento', preco: 600.00 }
];

const ProntuarioModal = ({ isOpen, onClose, onSave, preSelectedPatient }: ProntuarioModalProps) => {
  const { addProntuario, pacientes } = useDentalSystem();
  const [selectedPatient, setSelectedPatient] = useState(preSelectedPatient || '');
  const [queixaPrincipal, setQueixaPrincipal] = useState('');
  const [historiaDoenca, setHistoriaDoenca] = useState('');
  const [exameClinico, setExameClinico] = useState('');
  const [diagnostico, setDiagnostico] = useState('');
  const [planoTratamento, setPlanoTratamento] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [selectedProcedimentos, setSelectedProcedimentos] = useState<string[]>([]);

  const calcularValorTotal = () => {
    return selectedProcedimentos.reduce((total, procedimentoId) => {
      const procedimento = mockProcedimentos.find(p => p.id === procedimentoId);
      return total + (procedimento?.preco || 0);
    }, 0);
  };

  const handleSave = async () => {
    if (!selectedPatient) {
      toast.error('Selecione um paciente');
      return;
    }


    try {
      const patient = pacientes.find(p => p.id === selectedPatient);
      const valorTotal = calcularValorTotal();
      const procedimentosRealizados = selectedProcedimentos.map(id => {
        const proc = mockProcedimentos.find(p => p.id === id);
        return proc?.nome || '';
      }).filter(Boolean);

      const prontuarioData = {
        pacienteId: selectedPatient,
        data: new Date(),
        queixaPrincipal: queixaPrincipal.trim(),
        historiaDoenca: historiaDoenca.trim(),
        exameClinico: exameClinico.trim(),
        diagnostico: diagnostico.trim(),
        planoTratamento: planoTratamento.trim(),
        procedimentosRealizados,
        observacoes: observacoes.trim()
      };

      await addProntuario(prontuarioData);
      onSave({ ...prontuarioData, valorTotal });
      
      // Reset form
      setSelectedPatient(preSelectedPatient || '');
      setQueixaPrincipal('');
      setHistoriaDoenca('');
      setExameClinico('');
      setDiagnostico('');
      setPlanoTratamento('');
      setObservacoes('');
      setSelectedProcedimentos([]);
      
      onClose();
    } catch (error) {
      console.error('Erro ao salvar prontuário:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Prontuário</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="dados" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dados">Dados Clínicos</TabsTrigger>
            <TabsTrigger value="procedimentos">Procedimentos</TabsTrigger>
          </TabsList>
          
          <TabsContent value="dados" className="space-y-4">
            {!preSelectedPatient && (
              <PatientSelector value={selectedPatient} onChange={setSelectedPatient} />
            )}

            <DictationTextarea
              id="queixa"
              label="Queixa Principal"
              placeholder="Descreva a queixa principal do paciente..."
              value={queixaPrincipal}
              onChange={setQueixaPrincipal}
            />

            <DictationTextarea
              id="historia"
              label="História da Doença"
              placeholder="Descreva a história da doença atual..."
              value={historiaDoenca}
              onChange={setHistoriaDoenca}
            />

            <DictationTextarea
              id="exame"
              label="Exame Clínico"
              placeholder="Descreva os achados do exame clínico..."
              value={exameClinico}
              onChange={setExameClinico}
            />

            <DictationTextarea
              id="diagnostico"
              label="Diagnóstico"
              placeholder="Diagnóstico clínico..."
              value={diagnostico}
              onChange={setDiagnostico}
            />

            <DictationTextarea
              id="plano"
              label="Plano de Tratamento"
              placeholder="Descreva o plano de tratamento..."
              value={planoTratamento}
              onChange={setPlanoTratamento}
            />

            <DictationTextarea
              id="observacoes"
              label="Observações"
              placeholder="Observações adicionais..."
              value={observacoes}
              onChange={setObservacoes}
            />
          </TabsContent>
          
          <TabsContent value="procedimentos" className="space-y-4">
            <div>
              <Label className="text-base font-medium">Procedimentos Realizados</Label>
              <p className="text-sm text-muted-foreground mb-4">
                Selecione os procedimentos que foram realizados nesta consulta:
              </p>
              <ProcedimentoSelector
                selectedProcedimentos={selectedProcedimentos}
                onSelectionChange={setSelectedProcedimentos}
                valorTotal={calcularValorTotal()}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {selectedProcedimentos.length > 0 && (
              <span className="font-medium text-green-600">
                Total: R$ {calcularValorTotal().toFixed(2)}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Salvar Prontuário
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProntuarioModal;
