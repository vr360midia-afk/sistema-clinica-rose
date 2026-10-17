import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  FileText,
  CheckCircle2,
  QrCode,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  CreditCard,
  Banknote,
  CalendarDays,
  Percent,
  Download,
  MessageCircle,
  FileSignature,
  Building2,
  Wallet,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/exportCsv';
import { gerarPayloadPix, gerarQrCodePixUrl } from '@/utils/pixPayload';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useConfiguracoesContrato } from '@/hooks/useConfiguracoesContrato';
import { Orcamento, OrcamentoItem } from '@/hooks/useOrcamentos';

interface ModalApresentarOrcamentoProps {
  isOpen: boolean;
  onClose: () => void;
  orcamento: Orcamento | null;
  patient?: any;
  onSalvarAlteracoes?: (novoOrcamento: Partial<Orcamento> & { itens: OrcamentoItem[] }) => Promise<void>;
  onAprovar?: (orcamentoAtualizado: Orcamento, lancarFinanceiro: boolean, darBaixaImediata: boolean) => Promise<void>;
  onGerarContrato?: (orcamento: Orcamento) => void;
  onBaixarPdf?: (orcamento: Orcamento) => void;
  onEnviarWhatsApp?: (orcamento: Orcamento) => void;
}

type AbaPagamento = 'a_vista_pix' | 'cartao_parcelado' | 'entrada_parcelas' | 'pix_parcelado' | 'personalizado';

