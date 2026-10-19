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
      <DialogContent className="max-w-[95vw] sm:max-w-[620px] w-full p-4 sm:p-5 gap-3 max-h-[94vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader className="pb-0.5 space-y-1">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2 text-primary">
              <ClipboardList className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <DialogTitle className="text-base sm:text-lg font-bold">
                Enviar Ficha de Anamnese por Link
              </DialogTitle>
            </div>
            {isAssinada ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 font-semibold text-[10px]">
                <CheckCircle2 className="h-3 w-3" />
                Assinada
              </Badge>
            ) : (
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 font-semibold text-[10px]">
                <Clock className="h-3 w-3" />
                Pendente
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <span>Paciente: <strong className="text-foreground font-semibold">{patient?.nome}</strong></span>
            {patient?.telefone && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium text-[11px] border border-emerald-500/20">
                📱 {patient.telefone}
              </span>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center space-y-2">
            <Loader2 className="h-7 w-7 animate-spin text-primary mx-auto" />
            <p className="text-xs text-muted-foreground">Gerando links individuais para o paciente...</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* Opções 1 e 2 em Grid Lado a Lado no Desktop/Tablet */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Opção 1: Enviar para Preencher e Assinar */}
              <div className="rounded-xl border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-50/40 to-white dark:from-indigo-950/20 dark:to-card p-3 space-y-2 flex flex-col justify-between shadow-xs">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                      <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span>Preencher e Assinar</span>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.2 rounded font-mono">
                      COMPLETO
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    O paciente preenche as respostas de saúde pelo celular e assina digitalmente.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <Button
                    size="sm"
                    onClick={handleWhatsAppPreencher}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8.5 gap-1 font-semibold shadow-xs px-1.5 cursor-pointer"
                  >
                    <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">WhatsApp</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopiar('preencher')}
                    className="text-xs h-8.5 gap-1 px-1.5 cursor-pointer"
                  >
                    {copiadoPreencher ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="text-emerald-600 font-semibold truncate">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">Copiar</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Opção 2: Enviar Apenas para Assinar */}
              <div className="rounded-xl border border-border/80 bg-card p-3 space-y-2 flex flex-col justify-between hover:border-border transition-colors shadow-xs">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                      <FileSignature className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span>Apenas Assinar</span>
                    </div>
                    <span className="text-[10px] font-bold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/60 px-1.5 py-0.2 rounded font-mono">
                      RESUMO
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Ficha já preenchida na clínica; o paciente apenas confere e assina na tela.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <Button
                    size="sm"
                    onClick={handleWhatsAppAssinar}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8.5 gap-1 font-semibold shadow-xs px-1.5 cursor-pointer"
                  >
                    <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">WhatsApp</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopiar('assinar')}
                    className="text-xs h-8.5 gap-1 px-1.5 cursor-pointer"
                  >
                    {copiadoAssinar ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="text-emerald-600 font-semibold truncate">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">Copiar</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Opção 3: Preencher na Clínica Agora */}
            {onOpenClinicaModal && (
              <div className="p-2.5 rounded-lg border border-border/70 bg-muted/30 flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
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
                  className="text-xs h-7.5 gap-1.5 font-medium shrink-0 cursor-pointer"
                >
                  <PenTool className="h-3 w-3 text-primary" />
                  <span>Preencher na Clínica</span>
                </Button>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="pt-2 border-t border-border/60">
          <Button variant="outline" size="sm" onClick={onClose} className="w-full sm:w-auto text-xs h-8 cursor-pointer">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
