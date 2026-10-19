import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
import { gerarLinkAmigavelAnamnese } from '@/utils/anamneseEngine';

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
      const token = Math.random().toString(36).substring(2, 12);

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
        tokenAssinatura: token,
        statusAssinatura: 'pendente' as const
      };

      const savedAnamnese = await addAnamnese(anamneseData);
      const targetId = savedAnamnese?.id || 'anm_' + Date.now();
      setAnamneseId(targetId);

      const urlPreencher = gerarLinkAmigavelAnamnese({
        anamneseId: targetId,
        paciente: {
          id: patient?.id || selectedPatient,
          nome: patient?.nome || 'Paciente',
          telefone: patient?.telefone,
          cpf: patient?.cpf,
        },
        modo: 'preencher',
        token,
      });

      const urlAssinar = gerarLinkAmigavelAnamnese({
        anamneseId: targetId,
        paciente: {
          id: patient?.id || selectedPatient,
          nome: patient?.nome || 'Paciente',
          telefone: patient?.telefone,
          cpf: patient?.cpf,
        },
        modo: 'assinar',
        token,
      });

      setLinkPreencher(urlPreencher);
      setLinkAssinar(urlAssinar);
      setStep('link');
      toast.success('Link para o paciente preencher gerado com sucesso!');

      generateSignatureLink(targetId, 'preencher', patient, savedAnamnese).catch(() => {});
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
      const token = Math.random().toString(36).substring(2, 12);

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
        tokenAssinatura: token,
        statusAssinatura: 'pendente' as const
      };

      let savedAnamnese: any = null;
      let targetId = 'anm_' + Date.now();
      try {
        savedAnamnese = await addAnamnese(anamneseData);
        if (savedAnamnese?.id) {
          targetId = savedAnamnese.id;
        }
      } catch (addErr) {
        console.warn('Fallback ao registrar anamnese no contexto:', addErr);
        try {
          const localAnams = JSON.parse(localStorage.getItem('dental-system-anamneses') || '[]');
          const newLocal = { ...anamneseData, id: targetId, criadoEm: new Date(), atualizadoEm: new Date() };
          localAnams.push(newLocal);
          localStorage.setItem('dental-system-anamneses', JSON.stringify(localAnams));
          savedAnamnese = newLocal;
        } catch (_) {}
      }
      setAnamneseId(targetId);

      // Gera os links de forma síncrona e instantânea garantindo exibição imediata
      const urlPreencher = gerarLinkAmigavelAnamnese({
        anamneseId: targetId,
        paciente: {
          id: patient?.id || selectedPatient,
          nome: patient?.nome || 'Paciente',
          telefone: patient?.telefone,
          cpf: patient?.cpf,
        },
        modo: 'preencher',
        token,
      });

      const urlAssinar = gerarLinkAmigavelAnamnese({
        anamneseId: targetId,
        paciente: {
          id: patient?.id || selectedPatient,
          nome: patient?.nome || 'Paciente',
          telefone: patient?.telefone,
          cpf: patient?.cpf,
        },
        modo: 'assinar',
        token,
        dadosExistentes: {
          queixaPrincipal: queixaPrincipal.trim(),
          historiaAtual: historiaAtual.trim(),
          historiaMedica: historiaMedica.trim(),
          alergias: alergias.trim(),
          medicamentos: medicamentos.trim(),
          habitos: [habitosViciosPositivos, habitosViciosNegativos].filter(Boolean).join(', '),
          observacoes: observacoes.trim(),
        }
      });

      setLinkPreencher(urlPreencher);
      setLinkAssinar(urlAssinar);
      setStep('link');
      toast.success('Anamnese registrada! Os links para envio ou assinatura estão prontos.');

      generateSignatureLink(targetId, 'preencher', patient, savedAnamnese).catch(() => {});
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
        <DialogContent className="max-w-lg w-[calc(100vw-2rem)] sm:w-full max-h-[92vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Sparkles className="h-5 w-5 text-emerald-500 shrink-0" />
              Anamnese Criada com Sucesso!
            </DialogTitle>
            {patient?.nome && (
              <DialogDescription className="text-xs text-muted-foreground">
                Paciente: <strong className="text-foreground">{patient.nome}</strong>
              </DialogDescription>
            )}
          </DialogHeader>
          
          <div className="space-y-3.5 pt-1">
            {/* Opção 1: Link para Preencher e Assinar (Recomendado) */}
            <Card className="border-2 border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-xs">
              <CardHeader className="pb-2 pt-3.5 px-4">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span className="flex items-center gap-2 text-foreground">
                    <Share2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    Enviar Link para o Paciente no Celular
                  </span>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full font-semibold">
                    Recomendado
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  O paciente responde as perguntas de saúde no próprio celular e assina digitalmente com validade jurídica.
                </p>

                {patient?.telefone && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 bg-background/70 p-2 rounded-md border border-border/60">
                    <span>📱 WhatsApp:</span>
                    <strong className="text-foreground">{patient.telefone}</strong>
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
                  <Button
                    type="button"
                    onClick={() => handleEnviarWhatsApp('preencher')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 shadow-xs gap-1.5"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Enviar WhatsApp
                  </Button>

                  <Button
                    type="button"
                    onClick={() => copyToClipboard('preencher')}
                    variant="outline"
                    className="text-xs h-10 font-medium gap-1.5 border-border hover:bg-accent"
                  >
                    {copiadoPreencher ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-600" />
                        <span className="text-emerald-600 font-semibold">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>Copiar Link</span>
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Opção 2: Link para Apenas Assinar */}
            <Card className="border border-border/80 bg-card shadow-xs">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs font-semibold flex items-center justify-between text-foreground">
                  <span className="flex items-center gap-2">
                    <FileSignature className="h-3.5 w-3.5 text-primary shrink-0" />
                    Ou enviar Apenas para Assinar (com resumo já preenchido)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 px-4 pb-3.5">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Envia a ficha já com as respostas preenchidas na clínica, solicitando apenas a conferência e assinatura.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    type="button"
                    onClick={() => handleEnviarWhatsApp('assinar')}
                    variant="outline"
                    size="sm"
                    className="text-xs h-8.5 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 gap-1.5 font-medium"
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                    WhatsApp (Só Assinar)
                  </Button>

                  <Button
                    type="button"
                    onClick={() => copyToClipboard('assinar')}
                    variant="outline"
                    size="sm"
                    className="text-xs h-8.5 gap-1.5"
                  >
                    {copiadoAssinar ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-600 font-semibold">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copiar Link</span>
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Opção 3: Assinatura Presencial */}
            <Card className="border border-border/80 bg-card shadow-xs">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs font-semibold flex items-center gap-2 text-foreground">
                  <FileSignature className="h-3.5 w-3.5 text-primary shrink-0" />
                  Ou coletar Assinatura Presencial agora no consultório
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-3.5">
                <p className="text-[11px] text-muted-foreground">
                  Se o paciente estiver presente no consultório, você pode coletar a assinatura diretamente neste dispositivo.
                </p>
                <Button onClick={handleDirectSignature} className="w-full h-8.5 text-xs font-medium" variant="outline">
                  <FileSignature className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  Iniciar Assinatura Presencial na Tela
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                onSave?.({ id: anamneseId });
                resetForm();
                onClose();
              }}
              className="text-xs h-9 px-4 font-bold"
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
      <DialogContent className="max-w-4xl w-[calc(100vw-2rem)] sm:w-full max-h-[92vh] overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y p-3.5 sm:p-6">
        <DialogHeader>
          <DialogTitle>Nova Anamnese Odontológica</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!preSelectedPatient && (
            <PatientSelector value={selectedPatient} onChange={setSelectedPatient} />
          )}

          {/* Atalho Prático: Enviar Link Direto para o Paciente */}
          {selectedPatient && (
            <div className="p-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4 text-indigo-600" />
                  Prefere que o próprio paciente responda tudo no celular?
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Gere o link imediato para o paciente preencher o questionário pelo WhatsApp.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleEnviarLinkDiretoParaPaciente}
                disabled={salvando}
                className="border-indigo-300 text-indigo-700 bg-white hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:bg-indigo-900/60 font-semibold text-xs h-8 shrink-0 gap-1.5 shadow-xs"
              >
                <Send className="h-3.5 w-3.5 text-indigo-600" />
                <span>Gerar Link de Preenchimento</span>
              </Button>
            </div>
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
