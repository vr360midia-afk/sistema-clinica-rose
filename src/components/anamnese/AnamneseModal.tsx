import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useDentalSystem } from '@/context/DentalSystemContext';
import PatientSelector from './PatientSelector';
import DigitalSignature, { SignatureData } from '@/components/signature/DigitalSignature';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileSignature, Share, Eye } from 'lucide-react';

interface AnamneseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  preSelectedPatient?: string;
}

const AnamneseModal = ({ isOpen, onClose, onSave, preSelectedPatient }: AnamneseModalProps) => {
  const { addAnamnese, pacientes, generateSignatureLink, signAnamnese } = useDentalSystem();
  const [selectedPatient, setSelectedPatient] = useState(preSelectedPatient || '');
  const [step, setStep] = useState<'form' | 'signature-patient' | 'signature-dentist' | 'link'>('form');
  const [anamneseId, setAnamneseId] = useState<string>('');
  const [signatureLink, setSignatureLink] = useState<string>('');
  
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

  const handleSaveForm = async () => {
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
        observacoes: observacoes.trim(),
        statusAssinatura: 'pendente' as const
      };

      const savedAnamnese = await addAnamnese(anamneseData);
      setAnamneseId(savedAnamnese.id);
      setStep('link');
      
      toast.success('Anamnese salva! Escolha como coletar as assinaturas.');
    } catch (error) {
      console.error('Erro ao salvar anamnese:', error);
    }
  };

  const handleGenerateLink = async () => {
    const link = await generateSignatureLink(anamneseId);
    setSignatureLink(link);
    toast.success('Link gerado! Envie para o paciente assinar.');
  };

  const handleDirectSignature = () => {
    setStep('signature-patient');
  };

  const handlePatientSignature = async (signatureData: SignatureData) => {
    try {
      await signAnamnese(anamneseId, signatureData, 'paciente');
      setStep('signature-dentist');
    } catch (error) {
      console.error('Erro ao salvar assinatura do paciente:', error);
    }
  };

  const handleDentistSignature = async (signatureData: SignatureData) => {
    try {
      await signAnamnese(anamneseId, signatureData, 'dentista');
      toast.success('Anamnese finalizada com ambas as assinaturas!');
      onSave({ id: anamneseId });
      resetForm();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar assinatura do dentista:', error);
    }
  };

  const resetForm = () => {
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
    setStep('form');
    setAnamneseId('');
    setSignatureLink('');
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(signatureLink);
      toast.success('Link copiado para a área de transferência!');
    } catch (error) {
      toast.error('Erro ao copiar link');
    }
  };

  const getCurrentPatientName = () => {
    const patient = pacientes.find(p => p.id === selectedPatient);
    return patient ? patient.nome : 'Paciente';
  };

  if (step === 'signature-patient') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Assinatura do Paciente</DialogTitle>
          </DialogHeader>
          <DigitalSignature
            title="Assinatura do Paciente"
            signerName={getCurrentPatientName()}
            signerRole="paciente"
            documentType="anamnese"
            onSignatureComplete={handlePatientSignature}
            onCancel={() => setStep('link')}
          />
        </DialogContent>
      </Dialog>
    );
  }

  if (step === 'signature-dentist') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Assinatura do Dentista</DialogTitle>
          </DialogHeader>
          <DigitalSignature
            title="Assinatura do Dentista"
            signerName="Dr. Dentista"
            signerRole="dentista"
            documentType="anamnese"
            onSignatureComplete={handleDentistSignature}
            onCancel={() => setStep('signature-patient')}
          />
        </DialogContent>
      </Dialog>
    );
  }

  if (step === 'link') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Opções de Assinatura</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share className="h-5 w-5 text-blue-600" />
                  Enviar Link para Assinatura
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Gere um link único para que o paciente possa assinar remotamente pelo celular ou computador.
                </p>
                
                {!signatureLink ? (
                  <Button onClick={handleGenerateLink} className="w-full">
                    <Share className="h-4 w-4 mr-2" />
                    Gerar Link de Assinatura
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-muted rounded border">
                      <p className="text-xs text-muted-foreground mb-1">Link gerado:</p>
                      <p className="text-sm font-mono break-all">{signatureLink}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={copyToClipboard} variant="outline" className="flex-1">
                        Copiar Link
                      </Button>
                      <Button onClick={() => window.open(`mailto:?subject=Assinatura de Anamnese&body=Por favor, acesse este link para assinar sua anamnese: ${signatureLink}`, '_blank')} variant="outline" className="flex-1">
                        Enviar por Email
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSignature className="h-5 w-5 text-green-600" />
                  Assinatura Presencial
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Colete a assinatura diretamente no consultório usando tablet, celular ou mouse.
                </p>
                <Button onClick={handleDirectSignature} className="w-full" variant="outline">
                  <FileSignature className="h-4 w-4 mr-2" />
                  Iniciar Assinatura Presencial
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => { resetForm(); onClose(); }}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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
          <Button onClick={handleSaveForm}>
            <FileSignature className="h-4 w-4 mr-2" />
            Salvar e Configurar Assinaturas
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AnamneseModal;
