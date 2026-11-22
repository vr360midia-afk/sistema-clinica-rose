import React, { useState } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  FileText,
  Copy,
  Check,
  Printer,
  User,
  Building,
  CreditCard,
  QrCode,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Receipt,
  Download,
  Loader2,
} from 'lucide-react';
import {
  DadosNotaFiscalPaciente,
  formatarCpf,
  gerarTextoDiscriminacaoNF,
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
}

export const ModalExportarNotaFiscalPaciente: React.FC<ModalExportarNotaFiscalPacienteProps> = ({
  open,
  onOpenChange,
  dados,
  configuracoes,
}) => {
  const [copiadoTexto, setCopiadoTexto] = useState(false);
  const [copiadoCpf, setCopiadoCpf] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);
  const [baixandoPdf, setBaixandoPdf] = useState(false);

  if (!dados) return null;

  const clinicaInfo = {
    nome: configuracoes?.nomeClinica || 'Clínica Odontológica',
    cnpj: configuracoes?.cnpj || '',
    cfo: configuracoes?.cfo || '',
  };

  const textoDiscriminacao = gerarTextoDiscriminacaoNF(dados, clinicaInfo);

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
    toast.success('CPF (apenas números) copiado!');
    setTimeout(() => setCopiadoCpf(false), 2000);
  };

  const handleImprimirOficial = async () => {
    setImprimindo(true);
    try {
      const html = gerarHtmlDeclaracaoFiscalPaciente(dados, configuracoes);
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
      toast.info('Gerando documento oficial em folha A4...');
      const html = gerarHtmlDeclaracaoFiscalPaciente(dados, configuracoes);
      const nomePacienteLimpo = (dados.pacienteNome || 'paciente').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const nomeArquivo = `declaracao_fiscal_${nomePacienteLimpo}_${dados.orcamentoId?.slice(0, 8) || 'doc'}`;
      const ok = await baixarDocumentoOficialPdf(html, nomeArquivo);
      if (ok) {
        toast.success('Documento fiscal oficial (PDF A4) baixado!');
      } else {
        toast.error('Falha ao gerar o PDF. Você também pode usar o botão "Imprimir Documento Oficial".');
      }
    } catch {
      toast.error('Erro ao gerar arquivo PDF.');
    } finally {
      setBaixandoPdf(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  Dados para Emissão de Nota Fiscal (NFS-e)
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Informações completas do paciente, discriminação dos procedimentos e valores para a contabilidade.
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
                Imprimir Documento
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Alerta de CPF ausente */}
          {!dados.possuiCpf && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                <strong>Atenção:</strong> Este paciente não possui CPF cadastrado. A maioria dos emissores de NFS-e municipais exige o CPF do tomador do serviço.
              </span>
            </div>
          )}

          {/* Dados do Tomador / Paciente */}
          <Card className="border bg-muted/20">
            <CardContent className="p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-primary" /> Tomador do Serviço (Paciente)
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

          {/* Dados do Tratamento & Procedimentos Realizados */}
          <Card className="border bg-muted/20">
            <CardContent className="p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                  <Receipt className="h-3.5 w-3.5 text-primary" /> Tratamento & Procedimentos
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
              rows={7}
              className="font-mono text-xs bg-muted/40 text-foreground resize-none select-all"
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <p className="text-[11px] text-muted-foreground">
              💡 Dica: Clique no botão acima para copiar e cole diretamente no campo <strong>"Discriminação dos Serviços"</strong> do emissor de notas da sua prefeitura.
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
