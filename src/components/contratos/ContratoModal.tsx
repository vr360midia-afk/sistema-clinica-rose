import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Share2,
  Calendar,
  DollarSign,
  ShieldCheck,
  User,
  Loader2,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';

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
  const { orcamentos, loading: loadingOrcamentos } = useOrcamentos(patient?.id);
  const { configuracoes } = useConfiguracoes();
  const { dentistas } = useDentistas();
  const { transacoes } = useDentalSystem();
  const { documentos, salvarDocumento, registrarAssinatura } = useDocumentosClinicos(patient?.id);
  const { saveSignature } = useSignatures();

  const [activeTab, setActiveTab] = useState<'gerar' | 'historico'>('gerar');
  const [selectedOrcamentoId, setSelectedOrcamentoId] = useState<string>('');
  const [selectedDentistaNome, setSelectedDentistaNome] = useState<string>('');
  const [cidadeLocal, setCidadeLocal] = useState<string>('São Paulo');
  const [salvando, setSalvando] = useState<boolean>(false);
  const [baixandoPdf, setBaixandoPdf] = useState<boolean>(false);

  // Assinatura digital
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [signerRole, setSignerRole] = useState<'paciente' | 'dentista'>('paciente');

  // Contrato emitido selecionado para visualização no histórico
  const [contratoVisualizacao, setContratoVisualizacao] = useState<DocumentoClinico | null>(null);

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

  // Gera o snapshot em tempo real com base nos dados do sistema
  const [snapshotAtual, setSnapshotAtual] = useState<ContratoSnapshot | null>(null);

  useEffect(() => {
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
    if (!patient?.cpf || patient.cpf === 'Não informado') pendencias.push('CPF do paciente');
    if (!patient?.rg || patient.rg === 'Não informado') pendencias.push('RG do paciente');
    if (!patient?.endereco || patient.endereco === 'Não informado') pendencias.push('Endereço completo');
    if (!patient?.telefone || patient.telefone === 'Não informado') pendencias.push('Telefone de contato');
    return pendencias;
  }, [patient]);

  // Emissão definitiva (Salva snapshot imutável no banco)
  const handleEmitirContrato = async () => {
    if (!snapshotAtual || !orcamentoAtual) {
      toast.error('Nenhum orçamento aprovado selecionado.');
      return;
    }

    try {
      setSalvando(true);

      const htmlFinal = gerarHtmlContrato(snapshotAtual);

      const docCriado = await salvarDocumento({
        pacienteId: patient.id,
        pacienteNome: patient.nome,
        tipo: 'contrato',
        titulo: `Contrato Odontológico - Orçamento #${snapshotAtual.orcamento.numeroIdentificador}`,
        conteudo: htmlFinal,
        itens: snapshotAtual as any,
        dentista: selectedDentistaNome || null,
        assinadoEm: snapshotAtual.assinaturaPaciente ? new Date() : null,
        assinanteNome: snapshotAtual.assinaturaPaciente?.nome || null,
        assinaturaData: snapshotAtual.assinaturaPaciente?.assinaturaData || null,
      });

      if (docCriado) {
        toast.success('Contrato emitido e registrado com sucesso!', {
          description: `Identificador: ${snapshotAtual.contratoId} (Snapshot imutável gravado)`,
        });
        setActiveTab('historico');
        setContratoVisualizacao(docCriado);
      }
    } catch (err: any) {
      console.error('Erro ao emitir contrato:', err);
      toast.error('Erro ao emitir contrato', { description: err?.message });
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

  // Envio de notificação no WhatsApp
  const handleEnviarWhatsApp = () => {
    if (!patient?.telefone) {
      toast.warning('Paciente não possui telefone cadastrado');
      return;
    }

    const clinicaPix = snapshotAtual?.clinica.chavePix || configuracoes?.telefone || configuracoes?.cnpj || '';
    const clinicaNome = snapshotAtual?.clinica.nome || configuracoes?.nomeClinica || 'Clínica Odontológica';

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

    mensagem += `\nQualquer dúvida, nossa equipe está à sua inteira disposição!`;

    openWhatsApp(patient.telefone, mensagem);
  };

  // Aplicação da Assinatura Digital
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
        <DialogContent className="max-w-5xl w-full max-h-[92vh] flex flex-col p-0 overflow-hidden">
          {/* Header do Modal */}
          <div className="p-4 sm:p-5 border-b border-border bg-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  Contrato de Prestação de Serviços
                  <Badge variant="outline" className="font-normal text-xs">
                    Motor Integrado
                  </Badge>
                </DialogTitle>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Paciente: <strong>{patient?.nome}</strong> • Vínculo automático com orçamentos e financeiro
                </p>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-auto">
              <TabsList className="grid grid-cols-2 h-9">
                <TabsTrigger value="gerar" className="text-xs flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Gerar Contrato
                </TabsTrigger>
                <TabsTrigger value="historico" className="text-xs flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  Emitidos ({contratosEmitidos.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Conteúdo das Abas */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-muted/20">
            {activeTab === 'gerar' && (
              <div className="space-y-4">
                {/* Barra de Seleção e Parâmetros */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 bg-card rounded-lg border border-border shadow-sm">
                  {/* Seleção do Orçamento Aprovado */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-primary" />
                      Orçamento Aprovado Vinculado
                    </Label>
                    <Select value={selectedOrcamentoId} onValueChange={setSelectedOrcamentoId}>
                      <SelectTrigger className="h-9 text-xs">
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
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                      Profissional Responsável
                    </Label>
                    <Select value={selectedDentistaNome} onValueChange={setSelectedDentistaNome}>
                      <SelectTrigger className="h-9 text-xs">
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
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      Comarca / Cidade
                    </Label>
                    <input
                      type="text"
                      value={cidadeLocal}
                      onChange={(e) => setCidadeLocal(e.target.value)}
                      placeholder="São Paulo"
                      className="w-full h-9 px-3 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>

                {/* Alerta de Pendências Cadastrais do Paciente */}
                {pendenciasCadastrais.length > 0 && (
                  <Alert variant="default" className="bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200 py-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertDescription className="text-xs">
                      <strong>Aviso de Cadastro:</strong> Os seguintes campos não estão preenchidos na ficha do paciente: <em>{pendenciasCadastrais.join(', ')}</em>. No contrato eles constam como "Não informado".
                    </AlertDescription>
                  </Alert>
                )}

                {/* Status do Orçamento Selecionado */}
                {orcamentoAtual && (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-muted/40 rounded-md border border-border text-xs">
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
                        <strong>{formatMoney(orcamentoAtual.total)}</strong>
                      </span>
                      <span>
                        Procedimentos: <strong>{orcamentoAtual.itens?.length || 0}</strong>
                      </span>
                      {orcamentoAtual.formasPagamento && (
                        <span>
                          Pagamento:{' '}
                          <span className="font-semibold text-primary">{orcamentoAtual.formasPagamento}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => {
                          setSignerRole('paciente');
                          setIsSignatureModalOpen(true);
                        }}
                      >
                        <PenTool className="h-3 w-3 text-primary" />
                        {snapshotAtual?.assinaturaPaciente ? '✓ Assinado p/ Paciente' : 'Assinar Paciente'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => {
                          setSignerRole('dentista');
                          setIsSignatureModalOpen(true);
                        }}
                      >
                        <ShieldCheck className="h-3 w-3 text-emerald-600" />
                        {snapshotAtual?.assinaturaDentista ? '✓ Assinado p/ Dentista' : 'Assinar Profissional'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Pré-visualização do Documento (Document Canvas A4) */}
                <div className="bg-card rounded-lg border border-border shadow-md overflow-hidden">
                  <div className="bg-muted px-4 py-2 border-b border-border flex items-center justify-between text-xs text-muted-foreground font-medium">
                    <span>Pré-visualização do Contrato Oficial (Padrão A4)</span>
                    <span>Snapshot Imutável em Tempo Real</span>
                  </div>

                  <div className="p-4 sm:p-8 bg-neutral-100 dark:bg-neutral-900 max-h-[52vh] overflow-y-auto">
                    <div
                      className="bg-white text-black p-6 sm:p-10 shadow-lg mx-auto rounded-sm"
                      style={{ maxWidth: '780px', minHeight: '800px' }}
                      dangerouslySetInnerHTML={{ __html: htmlContratoAtual }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Aba de Histórico de Contratos Emitidos */}
            {activeTab === 'historico' && (
              <div className="space-y-4">
                {contratosEmitidos.length === 0 ? (
                  <div className="text-center py-12 bg-card rounded-lg border border-border">
                    <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                    <h3 className="font-semibold text-base">Nenhum contrato emitido ainda</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      Gere o primeiro contrato para este paciente a partir de um orçamento aprovado na aba "Gerar Contrato".
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {contratosEmitidos.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-4 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <h4 className="font-semibold text-sm">{doc.titulo}</h4>
                            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                              Imutável
                            </Badge>
                            {doc.assinaturaData && (
                              <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700">
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
                            className="h-8 text-xs gap-1.5"
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
                            className="h-8 text-xs gap-1.5"
                            onClick={() => handleDownloadPdf(doc.conteudo || '', `contrato_${patient?.nome}_${doc.id.slice(0, 8)}`)}
                          >
                            <Download className="h-3.5 w-3.5" />
                            PDF
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5"
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

                {/* Modal / Visualizador de Contrato do Histórico */}
                {contratoVisualizacao && (
                  <div className="mt-6 p-4 bg-card rounded-lg border border-border space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Cópia Fiel e Imutável Registrada: {contratoVisualizacao.titulo}
                      </h4>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setContratoVisualizacao(null)}
                      >
                        Fechar Visualização
                      </Button>
                    </div>
                    <div
                      className="bg-white text-black p-6 shadow-md max-h-[50vh] overflow-y-auto rounded"
                      dangerouslySetInnerHTML={{ __html: contratoVisualizacao.conteudo || '' }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rodapé de Ações */}
          <div className="p-3 sm:p-4 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Gera documento com amparo nas normas do CFO, CDC e Código Civil.</span>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
              <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-9">
                Fechar
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
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
                className="h-9 gap-1.5"
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
                className="h-9 gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                onClick={handleEnviarWhatsApp}
                disabled={!patient?.telefone || !snapshotAtual}
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </Button>

              <Button
                type="button"
                size="sm"
                className="h-9 gap-1.5 font-semibold"
                onClick={handleEmitirContrato}
                disabled={salvando || !snapshotAtual || !orcamentoAtual}
              >
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Emitir e Gravar Contrato
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
