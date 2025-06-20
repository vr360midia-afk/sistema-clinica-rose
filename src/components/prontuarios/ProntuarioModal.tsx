
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import ProcedimentoSelector from './ProcedimentoSelector';

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

const mockProcedimentos = [
  { id: '1', nome: 'Limpeza Dental', preco: 150.00 },
  { id: '2', nome: 'Restauração', preco: 280.00 },
  { id: '3', nome: 'Canal', preco: 450.00 },
  { id: '4', nome: 'Extração', preco: 200.00 },
  { id: '5', nome: 'Clareamento', preco: 600.00 }
];

const ProntuarioModal = ({ isOpen, onClose, onSave }: ProntuarioModalProps) => {
  const [selectedPatient, setSelectedPatient] = useState('');
  const [queixaPrincipal, setQueixaPrincipal] = useState('');
  const [exameClinico, setExameClinico] = useState('');
  const [diagnostico, setDiagnostico] = useState('');
  const [planoTratamento, setPlanoTratamento] = useState('');
  const [selectedProcedimentos, setSelectedProcedimentos] = useState<string[]>([]);

  const calcularValorTotal = () => {
    return selectedProcedimentos.reduce((total, procedimentoId) => {
      const procedimento = mockProcedimentos.find(p => p.id === procedimentoId);
      return total + (procedimento?.preco || 0);
    }, 0);
  };

  const handleSave = () => {
    if (!selectedPatient) {
      toast.error('Selecione um paciente');
      return;
    }

    const patient = mockPatients.find(p => p.id === selectedPatient);
    const valorTotal = calcularValorTotal();
    const procedimentosRealizados = selectedProcedimentos.map(id => {
      const proc = mockProcedimentos.find(p => p.id === id);
      return proc ? { id, nome: proc.nome, preco: proc.preco } : null;
    }).filter(Boolean);

    const data = {
      patientId: selectedPatient,
      patientName: patient?.name,
      queixaPrincipal,
      exameClinico,
      diagnostico,
      planoTratamento,
      procedimentos: procedimentosRealizados,
      valorTotal,
      date: new Date().toLocaleDateString('pt-BR')
    };

    onSave(data);
    toast.success(`Prontuário criado com sucesso! Valor total: R$ ${valorTotal.toFixed(2)}`);
    
    // Reset form
    setSelectedPatient('');
    setQueixaPrincipal('');
    setExameClinico('');
    setDiagnostico('');
    setPlanoTratamento('');
    setSelectedProcedimentos([]);
    
    onClose();
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
          </TabsContent>
          
          <TabsContent value="procedimentos" className="space-y-4">
            <div>
              <Label className="text-base font-medium">Procedimentos Realizados</Label>
              <p className="text-sm text-gray-600 mb-4">
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
          <div className="text-sm text-gray-600">
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
