import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FileText,
  Download,
  Printer,
  PenTool,
  CheckCircle2,
  AlertTriangle,
  History,
  MessageCircle,
  Calendar,
  DollarSign,
  ShieldCheck,
  User,
  Loader2,
  Eye,
  Link as LinkIcon,
  ExternalLink,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Pencil,
  RotateCcw,
  Save,
  Building2,
  CreditCard,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { useOrcamentos, Orcamento } from '@/hooks/useOrcamentos';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useDentistas } from '@/hooks/useDentistas';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { useDocumentosClinicos, DocumentoClinico } from '@/hooks/useDocumentosClinicos';
import { useSignatures } from '@/hooks/useSignatures';
import SignatureModal from '@/components/signature/SignatureModal';
import type { SignatureData } from '@/components/signature/DigitalSignature';
import {
  mapearDadosContrato,
  gerarHtmlContrato,
  ContratoSnapshot,
  gerarLinkAssinaturaContrato,
} from '@/utils/contratoEngine';
import { downloadHtmlAsPdf } from '@/utils/pdfDownload';
import { openWhatsApp } from '@/lib/whatsapp';
import { formatMoney } from '@/utils/exportCsv';

interface ContratoModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: any;
  initialOrcamento?: Orcamento | any;
}

export const ContratoModal: React.FC<ContratoModalProps> = ({
  isOpen,
  onClose,
  patient,
  initialOrcamento,
}) => {
  const { orcamentos } = useOrcamentos(patient?.id);
  const { configuracoes } = useConfiguracoes();
  const { dentistas } = useDentistas();
  const { transacoes } = useDentalSystem();
  const { documentos, salvarDocumento } = useDocumentosClinicos(patient?.id);

  // Estados principais
  const [activeTab, setActiveTab] = useState<'gerar' | 'editar' | 'historico'>('gerar');
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [isManuallyEdited, setIsManuallyEdited] = useState<boolean>(false);
  const [documentoIdSendoEditado, setDocumentoIdSendoEditado] = useState<string | null>(null);

  const [selectedOrcamentoId, setSelectedOrcamentoId] = useState<string>('');
  const [selectedDentistaNome, setSelectedDentistaNome] = useState<string>('');
  const [cidadeLocal, setCidadeLocal] = useState<string>('São Paulo');

  const [salvando, setSalvando] = useState<boolean>(false);
  const [baixandoPdf, setBaixandoPdf] = useState<boolean>(false);
  const [copiouLink, setCopiouLink] = useState<boolean>(false);

  // Assinatura digital interna
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [signerRole, setSignerRole] = useState<'paciente' | 'dentista'>('paciente');

  // Contrato emitido selecionado para visualização no histórico
  const [contratoVisualizacao, setContratoVisualizacao] = useState<DocumentoClinico | null>(null);

  // Snapshot em tempo real com os dados do contrato
  const [snapshotAtual, setSnapshotAtual] = useState<ContratoSnapshot | null>(null);

  // Orçamentos aprovados do paciente
  const orcamentosAprovados = useMemo(() => {
    return orcamentos.filter((o) => o.status === 'aprovado');
  }, [orcamentos]);

  // Contratos emitidos anteriormente para este paciente
  const contratosEmitidos = useMemo(() => {
    return documentos.filter((d) => d.tipo === 'contrato');
  }, [documentos]);

  // Pré-seleciona orçamento inicial ou primeiro aprovado
  useEffect(() => {
    if (initialOrcamento?.id) {
      setSelectedOrcamentoId(initialOrcamento.id);
    } else if (orcamentosAprovados.length > 0 && !selectedOrcamentoId) {
      setSelectedOrcamentoId(orcamentosAprovados[0].id);
    }
  }, [initialOrcamento, orcamentosAprovados, selectedOrcamentoId]);

  // Dentista responsável padrão
  useEffect(() => {
    if (dentistas.length > 0 && !selectedDentistaNome) {
      setSelectedDentistaNome(dentistas[0].nome);
    }
  }, [dentistas, selectedDentistaNome]);

  // Orçamento ativo
  const orcamentoAtual = useMemo(() => {
    return (
      orcamentos.find((o) => o.id === selectedOrcamentoId) ||
      initialOrcamento ||
      orcamentosAprovados[0] ||
      null
    );
  }, [orcamentos, selectedOrcamentoId, initialOrcamento, orcamentosAprovados]);

  // Dentista ativo
  const dentistaAtual = useMemo(() => {
    return dentistas.find((d) => d.nome === selectedDentistaNome);
  }, [dentistas, selectedDentistaNome]);

  // Transações vinculadas ao orçamento
  const transacoesOrcamento = useMemo(() => {
    if (!orcamentoAtual?.id) return [];
    return transacoes.filter((t: any) => t.orcamentoId === orcamentoAtual.id);
  }, [transacoes, orcamentoAtual]);

  // Inicializa ou atualiza o snapshot automaticamente (caso não tenha edições manuais ativas)
  useEffect(() => {
    if (isManuallyEdited) return;
    if (!patient || !orcamentoAtual) {
      setSnapshotAtual(null);
      return;
    }

    const snap = mapearDadosContrato({
      patient,
      orcamento: orcamentoAtual,
      transacoes: transacoesOrcamento,
      configuracoes,
      dentistaNome: selectedDentistaNome || configuracoes?.croResponsavel,
      dentistaCro: dentistaAtual?.cro || configuracoes?.croResponsavel,
      cidadeLocal,
    });

    setSnapshotAtual(snap);
  }, [
    isManuallyEdited,
    patient,
    orcamentoAtual,
    transacoesOrcamento,
    configuracoes,
    selectedDentistaNome,
    dentistaAtual,
    cidadeLocal,
  ]);

  // HTML renderizado do contrato atual
  const htmlContratoAtual = useMemo(() => {
    if (!snapshotAtual) return '';
    return gerarHtmlContrato(snapshotAtual);
  }, [snapshotAtual]);

  // Validação de campos cadastrais indispensáveis
  const pendenciasCadastrais = useMemo(() => {
    const pendencias: string[] = [];
    if (!patient?.cpf || patient.cpf === 'Não informado') pendencias.push('CPF');
    if (!patient?.rg || patient.rg === 'Não informado') pendencias.push('RG');
    if (!patient?.endereco || patient.endereco === 'Não informado') pendencias.push('Endereço');
    if (!patient?.telefone || patient.telefone === 'Não informado') pendencias.push('Telefone');
    return pendencias;
  }, [patient]);

  // Atualização granular de campos no snapshot manual
  const handleUpdateSnapshotField = (campo: string, valor: any) => {
    setIsManuallyEdited(true);
    setSnapshotAtual((prev) => {
      if (!prev) return prev;
      const partes = campo.split('.');
      if (partes.length === 1) {
        return { ...prev, [partes[0]]: valor };
      }
      if (partes.length === 2) {
        return {
          ...prev,
          [partes[0]]: {
            ...(prev as any)[partes[0]],
            [partes[1]]: valor,
          },
        };
      }
      return prev;
    });
  };

  // Troca de orçamento via seletor
  const handleTrocarOrcamento = (novoOrcamentoId: string) => {
    setSelectedOrcamentoId(novoOrcamentoId);
    setIsManuallyEdited(false);
    setDocumentoIdSendoEditado(null);
  };

  // Restaura dados automáticos do sistema
  const handleRestaurarPadrao = () => {
    if (!patient || !orcamentoAtual) return;
    setIsManuallyEdited(false);
    setDocumentoIdSendoEditado(null);
    const snap = mapearDadosContrato({
      patient,
      orcamento: orcamentoAtual,
      transacoes: transacoesOrcamento,
      configuracoes,
      dentistaNome: selectedDentistaNome || configuracoes?.croResponsavel,
      dentistaCro: dentistaAtual?.cro || configuracoes?.croResponsavel,
      cidadeLocal,
    });
    setSnapshotAtual(snap);
    toast.success('Valores padrão do sistema restaurados com sucesso.');
  };

  // Carrega contrato do histórico para edição
  const handleCarregarContratoParaEdicao = (doc: DocumentoClinico) => {
    if (doc.itens && typeof doc.itens === 'object' && doc.itens.paciente) {
      setSnapshotAtual(doc.itens as ContratoSnapshot);
      setDocumentoIdSendoEditado(doc.id);
      setIsManuallyEdited(true);
      setActiveTab('editar');
      toast.info('Contrato carregado para edição manual.');
    } else {
      toast.warning('Este registro foi gerado em formato legado e não possui itens editáveis.');
    }
  };

  // Salva e emite o contrato (novo ou atualização)
  const handleEmitirContrato = async () => {
    if (!snapshotAtual) {
      toast.error('Nenhum dado de contrato para emitir.');
      return;
    }

    try {
      setSalvando(true);
      const htmlFinal = gerarHtmlContrato(snapshotAtual);

      const docCriado = await salvarDocumento({
        id: documentoIdSendoEditado || undefined,
        pacienteId: patient?.id,
        pacienteNome: patient?.nome,
        tipo: 'contrato',
        titulo: `Contrato Odontológico - Orçamento #${snapshotAtual.orcamento.numeroIdentificador}`,
        conteudo: htmlFinal,
        itens: snapshotAtual as any,
        dentista: snapshotAtual.clinica.dentistaResponsavel || selectedDentistaNome || null,
        assinadoEm: snapshotAtual.assinaturaPaciente ? new Date() : null,
        assinanteNome: snapshotAtual.assinaturaPaciente?.nome || null,
        assinaturaData: snapshotAtual.assinaturaPaciente?.assinaturaData || null,
      });

      if (docCriado) {
        toast.success(
          documentoIdSendoEditado
            ? 'Contrato atualizado com sucesso!'
            : 'Contrato emitido e gravado com sucesso!',
          {
            description: `Identificador: ${snapshotAtual.contratoId}`,
          }
        );
        setActiveTab('historico');
        setContratoVisualizacao(docCriado);
        setDocumentoIdSendoEditado(null);
      }
    } catch (err: any) {
      console.error('Erro ao emitir contrato:', err);
      toast.error('Erro ao salvar contrato', { description: err?.message });
    } finally {
      setSalvando(false);
    }
  };

  // Download do PDF formatado
  const handleDownloadPdf = async (htmlParaBaixar?: string, nomeArquivo?: string) => {
    const html = htmlParaBaixar || htmlContratoAtual;
    if (!html) {
      toast.error('Conteúdo do contrato não disponível');
      return;
    }

    try {
      setBaixandoPdf(true);
      const filename =
        nomeArquivo ||
        `contrato_${patient?.nome ? patient.nome.replace(/\s+/g, '_') : 'paciente'}_orc_${snapshotAtual?.orcamento.numeroIdentificador || 'aprovado'}`;

      await downloadHtmlAsPdf(html, filename);
      toast.success('PDF do contrato baixado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao gerar PDF:', err);
      toast.error('Erro ao gerar PDF do contrato');
    } finally {
      setBaixandoPdf(false);
    }
  };

  // Impressão nativa do contrato
  const handleImprimir = (htmlParaImprimir?: string) => {
    const html = htmlParaImprimir || htmlContratoAtual;
    if (!html) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1500);
      }, 300);
    }
  };

  // Copia link de assinatura pública
  const handleCopiarLinkAssinatura = () => {
    if (!snapshotAtual) return;
    const link = gerarLinkAssinaturaContrato(snapshotAtual, contratoVisualizacao?.id);
    navigator.clipboard.writeText(link);
    setCopiouLink(true);
    toast.success('Link de assinatura copiado com sucesso!', {
      description: 'Envie o link para o paciente assinar pelo celular.',
    });
    setTimeout(() => setCopiouLink(false), 2500);
  };

  // Abre a tela pública de assinatura em nova aba
  const handleAbrirPaginaAssinatura = () => {
    if (!snapshotAtual) return;
    const link = gerarLinkAssinaturaContrato(snapshotAtual, contratoVisualizacao?.id);
    window.open(link, '_blank');
  };

  // Envio de notificação no WhatsApp
  const handleEnviarWhatsApp = () => {
    if (!patient?.telefone) {
      toast.warning('Paciente não possui telefone cadastrado');
      return;
    }

    const clinicaPix = snapshotAtual?.clinica.chavePix || configuracoes?.telefone || configuracoes?.cnpj || '';
    const clinicaNome = snapshotAtual?.clinica.nome || configuracoes?.nomeClinica || 'Clínica Odontológica';
    const linkAssinatura = snapshotAtual ? gerarLinkAssinaturaContrato(snapshotAtual, contratoVisualizacao?.id) : '';

    let mensagem =
      `Olá, ${patient.nome}! Tudo bem?\n\n` +
      `Aqui está o resumo oficial do seu *Contrato de Prestação de Serviços Odontológicos* referente ao plano de tratamento (*Orçamento #${snapshotAtual?.orcamento.numeroIdentificador}*):\n\n` +
      `• *Valor Total:* ${formatMoney(snapshotAtual?.financeiro.total || 0)}\n` +
      `• *Forma de Pagamento:* ${snapshotAtual?.financeiro.formaPagamento}\n`;

    if (snapshotAtual?.financeiro.entrada && snapshotAtual.financeiro.entrada > 0) {
      mensagem += `• *Entrada (PIX):* ${formatMoney(snapshotAtual.financeiro.entrada)}\n`;
    }

    if (snapshotAtual?.financeiro.quantidadeParcelas && snapshotAtual.financeiro.quantidadeParcelas > 1) {
      mensagem += `• *Parcelamento:* ${snapshotAtual.financeiro.quantidadeParcelas}x de ${formatMoney(snapshotAtual.financeiro.valorParcela)}\n`;
    }

    if (clinicaPix) {
      mensagem +=
        `\n✦ *Dados Oficiais para Pagamento via PIX:*\n` +
        `• *Chave PIX:* ${clinicaPix}\n` +
        `• *Favorecido:* ${clinicaNome}\n` +
        `• Favor encaminhar o comprovante por este canal para baixa contábil e emissão do recibo.\n`;
    }

    if (linkAssinatura) {
      mensagem +=
        `\n✍️ *LINK PARA VISUALIZAR E ASSINAR DIGITALMENTE O CONTRATO:*\n` +
        `Acesse o link abaixo pelo seu celular ou computador para conferir os termos e assinar online agora:\n` +
        `👉 ${linkAssinatura}\n\n` +
        `Após assinar, você também poderá baixar a sua via oficial em PDF diretamente pela página.\n`;
    }

    mensagem += `\nQualquer dúvida, nossa equipe está à sua inteira disposição!`;

    openWhatsApp(patient.telefone, mensagem);
  };

  // Aplicação da Assinatura Digital Interna
  const handleAssinaturaConcluida = (sigData: SignatureData) => {
    if (!snapshotAtual) return;

    if (signerRole === 'paciente') {
      setSnapshotAtual((prev) =>
        prev
          ? {
              ...prev,
              assinaturaPaciente: {
                assinaturaData: sigData.signature,
                nome: sigData.signerName,
                dataHora: new Date().toISOString(),
              },
            }
          : null
      );
      toast.success('Assinatura do paciente registrada no contrato!');
    } else {
      setSnapshotAtual((prev) =>
        prev
          ? {
              ...prev,
              assinaturaDentista: {
                assinaturaData: sigData.signature,
                nome: sigData.signerName,
                dataHora: new Date().toISOString(),
              },
            }
          : null
      );
      toast.success('Assinatura do cirurgião-dentista registrada no contrato!');
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className={cn(
            "flex flex-col p-0 overflow-hidden bg-background text-foreground transition-all duration-200",
            isFullScreen
              ? "fixed inset-0 z-50 w-screen h-screen max-w-none max-h-none rounded-none m-0 border-0"
              : "max-w-5xl w-full max-h-[92vh] rounded-lg border border-border shadow-2xl"
          )}
        >
          {/* Header do Modal */}
          <div className="p-4 sm:p-5 border-b border-border bg-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2 text-foreground">
                  Contrato de Prestação de Serviços
                  <Badge variant="outline" className="font-semibold text-xs border-primary/30 text-primary bg-primary/10">
                    Motor Integrado
                  </Badge>
                  {isManuallyEdited && (
                    <Badge variant="secondary" className="font-semibold text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      Edição Manual
                    </Badge>
                  )}
                </DialogTitle>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Paciente: <strong className="text-foreground">{patient?.nome}</strong> • Vínculo com orçamentos e financeiro
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Botão de Tela Cheia */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-2.5 text-xs gap-1.5 border-border text-foreground hover:bg-muted"
                onClick={() => setIsFullScreen(!isFullScreen)}
                title={isFullScreen ? "Sair da Tela Cheia" : "Visualizar em Tela Cheia"}
              >
                {isFullScreen ? (
                  <>
                    <Minimize2 className="h-4 w-4 text-primary" />
                    <span className="hidden sm:inline">Reduzir</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-4 w-4 text-primary" />
                    <span className="hidden sm:inline">Tela Cheia</span>
                  </>
                )}
              </Button>

              {/* Abas */}
              <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-auto">
                <TabsList className="grid grid-cols-3 h-9 bg-muted p-1">
                  <TabsTrigger
                    value="gerar"
                    className="text-xs flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm font-medium"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Visualizar
                  </TabsTrigger>
                  <TabsTrigger
                    value="editar"
                    className="text-xs flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm font-medium"
                  >
                    <Pencil className="h-3.5 w-3.5 text-amber-500" />
                    Editar Campos
                  </TabsTrigger>
                  <TabsTrigger
                    value="historico"
                    className="text-xs flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm font-medium"
                  >
                    <History className="h-3.5 w-3.5" />
                    Emitidos ({contratosEmitidos.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* Conteúdo das Abas */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-muted/20">
            {/* ABA 1: VISUALIZAR CONTRATO */}
            {activeTab === 'gerar' && (
              <div className="space-y-4">
                {/* Barra de Seleção e Parâmetros */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 bg-card rounded-lg border border-border shadow-sm">
                  {/* Seleção do Orçamento Aprovado */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                      <DollarSign className="h-3.5 w-3.5 text-primary" />
                      Orçamento Vinculado
                    </Label>
                    <Select value={selectedOrcamentoId} onValueChange={handleTrocarOrcamento}>
                      <SelectTrigger className="h-9 text-xs border-border bg-background text-foreground">
                        <SelectValue placeholder="Selecione um orçamento" />
                      </SelectTrigger>
                      <SelectContent>
                        {orcamentos.length === 0 ? (
                          <SelectItem value="none" disabled>
                            Nenhum orçamento encontrado
                          </SelectItem>
                        ) : (
                          orcamentos.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.titulo} — {formatMoney(o.total)}{' '}
                              {o.status === 'aprovado' ? '✓ (Aprovado)' : `(${o.status})`}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Seleção do Dentista Responsável */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                      <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                      Profissional Responsável
                    </Label>
                    <Select value={selectedDentistaNome} onValueChange={setSelectedDentistaNome}>
                      <SelectTrigger className="h-9 text-xs border-border bg-background text-foreground">
                        <SelectValue placeholder="Selecione o profissional" />
                      </SelectTrigger>
                      <SelectContent>
                        {dentistas.length === 0 ? (
                          <SelectItem value={configuracoes?.croResponsavel || 'Clínica'}>
                            {configuracoes?.nomeClinica || 'Responsável Técnico'}
                          </SelectItem>
                        ) : (
                          dentistas.map((d) => (
                            <SelectItem key={d.id} value={d.nome}>
                              {d.nome} {d.cro ? `(CRO ${d.cro})` : ''}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Cidade da Comarca */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      Comarca / Cidade
                    </Label>
                    <Input
                      type="text"
                      value={cidadeLocal}
                      onChange={(e) => setCidadeLocal(e.target.value)}
                      placeholder="São Paulo"
                      className="h-9 text-xs border-border bg-background text-foreground"
                    />
                  </div>
                </div>

                {/* Alerta de Pendências Cadastrais do Paciente */}
                {pendenciasCadastrais.length > 0 && (
                  <Alert variant="default" className="bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200 py-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertDescription className="text-xs flex items-center justify-between">
                      <span>
                        <strong>Aviso:</strong> Campos pendentes no cadastro: <em>{pendenciasCadastrais.join(', ')}</em>.
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 px-2"
                        onClick={() => setActiveTab('editar')}
                      >
                        Preencher no Contrato
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Status do Orçamento Selecionado e Ações Rápidas */}
                {orcamentoAtual && (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-card rounded-md border border-border text-xs text-foreground">
                    <div className="flex flex-wrap items-center gap-3">
                      <span>
                        Status:{' '}
                        <Badge
                          variant={orcamentoAtual.status === 'aprovado' ? 'default' : 'secondary'}
                          className="capitalize text-[11px]"
                        >
                          {orcamentoAtual.status}
                        </Badge>
                      </span>
                      <span>
                        Total:{' '}
                        <strong className="text-foreground">{formatMoney(snapshotAtual?.financeiro.total || 0)}</strong>
                      </span>
                      <span>
                        Procedimentos: <strong>{orcamentoAtual.itens?.length || 0}</strong>
                      </span>
                      {snapshotAtual?.financeiro.formaPagamento && (
                        <span>
                          Pagamento:{' '}
                          <span className="font-semibold text-primary">{snapshotAtual.financeiro.formaPagamento}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5 text-foreground hover:bg-muted border-border"
                        onClick={() => setActiveTab('editar')}
                      >
                        <Pencil className="h-3 w-3 text-amber-500" />
                        Editar Campos
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5 text-foreground hover:bg-muted border-border"
                        onClick={() => {
                          setSignerRole('paciente');
                          setIsSignatureModalOpen(true);
                        }}
                      >
                        <PenTool className="h-3 w-3 text-primary" />
                        {snapshotAtual?.assinaturaPaciente ? '✓ Assinado Paciente' : 'Assinar Paciente'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5 text-foreground hover:bg-muted border-border"
                        onClick={() => {
                          setSignerRole('dentista');
                          setIsSignatureModalOpen(true);
                        }}
                      >
                        <ShieldCheck className="h-3 w-3 text-emerald-600" />
                        {snapshotAtual?.assinaturaDentista ? '✓ Assinado Dentista' : 'Assinar Profissional'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5 text-foreground hover:bg-muted border-border"
                        onClick={() => setIsFullScreen(!isFullScreen)}
                      >
                        {isFullScreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                        {isFullScreen ? 'Reduzir' : 'Tela Cheia'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Pré-visualização do Documento (Isolado em Iframe para não quebrar estilos do sistema) */}
                <div className="bg-card rounded-lg border border-border shadow-md overflow-hidden flex flex-col">
                  <div className="bg-muted px-4 py-2 border-b border-border flex items-center justify-between text-xs text-muted-foreground font-medium">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      Visualização Oficial do Contrato (Padrão A4)
                    </span>
                    <span className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px] gap-1 px-1.5 text-muted-foreground hover:text-foreground"
                        onClick={() => setIsFullScreen(!isFullScreen)}
                      >
                        {isFullScreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                        {isFullScreen ? 'Sair da Tela Cheia' : 'Modo Tela Cheia'}
                      </Button>
                    </span>
                  </div>

                  <div
                    className={cn(
                      "p-2 sm:p-4 bg-slate-200/70 dark:bg-slate-950/80 flex flex-col items-center justify-center transition-all",
                      isFullScreen ? "h-[calc(100vh-210px)]" : "h-[56vh]"
                    )}
                  >
                    <iframe
                      srcDoc={htmlContratoAtual}
                      title="Contrato Oficial A4"
                      className="w-full h-full max-w-[820px] rounded border border-border bg-white shadow-xl"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ABA 2: EDITAR CAMPOS MANUALMENTE */}
            {activeTab === 'editar' && (
              <div className="space-y-4">
                {/* Banner Informativo de Edição Manual */}
                <div className="p-3.5 bg-card rounded-lg border border-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <Pencil className="h-4 w-4 text-amber-500" />
                      Editor Manual de Informações do Contrato
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Altere qualquer dado cadastral, profissional ou financeiro. As alterações refletem imediatamente no contrato gerado e no link de assinatura.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5 border-border text-foreground hover:bg-muted"
                      onClick={handleRestaurarPadrao}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restaurar Padrão
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => {
                        setActiveTab('gerar');
                        toast.success('Alterações aplicadas na visualização!');
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ver Contrato
                    </Button>
                  </div>
                </div>

                {snapshotAtual && (
                  <div className="space-y-4">
                    {/* Seção 1: Dados do Paciente */}
                    <div className="p-4 bg-card rounded-lg border border-border shadow-sm space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-primary" />
                        1. Dados do Paciente (Contratante)
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Nome Completo</Label>
                          <Input
                            value={snapshotAtual.paciente.nome || ''}
                            onChange={(e) => handleUpdateSnapshotField('paciente.nome', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">CPF</Label>
                          <Input
                            value={snapshotAtual.paciente.cpf || ''}
                            onChange={(e) => handleUpdateSnapshotField('paciente.cpf', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">RG</Label>
                          <Input
                            value={snapshotAtual.paciente.rg || ''}
                            onChange={(e) => handleUpdateSnapshotField('paciente.rg', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Telefone / WhatsApp</Label>
                          <Input
                            value={snapshotAtual.paciente.telefone || ''}
                            onChange={(e) => handleUpdateSnapshotField('paciente.telefone', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Profissão</Label>
                          <Input
                            value={snapshotAtual.paciente.profissao || ''}
                            onChange={(e) => handleUpdateSnapshotField('paciente.profissao', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Estado Civil</Label>
                          <Input
                            value={snapshotAtual.paciente.estadoCivil || ''}
                            onChange={(e) => handleUpdateSnapshotField('paciente.estadoCivil', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1 sm:col-span-2 md:col-span-3">
                          <Label className="text-xs text-muted-foreground">Endereço Residencial Completo</Label>
                          <Input
                            value={snapshotAtual.paciente.endereco || ''}
                            onChange={(e) => handleUpdateSnapshotField('paciente.endereco', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Seção 2: Dados da Clínica e Cirurgião-Dentista */}
                    <div className="p-4 bg-card rounded-lg border border-border shadow-sm space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                        2. Dados da Clínica e Profissional Responsável
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Cirurgião-Dentista Responsável</Label>
                          <Input
                            value={snapshotAtual.clinica.dentistaResponsavel || ''}
                            onChange={(e) => handleUpdateSnapshotField('clinica.dentistaResponsavel', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Número do CRO</Label>
                          <Input
                            value={snapshotAtual.clinica.cro || ''}
                            onChange={(e) => handleUpdateSnapshotField('clinica.cro', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Nome da Clínica</Label>
                          <Input
                            value={snapshotAtual.clinica.nome || ''}
                            onChange={(e) => handleUpdateSnapshotField('clinica.nome', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">CNPJ</Label>
                          <Input
                            value={snapshotAtual.clinica.cnpj || ''}
                            onChange={(e) => handleUpdateSnapshotField('clinica.cnpj', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Chave PIX Oficial</Label>
                          <Input
                            value={snapshotAtual.clinica.chavePix || ''}
                            onChange={(e) => handleUpdateSnapshotField('clinica.chavePix', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Comarca / Cidade do Foro</Label>
                          <Input
                            value={snapshotAtual.clinica.cidade || ''}
                            onChange={(e) => handleUpdateSnapshotField('clinica.cidade', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1 sm:col-span-2 md:col-span-3">
                          <Label className="text-xs text-muted-foreground">Endereço do Consultório / Clínica</Label>
                          <Input
                            value={snapshotAtual.clinica.endereco || ''}
                            onChange={(e) => handleUpdateSnapshotField('clinica.endereco', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Seção 3: Condições Financeiras e Formas de Pagamento */}
                    <div className="p-4 bg-card rounded-lg border border-border shadow-sm space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-primary" />
                        3. Condições Financeiras e Formas de Pagamento
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Valor Total (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={snapshotAtual.financeiro.total || ''}
                            onChange={(e) => handleUpdateSnapshotField('financeiro.total', parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Entrada (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={snapshotAtual.financeiro.entrada || ''}
                            onChange={(e) => handleUpdateSnapshotField('financeiro.entrada', parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Qtd. de Parcelas</Label>
                          <Input
                            type="number"
                            min="1"
                            value={snapshotAtual.financeiro.quantidadeParcelas || 1}
                            onChange={(e) => handleUpdateSnapshotField('financeiro.quantidadeParcelas', parseInt(e.target.value, 10) || 1)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Valor da Parcela (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={snapshotAtual.financeiro.valorParcela || ''}
                            onChange={(e) => handleUpdateSnapshotField('financeiro.valorParcela', parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1 sm:col-span-2 md:col-span-4">
                          <Label className="text-xs text-muted-foreground">Descrição da Forma de Pagamento (Cláusula 3ª)</Label>
                          <Input
                            value={snapshotAtual.financeiro.formaPagamento || ''}
                            onChange={(e) => handleUpdateSnapshotField('financeiro.formaPagamento', e.target.value)}
                            placeholder="Ex: PIX Parcelado: Entrada de R$ 450,00 + 2x de R$ 200,00 (Vencimento todo dia 10)"
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Seção 4: Cláusula Adicional ou Observações Especiais */}
                    <div className="p-4 bg-card rounded-lg border border-border shadow-sm space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        4. Cláusula Adicional ou Observações Especiais (Opcional)
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Texto livre inserido como Cláusula Especial no contrato para registrar acordos verbais, condições de garantia, cronogramas ou detalhes específicos.
                      </p>
                      <Textarea
                        value={snapshotAtual.observacoesCustomizadas || ''}
                        onChange={(e) => handleUpdateSnapshotField('observacoesCustomizadas', e.target.value)}
                        placeholder="Digite aqui eventuais termos adicionais para este paciente..."
                        rows={3}
                        className="text-xs border-border bg-background text-foreground"
                      />
                    </div>

                    {/* Botões de Ação na Aba de Edição */}
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5 border-border text-foreground hover:bg-muted"
                        onClick={handleRestaurarPadrao}
                      >
                        <RotateCcw className="h-4 w-4" />
                        Restaurar Padrão
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5 border-border text-foreground hover:bg-muted"
                        onClick={() => {
                          setActiveTab('gerar');
                          toast.success('Visualizando contrato com as alterações aplicadas.');
                        }}
                      >
                        <Eye className="h-4 w-4 text-primary" />
                        Aplicar e Visualizar
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        className="h-9 gap-1.5 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                        onClick={handleEmitirContrato}
                        disabled={salvando}
                      >
                        {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {documentoIdSendoEditado ? 'Salvar Alterações no Contrato' : 'Salvar e Emitir Contrato'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ABA 3: HISTÓRICO DE CONTRATOS EMITIDOS */}
            {activeTab === 'historico' && (
              <div className="space-y-4">
                {contratosEmitidos.length === 0 ? (
                  <div className="text-center py-12 bg-card rounded-lg border border-border text-foreground">
                    <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                    <h3 className="font-semibold text-base">Nenhum contrato emitido ainda</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      Gere o primeiro contrato para este paciente a partir de um orçamento aprovado na aba "Visualizar".
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {contratosEmitidos.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-4 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-foreground"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <h4 className="font-semibold text-sm text-foreground">{doc.titulo}</h4>
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                              Imutável
                            </Badge>
                            {doc.assinaturaData && (
                              <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                                ✓ Assinado
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Emitido em: {new Date(doc.criadoEm).toLocaleString('pt-BR')}
                            {doc.dentista ? ` • Responsável: ${doc.dentista}` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5 border-border text-foreground hover:bg-muted"
                            onClick={() => {
                              setContratoVisualizacao(doc);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Visualizar
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/60 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                            onClick={() => handleCarregarContratoParaEdicao(doc)}
                            title="Editar manualmente campos deste contrato"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            onClick={() => handleDownloadPdf(doc.conteudo || '', `contrato_${patient?.nome}_${doc.id.slice(0, 8)}`)}
                          >
                            <Download className="h-3.5 w-3.5" />
                            PDF
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5 border-border text-foreground hover:bg-muted"
                            onClick={() => handleImprimir(doc.conteudo || '')}
                          >
                            <Printer className="h-3.5 w-3.5" />
                            Imprimir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Visualizador de Contrato Selecionado do Histórico */}
                {contratoVisualizacao && (
                  <div className="mt-6 p-4 bg-card rounded-lg border border-border space-y-3 shadow-md">
                    <div className="flex items-center justify-between border-b border-border pb-2.5">
                      <h4 className="font-semibold text-sm flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        Cópia Fiel Registrada: {contratoVisualizacao.titulo}
                      </h4>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 border-border text-foreground hover:bg-muted"
                          onClick={() => setIsFullScreen(!isFullScreen)}
                        >
                          {isFullScreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                          {isFullScreen ? 'Reduzir' : 'Tela Cheia'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setContratoVisualizacao(null)}
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Fechar
                        </Button>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "p-2 sm:p-4 bg-slate-200/70 dark:bg-slate-950/80 rounded flex flex-col items-center justify-center transition-all",
                        isFullScreen ? "h-[calc(100vh-220px)]" : "h-[54vh]"
                      )}
                    >
                      <iframe
                        srcDoc={contratoVisualizacao.conteudo || ''}
                        title="Visualização do Contrato Gravado"
                        className="w-full h-full max-w-[820px] rounded border border-border bg-white shadow-xl"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rodapé de Ações do Modal */}
          <div className="p-3 sm:p-4 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Gera documento com validade jurídica perante o CFO, CDC e Código Civil.</span>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 border-border text-foreground hover:bg-muted"
                onClick={onClose}
              >
                Fechar
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 border-border text-foreground hover:bg-muted"
                onClick={() => handleImprimir()}
                disabled={!snapshotAtual}
              >
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 border-border text-foreground hover:bg-muted"
                onClick={() => handleDownloadPdf()}
                disabled={baixandoPdf || !snapshotAtual}
              >
                {baixandoPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Baixar PDF
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                onClick={handleCopiarLinkAssinatura}
                disabled={!snapshotAtual}
                title="Copiar link para o paciente assinar online pelo celular"
              >
                {copiouLink ? <Check className="h-4 w-4 text-emerald-600" /> : <LinkIcon className="h-4 w-4" />}
                {copiouLink ? 'Link Copiado!' : 'Copiar Link'}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                onClick={handleAbrirPaginaAssinatura}
                disabled={!snapshotAtual}
                title="Abrir página pública de assinatura digital em nova aba"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir Assinatura
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm hover:shadow border-transparent"
                onClick={handleEnviarWhatsApp}
                disabled={!patient?.telefone || !snapshotAtual}
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp (com Link)
              </Button>

              <Button
                type="button"
                size="sm"
                className="h-9 gap-1.5 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow"
                onClick={handleEmitirContrato}
                disabled={salvando || !snapshotAtual || !orcamentoAtual}
              >
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {documentoIdSendoEditado ? 'Salvar Alterações' : 'Emitir e Gravar Contrato'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Assinatura Digital Integrado */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        title={signerRole === 'paciente' ? 'Assinatura do Paciente / Contratante' : 'Assinatura do Cirurgião-Dentista'}
        signerName={signerRole === 'paciente' ? patient?.nome || 'Paciente' : selectedDentistaNome || 'Cirurgião-Dentista'}
        signerRole={signerRole}
        documentType="contrato"
        onSignatureComplete={handleAssinaturaConcluida}
      />
    </>
  );
};

export default ContratoModal;