export const ModalApresentarOrcamento: React.FC<ModalApresentarOrcamentoProps> = ({
  isOpen,
  onClose,
  orcamento,
  patient,
  onSalvarAlteracoes,
  onAprovar,
  onGerarContrato,
  onBaixarPdf,
  onEnviarWhatsApp,
}) => {
  const { configuracoes } = useConfiguracoes();
  const { configContrato } = useConfiguracoesContrato();

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aprovando, setAprovando] = useState(false);

  // Estados de Desconto e Valor (oculto por padrão conforme solicitação)
  const [desconto, setDesconto] = useState<number>(0);
  const [inputValorFinal, setInputValorFinal] = useState<string>('');
  const [mostrarDesconto, setMostrarDesconto] = useState(false);

  // Estados de Formas de Pagamento
  const [abaPagamento, setAbaPagamento] = useState<AbaPagamento>('a_vista_pix');
  const [formasPagamentoTexto, setFormasPagamentoTexto] = useState<string>('');

  // Opção: À Vista
  const [descontoAVistaPerc, setDescontoAVistaPerc] = useState<number>(0);

  // Opção: Cartão Parcelado
  const [cartaoParcelasQtd, setCartaoParcelasQtd] = useState<number>(6);

  // Opção: Entrada + Parcelas
  const [entradaValor, setEntradaValor] = useState<number>(0);
  const [entradaMetodo, setEntradaMetodo] = useState<'pix' | 'dinheiro' | 'cartao'>('pix');
  const [restanteParcelasQtd, setRestanteParcelasQtd] = useState<number>(6);
  const [restanteMetodo, setRestanteMetodo] = useState<'cartao' | 'pix_parcelado' | 'boleto'>('cartao');

  // Opção: PIX Parcelado
  const [pixParcelasQtd, setPixParcelasQtd] = useState<number>(4);
  const [pixDiaVencimento, setPixDiaVencimento] = useState<number>(10);

  // Opções de Aprovação
  const [mostrarOpcoesAprovacao, setMostrarOpcoesAprovacao] = useState(false);
  const [lancarFinanceiro, setLancarFinanceiro] = useState(true);
  const [darBaixaImediata, setDarBaixaImediata] = useState(true);

  // Estado para copiar PIX e QR ampliado
  const [copiouPix, setCopiouPix] = useState(false);
  const [qrCodeAmpliadoOpen, setQrCodeAmpliadoOpen] = useState(false);

  // Sincroniza dados do orçamento selecionado ao abrir
  useEffect(() => {
    if (orcamento) {
      setDesconto(orcamento.desconto || 0);
      setInputValorFinal(orcamento.total ? String(orcamento.total) : '');
      setFormasPagamentoTexto(orcamento.formasPagamento || '');

      // Detecta forma atual
      const fp = (orcamento.formasPagamento || '').toLowerCase();
      if (fp.includes('+') || fp.includes('entrada')) {
        setAbaPagamento('entrada_parcelas');
        const entMatch = fp.match(/entrada[^\d]*?(?:r\$)?\s*([\d.,]+)/i);
        if (entMatch) {
          const v = Number(entMatch[1].replace(/\./g, '').replace(',', '.')) || 0;
          setEntradaValor(v);
        }
      } else if (fp.includes('pix parcelado') || fp.includes('pix mensal')) {
        setAbaPagamento('pix_parcelado');
        const parcMatch = fp.match(/(\d+)\s*x/i);
        if (parcMatch) setPixParcelasQtd(Number(parcMatch[1]) || 4);
      } else if (fp.includes('cart') || fp.includes('crédito') || fp.includes('credito')) {
        setAbaPagamento('cartao_parcelado');
        const parcMatch = fp.match(/(\d+)\s*x/i);
        if (parcMatch) setCartaoParcelasQtd(Number(parcMatch[1]) || 6);
      } else if (fp.includes('pix') || fp.includes('vista')) {
        setAbaPagamento('a_vista_pix');
      } else {
        setAbaPagamento('personalizado');
      }
    }
  }, [orcamento, isOpen]);

  // Cálculos de subtotal e total
  const itens = orcamento?.itens || [];
  const subtotal = useMemo(() => {
    return itens.reduce((acc, i) => acc + (i.valor || 0) * (i.quantidade || 1), 0);
  }, [itens]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - (desconto || 0));
  }, [subtotal, desconto]);

  // Atualiza campo de desconto quando digita o valor final desejado
  const handleMudarValorFinal = (valorStr: string) => {
    setInputValorFinal(valorStr);
    const num = Number(valorStr.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (isNaN(num) || num <= 0) {
      setDesconto(0);
      return;
    }
    if (num >= subtotal) {
      setDesconto(0);
    } else {
      const descCalculado = Math.max(0, Number((subtotal - num).toFixed(2)));
      setDesconto(descCalculado);
    }
  };

  // Aplica percentual rápido de desconto
  const aplicarDescontoPercentual = (perc: number) => {
    if (subtotal <= 0) return;
    if (perc === 0) {
      setDesconto(0);
      setInputValorFinal(String(subtotal));
      toast.info('Desconto removido. Valor integral mantido.');
      return;
    }
    const desc = Number(((subtotal * perc) / 100).toFixed(2));
    const valFinal = Number((subtotal - desc).toFixed(2));
    setDesconto(desc);
    setInputValorFinal(String(valFinal));
    toast.success(`Desconto de ${perc}% aplicado (-${formatMoney(desc)})! Novo total: ${formatMoney(valFinal)}`);
  };

  // Gerador dinâmico de texto da forma de pagamento selecionada
  useEffect(() => {
    if (!orcamento) return;

    if (abaPagamento === 'a_vista_pix') {
      if (descontoAVistaPerc > 0) {
        const valComDesc = Math.max(0, total * (1 - descontoAVistaPerc / 100));
        setFormasPagamentoTexto(
          `Pagamento à vista via PIX com ${descontoAVistaPerc}% de desconto especial: ${formatMoney(valComDesc)}`
        );
      } else {
        setFormasPagamentoTexto(`Pagamento à vista via PIX / Transferência: ${formatMoney(total)}`);
      }
    } else if (abaPagamento === 'cartao_parcelado') {
      const parc = Math.max(1, cartaoParcelasQtd);
      const valParc = total / parc;
      setFormasPagamentoTexto(
        `Parcelamento no Cartão de Crédito em ${parc}x de ${formatMoney(valParc)} sem juros (Total: ${formatMoney(total)})`
      );
    } else if (abaPagamento === 'entrada_parcelas') {
      const ent = Math.min(total, Math.max(0, entradaValor));
      const saldo = Math.max(0, total - ent);
      const parc = Math.max(1, restanteParcelasQtd);
      const valParc = saldo / parc;
      const metodoEntradaStr = entradaMetodo === 'pix' ? 'via PIX' : entradaMetodo === 'dinheiro' ? 'em Dinheiro' : 'no Cartão';
      const metodoRestanteStr = restanteMetodo === 'cartao' ? 'no Cartão de Crédito' : restanteMetodo === 'pix_parcelado' ? 'via PIX Parcelado' : 'no Boleto';

      if (ent > 0) {
        setFormasPagamentoTexto(
          `Entrada: ${formatMoney(ent)} ${metodoEntradaStr} + Saldo Restante: ${formatMoney(saldo)} em ${parc}x de ${formatMoney(valParc)} ${metodoRestanteStr}`
        );
      } else {
        setFormasPagamentoTexto(
          `Saldo de ${formatMoney(total)} em ${parc}x de ${formatMoney(valParc)} ${metodoRestanteStr}`
        );
      }
    } else if (abaPagamento === 'pix_parcelado') {
      const parc = Math.max(1, pixParcelasQtd);
      const valParc = total / parc;
      setFormasPagamentoTexto(
        `Plano em ${parc}x de ${formatMoney(valParc)} via PIX Parcelado (Vencimento todo dia ${pixDiaVencimento})`
      );
    }
  }, [
    abaPagamento,
    total,
    descontoAVistaPerc,
    cartaoParcelasQtd,
    entradaValor,
    entradaMetodo,
    restanteParcelasQtd,
    restanteMetodo,
    pixParcelasQtd,
    pixDiaVencimento,
  ]);

  // Identifica se há PIX na forma escolhida e qual o valor alvo do PIX
  const { temPix, valorPixAlvo, labelPixAlvo } = useMemo(() => {
    if (abaPagamento === 'a_vista_pix') {
      const valComDesc = descontoAVistaPerc > 0 ? Math.max(0, total * (1 - descontoAVistaPerc / 100)) : total;
      return { temPix: true, valorPixAlvo: valComDesc, labelPixAlvo: 'Valor Total à Vista' };
    }
    if (abaPagamento === 'entrada_parcelas' && entradaMetodo === 'pix' && entradaValor > 0) {
      return { temPix: true, valorPixAlvo: entradaValor, labelPixAlvo: 'Valor da Entrada' };
    }
    if (abaPagamento === 'pix_parcelado') {
      const valParc = total / Math.max(1, pixParcelasQtd);
      return { temPix: true, valorPixAlvo: valParc, labelPixAlvo: 'Valor da 1ª Parcela PIX' };
    }
    if (abaPagamento === 'personalizado' && /pix/i.test(formasPagamentoTexto)) {
      return { temPix: true, valorPixAlvo: total, labelPixAlvo: 'Valor PIX' };
    }
    return { temPix: false, valorPixAlvo: 0, labelPixAlvo: '' };
  }, [abaPagamento, total, descontoAVistaPerc, entradaValor, entradaMetodo, pixParcelasQtd, formasPagamentoTexto]);

  // Dados oficiais da clínica para o PIX
  const chavePixOficial =
    configContrato?.chavePix ||
    configuracoes?.telefone ||
    configuracoes?.cnpj ||
    '';
  const tipoChavePixOficial = configContrato?.tipoChavePix || 'telefone';
  const favorecidoPixOficial =
    configContrato?.favorecidoPix ||
    configuracoes?.nomeClinica ||
    'Clínica Odontológica';
  const cidadePixOficial = configContrato?.cidadeForoContrato || 'Maceió';

  // Gera o Payload Oficial Bacen com o valor em tempo real
  const payloadPix = useMemo(() => {
    if (!temPix || !chavePixOficial || valorPixAlvo <= 0) return '';
    return gerarPayloadPix({
      chave: chavePixOficial,
      tipoChave: tipoChavePixOficial,
      nomeFavorecido: favorecidoPixOficial,
      cidade: cidadePixOficial,
      valor: valorPixAlvo,
      descricao: `Orc #${orcamento?.id ? orcamento.id.slice(0, 8).toUpperCase() : ''}`.slice(0, 25),
    });
  }, [temPix, chavePixOficial, tipoChavePixOficial, favorecidoPixOficial, cidadePixOficial, valorPixAlvo, orcamento?.id]);

  const qrCodeUrl = useMemo(() => {
    if (payloadPix) {
      return gerarQrCodePixUrl(payloadPix, 280);
    }
    return chavePixOficial
      ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=4&data=${encodeURIComponent(chavePixOficial)}`
      : '';
  }, [payloadPix, chavePixOficial]);

  const qrCodeGrandeUrl = useMemo(() => {
    if (payloadPix) {
      return gerarQrCodePixUrl(payloadPix, 450);
    }
    return qrCodeUrl;
  }, [payloadPix, qrCodeUrl]);

  // Copia o código Copia e Cola
  const handleCopiarPix = () => {
    if (!payloadPix) {
      if (chavePixOficial) {
        navigator.clipboard.writeText(chavePixOficial);
        setCopiouPix(true);
        toast.success('Chave PIX da clínica copiada!');
        setTimeout(() => setCopiouPix(false), 2500);
      }
      return;
    }
    navigator.clipboard.writeText(payloadPix);
    setCopiouPix(true);
    toast.success(`Código PIX Copia e Cola (${formatMoney(valorPixAlvo)}) copiado com sucesso!`);
    setTimeout(() => setCopiouPix(false), 2500);
  };

  // Salvar alterações de desconto e formas de pagamento
  const handleSalvarCondicoes = async () => {
    if (!orcamento || !onSalvarAlteracoes) return;
    try {
      setSalvando(true);
      await onSalvarAlteracoes({
        id: orcamento.id,
        titulo: orcamento.titulo,
        itens: orcamento.itens,
        desconto,
        formasPagamento: formasPagamentoTexto,
        status: orcamento.status,
      });
      toast.success('Condições do orçamento atualizadas com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao salvar condições');
    } finally {
      setSalvando(false);
    }
  };

  // Aprovação imediata com o paciente na sala
  const handleConfirmarAprovacao = async () => {
    if (!orcamento || !onAprovar) return;
    try {
      setAprovando(true);
      const orcamentoAtualizado: Orcamento = {
        ...orcamento,
        desconto,
        total,
        formasPagamento: formasPagamentoTexto,
        status: 'aprovado',
      };

      if (onSalvarAlteracoes) {
        await onSalvarAlteracoes({
          id: orcamento.id,
          titulo: orcamento.titulo,
          itens: orcamento.itens,
          desconto,
          formasPagamento: formasPagamentoTexto,
          status: 'aprovado',
        });
      }

      await onAprovar(orcamentoAtualizado, lancarFinanceiro, darBaixaImediata);
      toast.success('Orçamento APROVADO com sucesso com o paciente!');
      setMostrarOpcoesAprovacao(false);
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao aprovar orçamento');
    } finally {
      setAprovando(false);
    }
  };

  if (!orcamento) return null;

  const isAprovado = orcamento.status === 'aprovado';

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className={cn(
            'transition-all duration-200 overflow-hidden flex flex-col p-0 gap-0 border-border bg-background',
            isFullScreen
              ? 'max-w-[100vw] w-screen h-screen max-h-screen rounded-none'
              : 'max-w-5xl w-full max-h-[92vh] rounded-2xl shadow-2xl'
          )}
        >
          {/* Topo Oficial com Identidade da Clínica & Paciente (Minimalista & Elegante) */}
          <div className="bg-card dark:bg-card/95 border-b border-border/80 px-5 sm:px-6 py-4 flex-shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-8">
              <div className="flex items-center gap-3.5">
                {configuracoes?.logoUrl ? (
                  <div className="h-11 w-11 rounded-xl bg-background border border-border/70 p-1 flex items-center justify-center shrink-0 shadow-xs">
                    <img
                      src={configuracoes?.logoUrl}
                      alt="Logo da Clínica"
                      className="h-full w-full object-contain rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="h-11 w-11 rounded-xl bg-muted/60 border border-border/60 flex items-center justify-center shrink-0 shadow-xs">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/40">
                      Apresentação do Orçamento
                    </span>
                    <Badge
                      variant={isAprovado ? 'default' : 'secondary'}
                      className={cn(
                        'text-[10px] font-semibold border-0 py-0.5 px-2 capitalize',
                        isAprovado
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {orcamento.status || 'rascunho'}
                    </Badge>
                  </div>

                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                    {orcamento.titulo || 'Plano de Tratamento Odontológico'}
                  </h2>

                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>Paciente: <strong className="text-foreground font-semibold">{patient?.nome || orcamento.pacienteNome || 'Não informado'}</strong></span>
                    <span>•</span>
                    <span className="font-mono text-[11px] text-muted-foreground/80">
                      #{orcamento.id ? orcamento.id.slice(0, 8).toUpperCase() : 'NOVO'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Botão de Tela Cheia Minimalista */}
              <div className="flex items-center gap-2 self-start sm:self-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground border-border/60 gap-1.5"
                  title={isFullScreen ? 'Sair da tela cheia' : 'Apresentar em tela cheia'}
                >
                  {isFullScreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{isFullScreen ? 'Reduzir' : 'Tela Cheia'}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Corpo Rolável */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* 1. Procedimentos e Plano de Tratamento */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-bold text-sm sm:text-base text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Procedimentos Inclusos no Tratamento
                </h3>
                <span className="text-xs text-muted-foreground font-medium">
                  {itens.length} {itens.length === 1 ? 'item' : 'itens planejados'}
                </span>
              </div>

              <div className="border rounded-xl overflow-hidden shadow-xs bg-card">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-muted/70 text-muted-foreground font-semibold text-left border-b">
                    <tr>
                      <th className="p-3 w-12 text-center">#</th>
                      <th className="p-3">Procedimento</th>
                      <th className="p-3 text-center">Qtd.</th>
                      <th className="p-3 text-right">Valor Unit.</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {itens.map((item, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 text-center font-bold text-muted-foreground">{idx + 1}</td>
                        <td className="p-3 font-semibold text-foreground">
                          {item.nome}
                        </td>
                        <td className="p-3 text-center text-muted-foreground font-medium">
                          {item.quantidade}x
                        </td>
                        <td className="p-3 text-right text-muted-foreground">
                          {formatMoney(item.valor)}
                        </td>
                        <td className="p-3 text-right font-bold text-foreground">
                          {formatMoney(item.valor * item.quantidade)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {orcamento.observacoes && (
                <div className="p-3 rounded-xl bg-muted/40 border border-border/70 text-xs text-foreground/90">
                  <span className="font-semibold block mb-0.5 text-foreground">
                    Observações Clínicas e Orientações:
                  </span>
                  {orcamento.observacoes}
                </div>
              )}
            </div>

            {/* 2. Resumo de Investimento & Negociação Oculta */}
            <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
              {/* Barra Principal do Investimento */}
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-card via-card to-muted/20">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Investimento Total do Tratamento
                    </span>
                    {desconto > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium">
                        Condição Especial Aplicada
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
                      {formatMoney(total)}
                    </span>
                    {desconto > 0 && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                        <span className="line-through">{formatMoney(subtotal)}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          (-{formatMoney(desconto)})
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Inclui todos os {itens.length} {itens.length === 1 ? 'procedimento clínico planejado' : 'procedimentos clínicos planejados'} para o paciente.
                  </p>
                </div>

                {/* Gatilho Discreto para Expandir Negociação / Desconto */}
                <div className="flex items-center gap-2 self-start sm:self-center">
                  {desconto > 0 && !mostrarDesconto && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => aplicarDescontoPercentual(0)}
                      className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive"
                      title="Remover desconto aplicado"
                    >
                      Remover Desconto
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMostrarDesconto(!mostrarDesconto)}
                    className={cn(
                      'h-8 px-3 text-xs gap-1.5 transition-all border-border/70',
                      mostrarDesconto
                        ? 'bg-muted text-foreground border-border'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>{mostrarDesconto ? 'Fechar Negociação' : 'Condição Especial / Desconto'}</span>
                    {mostrarDesconto ? (
                      <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Gaveta Expansível de Negociação / Descontos (Apenas visível se o profissional abrir) */}
              {mostrarDesconto && (
                <div className="p-4 sm:p-5 border-t border-border/70 bg-muted/30 animate-in slide-in-from-top-2 duration-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-primary" />
                      <span className="text-xs font-bold text-foreground">
                        Painel Interno de Negociação
                      </span>
                      <span className="text-[11px] text-muted-foreground hidden sm:inline">
                        (Ajuste valores e condições somente se necessário)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setMostrarDesconto(false)}
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Concluir Ajuste
                    </Button>
                  </div>

                  {/* Chips Rápidos */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground block">
                      Descontos rápidos pré-definidos:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[0, 5, 8, 10, 15, 20].map((perc) => (
                        <Button
                          key={perc}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => aplicarDescontoPercentual(perc)}
                          className={cn(
                            'h-7 px-2.5 text-xs font-semibold rounded-lg transition-all',
                            perc === 0
                              ? 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                              : 'border-border/80 text-foreground hover:border-primary/50 hover:bg-primary/5'
                          )}
                        >
                          {perc === 0 ? 'Sem Desconto (Integral)' : `${perc}% OFF`}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Entradas Manuais */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Desconto em Reais (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        max={subtotal}
                        value={desconto || ''}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value) || 0);
                          setDesconto(val);
                          setInputValorFinal(String(Math.max(0, subtotal - val)));
                        }}
                        placeholder="0,00"
                        className="h-9 font-bold text-foreground"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Ou Digite o Valor Final Desejado (R$)</Label>
                      <Input
                        type="text"
                        value={inputValorFinal}
                        onChange={(e) => handleMudarValorFinal(e.target.value)}
                        placeholder={formatMoney(subtotal)}
                        className="h-9 font-bold text-foreground"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Liberar e Personalizar Formas de Pagamento na Tela */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-card space-y-4 shadow-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-foreground flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    Condições & Formas de Pagamento
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Selecione a modalidade combinada. O cálculo e o QR Code PIX são ajustados instantaneamente.
                  </p>
                </div>
              </div>

              {/* Seletor de Modalidade */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setAbaPagamento('a_vista_pix')}
                  className={cn(
                    'p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 text-xs',
                    abaPagamento === 'a_vista_pix'
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/20'
                      : 'bg-muted/30 border-border/70 hover:border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span className="font-bold flex items-center gap-1.5">
                    <QrCode className="h-4 w-4" /> À Vista (PIX)
                  </span>
                  <span className={cn('text-[11px]', abaPagamento === 'a_vista_pix' ? 'opacity-90' : 'text-muted-foreground')}>
                    QR Code com valor total
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setAbaPagamento('cartao_parcelado')}
                  className={cn(
                    'p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 text-xs',
                    abaPagamento === 'cartao_parcelado'
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/20'
                      : 'bg-muted/30 border-border/70 hover:border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span className="font-bold flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4" /> Cartão de Crédito
                  </span>
                  <span className={cn('text-[11px]', abaPagamento === 'cartao_parcelado' ? 'opacity-90' : 'text-muted-foreground')}>
                    Até 12x parcelado
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setAbaPagamento('entrada_parcelas')}
                  className={cn(
                    'p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 text-xs',
                    abaPagamento === 'entrada_parcelas'
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/20'
                      : 'bg-muted/30 border-border/70 hover:border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span className="font-bold flex items-center gap-1.5">
                    <Banknote className="h-4 w-4" /> Entrada + Parcelas
                  </span>
                  <span className={cn('text-[11px]', abaPagamento === 'entrada_parcelas' ? 'opacity-90' : 'text-muted-foreground')}>
                    Entrada + Saldo Parcelado
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setAbaPagamento('pix_parcelado')}
                  className={cn(
                    'p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 text-xs',
                    abaPagamento === 'pix_parcelado'
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/20'
                      : 'bg-muted/30 border-border/70 hover:border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span className="font-bold flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4" /> PIX Parcelado
                  </span>
                  <span className={cn('text-[11px]', abaPagamento === 'pix_parcelado' ? 'opacity-90' : 'text-muted-foreground')}>
                    Parcelas mensais via PIX
                  </span>
                </button>
              </div>

              {/* Conteúdo Dinâmico por Modalidade */}
              <div className="bg-background rounded-xl p-4 border border-border/70 space-y-4">
                {/* 1. Opção À Vista PIX */}
                {abaPagamento === 'a_vista_pix' && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/60 text-xs">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Pagamento à Vista via PIX Oficial Bacen</p>
                      <p className="text-[11px] text-muted-foreground">
                        Aprovação imediata do plano e liberação dos agendamentos. Utilize o QR Code dinâmico abaixo para pagamento direto pelo app do banco.
                      </p>
                    </div>
                  </div>
                )}

                {/* 2. Opção Cartão Parcelado */}
                {abaPagamento === 'cartao_parcelado' && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-foreground">Selecione o Número de Parcelas no Cartão:</Label>
                      <span className="text-[11px] text-muted-foreground font-medium">Sem acréscimo</span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((parc) => {
                        const valParc = total / parc;
                        const isSelected = cartaoParcelasQtd === parc;
                        return (
                          <button
                            key={parc}
                            type="button"
                            onClick={() => setCartaoParcelasQtd(parc)}
                            className={cn(
                              'p-2.5 rounded-xl border text-center transition-all text-xs flex flex-col items-center justify-center gap-0.5',
                              isSelected
                                ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                                : 'bg-muted/20 border-border/70 hover:border-border hover:bg-muted/50 text-foreground'
                            )}
                          >
                            <span className="font-bold text-sm">{parc}x</span>
                            <span className={cn('text-[11px]', isSelected ? 'opacity-90 font-medium' : 'text-muted-foreground')}>
                              {formatMoney(valParc)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Opção Entrada + Parcelas */}
                {abaPagamento === 'entrada_parcelas' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Valor da Entrada (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          max={total}
                          value={entradaValor || ''}
                          onChange={(e) => setEntradaValor(Math.max(0, Number(e.target.value) || 0))}
                          placeholder="Ex: 500,00"
                          className="font-bold text-foreground h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Forma da Entrada</Label>
                        <div className="grid grid-cols-3 gap-1">
                          {(['pix', 'dinheiro', 'cartao'] as const).map((m) => (
                            <Button
                              key={m}
                              type="button"
                              size="sm"
                              variant={entradaMetodo === m ? 'default' : 'outline'}
                              onClick={() => setEntradaMetodo(m)}
                              className="h-9 text-xs capitalize px-1 border-border/70"
                            >
                              {m === 'pix' ? 'PIX' : m === 'dinheiro' ? 'Dinheiro' : 'Cartão'}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Parcelas do Saldo Restante</Label>
                        <div className="flex gap-1.5 flex-wrap">
                          {[2, 3, 4, 5, 6, 10, 12].map((p) => (
                            <Button
                              key={p}
                              type="button"
                              size="sm"
                              variant={restanteParcelasQtd === p ? 'default' : 'outline'}
                              onClick={() => setRestanteParcelasQtd(p)}
                              className="h-9 px-2.5 text-xs font-semibold border-border/70"
                            >
                              {p}x
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Opção PIX Parcelado */}
                {abaPagamento === 'pix_parcelado' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Número de Parcelas Mensais via PIX:</Label>
                        <div className="flex gap-1.5 flex-wrap">
                          {[2, 3, 4, 5, 6, 8, 10].map((p) => (
                            <Button
                              key={p}
                              type="button"
                              size="sm"
                              variant={pixParcelasQtd === p ? 'default' : 'outline'}
                              onClick={() => setPixParcelasQtd(p)}
                              className="h-8 px-3 text-xs font-bold border-border/70"
                            >
                              {p}x
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Dia de Vencimento Mensal:</Label>
                        <div className="flex gap-1.5 flex-wrap">
                          {[5, 10, 15, 20, 25].map((d) => (
                            <Button
                              key={d}
                              type="button"
                              size="sm"
                              variant={pixDiaVencimento === d ? 'default' : 'outline'}
                              onClick={() => setPixDiaVencimento(d)}
                              className="h-8 px-2.5 text-xs font-semibold border-border/70"
                            >
                              Dia {d}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Texto da Condição Formal */}
                <div className="space-y-1 pt-2 border-t border-border/60">
                  <Label className="text-[11px] text-muted-foreground">Descrição das Condições de Pagamento:</Label>
                  <Textarea
                    rows={2}
                    value={formasPagamentoTexto}
                    onChange={(e) => {
                      setFormasPagamentoTexto(e.target.value);
                      setAbaPagamento('personalizado');
                    }}
                    placeholder="Descrição das formas de pagamento..."
                    className="text-xs font-medium resize-none bg-background border-border/70"
                  />
                </div>
              </div>

              {/* 4. Card do QR Code PIX em Tempo Real se a forma for PIX */}
              {temPix && (
                <div className="p-4 sm:p-5 rounded-2xl bg-muted/20 border border-border/80 shadow-xs flex flex-col sm:flex-row items-center gap-5">
                  <div className="bg-white p-2.5 rounded-xl border border-border shadow-xs shrink-0 text-center">
                    <img
                      src={qrCodeUrl}
                      alt="QR Code PIX Bacen"
                      className="w-36 h-36 sm:w-40 sm:h-40 block mx-auto rounded"
                    />
                    <button
                      type="button"
                      onClick={() => setQrCodeAmpliadoOpen(true)}
                      className="text-[10px] text-muted-foreground hover:text-foreground font-semibold block mt-1.5 transition-colors"
                    >
                      🔍 Clique p/ Ampliar
                    </button>
                  </div>

                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                      <span className="p-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <QrCode className="h-4 w-4" />
                      </span>
                      <span className="font-bold text-sm text-foreground">
                        QR Code Oficial Bacen — {labelPixAlvo}
                      </span>
                    </div>

                    <div className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                      {formatMoney(valorPixAlvo)}
                    </div>

                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>Chave PIX: <strong className="font-mono text-foreground">{chavePixOficial || 'Sob consulta'}</strong></p>
                      <p>Favorecido: <strong className="text-foreground">{favorecidoPixOficial}</strong></p>
                    </div>

                    <p className="text-[11px] text-muted-foreground pt-0.5">
                      O paciente pode apontar a câmera do celular agora mesmo para efetuar o pagamento.
                    </p>

                    <div className="flex flex-wrap gap-2 pt-1 justify-center sm:justify-start">
                      <Button
                        size="sm"
                        onClick={handleCopiarPix}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5"
                      >
                        {copiouPix ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiouPix ? 'Código PIX Copiado!' : 'Copiar Código Copia e Cola'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setQrCodeAmpliadoOpen(true)}
                        className="border-border text-foreground hover:bg-muted text-xs gap-1"
                      >
                        <Maximize2 className="h-3.5 w-3.5" /> Tela Cheia
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Rodapé de Ações & Aprovação */}
          <div className="bg-card border-t border-border/80 px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
            <div className="flex items-center gap-2 w-full sm:w-auto justify-start flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSalvarCondicoes}
                disabled={salvando}
                className="text-xs border-border/70"
              >
                Salvar Alterações
              </Button>
              {onBaixarPdf && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onBaixarPdf({ ...orcamento, desconto, total, formasPagamento: formasPagamentoTexto })}
                  className="text-xs gap-1 border-border/70"
                >
                  <Download className="h-3.5 w-3.5" /> PDF
                </Button>
              )}
              {onEnviarWhatsApp && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEnviarWhatsApp({ ...orcamento, desconto, total, formasPagamento: formasPagamentoTexto })}
                  className="text-xs gap-1 border-border/70 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </Button>
              )}
              {onGerarContrato && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onGerarContrato({ ...orcamento, desconto, total, formasPagamento: formasPagamentoTexto })}
                  className="text-xs gap-1 border-border/70 text-primary hover:bg-primary/10"
                >
                  <FileSignature className="h-3.5 w-3.5" /> Contrato
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button variant="ghost" size="sm" onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
                Fechar
              </Button>

              {!isAprovado ? (
                <Button
                  size="sm"
                  onClick={() => setMostrarOpcoesAprovacao(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 text-xs sm:text-sm gap-1.5 shadow-sm"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Aprovar Orçamento com o Paciente
                </Button>
              ) : (
                <Badge className="bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 border border-emerald-600/30 text-xs px-3 py-1 font-bold gap-1">
                  <Check className="h-3.5 w-3.5" /> Orçamento Já Aprovado
                </Badge>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subdialog de Confirmação de Aprovação e Lançamento Financeiro */}
      <Dialog open={mostrarOpcoesAprovacao} onOpenChange={setMostrarOpcoesAprovacao}>
        <DialogContent className="max-w-md w-full p-5 space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Confirmar Aprovação com o Paciente
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              O plano <strong>{orcamento.titulo}</strong> no valor final de <strong>{formatMoney(total)}</strong> será aprovado formalmente.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-muted/50 rounded-lg border border-border text-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold block text-foreground">Lançar no Contas a Receber</span>
                <span className="text-muted-foreground text-[11px]">Cria as parcelas no financeiro da clínica</span>
              </div>
              <Switch checked={lancarFinanceiro} onCheckedChange={setLancarFinanceiro} />
            </div>

            {lancarFinanceiro && (
              <div className="flex items-center justify-between pt-2 border-t border-border/60">
                <div>
                  <span className="font-semibold block text-emerald-600">Dar Baixa Imediata</span>
                  <span className="text-muted-foreground text-[11px]">Se o paciente já pagou no PIX / Cartão na hora</span>
                </div>
                <Switch checked={darBaixaImediata} onCheckedChange={setDarBaixaImediata} />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setMostrarOpcoesAprovacao(false)} disabled={aprovando}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmarAprovacao}
              disabled={aprovando}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {aprovando ? 'Aprovando...' : 'Confirmar e Aprovar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Dialog de QR Code Ampliado em Alta Resolução */}
      <Dialog open={qrCodeAmpliadoOpen} onOpenChange={setQrCodeAmpliadoOpen}>
        <DialogContent className="max-w-md w-full p-6 text-center">
          <DialogHeader className="text-center">
            <DialogTitle className="text-lg font-bold text-foreground flex items-center justify-center gap-2">
              <QrCode className="h-5 w-5 text-emerald-600" />
              PIX Oficial — {labelPixAlvo}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Aponte a câmera do aplicativo bancário para pagar o valor de <strong>{formatMoney(valorPixAlvo)}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="my-3 p-4 bg-white rounded-2xl border-2 border-emerald-400 inline-block mx-auto shadow-md">
            <img src={qrCodeGrandeUrl} alt="QR Code PIX Grande" className="w-64 h-64 mx-auto block rounded" />
            <span className="text-[10px] font-bold text-emerald-700 block mt-2 uppercase tracking-wide">
              Padrão Oficial Banco Central (Bacen)
            </span>
          </div>

          <div className="p-3 bg-muted/60 rounded-lg text-left text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor:</span>
              <strong className="text-emerald-600 text-sm">{formatMoney(valorPixAlvo)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Chave:</span>
              <span className="font-mono font-bold text-foreground">{chavePixOficial}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Favorecido:</span>
              <span className="font-medium text-foreground">{favorecidoPixOficial}</span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Button
              onClick={handleCopiarPix}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 gap-2 text-xs"
            >
              {copiouPix ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiouPix ? 'Código PIX Copiado!' : 'Copiar Código Copia e Cola'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setQrCodeAmpliadoOpen(false)} className="w-full text-xs">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ModalApresentarOrcamento;
