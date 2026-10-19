import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ClipboardList,
  MessageCircle,
  Copy,
  Check,
  ExternalLink,
  FileSignature,
  FileText,
  Clock,
  CheckCircle2,
  Loader2,
  PenTool,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { openWhatsApp } from '@/lib/whatsapp';
import { gerarLinkAmigavelAnamnese } from '@/utils/anamneseEngine';

interface ModalEnviarAnamneseProps {
  patient: any;
  isOpen: boolean;
  onClose: () => void;
  onOpenClinicaModal?: () => void;
}

export const ModalEnviarAnamnese = ({
  patient,
  isOpen,
  onClose,
  onOpenClinicaModal,
}: ModalEnviarAnamneseProps) => {
  const { anamneses, addAnamnese, generateSignatureLink } = useDentalSystem();

  const [loading, setLoading] = useState(false);
  const [anamneseAtiva, setAnamneseAtiva] = useState<any>(null);
  const [linkPreencher, setLinkPreencher] = useState('');
  const [linkAssinar, setLinkAssinar] = useState('');
  const [copiadoPreencher, setCopiadoPreencher] = useState(false);
  const [copiadoAssinar, setCopiadoAssinar] = useState(false);

  useEffect(() => {
    if (!isOpen || !patient?.id) {
      setLoading(false);
      return;
    }

    let cancelado = false;

    const inicializarLinks = async () => {
      setLoading(true);
      try {
        const pacienteAnams = (anamneses || []).filter(
          (a) => a.pacienteId === patient.id
        );

        let targetAnamnese = pacienteAnams.sort(
          (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
        )[0];

        // Se ainda não existir nenhuma anamnese para este paciente, cria automaticamente uma ficha inicial
        if (!targetAnamnese) {
          targetAnamnese = await addAnamnese({
            pacienteId: patient.id,
            pacienteNome: patient.nome,
            data: new Date(),
            queixaPrincipal: 'Avaliação Odontológica Inicial',
            historiaAtual: 'Ficha enviada ao paciente para preenchimento e assinatura digital',
            statusAssinatura: 'pendente',
          });
        }

        if (cancelado) return;
        setAnamneseAtiva(targetAnamnese);

        // Gera ambos os links imediatamente de forma síncrona
        const token = targetAnamnese.tokenAssinatura || Math.random().toString(36).substring(2, 12);
        const urlPreencher = gerarLinkAmigavelAnamnese({
          anamneseId: targetAnamnese.id,
          paciente: {
            id: patient.id,
            nome: patient.nome,
            telefone: patient.telefone,
            cpf: patient.cpf,
          },
          modo: 'preencher',
          token,
          dadosExistentes: {
            queixaPrincipal: targetAnamnese.queixaPrincipal,
            historiaAtual: targetAnamnese.historiaAtual,
            historiaMedica: targetAnamnese.historiaMedica,
            alergias: targetAnamnese.alergias,
            medicamentos: targetAnamnese.medicamentos,
            habitos: targetAnamnese.habitos,
            observacoes: targetAnamnese.observacoes,
          },
        });

        const urlAssinar = gerarLinkAmigavelAnamnese({
          anamneseId: targetAnamnese.id,
          paciente: {
            id: patient.id,
            nome: patient.nome,
            telefone: patient.telefone,
            cpf: patient.cpf,
          },
          modo: 'assinar',
          token,
          dadosExistentes: {
            queixaPrincipal: targetAnamnese.queixaPrincipal,
            historiaAtual: targetAnamnese.historiaAtual,
            historiaMedica: targetAnamnese.historiaMedica,
            alergias: targetAnamnese.alergias,
            medicamentos: targetAnamnese.medicamentos,
            habitos: targetAnamnese.habitos,
            observacoes: targetAnamnese.observacoes,
          },
        });

        if (cancelado) return;
        setLinkPreencher(urlPreencher);
        setLinkAssinar(urlAssinar);
        setLoading(false);

        // Sincroniza em background sem travar a interface
        generateSignatureLink(targetAnamnese.id, 'preencher').catch(() => {});
      } catch (err: any) {
        console.error('Erro ao preparar links da anamnese:', err);
        toast.error('Erro ao gerar links: ' + (err?.message || 'Tente novamente'));
        if (!cancelado) setLoading(false);
      }
    };

    inicializarLinks();

    return () => {
      cancelado = true;
    };
  }, [isOpen, patient?.id]);

  const isAssinada = Boolean(
    anamneseAtiva?.assinaturaPaciente ||
      anamneseAtiva?.statusAssinatura === 'completo' ||
      anamneseAtiva?.statusAssinatura === 'paciente_assinado'
  );

  const handleCopiar = async (tipo: 'preencher' | 'assinar') => {
    const link = tipo === 'preencher' ? linkPreencher : linkAssinar;
    if (!link) {
      toast.error('Link ainda não disponível');
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      if (tipo === 'preencher') {
        setCopiadoPreencher(true);
        setTimeout(() => setCopiadoPreencher(false), 2500);
      } else {
        setCopiadoAssinar(true);
        setTimeout(() => setCopiadoAssinar(false), 2500);
      }
      toast.success(
        `Link para ${tipo === 'preencher' ? 'preencher e assinar' : 'apenas assinar'} copiado!`
      );
    } catch {
      toast.error('Erro ao copiar link');
    }
  };

  const handleAbrir = (tipo: 'preencher' | 'assinar') => {
    const link = tipo === 'preencher' ? linkPreencher : linkAssinar;
    if (!link) return;
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  const handleWhatsAppPreencher = () => {
    if (!linkPreencher) {
      toast.error('Link não gerado.');
      return;
    }

    const mensagem =
      `Olá, *${patient.nome}*!\n\n` +
      `Para agilizar o seu atendimento na clínica Dra. Rosangela Santos e garantir a sua máxima segurança clínica, por favor acesse o link exclusivo abaixo para preencher suas informações de saúde e realizar a sua *Assinatura Digital*:\n\n` +
      `👉 ${linkPreencher}\n\n` +
      `O preenchimento é rápido e pode ser feito diretamente pelo celular. Fica registrado com segurança em seu prontuário odontológico. Qualquer dúvida, estamos à disposição!`;

    if (!patient.telefone || !openWhatsApp(patient.telefone, mensagem)) {
      navigator.clipboard.writeText(linkPreencher);
      toast.info('Paciente sem telefone cadastrado. O link foi copiado para a área de transferência!');
    } else {
      toast.success('Abrindo WhatsApp com link para preenchimento...');
    }
  };

  const handleWhatsAppAssinar = () => {
    if (!linkAssinar) {
      toast.error('Link não gerado.');
      return;
    }

    const mensagem =
      `Olá, *${patient.nome}*!\n\n` +
      `A sua *Ficha de Anamnese* da clínica Dra. Rosangela Santos já foi elaborada. Por favor, acesse o link exclusivo abaixo para conferir o resumo e realizar a sua *Assinatura Digital*:\n\n` +
      `👉 ${linkAssinar}\n\n` +
      `A assinatura é feita diretamente pelo celular com o dedo na tela, com validade legal. Qualquer dúvida, estamos à disposição!`;

    if (!patient.telefone || !openWhatsApp(patient.telefone, mensagem)) {
      navigator.clipboard.writeText(linkAssinar);
      toast.info('Paciente sem telefone cadastrado. O link foi copiado para a área de transferência!');
    } else {
      toast.success('Abrindo WhatsApp com link apenas para assinatura...');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl w-[calc(100vw-2rem)] sm:w-full max-h-[92vh] overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y p-4 sm:p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <ClipboardList className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <DialogTitle className="text-lg sm:text-xl font-bold">
              Enviar Ficha de Anamnese por Link
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs sm:text-sm">
            Paciente: <strong className="text-foreground">{patient?.nome}</strong>
            {patient?.telefone && ` • Tel: ${patient.telefone}`}
          </DialogDescription>
        </DialogHeader>

        {/* Status da Anamnese */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border text-xs">
          <span className="text-muted-foreground font-medium">Status Atual do Documento:</span>
          {isAssinada ? (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 font-semibold text-[11px]">
              <CheckCircle2 className="h-3 w-3" />
              Assinada Digitalmente
            </Badge>
          ) : (
            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 font-semibold text-[11px]">
              <Clock className="h-3 w-3" />
              Aguardando Preenchimento / Assinatura
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="py-8 text-center space-y-2">
            <Loader2 className="h-7 w-7 animate-spin text-primary mx-auto" />
            <p className="text-xs text-muted-foreground">Gerando links individuais para o paciente...</p>
          </div>
        ) : (
          <div className="space-y-3.5 py-1">
            {/* Opção 1: Enviar para Preencher e Assinar */}
            <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/60 to-white dark:from-indigo-950/20 dark:to-card space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded bg-indigo-600 text-white font-bold text-[10px]">
                      OPÇÃO 1
                    </span>
                    <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      Enviar para o Paciente Preencher e Assinar
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                    O paciente recebe o link no próprio celular, responde as perguntas de saúde (alergias, medicamentos, queixa, histórico) e assina com o dedo no final.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleWhatsAppPreencher}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 gap-1.5 font-semibold shadow-xs"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>Enviar WhatsApp</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopiar('preencher')}
                  className="text-xs h-9 gap-1.5"
                >
                  {copiadoPreencher ? (
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
            </div>

            {/* Opção 2: Enviar Apenas para Assinar */}
            <div className="p-3.5 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-gradient-to-br from-sky-50/60 to-white dark:from-sky-950/20 dark:to-card space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded bg-sky-600 text-white font-bold text-[10px]">
                      OPÇÃO 2
                    </span>
                    <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                      <FileSignature className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                      Enviar Apenas para o Paciente Assinar
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                    A clínica já possui os dados e o paciente só precisa visualizar o resumo clínico e assinar digitalmente com o dedo na tela pelo celular.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleWhatsAppAssinar}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 gap-1.5 font-semibold shadow-xs"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>Enviar WhatsApp</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopiar('assinar')}
                  className="text-xs h-9 gap-1.5"
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
            </div>

            {/* Opção 3: Preencher na Clínica Agora */}
            {onOpenClinicaModal && (
              <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Deseja preencher ou editar agora no consultório?
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onOpenClinicaModal();
                  }}
                  className="text-xs h-8 gap-1.5 font-medium"
                >
                  <PenTool className="h-3.5 w-3.5 text-primary" />
                  <span>Preencher na Clínica</span>
                </Button>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="pt-2 border-t border-border/60">
          <Button variant="outline" size="sm" onClick={onClose} className="w-full sm:w-auto text-xs">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
