import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  QrCode,
  Copy,
  CheckCircle2,
  Receipt,
  ArrowRight,
  Wallet,
  User,
  Calendar as CalendarIcon,
  Sparkles,
  Check,
  Smartphone,
  FileText,
  CreditCard,
} from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { useConfiguracoesContrato } from '@/hooks/useConfiguracoesContrato';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { useMaquinasCartao, calcularTaxaCartao } from '@/hooks/useMaquinasCartao';
import { calcularSaldosOrcamentos } from '@/utils/orcamentoSaldo';
import { formatMoney } from '@/utils/exportCsv';
import { gerarRecibo } from '@/utils/recibo';
import { gerarPayloadPix, gerarQrCodePixUrl } from '@/utils/pixPayload';
import { MetodoPagamento, Transacao } from '@/types/shared';
import { toast } from 'sonner';

interface ModalReceberPagamentoProps {
  isOpen: boolean;
  onClose: () => void;
  transacaoPendente?: Transacao | null;
  pacientePredefinidoId?: string;
  orcamentoIdPredefinido?: string;
  valorSugerido?: number;
  descricaoSugerida?: string;
  onSuccess?: () => void;
}

export const ModalReceberPagamento = ({
  isOpen,
  onClose,
  transacaoPendente,
  pacientePredefinidoId,
  orcamentoIdPredefinido,
  valorSugerido,
  descricaoSugerida,
  onSuccess,
}: ModalReceberPagamentoProps) => {
  const { pacientes, transacoes, updateTransacao, addTransacao } = useDentalSystem();
  const { configContrato } = useConfiguracoesContrato();
  const { configuracoes } = useConfiguracoes();
  const { orcamentos, reload: reloadOrcamentos } = useOrcamentos();
  const { operadoras, operadoraPadrao } = useMaquinasCartao();

  const [pacienteId, setPacienteId] = useState('');
  const [orcamentoId, setOrcamentoId] = useState<string>('nenhum');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [metodo, setMetodo] = useState<MetodoPagamento>('pix');
  const [dataRecebimento, setDataRecebimento] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [gerarReciboAposBaixa, setGerarReciboAposBaixa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiouPayload, setCopiouPayload] = useState(false);
  const [copiouChave, setCopiouChave] = useState(false);

  // Máquinas de Cartão
  const [selectedOperadoraId, setSelectedOperadoraId] = useState<string>('infinitepay');
  const [parcelas, setParcelas] = useState<string>('1');
  const [taxaCartaoPercentual, setTaxaCartaoPercentual] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (transacaoPendente) {
        setPacienteId(transacaoPendente.pacienteId || '');
        setOrcamentoId(transacaoPendente.orcamentoId || 'nenhum');
        setValor(String(transacaoPendente.valor || ''));
        setDescricao(transacaoPendente.descricao || 'Recebimento');
        setMetodo(transacaoPendente.metodoPagamento || 'pix');
      } else {
        setPacienteId(pacientePredefinidoId || '');
        setOrcamentoId(orcamentoIdPredefinido || 'nenhum');
        setValor(valorSugerido ? String(valorSugerido) : '');
        setDescricao(descricaoSugerida || 'Recebimento de Tratamento');
        setMetodo('pix');
      }
      setDataRecebimento(new Date().toISOString().slice(0, 10));
      setGerarReciboAposBaixa(false);
      setCopiouPayload(false);
      setCopiouChave(false);
      reloadOrcamentos?.();
    }
  }, [isOpen, transacaoPendente, pacientePredefinidoId, orcamentoIdPredefinido, valorSugerido, descricaoSugerida]);

  // Lista ordenada de pacientes
  const pacientesOrdenados = useMemo(() => {
    return [...(pacientes || [])].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [pacientes]);

  // Orçamentos pertencentes ao paciente selecionado com saldos calculados
  const orcamentosDoPaciente = useMemo(() => {
    if (!pacienteId) return [];

    const pacObj = pacientes.find((p) => p.id === pacienteId);
    const nomeNorm = (pacObj?.nome || '').trim().toLowerCase();

    const doPaciente = (orcamentos || []).filter((o) => {
      if (o.pacienteId === pacienteId) return true;
      if (nomeNorm && o.pacienteNome && o.pacienteNome.trim().toLowerCase() === nomeNorm) return true;
      return false;
    });

    const saldos = calcularSaldosOrcamentos(orcamentos, transacoes as any[]);

    return doPaciente.map((o) => {
      const saldoInfo = saldos.get(o.id) || {
        total: o.total || 0,
        pago: 0,
        saldo: o.total || 0,
        percentual: 0,
      };
      return {
        ...o,
        saldoInfo,
      };
    });
  }, [orcamentos, transacoes, pacienteId, pacientes]);

  // Orçamento atualmente selecionado
  const orcamentoSelecionado = useMemo(() => {
    if (!orcamentoId || orcamentoId === 'nenhum') return null;
    return orcamentosDoPaciente.find((o) => o.id === orcamentoId) || null;
  }, [orcamentoId, orcamentosDoPaciente]);

  // Chaves PIX da Clínica
  const chavePix = configContrato?.chavePix || configuracoes?.telefone || configuracoes?.cnpj || '';
  const tipoChave = configContrato?.tipoChavePix;
  const favorecido = configContrato?.favorecidoPix || configuracoes?.nomeClinica || 'Clínica Odontológica';
  const cidade = configuracoes?.cidade || 'SAO PAULO';

  const valNum = parseFloat(valor) || 0;

  // Atualiza taxa da máquina quando muda operadora ou parcelas
  useEffect(() => {
    if (metodo === 'cartao') {
      const op = operadoras.find((o) => o.id === selectedOperadoraId) || operadoraPadrao;
      const p = parseInt(parcelas) || 1;
      const calc = calcularTaxaCartao(op, p, 100);
      setTaxaCartaoPercentual(String(calc.taxaPercentual));
    }
  }, [metodo, selectedOperadoraId, parcelas, operadoras, operadoraPadrao]);

  // Cálculo de Cartão
  const calculoCartao = useMemo(() => {
    if (metodo !== 'cartao') return null;
    const p = Math.max(1, parseInt(parcelas) || 1);
    const taxaPerc = parseFloat(taxaCartaoPercentual) || 0;
    const taxaValor = Number(((valNum * taxaPerc) / 100).toFixed(2));
    const valorLiquido = Math.max(0, Number((valNum - taxaValor).toFixed(2)));
    const valorParcela = Number((valNum / p).toFixed(2));
    return {
      parcelas: p,
      taxaPerc,
      taxaValor,
      valorLiquido,
      valorParcela,
    };
  }, [metodo, parcelas, taxaCartaoPercentual, valNum]);

  // Gera o Payload Oficial Bacen (EMV) dinâmico com o valor em tempo real
  const payloadPix = useMemo(() => {
    if (!chavePix) return '';
    return gerarPayloadPix({
      chave: chavePix,
      tipoChave,
      nomeFavorecido: favorecido,
      cidade,
      valor: valNum > 0 ? valNum : undefined,
      descricao: descricao ? descricao.slice(0, 30) : 'Tratamento',
    });
  }, [chavePix, tipoChave, favorecido, cidade, valNum, descricao]);

  // QR Code gerado a partir do payload Bacen
  const qrCodeUrl = useMemo(() => {
    if (payloadPix) {
      return gerarQrCodePixUrl(payloadPix, 240);
    }
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=4&data=${encodeURIComponent(chavePix || 'PIX')}`;
  }, [payloadPix, chavePix]);

  const copiarPayloadPix = () => {
    if (!payloadPix) {
      toast.error('Chave PIX não configurada');
      return;
    }
    navigator.clipboard.writeText(payloadPix);
    setCopiouPayload(true);
    setTimeout(() => setCopiouPayload(false), 3000);
    toast.success(
      valNum > 0
        ? `PIX Copia e Cola com valor de ${formatMoney(valNum)} copiado!`
        : 'Código PIX Copia e Cola copiado!'
    );
  };

  const copiarChaveSimples = () => {
    if (!chavePix) {
      toast.error('Chave PIX não configurada');
      return;
    }
    navigator.clipboard.writeText(chavePix);
    setCopiouChave(true);
    setTimeout(() => setCopiouChave(false), 3000);
    toast.success('Chave PIX copiada para a área de transferência!');
  };

  const handlePacienteChange = (novoPacienteId: string) => {
    setPacienteId(novoPacienteId);
    setOrcamentoId('nenhum');
  };

  const handleSelectOrcamento = (val: string) => {
    setOrcamentoId(val);
    if (val && val !== 'nenhum') {
      const orc = orcamentosDoPaciente.find((o) => o.id === val);
      if (orc) {
        const saldoRestante = orc.saldoInfo.saldo > 0 ? orc.saldoInfo.saldo : orc.total;
        // Se não tiver valor ou for 0, sugere o saldo restante
        if (!valor || parseFloat(valor) === 0) {
          setValor(String(saldoRestante.toFixed(2)));
        }
        // Se a descrição for padrão ou vazia, preenche com o título do orçamento
        if (
          !descricao ||
          descricao === 'Recebimento de Tratamento' ||
          descricao === 'Recebimento' ||
          descricao === 'Recebimento de Procedimento'
        ) {
          setDescricao(`Recebimento - ${orc.titulo}`);
        }
      }
    } else {
      if (descricao.startsWith('Recebimento - ')) {
        setDescricao('Recebimento de Tratamento');
      }
    }
  };

  const handleConfirmarRecebimento = async () => {
    if (!valNum || valNum <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    const pId = pacienteId || transacaoPendente?.pacienteId || '';
    if (!pId) {
      toast.error('Selecione o paciente');
      return;
    }

    setLoading(true);
    try {
      const pacienteObj = pacientes.find((p) => p.id === pId);
      const dataObj = new Date(`${dataRecebimento}T12:00:00`);
      const orcIdFinal = orcamentoId && orcamentoId !== 'nenhum' ? orcamentoId : undefined;

      let transacaoFinal: any = null;

      if (transacaoPendente?.id) {
        // Atualiza a transação existente para 'pago' e altera a data para a data do efetivo recebimento
        const updates: any = {
          status: 'pago' as const,
          data: dataObj,
          metodoPagamento: metodo,
          valor: valNum,
          descricao: descricao.trim() || transacaoPendente.descricao,
        };
        if (orcIdFinal) {
          updates.orcamentoId = orcIdFinal;
        }
        if (metodo === 'cartao' && calculoCartao) {
          updates.taxaCartaoPercentual = calculoCartao.taxaPerc;
          updates.taxaCartaoValor = calculoCartao.taxaValor;
          updates.valorLiquido = calculoCartao.valorLiquido;
          updates.parcelas = calculoCartao.parcelas;
          updates.valorParcela = calculoCartao.valorParcela;
        }
        await updateTransacao(transacaoPendente.id, updates);
        transacaoFinal = { ...transacaoPendente, ...updates };
        toast.success(`Recebimento de ${formatMoney(valNum)} confirmado no Caixa!`);
      } else {
        // Cria nova receita paga diretamente
        const novaData: any = {
          pacienteId: pId,
          pacienteNome: pacienteObj?.nome,
          tipo: 'receita' as const,
          status: 'pago' as const,
          metodoPagamento: metodo,
          valor: valNum,
          data: dataObj,
          descricao:
            descricao.trim() ||
            (orcIdFinal ? `Recebimento - ${orcamentoSelecionado?.titulo || 'Orçamento'}` : 'Recebimento de Tratamento'),
          orcamentoId: orcIdFinal,
        };
        if (metodo === 'cartao' && calculoCartao) {
          novaData.taxaCartaoPercentual = calculoCartao.taxaPerc;
          novaData.taxaCartaoValor = calculoCartao.taxaValor;
          novaData.valorLiquido = calculoCartao.valorLiquido;
          novaData.parcelas = calculoCartao.parcelas;
          novaData.valorParcela = calculoCartao.valorParcela;
        }
        transacaoFinal = await addTransacao(novaData);
        toast.success(
          orcIdFinal
            ? `Recebimento de ${formatMoney(valNum)} abatido do orçamento com sucesso!`
            : `Recebimento de ${formatMoney(valNum)} lançado no financeiro do paciente!`
        );
      }

      if (gerarReciboAposBaixa && pacienteObj) {
        try {
          await gerarRecibo(
            {
              numero: String(transacaoFinal?.id || Date.now()).slice(0, 8).toUpperCase(),
              pacienteNome: pacienteObj.nome,
              descricao:
                descricao ||
                (orcIdFinal ? `Pagamento - ${orcamentoSelecionado?.titulo || 'Tratamento'}` : 'Tratamento odontológico'),
              valor: valNum,
              data: dataObj,
              metodoPagamento: metodo,
            },
            configuracoes
          );
          toast.success('Recibo baixado!');
        } catch (rErr) {
          console.error('Erro ao gerar recibo:', rErr);
        }
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Erro ao confirmar recebimento:', err);
      toast.error('Erro ao registrar recebimento');
    } finally {
      setLoading(false);
    }
  };

  const pacienteSelecionado = pacientes.find((p) => p.id === pacienteId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border shadow-2xl">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <QrCode className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                Recebimento em PIX / Caixa
                <Badge className="bg-emerald-400/30 text-emerald-100 text-[10px] uppercase tracking-wide border-0">
                  {orcamentoSelecionado ? 'Abatimento de Orçamento' : 'Baixa Imediata'}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-emerald-100 text-xs mt-0.5">
                Confirme o recebimento para computar na Receita Caixa na data escolhida.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Box de Cobrança PIX com QR Code Dinâmico e Copia e Cola Bacen */}
          {metodo === 'pix' && (
            <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-white dark:from-emerald-950/30 dark:via-zinc-900 dark:to-zinc-900 p-4 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="bg-white p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-md shrink-0 flex flex-col items-center">
                  <img
                    src={qrCodeUrl}
                    alt="QR Code PIX com Valor"
                    className="w-32 h-32 object-contain"
                  />
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 mt-1 uppercase tracking-wider flex items-center gap-1">
                    <Smartphone className="h-3 w-3" /> Escaneie no Banco
                  </span>
                </div>

                <div className="flex-1 space-y-2 text-center sm:text-left min-w-0">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                    {valNum > 0 ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[11px] font-bold px-2 py-0.5 shadow-sm flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5" /> Valor no QR Code: {formatMoney(valNum)}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-[10px]">
                        💡 Digite o valor abaixo para embutir no QR Code
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">Padrão Bacen BR Code</span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {valNum > 0
                      ? 'Ao escanear ou colar no app do banco (Nubank, Itaú, BB, Inter, etc.), o valor já virá preenchido de forma 100% automática!'
                      : 'O QR Code e o Copia e Cola são atualizados em tempo real assim que você digita o valor.'}
                  </p>

                  <div className="pt-0.5 text-[11px] text-muted-foreground truncate">
                    <span className="font-semibold text-foreground">Favorecido:</span> {favorecido} • <span className="font-mono text-xs">{chavePix}</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={copiarPayloadPix}
                      className="h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    >
                      {copiouPayload ? <Check className="h-3.5 w-3.5 text-white" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiouPayload
                        ? 'Código Copiado!'
                        : valNum > 0
                        ? `Copiar PIX Copia e Cola (${formatMoney(valNum)})`
                        : 'Copiar PIX Copia e Cola'}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={copiarChaveSimples}
                      className="h-8 text-xs gap-1 border-muted-foreground/30 hover:bg-muted/50 text-muted-foreground"
                    >
                      {copiouChave ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      Copiar Apenas a Chave
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dados do Recebimento */}
          <div className="space-y-3.5">
            {/* Paciente e Orçamento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <User className="h-3.5 w-3.5 text-primary" />
                  Paciente *
                </Label>
                <Select
                  value={pacienteId}
                  onValueChange={handlePacienteChange}
                  disabled={!!transacaoPendente}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione o paciente" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {pacientesOrdenados.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        <div className="flex items-center justify-between gap-3 w-full">
                          <span className="font-medium truncate">{p.nome}</span>
                          {p.telefone && (
                            <span className="text-[10px] text-muted-foreground shrink-0">{p.telefone}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold flex items-center justify-between text-foreground">
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    Orçamento / Desconto
                  </span>
                  {orcamentosDoPaciente.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
                      {orcamentosDoPaciente.length} {orcamentosDoPaciente.length === 1 ? 'orçamento' : 'orçamentos'}
                    </Badge>
                  )}
                </Label>
                <Select
                  value={orcamentoId}
                  onValueChange={handleSelectOrcamento}
                  disabled={!pacienteId || (!!transacaoPendente && !!transacaoPendente.orcamentoId)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue
                      placeholder={
                        !pacienteId
                          ? 'Selecione o paciente primeiro'
                          : orcamentosDoPaciente.length === 0
                          ? '✨ Nenhum (Lançar Avulso)'
                          : '✨ Escolha um orçamento ou Avulso'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="max-h-64 max-w-[420px]">
                    <SelectItem value="nenhum" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      ✨ Nenhum (Lançar Avulso no Financeiro)
                    </SelectItem>
                    {orcamentosDoPaciente.map((orc) => {
                      const temSaldo = orc.saldoInfo.saldo > 0.009;
                      return (
                        <SelectItem key={orc.id} value={orc.id} className="text-xs py-1.5">
                          <div className="flex flex-col text-left gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold truncate max-w-[280px]">{orc.titulo}</span>
                              <Badge variant="outline" className="text-[9px] uppercase px-1 py-0 h-3.5">
                                {orc.status}
                              </Badge>
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              {temSaldo ? (
                                <>
                                  Saldo a pagar:{' '}
                                  <strong className="text-amber-600 dark:text-amber-400 font-semibold">
                                    {formatMoney(orc.saldoInfo.saldo)}
                                  </strong>{' '}
                                  (Total: {formatMoney(orc.total)})
                                </>
                              ) : (
                                <>Total: {formatMoney(orc.total)} (Quitado ✅)</>
                              )}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Card com Detalhes do Orçamento Selecionado */}
            {orcamentoSelecionado && (
              <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-50/60 via-teal-50/40 to-transparent dark:from-emerald-950/20 dark:via-teal-950/10 dark:to-transparent p-3 space-y-2 animate-in fade-in-50">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground truncate">{orcamentoSelecionado.titulo}</span>
                        <Badge variant="outline" className="text-[9px] uppercase px-1 py-0 h-3.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                          {orcamentoSelecionado.status}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>Total: <strong className="text-foreground">{formatMoney(orcamentoSelecionado.total)}</strong></span>
                        <span>•</span>
                        <span>Já pago: <strong className="text-emerald-600">{formatMoney(orcamentoSelecionado.saldoInfo.pago)}</strong></span>
                        <span>•</span>
                        <span>
                          Saldo em aberto:{' '}
                          <strong className={orcamentoSelecionado.saldoInfo.saldo > 0 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-emerald-600 font-bold'}>
                            {formatMoney(orcamentoSelecionado.saldoInfo.saldo)}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {orcamentoSelecionado.saldoInfo.saldo > 0 && Math.abs(valNum - orcamentoSelecionado.saldoInfo.saldo) > 0.01 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setValor(String(orcamentoSelecionado.saldoInfo.saldo.toFixed(2)))}
                      className="h-7 text-[11px] font-semibold gap-1 px-2 border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 shrink-0"
                    >
                      <Sparkles className="h-3 w-3" />
                      Abater Saldo ({formatMoney(orcamentoSelecionado.saldoInfo.saldo)})
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Aviso quando lançamento for Avulso */}
            {pacienteId && (!orcamentoId || orcamentoId === 'nenhum') && (
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 px-1 py-0.5 rounded-md bg-muted/40">
                <Wallet className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>
                  {orcamentosDoPaciente.length === 0
                    ? 'Paciente sem orçamentos cadastrados. O valor entrará direto no financeiro do paciente.'
                    : 'Lançamento Avulso selecionado: o valor cairá no financeiro do paciente sem vincular a um orçamento específico.'}
                </span>
              </div>
            )}

            {/* Valor e Data */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Valor Recebido (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  className="h-9 text-xs font-bold text-emerald-600 dark:text-emerald-400"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Data do Recebimento (Caixa) *</Label>
                <Input
                  type="date"
                  value={dataRecebimento}
                  onChange={(e) => setDataRecebimento(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Forma de Pagamento e Descrição */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Forma de Pagamento *</Label>
                <Select value={metodo} onValueChange={(val: any) => setMetodo(val)}>
                  <SelectTrigger className="h-9 text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">💎 PIX</SelectItem>
                    <SelectItem value="dinheiro">💵 Dinheiro</SelectItem>
                    <SelectItem value="cartao">💳 Cartão de Débito/Crédito</SelectItem>
                    <SelectItem value="transferencia">🏦 Transferência</SelectItem>
                    <SelectItem value="boleto">📄 Boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Descrição / Referência</Label>
                <Input
                  placeholder="Ex: Consulta de avaliação, Parcela 1/3, Entrada..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Seletor de Cartão e Cálculo de Taxas da Máquina */}
            {metodo === 'cartao' && (
              <div className="rounded-xl border border-blue-500/30 bg-blue-50/40 dark:bg-blue-950/20 p-3 space-y-2.5 animate-in fade-in-50">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800 dark:text-blue-300">
                  <CreditCard className="h-4 w-4" /> Conciliação da Maquininha de Cartão
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Máquina</Label>
                    <Select value={selectedOperadoraId} onValueChange={setSelectedOperadoraId}>
                      <SelectTrigger className="h-8 text-xs font-semibold">
                        <SelectValue placeholder="Máquina" />
                      </SelectTrigger>
                      <SelectContent>
                        {operadoras
                          .filter((o) => o.ativa !== false)
                          .map((op) => (
                            <SelectItem key={op.id} value={op.id} className="text-xs">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: op.cor || '#10b981' }}
                                />
                                <span>{op.nome}</span>
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Parcelas</Label>
                    <Select value={parcelas} onValueChange={setParcelas}>
                      <SelectTrigger className="h-8 text-xs font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((p) => (
                          <SelectItem key={p} value={String(p)} className="text-xs">
                            {p === 1 ? '1x (À vista / Débito)' : `${p}x`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Taxa da Máquina (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Ex: 3.5"
                      value={taxaCartaoPercentual}
                      onChange={(e) => setTaxaCartaoPercentual(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {valNum > 0 && calculoCartao && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-blue-500/20">
                    <span className="text-muted-foreground">
                      Cobrado: <strong>{formatMoney(valNum)}</strong>
                      {calculoCartao.parcelas > 1 && ` (${calculoCartao.parcelas}x de ${formatMoney(calculoCartao.valorParcela)})`}
                    </span>
                    <span className="text-destructive font-medium">
                      - Taxa: {formatMoney(calculoCartao.taxaValor)} ({calculoCartao.taxaPerc}%)
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      Líquido Caixa: {formatMoney(calculoCartao.valorLiquido)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Checkbox Recibo */}
            <label className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
              <input
                type="checkbox"
                checked={gerarReciboAposBaixa}
                onChange={(e) => setGerarReciboAposBaixa(e.target.checked)}
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
              />
              <div className="text-xs flex items-center gap-1.5 font-medium text-foreground">
                <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                Baixar Recibo em PDF automaticamente após confirmar
              </div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmarRecebimento}
              disabled={loading || !valor || parseFloat(valor) <= 0 || !pacienteId}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold"
            >
              <CheckCircle2 className="h-4 w-4" />
              {loading
                ? 'Confirmando...'
                : orcamentoSelecionado
                ? `Confirmar e Abater (${valNum > 0 ? formatMoney(valNum) : 'R$ 0,00'})`
                : `Confirmar e Entrar no Caixa (${valNum > 0 ? formatMoney(valNum) : 'R$ 0,00'})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
