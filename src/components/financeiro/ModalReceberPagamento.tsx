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
  Maximize2,
  Banknote,
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
  const { pacientes, transacoes, updateTransacao, addTransacao, deleteTransacao } = useDentalSystem();
  const { configContrato } = useConfiguracoesContrato();
  const { configuracoes } = useConfiguracoes();
  const { orcamentos, reload: reloadOrcamentos } = useOrcamentos();
  const { operadoras, operadoraPadrao, config: configMaquinas } = useMaquinasCartao();

  const [pacienteId, setPacienteId] = useState('');
  const [orcamentoId, setOrcamentoId] = useState<string>('nenhum');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [metodo, setMetodo] = useState<MetodoPagamento | 'misto'>('pix');
  const [dataRecebimento, setDataRecebimento] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [gerarReciboAposBaixa, setGerarReciboAposBaixa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiouPayload, setCopiouPayload] = useState(false);
  const [copiouChave, setCopiouChave] = useState(false);
  const [qrTelaCheiaOpen, setQrTelaCheiaOpen] = useState(false);

  // Máquinas de Cartão (Pagamento 100% Cartão)
  const [selectedOperadoraId, setSelectedOperadoraId] = useState<string>('infinitepay');
  const [parcelas, setParcelas] = useState<string>('1');
  const [taxaCartaoPercentual, setTaxaCartaoPercentual] = useState<string>('');

  // Suporte a Pagamento Misto (PIX + Cartão de Crédito/Débito)
  const [mistoPixValor, setMistoPixValor] = useState('');
  const [mistoCartaoValor, setMistoCartaoValor] = useState('');
  const [mistoOperadoraCartaoId, setMistoOperadoraCartaoId] = useState<string>('infinitepay');
  const [mistoParcelasCartao, setMistoParcelasCartao] = useState<string>('1');
  const [mistoTipoCartao, setMistoTipoCartao] = useState<'credito' | 'debito'>('credito');

  useEffect(() => {
    if (isOpen) {
      if (transacaoPendente) {
        setPacienteId(transacaoPendente.pacienteId || '');
        setOrcamentoId(transacaoPendente.orcamentoId || 'nenhum');
        setValor(String(transacaoPendente.valor || ''));
        setDescricao(transacaoPendente.descricao || 'Recebimento');
        const m = transacaoPendente.metodoPagamento;
        if (m && ['pix', 'cartao', 'misto', 'dinheiro', 'transferencia', 'boleto'].includes(m)) {
          setMetodo(m as any);
        } else {
          setMetodo('pix');
        }

        // Auto-detecta operadora do cartão da transação ou descrição
        const tDescLower = `${transacaoPendente.descricao || ''} ${transacaoPendente.operadoraCartao || ''}`.toLowerCase();
        if (tDescLower.includes('pagbank') || tDescLower.includes('pagseguro') || tDescLower.includes('pag bank')) {
          setSelectedOperadoraId('pagbank');
          setMistoOperadoraCartaoId('pagbank');
        } else if (tDescLower.includes('infinite')) {
          setSelectedOperadoraId('infinitepay');
          setMistoOperadoraCartaoId('infinitepay');
        }
      } else {
        setPacienteId(pacientePredefinidoId || '');
        setOrcamentoId(orcamentoIdPredefinido || 'nenhum');
        setValor(valorSugerido ? String(valorSugerido) : '');
        setDescricao(descricaoSugerida || 'Recebimento de Tratamento');
        setMetodo('pix');
      }
      setMistoPixValor('');
      setMistoCartaoValor('');
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
  const cidade = (configuracoes?.cidade && !configuracoes.cidade.toUpperCase().includes('SAO PAULO')) ? configuracoes.cidade : 'MACEIO';

  const valNum = parseFloat(valor) || 0;

  // Valores numéricos do pagamento misto
  const mistoValPixNum = parseFloat(mistoPixValor) || 0;
  const mistoValCartaoNum = parseFloat(mistoCartaoValor) || 0;
  const mistoTotalInformado = Number((mistoValPixNum + mistoValCartaoNum).toFixed(2));

  // Cálculo de taxas para a parte de Cartão no Pagamento Misto
  const mistoCalculoCartao = useMemo(() => {
    if (metodo !== 'misto' || mistoValCartaoNum <= 0) return null;
    const op = operadoras.find((o) => o.id === mistoOperadoraCartaoId) || operadoraPadrao;
    const p = Math.max(1, parseInt(mistoParcelasCartao) || 1);
    const isDeb = mistoTipoCartao === 'debito';
    const calc = calcularTaxaCartao(op, p, mistoValCartaoNum, isDeb);
    return {
      operadora: op,
      parcelas: p,
      isDebito: isDeb,
      taxaPerc: calc.taxaPercentual,
      taxaValor: calc.taxaValor,
      valorLiquido: calc.valorLiquido,
      valorParcela: p > 1 ? Number((mistoValCartaoNum / p).toFixed(2)) : mistoValCartaoNum,
    };
  }, [metodo, mistoValCartaoNum, mistoOperadoraCartaoId, mistoParcelasCartao, mistoTipoCartao, operadoras, operadoraPadrao]);

  // Alvo de valor para geração de payload/QR Code de PIX
  const valorPixAlvo = metodo === 'misto' ? mistoValPixNum : valNum;

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
      valor: valorPixAlvo > 0 ? valorPixAlvo : undefined,
      descricao: descricao ? descricao.slice(0, 30) : 'Tratamento',
    });
  }, [chavePix, tipoChave, favorecido, cidade, valorPixAlvo, descricao]);

  // QR Code gerado a partir do payload Bacen (tamanho otimizado)
  const qrCodeUrl = useMemo(() => {
    if (payloadPix) {
      return gerarQrCodePixUrl(payloadPix, 200);
    }
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=4&data=${encodeURIComponent(chavePix || 'PIX')}`;
  }, [payloadPix, chavePix]);

  // QR Code em Alta Resolução para Tela Cheia
  const qrCodeUrlGrande = useMemo(() => {
    if (payloadPix) {
      return gerarQrCodePixUrl(payloadPix, 360);
    }
    return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=4&data=${encodeURIComponent(chavePix || 'PIX')}`;
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
      valorPixAlvo > 0
        ? `PIX Copia e Cola (${formatMoney(valorPixAlvo)}) copiado!`
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

  // Auto-seleciona orçamento se o paciente tiver orçamento com saldo aberto
  useEffect(() => {
    if (pacienteId && (!orcamentoId || orcamentoId === 'nenhum') && !orcamentoIdPredefinido) {
      const orcComSaldo = orcamentosDoPaciente.find((o) => o.saldoInfo.saldo > 0.01);
      if (orcComSaldo) {
        setOrcamentoId(orcComSaldo.id);
        if (!valor || parseFloat(valor) === 0) {
          setValor(String(orcComSaldo.saldoInfo.saldo.toFixed(2)));
        }
        if (!descricao || descricao === 'Recebimento de Tratamento' || descricao === 'Recebimento') {
          setDescricao(`Recebimento - ${orcComSaldo.titulo}`);
        }
      }
    }
  }, [pacienteId, orcamentosDoPaciente, orcamentoId, orcamentoIdPredefinido]);

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
        // Auto-detecta operadora da maquininha a partir do orçamento
        const formasTexto = `${orc.formasPagamento || ''} ${orc.titulo || ''}`.toLowerCase();
        if (formasTexto.includes('pagbank') || formasTexto.includes('pagseguro') || formasTexto.includes('pag bank')) {
          setSelectedOperadoraId('pagbank');
          setMistoOperadoraCartaoId('pagbank');
        } else if (formasTexto.includes('infinite') || formasTexto.includes('infinitepay')) {
          setSelectedOperadoraId('infinitepay');
          setMistoOperadoraCartaoId('infinitepay');
        }
      }
    } else {
      if (descricao.startsWith('Recebimento - ')) {
        setDescricao('Recebimento de Tratamento');
      }
    }
  };

  const handleMetodoChange = (novoMetodo: any) => {
    setMetodo(novoMetodo);
    if (novoMetodo === 'misto' && valNum > 0) {
      if (!mistoPixValor && !mistoCartaoValor) {
        const metade = Number((valNum / 2).toFixed(2));
        setMistoPixValor(String(metade));
        setMistoCartaoValor(String(Number((valNum - metade).toFixed(2))));
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

    if (metodo === 'misto') {
      if (mistoValPixNum <= 0 && mistoValCartaoNum <= 0) {
        toast.error('Informe os valores de PIX e Cartão no pagamento misto');
        return;
      }
      if (Math.abs(mistoTotalInformado - valNum) > 0.05) {
        toast.error(`A soma das partes (${formatMoney(mistoTotalInformado)}) difere do total (${formatMoney(valNum)})`);
        return;
      }
    }

    setLoading(true);
    try {
      const pacienteObj = pacientes.find((p) => p.id === pId);
      const dataObj = new Date(`${dataRecebimento}T12:00:00`);
      const orcIdFinal = orcamentoId && orcamentoId !== 'nenhum' ? orcamentoId : undefined;

      // FLUXO DE PAGAMENTO MISTO (PIX + CARTÃO)
      if (metodo === 'misto') {
        if (mistoValPixNum > 0) {
          await addTransacao({
            pacienteId: pId,
            pacienteNome: pacienteObj?.nome,
            tipo: 'receita' as const,
            status: 'pago' as const,
            metodoPagamento: 'pix',
            valor: mistoValPixNum,
            data: dataObj,
            descricao: `${descricao.trim() || 'Recebimento'} (PIX)`,
            orcamentoId: orcIdFinal,
          });
        }

        if (mistoValCartaoNum > 0) {
          const dadosCartao: any = {
            pacienteId: pId,
            pacienteNome: pacienteObj?.nome,
            tipo: 'receita' as const,
            status: 'pago' as const,
            metodoPagamento: 'cartao',
            operadoraCartao: mistoOperadoraCartaoId,
            valor: mistoValCartaoNum,
            data: dataObj,
            descricao: `${descricao.trim() || 'Recebimento'} (Cartão ${mistoParcelasCartao}x ${mistoCalculoCartao?.operadora?.nome || ''})`,
            orcamentoId: orcIdFinal,
          };
          if (mistoCalculoCartao) {
            dadosCartao.taxaCartaoPercentual = mistoCalculoCartao.taxaPerc;
            dadosCartao.taxaCartaoValor = mistoCalculoCartao.taxaValor;
            dadosCartao.valorLiquido = mistoCalculoCartao.valorLiquido;
            dadosCartao.parcelas = mistoCalculoCartao.parcelas;
            dadosCartao.valorParcela = mistoCalculoCartao.valorParcela;
          }
          await addTransacao(dadosCartao);

          if (configMaquinas?.lancarTaxaComoDespesa !== false && mistoCalculoCartao && mistoCalculoCartao.taxaValor > 0) {
            await addTransacao({
              pacienteId: pId,
              pacienteNome: pacienteObj?.nome,
              valor: mistoCalculoCartao.taxaValor,
              tipo: 'despesa' as const,
              status: 'pago' as const,
              metodoPagamento: 'cartao',
              operadoraCartao: mistoOperadoraCartaoId,
              data: dataObj,
              vencimento: dataObj,
              descricao: `Taxa da Máquina (${mistoCalculoCartao.operadora?.nome || 'Cartão'}) - ${descricao.trim() || 'Recebimento'}`,
              categoria: configMaquinas?.categoriaDespesaPadrao || 'Taxas de Cartão',
              orcamentoId: orcIdFinal,
            });
          }
        }

        // Se havia uma transação pendente sendo substituída por este recebimento misto, deleta a pendência antiga
        if (transacaoPendente?.id) {
          try {
            await deleteTransacao(transacaoPendente.id);
          } catch (delErr) {
            console.error('Erro ao remover transação pendente substituída por misto:', delErr);
          }
        }

        toast.success(
          orcIdFinal
            ? `Recebimento misto de ${formatMoney(valNum)} (PIX + Cartão) baixado do orçamento!`
            : `Recebimento misto de ${formatMoney(valNum)} registrado no Caixa!`
        );

        if (gerarReciboAposBaixa && pacienteObj) {
          try {
            await gerarRecibo(
              {
                numero: String(Date.now()).slice(-8).toUpperCase(),
                pacienteNome: pacienteObj.nome,
                pacienteCpf: pacienteObj.cpf,
                descricao:
                  descricao ||
                  (orcIdFinal ? `Pagamento - ${orcamentoSelecionado?.titulo || 'Tratamento'}` : 'Tratamento odontológico'),
                valor: valNum,
                data: dataObj,
                metodoPagamento: `Misto: PIX (${formatMoney(mistoValPixNum)}) + Cartão (${formatMoney(mistoValCartaoNum)})`,
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
        return;
      }

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
          updates.operadoraCartao = selectedOperadoraId;
          updates.taxaCartaoPercentual = calculoCartao.taxaPerc;
          updates.taxaCartaoValor = calculoCartao.taxaValor;
          updates.valorLiquido = calculoCartao.valorLiquido;
          updates.parcelas = calculoCartao.parcelas;
          updates.valorParcela = calculoCartao.valorParcela;

          if (configMaquinas?.lancarTaxaComoDespesa !== false && calculoCartao.taxaValor > 0) {
            await addTransacao({
              pacienteId: pId,
              pacienteNome: pacienteObj?.nome,
              valor: calculoCartao.taxaValor,
              tipo: 'despesa' as const,
              status: 'pago' as const,
              metodoPagamento: 'cartao',
              operadoraCartao: selectedOperadoraId,
              data: dataObj,
              vencimento: dataObj,
              descricao: `Taxa da Máquina (${calculoCartao.operadora?.nome || 'Cartão'}) - ${descricao.trim() || 'Recebimento'}`,
              categoria: configMaquinas?.categoriaDespesaPadrao || 'Taxas de Cartão',
              orcamentoId: orcIdFinal,
            });
          }
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
          novaData.operadoraCartao = selectedOperadoraId;
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
              pacienteCpf: pacienteObj.cpf,
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
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl p-0 overflow-hidden border shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header Compacto */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-md">
              {metodo === 'cartao' ? (
                <CreditCard className="h-4 w-4 text-white" />
              ) : metodo === 'misto' ? (
                <Wallet className="h-4 w-4 text-white" />
              ) : metodo === 'dinheiro' ? (
                <Banknote className="h-4 w-4 text-white" />
              ) : metodo === 'pix' ? (
                <QrCode className="h-4 w-4 text-white" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-white" />
              )}
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-white flex items-center gap-2 leading-none">
                {transacaoPendente ? 'Confirmar Recebimento / Dar Baixa' : 'Recebimento no Caixa'}
                <Badge className="bg-white/20 text-white text-[9px] uppercase px-1.5 py-0 border-0 font-semibold">
                  {metodo === 'misto'
                    ? 'Misto (PIX + Cartão)'
                    : metodo === 'cartao'
                    ? 'Cartão'
                    : metodo === 'dinheiro'
                    ? 'Dinheiro'
                    : metodo === 'pix'
                    ? 'PIX'
                    : orcamentoSelecionado
                    ? 'Abater Orçamento'
                    : 'Caixa'}
                </Badge>
              </DialogTitle>
              {transacaoPendente && (
                <p className="text-[11px] text-emerald-100 opacity-90 mt-0.5 truncate max-w-sm">
                  {transacaoPendente.pacienteNome || 'Paciente'} • {formatMoney(transacaoPendente.valor || 0)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Corpo com visualização direta e compacta */}
        <div className="p-3.5 space-y-2.5 overflow-y-auto flex-1">
          {/* Box de Cobrança PIX Otimizado */}
          {(metodo === 'pix' || (metodo === 'misto' && mistoValPixNum > 0)) && chavePix && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 flex items-center gap-3">
              <div
                onClick={() => setQrTelaCheiaOpen(true)}
                className="bg-white p-1 rounded-lg border border-emerald-300 dark:border-emerald-700 shadow-xs shrink-0 flex flex-col items-center cursor-pointer group relative hover:border-emerald-500 hover:shadow-md transition-all"
                title="Clique para ampliar / tela cheia"
              >
                <img
                  src={qrCodeUrl}
                  alt="QR Code PIX"
                  className="w-20 h-20 object-contain transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/45 rounded-lg opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[9px] font-bold transition-opacity">
                  <Maximize2 className="h-4 w-4 mb-0.5 text-white" />
                  Ampliar
                </div>
              </div>

              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between gap-1 text-[11px]">
                  <div className="flex items-center gap-1.5 truncate">
                    <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[9px] font-bold px-1 py-0 h-4 shrink-0">
                      {metodo === 'misto' ? 'PIX (Parte 1)' : 'PIX Bacen'}
                    </Badge>
                    <span className="text-muted-foreground truncate">
                      {favorecido} • <span className="font-mono">{chavePix}</span>
                    </span>
                  </div>
                  {valorPixAlvo > 0 && (
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                      {metodo === 'misto' ? `PIX: ${formatMoney(valorPixAlvo)}` : `QR c/ ${formatMoney(valorPixAlvo)}`}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    onClick={copiarPayloadPix}
                    className="h-6 text-[11px] font-semibold gap-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  >
                    {copiouPayload ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiouPayload
                      ? 'Copiado!'
                      : valorPixAlvo > 0
                      ? `Copiar PIX (${formatMoney(valorPixAlvo)})`
                      : 'Copiar PIX Copia e Cola'}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setQrTelaCheiaOpen(true)}
                    className="h-6 text-[11px] font-semibold gap-1 px-2 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                  >
                    <Maximize2 className="h-3 w-3" />
                    Tela Cheia
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
              <div className="space-y-1.5">
                {orcamentosDoPaciente.some((o) => o.saldoInfo.saldo > 0.01) && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 flex items-center justify-between text-xs animate-in fade-in">
                    <div className="flex items-center gap-1.5 text-amber-500">
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-semibold text-[11px]">
                        Este paciente possui orçamento com saldo em aberto!
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] font-bold border-amber-500/40 text-amber-500 hover:bg-amber-500/20"
                      onClick={() => {
                        const o = orcamentosDoPaciente.find((x) => x.saldoInfo.saldo > 0.01) || orcamentosDoPaciente[0];
                        handleSelectOrcamento(o.id);
                      }}
                    >
                      Vincular ao Orçamento ({formatMoney(orcamentosDoPaciente.find((x) => x.saldoInfo.saldo > 0.01)?.saldoInfo.saldo || 0)})
                    </Button>
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground flex items-center gap-1 px-1">
                  <Wallet className="h-3 w-3 text-emerald-600 shrink-0" />
                  <span>
                    {orcamentosDoPaciente.length === 0
                      ? 'Sem orçamentos cadastrados. O valor entrará como crédito avulso no paciente.'
                      : 'Lançamento Avulso: o valor entrará direto no financeiro do paciente.'}
                  </span>
                </div>
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
              <Select value={metodo} onValueChange={handleMetodoChange}>
                <SelectTrigger className="h-8 text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">💎 PIX</SelectItem>
                  <SelectItem value="cartao">💳 Cartão Déb./Créd.</SelectItem>
                  <SelectItem value="misto" className="font-semibold text-emerald-600 dark:text-emerald-400">
                    🔀 Misto (PIX + Cartão)
                  </SelectItem>
                  <SelectItem value="dinheiro">💵 Dinheiro</SelectItem>
                  <SelectItem value="transferencia">🏦 Transferência</SelectItem>
                  <SelectItem value="boleto">📄 Boleto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Painel de Pagamento Misto (PIX + Cartão) */}
          {metodo === 'misto' && (
            <div className="rounded-lg border border-emerald-500/40 bg-gradient-to-br from-emerald-950/20 via-background to-teal-950/20 p-2.5 space-y-2 animate-in fade-in-50">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" />
                  Divisão do Pagamento Misto (PIX + Cartão)
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const metade = Number((valNum / 2).toFixed(2));
                      setMistoPixValor(String(metade));
                      setMistoCartaoValor(String(Number((valNum - metade).toFixed(2))));
                    }}
                    className="h-5 text-[10px] px-1.5 font-semibold text-emerald-400 hover:bg-emerald-500/10"
                  >
                    50% / 50%
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const resto = Math.max(0, Number((valNum - mistoValPixNum).toFixed(2)));
                      setMistoCartaoValor(String(resto));
                    }}
                    className="h-5 text-[10px] px-1.5 font-semibold text-teal-400 hover:bg-teal-500/10"
                  >
                    Restante no Cartão
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Parte 1: PIX */}
                <div className="p-2 rounded-md border border-emerald-500/30 bg-background/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                      💎 Parte 1: PIX
                    </Label>
                    <Badge className="bg-emerald-600/30 text-emerald-300 text-[9px] px-1 py-0 border-0">
                      Baixa Imediata
                    </Badge>
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] text-muted-foreground">Valor no PIX (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={mistoPixValor}
                      onChange={(e) => setMistoPixValor(e.target.value)}
                      className="h-7 text-xs font-bold text-emerald-600 dark:text-emerald-400"
                    />
                  </div>
                </div>

                {/* Parte 2: Cartão */}
                <div className="p-2 rounded-md border border-teal-500/30 bg-background/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-semibold text-teal-400 flex items-center gap-1">
                      💳 Parte 2: Cartão
                    </Label>
                    <Badge className="bg-teal-600/30 text-teal-300 text-[9px] px-1 py-0 border-0">
                      Maquininha
                    </Badge>
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] text-muted-foreground">Valor no Cartão (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={mistoCartaoValor}
                      onChange={(e) => setMistoCartaoValor(e.target.value)}
                      className="h-7 text-xs font-bold text-teal-600 dark:text-teal-400"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-1 pt-0.5">
                    <div>
                      <Label className="text-[9px] text-muted-foreground">Máquina</Label>
                      <Select value={mistoOperadoraCartaoId} onValueChange={setMistoOperadoraCartaoId}>
                        <SelectTrigger className="h-6 text-[10px] font-semibold px-1">
                          <SelectValue />
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
                      <Label className="text-[9px] text-muted-foreground">Tipo</Label>
                      <Select value={mistoTipoCartao} onValueChange={(v: any) => setMistoTipoCartao(v)}>
                        <SelectTrigger className="h-6 text-[10px] font-semibold px-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="credito" className="text-xs">Crédito</SelectItem>
                          <SelectItem value="debito" className="text-xs">Débito</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-[9px] text-muted-foreground">Parcelas</Label>
                      <Select
                        value={mistoParcelasCartao}
                        onValueChange={setMistoParcelasCartao}
                        disabled={mistoTipoCartao === 'debito'}
                      >
                        <SelectTrigger className="h-6 text-[10px] font-semibold px-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((p) => (
                            <SelectItem key={p} value={String(p)} className="text-xs">
                              {p === 1 ? '1x à vista' : `${p}x`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {mistoCalculoCartao && mistoValCartaoNum > 0 && (
                    <div className="text-[9px] text-muted-foreground flex items-center justify-between pt-0.5 border-t border-border/40">
                      <span>Taxa: <strong className="text-destructive">-{formatMoney(mistoCalculoCartao.taxaValor)} ({mistoCalculoCartao.taxaPerc}%)</strong></span>
                      <span>Líquido: <strong className="text-emerald-400">{formatMoney(mistoCalculoCartao.valorLiquido)}</strong></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Barra de Consistência da Soma */}
              <div className="flex items-center justify-between text-[11px] px-2 py-1 rounded bg-muted/40 border border-border/60">
                <span>
                  Soma: <strong>{formatMoney(mistoTotalInformado)}</strong> / Total: <strong>{formatMoney(valNum)}</strong>
                </span>
                {Math.abs(mistoTotalInformado - valNum) < 0.05 ? (
                  <span className="text-emerald-500 font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Distribuído 100%
                  </span>
                ) : (
                  <span className="text-amber-500 font-semibold flex items-center gap-1">
                    Diferença: {formatMoney(valNum - mistoTotalInformado)}
                    <button
                      type="button"
                      onClick={() => {
                        const resto = Math.max(0, Number((valNum - mistoValPixNum).toFixed(2)));
                        setMistoCartaoValor(String(resto));
                      }}
                      className="underline ml-1 hover:text-amber-400 font-bold"
                    >
                      Ajustar no Cartão
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}

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

    {/* Modal de QR Code em Tela Cheia / Ampliado para o Paciente Escanear */}
    <Dialog open={qrTelaCheiaOpen} onOpenChange={setQrTelaCheiaOpen}>
      <DialogContent className="max-w-md p-6 border shadow-2xl text-center space-y-4">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-xl font-bold flex items-center justify-center gap-2 text-foreground">
            <QrCode className="h-6 w-6 text-emerald-600" />
            Pague com PIX
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Aponte a câmera do aplicativo do seu banco para o QR Code abaixo
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border-2 border-emerald-500/40 shadow-lg mx-auto w-fit">
          <img
            src={qrCodeUrlGrande}
            alt="QR Code PIX Tela Cheia"
            className="w-64 h-64 sm:w-72 sm:h-72 object-contain"
          />
          <span className="text-xs font-bold text-emerald-700 mt-2.5 uppercase tracking-wider flex items-center gap-1.5">
            <Smartphone className="h-4 w-4" /> Leitura Automática no Banco
          </span>
        </div>

        {valNum > 0 && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 text-center">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block">
              Valor a Pagar
            </span>
            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {formatMoney(valNum)}
            </span>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1 bg-muted/40 p-2.5 rounded-lg border text-left">
          <div className="truncate">
            <strong className="text-foreground">Favorecido:</strong> {favorecido}
          </div>
          <div className="font-mono text-[11px] text-muted-foreground truncate">
            <strong className="text-foreground">Chave:</strong> {chavePix}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 pt-1">
          <Button
            type="button"
            onClick={copiarPayloadPix}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 h-9 px-4 text-xs shadow-sm flex-1"
          >
            {copiouPayload ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiouPayload ? 'Código Copiado!' : 'Copiar Código PIX'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setQrTelaCheiaOpen(false)}
            className="h-9 text-xs"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};
