import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useDentalSystem } from '@/context/DentalSystemContext';
import PatientSelector from '@/components/anamnese/PatientSelector';
import ProcedimentoSelector from './ProcedimentoSelector';
import { DictationTextarea } from '@/components/common/DictationTextarea';
import { useProcedimentos } from '@/hooks/useProcedimentos';
import { formatMoney } from '@/utils/exportCsv';

interface ProntuarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  preSelectedPatient?: string;
  prontuario?: any;
}

const ProntuarioModal = ({ isOpen, onClose, onSave, preSelectedPatient, prontuario }: ProntuarioModalProps) => {
  const { addProntuario, updateProntuario } = useDentalSystem();
  const { procedimentos } = useProcedimentos();
  const [selectedPatient, setSelectedPatient] = useState(preSelectedPatient || '');
  const [dataEvento, setDataEvento] = useState(new Date().toISOString().split('T')[0]);
  const [queixaPrincipal, setQueixaPrincipal] = useState('');
  const [historiaDoenca, setHistoriaDoenca] = useState('');
  const [exameClinico, setExameClinico] = useState('');
  const [diagnostico, setDiagnostico] = useState('');
  const [planoTratamento, setPlanoTratamento] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [selectedProcedimentos, setSelectedProcedimentos] = useState<string[]>([]);
  const [precosLivres, setPrecosLivres] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isOpen) {
      if (prontuario) {
        setSelectedPatient(prontuario.pacienteId);
        const dataStr = prontuario.data instanceof Date 
          ? prontuario.data.toISOString().split('T')[0]
          : typeof prontuario.data === 'string'
            ? prontuario.data.split('T')[0]
            : new Date().toISOString().split('T')[0];
        setDataEvento(dataStr);
        setQueixaPrincipal(prontuario.queixaPrincipal || '');
        setHistoriaDoenca(prontuario.historiaDoenca || '');
        setExameClinico(prontuario.exameClinico || '');
        setDiagnostico(prontuario.diagnostico || '');
        setPlanoTratamento(prontuario.planoTratamento || '');
        setObservacoes(prontuario.observacoes || '');
        setSelectedProcedimentos(prontuario.procedimentosRealizados || []);
      } else {
        setSelectedPatient(preSelectedPatient || '');
        setDataEvento(new Date().toISOString().split('T')[0]);
        setQueixaPrincipal('');
        setHistoriaDoenca('');
        setExameClinico('');
        setDiagnostico('');
        setPlanoTratamento('');
        setObservacoes('');
        setSelectedProcedimentos([]);
        setPrecosLivres({});
      }
    }
  }, [isOpen, prontuario, preSelectedPatient]);

  const calcularValorTotal = () => {
    return selectedProcedimentos.reduce((total, nome) => {
      const procedimento = procedimentos.find(
        (p) => p.nome.toLowerCase() === nome.toLowerCase()
      );
      return total + (procedimento?.preco ?? precosLivres[nome] ?? 0);
    }, 0);
  };

  const handleSave = async () => {
    if (!selectedPatient) {
      toast.error('Selecione um paciente');
      return;
    }

    try {
      const valorTotal = calcularValorTotal();
      const procedimentosRealizados = [...selectedProcedimentos];

      const prontuarioData = {
        pacienteId: selectedPatient,
        data: new Date(`${dataEvento}T12:00:00`),
        queixaPrincipal: queixaPrincipal.trim(),
        historiaDoenca: historiaDoenca.trim(),
        exameClinico: exameClinico.trim(),
        diagnostico: diagnostico.trim(),
        planoTratamento: planoTratamento.trim(),
        procedimentosRealizados,
        observacoes: observacoes.trim()
      };

      if (prontuario?.id) {
        if (updateProntuario) {
            await updateProntuario(prontuario.id, prontuarioData);
        } else {
            console.error('updateProntuario não está definido no DentalSystemContext');
        }
      } else {
        await addProntuario(prontuarioData);
      }
      
      onSave({ ...prontuarioData, valorTotal });
      onClose();
    } catch (error) {
      console.error('Erro ao salvar prontuário:', error);
      toast.error('Erro ao salvar prontuário');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{prontuario ? 'Editar Prontuário' : 'Novo Prontuário'}</DialogTitle>
        </DialogHeader>

        <Tabs key={preSelectedPatient ? 'proc' : 'dados'} defaultValue={preSelectedPatient ? 'procedimentos' : 'dados'} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dados">Dados Clínicos</TabsTrigger>
            <TabsTrigger value="procedimentos">Procedimentos</TabsTrigger>
          </TabsList>
          
          <TabsContent value="dados" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!preSelectedPatient && !prontuario && (
                <div>
                  <Label>Paciente</Label>
                  <PatientSelector value={selectedPatient} onChange={setSelectedPatient} />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="dataEvento">Data do Prontuário (Útil para Histórico Passado)</Label>
                <Input 
                  id="dataEvento" 
                  type="date" 
                  value={dataEvento}
                  onChange={(e) => setDataEvento(e.target.value)}
                />
              </div>
            </div>

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
                precosLivres={precosLivres}
                onPrecoLivreChange={(nome, preco) =>
                  setPrecosLivres((prev) => ({ ...prev, [nome]: preco }))
                }
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {selectedProcedimentos.length > 0 && (
              <span className="font-medium text-green-600">
                Total: {formatMoney(calcularValorTotal())}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {prontuario ? 'Atualizar Prontuário' : 'Salvar Prontuário'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProntuarioModal;
