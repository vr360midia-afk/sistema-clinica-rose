import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  FileText,
  Copy,
  Check,
  Printer,
  User,
  Building2,
  Receipt,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';
import {
  DadosNotaFiscalPaciente,
  PagadorNotaFiscal,
  formatarCpf,
  formatarCnpjCpf,
  gerarTextoDiscriminacaoNF,
  carregarPagadorSalvo,
  salvarPagadorSalvo,
} from '@/utils/notaFiscalExport';
import {
  gerarHtmlDeclaracaoFiscalPaciente,
  imprimirDocumentoOficial,
  baixarDocumentoOficialPdf,
} from '@/utils/documentoFiscalOficial';
import { formatMoney } from '@/utils/exportCsv';
import { toast } from 'sonner';

interface ModalExportarNotaFiscalPacienteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dados: DadosNotaFiscalPaciente | null;
  configuracoes?: any;
  onPagadorAtualizado?: (pacienteId: string, pagador?: PagadorNotaFiscal) => void;
}

export const ModalExportarNotaFiscalPaciente: React.FC<ModalExportarNotaFiscalPacienteProps> = ({
  open,
  onOpenChange,
  dados,
  configuracoes,
  onPagadorAtualizado,
}) => {
  const [copiadoTexto, setCopiadoTexto] = useState(false);
  const [copiadoCpf, setCopiadoCpf] = useState(false);
  const [copiadoDocPagador, setCopiadoDocPagador] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);
  const [baixandoPdf, setBaixandoPdf] = useState(false);

  // Estados de Pagador / Tomador diferente (Empresa CNPJ ou Terceiro)
  const [pagadorDiferente, setPagadorDiferente] = useState<boolean>(false);
  const [pagadorTipo, setPagadorTipo] = useState<'cnpj' | 'cpf'>('cnpj');
  const [pagadorNome, setPagadorNome] = useState<string>('');
  const [pagadorDocumento, setPagadorDocumento] = useState<string>('');
  const [pagadorEndereco, setPagadorEndereco] = useState<string>('');
  const [pagadorTelefone, setPagadorTelefone] = useState<string>('');

  // Carrega configurações pré-existentes ou salvas no localStorage
  useEffect(() => {
    if (!dados) return;
    const salvo = dados.pagador || carregarPagadorSalvo(dados.pacienteId);
    if (salvo && salvo.diferenteDoPaciente) {
      setPagadorDiferente(true);
      setPagadorTipo(salvo.tipo || 'cnpj');
      setPagadorNome(salvo.nomeRazaoSocial || '');
      setPagadorDocumento(salvo.documento || '');
      setPagadorEndereco(salvo.endereco || '');
      setPagadorTelefone(salvo.telefone || '');
    } else {
      setPagadorDiferente(false);
      setPagadorTipo('cnpj');
      setPagadorNome('');
      setPagadorDocumento('');
      setPagadorEndereco('');
      setPagadorTelefone('');
    }
  }, [dados?.pacienteId, dados?.pagador]);

  // Persiste alterações do pagador
  const sincronizarPagador = (
    diferente: boolean,
    tipo: 'cnpj' | 'cpf',
    nome: string,
    doc: string,
    end: string,
    tel: string
  ) => {
    if (!dados) return;
    const pagadorObj: PagadorNotaFiscal = {
      diferenteDoPaciente: diferente,
      tipo,
      nomeRazaoSocial: nome,
      documento: doc,
      endereco: end,
      telefone: tel,
    };
    salvarPagadorSalvo(dados.pacienteId, pagadorObj);
    if (onPagadorAtualizado) {
      onPagadorAtualizado(dados.pacienteId, diferente ? pagadorObj : undefined);
    }
  };

  // Objeto consolidado para cálculos e exportação
  const dadosCompletos: DadosNotaFiscalPaciente | null = useMemo(() => {
    if (!dados) return null;
    const pagadorObj: PagadorNotaFiscal | undefined =
      pagadorDiferente && pagadorNome.trim()
        ? {
            diferenteDoPaciente: true,
            tipo: pagadorTipo,
            nomeRazaoSocial: pagadorNome.trim(),
            documento: pagadorDocumento.trim(),
            endereco: pagadorEndereco.trim(),
            telefone: pagadorTelefone.trim(),
          }
        : undefined;

    return {
      ...dados,
      pagador: pagadorObj,
    };
  }, [
    dados,
    pagadorDiferente,
    pagadorTipo,
    pagadorNome,
    pagadorDocumento,
    pagadorEndereco,
    pagadorTelefone,
  ]);

  if (!dados || !dadosCompletos) return null;

  const clinicaInfo = {
    nome: configuracoes?.nomeClinica || 'Clínica Odontológica',
    cnpj: configuracoes?.cnpj || '',
    cfo: configuracoes?.cfo || '',
  };

  const textoDiscriminacao = gerarTextoDiscriminacaoNF(dadosCompletos, clinicaInfo);

  const handleCopiarTexto = () => {
    navigator.clipboard.writeText(textoDiscriminacao);
    setCopiadoTexto(true);
    toast.success('Texto de discriminação da NFS-e copiado com sucesso!');
    setTimeout(() => setCopiadoTexto(false), 2000);
  };

  const handleCopiarCpf = () => {
    if (!dados.cpf) return;
    navigator.clipboard.writeText(dados.cpf.replace(/\D/g, ''));
    setCopiadoCpf(true);
    toast.success('CPF do paciente (apenas números) copiado!');
    setTimeout(() => setCopiadoCpf(false), 2000);
  };

  const handleCopiarDocPagador = () => {
    if (!pagadorDocumento) return;
    navigator.clipboard.writeText(pagadorDocumento.replace(/\D/g, ''));
    setCopiadoDocPagador(true);
    toast.success(`${pagadorTipo === 'cnpj' ? 'CNPJ' : 'CPF'} do pagador copiado!`);
    setTimeout(() => setCopiadoDocPagador(false), 2000);
  };

  const handleImprimirOficial = async () => {
    setImprimindo(true);
    try {
      const html = gerarHtmlDeclaracaoFiscalPaciente(dadosCompletos, configuracoes);
      await imprimirDocumentoOficial(html);
    } catch {
      toast.error('Erro ao preparar impressão do documento oficial.');
    } finally {
      setImprimindo(false);
    }
  };

  const handleBaixarPdfOficial = async () => {
    setBaixandoPdf(true);
    try {
      toast.info('Gerando declaração fiscal oficial em folha A4...');
      const html = gerarHtmlDeclaracaoFiscalPaciente(dadosCompletos, configuracoes);
      const nomePacienteLimpo = (dados.pacienteNome || 'paciente').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const nomeArquivo = `declaracao_fiscal_${nomePacienteLimpo}_${dados.orcamentoId?.slice(0, 8) || 'doc'}`;
      const ok = await baixarDocumentoOficialPdf(html, nomeArquivo);
      if (ok) {
        toast.success('Declaração fiscal oficial (PDF A4) baixada!');
      } else {
        toast.error('Falha ao gerar o PDF. Você também pode usar a opção Imprimir.');
      }
    } catch {
      toast.error('Erro ao gerar arquivo PDF.');
    } finally {
      setBaixandoPdf(false);
    }
  };

  const temPagadorAtivo = Boolean(pagadorDiferente && pagadorNome.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  Emissão de Nota Fiscal (NFS-e) & Declaração
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Discriminação com suporte a <strong>Pagador (Empresa/CNPJ)</strong> e <strong>Favorecido (Paciente)</strong>.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBaixarPdfOficial}
                disabled={baixandoPdf}
                className="text-xs gap-1.5 h-8 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 font-medium"
                title="Baixar Declaração Fiscal Oficial em arquivo PDF (folha A4 timbrada com assinaturas)"
              >
                {baixandoPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-emerald-600" />}
                Baixar PDF A4
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleImprimirOficial}
                disabled={imprimindo}
                className="text-xs gap-1.5 h-8 font-medium"
                title="Imprimir documento oficial em folha A4 limpa (sem elementos do sistema)"
              >
                {imprimindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                Imprimir A4
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Alerta de CPF ausente (quando não há pagador PJ) */}
          {!dados.possuiCpf && !temPagadorAtivo && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                <strong>Atenção:</strong> Este paciente não possui CPF cadastrado. A maioria das prefeituras exige o CPF ou CNPJ do tomador na NFS-e.
              </span>
            </div>
          )}

          {/* PAINEL DE CONTROLE: PAGADOR DA NOTA (EMPRESA CNPJ OU TERCEIRO) */}
          <div className="p-3.5 rounded-xl border bg-muted/30 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">
                    Pagamento realizado por Empresa (CNPJ) ou Terceiro?
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Marque caso a nota fiscal deva ser faturada no CNPJ de uma empresa, mantendo o paciente como favorecido.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-medium text-foreground">
                  {pagadorDiferente ? (
                    <span className="text-primary font-bold">Sim (Empresa / Terceiro)</span>
                  ) : (
                    <span className="text-muted-foreground">Não (Próprio Paciente)</span>
                  )}
                </span>
                <Switch
                  checked={pagadorDiferente}
                  onCheckedChange={(checked) => {
                    setPagadorDiferente(checked);
                    sincronizarPagador(
                      checked,
                      pagadorTipo,
                      pagadorNome,
                      pagadorDocumento,
                      pagadorEndereco,
                      pagadorTelefone
                    );
                    if (checked) {
                      toast.info('Informe os dados da Empresa ou Terceiro pagador abaixo.');
                    } else {
                      toast.success('Nota fiscal configurada para o próprio paciente.');
                    }
                  }}
                />
              </div>
            </div>

            {/* FORMULÁRIO DE DADOS DO PAGADOR (QUANDO ATIVO) */}
            {pagadorDiferente && (
              <div className="pt-3 border-t border-border/60 space-y-3 bg-background/80 p-3 rounded-lg border">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" /> Dados do Pagador (Tomador da NFS-e)
                  </span>

                  {/* Seletor CNPJ ou CPF */}
                  <div className="flex items-center bg-muted p-0.5 rounded-md text-[11px] self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setPagadorTipo('cnpj');
                        sincronizarPagador(
                          true,
                          'cnpj',
                          pagadorNome,
                          pagadorDocumento,
                          pagadorEndereco,
                          pagadorTelefone
                        );
                      }}
                      className={`px-2.5 py-1 rounded transition-colors font-semibold ${
                        pagadorTipo === 'cnpj'
                          ? 'bg-background text-primary shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      🏢 Pessoa Jurídica (CNPJ)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPagadorTipo('cpf');
                        sincronizarPagador(
                          true,
                          'cpf',
                          pagadorNome,
                          pagadorDocumento,
                          pagadorEndereco,
                          pagadorTelefone
                        );
                      }}
                      className={`px-2.5 py-1 rounded transition-colors font-semibold ${
                        pagadorTipo === 'cpf'
                          ? 'bg-background text-primary shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      👤 Terceiro (CPF)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      {pagadorTipo === 'cnpj' ? 'Razão Social / Nome da Empresa *' : 'Nome Completo do Pagador *'}
                    </label>
                    <Input
                      value={pagadorNome}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPagadorNome(val);
                        sincronizarPagador(
                          true,
                          pagadorTipo,
                          val,
                          pagadorDocumento,
                          pagadorEndereco,
                          pagadorTelefone
                        );
                      }}
                      placeholder={pagadorTipo === 'cnpj' ? 'Ex: Tech Soluções Odontológicas Ltda' : 'Ex: Carlos Alberto da Silva'}
                      className="h-8 text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      {pagadorTipo === 'cnpj' ? 'CNPJ da Empresa *' : 'CPF do Pagador *'}
                    </label>
                    <Input
                      value={pagadorDocumento}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPagadorDocumento(val);
                        sincronizarPagador(
                          true,
                          pagadorTipo,
                          pagadorNome,
                          val,
                          pagadorEndereco,
                          pagadorTelefone
                        );
                      }}
                      placeholder={pagadorTipo === 'cnpj' ? '00.000.000/0001-00' : '000.000.000-00'}
                      className="h-8 text-xs font-mono font-semibold"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Endereço Fiscal do Pagador (Logradouro, Nº, Bairro, Cidade/UF)
                    </label>
                    <Input
                      value={pagadorEndereco}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPagadorEndereco(val);
                        sincronizarPagador(
                          true,
                          pagadorTipo,
                          pagadorNome,
                          pagadorDocumento,
                          val,
                          pagadorTelefone
                        );
                      }}
                      placeholder="Ex: Av. Paulista, 1000, Sala 42 - Bela Vista, São Paulo/SP"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                  <span>
                    ✓ Salvo automaticamente para este paciente em futuras notas e relatórios.
                  </span>
                  {pagadorDocumento && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCopiarDocPagador}
                      className="h-6 text-[10px] gap-1 px-2 text-primary"
                    >
                      {copiadoDocPagador ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      Copiar {pagadorTipo.toUpperCase()}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* CARDS VISUAIS DE IDENTIFICAÇÃO FISCAL */}
          {temPagadorAtivo ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* CARD 1: PAGADOR (EMPRESA OU RESPONSÁVEL) */}
              <Card className="border border-blue-500/40 bg-blue-500/5">
                <CardContent className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" /> 1. Pagador (NFS-e)
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 border-blue-500/30">
                      {pagadorTipo === 'cnpj' ? 'Empresa / PJ' : 'Terceiro / PF'}
                    </Badge>
                  </div>

                  <div>
                    <span className="text-muted-foreground block text-[10px]">Razão Social / Nome:</span>
                    <span className="font-bold text-foreground text-xs leading-tight block">
                      {pagadorNome}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground block text-[10px]">
                      {pagadorTipo === 'cnpj' ? 'CNPJ:' : 'CPF:'}
                    </span>
                    <span className="font-mono font-bold text-foreground text-xs">
                      {formatarCnpjCpf(pagadorDocumento) || 'Não informado'}
                    </span>
                  </div>

                  {pagadorEndereco && (
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Endereço Fiscal:</span>
                      <span className="text-[11px] text-foreground line-clamp-2">{pagadorEndereco}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* CARD 2: FAVORECIDO / BENEFICIÁRIO (PACIENTE) */}
              <Card className="border border-emerald-500/40 bg-emerald-500/5">
                <CardContent className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" /> 2. Favorecido (Paciente)
                    </span>
                    {dados.possuiCpf ? (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                        CPF Válido
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                        Sem CPF
                      </Badge>
                    )}
                  </div>

                  <div>
                    <span className="text-muted-foreground block text-[10px]">Nome do Paciente:</span>
                    <span className="font-bold text-foreground text-xs leading-tight block">
                      {dados.pacienteNome}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground block text-[10px]">CPF do Paciente:</span>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-foreground text-xs">
                      <span>{dados.cpf ? formatarCpf(dados.cpf) : 'Não informado'}</span>
                      {dados.cpf && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={handleCopiarCpf}
                          className="h-4 w-4 text-muted-foreground hover:text-foreground"
                          title="Copiar apenas números do CPF"
                        >
                          {copiadoCpf ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      )}
                    </div>
                  </div>

                  {dados.endereco && (
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Endereço:</span>
                      <span className="text-[11px] text-foreground line-clamp-2">{dados.endereco}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            /* CARD PADRÃO: TOMADOR E BENEFICIÁRIO (PRÓPRIO PACIENTE) */
            <Card className="border bg-muted/20">
              <CardContent className="p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-primary" /> Tomador e Beneficiário (Paciente)
                  </span>
                  {dados.possuiCpf ? (
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> CPF Válido
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                      Sem CPF
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Nome Completo:</span>
                    <span className="font-bold text-foreground text-sm">{dados.pacienteNome}</span>
                  </div>

                  <div>
                    <span className="text-muted-foreground block text-[11px]">CPF:</span>
                    <div className="flex items-center gap-1.5 font-mono font-semibold text-foreground">
                      <span>{dados.cpf ? formatarCpf(dados.cpf) : 'Não informado'}</span>
                      {dados.cpf && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={handleCopiarCpf}
                          className="h-5 w-5 text-muted-foreground hover:text-foreground"
                          title="Copiar apenas números do CPF"
                        >
                          {copiadoCpf ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      )}
                    </div>
                  </div>

                  {dados.endereco && (
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground block text-[11px]">Endereço:</span>
                      <span className="text-foreground">{dados.endereco}</span>
                    </div>
                  )}

                  {dados.telefone && (
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Telefone:</span>
                      <span className="text-foreground">{dados.telefone}</span>
                    </div>
                  )}

                  {dados.email && (
                    <div>
                      <span className="text-muted-foreground block text-[11px]">E-mail:</span>
                      <span className="text-foreground">{dados.email}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dados do Tratamento & Procedimentos Realizados */}
          <Card className="border bg-muted/20">
            <CardContent className="p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                  <Receipt className="h-3.5 w-3.5 text-primary" /> Tratamento & Procedimentos Odontológicos
                </span>
                {dados.orcamentoId && (
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Ref: #{dados.orcamentoId.slice(0, 8).toUpperCase()}
                  </span>
                )}
              </div>

              <div>
                <p className="font-bold text-foreground text-sm">{dados.tratamentoDescricao}</p>
              </div>

              {dados.procedimentos.length > 0 && (
                <div className="border rounded-md bg-background overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="py-1.5 px-2.5 text-left font-semibold text-muted-foreground">Procedimento</th>
                        <th className="py-1.5 px-2 text-center font-semibold text-muted-foreground w-14">Qtd</th>
                        <th className="py-1.5 px-2.5 text-right font-semibold text-muted-foreground w-24">Valor Unit.</th>
                        <th className="py-1.5 px-2.5 text-right font-semibold text-muted-foreground w-24">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {dados.procedimentos.map((proc, idx) => (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="py-1.5 px-2.5 text-foreground">{proc.nome}</td>
                          <td className="py-1.5 px-2 text-center text-muted-foreground">{proc.quantidade || 1}</td>
                          <td className="py-1.5 px-2.5 text-right text-muted-foreground">{formatMoney(proc.valorUnitario)}</td>
                          <td className="py-1.5 px-2.5 text-right font-medium text-foreground">{formatMoney(proc.valorTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resumo Financeiro & Valores Tributáveis */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-3 bg-muted/30 border rounded-lg">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Valor Recebido (Mês)</span>
              <span className="text-base font-black text-emerald-600 block">{formatMoney(dados.valorRecebidoNoMes)}</span>
              <span className="text-[10px] text-muted-foreground">Base cálculo NFS-e</span>
            </div>

            <div className="p-3 bg-muted/30 border rounded-lg">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Total Contratado</span>
              <span className="text-base font-bold text-foreground block">{formatMoney(dados.valorTotalTratamento)}</span>
              <span className="text-[10px] text-muted-foreground">Valor do plano</span>
            </div>

            <div className="p-3 bg-muted/30 border rounded-lg">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Total Quitado</span>
              <span className="text-base font-bold text-foreground block">{formatMoney(dados.valorTotalPagoHistorico)}</span>
              <span className="text-[10px] text-muted-foreground">Histórico total</span>
            </div>

            <div className="p-3 bg-muted/30 border rounded-lg">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Saldo Futuro</span>
              <span className="text-base font-bold text-muted-foreground block">{formatMoney(dados.saldoRestante)}</span>
              <span className="text-[10px] text-muted-foreground">A receber</span>
            </div>
          </div>

          {/* Formas de Pagamento e Contas */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground p-2.5 bg-muted/20 border rounded-lg">
            <span><strong>Forma(s) de Pagamento:</strong> {dados.metodosPagamento.join(', ') || 'PIX'}</span>
            <span>·</span>
            <span><strong>Conta(s) de Entrada:</strong> {dados.contasEntrada.join(', ') || 'Caixa'}</span>
            {dados.datasPagamentoMes.length > 0 && (
              <>
                <span>·</span>
                <span><strong>Data(s):</strong> {dados.datasPagamentoMes.join(', ')}</span>
              </>
            )}
          </div>

          {/* Texto de Discriminação de Serviços para colar na NFS-e */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Copy className="h-3.5 w-3.5 text-primary" />
                Texto Formatado para o Emissor de Nota Fiscal (Prefeitura / NFS-e)
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopiarTexto}
                className="h-7 text-xs font-semibold text-primary border-primary/30 hover:bg-primary/10 gap-1.5"
              >
                {copiadoTexto ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copiadoTexto ? 'Copiado!' : 'Copiar Texto da NFS-e'}
              </Button>
            </div>
            <Textarea
              readOnly
              value={textoDiscriminacao}
              rows={8}
              className="font-mono text-xs bg-muted/40 text-foreground resize-none select-all"
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <p className="text-[11px] text-muted-foreground">
              💡 Dica: Cole diretamente no campo <strong>"Discriminação dos Serviços"</strong> do emissor de notas da sua prefeitura. O texto já discrimina o Tomador/Pagador e o Favorecido/Beneficiário.
            </p>
          </div>
        </div>

        <DialogFooter className="border-t pt-3 flex flex-col sm:flex-row items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Fechar
          </Button>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBaixarPdfOficial}
              disabled={baixandoPdf}
              className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 text-xs font-semibold gap-1.5"
            >
              {baixandoPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-emerald-600" />}
              Baixar PDF Oficial
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleImprimirOficial}
              disabled={imprimindo}
              className="text-xs font-semibold gap-1.5"
            >
              {imprimindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
              Imprimir A4
            </Button>

            <Button
              type="button"
              onClick={handleCopiarTexto}
              className="bg-primary text-primary-foreground font-semibold text-xs gap-1.5 shadow-sm"
            >
              {copiadoTexto ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              Copiar Dados da NF
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
