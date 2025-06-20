
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface ProntuarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}

const mockPatients = [
  { id: '1', name: 'Maria Silva', age: 35 },
  { id: '2', name: 'João Santos', age: 42 },
  { id: '3', name: 'Ana Costa', age: 28 },
  { id: '4', name: 'Carlos Oliveira', age: 55 },
  { id: '5', name: 'Fernanda Lima', age: 31 }
];

const ProntuarioModal = ({ isOpen, onClose, onSave }: ProntuarioModalProps) => {
  const [selectedPatient, setSelectedPatient] = useState('');
  const [queixaPrincipal, setQueixaPrincipal] = useState('');
  const [exameClinico, setExameClinico] = useState('');
  const [diagnostico, setDiagnostico] = useState('');
  const [planoTratamento, setPlanoTratamento] = useState('');

  const handleSave = () => {
    if (!selectedPatient) {
      toast.error('Selecione um paciente');
      return;
    }

    const patient = mockPatients.find(p => p.id === selectedPatient);
    const data = {
      patientId: selectedPatient,
      patientName: patient?.name,
      queixaPrincipal,
      exameClinico,
      diagnostico,
      planoTratamento,
      date: new Date().toLocaleDateString('pt-BR')
    };

    onSave(data);
    toast.success('Prontuário criado com sucesso!');
    
    // Reset form
    setSelectedPatient('');
    setQueixaPrincipal('');
    setExameClinico('');
    setDiagnostico('');
    setPlanoTratamento('');
    
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Prontuário</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="patient">Selecionar Paciente *</Label>
            <Select value={selectedPatient} onValueChange={setSelectedPatient}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um paciente..." />
              </SelectTrigger>
              <SelectContent>
                {mockPatients.map((patient) => (
                  <SelectItem key={patient.id} value={patient.id}>
                    {patient.name} - {patient.age} anos
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="queixa">Queixa Principal</Label>
            <Textarea
              id="queixa"
              placeholder="Descreva a queixa principal do paciente..."
              value={queixaPrincipal}
              onChange={(e) => setQueixaPrincipal(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="exame">Exame Clínico</Label>
            <Textarea
              id="exame"
              placeholder="Descreva os achados do exame clínico..."
              value={exameClinico}
              onChange={(e) => setExameClinico(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="diagnostico">Diagnóstico</Label>
            <Textarea
              id="diagnostico"
              placeholder="Diagnóstico clínico..."
              value={diagnostico}
              onChange={(e) => setDiagnostico(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="plano">Plano de Tratamento</Label>
            <Textarea
              id="plano"
              placeholder="Descreva o plano de tratamento..."
              value={planoTratamento}
              onChange={(e) => setPlanoTratamento(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
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
