import React, { useState, useMemo } from 'react';
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
import {
  FileText,
  FileSpreadsheet,
  Printer,
  Copy,
  Check,
  Search,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  User,
  Users,
  Building2,
  ArrowUpRight,
  Eye,
  Receipt,
  Download,
  Loader2,
} from 'lucide-react';
import {
  gerarDadosNotaFiscalMes,
  exportarPlanilhaNotaFiscalCSV,
  DadosNotaFiscalPaciente,
  formatarCpf,
  gerarTextoDiscriminacaoNF,
} from '@/utils/notaFiscalExport';
import {
  gerarHtmlRelatorioFiscalMensal,
  imprimirDocumentoOficial,
  baixarDocumentoOficialPdf,
} from '@/utils/documentoFiscalOficial';
import { formatMoney } from '@/utils/exportCsv';
import { ModalExportarNotaFiscalPaciente } from './ModalExportarNotaFiscalPaciente';
import { Transacao, Paciente } from '@/types/shared';
import { Orcamento } from '@/hooks/useOrcamentos';
import { toast } from 'sonner';

interface ModalExportarNotaFiscalMensalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMonth: string;
  transacoes: Transacao[];
  orcamentos: Orcamento[];
  pacientes: Paciente[];
  configuracoes?: any;
}

export const ModalExportarNotaFiscalMensal: React.FC<ModalExportarNotaFiscalMensalProps> = ({
  open,
  onOpenChange,
  selectedMonth,
  transacoes,
  orcamentos,
  pacientes,
  configuracoes,
}) => {
  const [busca, setBusca] = useState('');
  const [filtroCpf, setFiltroCpf] = useState<'todos' | 'com_cpf' | 'sem_cpf' | 'empresa_pj'>('todos');
  const [pacienteSelecionadoNF, setPacienteSelecionadoNF] = useState<DadosNotaFiscalPaciente | null>(null);
  const [modalPacienteOpen, setModalPacienteOpen] = useState(false);
  const [copiadoLote, setCopiadoLote] = useState(false);
  const [imprimindoMensal, setImprimindoMensal] = useState(false);
  const [baixandoPdfMensal, setBaixandoPdfMensal] = useState(false);
  const [versaoPagadores, setVersaoPagadores] = useState(0);

  // Agregação dos dados fiscais do mês
  const resumoMes = useMemo(() => {
    return gerarDadosNotaFiscalMes({
      transacoes,
      orcamentos,
      pacientes,
      selectedMonth,
    });
  }, [transacoes, orcamentos, pacientes, selectedMonth, versaoPagadores]);

  // Filtragem na tabela
  const itensFiltrados = useMemo(() => {
    return resumoMes.itens.filter((item) => {
      if (filtroCpf === 'com_cpf' && !item.possuiCpf) return false;
      if (filtroCpf === 'sem_cpf' && item.possuiCpf) return false;
      if (filtroCpf === 'empresa_pj' && (!item.pagador?.diferenteDoPaciente || !item.pagador.nomeRazaoSocial)) return false;

      if (busca.trim()) {
        const query = busca.toLowerCase();
        const nomeMatch = item.pacienteNome.toLowerCase().includes(query);
        const cpfMatch = (item.cpf || '').includes(query);
        const tratMatch = item.tratamentoDescricao.toLowerCase().includes(query);
        const procMatch = item.procedimentos.some((p) => p.nome.toLowerCase().includes(query));
        const pagadorMatch = item.pagador?.nomeRazaoSocial?.toLowerCase().includes(query) || (item.pagador?.documento || '').includes(query);
        return nomeMatch || cpfMatch || tratMatch || procMatch || Boolean(pagadorMatch);
      }

      return true;
    });
  }, [resumoMes.itens, busca, filtroCpf]);

  const handleExportarExcel = () => {
    const nomeArquivo = `fechamento_nota_fiscal_${selectedMonth.replace('-', '_')}.csv`;
    exportarPlanilhaNotaFiscalCSV(resumoMes.itens, nomeArquivo);
    toast.success(`Planilha "${nomeArquivo}" exportada com sucesso!`);
  };

  const handleCopiarLoteContador = () => {
    if (resumoMes.itens.length === 0) {
      toast.error('Nenhum recebimento registrado neste mês.');
      return;
    }

    const linhas = resumoMes.itens.map((item, idx) => {
      const procs = item.procedimentos.map((p) => `${p.nome} (Qtd: ${p.quantidade})`).join(', ');
      return `${idx + 1}. Paciente: ${item.pacienteNome}
   CPF: ${item.cpf ? formatarCpf(item.cpf) : 'SEM CPF CADASTRADO'}
   Tratamento: ${item.tratamentoDescricao} [${procs || 'Procedimentos clínicos'}]
   Valor Recebido no Mês: ${formatMoney(item.valorRecebidoNoMes)} (Total Contrato: ${formatMoney(item.valorTotalTratamento)})
   Forma: ${item.metodosPagamento.join(', ') || 'PIX'} | Data(s): ${item.datasPagamentoMes.join(', ')}`;
    });

    const textoCompleto = `RESUMO PARA EMISSÃO DE NOTAS FISCAIS (NFS-e) - COMPETÊNCIA ${resumoMes.mesFormatado.toUpperCase()}
Total de Receitas Faturadas: ${formatMoney(resumoMes.totalRecebidoMes)}
Total de Pacientes: ${resumoMes.totalPacientes} (Com CPF: ${resumoMes.totalComCpf} | Sem CPF: ${resumoMes.totalSemCpf})
----------------------------------------------------------------------
${linhas.join('\n\n')}
----------------------------------------------------------------------
Relatório gerado em ${new Date().toLocaleDateString('pt-BR')}`;

    navigator.clipboard.writeText(textoCompleto);
    setCopiadoLote(true);
    toast.success('Resumo do mês copiado! Cole no WhatsApp ou e-mail do seu contador.');
    setTimeout(() => setCopiadoLote(false), 2500);
  };

  const handleCopiarItemNf = (item: DadosNotaFiscalPaciente) => {
    const texto = gerarTextoDiscriminacaoNF(item);
    navigator.clipboard.writeText(texto);
    toast.success(`Texto da NFS-e de ${item.pacienteNome} copiado!`);
  };

  const handleAbrirItemDetalhe = (item: DadosNotaFiscalPaciente) => {
    setPacienteSelecionadoNF(item);
    setModalPacienteOpen(true);
  };

  const handleImprimirRelatorioOficial = async () => {
    setImprimindoMensal(true);
    try {
      const html = gerarHtmlRelatorioFiscalMensal(resumoMes, configuracoes);
      await imprimirDocumentoOficial(html);
    } catch {
      toast.error('Erro ao preparar impressão oficial.');
    } finally {
      setImprimindoMensal(false);
    }
  };

  const handleBaixarPdfRelatorioOficial = async () => {
    setBaixandoPdfMensal(true);
    try {
      toast.info('Gerando demonstrativo contábil em folha A4...');
      const html = gerarHtmlRelatorioFiscalMensal(resumoMes, configuracoes);
      const nomeArquivo = `demonstrativo_fiscal_${selectedMonth.replace('-', '_')}`;
      const ok = await baixarDocumentoOficialPdf(html, nomeArquivo);
      if (ok) {
        toast.success('Demonstrativo fiscal oficial (PDF A4) baixado!');
      } else {
        toast.error('Falha ao gerar PDF. Você pode usar a opção de Imprimir.');
      }
    } catch {
      toast.error('Erro ao gerar arquivo PDF.');
    } finally {
      setBaixandoPdfMensal(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-6">
          <DialogHeader className="border-b pb-3 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    Exportação para Nota Fiscal & Contabilidade
                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                      {resumoMes.mesFormatado}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Relação de pacientes com recebimentos no mês, valores faturados, CPF e discriminação dos tratamentos para emissão de NFS-e.
                  </DialogDescription>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleBaixarPdfRelatorioOficial}
                  disabled={baixandoPdfMensal}
                  className="h-8 text-xs font-semibold gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                  title="Baixar Relatório Fiscal Oficial em arquivo PDF (folha A4 timbrada)"
                >
                  {baixandoPdfMensal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-emerald-600" />}
                  Baixar PDF A4
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleImprimirRelatorioOficial}
                  disabled={imprimindoMensal}
                  className="h-8 text-xs font-semibold gap-1.5"
                  title="Imprimir relatório fiscal oficial em folha A4 limpa (sem elementos do sistema)"
                >
                  {imprimindoMensal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                  Imprimir A4
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExportarExcel}
                  className="h-8 text-xs font-semibold gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                  title="Exportar planilha Excel (CSV UTF-8 com BOM) para a contabilidade"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
                  Excel (CSV)
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleCopiarLoteContador}
                  className="h-8 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground shadow-sm"
                  title="Copiar lista consolidada para enviar ao contador"
                >
                  {copiadoLote ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiadoLote ? 'Copiado!' : 'Copiar p/ Contador'}
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Cards Resumo de Indicadores */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 shrink-0">
            <div className="p-3 bg-muted/20 border rounded-xl space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> Faturamento Base NFS-e
              </span>
              <p className="text-xl font-black text-emerald-600">
                {formatMoney(resumoMes.totalRecebidoMes)}
              </p>
              <p className="text-[10px] text-muted-foreground">Quitado no mês no caixa</p>
            </div>

            <div className="p-3 bg-muted/20 border rounded-xl space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-primary" /> Pacientes no Mês
              </span>
              <p className="text-xl font-black text-foreground">
                {resumoMes.totalPacientes}
              </p>
              <p className="text-[10px] text-muted-foreground">Com entradas financeiras</p>
            </div>

            <div className="p-3 bg-muted/20 border rounded-xl space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Com CPF Cadastrado
              </span>
              <p className="text-xl font-black text-emerald-600">
                {resumoMes.totalComCpf}
              </p>
              <p className="text-[10px] text-muted-foreground">Prontos para emitir nota</p>
            </div>

            <div
              className={`p-3 border rounded-xl space-y-0.5 ${
                resumoMes.totalSemCpf > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-muted/20'
              }`}
            >
              <span className="text-[10px] uppercase font-bold text-amber-600 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600" /> Sem CPF Cadastrado
              </span>
              <p className={`text-xl font-black ${resumoMes.totalSemCpf > 0 ? 'text-amber-600' : 'text-foreground'}`}>
                {resumoMes.totalSemCpf}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {resumoMes.totalSemCpf > 0 ? 'Requer atenção p/ nota' : 'Nenhum pendente'}
              </p>
            </div>

            {resumoMes.totalComPagadorEmpresa > 0 && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-0.5 col-span-2 sm:col-span-4 lg:col-span-1">
                <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-blue-600" /> Tomador Empresa (PJ)
                </span>
                <p className="text-xl font-black text-blue-600 dark:text-blue-400">
                  {resumoMes.totalComPagadorEmpresa}
                </p>
                <p className="text-[10px] text-muted-foreground">Faturamento no CNPJ</p>
              </div>
            )}
          </div>

          {/* Filtros e Busca */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pb-2 shrink-0">
            <div className="relative w-full sm:w-72">
              <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por paciente, empresa ou procedimento..."
                className="h-8 pl-8 text-xs"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto flex-wrap">
              <Button
                variant={filtroCpf === 'todos' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltroCpf('todos')}
                className="h-7 text-xs px-2.5"
              >
                Todos ({resumoMes.totalPacientes})
              </Button>
              <Button
                variant={filtroCpf === 'com_cpf' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltroCpf('com_cpf')}
                className="h-7 text-xs px-2.5"
              >
                Com CPF ({resumoMes.totalComCpf})
              </Button>
              {resumoMes.totalComPagadorEmpresa > 0 && (
                <Button
                  variant={filtroCpf === 'empresa_pj' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFiltroCpf('empresa_pj')}
                  className="h-7 text-xs px-2.5 gap-1 border-blue-500/40 text-blue-700 dark:text-blue-300 font-semibold"
                >
                  <Building2 className="h-3 w-3" />
                  Empresa / PJ ({resumoMes.totalComPagadorEmpresa})
                </Button>
              )}
              {resumoMes.totalSemCpf > 0 && (
                <Button
                  variant={filtroCpf === 'sem_cpf' ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => setFiltroCpf('sem_cpf')}
                  className="h-7 text-xs px-2.5 gap-1 border-amber-500/40 text-amber-700 dark:text-amber-300"
                >
                  <AlertCircle className="h-3 w-3" />
                  Sem CPF ({resumoMes.totalSemCpf})
                </Button>
              )}
            </div>
          </div>

          {/* Tabela de Pacientes e Tratamentos */}
          <div className="border rounded-xl overflow-y-auto flex-1 bg-card">
            {itensFiltrados.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs">
                Nenhum lançamento encontrado para os filtros selecionados.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-muted/60 border-b sticky top-0 z-10 backdrop-blur-xs">
                  <tr>
                    <th className="py-2 px-3 text-left font-semibold text-muted-foreground">Paciente & CPF</th>
                    <th className="py-2 px-3 text-left font-semibold text-muted-foreground">Tratamento / Procedimentos</th>
                    <th className="py-2 px-3 text-right font-semibold text-muted-foreground">Recebido no Mês</th>
                    <th className="py-2 px-3 text-right font-semibold text-muted-foreground hidden sm:table-cell">Total Tratamento</th>
                    <th className="py-2 px-3 text-center font-semibold text-muted-foreground hidden md:table-cell">Forma / Conta</th>
                    <th className="py-2 px-3 text-right font-semibold text-muted-foreground w-28">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {itensFiltrados.map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                      {/* Paciente e CPF */}
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-foreground text-sm leading-tight">{item.pacienteNome}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {item.possuiCpf ? (
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {formatarCpf(item.cpf)}
                            </span>
                          ) : (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/30 font-semibold">
                              ⚠️ Sem CPF
                            </Badge>
                          )}
                          {item.pagador?.diferenteDoPaciente && item.pagador.nomeRazaoSocial && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 font-semibold flex items-center gap-0.5"
                              title={`Tomador da NFS-e: ${item.pagador.nomeRazaoSocial}`}
                            >
                              <Building2 className="h-2.5 w-2.5" /> PJ: {item.pagador.nomeRazaoSocial.slice(0, 16)}...
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Tratamento / Procedimentos */}
                      <td className="py-2.5 px-3 max-w-xs">
                        <p className="font-medium text-foreground truncate" title={item.tratamentoDescricao}>
                          {item.tratamentoDescricao}
                        </p>
                        {item.procedimentos.length > 0 && (
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5" title={item.procedimentos.map((p) => p.nome).join(', ')}>
                            {item.procedimentos.map((p) => `${p.nome} (${p.quantidade}x)`).join(' · ')}
                          </p>
                        )}
                      </td>

                      {/* Valor Recebido no Mês (Base NFS-e) */}
                      <td className="py-2.5 px-3 text-right">
                        <span className="font-black text-emerald-600 text-sm block">
                          {formatMoney(item.valorRecebidoNoMes)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {item.datasPagamentoMes.length > 1
                            ? `${item.datasPagamentoMes.length} pagtos`
                            : item.datasPagamentoMes[0] || 'No mês'}
                        </span>
                      </td>

                      {/* Valor Total Contratado */}
                      <td className="py-2.5 px-3 text-right hidden sm:table-cell">
                        <span className="font-medium text-foreground">
                          {formatMoney(item.valorTotalTratamento)}
                        </span>
                        {item.saldoRestante > 0 && (
                          <span className="block text-[10px] text-muted-foreground">
                            Resta: {formatMoney(item.saldoRestante)}
                          </span>
                        )}
                      </td>

                      {/* Forma de Pagamento e Conta */}
                      <td className="py-2.5 px-3 text-center hidden md:table-cell">
                        <Badge variant="secondary" className="text-[10px]">
                          {item.metodosPagamento.join(', ') || 'PIX'}
                        </Badge>
                        {item.contasEntrada.length > 0 && (
                          <span className="block text-[10px] text-muted-foreground mt-0.5 truncate max-w-[120px] mx-auto">
                            {item.contasEntrada.join(', ')}
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopiarItemNf(item)}
                            className="h-7 px-2 text-[11px] gap-1 text-primary hover:bg-primary/10"
                            title="Copiar texto pronto para a NFS-e"
                          >
                            <Copy className="h-3 w-3" />
                            <span className="hidden lg:inline">NFS-e</span>
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleAbrirItemDetalhe(item)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            title="Ver detalhes completos do paciente e tratamento"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <DialogFooter className="border-t pt-3 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">
              Total exibido: <strong>{itensFiltrados.length}</strong> paciente(s) · Faturamento:{' '}
              <strong className="text-emerald-600">
                {formatMoney(itensFiltrados.reduce((acc, i) => acc + i.valorRecebidoNoMes, 0))}
              </strong>
            </span>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                Fechar
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleBaixarPdfRelatorioOficial}
                disabled={baixandoPdfMensal}
                className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 text-xs font-semibold gap-1.5"
              >
                {baixandoPdfMensal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-emerald-600" />}
                Baixar PDF A4
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleImprimirRelatorioOficial}
                disabled={imprimindoMensal}
                className="text-xs font-semibold gap-1.5"
              >
                {imprimindoMensal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                Imprimir A4
              </Button>

              <Button
                type="button"
                onClick={handleExportarExcel}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 shadow-sm"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Baixar Planilha (Excel / CSV)
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Individual do Paciente */}
      <ModalExportarNotaFiscalPaciente
        open={modalPacienteOpen}
        onOpenChange={(isOpen) => {
          setModalPacienteOpen(isOpen);
          if (!isOpen) {
            setVersaoPagadores((v) => v + 1);
          }
        }}
        dados={pacienteSelecionadoNF}
        configuracoes={configuracoes}
        onPagadorAtualizado={(_pacienteId, novoPagador) => {
          if (pacienteSelecionadoNF) {
            setPacienteSelecionadoNF((prev) => (prev ? { ...prev, pagador: novoPagador } : null));
          }
          setVersaoPagadores((v) => v + 1);
        }}
      />
    </>
  );
};
