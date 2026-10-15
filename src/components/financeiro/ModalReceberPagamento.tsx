import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { QrCode, Copy, CheckCircle2, Receipt, ArrowRight, Wallet, User, Calendar as CalendarIcon, Sparkles, Check, Smartphone } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { useConfiguracoesContrato } from '@/hooks/useConfiguracoesContrato';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
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
  const { pacientes, updateTransacao, addTransacao } = useDentalSystem();
  const { configContrato } = useConfiguracoesContrato();
  const { configuracoes } = useConfiguracoes();

  const [pacienteId, setPacienteId] = useState('');
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

  useEffect(() => {
    if (isOpen) {
      if (transacaoPendente) {
        setPacienteId(transacaoPendente.pacienteId || '');
        setValor(String(transacaoPendente.valor || ''));
        setDescricao(transacaoPendente.descricao || 'Recebimento');
        setMetodo(transacaoPendente.metodoPagamento || 'pix');
      } else {
        setPacienteId(pacientePredefinidoId || '');
        setValor(valorSugerido ? String(valorSugerido) : '');
        setDescricao(descricaoSugerida || 'Recebimento de Tratamento');
        setMetodo('pix');
      }
      setDataRecebimento(new Date().toISOString().slice(0, 10));
      setGerarReciboAposBaixa(false);
      setCopiouPayload(false);
      setCopiouChave(false);
    }
  }, [isOpen, transacaoPendente, pacientePredefinidoId, valorSugerido, descricaoSugerida]);

  const chavePix = configContrato?.chavePix || configuracoes?.telefone || configuracoes?.cnpj || '';
  const tipoChave = configContrato?.tipoChavePix;
  const favorecido = configContrato?.favorecidoPix || configuracoes?.nomeClinica || 'Clínica Odontológica';
  const cidade = configuracoes?.cidade || 'SAO PAULO';

  const valNum = parseFloat(valor) || 0;

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

  const handleConfirmarRecebimento = async () => {
    const valNum = parseFloat(valor);
    if (!valNum || valNum <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    if (!pacienteId && !transacaoPendente?.pacienteId) {
      toast.error('Selecione o paciente');
      return;
    }

    setLoading(true);
    try {
      const pId = pacienteId || transacaoPendente?.pacienteId || '';
      const pacienteObj = pacientes.find((p) => p.id === pId);
      const dataObj = new Date(`${dataRecebimento}T12:00:00`);

      let transacaoFinal: any = null;

      if (transacaoPendente?.id) {
        // Atualiza a transação existente para 'pago' e altera a data para a data do efetivo recebimento
        const updates = {
          status: 'pago' as const,
          data: dataObj,
          metodoPagamento: metodo,
          valor: valNum,
          descricao: descricao.trim() || transacaoPendente.descricao,
        };
        await updateTransacao(transacaoPendente.id, updates);
        transacaoFinal = { ...transacaoPendente, ...updates };
        toast.success(`Recebimento de ${formatMoney(valNum)} confirmado no Caixa!`);
      } else {
        // Cria nova receita paga diretamente
        const novaData = {
          pacienteId: pId,
          pacienteNome: pacienteObj?.nome,
          tipo: 'receita' as const,
          status: 'pago' as const,
          metodoPagamento: metodo,
          valor: valNum,
          data: dataObj,
          descricao: descricao.trim() || 'Recebimento de Procedimento',
          orcamentoId: orcamentoIdPredefinido || undefined,
        };
        transacaoFinal = await addTransacao(novaData);
        toast.success(`Recebimento de ${formatMoney(valNum)} registrado com sucesso no Caixa!`);
      }

      if (gerarReciboAposBaixa && pacienteObj) {
        try {
          await gerarRecibo(
            {
              numero: String(transacaoFinal?.id || Date.now()).slice(0, 8).toUpperCase(),
              pacienteNome: pacienteObj.nome,
              descricao: descricao || 'Tratamento odontológico',
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
                  Baixa Imediata
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-emerald-100 text-xs mt-0.5">
                Confirme o recebimento para computar na Receita Caixa na data escolhida.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
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
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Paciente *</Label>
                <Select value={pacienteId} onValueChange={setPacienteId} disabled={!!transacaoPendente}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione o paciente" />
                  </SelectTrigger>
                  <SelectContent>
                    {pacientes.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Valor Recebido (R$) *</Label>
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Forma de Pagamento *</Label>
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

              <div>
                <Label className="text-xs font-semibold">Data do Recebimento (Caixa) *</Label>
                <Input
                  type="date"
                  value={dataRecebimento}
                  onChange={(e) => setDataRecebimento(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Descrição / Referência</Label>
              <Input
                placeholder="Ex: Consulta de avaliação, Parcela 1/3, Entrada..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

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
              disabled={loading || !valor || parseFloat(valor) <= 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold"
            >
              <CheckCircle2 className="h-4 w-4" />
              {loading ? 'Confirmando...' : 'Confirmar e Entrar no Caixa'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
