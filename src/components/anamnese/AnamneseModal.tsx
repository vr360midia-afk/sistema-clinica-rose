import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useDentalSystem } from '@/context/DentalSystemContext';
import PatientSelector from './PatientSelector';
import DigitalSignature, { SignatureData } from '@/components/signature/DigitalSignature';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FileSignature,
  FileText,
  Share2,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  Clock,
  Sparkles,
  Link2,
  Smartphone,
  Send,
} from 'lucide-react';
import { openWhatsApp } from '@/lib/whatsapp';

interface AnamneseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (data: any) => void;
  preSelectedPatient?: string;
}

const AnamneseModal = ({ isOpen, onClose, onSave, preSelectedPatient }: AnamneseModalProps) => {
  const { addAnamnese, pacientes, generateSignatureLink, signAnamnese } = useDentalSystem();
  const [selectedPatient, setSelectedPatient] = useState(preSelectedPatient || '');
  const [step, setStep] = useState<'form' | 'signature-patient' | 'signature-dentist' | 'link'>('form');
  const [anamneseId, setAnamneseId] = useState<string>('');
  const [linkPreencher, setLinkPreencher] = useState<string>('');
  const [linkAssinar, setLinkAssinar] = useState<string>('');
  const [copiadoPreencher, setCopiadoPreencher] = useState(false);
  const [copiadoAssinar, setCopiadoAssinar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  
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

  useEffect(() => {
    if (preSelectedPatient) {
      setSelectedPatient(preSelectedPatient);
    }
  }, [preSelectedPatient]);

  // Enviar link direto para o paciente preencher no celular (sem precisar digitar a ficha antes)
  const handleEnviarLinkDiretoParaPaciente = async () => {
    if (!selectedPatient) {
      toast.error('Selecione primeiro o paciente acima');
      return;
    }

    try {
      setSalvando(true);
      const patient = pacientes.find(p => p.id === selectedPatient);

      const anamneseData = {
        pacienteId: selectedPatient,
        pacienteNome: patient?.nome,
        data: new Date(),
        queixaPrincipal: queixaPrincipal.trim() || 'Avaliação Odontológica Inicial',
        historiaAtual: historiaAtual.trim() || 'Ficha enviada ao paciente para preenchimento pelo smartphone',
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

      const [urlPreencher, urlAssinar] = await Promise.all([
        generateSignatureLink(savedAnamnese.id, 'preencher'),
        generateSignatureLink(savedAnamnese.id, 'assinar'),
      ]);

      setLinkPreencher(urlPreencher);
      setLinkAssinar(urlAssinar);
      setStep('link');
      toast.success('Link para o paciente preencher gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar link de preenchimento:', error);
      toast.error('Erro ao gerar link para o paciente.');
    } finally {
      setSalvando(false);
    }
  };

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
      setSalvando(true);
      const patient = pacientes.find(p => p.id === selectedPatient);
      const anamneseData = {
        pacienteId: selectedPatient,
        pacienteNome: patient?.nome,
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

      const [urlPreencher, urlAssinar] = await Promise.all([
        generateSignatureLink(savedAnamnese.id, 'preencher'),
        generateSignatureLink(savedAnamnese.id, 'assinar'),
      ]);

      setLinkPreencher(urlPreencher);
      setLinkAssinar(urlAssinar);
      setStep('link');
      toast.success('Anamnese registrada! Os links para envio ou assinatura estão prontos.');
    } catch (error) {
      console.error('Erro ao salvar anamnese:', error);
      toast.error('Erro ao salvar anamnese. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const handleEnviarWhatsApp = (tipo: 'preencher' | 'assinar') => {
    const link = tipo === 'preencher' ? linkPreencher : linkAssinar;
    if (!link) {
      toast.error('Link ainda não gerado.');
      return;
    }
    const patient = pacientes.find(p => p.id === selectedPatient);
    const mensagem = tipo === 'preencher'
      ? `Olá, *${patient?.nome || 'Paciente'}*!\n\n` +
        `Para agilizar o seu atendimento na clínica Dra. Rosangela Santos e garantir a sua máxima segurança clínica, por favor acesse o link exclusivo abaixo para preencher suas informações de saúde e realizar a sua *Assinatura Digital*:\n\n` +
        `👉 ${link}\n\n` +
        `O preenchimento é rápido e pode ser feito diretamente pelo celular. Fica registrado com segurança em seu prontuário odontológico. Qualquer dúvida, estamos à disposição!`
      : `Olá, *${patient?.nome || 'Paciente'}*!\n\n` +
        `A sua *Ficha de Anamnese* da clínica Dra. Rosangela Santos já foi elaborada. Por favor, acesse o link exclusivo abaixo para conferir o resumo e realizar a sua *Assinatura Digital*:\n\n` +
        `👉 ${link}\n\n` +
        `A assinatura é feita diretamente pelo celular com o dedo na tela, com validade legal. Qualquer dúvida, estamos à disposição!`;

    if (!patient?.telefone || !openWhatsApp(patient.telefone, mensagem)) {
      navigator.clipboard.writeText(link);
      toast.info('Paciente sem telefone cadastrado. O link foi copiado para a área de transferência!');
    } else {
      toast.success(`Abrindo WhatsApp com link de ${tipo === 'preencher' ? 'preenchimento' : 'assinatura'}...`);
    }
  };

  const copyToClipboard = async (tipo: 'preencher' | 'assinar') => {
    const link = tipo === 'preencher' ? linkPreencher : linkAssinar;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      if (tipo === 'preencher') {
        setCopiadoPreencher(true);
        setTimeout(() => setCopiadoPreencher(false), 2500);
      } else {
        setCopiadoAssinar(true);
        setTimeout(() => setCopiadoAssinar(false), 2500);
      }
      toast.success(`Link para ${tipo === 'preencher' ? 'preencher e assinar' : 'apenas assinar'} copiado!`);
    } catch (error) {
      toast.error('Erro ao copiar link');
    }
  };

  const handleAbrirLink = (tipo: 'preencher' | 'assinar') => {
    const link = tipo === 'preencher' ? linkPreencher : linkAssinar;
    if (!link) return;
    window.open(link, '_blank', 'noopener,noreferrer');
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
      onSave?.({ id: anamneseId });
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
    setIsCopied(false);
  };

  const getCurrentPatient = () => {
    return pacientes.find(p => p.id === selectedPatient);
  };

  const getCurrentPatientName = () => {
    const patient = getCurrentPatient();
    return patient ? patient.nome : 'Paciente';
  };

  if (step === 'signature-patient') {
    const patient = getCurrentPatient();
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assinatura Presencial do Paciente</DialogTitle>
          </DialogHeader>
          <DigitalSignature
            title="Assinatura da Ficha de Anamnese"
            signerName={getCurrentPatientName()}
            signerRole="paciente"
            documentType="anamnese"
            initialEmail={patient?.email || ''}
            initialCpf={patient?.cpf || ''}
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
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assinatura do Dentista / Responsável</DialogTitle>
          </DialogHeader>
          <DigitalSignature
            title="Assinatura do Cirurgião-Dentista"
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
    const patient = getCurrentPatient();
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-500" />
              Anamnese Criada com Sucesso!
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Opção 1: Link para Preencher e Assinar (Recomendado) */}
            <Card className="border-2 border-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center justify-between">
                  <span className="flex items-center gap-2 text-foreground">
                    <Share2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    Link 1: Preencher e Assinar pelo Smartphone
                  </span>
                  <span className="text-xs font-normal text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded-full font-semibold">
                    Mais Prático
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  O paciente responde as perguntas de saúde no próprio celular e assina digitalmente.
                </p>

                <div className="p-2 bg-background rounded-md border text-xs font-mono break-all select-all flex items-center justify-between gap-2">
                  <span className="truncate text-foreground">{linkPreencher}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button
                    type="button"
                    onClick={() => handleEnviarWhatsApp('preencher')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 shadow-xs"
                  >
                    <MessageCircle className="h-4 w-4 mr-1.5" />
                    Enviar WhatsApp
                  </Button>

                  <Button
                    type="button"
                    onClick={() => copyToClipboard('preencher')}
                    variant="outline"
                    className="text-xs h-9"
                  >
                    {copiadoPreencher ? (
                      <>
                        <Check className="h-4 w-4 mr-1.5 text-emerald-600" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1.5" />
                        Copiar Link
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    onClick={() => handleAbrirLink('preencher')}
                    variant="outline"
                    className="text-xs h-9"
                  >
                    <ExternalLink className="h-4 w-4 mr-1.5" />
                    Abrir Link
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Opção 2: Link para Apenas Assinar */}
            <Card className="border border-border/80 bg-card shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center justify-between text-foreground">
                  <span className="flex items-center gap-2">
                    <FileSignature className="h-4 w-4 text-primary" />
                    Link 2: Apenas Assinar (com resumo já preenchido)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Envia a ficha com as respostas que você digitou na clínica, solicitando apenas a conferência e assinatura do paciente.
                </p>

                <div className="p-2 bg-background rounded-md border text-xs font-mono break-all select-all flex items-center justify-between gap-2">
                  <span className="truncate text-foreground">{linkAssinar}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button
                    type="button"
                    onClick={() => handleEnviarWhatsApp('assinar')}
                    variant="outline"
                    className="text-xs h-9 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
                  >
                    <MessageCircle className="h-4 w-4 mr-1.5 text-emerald-600" />
                    Enviar WhatsApp
                  </Button>

                  <Button
                    type="button"
                    onClick={() => copyToClipboard('assinar')}
                    variant="outline"
                    className="text-xs h-9"
                  >
                    {copiadoAssinar ? (
                      <>
                        <Check className="h-4 w-4 mr-1.5 text-emerald-600" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1.5" />
                        Copiar Link
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    onClick={() => handleAbrirLink('assinar')}
                    variant="outline"
                    className="text-xs h-9"
                  >
                    <ExternalLink className="h-4 w-4 mr-1.5" />
                    Abrir Link
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Opção 3: Assinatura Presencial */}
            <Card className="border border-border/80 bg-card shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <FileSignature className="h-4 w-4 text-primary" />
                  Ou coletar Assinatura Presencial agora no consultório
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Se o paciente estiver presente no consultório, você pode coletar a assinatura diretamente neste dispositivo.
                </p>
                <Button onClick={handleDirectSignature} className="w-full" variant="outline" size="sm">
                  <FileSignature className="h-4 w-4 mr-1.5 text-primary" />
                  Iniciar Assinatura Presencial na Tela
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button
              variant="default"
              onClick={() => {
                onSave?.({ id: anamneseId });
                resetForm();
                onClose();
              }}
            >
              Concluir
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
          <DialogTitle>Nova Anamnese Odontológica</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!preSelectedPatient && (
            <PatientSelector value={selectedPatient} onChange={setSelectedPatient} />
          )}

          <div>
            <Label htmlFor="queixa" className="text-xs font-semibold">Queixa Principal *</Label>
            <Textarea
              id="queixa"
              placeholder="Descreva a queixa principal do paciente..."
              value={queixaPrincipal}
              onChange={(e) => setQueixaPrincipal(e.target.value)}
              className="mt-1"
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="historia-atual" className="text-xs font-semibold">História Atual</Label>
            <Textarea
              id="historia-atual"
              placeholder="Descreva a história atual da queixa ou motivo do tratamento..."
              value={historiaAtual}
              onChange={(e) => setHistoriaAtual(e.target.value)}
              className="mt-1"
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="historia-familiar" className="text-xs font-semibold">História Familiar</Label>
            <Textarea
              id="historia-familiar"
              placeholder="Descreva histórico familiar relevante (diabetes, cardiopatias, etc.)..."
              value={historiaFamiliar}
              onChange={(e) => setHistoriaFamiliar(e.target.value)}
              className="mt-1"
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="historia-medica" className="text-xs font-semibold">História Médica Pregressa</Label>
            <Textarea
              id="historia-medica"
              placeholder="Doenças crônicas, cirurgias anteriores, internações..."
              value={historiaMedica}
              onChange={(e) => setHistoriaMedica(e.target.value)}
              className="mt-1"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="alergias" className="text-xs font-semibold">Alergias Conhecidas</Label>
              <Textarea
                id="alergias"
                placeholder="Alergias a medicamentos (penicilina, dipirona), látex, etc..."
                value={alergias}
                onChange={(e) => setAlergias(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="medicamentos" className="text-xs font-semibold">Medicamentos em Uso Contínuo</Label>
              <Textarea
                id="medicamentos"
                placeholder="Anti-hipertensivos, anticoagulantes, insulina, etc..."
                value={medicamentos}
                onChange={(e) => setMedicamentos(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="habitos-positivos" className="text-xs font-semibold">Hábitos e Higiene Bucal</Label>
              <Textarea
                id="habitos-positivos"
                placeholder="Frequência de escovação, uso de fio dental..."
                value={habitosViciosPositivos}
                onChange={(e) => setHabitosViciosPositivos(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="habitos-negativos" className="text-xs font-semibold">Vícios / Hábitos Nocivos</Label>
              <Textarea
                id="habitos-negativos"
                placeholder="Tabagismo, etilismo, bruxismo, roer unhas..."
                value={habitosViciosNegativos}
                onChange={(e) => setHabitosViciosNegativos(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="observacoes" className="text-xs font-semibold">Observações Gerais</Label>
            <Textarea
              id="observacoes"
              placeholder="Outras observações importantes para o atendimento..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="mt-1"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={handleSaveForm} disabled={salvando} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
              {salvando ? 'Salvando...' : 'Salvar e Gerar Link de Assinatura'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AnamneseModal;
