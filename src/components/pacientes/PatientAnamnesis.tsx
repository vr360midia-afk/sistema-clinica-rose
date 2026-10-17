import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Calendar,
  ClipboardList,
  Copy,
  Check,
  Link2,
  MessageCircle,
  CheckCircle2,
  Clock,
  Trash2,
  ExternalLink,
  FileCheck,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDentalSystem } from '@/context/DentalSystemContext';
import AnamneseModal from '@/components/anamnese/AnamneseModal';
import { ModalEnviarAnamnese } from '@/components/anamnese/ModalEnviarAnamnese';
import { openWhatsApp } from '@/lib/whatsapp';

interface PatientAnamnesisProps {
  patient: any;
}

const PatientAnamnesis = ({ patient }: PatientAnamnesisProps) => {
  const { anamneses, addAnamnese, generateSignatureLink, deleteAnamnese } = useDentalSystem();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEnviarModalOpen, setIsEnviarModalOpen] = useState(false);
  const [copiandoId, setCopiandoId] = useState<string | null>(null);
  const [gerandoLink, setGerandoLink] = useState(false);

  const patientAnamnesis = (anamneses || []).filter((a) => a.pacienteId === patient.id);

  const handleNewAnamnesis = () => {
    setIsModalOpen(true);
  };

  const handleSaveAnamnesis = () => {
    setIsModalOpen(false);
  };

  // Obtém o link existente ou gera um novo token seguro vinculado à anamnese
  const obterOuGerarLink = async (targetId?: string): Promise<string> => {
    let id = targetId;

    if (!id) {
      if (patientAnamnesis.length > 0) {
        id = patientAnamnesis[0].id;
      } else {
        // Se ainda não houver anamnese criada, cria automaticamente uma ficha inicial para o paciente responder
        const nova = await addAnamnese({
          pacienteId: patient.id,
          pacienteNome: patient.nome,
          data: new Date(),
          queixaPrincipal: 'Avaliação Inicial e Questionário de Saúde',
          historiaAtual: 'Aguardando preenchimento pelo paciente via link digital',
          statusAssinatura: 'pendente' as const,
        });
        id = nova?.id;
      }
    }

    if (!id) {
      throw new Error('Não foi possível identificar a anamnese');
    }

    const link = await generateSignatureLink(id);
    return link;
  };

  // Copia o link da anamnese para a área de transferência
  const handleCopiarLink = async (targetId?: string) => {
    try {
      setGerandoLink(true);
      const link = await obterOuGerarLink(targetId);
      if (!link) {
        toast.error('Não foi possível gerar o link da anamnese.');
        return;
      }

      await navigator.clipboard.writeText(link);
      setCopiandoId(targetId || 'geral');
      toast.success('Link da anamnese copiado para a área de transferência!');
      setTimeout(() => setCopiandoId(null), 3000);
    } catch (err: any) {
      console.error('Erro ao copiar link da anamnese:', err);
      toast.error('Erro ao gerar/copiar link da anamnese: ' + (err?.message || 'Tente novamente'));
    } finally {
      setGerandoLink(false);
    }
  };

  // Envia o link da anamnese diretamente pelo WhatsApp do paciente
  const handleEnviarWhatsApp = async (targetId?: string) => {
    try {
      setGerandoLink(true);
      const link = await obterOuGerarLink(targetId);
      if (!link) {
        toast.error('Não foi possível gerar o link da anamnese.');
        return;
      }

      const mensagem =
        `Olá, *${patient.nome}*!\n\n` +
        `Para agilizar o seu atendimento e garantir a sua máxima segurança clínica, por favor acesse o link abaixo para preencher e assinar digitalmente a sua *Ficha de Anamnese*:\n\n` +
        `👉 ${link}\n\n` +
        `O preenchimento leva menos de 2 minutos pelo seu celular e fica registrado de forma segura no seu prontuário. Qualquer dúvida, estamos à disposição!`;

      if (!patient?.telefone || !openWhatsApp(patient.telefone, mensagem)) {
        await navigator.clipboard.writeText(link);
        toast.info('Paciente sem telefone válido cadastrado. O link foi copiado para a área de transferência!');
      } else {
        toast.success('Abrindo WhatsApp com o link da anamnese...');
      }
    } catch (err: any) {
      console.error('Erro ao enviar anamnese pelo WhatsApp:', err);
      toast.error('Erro ao gerar link para o WhatsApp: ' + (err?.message || 'Tente novamente'));
    } finally {
      setGerandoLink(false);
    }
  };

  // Abre o link em nova aba para conferência ou preenchimento na recepção
  const handleAbrirLink = async (targetId?: string) => {
    try {
      setGerandoLink(true);
      const link = await obterOuGerarLink(targetId);
      if (link) {
        window.open(link, '_blank');
      }
    } catch (err) {
      console.error('Erro ao abrir link da anamnese:', err);
      toast.error('Erro ao abrir link da anamnese');
    } finally {
      setGerandoLink(false);
    }
  };

  // Exclusão de ficha de anamnese
  const handleExcluir = async (anamneseId: string) => {
    if (confirm('Tem certeza de que deseja excluir esta ficha de anamnese?')) {
      try {
        await deleteAnamnese(anamneseId);
        toast.success('Anamnese excluída com sucesso.');
      } catch (err) {
        console.error('Erro ao excluir anamnese:', err);
        toast.error('Erro ao excluir anamnese.');
      }
    }
  };

  // Estado Vazio: quando o paciente ainda não possui nenhuma anamnese
  if (patientAnamnesis.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="border-dashed border-2 border-border/80 bg-muted/20">
          <CardContent className="pt-8 pb-8 text-center space-y-4 max-w-xl mx-auto">
            <div className="h-14 w-14 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-xs">
              <ClipboardList className="h-7 w-7" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-foreground">Nenhuma anamnese cadastrada</h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Você pode enviar um link prático para <strong>{patient.nome}</strong> responder e assinar pelo próprio celular, ou preencher manualmente agora na clínica.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <Button
                onClick={() => setIsEnviarModalOpen(true)}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs gap-1.5"
              >
                <Link2 className="h-4 w-4" />
                <span>Enviar Link ao Paciente (Opções)</span>
              </Button>

              <Button
                variant="outline"
                onClick={handleNewAnamnesis}
                className="w-full sm:w-auto gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>Preencher na Clínica</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <ModalEnviarAnamnese
          isOpen={isEnviarModalOpen}
          onClose={() => setIsEnviarModalOpen(false)}
          patient={patient}
          onOpenClinicaModal={handleNewAnamnesis}
        />

        <AnamneseModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveAnamnesis}
          preSelectedPatient={patient.id}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Barra de Ações Superior */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border border-border shadow-xs">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Anamneses do Paciente ({patientAnamnesis.length})
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Histórico médico, questionários de saúde e assinaturas digitais coletadas.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => setIsEnviarModalOpen(true)}
            className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1.5 shadow-xs"
            title="Enviar link individual ao paciente para preencher ou apenas assinar"
          >
            <Link2 className="h-3.5 w-3.5" />
            <span>Enviar Link ao Paciente</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleNewAnamnesis}
            className="text-xs h-8 font-semibold gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nova Anamnese</span>
          </Button>
        </div>
      </div>

      {/* Listagem de Anamneses */}
      <div className="grid gap-4">
        {patientAnamnesis.map((anamnese) => {
          const isAssinada = Boolean(
            anamnese.assinaturaPaciente ||
            anamnese.statusAssinatura === 'completo' ||
            anamnese.statusAssinatura === 'paciente_assinado'
          );

          return (
            <Card key={anamnese.id} className="hover:shadow-md transition-shadow border-border">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base font-bold text-foreground">
                        {anamnese.queixaPrincipal || 'Anamnese Odontológica'}
                      </CardTitle>

                      {isAssinada ? (
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 font-semibold gap-1 text-[11px]">
                          <CheckCircle2 className="h-3 w-3" />
                          Assinada pelo Paciente
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 font-medium gap-1 text-[11px]"
                        >
                          <Clock className="h-3 w-3" />
                          Aguardando Assinatura
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{new Date(anamnese.data).toLocaleDateString('pt-BR')}</span>
                      {anamnese.dataAssinatura && (
                        <span>
                          • Assinado em {new Date(anamnese.dataAssinatura).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ações da Ficha */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEnviarModalOpen(true)}
                      className="h-8 text-xs font-semibold border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300 gap-1.5"
                      title="Opções de envio por link (Preencher e Assinar ou Apenas Assinar)"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      <span>Enviar Link</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEnviarWhatsApp(anamnese.id)}
                      disabled={gerandoLink}
                      className="h-8 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 font-medium"
                      title="Enviar link diretamente para o WhatsApp do paciente"
                    >
                      <MessageCircle className="h-3.5 w-3.5 mr-1" />
                      WhatsApp
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAbrirLink(anamnese.id)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      title="Abrir página pública da anamnese"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleExcluir(anamnese.id)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                      title="Excluir anamnese"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-3 text-xs sm:text-sm">
                {anamnese.historiaAtual && (
                  <div>
                    <span className="font-semibold text-foreground block">História Atual:</span>
                    <p className="text-muted-foreground mt-0.5">{anamnese.historiaAtual}</p>
                  </div>
                )}

                {anamnese.historiaMedica && (
                  <div>
                    <span className="font-semibold text-foreground block">História Médica:</span>
                    <p className="text-muted-foreground mt-0.5">{anamnese.historiaMedica}</p>
                  </div>
                )}

                {anamnese.alergias && (
                  <div>
                    <span className="font-semibold text-amber-700 dark:text-amber-400 block">
                      Alergias Relatadas:
                    </span>
                    <p className="text-foreground font-medium mt-0.5 bg-amber-50/70 dark:bg-amber-950/30 p-2 rounded border border-amber-200 dark:border-amber-900/40">
                      {anamnese.alergias}
                    </p>
                  </div>
                )}

                {anamnese.medicamentos && (
                  <div>
                    <span className="font-semibold text-foreground block">Medicamentos em Uso:</span>
                    <p className="text-muted-foreground mt-0.5">{anamnese.medicamentos}</p>
                  </div>
                )}

                {anamnese.historiaFamiliar && (
                  <div>
                    <span className="font-semibold text-foreground block">História Familiar:</span>
                    <p className="text-muted-foreground mt-0.5">{anamnese.historiaFamiliar}</p>
                  </div>
                )}

                {(anamnese.habitosViciosPositivos || anamnese.habitosViciosNegativos) && (
                  <div>
                    <span className="font-semibold text-foreground block">Hábitos e Vícios:</span>
                    <p className="text-muted-foreground mt-0.5">
                      {[anamnese.habitosViciosPositivos, anamnese.habitosViciosNegativos].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                )}

                {anamnese.observacoes && (
                  <div>
                    <span className="font-semibold text-foreground block">Observações:</span>
                    <p className="text-muted-foreground mt-0.5">{anamnese.observacoes}</p>
                  </div>
                )}

                {anamnese.assinaturaPaciente?.signerName && (
                  <div className="pt-2 border-t border-border flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                    <FileCheck className="h-4 w-4" />
                    <span>
                      Assinatura confirmada por {anamnese.assinaturaPaciente.signerName}
                      {anamnese.assinaturaPaciente.timestamp && (
                        <> em {new Date(anamnese.assinaturaPaciente.timestamp).toLocaleString('pt-BR')}</>
                      )}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ModalEnviarAnamnese
        isOpen={isEnviarModalOpen}
        onClose={() => setIsEnviarModalOpen(false)}
        patient={patient}
        onOpenClinicaModal={handleNewAnamnesis}
      />

      <AnamneseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveAnamnesis}
        preSelectedPatient={patient.id}
      />
    </div>
  );
};

export default PatientAnamnesis;
