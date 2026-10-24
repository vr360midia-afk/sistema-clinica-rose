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
  Link as LinkIcon,
  Plus,
  Trash2,
  Sparkles,
  Pencil,
  Layers,
  ArrowRight,
  DollarSign,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/exportCsv';
import { gerarPayloadPix, gerarQrCodePixUrl } from '@/utils/pixPayload';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useConfiguracoesContrato } from '@/hooks/useConfiguracoesContrato';
import { Orcamento, OrcamentoItem } from '@/hooks/useOrcamentos';
import { mapearDadosContrato, gerarLinkAssinaturaContrato } from '@/utils/contratoEngine';
import { openWhatsApp } from '@/lib/whatsapp';
import {
  CondicaoPagamento,
  TipoCondicaoPagamento,
  parseCondicoesPagamento,
  serializarCondicoesPagamento,
  calcularDescricaoCondicao,
  gerarTextoWhatsAppCondicoes,
  gerarTrioPropostasSugeridas,
  obterCondicaoAtiva,
  filtrarApenasCondicaoEscolhida,
  ItemFormaComposta,
  montarTextoFormasCompostas,
  parseTextoParaFormasCompostas,
  recalcularValoresCondicaoComNovoTotal,
} from '@/utils/orcamentoCondicoes';
import CardSimulacaoTaxasCartao, { BadgeLiquidoInternoCartao } from '@/components/orcamentos/CardSimulacaoTaxasCartao';

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

  // Estados de Múltiplas Condições de Pagamento / Propostas de Negociação
  const [condicoes, setCondicoes] = useState<CondicaoPagamento[]>([]);
  const [condicaoSelecionadaId, setCondicaoSelecionadaId] = useState<string>('');
  const [mostrarMargemInterna, setMostrarMargemInterna] = useState(false);

  // Modal para Criar / Editar Condição de Negociação
  const [modalCondicaoOpen, setModalCondicaoOpen] = useState(false);
  const [condicaoEmEdicao, setCondicaoEmEdicao] = useState<Partial<CondicaoPagamento> | null>(null);

  // Opções de Aprovação
  const [mostrarOpcoesAprovacao, setMostrarOpcoesAprovacao] = useState(false);
  const [lancarFinanceiro, setLancarFinanceiro] = useState(true);
  const [darBaixaImediata, setDarBaixaImediata] = useState(false);

  // Estado para copiar PIX e QR ampliado
  const [copiouPix, setCopiouPix] = useState(false);
  const [qrCodeAmpliadoOpen, setQrCodeAmpliadoOpen] = useState(false);
  const [copiouLinkContrato, setCopiouLinkContrato] = useState(false);

  // Sincroniza dados do orçamento selecionado ao abrir
  useEffect(() => {
    if (orcamento) {
      setDesconto(orcamento.desconto || 0);
      setInputValorFinal(orcamento.total ? String(orcamento.total) : '');

      const parsed = parseCondicoesPagamento(orcamento.formasPagamento, orcamento.total || 0);
      if (parsed.length > 0) {
        setCondicoes(parsed);
        const sel = orcamento.status === 'aprovado' ? parsed.find((c) => c.selecionada) : undefined;
        setCondicaoSelecionadaId(sel ? sel.id : '');
      } else {
        const trio = gerarTrioPropostasSugeridas(orcamento.total || 0);
        setCondicoes(trio);
        setCondicaoSelecionadaId('');
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

  // Condição de pagamento ativa / selecionada pelo paciente
  const condicaoAtiva = useMemo(() => {
    if (!condicaoSelecionadaId) return null;
    return condicoes.find((c) => c.id === condicaoSelecionadaId) || null;
  }, [condicoes, condicaoSelecionadaId]);

  // Serializa texto das condições para salvar e para o contrato
  const formasPagamentoTexto = useMemo(() => {
    return serializarCondicoesPagamento(condicoes, condicaoSelecionadaId);
  }, [condicoes, condicaoSelecionadaId]);

  // Identifica se há PIX na forma escolhida e qual o valor alvo do PIX
  const { temPix, valorPixAlvo, labelPixAlvo } = useMemo(() => {
    if (!condicaoAtiva) return { temPix: false, valorPixAlvo: 0, labelPixAlvo: '' };

    if (condicaoAtiva.tipo === 'a_vista') {
      return {
        temPix: true,
        valorPixAlvo: condicaoAtiva.valorTotal || total,
        labelPixAlvo: 'Valor com Desconto à Vista',
      };
    }

    if (condicaoAtiva.tipo === 'entrada_saldo') {
      const isPix = !condicaoAtiva.metodoEntrada || condicaoAtiva.metodoEntrada === 'pix';
      if (isPix && (condicaoAtiva.valorEntrada || 0) > 0) {
        return {
          temPix: true,
          valorPixAlvo: condicaoAtiva.valorEntrada || 0,
          labelPixAlvo: 'Valor da Entrada via PIX',
        };
      }
    }

    if (condicaoAtiva.tipo === 'pix_parcelado') {
      const ent = condicaoAtiva.valorEntrada || 0;
      if (ent > 0) {
        return {
          temPix: true,
          valorPixAlvo: ent,
          labelPixAlvo: 'Valor da Entrada via PIX',
        };
      }
      const p = Math.max(1, condicaoAtiva.parcelas || 3);
      const valParc = (condicaoAtiva.valorTotal || total) / p;
      return {
        temPix: true,
        valorPixAlvo: valParc,
        labelPixAlvo: 'Valor da 1ª Parcela via PIX',
      };
    }

    if (/pix/i.test(condicaoAtiva.descricao || '')) {
      const matchV = (condicaoAtiva.descricao || '').match(/(?:r\$)?\s*([\d.,]+)/i);
      const val = matchV ? Number(matchV[1].replace(/\./g, '').replace(',', '.')) : total;
      return {
        temPix: true,
        valorPixAlvo: val || total,
        labelPixAlvo: 'Valor via PIX',
      };
    }

    return { temPix: false, valorPixAlvo: 0, labelPixAlvo: '' };
  }, [condicaoAtiva, total]);

  // Ações de gerenciamento de condições
  const handleSelecionarCondicao = (id: string) => {
    const novoId = condicaoSelecionadaId === id ? '' : id;
    setCondicaoSelecionadaId(novoId);
    setCondicoes((prev) =>
      prev.map((c) => ({
        ...c,
        selecionada: novoId ? c.id === novoId : false,
      }))
    );
    if (novoId) {
      const cond = condicoes.find((c) => c.id === novoId);
      toast.success(`"${cond?.titulo || 'Proposta'}" selecionada como condição escolhida!`);
    } else {
      toast.info('Seleção removida. Nenhuma opção marcada como escolhida.');
    }
  };

  const handleGerarTrioSugerido = () => {
    const trio = gerarTrioPropostasSugeridas(total);
    setCondicoes(trio);
    setCondicaoSelecionadaId('');
    toast.success('3 propostas de negociação geradas com base no total do orçamento!');
  };

  const handleRemoverCondicao = (id: string) => {
    if (condicoes.length <= 1) {
      toast.error('Mantenha pelo menos uma condição de pagamento no orçamento.');
      return;
    }
    const novas = condicoes.filter((c) => c.id !== id);
    setCondicoes(novas);
    if (condicaoSelecionadaId === id) {
      setCondicaoSelecionadaId(novas[0].id);
    }
    toast.info('Condição de negociação removida');
  };

  const handleAbrirNovaCondicao = () => {
    const novoId = String(Date.now());
    const pDef = 6;
    setCondicaoEmEdicao({
      id: novoId,
      titulo: `Opção ${condicoes.length + 1}: Parcelado em ${pDef}x`,
      tipo: 'cartao',
      parcelas: pDef,
      valorTotal: total,
      tipoCartao: 'credito',
      destaque: false,
      selecionada: false,
    });
    setModalCondicaoOpen(true);
  };

  const handleAbrirEditarCondicao = (c: CondicaoPagamento) => {
    let formas = c.formasCompostas;
    if ((!formas || formas.length === 0) && (c.tipo === 'personalizado' || !c.tipo)) {
      formas = parseTextoParaFormasCompostas(c.descricao || '', total);
    }
    setCondicaoEmEdicao({ ...c, formasCompostas: formas });
    setModalCondicaoOpen(true);
  };

  const handleSalvarCondicaoEmEdicao = () => {
    if (!condicaoEmEdicao || !condicaoEmEdicao.titulo?.trim()) {
      toast.error('Informe um título para a condição (ex: Opção 1: À Vista no PIX).');
      return;
    }
    const descAuto = calcularDescricaoCondicao(condicaoEmEdicao, total);
    const condFinal: CondicaoPagamento = {
      id: condicaoEmEdicao.id || String(Date.now()),
      titulo: condicaoEmEdicao.titulo.trim(),
      tipo: condicaoEmEdicao.tipo || 'personalizado',
      descontoPercentual: condicaoEmEdicao.descontoPercentual,
      descontoValor: condicaoEmEdicao.descontoValor,
      valorTotal: typeof condicaoEmEdicao.valorTotal === 'number' && condicaoEmEdicao.valorTotal > 0 ? condicaoEmEdicao.valorTotal : total,
      parcelas: condicaoEmEdicao.parcelas,
      valorParcela: condicaoEmEdicao.valorParcela,
      operadoraCartaoId: condicaoEmEdicao.operadoraCartaoId,
      tipoCartao: condicaoEmEdicao.tipoCartao,
      valorEntrada: condicaoEmEdicao.valorEntrada,
      metodoEntrada: condicaoEmEdicao.metodoEntrada,
      saldoTipoPrazo: condicaoEmEdicao.saldoTipoPrazo,
      saldoPrazoDias: condicaoEmEdicao.saldoPrazoDias,
      saldoParcelas: condicaoEmEdicao.saldoParcelas,
      saldoMetodo: condicaoEmEdicao.saldoMetodo,
      saldoValorParcela: condicaoEmEdicao.saldoValorParcela,
      diaVencimento: condicaoEmEdicao.diaVencimento,
      formasCompostas: condicaoEmEdicao.formasCompostas,
      descricao: condicaoEmEdicao.descricao?.trim() || descAuto,
      destaque: !!condicaoEmEdicao.destaque,
      selecionada: condicaoEmEdicao.selecionada ?? false,
    };

    setCondicoes((prev) => {
      const idx = prev.findIndex((c) => c.id === condFinal.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = condFinal;
        return copy;
      }
      return [...prev, condFinal];
    });

    if (condFinal.selecionada) {
      setCondicaoSelecionadaId(condFinal.id);
    }

    setModalCondicaoOpen(false);
    setCondicaoEmEdicao(null);
    toast.success('Condição de pagamento salva!');
  };

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

  // Snapshot do contrato atualizado com as condições negociadas nesta tela
  const obterSnapshotContratoAtual = () => {
    if (!orcamento) return null;
    const orcAtualizado: Orcamento = {
      ...orcamento,
      desconto,
      total,
      formasPagamento: formasPagamentoTexto,
    };
    return mapearDadosContrato({
      patient,
      orcamento: orcAtualizado,
      configuracoes,
      configContrato,
      dadosRestauracoesPreexistentes: patient?.restauracoesPreexistentes,
    });
  };

  // Copia o link público e auto-contido de assinatura digital
  const handleCopiarLinkContrato = () => {
    const snap = obterSnapshotContratoAtual();
    if (!snap) {
      toast.error('Não foi possível gerar o link do contrato.');
      return;
    }
    const link = gerarLinkAssinaturaContrato(snap, orcamento?.id);
    navigator.clipboard.writeText(link);
    setCopiouLinkContrato(true);
    toast.success('Link de assinatura do contrato copiado com sucesso!', {
      description: 'Envie para o paciente assinar pelo celular.',
    });
    setTimeout(() => setCopiouLinkContrato(false), 2500);
  };

  // Envia proposta e link de assinatura digital direto pelo WhatsApp
  const handleEnviarWhatsAppContrato = () => {
    if (!orcamento) return;
    const snap = obterSnapshotContratoAtual();
    const link = snap ? gerarLinkAssinaturaContrato(snap, orcamento.id) : '';

    let tel = patient?.telefone?.trim() || '';
    if (!tel) {
      const inputTel = window.prompt('Informe o número de WhatsApp do paciente com DDD (ex: 82999998888):', '');
      if (!inputTel) {
        toast.info('Envio cancelado: telefone não informado.');
        return;
      }
      tel = inputTel.trim();
    }

    const linhas = [
      `Olá, *${patient?.nome || 'Paciente'}*! Tudo bem?`,
      '',
      `Segue o orçamento oficial de tratamento da *${configuracoes?.nomeClinica || 'Clínica Odontológica'}*:`,
      `📋 *${orcamento.titulo}*`,
      '',
      ...orcamento.itens.map((i) => `• ${i.nome} ${i.quantidade > 1 ? `(${i.quantidade}x) ` : ''}— ${formatMoney(i.valor * i.quantidade)}`),
      desconto > 0 ? `Desconto especial: -${formatMoney(desconto)}` : null,
      `*Valor Total: ${formatMoney(total)}*`,
      '',
      gerarTextoWhatsAppCondicoes(condicoes, total),
    ];

    if (temPix && chavePixOficial) {
      linhas.push('');
      linhas.push(`✦ *Dados Oficiais para Pagamento via PIX:*`);
      linhas.push(`• Chave: ${chavePixOficial}`);
      linhas.push(`• Titular: ${favorecidoPixOficial}`);
      if (valorPixAlvo > 0) {
        linhas.push(`• Valor (${labelPixAlvo}): ${formatMoney(valorPixAlvo)}`);
      }
    }

    if (link) {
      linhas.push('');
      linhas.push(`✍️ *LINK PARA VISUALIZAR E ASSINAR O CONTRATO ONLINE:*`);
      linhas.push(`Clique no link abaixo pelo seu celular para conferir os termos e assinar digitalmente:`);
      linhas.push(`👉 ${link}`);
    }

    linhas.push('');
    linhas.push('Qualquer dúvida estamos à sua inteira disposição!');

    openWhatsApp(tel, linhas.filter(Boolean).join('\n'));
    toast.success('Abrindo WhatsApp com proposta e link do contrato!');
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
      const { condicaoEscolhida, formasPagamentoFinal } = filtrarApenasCondicaoEscolhida(condicoes, condicaoSelecionadaId);
      
      const subtotalItens = (orcamento.itens || []).reduce((acc: number, it: any) => acc + (Number(it.valor || 0) * Number(it.quantidade || 1)), 0);
      let totalFinal = total;
      let descontoFinal = desconto;

      if (typeof condicaoEscolhida?.valorTotal === 'number' && condicaoEscolhida.valorTotal > 0) {
        totalFinal = condicaoEscolhida.valorTotal;
        descontoFinal = Math.max(0, Number((subtotalItens - totalFinal).toFixed(2)));
      }

      const orcamentoAtualizado: Orcamento = {
        ...orcamento,
        desconto: descontoFinal,
        total: totalFinal,
        formasPagamento: formasPagamentoFinal,
        status: 'aprovado',
      };

      if (onSalvarAlteracoes) {
        await onSalvarAlteracoes({
          id: orcamento.id,
          titulo: orcamento.titulo,
          itens: orcamento.itens,
          desconto: descontoFinal,
          formasPagamento: formasPagamentoFinal,
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

            {/* 3. Propostas & Condições de Pagamento / Negociação */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-card space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-foreground flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    Condições & Propostas de Negociação
                    <Badge variant="outline" className="text-[11px] font-normal border-primary/30 text-primary">
                      {condicoes.length} {condicoes.length === 1 ? 'opção' : 'opções'} de pagamento
                    </Badge>
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Apresente e compare condições diferentes para o paciente escolher na consulta (ex.: À Vista com desconto, Entrada facilitada, Parcelado).
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleGerarTrioSugerido}
                    className="h-8 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                    title="Gera automaticamente 3 opções recomendadas: À Vista com 10% OFF, Entrada Facilitada + 5x, e 10x sem juros"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Sugerir 3 Opções Rápidas
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={mostrarMargemInterna ? 'default' : 'outline'}
                    onClick={() => setMostrarMargemInterna((prev) => !prev)}
                    className={cn(
                      'h-8 text-xs gap-1.5 font-semibold transition-all',
                      mostrarMargemInterna
                        ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600 shadow-xs'
                        : 'border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10'
                    )}
                    title="Visualização restrita da administração: exibe o valor líquido após desconto das taxas de máquina (não visível ao paciente por padrão)"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    {mostrarMargemInterna ? 'Ocultar Margem Interna' : '🔒 Margem Interna (Taxas)'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAbrirNovaCondicao}
                    className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nova Condição
                  </Button>
                </div>
              </div>

              {/* Grid de Cards de Propostas de Negociação */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {condicoes.map((c, index) => {
                  const isSelected = c.id === condicaoSelecionadaId;
                  const isAVista = c.tipo === 'a_vista';
                  const isEntrada = c.tipo === 'entrada_saldo';
                  const isCartao = c.tipo === 'cartao';
                  const isPixParc = c.tipo === 'pix_parcelado';

                  return (
                    <div
                      key={c.id || index}
                      className={cn(
                        'rounded-2xl border p-4 transition-all relative flex flex-col justify-between gap-3 text-xs',
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500/5 dark:bg-emerald-950/20 shadow-md ring-2 ring-emerald-500/20'
                          : 'border-border/80 bg-background hover:border-primary/40 hover:bg-muted/20'
                      )}
                    >
                      {/* Topo do Card */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full font-bold text-[10px]',
                                isSelected
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              Opção {index + 1}
                            </span>
                            {c.destaque && (
                              <span className="px-2 py-0.5 rounded-full font-semibold text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                                ★ Mais Escolhida
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleAbrirEditarCondicao(c)}
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title="Editar esta condição"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            {condicoes.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoverCondicao(c.id)}
                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                title="Remover esta condição"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Título da Opção */}
                        <h5 className="font-bold text-sm text-foreground leading-snug">
                          {c.titulo}
                        </h5>

                        {/* Destaque Visual de Valores */}
                        <div className="p-3 rounded-xl bg-card border border-border/70 space-y-2">
                          {/* Barra do Valor Total da Forma */}
                          {(() => {
                            const vTotalCond = typeof c.valorTotal === 'number' && c.valorTotal > 0 ? c.valorTotal : total;
                            const diff = total - vTotalCond;
                            const temDesc = diff > 0.01;
                            const pDesc = temDesc ? Math.round((diff / total) * 100) : 0;
                            return (
                              <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
                                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
                                  <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                                  Valor Total da Forma:
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                                    {formatMoney(vTotalCond)}
                                  </span>
                                  {temDesc && (
                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                                      -{pDesc}% OFF
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {isAVista ? (
                            <div>
                              <span className="text-[10px] text-muted-foreground block">Valor à vista:</span>
                              <div className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                                {formatMoney(c.valorTotal || total)}
                              </div>
                              {(c.descontoPercentual || 0) > 0 && (
                                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-none font-semibold text-[10px] mt-0.5">
                                  Economia de {formatMoney(c.descontoValor || (total * (c.descontoPercentual || 0)) / 100)} ({c.descontoPercentual}% OFF)
                                </Badge>
                              )}
                            </div>
                          ) : isEntrada ? (
                            <div>
                              <div className="flex justify-between items-baseline">
                                <span className="text-[10px] text-muted-foreground">Entrada + Saldo:</span>
                              </div>
                              <div className="text-base sm:text-lg font-extrabold text-foreground">
                                Entrada: {formatMoney(c.valorEntrada || 0)}
                              </div>
                              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                + {c.saldoParcelas || 1}x de {formatMoney(c.saldoValorParcela || (Math.max(0, (c.valorTotal || total) - (c.valorEntrada || 0)) / (c.saldoParcelas || 1)))}
                              </div>
                            </div>
                          ) : isCartao ? (
                            <div>
                              <span className="text-[10px] text-muted-foreground block">Parcelado no Cartão:</span>
                              <div className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                                {c.parcelas || 1}x de {formatMoney(c.valorParcela || (c.valorTotal || total) / (c.parcelas || 1))}
                              </div>
                              <span className="text-[10px] text-muted-foreground block mt-0.5">
                                Sem juros (Total: {formatMoney(c.valorTotal || total)})
                              </span>
                            </div>
                          ) : isPixParc ? (
                            <div>
                              <span className="text-[10px] text-muted-foreground block">PIX Parcelado:</span>
                              <div className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                                {c.parcelas || 3}x de {formatMoney((c.valorTotal || total) / (c.parcelas || 3))}
                              </div>
                              <span className="text-[10px] text-muted-foreground block mt-0.5">
                                Vencimento mensal todo dia {c.diaVencimento || 10}
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="text-[10px] text-muted-foreground block">Condição especial:</span>
                              <div className="text-lg font-bold text-foreground">
                                {formatMoney(c.valorTotal || total)}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Descrição legível */}
                        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                          {c.descricao}
                        </p>

                        {/* Visão Interna Confidencial do Líquido do Cartão para a Clínica (Ativada pelo Toggle) */}
                        {mostrarMargemInterna && (
                          <BadgeLiquidoInternoCartao condicao={c} totalBase={total} />
                        )}
                      </div>

                      {/* Botão de Selecionar Proposta */}
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleSelecionarCondicao(c.id)}
                        variant={isSelected ? 'default' : 'outline'}
                        className={cn(
                          'w-full h-8 text-xs font-bold gap-1.5 transition-all',
                          isSelected
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                            : 'border-border/80 hover:bg-primary/10 hover:text-primary hover:border-primary/50'
                        )}
                      >
                        {isSelected ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Proposta Escolhida pelo Paciente
                          </>
                        ) : (
                          <>
                            Escolher esta Proposta
                            <ArrowRight className="h-3 w-3 opacity-70" />
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>

              {/* Barra da Condição Escolhida Atual */}
              {condicaoAtiva && (
                <div className="rounded-xl bg-muted/40 border border-border/70 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <div>
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                        Condição Selecionada para Fechamento & Contrato:
                      </span>
                      <strong className="text-foreground text-xs sm:text-sm">
                        {condicaoAtiva.titulo}
                      </strong>
                      <span className="text-muted-foreground ml-2 hidden sm:inline">
                        — {condicaoAtiva.descricao}
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAbrirEditarCondicao(condicaoAtiva)}
                    className="h-7 text-xs text-primary hover:text-primary gap-1 shrink-0"
                  >
                    <Pencil className="h-3 w-3" /> Ajustar Detalhes
                  </Button>
                </div>
              )}
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopiarLinkContrato}
                className="text-xs gap-1.5 border-blue-200 dark:border-blue-800 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 font-medium"
                title="Copiar link oficial para assinatura digital do contrato pelo paciente"
              >
                {copiouLinkContrato ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <LinkIcon className="h-3.5 w-3.5" />}
                <span>{copiouLinkContrato ? 'Link Copiado!' : 'Copiar Link'}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnviarWhatsAppContrato}
                className="text-xs gap-1.5 border-emerald-300 dark:border-emerald-800 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-medium"
                title="Enviar orçamento com condições e link de assinatura via WhatsApp"
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </Button>
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
                  <span className="font-semibold block text-emerald-600">Dar Baixa Imediata no Caixa</span>
                  <span className="text-muted-foreground text-[11px]">Apenas se já recebeu a entrada no PIX/dinheiro (se for passar cartão depois ou a receber, deixe desmarcado)</span>
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
      {/* Modal Dialog para Criar ou Editar uma Condição de Pagamento */}
      <Dialog open={modalCondicaoOpen} onOpenChange={setModalCondicaoOpen}>
        <DialogContent className="max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Pencil className="h-4 w-4 text-primary" />
              {condicaoEmEdicao?.id && condicoes.some((c) => c.id === condicaoEmEdicao.id)
                ? 'Editar Condição de Negociação'
                : 'Nova Condição de Negociação'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure os detalhes desta proposta comercial para apresentar ao paciente.
            </DialogDescription>
          </DialogHeader>

          {condicaoEmEdicao && (
            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Título da Condição / Proposta:</Label>
                <Input
                  value={condicaoEmEdicao.titulo || ''}
                  onChange={(e) => setCondicaoEmEdicao((prev) => ({ ...prev, titulo: e.target.value }))}
                  placeholder="Ex: Opção 1: À Vista no PIX (10% OFF)"
                  className="h-9 text-xs font-medium"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tipo de Pagamento:</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'a_vista', label: 'À Vista (PIX)' },
                      { id: 'cartao', label: 'Cartão de Crédito' },
                      { id: 'entrada_saldo', label: 'Entrada + Saldo' },
                      { id: 'pix_parcelado', label: 'PIX Parcelado' },
                      { id: 'boleto', label: 'Boleto' },
                      { id: 'personalizado', label: 'Personalizado' },
                    ] as const
                  ).map((t) => (
                    <Button
                      key={t.id}
                      type="button"
                      size="sm"
                      variant={condicaoEmEdicao.tipo === t.id ? 'default' : 'outline'}
                      onClick={() => {
                        const novoTipo = t.id as TipoCondicaoPagamento;
                        const copy: Partial<CondicaoPagamento> = { ...condicaoEmEdicao, tipo: novoTipo };
                        if (novoTipo === 'a_vista' && !copy.descontoPercentual) {
                          copy.descontoPercentual = 10;
                          copy.descontoValor = Number(((total * 10) / 100).toFixed(2));
                          copy.valorTotal = Math.max(0, total - copy.descontoValor);
                        } else if (novoTipo === 'cartao' && !copy.parcelas) {
                          copy.parcelas = 6;
                          copy.valorTotal = total;
                          copy.valorParcela = Number((total / 6).toFixed(2));
                        } else if (novoTipo === 'entrada_saldo') {
                          copy.valorEntrada = copy.valorEntrada || Math.round(total * 0.3);
                          copy.saldoParcelas = copy.saldoParcelas || 5;
                          copy.saldoMetodo = 'cartao';
                        } else if (novoTipo === 'personalizado') {
                          if (!copy.formasCompostas || copy.formasCompostas.length === 0) {
                            copy.formasCompostas = parseTextoParaFormasCompostas(copy.descricao || '', total);
                          }
                        }
                        copy.descricao = calcularDescricaoCondicao(copy, total);
                        setCondicaoEmEdicao(copy);
                      }}
                      className={cn(
                        'h-8 text-[11px] font-medium px-2 justify-center',
                        condicaoEmEdicao.tipo === t.id ? 'bg-primary text-primary-foreground font-bold' : 'border-border/70'
                      )}
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Campo Editável de Valor Total da Condição */}
              <div className="space-y-1.5 p-3 rounded-xl bg-muted/30 border border-border/80">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    <Label className="text-xs font-bold text-foreground">
                      Valor Total Desta Condição (R$):
                    </Label>
                  </div>
                  {Number(condicaoEmEdicao.valorTotal ?? total) !== Number(total) && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = recalcularValoresCondicaoComNovoTotal(condicaoEmEdicao, total, total);
                        setCondicaoEmEdicao(updated);
                        toast.info(`Valor resetado para o total base (${formatMoney(total)})`);
                      }}
                      className="text-[10px] text-primary hover:underline font-semibold"
                    >
                      Resetar p/ Total Base ({formatMoney(total)})
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={condicaoEmEdicao.valorTotal ?? total}
                    onChange={(e) => {
                      const vNovo = Math.max(0, Number(e.target.value) || 0);
                      const updated = recalcularValoresCondicaoComNovoTotal(condicaoEmEdicao, vNovo, total);
                      setCondicaoEmEdicao(updated);
                    }}
                    className="h-9 font-extrabold text-sm text-foreground bg-background"
                    placeholder="0,00"
                  />

                  {(() => {
                    const v = Number(condicaoEmEdicao.valorTotal ?? total);
                    const diff = v - total;
                    if (Math.abs(diff) < 0.05) {
                      return (
                        <Badge variant="outline" className="text-[10px] whitespace-nowrap border-border text-muted-foreground shrink-0">
                          Igual ao total base
                        </Badge>
                      );
                    }
                    if (diff < 0) {
                      const perc = Math.round((Math.abs(diff) / total) * 100);
                      return (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] whitespace-nowrap shrink-0">
                          Desconto de {formatMoney(Math.abs(diff))} ({perc}% OFF)
                        </Badge>
                      );
                    }
                    const perc = Math.round((diff / total) * 100);
                    return (
                      <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px] whitespace-nowrap shrink-0">
                        Acréscimo de {formatMoney(diff)} (+{perc}%)
                      </Badge>
                    );
                  })()}
                </div>
              </div>

              {/* Campos específicos por Tipo */}
              {condicaoEmEdicao.tipo === 'a_vista' && (
                <div className="p-3 rounded-xl bg-muted/40 border border-border/70 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-semibold">Desconto à vista (%):</Label>
                    <div className="flex gap-1">
                      {[0, 5, 8, 10, 15].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            const valDesc = Number(((total * p) / 100).toFixed(2));
                            const vTotal = Math.max(0, total - valDesc);
                            const updated: Partial<CondicaoPagamento> = {
                              ...condicaoEmEdicao,
                              descontoPercentual: p,
                              descontoValor: valDesc,
                              valorTotal: vTotal,
                            };
                            updated.descricao = calcularDescricaoCondicao(updated, total);
                            setCondicaoEmEdicao(updated);
                          }}
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-bold border transition-colors',
                            condicaoEmEdicao.descontoPercentual === p
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background text-muted-foreground border-border/60 hover:text-foreground'
                          )}
                        >
                          {p === 0 ? '0%' : `${p}%`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">% Desconto</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={condicaoEmEdicao.descontoPercentual ?? ''}
                        onChange={(e) => {
                          const p = Math.max(0, Number(e.target.value) || 0);
                          const valDesc = Number(((total * p) / 100).toFixed(2));
                          const vTotal = Math.max(0, total - valDesc);
                          const updated: Partial<CondicaoPagamento> = {
                            ...condicaoEmEdicao,
                            descontoPercentual: p,
                            descontoValor: valDesc,
                            valorTotal: vTotal,
                          };
                          updated.descricao = calcularDescricaoCondicao(updated, total);
                          setCondicaoEmEdicao(updated);
                        }}
                        className="h-8 text-xs font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Valor Final à Vista</Label>
                      <div className="h-8 px-3 rounded-md bg-background border border-border flex items-center font-bold text-emerald-600">
                        {formatMoney(condicaoEmEdicao.valorTotal || total)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {condicaoEmEdicao.tipo === 'cartao' && (
                <div className="p-3 rounded-xl bg-muted/40 border border-border/70 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Qtd. de Parcelas:</Label>
                      <select
                        value={condicaoEmEdicao.parcelas || 1}
                        onChange={(e) => {
                          const p = Number(e.target.value) || 1;
                          const vTotal = condicaoEmEdicao.valorTotal || total;
                          const valParc = Number((vTotal / p).toFixed(2));
                          const updated: Partial<CondicaoPagamento> = {
                            ...condicaoEmEdicao,
                            parcelas: p,
                            valorParcela: valParc,
                          };
                          updated.descricao = calcularDescricaoCondicao(updated, total);
                          setCondicaoEmEdicao(updated);
                        }}
                        className="w-full h-8 px-2 text-xs font-semibold rounded-md bg-background border border-border"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map((n) => (
                          <option key={n} value={n}>
                            {n === 1 ? '1x (À vista)' : `${n}x de ${formatMoney((condicaoEmEdicao.valorTotal || total) / n)}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Modalidade:</Label>
                      <select
                        value={condicaoEmEdicao.tipoCartao || 'credito'}
                        onChange={(e) => {
                          const t = e.target.value as 'credito' | 'debito';
                          const updated: Partial<CondicaoPagamento> = {
                            ...condicaoEmEdicao,
                            tipoCartao: t,
                            parcelas: t === 'debito' ? 1 : condicaoEmEdicao.parcelas || 1,
                          };
                          updated.descricao = calcularDescricaoCondicao(updated, total);
                          setCondicaoEmEdicao(updated);
                        }}
                        className="w-full h-8 px-2 text-xs font-semibold rounded-md bg-background border border-border"
                      >
                        <option value="credito">Crédito</option>
                        <option value="debito">Débito</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {condicaoEmEdicao.tipo === 'entrada_saldo' && (() => {
                const vTotal = typeof condicaoEmEdicao.valorTotal === 'number' && condicaoEmEdicao.valorTotal > 0 ? condicaoEmEdicao.valorTotal : total;
                const entAtual = Math.min(vTotal, Math.max(0, condicaoEmEdicao.valorEntrada || 0));
                const saldoAtual = Math.max(0, vTotal - entAtual);
                const parcAtual = condicaoEmEdicao.saldoParcelas || 1;
                return (
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/70 space-y-2.5">
                    {/* Chips de porcentagem rápida de entrada */}
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <Label className="text-[11px] font-semibold text-muted-foreground">
                        Atalhos de Entrada (% do Total com Desconto):
                      </Label>
                      <div className="flex items-center gap-1">
                        {[10, 20, 30, 40, 50, 70].map((perc) => (
                          <button
                            key={perc}
                            type="button"
                            onClick={() => {
                              const ent = Number(((vTotal * perc) / 100).toFixed(2));
                              const saldo = Math.max(0, Number((vTotal - ent).toFixed(2)));
                              const updated: Partial<CondicaoPagamento> = {
                                ...condicaoEmEdicao,
                                valorEntrada: ent,
                                saldoValorParcela: Number((saldo / parcAtual).toFixed(2)),
                              };
                              updated.descricao = calcularDescricaoCondicao(updated, total);
                              setCondicaoEmEdicao(updated);
                            }}
                            className="px-1.5 py-0.5 text-[10px] rounded bg-background hover:bg-primary/20 hover:text-primary font-bold border border-border"
                          >
                            {perc}%
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Valor da Entrada (R$):</Label>
                        <Input
                          type="number"
                          min={0}
                          max={vTotal}
                          step="0.01"
                          value={condicaoEmEdicao.valorEntrada ?? ''}
                          onChange={(e) => {
                            const ent = Math.max(0, Number(e.target.value) || 0);
                            const saldo = Math.max(0, vTotal - ent);
                            const updated: Partial<CondicaoPagamento> = {
                              ...condicaoEmEdicao,
                              valorEntrada: ent,
                              saldoValorParcela: Number((saldo / parcAtual).toFixed(2)),
                            };
                            updated.descricao = calcularDescricaoCondicao(updated, total);
                            setCondicaoEmEdicao(updated);
                          }}
                          className="h-8 text-xs font-semibold"
                          placeholder="Ex: 500.00"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Forma da Entrada:</Label>
                        <select
                          value={condicaoEmEdicao.metodoEntrada || 'pix'}
                          onChange={(e) => {
                            const met = e.target.value as any;
                            const updated: Partial<CondicaoPagamento> = {
                              ...condicaoEmEdicao,
                              metodoEntrada: met,
                            };
                            updated.descricao = calcularDescricaoCondicao(updated, total);
                            setCondicaoEmEdicao(updated);
                          }}
                          className="w-full h-8 px-2 text-xs font-semibold rounded-md bg-background border border-border"
                        >
                          <option value="pix">PIX</option>
                          <option value="dinheiro">Dinheiro</option>
                          <option value="cartao_debito">Cartão de Débito</option>
                          <option value="cartao_credito">Cartão de Crédito</option>
                          <option value="transferencia">Transferência</option>
                        </select>
                      </div>
                    </div>

                    {/* Modalidade do Saldo: Dias, Parcelas ou Conclusão */}
                    <div className="pt-2 border-t border-border/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] font-semibold">Como o saldo será pago?</Label>
                        <select
                          value={condicaoEmEdicao.saldoTipoPrazo || (condicaoEmEdicao.saldoPrazoDias ? 'dias' : 'parcelas')}
                          onChange={(e) => {
                            const stp = e.target.value as 'dias' | 'parcelas' | 'conclusao';
                            const updated: Partial<CondicaoPagamento> = {
                              ...condicaoEmEdicao,
                              saldoTipoPrazo: stp,
                            };
                            if (stp === 'dias') {
                              updated.saldoPrazoDias = updated.saldoPrazoDias || 30;
                            }
                            updated.descricao = calcularDescricaoCondicao(updated, total);
                            setCondicaoEmEdicao(updated);
                          }}
                          className="h-7 px-2 text-[11px] font-semibold rounded bg-background border border-primary/50"
                        >
                          <option value="dias">Prazo em Dias (ex: em 30 dias)</option>
                          <option value="parcelas">Parcelado em vezes mensais</option>
                          <option value="conclusao">Na Conclusão do Tratamento</option>
                        </select>
                      </div>

                      {(condicaoEmEdicao.saldoTipoPrazo === 'dias' || (!condicaoEmEdicao.saldoTipoPrazo && condicaoEmEdicao.saldoPrazoDias)) && (
                        <div className="space-y-1.5 p-2 rounded bg-background border border-border/70">
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <span className="text-[10px] text-muted-foreground font-medium">Atalhos de prazo:</span>
                            <div className="flex items-center gap-1">
                              {[15, 30, 45, 60, 90].map((dias) => (
                                <button
                                  key={dias}
                                  type="button"
                                  onClick={() => {
                                    const updated: Partial<CondicaoPagamento> = {
                                      ...condicaoEmEdicao,
                                      saldoTipoPrazo: 'dias',
                                      saldoPrazoDias: dias,
                                    };
                                    updated.descricao = calcularDescricaoCondicao(updated, total);
                                    setCondicaoEmEdicao(updated);
                                  }}
                                  className="px-1.5 py-0.5 text-[10px] rounded bg-muted hover:bg-primary/20 hover:text-primary font-semibold border border-border"
                                >
                                  {dias} dias
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[11px]">Prazo em Dias:</Label>
                              <Input
                                type="number"
                                min={1}
                                max={365}
                                value={condicaoEmEdicao.saldoPrazoDias || 30}
                                onChange={(e) => {
                                  const d = Number(e.target.value) || 30;
                                  const updated: Partial<CondicaoPagamento> = {
                                    ...condicaoEmEdicao,
                                    saldoTipoPrazo: 'dias',
                                    saldoPrazoDias: d,
                                  };
                                  updated.descricao = calcularDescricaoCondicao(updated, total);
                                  setCondicaoEmEdicao(updated);
                                }}
                                className="h-8 text-xs font-bold"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">Forma do Saldo:</Label>
                              <select
                                value={condicaoEmEdicao.saldoMetodo || 'cartao'}
                                onChange={(e) => {
                                  const sm = e.target.value as any;
                                  const updated: Partial<CondicaoPagamento> = {
                                    ...condicaoEmEdicao,
                                    saldoMetodo: sm,
                                  };
                                  updated.descricao = calcularDescricaoCondicao(updated, total);
                                  setCondicaoEmEdicao(updated);
                                }}
                                className="w-full h-8 px-2 text-xs font-semibold rounded-md bg-background border border-border"
                              >
                                <option value="cartao">Cartão de Crédito</option>
                                <option value="pix_parcelado">PIX</option>
                                <option value="boleto">Boleto Bancário</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {condicaoEmEdicao.saldoTipoPrazo === 'parcelas' && (() => {
                        const ent = condicaoEmEdicao.valorEntrada || 0;
                        const saldo = Math.max(0, vTotal - ent);
                        return (
                          <div className="grid grid-cols-2 gap-2 p-2 rounded bg-background border border-border/70">
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold">Parcelas do Saldo:</Label>
                              <select
                                value={condicaoEmEdicao.saldoParcelas || 1}
                                onChange={(e) => {
                                  const parc = Number(e.target.value) || 1;
                                  const updated: Partial<CondicaoPagamento> = {
                                    ...condicaoEmEdicao,
                                    saldoParcelas: parc,
                                    saldoValorParcela: Number((saldo / parc).toFixed(2)),
                                  };
                                  updated.descricao = calcularDescricaoCondicao(updated, total);
                                  setCondicaoEmEdicao(updated);
                                }}
                                className="w-full h-8 px-2 text-xs font-semibold rounded-md bg-background border border-border"
                              >
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18].map((n) => (
                                  <option key={n} value={n}>
                                    {n === 1 ? '1x à vista' : `${n}x de ${formatMoney(saldo / n)}`}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold">Forma do Saldo:</Label>
                              <select
                                value={condicaoEmEdicao.saldoMetodo || 'cartao'}
                                onChange={(e) => {
                                  const sm = e.target.value as any;
                                  const updated: Partial<CondicaoPagamento> = {
                                    ...condicaoEmEdicao,
                                    saldoMetodo: sm,
                                  };
                                  updated.descricao = calcularDescricaoCondicao(updated, total);
                                  setCondicaoEmEdicao(updated);
                                }}
                                className="w-full h-8 px-2 text-xs font-semibold rounded-md bg-background border border-border"
                              >
                                <option value="cartao">Cartão de Crédito</option>
                                <option value="pix_parcelado">PIX Parcelado</option>
                                <option value="boleto">Boleto Bancário</option>
                              </select>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })()}

              {condicaoEmEdicao.tipo === 'pix_parcelado' && (() => {
                const vTotal = typeof condicaoEmEdicao.valorTotal === 'number' && condicaoEmEdicao.valorTotal > 0 ? condicaoEmEdicao.valorTotal : total;
                const ent = condicaoEmEdicao.valorEntrada || 0;
                const saldo = Math.max(0, vTotal - ent);
                return (
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/70 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Parcelas no PIX:</Label>
                        <select
                          value={condicaoEmEdicao.parcelas || 3}
                          onChange={(e) => {
                            const p = Number(e.target.value) || 3;
                            const updated: Partial<CondicaoPagamento> = {
                              ...condicaoEmEdicao,
                              parcelas: p,
                              valorParcela: Number((saldo / p).toFixed(2)),
                            };
                            updated.descricao = calcularDescricaoCondicao(updated, total);
                            setCondicaoEmEdicao(updated);
                          }}
                          className="w-full h-8 px-2 text-xs font-semibold rounded-md bg-background border border-border"
                        >
                          {[2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                            <option key={n} value={n}>
                              {n}x de {formatMoney(saldo / n)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Dia de Vencimento:</Label>
                        <select
                          value={condicaoEmEdicao.diaVencimento || 10}
                          onChange={(e) => {
                            const d = Number(e.target.value) || 10;
                            const updated: Partial<CondicaoPagamento> = {
                              ...condicaoEmEdicao,
                              diaVencimento: d,
                            };
                            updated.descricao = calcularDescricaoCondicao(updated, total);
                            setCondicaoEmEdicao(updated);
                          }}
                          className="w-full h-8 px-2 text-xs font-semibold rounded-md bg-background border border-border"
                        >
                          {[1, 5, 10, 15, 20, 25, 28, 30].map((d) => (
                            <option key={d} value={d}>
                              Todo dia {d}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Construtor Visual Personalizado com Todas as Formas de Pagamento */}
              {condicaoEmEdicao.tipo === 'personalizado' && (() => {
                const formas: ItemFormaComposta[] =
                  condicaoEmEdicao.formasCompostas && condicaoEmEdicao.formasCompostas.length > 0
                    ? condicaoEmEdicao.formasCompostas
                    : parseTextoParaFormasCompostas(condicaoEmEdicao.descricao || '', total);

                const totalAlvo = typeof condicaoEmEdicao.valorTotal === 'number' && condicaoEmEdicao.valorTotal > 0 ? condicaoEmEdicao.valorTotal : total;
                const somaValores = formas.reduce((acc, f) => acc + (Number(f.valor) || 0), 0);
                const diferenca = Number((totalAlvo - somaValores).toFixed(2));
                const diferencaAbs = Math.abs(diferenca);
                const estaBalanceado = Math.abs(diferenca) < 0.05;

                const handleAtualizarFormaComposta = (idx: number, campos: Partial<ItemFormaComposta>) => {
                  const novasFormas = formas.map((item, i) => {
                    if (i !== idx) return item;
                    const atualizado = { ...item, ...campos };
                    if (campos.metodo === 'cartao' && !atualizado.tipoCartao) {
                      atualizado.tipoCartao = 'credito';
                    }
                    return atualizado;
                  });
                  const descAuto = montarTextoFormasCompostas(novasFormas, total);
                  setCondicaoEmEdicao((prev) => ({
                    ...prev,
                    formasCompostas: novasFormas,
                    descricao: descAuto,
                  }));
                };

                const handleAdicionarFormaComposta = () => {
                  const valorSugerido = Math.max(0, diferenca);
                  const novoItem: ItemFormaComposta = {
                    id: String(Date.now()),
                    rotulo: formas.length === 1 ? 'Restante' : `Forma ${formas.length + 1}`,
                    metodo: 'cartao',
                    valor: valorSugerido,
                    parcelas: 3,
                    tipoCartao: 'credito',
                    situacao: 'Autorizado',
                  };
                  const novasFormas = [...formas, novoItem];
                  const descAuto = montarTextoFormasCompostas(novasFormas, total);
                  setCondicaoEmEdicao((prev) => ({
                    ...prev,
                    formasCompostas: novasFormas,
                    descricao: descAuto,
                  }));
                };

                const handleRemoverFormaComposta = (idx: number) => {
                  if (formas.length <= 1) {
                    toast.error('Mantenha pelo menos uma forma de pagamento.');
                    return;
                  }
                  const novasFormas = formas.filter((_, i) => i !== idx);
                  const descAuto = montarTextoFormasCompostas(novasFormas, total);
                  setCondicaoEmEdicao((prev) => ({
                    ...prev,
                    formasCompostas: novasFormas,
                    descricao: descAuto,
                  }));
                };

                const handlePreencherRestante = (idx: number) => {
                  const somaOutras = formas.filter((_, i) => i !== idx).reduce((s, f) => s + (Number(f.valor) || 0), 0);
                  const valorSobra = Math.max(0, Number((total - somaOutras).toFixed(2)));
                  handleAtualizarFormaComposta(idx, { valor: valorSobra });
                  toast.success(`Valor ajustado para ${formatMoney(valorSobra)}!`);
                };

                return (
                  <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Wallet className="h-3.5 w-3.5 text-primary" />
                          Composição com Todas as Formas de Pagamento
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          Combine entradas, cartões, PIX, dinheiro e boletos livremente.
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-semibold border-primary/40 text-primary">
                        {formas.length} {formas.length === 1 ? 'forma' : 'formas'} combinadas
                      </Badge>
                    </div>

                    {/* Cards de cada forma */}
                    <div className="space-y-2.5">
                      {formas.map((forma, idx) => {
                        const isCartao = forma.metodo === 'cartao';
                        const isDebito = isCartao && forma.tipoCartao === 'debito';
                        const isPixParc = forma.metodo === 'pix_parcelado';
                        const isBoleto = forma.metodo === 'boleto';
                        const parcelas = forma.parcelas || 1;

                        return (
                          <div
                            key={forma.id || idx}
                            className="p-2.5 rounded-lg bg-background border border-border/70 space-y-2 shadow-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-1 max-w-xs">
                                <span className="h-5 w-5 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <Input
                                  value={forma.rotulo || ''}
                                  onChange={(e) => handleAtualizarFormaComposta(idx, { rotulo: e.target.value })}
                                  placeholder="Ex: Entrada, Restante..."
                                  className="h-7 text-xs font-semibold"
                                />
                              </div>

                              <div className="flex items-center gap-1">
                                {['Entrada', 'Restante', 'Parcela 2'].map((rot) => (
                                  <button
                                    key={rot}
                                    type="button"
                                    onClick={() => handleAtualizarFormaComposta(idx, { rotulo: rot })}
                                    className="px-1.5 py-0.5 text-[9px] rounded bg-muted hover:bg-primary/20 hover:text-primary font-medium text-muted-foreground"
                                  >
                                    {rot}
                                  </button>
                                ))}
                                {formas.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoverFormaComposta(idx)}
                                    className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors ml-1"
                                    title="Remover esta forma"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Grid de Configurações da Linha */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {/* Meio / Método */}
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Forma de Pagamento:</Label>
                                <select
                                  value={forma.metodo}
                                  onChange={(e) => {
                                    const m = e.target.value as any;
                                    const sitPadrao = m === 'cartao' ? 'Autorizado' : 'A vencer';
                                    handleAtualizarFormaComposta(idx, { metodo: m, situacao: sitPadrao });
                                  }}
                                  className="w-full h-8 px-2 text-xs font-semibold rounded bg-background border border-border"
                                >
                                  <option value="cartao">Cartão de Crédito</option>
                                  <option value="pix">PIX</option>
                                  <option value="dinheiro">Dinheiro</option>
                                  <option value="cartao_debito">Cartão de Débito</option>
                                  <option value="pix_parcelado">PIX Parcelado</option>
                                  <option value="boleto">Boleto Bancário</option>
                                  <option value="transferencia">Transferência</option>
                                </select>
                              </div>

                              {/* Valor */}
                              <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                  <Label className="text-[10px] text-muted-foreground">Valor (R$):</Label>
                                  {!estaBalanceado && (
                                    <button
                                      type="button"
                                      onClick={() => handlePreencherRestante(idx)}
                                      className="text-[9px] text-primary hover:underline font-semibold"
                                      title="Ajusta para o saldo faltante do orçamento"
                                    >
                                      Cobrir Saldo
                                    </button>
                                  )}
                                </div>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={forma.valor || ''}
                                  onChange={(e) => handleAtualizarFormaComposta(idx, { valor: Number(e.target.value) || 0 })}
                                  className="h-8 text-xs font-bold text-foreground"
                                  placeholder="0,00"
                                />
                              </div>

                              {/* Detalhes de Parcelas ou Situação */}
                              {isCartao && !isDebito ? (
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Parcelas no Cartão:</Label>
                                  <select
                                    value={forma.parcelas || 1}
                                    onChange={(e) => handleAtualizarFormaComposta(idx, { parcelas: Number(e.target.value) || 1 })}
                                    className="w-full h-8 px-2 text-xs font-semibold rounded bg-background border border-border"
                                  >
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 18].map((n) => (
                                      <option key={n} value={n}>
                                        {n === 1 ? '1x (À vista)' : `${n}x de ${formatMoney(forma.valor / n)}`}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : isPixParc || isBoleto ? (
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Parcelas ({isPixParc ? 'PIX' : 'Boleto'}):</Label>
                                  <select
                                    value={forma.parcelas || 1}
                                    onChange={(e) => handleAtualizarFormaComposta(idx, { parcelas: Number(e.target.value) || 1 })}
                                    className="w-full h-8 px-2 text-xs font-semibold rounded bg-background border border-border"
                                  >
                                    {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                                      <option key={n} value={n}>
                                        {n === 1 ? '1x à vista' : `${n}x de ${formatMoney(forma.valor / n)}`}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Situação:</Label>
                                  <select
                                    value={forma.situacao || 'A vencer'}
                                    onChange={(e) => handleAtualizarFormaComposta(idx, { situacao: e.target.value as any })}
                                    className="w-full h-8 px-2 text-xs font-semibold rounded bg-background border border-border"
                                  >
                                    <option value="A vencer">● A vencer</option>
                                    <option value="Quitada">● Quitada</option>
                                    <option value="Autorizado">● Autorizado</option>
                                  </select>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Botão de Adicionar Forma */}
                    <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleAdicionarFormaComposta}
                        className="h-8 text-xs font-semibold gap-1.5 border-dashed border-primary/50 text-primary hover:bg-primary/10"
                      >
                        <Plus className="h-3.5 w-3.5" /> Adicionar Outra Forma de Pagamento
                      </Button>

                      {/* Barra de Balanço */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground text-[11px]">
                          Soma: <strong>{formatMoney(somaValores)}</strong> / {formatMoney(total)}
                        </span>
                        {estaBalanceado ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] gap-1">
                            <Check className="h-3 w-3" /> 100% Coberto
                          </Badge>
                        ) : diferenca > 0 ? (
                          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px]">
                            Falta cobrir {formatMoney(diferenca)}
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[10px]">
                            Excede em {formatMoney(diferencaAbs)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Visão Interna da Clínica — Desconto das Taxas do Cartão */}
              <CardSimulacaoTaxasCartao
                condicao={condicaoEmEdicao}
                totalBase={total}
                operadoraIdSelecionada={condicaoEmEdicao.operadoraCartaoId}
                onAlterarOperadora={(opId) =>
                  setCondicaoEmEdicao((prev) => (prev ? { ...prev, operadoraCartaoId: opId } : null))
                }
              />

              {/* Descrição em Texto da Condição */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-semibold">Texto Detalhado da Condição:</Label>
                  <button
                    type="button"
                    onClick={() => {
                      const desc = calcularDescricaoCondicao(condicaoEmEdicao, total);
                      setCondicaoEmEdicao((prev) => ({ ...prev, descricao: desc }));
                      toast.info('Texto recalculado automaticamente!');
                    }}
                    className="text-[10px] text-primary hover:underline font-medium"
                  >
                    Recalcular texto
                  </button>
                </div>
                <Textarea
                  rows={2}
                  value={condicaoEmEdicao.descricao || ''}
                  onChange={(e) => setCondicaoEmEdicao((prev) => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Descrição da condição..."
                  className="text-xs font-medium"
                />
              </div>

              {/* Destaque e Seleção */}
              <div className="flex flex-col sm:flex-row gap-3 pt-1 border-t border-border/60">
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={!!condicaoEmEdicao.destaque}
                    onChange={(e) => setCondicaoEmEdicao((prev) => ({ ...prev, destaque: e.target.checked }))}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span>Marcar com badge <strong>"★ Mais Escolhida"</strong></span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={!!condicaoEmEdicao.selecionada}
                    onChange={(e) => setCondicaoEmEdicao((prev) => ({ ...prev, selecionada: e.target.checked }))}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span>Definir como a <strong>Proposta Escolhida</strong></span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setModalCondicaoOpen(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSalvarCondicaoEmEdicao} className="font-bold">
                  Salvar Condição
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ModalApresentarOrcamento;
