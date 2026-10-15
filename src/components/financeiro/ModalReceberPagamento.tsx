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
  User,
  Sparkles,
  Check,
  Smartphone,
  FileText,
  CreditCard,
  Wallet,
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

  // QR Code gerado a partir do payload Bacen (tamanho otimizado)
  const qrCodeUrl = useMemo(() => {
    if (payloadPix) {
      return gerarQrCodePixUrl(payloadPix, 160);
    }
    return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=4&data=${encodeURIComponent(chavePix || 'PIX')}`;
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
        ? `PIX Copia e Cola (${formatMoney(valNum)}) copiado!`
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
    toast.success('Chave PIX copiada!');
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
        if (!valor || parseFloat(valor) === 0) {
          setValor(String(saldoRestante.toFixed(2)));
        }
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
            ? `Recebimento de ${formatMoney(valNum)} abatido do orçamento!`
            : `Recebimento de ${formatMoney(valNum)} lançado no financeiro!`
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl p-0 overflow-hidden border shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header Compacto */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-white/20 rounded-md">
              <QrCode className="h-4 w-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-white flex items-center gap-2 leading-none">
                Recebimento em PIX / Caixa
                <Badge className="bg-emerald-400/30 text-emerald-100 text-[9px] uppercase px-1.5 py-0 border-0 font-semibold">
                  {orcamentoSelecionado ? 'Abater Orçamento' : 'Baixa Imediata'}
                </Badge>
              </DialogTitle>
            </div>
          </div>
        </div>

        {/* Corpo com visualização direta e compacta */}
        <div className="p-3.5 space-y-2.5 overflow-y-auto flex-1">
          {/* Box de Cobrança PIX Compacto */}
          {metodo === 'pix' && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-2 flex items-center gap-2.5">
              <div className="bg-white p-1 rounded-md border border-emerald-200 dark:border-emerald-800 shadow-xs shrink-0 flex flex-col items-center">
                <img
                  src={qrCodeUrl}
                  alt="QR Code PIX"
                  className="w-16 h-16 object-contain"
                />
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-1 text-[11px]">
                  <div className="flex items-center gap-1.5 truncate">
                    <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[9px] font-bold px-1 py-0 h-4 shrink-0">
                      PIX Bacen
                    </Badge>
                    <span className="text-muted-foreground truncate">
                      {favorecido} • <span className="font-mono">{chavePix}</span>
                    </span>
                  </div>
                  {valNum > 0 && (
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                      QR c/ {formatMoney(valNum)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    onClick={copiarPayloadPix}
                    className="h-6 text-[11px] font-semibold gap-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  >
                    {copiouPayload ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiouPayload
                      ? 'Copiado!'
                      : valNum > 0
                      ? `Copiar PIX (${formatMoney(valNum)})`
                      : 'Copiar PIX Copia e Cola'}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copiarChaveSimples}
                    className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                  >
                    {copiouChave ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    Chave
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Linha 1: Paciente e Orçamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <Label className="text-[11px] font-semibold flex items-center gap-1 text-foreground">
                <User className="h-3 w-3 text-primary" />
                Paciente *
              </Label>
              <Select
                value={pacienteId}
                onValueChange={handlePacienteChange}
                disabled={!!transacaoPendente}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione o paciente" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {pacientesOrdenados.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      <div className="flex items-center justify-between gap-2 w-full">
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

            <div className="space-y-0.5">
              <Label className="text-[11px] font-semibold flex items-center justify-between text-foreground">
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3 text-primary" />
                  Orçamento / Desconto
                </span>
                {orcamentosDoPaciente.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {orcamentosDoPaciente.length} disp.
                  </span>
                )}
              </Label>
              <Select
                value={orcamentoId}
                onValueChange={handleSelectOrcamento}
                disabled={!pacienteId || (!!transacaoPendente && !!transacaoPendente.orcamentoId)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue
                    placeholder={
                      !pacienteId
                        ? 'Escolha o paciente primeiro'
                        : orcamentosDoPaciente.length === 0
                        ? '✨ Nenhum (Lançar Avulso)'
                        : '✨ Escolha o orçamento ou Avulso'
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-56 max-w-[400px]">
                  <SelectItem value="nenhum" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    ✨ Nenhum (Lançar Avulso no Financeiro)
                  </SelectItem>
                  {orcamentosDoPaciente.map((orc) => {
                    const temSaldo = orc.saldoInfo.saldo > 0.009;
                    return (
                      <SelectItem key={orc.id} value={orc.id} className="text-xs py-1">
                        <div className="flex flex-col text-left">
                          <span className="font-semibold truncate max-w-[280px]">
                            {orc.titulo} ({orc.status})
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {temSaldo ? (
                              <>
                                Saldo: <strong className="text-amber-600 dark:text-amber-400">{formatMoney(orc.saldoInfo.saldo)}</strong> (Total: {formatMoney(orc.total)})
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

          {/* Faixa compacta de status do orçamento ou aviso de avulso */}
          {orcamentoSelecionado ? (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 px-2.5 py-1 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 truncate text-[11px]">
                <FileText className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span className="font-semibold truncate text-foreground">{orcamentoSelecionado.titulo}:</span>
                <span className="text-muted-foreground">Total: {formatMoney(orcamentoSelecionado.total)}</span>
                <span className="text-muted-foreground">• Saldo:</span>
                <strong className={orcamentoSelecionado.saldoInfo.saldo > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'}>
                  {formatMoney(orcamentoSelecionado.saldoInfo.saldo)}
                </strong>
              </div>
              {orcamentoSelecionado.saldoInfo.saldo > 0 && Math.abs(valNum - orcamentoSelecionado.saldoInfo.saldo) > 0.01 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setValor(String(orcamentoSelecionado.saldoInfo.saldo.toFixed(2)))}
                  className="h-5 text-[10px] px-1.5 font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/50 shrink-0"
                >
                  <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                  Preencher Saldo ({formatMoney(orcamentoSelecionado.saldoInfo.saldo)})
                </Button>
              )}
            </div>
          ) : (
            pacienteId && (
              <div className="text-[10px] text-muted-foreground flex items-center gap-1 px-1">
                <Wallet className="h-3 w-3 text-emerald-600 shrink-0" />
                <span>
                  {orcamentosDoPaciente.length === 0
                    ? 'Sem orçamentos cadastrados. O valor entrará como crédito avulso no paciente.'
                    : 'Lançamento Avulso: o valor entrará direto no financeiro do paciente.'}
                </span>
              </div>
            )
          )}

          {/* Linha 2: Valor Recebido, Data e Forma de Pagamento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-0.5">
              <Label className="text-[11px] font-semibold text-foreground">Valor Recebido (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="h-8 text-xs font-bold text-emerald-600 dark:text-emerald-400"
              />
            </div>

            <div className="space-y-0.5">
              <Label className="text-[11px] font-semibold text-foreground">Data Recebimento *</Label>
              <Input
                type="date"
                value={dataRecebimento}
                onChange={(e) => setDataRecebimento(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-0.5">
              <Label className="text-[11px] font-semibold text-foreground">Forma de Pagamento *</Label>
              <Select value={metodo} onValueChange={(val: any) => setMetodo(val)}>
                <SelectTrigger className="h-8 text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">💎 PIX</SelectItem>
                  <SelectItem value="dinheiro">💵 Dinheiro</SelectItem>
                  <SelectItem value="cartao">💳 Cartão Déb./Créd.</SelectItem>
                  <SelectItem value="transferencia">🏦 Transferência</SelectItem>
                  <SelectItem value="boleto">📄 Boleto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linha 3: Descrição e Checkbox de Recibo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
            <div className="sm:col-span-2 space-y-0.5">
              <Label className="text-[11px] font-semibold text-foreground">Descrição / Referência</Label>
              <Input
                placeholder="Ex: Consulta de avaliação, Parcela 1/3, Entrada..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="sm:col-span-1">
              <label className="flex items-center gap-1.5 text-[11px] font-medium cursor-pointer h-8 px-2 rounded-md border bg-muted/20 hover:bg-muted/40 transition-colors select-none">
                <input
                  type="checkbox"
                  checked={gerarReciboAposBaixa}
                  onChange={(e) => setGerarReciboAposBaixa(e.target.checked)}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                />
                <Receipt className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">Baixar Recibo PDF</span>
              </label>
            </div>
          </div>

          {/* Painel de Cartão Compacto (aparece apenas quando Cartão selecionado) */}
          {metodo === 'cartao' && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-50/40 dark:bg-blue-950/20 p-2 space-y-1.5 animate-in fade-in-50">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Máquina</Label>
                  <Select value={selectedOperadoraId} onValueChange={setSelectedOperadoraId}>
                    <SelectTrigger className="h-7 text-xs font-semibold">
                      <SelectValue placeholder="Máquina" />
                    </SelectTrigger>
                    <SelectContent>
                      {operadoras
                        .filter((o) => o.ativa !== false)
                        .map((op) => (
                          <SelectItem key={op.id} value={op.id} className="text-xs">
                            {op.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[10px] text-muted-foreground">Parcelas</Label>
                  <Select value={parcelas} onValueChange={setParcelas}>
                    <SelectTrigger className="h-7 text-xs font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((p) => (
                        <SelectItem key={p} value={String(p)} className="text-xs">
                          {p === 1 ? '1x (À vista)' : `${p}x`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[10px] text-muted-foreground">Taxa da Máquina (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 3.5"
                    value={taxaCartaoPercentual}
                    onChange={(e) => setTaxaCartaoPercentual(e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
              </div>

              {valNum > 0 && calculoCartao && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1 border-t border-blue-500/20">
                  <span className="text-muted-foreground">
                    Cobrado: <strong>{formatMoney(valNum)}</strong>
                    {calculoCartao.parcelas > 1 && ` (${calculoCartao.parcelas}x de ${formatMoney(calculoCartao.valorParcela)})`}
                  </span>
                  <span className="text-destructive font-medium">
                    - Taxa: {formatMoney(calculoCartao.taxaValor)} ({calculoCartao.taxaPerc}%)
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    Líquido: {formatMoney(calculoCartao.valorLiquido)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé FIXO - Sempre Visível sem precisar rolar */}
        <div className="px-4 py-2.5 border-t bg-muted/40 flex items-center justify-between shrink-0">
          <div className="text-xs text-muted-foreground">
            {valNum > 0 ? (
              <span>
                Total: <strong className="text-foreground text-sm font-bold">{formatMoney(valNum)}</strong>
              </span>
            ) : (
              <span>Informe o valor recebido</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading} className="h-8 text-xs">
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmarRecebimento}
              disabled={loading || !valor || parseFloat(valor) <= 0 || !pacienteId}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-bold shadow-xs px-3"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {loading
                ? 'Confirmando...'
                : orcamentoSelecionado
                ? `Confirmar e Abater`
                : `Confirmar no Caixa`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
