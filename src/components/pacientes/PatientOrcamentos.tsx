import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, Plus, Trash2, MessageCircle, Check, X, Handshake, FileText, Pencil, FileSignature, Sparkles, CalendarDays, Link as LinkIcon, Layers, CreditCard, Wallet, CheckCircle2, RefreshCw, Search, ChevronsUpDown, Calculator, Eye, DollarSign, Lock, AlertCircle, Clock, Download, ExternalLink, ShieldCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ModalApresentarOrcamento from '@/components/orcamentos/ModalApresentarOrcamento';
import { Switch } from '@/components/ui/switch';
import { useOrcamentos, OrcamentoItem, Orcamento } from '@/hooks/useOrcamentos';
import { useProcedimentos } from '@/hooks/useProcedimentos';
import { useParceiros, TipoRepasse } from '@/hooks/useParceiros';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useConfiguracoesContrato } from '@/hooks/useConfiguracoesContrato';
import { useDocumentosClinicos } from '@/hooks/useDocumentosClinicos';
import { useDentistas } from '@/hooks/useDentistas';
import { gerarOrcamentoPdf } from '@/utils/orcamentoPdf';
import { openWhatsApp } from '@/lib/whatsapp';
import { formatMoney } from '@/utils/exportCsv';
import { toast } from 'sonner';
import ContratoModal from '@/components/contratos/ContratoModal';
import {
  garantirOrcamentoPersistidoComToken,
  gerarContratoDoOrcamentoAprovado,
  construirUrlPublicaOrcamento,
  enviarNovaPropostaOrcamento,
} from '@/utils/orcamentoEngine';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { isContratoLenteResina, isContratoEndodontia, mapearDadosContrato, gerarLinkAssinaturaContrato, parseBrMoney, garantirContratoPersistido, emitirContratoPersistido, gerarHtmlContrato, validarDadosContratada, validarCronogramaFinanceiroContrato } from '@/utils/contratoEngine';
import { downloadHtmlAsPdf } from '@/utils/pdfDownload';
import { reconciliarContratosEOrcamentos } from '@/utils/reconciliacaoContratos';
import { obterPdfContratoOficialDefinitivo } from '@/utils/contratoPdfOficial';
import { somarMesesSeguro } from '@/utils/documentoFormat';
import { downloadTcleLentesResinaPdf } from '@/utils/tcleLentesResina';
import { useMaquinasCartao, calcularTaxaCartao, extrairDetalhesCartaoDeTexto } from '@/hooks/useMaquinasCartao';
import {
  CondicaoPagamento,
  TipoCondicaoPagamento,
  parseCondicoesPagamento,
  serializarCondicoesPagamento,
  calcularDescricaoCondicao,
  gerarTextoWhatsAppCondicoes,
  gerarTrioPropostasSugeridas,
  obterCondicaoAtiva,
  obterTextoCondicaoParaContrato,
  filtrarApenasCondicaoEscolhida,
  ItemFormaComposta,
  montarTextoFormasCompostas,
  parseTextoParaFormasCompostas,
  calcularResumoCartaoCondicao,
  recalcularValoresCondicaoComNovoTotal,
} from '@/utils/orcamentoCondicoes';
import CardSimulacaoTaxasCartao, { BadgeLiquidoInternoCartao } from '@/components/orcamentos/CardSimulacaoTaxasCartao';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

const formatIsoDate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatBrDate = (isoStr: string) => {
  if (!isoStr) return '';
  if (isoStr.includes('/')) return isoStr;
  const partes = isoStr.split('-');
  if (partes.length === 3) {
    const [ano, mes, dia] = partes;
    return `${dia}/${mes}/${ano}`;
  }
  return isoStr;
};

const gerarDatasPadrao = (qtdParcelas: number, dia: number) => {
  const datas: string[] = [];
  const hoje = new Date();
  for (let i = 0; i < qtdParcelas; i++) {
    const d = somarMesesSeguro(hoje, i + 1, dia);
    datas.push(formatIsoDate(d));
  }
  return datas;
};

interface Props {
  patient: any;
}

const PatientOrcamentos = ({ patient }: Props) => {
  const { orcamentos, loading, saveOrcamento, updateStatus, deleteOrcamento, reload } = useOrcamentos(patient?.id);
  const { procedimentos } = useProcedimentos();
  const { parceiros, addParceiro, refetch: refetchParceiros } = useParceiros();
  const { configuracoes } = useConfiguracoes();
  const { configContrato } = useConfiguracoesContrato();
  const { documentos, salvarDocumento } = useDocumentosClinicos(patient?.id);
  const { dentistas } = useDentistas();
  const { transacoes, addTransacao, deleteTransacao, updatePaciente } = useDentalSystem();
  const { operadoras, operadoraPadrao, config: configMaquinas } = useMaquinasCartao();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('Plano de tratamento');
  const [itens, setItens] = useState<OrcamentoItem[]>([]);
  const [desconto, setDesconto] = useState(0);
  const [observacoes, setObservacoes] = useState('');
  const [formasPagamento, setFormasPagamento] = useState('');
  const [modoFormaPagamento, setModoFormaPagamento] = useState<'propostas' | 'livre'>('propostas');
  const [condicoesNegociacao, setCondicoesNegociacao] = useState<CondicaoPagamento[]>([]);
  const [condicaoAtivaId, setCondicaoAtivaId] = useState<string>('');
  const [modalEdicaoCondicaoOpen, setModalEdicaoCondicaoOpen] = useState(false);
  const [condicaoEmEdicao, setCondicaoEmEdicao] = useState<Partial<CondicaoPagamento> | null>(null);
  const [selectKey, setSelectKey] = useState(0);
  const [statusEdicao, setStatusEdicao] = useState<any>('rascunho');
  const [modalDetalhesAjusteOpen, setModalDetalhesAjusteOpen] = useState(false);
  const [orcamentoVisualizandoAjuste, setOrcamentoVisualizandoAjuste] = useState<Orcamento | null>(null);
  const [modalEnviarNovaPropostaOpen, setModalEnviarNovaPropostaOpen] = useState(false);
  const [orcamentoParaNovaProposta, setOrcamentoParaNovaProposta] = useState<Orcamento | null>(null);
  const [salvandoNovaProposta, setSalvandoNovaProposta] = useState(false);
  const [contratoModalOpen, setContratoModalOpen] = useState(false);
  const [contratoOrcamento, setContratoOrcamento] = useState<Orcamento | null>(null);
  const [apresentarOrcamento, setApresentarOrcamento] = useState<Orcamento | null>(null);

  // Estado para Visualizador Dedicado do PDF Bilateral Oficial Assinado (Storage privado)
  const [visualizadorPdfAssinado, setVisualizadorPdfAssinado] = useState<{
    isOpen: boolean;
    pdfUrl: string | null;
    titulo: string;
    identificador: string;
    loading: boolean;
    error: string | null;
    blob: Blob | null;
    signedUrl: string | null;
    tentarNovamenteFn?: () => void;
  }>({
    isOpen: false,
    pdfUrl: null,
    titulo: '',
    identificador: '',
    loading: false,
    error: null,
    blob: null,
    signedUrl: null,
  });

  // Auto-reconciliação de contratos e orçamentos assinados com Supabase
  useEffect(() => {
    if (!patient?.id || loading) return;
    const temAprovado = (orcamentos || []).some((o) => o.status === 'aprovado');
    const temContrato = (documentos || []).some((d) => d.tipo === 'contrato');
    if (temAprovado && temContrato) {
      void reconciliarContratosEOrcamentos(patient.id).then((res) => {
        if (res.orcamentosAtualizados > 0) {
          reload?.();
        }
      });
    }
  }, [patient?.id, loading, orcamentos?.length, documentos?.length]);

  // Aprovação com lançamento financeiro e fechamento de contrato
  const [aprovandoOrcamento, setAprovandoOrcamento] = useState<Orcamento | null>(null);
  const [lancandoFinanceiro, setLancandoFinanceiro] = useState(false);
  const [darBaixaImediataAprovacao, setDarBaixaImediataAprovacao] = useState(false);
  const [condicoesAprovacao, setCondicoesAprovacao] = useState<CondicaoPagamento[]>([]);
  const [condicaoEscolhidaAprovacaoId, setCondicaoEscolhidaAprovacaoId] = useState<string>('');
  const [flexibilizandoAprovacao, setFlexibilizandoAprovacao] = useState(false);
  const [condicaoAprovacaoEmEdicao, setCondicaoAprovacaoEmEdicao] = useState<Partial<CondicaoPagamento> | null>(null);

  // Assistente de Máquina de Cartão (PagBank / InfinitePay)
  const [cartaoAssistenteAtivo, setCartaoAssistenteAtivo] = useState(false);
  const [cartaoOperadoraId, setCartaoOperadoraId] = useState<string>('infinitepay');
  const [cartaoTipo, setCartaoTipo] = useState<'credito' | 'debito'>('credito');
  const [cartaoParcelas, setCartaoParcelas] = useState<number>(3);

  // PIX Parcelado
  const [pixParceladoAtivo, setPixParceladoAtivo] = useState(false);
  const [pixEntrada, setPixEntrada] = useState<number>(0);
  const [pixDataEntrada, setPixDataEntrada] = useState<string>(() => formatIsoDate(new Date()));
  const [pixEntradaSituacao, setPixEntradaSituacao] = useState<'A vencer' | 'Quitada'>('A vencer');
  const [pixParcelas, setPixParcelas] = useState<number>(3);
  const [pixDiaVencimento, setPixDiaVencimento] = useState<number>(10);
  const [pixDatasParcelas, setPixDatasParcelas] = useState<string[]>(() => gerarDatasPadrao(3, 10));
  const [pixSituacoesParcelas, setPixSituacoesParcelas] = useState<Array<'A vencer' | 'Quitada'>>(() => ['A vencer', 'A vencer', 'A vencer']);

  // Assistente de Entrada + Saldo (Permite colocar um valor de entrada apenas e depois preencher o restante)
  const [entradaAssistenteAtivo, setEntradaAssistenteAtivo] = useState(false);
  const [valorEntrada, setValorEntrada] = useState<number>(0);
  const [metodoEntrada, setMetodoEntrada] = useState<'pix' | 'dinheiro' | 'cartao_debito' | 'cartao_credito' | 'transferencia'>('pix');
  const [dataEntrada, setDataEntrada] = useState<string>(() => formatIsoDate(new Date()));
  const [situacaoEntrada, setSituacaoEntrada] = useState<'Quitada' | 'A vencer'>('Quitada');
  const [modalidadeSaldo, setModalidadeSaldo] = useState<'combinar' | 'cartao' | 'pix_parcelado' | 'boleto' | 'conclusao'>('combinar');
  const [saldoCartaoOperadoraId, setSaldoCartaoOperadoraId] = useState<string>('infinitepay');
  const [saldoCartaoParcelas, setSaldoCartaoParcelas] = useState<number>(3);
  const [saldoPixParcelas, setSaldoPixParcelas] = useState<number>(3);
  const [saldoPixDiaVencimento, setSaldoPixDiaVencimento] = useState<number>(10);
  const [saldoBoletoParcelas, setSaldoBoletoParcelas] = useState<number>(3);
  const [saldoBoletoDiaVencimento, setSaldoBoletoDiaVencimento] = useState<number>(10);

  // Múltiplas Formas de Pagamento (Entrada + Cartão / Split)
  const [multiplasFormasAtivo, setMultiplasFormasAtivo] = useState(false);
  const [formasMultiplas, setFormasMultiplas] = useState<
    Array<{
      id: string;
      rotulo: string;
      metodo: 'pix' | 'cartao' | 'dinheiro' | 'boleto' | 'transferencia' | 'pix_parcelado';
      valor: number;
      parcelas: number;
      diaVencimento: number;
      dataPagamento?: string;
      datasParcelas?: string[];
      situacao?: 'A vencer' | 'Quitada' | 'Autorizado';
      situacoesParcelas?: Array<'A vencer' | 'Quitada' | 'Autorizado'>;
      operadoraCartaoId?: string;
      tipoCartao?: 'credito' | 'debito';
      taxaCartaoPercentual?: number;
      taxaCartaoValor?: number;
    }>
  >(() => {
    const hoje = formatIsoDate(new Date());
    return [
      { id: '1', rotulo: 'Entrada', metodo: 'pix', valor: 0, parcelas: 1, diaVencimento: 10, dataPagamento: hoje, datasParcelas: [hoje], situacao: 'A vencer', situacoesParcelas: ['A vencer'] },
      { id: '2', rotulo: 'Restante', metodo: 'cartao', valor: 0, parcelas: 3, diaVencimento: 10, dataPagamento: hoje, datasParcelas: gerarDatasPadrao(3, 10), situacao: 'Autorizado', situacoesParcelas: ['Autorizado', 'Autorizado', 'Autorizado'], operadoraCartaoId: 'infinitepay', tipoCartao: 'credito' },
    ];
  });

  // Busca e seleção rápida de procedimentos pré-cadastrados por nome
  const [openBuscaProcedimento, setOpenBuscaProcedimento] = useState(false);
  const [buscaProcedimento, setBuscaProcedimento] = useState('');
  const [selectedProcedimentoIndex, setSelectedProcedimentoIndex] = useState(0);
  const comboboxProcedimentoRef = useRef<HTMLDivElement>(null);
  const inputBuscaProcedimentoRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        comboboxProcedimentoRef.current &&
        !comboboxProcedimentoRef.current.contains(e.target as Node)
      ) {
        setOpenBuscaProcedimento(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (openBuscaProcedimento && itemRefs.current[selectedProcedimentoIndex]) {
      itemRefs.current[selectedProcedimentoIndex]?.scrollIntoView({
        block: 'nearest',
      });
    }
  }, [selectedProcedimentoIndex, openBuscaProcedimento]);

  // Parceria
  const [parceriaAtiva, setParceriaAtiva] = useState(false);
  const [parceiroId, setParceiroId] = useState('');
  const [tipoRepasse, setTipoRepasse] = useState<TipoRepasse>('percentual');
  const [valorRepasse, setValorRepasse] = useState(0);
  const [novoParceiro, setNovoParceiro] = useState(false);
  const [novoNome, setNovoNome] = useState('');

  const subtotal = itens.reduce((s, i) => s + i.valor * i.quantidade, 0);
  const total = Math.max(0, subtotal - desconto);

  // Ajuste do Valor Final com cálculo automático de desconto
  const [modoCalculoValor, setModoCalculoValor] = useState<'desconto' | 'valor_final'>('desconto');
  const [inputValorFinal, setInputValorFinal] = useState<string>('');

  const handleDescontoChange = (valStr: string) => {
    const num = parseFloat(valStr.replace(',', '.'));
    if (isNaN(num) || num < 0) {
      setDesconto(0);
      setInputValorFinal(String(subtotal));
      return;
    }
    const d = Math.min(subtotal, Number(num.toFixed(2)));
    setDesconto(d);
    setInputValorFinal(String(Math.max(0, Number((subtotal - d).toFixed(2)))));
  };

  const handleValorFinalChange = (valStr: string) => {
    setInputValorFinal(valStr);
    const num = parseFloat(valStr.replace(',', '.'));
    if (isNaN(num) || num < 0) {
      setDesconto(0);
      return;
    }
    const finalVal = Number(num.toFixed(2));
    if (finalVal > subtotal) {
      setDesconto(0);
    } else {
      const novoDesconto = Math.max(0, Number((subtotal - finalVal).toFixed(2)));
      setDesconto(novoDesconto);
    }
  };

  const aplicarDescontoPercentual = (percentual: number) => {
    if (subtotal <= 0) return;
    const desc = Number(((subtotal * percentual) / 100).toFixed(2));
    const finalVal = Number((subtotal - desc).toFixed(2));
    setDesconto(desc);
    setInputValorFinal(String(finalVal));
    toast.success(`Desconto de ${percentual}% aplicado (-${formatMoney(desc)})! Valor final: ${formatMoney(finalVal)}`);
  };

  const arredondarValorFinalPara = (divisor: number) => {
    if (subtotal <= 0) return;
    const arredondado = Math.floor(subtotal / divisor) * divisor;
    if (arredondado <= 0 || arredondado >= subtotal) return;
    const desc = Number((subtotal - arredondado).toFixed(2));
    setDesconto(desc);
    setInputValorFinal(String(arredondado));
    toast.success(`Valor final arredondado para ${formatMoney(arredondado)}! Desconto calculado: ${formatMoney(desc)}`);
  };

  const montarTextoMultiplasFormas = (lista: typeof formasMultiplas) => {
    const partes: string[] = [];
    for (const f of lista) {
      if (!f.valor || f.valor <= 0) continue;
      const op = operadoras.find((o) => o.id === f.operadoraCartaoId) || operadoraPadrao;
      const opNome = op?.nome || 'Cartão';
      const isDeb = f.tipoCartao === 'debito';

      const nomeMetodo =
        f.metodo === 'pix'
          ? 'PIX'
          : f.metodo === 'cartao'
          ? (isDeb ? `Cartão de Débito (${opNome})` : `Cartão de Crédito (${opNome})`)
          : f.metodo === 'dinheiro'
          ? 'Dinheiro'
          : f.metodo === 'boleto'
          ? 'Boleto Bancário'
          : f.metodo === 'pix_parcelado'
          ? 'PIX Parcelado'
          : 'Transferência';

      const sitPadrao = f.situacao || (f.metodo === 'cartao' ? 'Autorizado' : 'A vencer');
      const temSitsDiferentes =
        (f.parcelas || 1) > 1 &&
        f.situacoesParcelas &&
        f.situacoesParcelas.length === f.parcelas &&
        f.situacoesParcelas.some((s) => s !== f.situacoesParcelas![0]);

      let sitStr = '';
      if (temSitsDiferentes && f.situacoesParcelas) {
        sitStr = ` [${f.situacoesParcelas.join(', ')}]`;
      } else {
        sitStr = ` [${sitPadrao}]`;
      }

      if (f.metodo === 'cartao') {
        if (isDeb) {
          const dataStr = f.dataPagamento ? ` (em ${formatBrDate(f.dataPagamento)})` : '';
          partes.push(`${f.rotulo}: ${formatMoney(f.valor)} via Débito${dataStr}${sitStr}`);
        } else {
          const valParc = (f.parcelas || 1) > 1 ? f.valor / f.parcelas : f.valor;
          if ((f.parcelas || 1) > 1) {
            partes.push(
              `${f.rotulo}: ${formatMoney(f.valor)} em ${f.parcelas}x de ${formatMoney(valParc)} no Cartão de Crédito${sitStr}`
            );
          } else {
            const dataStr = f.dataPagamento ? ` (em ${formatBrDate(f.dataPagamento)})` : '';
            partes.push(`${f.rotulo}: ${formatMoney(f.valor)} via Cartão de Crédito à vista${dataStr}${sitStr}`);
          }
        }
      } else if ((f.parcelas || 1) > 1 && (f.metodo === 'pix_parcelado' || f.metodo === 'boleto')) {
        const valParc = f.valor / f.parcelas;
        const datasBr = (f.datasParcelas || []).filter(Boolean).map(formatBrDate);
        let infoDatas = '';
        if (datasBr.length > 0) {
          infoDatas = ` (Vencimentos: ${datasBr.join(', ')})`;
        } else {
          infoDatas = ` (Vencimento todo dia ${f.diaVencimento || 10})`;
        }
        partes.push(
          `${f.rotulo}: ${formatMoney(f.valor)} em ${f.parcelas}x de ${formatMoney(valParc)} no ${nomeMetodo}${infoDatas}${sitStr}`
        );
      } else {
        const isSaldoCombinar = f.rotulo.toLowerCase().includes('combinar');
        if (isSaldoCombinar) {
          partes.push(`${f.rotulo}: ${formatMoney(f.valor)} a combinar`);
        } else {
          const dataStr = f.dataPagamento ? ` (em ${formatBrDate(f.dataPagamento)})` : '';
          partes.push(`${f.rotulo}: ${formatMoney(f.valor)} via ${nomeMetodo}${dataStr}${sitStr}`);
        }
      }
    }
    return partes.join(' + ');
  };

  const handleToggleMultiplasFormas = () => {
    const novo = !multiplasFormasAtivo;
    setMultiplasFormasAtivo(novo);
    if (novo) {
      setPixParceladoAtivo(false);
      setCartaoAssistenteAtivo(false);
      const entradaSugerida = Math.round(total * 0.2);
      const restanteSugerido = Math.max(0, total - entradaSugerida);
      const hojeIso = formatIsoDate(new Date());
      const inicial = [
        {
          id: '1',
          rotulo: 'Entrada',
          metodo: 'pix' as const,
          valor: entradaSugerida,
          parcelas: 1,
          diaVencimento: 10,
          dataPagamento: hojeIso,
          datasParcelas: [hojeIso],
          situacao: 'A vencer' as const,
          situacoesParcelas: ['A vencer' as const],
        },
        {
          id: '2',
          rotulo: 'Restante',
          metodo: 'cartao' as const,
          valor: restanteSugerido,
          parcelas: 3,
          diaVencimento: 10,
          dataPagamento: hojeIso,
          datasParcelas: gerarDatasPadrao(3, 10),
          situacao: 'Autorizado' as const,
          situacoesParcelas: ['Autorizado' as const, 'Autorizado' as const, 'Autorizado' as const],
          operadoraCartaoId: configMaquinas.operadoraPadraoId || 'infinitepay',
          tipoCartao: 'credito' as const,
        },
      ];
      setFormasMultiplas(inicial);
      setFormasPagamento(montarTextoMultiplasFormas(inicial));
    }
  };

  const handleAtualizarFormaMultipla = (idx: number, campos: Partial<(typeof formasMultiplas)[number]>) => {
    const novas = formasMultiplas.map((item, i) => {
      if (i !== idx) return item;
      const atualizado = { ...item, ...campos };

      // Se for cartão, garante operadora e modalidade
      if (atualizado.metodo === 'cartao') {
        if (!atualizado.operadoraCartaoId) {
          atualizado.operadoraCartaoId = configMaquinas.operadoraPadraoId || 'infinitepay';
        }
        if (!atualizado.tipoCartao) {
          atualizado.tipoCartao = 'credito';
        }
      }

      // Se alterou a quantidade de parcelas, ajusta o array de datas de vencimento e situações
      if (campos.parcelas !== undefined && campos.parcelas !== item.parcelas) {
        const qtd = campos.parcelas;
        const diaBase = atualizado.diaVencimento || 10;
        const hoje = new Date();
        const novasDatas: string[] = [];
        for (let p = 0; p < qtd; p++) {
          if (item.datasParcelas?.[p]) {
            novasDatas.push(item.datasParcelas[p]);
          } else {
            const targetMonth = hoje.getMonth() + (p + 1);
            const d = new Date(hoje.getFullYear(), targetMonth, 1);
            const maxDias = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
            d.setDate(Math.min(diaBase, maxDias));
            novasDatas.push(formatIsoDate(d));
          }
        }
        atualizado.datasParcelas = novasDatas;
        const sitBase = item.situacao || (atualizado.metodo === 'cartao' ? 'Autorizado' : 'A vencer');
        atualizado.situacoesParcelas = Array.from({ length: qtd }, (_, p) => item.situacoesParcelas?.[p] || sitBase);
      }

      // Se alterou a situação geral, sincroniza as parcelas
      if (campos.situacao !== undefined && campos.situacao !== item.situacao) {
        atualizado.situacoesParcelas = Array.from({ length: atualizado.parcelas || 1 }, () => campos.situacao!);
      }

      // Se alterou o método para cartão ou outro, ajusta situação padrão se apropriado
      if (campos.metodo !== undefined && campos.metodo !== item.metodo) {
        if (campos.metodo === 'cartao' && atualizado.situacao === 'A vencer') {
          atualizado.situacao = 'Autorizado';
          atualizado.situacoesParcelas = Array.from({ length: atualizado.parcelas || 1 }, () => 'Autorizado');
          atualizado.operadoraCartaoId = atualizado.operadoraCartaoId || configMaquinas.operadoraPadraoId || 'infinitepay';
          atualizado.tipoCartao = atualizado.tipoCartao || 'credito';
        } else if (campos.metodo !== 'cartao' && atualizado.situacao === 'Autorizado') {
          atualizado.situacao = 'A vencer';
          atualizado.situacoesParcelas = Array.from({ length: atualizado.parcelas || 1 }, () => 'A vencer');
        }
      }

      // Se alterou o dia base de vencimento, regenera as datas padrão
      if (campos.diaVencimento !== undefined && campos.diaVencimento !== item.diaVencimento) {
        atualizado.datasParcelas = gerarDatasPadrao(atualizado.parcelas, campos.diaVencimento);
      }

      // Cálculo em tempo real de taxas da máquina se for cartão
      if (atualizado.metodo === 'cartao') {
        const op = operadoras.find((o) => o.id === atualizado.operadoraCartaoId) || operadoraPadrao;
        const isDeb = atualizado.tipoCartao === 'debito';
        const calc = calcularTaxaCartao(op, atualizado.parcelas || 1, atualizado.valor || 0, isDeb);
        atualizado.taxaCartaoPercentual = calc.taxaPercentual;
        atualizado.taxaCartaoValor = calc.taxaValor;
      }

      return atualizado;
    });
    setFormasMultiplas(novas);
    setFormasPagamento(montarTextoMultiplasFormas(novas));
  };

  const handleAtualizarDataParcelaMultipla = (formaIdx: number, parcelaIdx: number, novaDataIso: string) => {
    const novas = formasMultiplas.map((item, i) => {
      if (i !== formaIdx) return item;
      const arrayDatas = [...(item.datasParcelas || gerarDatasPadrao(item.parcelas, item.diaVencimento || 10))];
      arrayDatas[parcelaIdx] = novaDataIso;
      return { ...item, datasParcelas: arrayDatas };
    });
    setFormasMultiplas(novas);
    setFormasPagamento(montarTextoMultiplasFormas(novas));
  };

  const handleAtualizarSituacaoParcelaMultipla = (formaIdx: number, parcelaIdx: number, novaSit: 'A vencer' | 'Quitada' | 'Autorizado') => {
    const novas = formasMultiplas.map((item, i) => {
      if (i !== formaIdx) return item;
      const arraySits = [...(item.situacoesParcelas || Array(item.parcelas).fill(item.situacao || 'A vencer'))];
      arraySits[parcelaIdx] = novaSit;
      return { ...item, situacoesParcelas: arraySits };
    });
    setFormasMultiplas(novas);
    setFormasPagamento(montarTextoMultiplasFormas(novas));
  };

  const handleAdicionarFormaMultipla = () => {
    const somaAtual = formasMultiplas.reduce((s, f) => s + (f.valor || 0), 0);
    const saldoFaltante = Math.max(0, total - somaAtual);
    const hojeIso = formatIsoDate(new Date());
    const novoItem = {
      id: String(Date.now()),
      rotulo: `Forma ${formasMultiplas.length + 1}`,
      metodo: 'cartao' as const,
      valor: saldoFaltante,
      parcelas: 1,
      diaVencimento: 10,
      dataPagamento: hojeIso,
      datasParcelas: [hojeIso],
      situacao: 'Autorizado' as const,
      situacoesParcelas: ['Autorizado' as const],
    };
    const novas = [...formasMultiplas, novoItem];
    setFormasMultiplas(novas);
    setFormasPagamento(montarTextoMultiplasFormas(novas));
  };

  const handleRemoverFormaMultipla = (idx: number) => {
    const novas = formasMultiplas.filter((_, i) => i !== idx);
    setFormasMultiplas(novas);
    setFormasPagamento(montarTextoMultiplasFormas(novas));
  };

  const montarTextoPixParcelado = (
    entradaVal: number,
    parcelasVal: number,
    diaVal: number,
    totalVal: number,
    dataEntradaStr?: string,
    datasParc?: string[],
    entradaSit?: 'A vencer' | 'Quitada',
    parcelasSits?: Array<'A vencer' | 'Quitada'>
  ) => {
    const qtd = Math.max(1, parcelasVal);
    const saldo = Math.max(0, totalVal - entradaVal);
    const valorParc = saldo / qtd;

    let textoEntrada = '';
    if (entradaVal > 0) {
      const dataFormatada = dataEntradaStr ? ` (em ${formatBrDate(dataEntradaStr)})` : '';
      const sitEntradaStr = ` [${entradaSit || 'A vencer'}]`;
      textoEntrada = `Entrada de ${formatMoney(entradaVal)}${dataFormatada}${sitEntradaStr} + `;
    }

    const datasBr = (datasParc || []).filter(Boolean).map(formatBrDate);
    const saoTodasMesmoDia =
      datasBr.length > 0 &&
      datasBr.every((d) => {
        const [dia] = d.split('/');
        return Number(dia) === diaVal;
      });

    let textoVencimento = `(Vencimento todo dia ${diaVal})`;
    if (datasBr.length > 0 && !saoTodasMesmoDia) {
      textoVencimento = `(Vencimentos: ${datasBr.join(', ')})`;
    } else if (datasBr.length > 0 && datasBr.length <= 4) {
      textoVencimento = `(Vencimento todo dia ${diaVal}: ${datasBr.join(', ')})`;
    }

    const temSitsDiferentes = parcelasSits && parcelasSits.length === qtd && parcelasSits.some((s) => s !== parcelasSits[0]);
    let sitParcStr = '';
    if (temSitsDiferentes && parcelasSits) {
      sitParcStr = ` [${parcelasSits.join(', ')}]`;
    } else if (parcelasSits && parcelasSits[0]) {
      sitParcStr = ` [${parcelasSits[0]}]`;
    } else {
      sitParcStr = ' [A vencer]';
    }

    return `PIX Parcelado: ${textoEntrada}${qtd}x de ${formatMoney(valorParc)} ${textoVencimento}${sitParcStr}`;
  };

  const handleTogglePixParcelado = () => {
    const novo = !pixParceladoAtivo;
    setPixParceladoAtivo(novo);
    if (novo) {
      setMultiplasFormasAtivo(false);
      const datas = gerarDatasPadrao(pixParcelas, pixDiaVencimento);
      setPixDatasParcelas(datas);
      setFormasPagamento(montarTextoPixParcelado(pixEntrada, pixParcelas, pixDiaVencimento, total, pixDataEntrada, datas, pixEntradaSituacao, pixSituacoesParcelas));
    }
  };

  const handleChangePixEntrada = (valor: number) => {
    const clamped = Math.min(total, Math.max(0, valor));
    setPixEntrada(clamped);
    if (pixParceladoAtivo) {
      setFormasPagamento(montarTextoPixParcelado(clamped, pixParcelas, pixDiaVencimento, total, pixDataEntrada, pixDatasParcelas, pixEntradaSituacao, pixSituacoesParcelas));
    }
  };

  const handleAtualizarDataEntrada = (novaDataIso: string) => {
    setPixDataEntrada(novaDataIso);
    if (pixParceladoAtivo) {
      setFormasPagamento(montarTextoPixParcelado(pixEntrada, pixParcelas, pixDiaVencimento, total, novaDataIso, pixDatasParcelas, pixEntradaSituacao, pixSituacoesParcelas));
    }
  };

  const handleAtualizarPixEntradaSituacao = (novaSit: 'A vencer' | 'Quitada') => {
    setPixEntradaSituacao(novaSit);
    if (pixParceladoAtivo) {
      setFormasPagamento(montarTextoPixParcelado(pixEntrada, pixParcelas, pixDiaVencimento, total, pixDataEntrada, pixDatasParcelas, novaSit, pixSituacoesParcelas));
    }
  };

  const handleAtualizarPixSituacaoParcela = (idx: number, novaSit: 'A vencer' | 'Quitada') => {
    const novas = [...pixSituacoesParcelas];
    novas[idx] = novaSit;
    setPixSituacoesParcelas(novas);
    if (pixParceladoAtivo) {
      setFormasPagamento(montarTextoPixParcelado(pixEntrada, pixParcelas, pixDiaVencimento, total, pixDataEntrada, pixDatasParcelas, pixEntradaSituacao, novas));
    }
  };

  const obterNomeMetodoEntrada = (met: string) => {
    switch (met) {
      case 'pix': return 'PIX';
      case 'dinheiro': return 'Dinheiro';
      case 'cartao_debito': return 'Cartão de Débito';
      case 'cartao_credito': return 'Cartão de Crédito';
      case 'transferencia': return 'Transferência';
      default: return 'PIX';
    }
  };

  const handleToggleEntradaAssistente = () => {
    const novo = !entradaAssistenteAtivo;
    setEntradaAssistenteAtivo(novo);
    if (novo) {
      setCartaoAssistenteAtivo(false);
      setPixParceladoAtivo(false);
      setMultiplasFormasAtivo(false);
      if (valorEntrada <= 0 && total > 0) {
        const entSugerida = Math.round(total * 0.2); // 20%
        setValorEntrada(entSugerida);
      }
    }
  };

  const aplicarEntradaApenas = (valEntradaCustom?: number) => {
    const vEnt = valEntradaCustom !== undefined ? valEntradaCustom : valorEntrada;
    if (vEnt <= 0) {
      toast.error('Informe um valor de entrada válido maior que zero.');
      return;
    }
    const saldo = Math.max(0, total - vEnt);
    const metNome = obterNomeMetodoEntrada(metodoEntrada);
    const dataStr = dataEntrada ? ` (em ${formatBrDate(dataEntrada)})` : '';
    const sitStr = ` [${situacaoEntrada}]`;

    let textoFinal = '';
    if (saldo <= 0) {
      textoFinal = `Entrada Integral: ${formatMoney(vEnt)} via ${metNome}${dataStr}${sitStr}`;
    } else {
      textoFinal = `Entrada: ${formatMoney(vEnt)} via ${metNome}${dataStr}${sitStr} + Saldo Restante: ${formatMoney(saldo)} a combinar`;
    }

    setFormasPagamento(textoFinal);
    toast.success(
      saldo > 0
        ? `Entrada de ${formatMoney(vEnt)} definida! Saldo de ${formatMoney(saldo)} registrado a combinar.`
        : `Entrada integral de ${formatMoney(vEnt)} definida!`
    );
  };

  const aplicarEntradaComSaldo = () => {
    if (valorEntrada <= 0) {
      toast.error('Informe um valor de entrada válido maior que zero.');
      return;
    }
    const saldo = Math.max(0, total - valorEntrada);
    const metNome = obterNomeMetodoEntrada(metodoEntrada);
    const dataStr = dataEntrada ? ` (em ${formatBrDate(dataEntrada)})` : '';
    const sitStr = ` [${situacaoEntrada}]`;

    const textoEntrada = `Entrada: ${formatMoney(valorEntrada)} via ${metNome}${dataStr}${sitStr}`;

    if (saldo <= 0) {
      setFormasPagamento(`Entrada Integral: ${formatMoney(valorEntrada)} via ${metNome}${dataStr}${sitStr}`);
      toast.success('Entrada cobre o valor total do orçamento!');
      return;
    }

    let textoSaldo = '';
    if (modalidadeSaldo === 'combinar') {
      textoSaldo = `Saldo Restante: ${formatMoney(saldo)} a combinar`;
    } else if (modalidadeSaldo === 'cartao') {
      const valParc = saldo / saldoCartaoParcelas;
      if (saldoCartaoParcelas === 1) {
        textoSaldo = `Saldo: ${formatMoney(saldo)} via Cartão de Crédito à vista [Autorizado]`;
      } else {
        textoSaldo = `Saldo: ${formatMoney(saldo)} em ${saldoCartaoParcelas}x de ${formatMoney(valParc)} no Cartão de Crédito [Autorizado]`;
      }
    } else if (modalidadeSaldo === 'pix_parcelado') {
      const valParc = saldo / saldoPixParcelas;
      textoSaldo = `Saldo: ${formatMoney(saldo)} em ${saldoPixParcelas}x de ${formatMoney(valParc)} no PIX Parcelado (Vencimento todo dia ${saldoPixDiaVencimento}) [A vencer]`;
    } else if (modalidadeSaldo === 'boleto') {
      const valParc = saldo / saldoBoletoParcelas;
      textoSaldo = `Saldo: ${formatMoney(saldo)} em ${saldoBoletoParcelas}x de ${formatMoney(valParc)} no Boleto Bancário (Vencimento todo dia ${saldoBoletoDiaVencimento}) [A vencer]`;
    } else if (modalidadeSaldo === 'conclusao') {
      textoSaldo = `Saldo: ${formatMoney(saldo)} via PIX/Dinheiro na Conclusão do Tratamento [A vencer]`;
    }

    const textoCompleto = `${textoEntrada} + ${textoSaldo}`;
    setFormasPagamento(textoCompleto);
    toast.success('Entrada e opções de pagamento do saldo aplicadas com sucesso!');
  };

  const handleGerarTrioSugeridoOrcamento = () => {
    const trio = gerarTrioPropostasSugeridas(total);
    setCondicoesNegociacao(trio);
    setCondicaoAtivaId('');
    toast.success('3 propostas de negociação geradas automaticamente com base no total!');
  };

  const handleAbrirNovaCondicaoOrcamento = () => {
    const novoId = String(Date.now());
    const pDef = 6;
    setCondicaoEmEdicao({
      id: novoId,
      titulo: `Opção ${condicoesNegociacao.length + 1}: Parcelado em ${pDef}x`,
      tipo: 'cartao',
      parcelas: pDef,
      valorTotal: total,
      tipoCartao: 'credito',
      destaque: false,
      selecionada: false,
    });
    setModalEdicaoCondicaoOpen(true);
  };

  const handleAbrirEditarCondicaoOrcamento = (c: CondicaoPagamento) => {
    let formas = c.formasCompostas;
    if ((!formas || formas.length === 0) && (c.tipo === 'personalizado' || !c.tipo)) {
      formas = parseTextoParaFormasCompostas(c.descricao || '', total);
    }
    setCondicaoEmEdicao({ ...c, formasCompostas: formas });
    setModalEdicaoCondicaoOpen(true);
  };

  const handleRemoverCondicaoOrcamento = (id: string) => {
    if (condicoesNegociacao.length <= 1) {
      toast.error('O orçamento precisa de pelo menos uma condição de pagamento.');
      return;
    }
    const novas = condicoesNegociacao.filter((c) => c.id !== id);
    setCondicoesNegociacao(novas);
    if (condicaoAtivaId === id) {
      setCondicaoAtivaId('');
    }
    toast.info('Condição removida');
  };

  const handleSalvarCondicaoEmEdicaoOrcamento = () => {
    if (!condicaoEmEdicao || !condicaoEmEdicao.titulo?.trim()) {
      toast.error('Informe um título para a condição.');
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
      dataEntrada: condicaoEmEdicao.dataEntrada,
      situacaoEntrada: condicaoEmEdicao.situacaoEntrada,
      dataPrimeiroVencimento: condicaoEmEdicao.dataPrimeiroVencimento,
      situacaoSaldo: condicaoEmEdicao.situacaoSaldo,
      formasCompostas: condicaoEmEdicao.formasCompostas,
      descricao: condicaoEmEdicao.descricao?.trim() || descAuto,
      destaque: !!condicaoEmEdicao.destaque,
      selecionada: condicaoEmEdicao.selecionada ?? false,
    };

    setCondicoesNegociacao((prev) => {
      const idx = prev.findIndex((c) => c.id === condFinal.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = condFinal;
        return copy;
      }
      return [...prev, condFinal];
    });

    if (condFinal.selecionada) {
      setCondicaoAtivaId(condFinal.id);
    }

    setModalEdicaoCondicaoOpen(false);
    setCondicaoEmEdicao(null);
    toast.success('Condição de pagamento salva!');
  };

  const handleIniciarAprovacao = (o: Orcamento, condicaoPreSelecionadaId?: string) => {
    setAprovandoOrcamento(o);
    const parsed = parseCondicoesPagamento(o.formasPagamento, o.total);
    let sel: CondicaoPagamento;
    if (parsed.length > 0) {
      setCondicoesAprovacao(parsed);
      sel = condicaoPreSelecionadaId
        ? parsed.find((c) => c.id === condicaoPreSelecionadaId) || parsed[0]
        : parsed.find((c) => c.selecionada) || parsed[0];
      setCondicaoEscolhidaAprovacaoId(sel.id);
    } else {
      sel = {
        id: '1',
        titulo: 'Condição de Pagamento',
        tipo: 'personalizado',
        valorTotal: o.total,
        descricao: o.formasPagamento || 'A combinar',
        selecionada: true,
      };
      setCondicoesAprovacao([sel]);
      setCondicaoEscolhidaAprovacaoId('1');
    }

    const hoje = formatIsoDate(new Date());
    const em30 = formatIsoDate(somarMesesSeguro(new Date(), 1));
    const condInicializada: CondicaoPagamento = {
      ...sel,
      dataEntrada: sel.dataEntrada || hoje,
      situacaoEntrada: sel.situacaoEntrada || 'Quitada',
      dataPrimeiroVencimento: sel.dataPrimeiroVencimento || em30,
      situacaoSaldo: sel.situacaoSaldo || (sel.tipo === 'cartao' ? 'Autorizado' : 'A vencer'),
    };
    condInicializada.descricao = sel.descricao || calcularDescricaoCondicao(condInicializada, o.total);

    setCondicaoAprovacaoEmEdicao(condInicializada);
    setFlexibilizandoAprovacao(true);
  };

  const handleConfirmarAprovacao = async (
    o: Orcamento,
    lancarFinanceiro: boolean,
    condicoesDefinidas?: CondicaoPagamento[],
    selecionadaId?: string,
    abrirContratoApos?: boolean
  ) => {
    try {
      setLancandoFinanceiro(true);

      let formasAtualizadas = o.formasPagamento;
      let orcamentoFinal: Orcamento = { ...o };
      let condicaoEscolhidaObj: CondicaoPagamento | undefined = undefined;

      if (condicoesDefinidas && condicoesDefinidas.length > 0) {
        // Ao aprovar o orçamento, apenas a opção escolhida pelo paciente é mantida
        // As demais propostas são descartadas automaticamente
        const { condicaoEscolhida, formasPagamentoFinal } = filtrarApenasCondicaoEscolhida(
          condicoesDefinidas,
          selecionadaId
        );
        formasAtualizadas = formasPagamentoFinal;
        condicaoEscolhidaObj = condicaoEscolhida;

        const subtotalItens = (o.itens || []).reduce((acc: number, it: any) => acc + (Number(it.valor || 0) * Number(it.quantidade || 1)), 0);
        let totalFinal = o.total;
        let descontoFinal = o.desconto;

        if (typeof condicaoEscolhida?.valorTotal === 'number' && condicaoEscolhida.valorTotal > 0) {
          totalFinal = condicaoEscolhida.valorTotal;
          descontoFinal = Math.max(0, Number((subtotalItens - totalFinal).toFixed(2)));
        }

        orcamentoFinal = {
          ...o,
          total: totalFinal,
          desconto: descontoFinal,
          formasPagamento: formasAtualizadas,
          condicaoEscolhida: condicaoEscolhidaObj,
          condicoes: condicaoEscolhidaObj ? [condicaoEscolhidaObj] : undefined,
          status: 'aprovado',
        };
        await saveOrcamento({
          id: o.id,
          titulo: o.titulo,
          itens: o.itens,
          desconto: descontoFinal,
          observacoes: o.observacoes,
          formasPagamento: formasAtualizadas,
          condicaoEscolhida: condicaoEscolhidaObj,
          condicoes: condicaoEscolhidaObj ? [condicaoEscolhidaObj] : undefined,
          pacienteId: o.pacienteId || patient?.id,
          pacienteNome: o.pacienteNome || patient?.nome,
          status: 'aprovado',
          validade: o.validade,
        });
      } else {
        await updateStatus(o.id, 'aprovado');
      }

      if (updatePaciente && (patient?.id || o.pacienteId)) {
        try {
          await updatePaciente(patient?.id || o.pacienteId, { status: 'Em Tratamento' });
        } catch (errP) {
          console.error('Erro ao atualizar status do paciente para Em Tratamento:', errP);
        }
      }

      // Geração e vinculação automática do contrato correspondente persistido
      try {
        const modeloContrato = isContratoLenteResina(orcamentoFinal.titulo)
          ? 'lentes_resina'
          : isContratoEndodontia(orcamentoFinal.titulo)
            ? 'endodontia'
            : 'geral';

        const resContrato = await gerarContratoDoOrcamentoAprovado({
          orcamento: orcamentoFinal,
          patient: patient || { id: orcamentoFinal.pacienteId, nome: orcamentoFinal.pacienteNome },
          configuracoes,
          configContrato,
          modeloId: modeloContrato,
        });

        if (resContrato && resContrato.ok && resContrato.contratoId) {
          orcamentoFinal.contratoId = resContrato.contratoId;
          orcamentoFinal.contratoToken = resContrato.contratoToken;
          await saveOrcamento({
            id: orcamentoFinal.id,
            contratoId: resContrato.contratoId,
            contratoToken: resContrato.contratoToken,
          } as any);
        }
      } catch (errC) {
        console.error('Erro na automação do contrato após aprovação:', errC);
      }

      if (lancarFinanceiro) {
        // Remove transações pendentes vinculadas a este orçamento ou órfãs do mesmo paciente para atualizar parcelas, PRESERVANDO transações já pagas!
        const existentes = (transacoes || []).filter((t: any) => {
          if (t.orcamentoId === o.id) return true;
          const pacIdMatch = t.pacienteId && (t.pacienteId === o.pacienteId || t.pacienteId === patient?.id);
          const pacNomeMatch = t.pacienteNome && o.pacienteNome && t.pacienteNome.trim().toLowerCase() === o.pacienteNome.trim().toLowerCase();
          if ((pacIdMatch || pacNomeMatch) && t.status !== 'pago') {
            const descLower = (t.descricao || '').toLowerCase();
            const tituloLower = (o.titulo || '').toLowerCase();
            if (tituloLower && descLower.includes(tituloLower)) return true;
            if (descLower.includes('plano de tratamento') || descLower.includes('lentes em resina') || descLower.includes('lentes')) return true;
            if (Math.abs(Number(t.valor || 0) - Number(o.total || 0)) < 0.05) return true;
          }
          return false;
        });
        const jaPagas = existentes.filter((t: any) => t.status === 'pago');

        for (const t of existentes) {
          if (t.status !== 'pago') {
            try {
              await deleteTransacao(t.id);
            } catch (e) {
              console.error('Erro ao remover transação antiga:', e);
            }
          }
        }

        const snap = mapearDadosContrato({
          patient: patient || { id: orcamentoFinal.pacienteId, nome: orcamentoFinal.pacienteNome },
          orcamento: orcamentoFinal,
          transacoes: [],
          configuracoes,
          configuracoesContrato: configContrato,
        });

        const parcelas = snap.financeiro?.parcelas || [];
        const isUnicaParcela = parcelas.length === 1;
        let totalTaxasCartaoQuitadas = 0;
        let operadoraTaxasNome = '';
        let totalQuitadasAgora = 0;
        let totalPendentesAgora = 0;

        for (const p of parcelas) {
          const isEntrada = (p?.descricao || '').toLowerCase().includes('entrada');
          const descLower = (p.metodo || p.descricao || '').toLowerCase();
          const isCartao = descLower.includes('cartao') || descLower.includes('cartão') || descLower.includes('crédito') || descLower.includes('debito');
          const isACombinar = descLower.includes('combinar') || descLower.includes('definir');
          const isExplicitamenteQuitada = (p?.status || '').toLowerCase().includes('quitad') || (p?.status || '').toLowerCase().includes('pago');

          // REGRA DE SEPARAÇÃO RIGOROSA: VENDAS (FECHADO) vs CAIXA (QUITADO)
          // 1. O orçamento aprovado entra integralmente em Vendas (fechado) pelo status 'aprovado'.
          // 2. No Caixa (dinheiro em caixa) SÓ deve entrar o que já estiver efetivamente quitado.
          // 3. Caso esteja a receber ou for para passar cartão no balcão, NÃO entra no caixa (status: 'pendente').
          let isQuitada = false;
          if (isEntrada) {
            if (condicaoEscolhidaObj?.situacaoEntrada) {
              isQuitada = condicaoEscolhidaObj.situacaoEntrada === 'Quitada';
            } else {
              isQuitada =
                !isACombinar && (
                  isExplicitamenteQuitada ||
                  (!isCartao && darBaixaImediataAprovacao && (isEntrada || isUnicaParcela))
                );
            }
          } else {
            if (condicaoEscolhidaObj?.situacaoSaldo) {
              isQuitada = condicaoEscolhidaObj.situacaoSaldo === 'Quitado' || condicaoEscolhidaObj.situacaoSaldo === 'Autorizado';
            } else {
              isQuitada = !isACombinar && isExplicitamenteQuitada;
            }
          }
          
          if (isQuitada) {
            totalQuitadasAgora++;
          } else {
            totalPendentesAgora++;
          }
          
          // Se já existe transação paga para este orçamento correspondente à entrada ou parcela, preserva
          const jaExistePaga = jaPagas.some((jp: any) => 
            jp.descricao === `${o.titulo}: ${p.descricao}` ||
            (isEntrada && (jp.descricao || '').toLowerCase().includes('entrada'))
          );
          if (jaExistePaga) {
            continue;
          }

          let dataVenc: Date = new Date();
          if (isEntrada && condicaoEscolhidaObj?.dataEntrada) {
            const dateParts = condicaoEscolhidaObj.dataEntrada.split('-').map(Number);
            if (dateParts.length === 3 && dateParts[0] && dateParts[1] && dateParts[2]) {
              dataVenc = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 12, 0, 0);
            }
          } else if (!isEntrada && condicaoEscolhidaObj?.dataPrimeiroVencimento) {
            const dateParts = condicaoEscolhidaObj.dataPrimeiroVencimento.split('-').map(Number);
            if (dateParts.length === 3 && dateParts[0] && dateParts[1] && dateParts[2]) {
              const baseVenc = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 12, 0, 0);
              const temEntrada = parcelas.some((x: any) => (x.descricao || '').toLowerCase().includes('entrada'));
              const offset = Math.max(0, (typeof p.numero === 'number' ? p.numero - (temEntrada ? 2 : 1) : 0));
              dataVenc = somarMesesSeguro(baseVenc, offset);
            }
          } else if (p.vencimento && typeof p.vencimento === 'string') {
            const dateMatch = p.vencimento.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (dateMatch) {
              const [, dia, mes, ano] = dateMatch;
              dataVenc = new Date(Number(ano), Number(mes) - 1, Number(dia), 12, 0, 0);
            } else if (p.vencimento.includes('-')) {
              const parsed = new Date(p.vencimento);
              if (!isNaN(parsed.getTime())) dataVenc = parsed;
            }
          }
          if (isNaN(dataVenc.getTime())) {
            const parcIdxMatch = (p.descricao || '').match(/\((\d+)\/\d+/);
            const mesOffset = parcIdxMatch ? Number(parcIdxMatch[1]) : (typeof p.numero === 'number' ? p.numero : 1);
            dataVenc = somarMesesSeguro(new Date(), mesOffset);
          }
          if (isNaN(dataVenc.getTime())) {
            dataVenc = isACombinar ? somarMesesSeguro(new Date(), 1) : new Date();
          }

          // Identifica o método específico desta parcela dinamicamente
          let metodoFinal: any = 'pix';
          if (isCartao) {
            metodoFinal = 'cartao';
          } else if (descLower.includes('pix_parcelado') || descLower.includes('pix mensal') || descLower.includes('pix parcelado')) {
            metodoFinal = 'pix_parcelado';
          } else if (descLower.includes('pix')) {
            metodoFinal = 'pix';
          } else if (descLower.includes('dinheiro')) {
            metodoFinal = 'dinheiro';
          } else if (descLower.includes('boleto')) {
            metodoFinal = 'boleto';
          } else if (descLower.includes('transferencia') || descLower.includes('transferência')) {
            metodoFinal = 'transferencia';
          } else if (isACombinar) {
            metodoFinal = 'outros';
          }

          // Cálculo da taxa da máquina de cartão se a parcela for cartão
          let taxaPercItem: number | undefined = undefined;
          let taxaValorItem: number | undefined = undefined;
          let liquidoItem: number | undefined = undefined;

          let opItem: any = undefined;
          let operadoraTaxasNomeItem = '';

          if (isCartao) {
            const infoCartao = extrairDetalhesCartaoDeTexto(
              `${o.formasPagamento || ''} ${p.descricao || ''}`,
              operadoras,
              configMaquinas?.operadoraPadraoId
            );
            const op = infoCartao.operadora || operadoraPadrao;
            opItem = op;
            operadoraTaxasNome = op?.nome || 'Cartão';
            operadoraTaxasNomeItem = op?.nome || 'Cartão';

            const calc = calcularTaxaCartao(op, infoCartao.parcelas, Number(p.valor || 0), infoCartao.isDebito);
            taxaPercItem = calc.taxaPercentual;
            taxaValorItem = calc.taxaValor;
            liquidoItem = calc.valorLiquido;
            
            // Só acumula taxa para lançamento de despesa se a parcela do cartão foi EFETIVAMENTE quitada agora!
            if (isQuitada && calc.taxaValor > 0) {
              totalTaxasCartaoQuitadas += calc.taxaValor;
            }
          }

          const pacId = patient?.id || o.pacienteId || '';
          const pacNome = patient?.nome || o.pacienteNome || '';

          const opIdDetectado = isCartao && opItem
            ? (opItem.id || (opItem.nome?.toLowerCase().includes('pag') ? 'pagbank' : 'infinitepay'))
            : undefined;

          const descCompleta = isCartao && operadoraTaxasNomeItem
            ? `${o.titulo}: ${p.descricao} (${operadoraTaxasNomeItem})`
            : `${o.titulo}: ${p.descricao}`;

          await addTransacao({
            pacienteId: pacId,
            pacienteNome: pacNome,
            valor: Number(p.valor || 0),
            tipo: 'receita',
            status: isQuitada ? 'pago' : 'pendente',
            metodoPagamento: metodoFinal,
            data: new Date(),
            vencimento: dataVenc,
            descricao: descCompleta,
            categoria: 'Tratamentos',
            orcamentoId: o.id,
            operadoraCartao: opIdDetectado,
            taxaCartaoPercentual: taxaPercItem,
            taxaCartaoValor: taxaValorItem,
            valorLiquido: liquidoItem,
          });
        }

        // Lança taxa da máquina de cartão como despesa APENAS se houver cartão quitado imediatamente
        if (configMaquinas?.lancarTaxaComoDespesa !== false && totalTaxasCartaoQuitadas > 0) {
          const catDespesa = configMaquinas?.categoriaDespesaPadrao || 'Taxas de Cartão';
          const pacId = patient?.id || o.pacienteId || '';
          const pacNome = patient?.nome || o.pacienteNome || '';
          const opIdDespesa = operadoraTaxasNome?.toLowerCase().includes('pag') ? 'pagbank' : 'infinitepay';

          await addTransacao({
            pacienteId: pacId,
            pacienteNome: pacNome,
            valor: Number(totalTaxasCartaoQuitadas.toFixed(2)),
            tipo: 'despesa',
            status: 'pago',
            metodoPagamento: 'cartao',
            data: new Date(),
            vencimento: new Date(),
            descricao: `Taxa da Máquina (${operadoraTaxasNome || 'Cartão'}) - Orçamento: ${o.titulo}`,
            categoria: catDespesa,
            orcamentoId: o.id,
            operadoraCartao: opIdDespesa,
          });
          toast.success(
            `Orçamento aprovado em Vendas! Taxa de ${formatMoney(totalTaxasCartaoQuitadas)} da maquininha lançada como despesa no Caixa.`
          );
        } else if (totalQuitadasAgora > 0) {
          toast.success(
            `Orçamento contabilizado em Vendas (fechado)! ${totalQuitadasAgora} entrada(s) lançada(s) no Caixa e ${totalPendentesAgora} a receber.`
          );
        } else {
          toast.success(
            `Orçamento contabilizado em Vendas (fechado)! Todas as parcelas (${totalPendentesAgora}) lançadas no Contas a Receber (aguardando passar cartão / recebimento).`
          );
        }
      } else {
        toast.success('Orçamento aprovado e contabilizado em Vendas (fechado) com sucesso!');
      }

      if (abrirContratoApos) {
        setContratoOrcamento(orcamentoFinal);
        setContratoModalOpen(true);
      }
    } catch (err: any) {
      console.error('Erro ao aprovar orçamento:', err);
      toast.error('Erro ao aprovar orçamento ou lançar parcelas: ' + (err?.message || 'Verifique os dados.'));
    } finally {
      setLancandoFinanceiro(false);
      setAprovandoOrcamento(null);
    }
  };

  const prepararEConfirmarAprovacao = async (
    lancarFinanceiro: boolean,
    abrirContratoApos: boolean
  ) => {
    if (!aprovandoOrcamento) return;

    let listaFinal = [...condicoesAprovacao];
    let idEscolhido = condicaoEscolhidaAprovacaoId;

    if (condicaoAprovacaoEmEdicao) {
      const finalCond: CondicaoPagamento = {
        ...condicaoAprovacaoEmEdicao,
        id: condicaoAprovacaoEmEdicao.id || idEscolhido || String(Date.now()),
        titulo: condicaoAprovacaoEmEdicao.titulo?.trim() || 'Condição Acordada',
        tipo: condicaoAprovacaoEmEdicao.tipo || 'personalizado',
        descontoPercentual: condicaoAprovacaoEmEdicao.descontoPercentual,
        descontoValor: condicaoAprovacaoEmEdicao.descontoValor,
        valorTotal: condicaoAprovacaoEmEdicao.valorTotal || aprovandoOrcamento.total,
        parcelas: condicaoAprovacaoEmEdicao.parcelas,
        valorParcela: condicaoAprovacaoEmEdicao.valorParcela,
        operadoraCartaoId: condicaoAprovacaoEmEdicao.operadoraCartaoId,
        valorEntrada: condicaoAprovacaoEmEdicao.valorEntrada,
        metodoEntrada: condicaoAprovacaoEmEdicao.metodoEntrada,
        saldoTipoPrazo: condicaoAprovacaoEmEdicao.saldoTipoPrazo,
        saldoPrazoDias: condicaoAprovacaoEmEdicao.saldoPrazoDias,
        saldoParcelas: condicaoAprovacaoEmEdicao.saldoParcelas,
        saldoMetodo: condicaoAprovacaoEmEdicao.saldoMetodo,
        saldoValorParcela: condicaoAprovacaoEmEdicao.saldoValorParcela,
        diaVencimento: condicaoAprovacaoEmEdicao.diaVencimento,
        tipoCartao: condicaoAprovacaoEmEdicao.tipoCartao,
        dataEntrada: condicaoAprovacaoEmEdicao.dataEntrada,
        situacaoEntrada: condicaoAprovacaoEmEdicao.situacaoEntrada,
        dataPrimeiroVencimento: condicaoAprovacaoEmEdicao.dataPrimeiroVencimento,
        situacaoSaldo: condicaoAprovacaoEmEdicao.situacaoSaldo,
        descricao:
          condicaoAprovacaoEmEdicao.descricao?.trim() ||
          calcularDescricaoCondicao(condicaoAprovacaoEmEdicao, aprovandoOrcamento.total),
        destaque: true,
        selecionada: true,
      };

      const idx = listaFinal.findIndex((c) => c.id === finalCond.id);
      if (idx >= 0) {
        listaFinal[idx] = finalCond;
      } else {
        listaFinal.push(finalCond);
      }
      idEscolhido = finalCond.id;
    }

    await handleConfirmarAprovacao(
      aprovandoOrcamento,
      lancarFinanceiro,
      listaFinal,
      idEscolhido,
      abrirContratoApos
    );
  };

  const aplicarPresetCondicao = (
    preset: 'a_vista_10' | 'entrada_50_30dias' | 'entrada_30_6x' | 'cartao_10x' | 'pix_parcelado' | 'conclusao',
    totalAlvo: number,
    setter: React.Dispatch<React.SetStateAction<Partial<CondicaoPagamento> | null>>
  ) => {
    const t = Math.max(0, totalAlvo);
    let updated: Partial<CondicaoPagamento> = {};

    switch (preset) {
      case 'a_vista_10': {
        const perc = 10;
        const desc = Number(((t * perc) / 100).toFixed(2));
        const valFinal = Math.max(0, t - desc);
        updated = {
          titulo: 'Opção: À Vista no PIX (10% de Desconto)',
          tipo: 'a_vista',
          descontoPercentual: perc,
          descontoValor: desc,
          valorTotal: valFinal,
        };
        break;
      }
      case 'entrada_50_30dias': {
        const ent = Number((t * 0.5).toFixed(2));
        const saldo = Math.max(0, Number((t - ent).toFixed(2)));
        updated = {
          titulo: 'Opção: Entrada 50% + Saldo em 30 dias',
          tipo: 'entrada_saldo',
          valorEntrada: ent,
          metodoEntrada: 'pix',
          saldoTipoPrazo: 'dias',
          saldoPrazoDias: 30,
          saldoParcelas: 1,
          saldoMetodo: 'cartao',
          saldoValorParcela: saldo,
          valorTotal: t,
        };
        break;
      }
      case 'entrada_30_6x': {
        const ent = Number((t * 0.3).toFixed(2));
        const saldo = Math.max(0, Number((t - ent).toFixed(2)));
        const parc = 6;
        updated = {
          titulo: 'Opção: Entrada 30% + Saldo em 6x',
          tipo: 'entrada_saldo',
          valorEntrada: ent,
          metodoEntrada: 'pix',
          saldoTipoPrazo: 'parcelas',
          saldoParcelas: parc,
          saldoMetodo: 'cartao',
          saldoValorParcela: Number((saldo / parc).toFixed(2)),
          valorTotal: t,
        };
        break;
      }
      case 'cartao_10x': {
        const parc = 10;
        updated = {
          titulo: 'Opção: Cartão de Crédito em 10x',
          tipo: 'cartao',
          parcelas: parc,
          tipoCartao: 'credito',
          valorParcela: Number((t / parc).toFixed(2)),
          valorTotal: t,
        };
        break;
      }
      case 'pix_parcelado': {
        const parc = 4;
        updated = {
          titulo: 'Opção: PIX Parcelado em 4x',
          tipo: 'pix_parcelado',
          parcelas: parc,
          diaVencimento: 10,
          valorParcela: Number((t / parc).toFixed(2)),
          valorTotal: t,
        };
        break;
      }
      case 'conclusao': {
        const ent = Number((t * 0.4).toFixed(2));
        const saldo = Math.max(0, Number((t - ent).toFixed(2)));
        updated = {
          titulo: 'Opção: Entrada + Saldo na Conclusão',
          tipo: 'entrada_saldo',
          valorEntrada: ent,
          metodoEntrada: 'pix',
          saldoTipoPrazo: 'conclusao',
          saldoMetodo: 'conclusao',
          saldoValorParcela: saldo,
          valorTotal: t,
        };
        break;
      }
    }

    setter((prev) => {
      const merged = { ...prev, ...updated };
      merged.descricao = calcularDescricaoCondicao(merged, t);
      return merged;
    });
  };

  const handleChangePixParcelas = (qtd: number) => {
    setPixParcelas(qtd);
    const novasDatas: string[] = [];
    const hoje = new Date();
    for (let i = 0; i < qtd; i++) {
      if (pixDatasParcelas[i]) {
        novasDatas.push(pixDatasParcelas[i]);
      } else {
        const targetMonth = hoje.getMonth() + (i + 1);
        const d = new Date(hoje.getFullYear(), targetMonth, 1);
        const maxDias = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(pixDiaVencimento, maxDias));
        novasDatas.push(formatIsoDate(d));
      }
    }
    setPixDatasParcelas(novasDatas);
    const novasSits: Array<'A vencer' | 'Quitada'> = Array.from({ length: qtd }, (_, i) => pixSituacoesParcelas[i] || 'A vencer');
    setPixSituacoesParcelas(novasSits);
    if (pixParceladoAtivo) {
      setFormasPagamento(montarTextoPixParcelado(pixEntrada, qtd, pixDiaVencimento, total, pixDataEntrada, novasDatas, pixEntradaSituacao, novasSits));
    }
  };

  const handleChangePixDia = (dia: number) => {
    setPixDiaVencimento(dia);
    const novasDatas = gerarDatasPadrao(pixParcelas, dia);
    setPixDatasParcelas(novasDatas);
    if (pixParceladoAtivo) {
      setFormasPagamento(montarTextoPixParcelado(pixEntrada, pixParcelas, dia, total, pixDataEntrada, novasDatas, pixEntradaSituacao, pixSituacoesParcelas));
    }
  };

  const handleAtualizarDataParcela = (idx: number, novaDataIso: string) => {
    const novas = [...pixDatasParcelas];
    novas[idx] = novaDataIso;
    setPixDatasParcelas(novas);
    if (pixParceladoAtivo) {
      setFormasPagamento(montarTextoPixParcelado(pixEntrada, pixParcelas, pixDiaVencimento, total, pixDataEntrada, novas, pixEntradaSituacao, pixSituacoesParcelas));
    }
  };

  const addProcedimento = (id: string) => {
    const p = procedimentos.find((x) => x.id === id);
    if (!p) return;
    setItens((prev) => [...prev, { nome: p.nome, quantidade: 1, valor: p.preco }]);
    setSelectKey((k) => k + 1);
  };

  const normalizarTexto = (txt: string) =>
    (txt || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const procedimentosAtivos = useMemo(() => {
    return procedimentos.filter((p) => p.ativo);
  }, [procedimentos]);

  const procedimentosFiltrados = useMemo(() => {
    const termo = normalizarTexto(buscaProcedimento.trim());
    if (!termo) return procedimentosAtivos;

    return procedimentosAtivos.filter((p) => {
      const nomeNorm = normalizarTexto(p.nome);
      const catNorm = normalizarTexto(p.categoria || '');
      const descNorm = normalizarTexto(p.descricao || '');
      const precoFormatado = formatMoney(p.preco).toLowerCase();
      const precoNum = String(p.preco);

      return (
        nomeNorm.includes(termo) ||
        catNorm.includes(termo) ||
        descNorm.includes(termo) ||
        precoFormatado.includes(termo) ||
        precoNum.includes(termo)
      );
    });
  }, [procedimentosAtivos, buscaProcedimento]);

  const addItemManual = () => setItens((prev) => [...prev, { nome: '', quantidade: 1, valor: 0 }]);

  const parceiroSelecionado = parceiros.find((p) => p.id === parceiroId);
  const repasseCalculado = !parceriaAtiva
    ? 0
    : tipoRepasse === 'percentual'
      ? (total * (valorRepasse || 0)) / 100
      : valorRepasse || 0;

  const handleSelecionarParceiro = (id: string) => {
    setParceiroId(id);
    const p = parceiros.find((x) => x.id === id);
    if (p) {
      setTipoRepasse(p.tipoRepasse);
      setValorRepasse(p.valorRepasse);
    }
  };

  const criarParceiroRapido = async () => {
    if (!novoNome.trim()) {
      toast.error('Informe o nome do parceiro');
      return;
    }
    await addParceiro({
      nome: novoNome.trim(),
      tipoRepasse,
      valorRepasse: valorRepasse || 0,
      ativo: true,
    } as never);
    const lista = await refetchParceiros();
    setNovoParceiro(false);
    setNovoNome('');
    void lista;
  };

  const abrirNovo = () => {
    setEditingId(null);
    setStatusEdicao('rascunho');
    setTitulo('Plano de tratamento');
    setItens([]);
    setDesconto(0);
    setObservacoes('');
    setFormasPagamento('');
    const trio = gerarTrioPropostasSugeridas(0);
    setCondicoesNegociacao(trio);
    setCondicaoAtivaId('');
    setModoFormaPagamento('propostas');
    setPixParceladoAtivo(false);
    setCartaoAssistenteAtivo(false);
    setEntradaAssistenteAtivo(false);
    setValorEntrada(0);
    setMetodoEntrada('pix');
    setDataEntrada(formatIsoDate(new Date()));
    setSituacaoEntrada('Quitada');
    setModalidadeSaldo('combinar');
    setSaldoCartaoOperadoraId(configMaquinas.operadoraPadraoId || 'infinitepay');
    setSaldoCartaoParcelas(3);
    setSaldoPixParcelas(3);
    setSaldoPixDiaVencimento(10);
    setSaldoBoletoParcelas(3);
    setSaldoBoletoDiaVencimento(10);
    setCartaoOperadoraId(configMaquinas.operadoraPadraoId || 'infinitepay');
    setCartaoTipo('credito');
    setCartaoParcelas(3);
    setPixEntrada(0);
    setPixDataEntrada(formatIsoDate(new Date()));
    setPixEntradaSituacao('A vencer');
    setPixParcelas(3);
    setPixDiaVencimento(10);
    setPixDatasParcelas(gerarDatasPadrao(3, 10));
    setPixSituacoesParcelas(['A vencer', 'A vencer', 'A vencer']);
    setMultiplasFormasAtivo(false);
    const hojeIso = formatIsoDate(new Date());
    setFormasMultiplas([
      { id: '1', rotulo: 'Entrada', metodo: 'pix', valor: 0, parcelas: 1, diaVencimento: 10, dataPagamento: hojeIso, datasParcelas: [hojeIso], situacao: 'A vencer', situacoesParcelas: ['A vencer'] },
      { id: '2', rotulo: 'Restante', metodo: 'cartao', valor: 0, parcelas: 3, diaVencimento: 10, dataPagamento: hojeIso, datasParcelas: gerarDatasPadrao(3, 10), situacao: 'Autorizado', situacoesParcelas: ['Autorizado', 'Autorizado', 'Autorizado'], operadoraCartaoId: configMaquinas.operadoraPadraoId || 'infinitepay', tipoCartao: 'credito' },
    ]);
    setParceriaAtiva(false);
    setParceiroId('');
    setValorRepasse(0);
    setBuscaProcedimento('');
    setOpenBuscaProcedimento(false);
    setSelectedProcedimentoIndex(0);
    setModoCalculoValor('desconto');
    setInputValorFinal('');
    setOpen(true);
  };

  const abrirEdicao = (o: (typeof orcamentos)[number]) => {
    setEditingId(o.id);
    setStatusEdicao(o?.status || 'rascunho');
    setTitulo(o.titulo);
    setItens(o.itens.map((i) => ({ ...i })));
    setDesconto(o.desconto || 0);
    setObservacoes(o.observacoes || '');
    setFormasPagamento(o.formasPagamento || '');
    const parsed = parseCondicoesPagamento(o.formasPagamento, o.total);
    if (parsed.length > 0) {
      setCondicoesNegociacao(parsed);
      const sel = o.status === 'aprovado' ? parsed.find((c) => c.selecionada) : undefined;
      setCondicaoAtivaId(sel ? sel.id : '');
      setModoFormaPagamento(parsed.length > 1 || parsed[0].tipo !== 'personalizado' ? 'propostas' : 'livre');
    } else {
      const trio = gerarTrioPropostasSugeridas(o.total || 0);
      setCondicoesNegociacao(trio);
      setCondicaoAtivaId('');
      setModoFormaPagamento('propostas');
    }
    setBuscaProcedimento('');
    setOpenBuscaProcedimento(false);
    setSelectedProcedimentoIndex(0);
    setModoCalculoValor('desconto');
    setInputValorFinal(o.total ? String(o.total) : '');

    // Detecta configurações do Assistente de Entrada + Saldo
    let ehApenasEntradaOuSaldoACombinar = false;
    if (o.formasPagamento && /entrada/i.test(o.formasPagamento)) {
      const matchEntrada = o.formasPagamento.match(/entrada[^\d\n\r]*?(?:de|:)?\s*(?:r\$)?\s*([\d.,]+)/i);
      if (matchEntrada) {
        const parsedEnt = parseBrMoney(matchEntrada[1]);
        if (parsedEnt > 0) {
          setValorEntrada(parsedEnt);
        }
      }

      const parteEntrada = o.formasPagamento.split(/\+/)[0] || '';
      if (/cart[aã]o.*d[eé]bito|d[eé]bito/i.test(parteEntrada)) setMetodoEntrada('cartao_debito');
      else if (/cart[aã]o/i.test(parteEntrada)) setMetodoEntrada('cartao_credito');
      else if (/dinheiro/i.test(parteEntrada)) setMetodoEntrada('dinheiro');
      else if (/transfer[eê]ncia/i.test(parteEntrada)) setMetodoEntrada('transferencia');
      else setMetodoEntrada('pix');

      const matchData = parteEntrada.match(/\(em\s*(\d{1,2}\/\d{1,2}\/\d{4})\)/i);
      if (matchData) {
        const [d, m, y] = matchData[1].split('/');
        setDataEntrada(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
      } else {
        setDataEntrada(formatIsoDate(new Date()));
      }

      const matchSit = parteEntrada.match(/\[(?:situa[çc][aã]o:\s*)?([^\]]+)\]/i);
      if (matchSit && /quitad|pago/i.test(matchSit[1])) {
        setSituacaoEntrada('Quitada');
      } else {
        setSituacaoEntrada('A vencer');
      }

      const parteSaldo = o.formasPagamento.includes('+') ? o.formasPagamento.split('+').slice(1).join('+') : '';
      if (parteSaldo) {
        if (/combinar|definir|pendente/i.test(parteSaldo)) {
          setModalidadeSaldo('combinar');
        } else if (/cart[aã]o/i.test(parteSaldo)) {
          setModalidadeSaldo('cartao');
          const parcMatch = parteSaldo.match(/(\d+)\s*x/i);
          if (parcMatch) setSaldoCartaoParcelas(Number(parcMatch[1]) || 3);
          const det = extrairDetalhesCartaoDeTexto(parteSaldo, operadoras, configMaquinas.operadoraPadraoId);
          if (det.operadora) setSaldoCartaoOperadoraId(det.operadora.id);
        } else if (/pix\s*parcelado/i.test(parteSaldo)) {
          setModalidadeSaldo('pix_parcelado');
          const parcMatch = parteSaldo.match(/(\d+)\s*x/i);
          if (parcMatch) setSaldoPixParcelas(Number(parcMatch[1]) || 3);
          const diaMatch = parteSaldo.match(/(?:dia|vencimento todo dia)\s*(\d{1,2})/i);
          if (diaMatch) setSaldoPixDiaVencimento(Number(diaMatch[1]) || 10);
        } else if (/boleto/i.test(parteSaldo)) {
          setModalidadeSaldo('boleto');
          const parcMatch = parteSaldo.match(/(\d+)\s*x/i);
          if (parcMatch) setSaldoBoletoParcelas(Number(parcMatch[1]) || 3);
          const diaMatch = parteSaldo.match(/(?:dia|vencimento todo dia)\s*(\d{1,2})/i);
          if (diaMatch) setSaldoBoletoDiaVencimento(Number(diaMatch[1]) || 10);
        } else if (/conclus[aã]o|t[eé]rmino/i.test(parteSaldo)) {
          setModalidadeSaldo('conclusao');
        }
      }

      if (/saldo.*combinar|saldo restante|apenas entrada/i.test(o.formasPagamento) || !o.formasPagamento.includes('+')) {
        ehApenasEntradaOuSaldoACombinar = true;
        setEntradaAssistenteAtivo(true);
      }
    } else {
      setEntradaAssistenteAtivo(false);
      setValorEntrada(0);
      setMetodoEntrada('pix');
      setDataEntrada(formatIsoDate(new Date()));
      setSituacaoEntrada('Quitada');
      setModalidadeSaldo('combinar');
    }

    // Verifica se possui múltiplas formas de pagamento (ex: Entrada PIX + Restante Cartão)
    if (
      !ehApenasEntradaOuSaldoACombinar &&
      o.formasPagamento &&
      (o.formasPagamento.includes('+') ||
        /entrada.*cart[aã]o/i.test(o.formasPagamento) ||
        /entrada.*via/i.test(o.formasPagamento))
    ) {
      setMultiplasFormasAtivo(true);
      setPixParceladoAtivo(false);
      setCartaoAssistenteAtivo(false);
      setPixDataEntrada(formatIsoDate(new Date()));
      setPixEntradaSituacao('A vencer');
      setPixDatasParcelas(gerarDatasPadrao(3, 10));
      setPixSituacoesParcelas(['A vencer', 'A vencer', 'A vencer']);

      const partes = o.formasPagamento.split('+').map((p) => p.trim()).filter(Boolean);
      const formasCarregadas: typeof formasMultiplas = [];

      for (let i = 0; i < partes.length; i++) {
        const parte = partes[i];
        const rotuloMatch = parte.match(/^([^:]+):/);
        const rotulo = rotuloMatch ? rotuloMatch[1].trim() : (/entrada/i.test(parte) ? 'Entrada' : `Forma ${i + 1}`);
        const conteudo = rotuloMatch ? parte.slice(rotuloMatch[0].length).trim() : parte.trim();

        let metodo: 'pix' | 'cartao' | 'dinheiro' | 'boleto' | 'transferencia' | 'pix_parcelado' = 'pix';
        if (/cart[aã]o/i.test(conteudo) || /cart[aã]o/i.test(parte)) metodo = 'cartao';
        else if (/boleto/i.test(conteudo) || /boleto/i.test(parte)) metodo = 'boleto';
        else if (/pix\s*parcelado/i.test(conteudo) || /pix\s*parcelado/i.test(parte)) metodo = 'pix_parcelado';
        else if (/pix/i.test(conteudo) || /pix/i.test(parte)) metodo = 'pix';
        else if (/dinheiro/i.test(conteudo) || /dinheiro/i.test(parte)) metodo = 'dinheiro';
        else if (/transfer[eê]ncia/i.test(conteudo) || /transfer[eê]ncia/i.test(parte)) metodo = 'transferencia';

        const parcMatch = conteudo.match(/(\d+)\s*x(?:\s+(?:de\s+)?(?:r\$)?\s*([\d.,]+))?/i);
        const qtdParc = parcMatch ? Math.max(1, parseInt(parcMatch[1], 10)) : 1;
        const valParcExpl = parcMatch && parcMatch[2] ? parseBrMoney(parcMatch[2]) : 0;

        const valComMoedaMatch = conteudo.match(/r\$\s*([\d.,]+)/i);
        const valSemMoedaMatch = conteudo.match(/^([\d.,]+)/);
        const valStr = valComMoedaMatch ? valComMoedaMatch[1] : (valSemMoedaMatch ? valSemMoedaMatch[1] : '');
        let valorParte = parseBrMoney(valStr);

        if (qtdParc > 1 && valParcExpl > 0) {
          if (valorParte <= 0 || valorParte < valParcExpl) {
            valorParte = valParcExpl * qtdParc;
          }
        }

        const diaMatch = conteudo.match(/(?:vencimento|dia)\s*(?:todo\s*dia)?\s*(\d{1,2})/i);
        const diaVenc = diaMatch ? Math.min(28, Math.max(1, parseInt(diaMatch[1], 10))) : 10;

        // Data de pagamento única (em DD/MM/YYYY)
        const dataPagMatch = conteudo.match(/\(em\s*(\d{1,2}\/\d{1,2}\/\d{4})\)/i);
        let dataPagIso = formatIsoDate(new Date());
        if (dataPagMatch) {
          const [d, m, y] = dataPagMatch[1].split('/');
          dataPagIso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }

        // Datas de parcelas personalizadas se houver
        const trechoVenc = conteudo.match(/vencimentos?:\s*([^\)]+)/i);
        let datasDetectadas: string[] = [];
        if (trechoVenc) {
          const regexDatas = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
          const matches = Array.from(trechoVenc[1].matchAll(regexDatas));
          datasDetectadas = matches.map((m) => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
        }

        const datasFinais = datasDetectadas.length === qtdParc
          ? datasDetectadas
          : gerarDatasPadrao(qtdParc, diaVenc);

        // Situação da forma e parcelas
        const sitMatch = parte.match(/\[(?:situa[çc][aã]o:\s*)?([^\]]+)\]/i);
        let situacaoForma: 'A vencer' | 'Quitada' | 'Autorizado' = metodo === 'cartao' ? 'Autorizado' : 'A vencer';
        let situacoesParcelasForma: Array<'A vencer' | 'Quitada' | 'Autorizado'> = [];

        if (sitMatch) {
          const rawSit = sitMatch[1].trim();
          if (rawSit.includes(',')) {
            const arr = rawSit.split(',').map((s) => s.trim());
            situacoesParcelasForma = arr.map((s) => {
              if (/quitad|pago/i.test(s)) return 'Quitada';
              if (/autoriz/i.test(s)) return 'Autorizado';
              return 'A vencer';
            });
            situacaoForma = situacoesParcelasForma[0] || situacaoForma;
          } else {
            if (/quitad|pago/i.test(rawSit)) situacaoForma = 'Quitada';
            else if (/autoriz/i.test(rawSit)) situacaoForma = 'Autorizado';
            else if (/venc/i.test(rawSit)) situacaoForma = 'A vencer';
            situacoesParcelasForma = Array(qtdParc).fill(situacaoForma);
          }
        } else {
          situacoesParcelasForma = Array(qtdParc).fill(situacaoForma);
        }

        let opCartaoId = configMaquinas.operadoraPadraoId || 'infinitepay';
        let tipoCartao: 'credito' | 'debito' = 'credito';
        let taxaCartaoPerc: number | undefined = undefined;
        let taxaCartaoVal: number | undefined = undefined;

        if (metodo === 'cartao') {
          const det = extrairDetalhesCartaoDeTexto(conteudo, operadoras, configMaquinas.operadoraPadraoId);
          if (det.operadora) opCartaoId = det.operadora.id;
          if (det.isDebito) tipoCartao = 'debito';
          const op = det.operadora || operadoraPadrao;
          const calc = calcularTaxaCartao(op, qtdParc, valorParte, tipoCartao === 'debito');
          taxaCartaoPerc = calc.taxaPercentual;
          taxaCartaoVal = calc.taxaValor;
        }

        formasCarregadas.push({
          id: String(i + 1),
          rotulo,
          metodo,
          valor: valorParte,
          parcelas: qtdParc,
          diaVencimento: diaVenc,
          dataPagamento: dataPagIso,
          datasParcelas: datasFinais,
          situacao: situacaoForma,
          situacoesParcelas: situacoesParcelasForma,
          operadoraCartaoId: opCartaoId,
          tipoCartao,
          taxaCartaoPercentual: taxaCartaoPerc,
          taxaCartaoValor: taxaCartaoVal,
        });
      }

      if (formasCarregadas.length > 0) {
        setFormasMultiplas(formasCarregadas);
      }
    } else if (o.formasPagamento && /pix\s*parcelado/i.test(o.formasPagamento)) {
      setMultiplasFormasAtivo(false);
      setCartaoAssistenteAtivo(false);
      setPixParceladoAtivo(true);
      const entradaMatch = o.formasPagamento.match(/entrada(?:\s+de)?\s*(?:r\$)?\s*([\d.,]+)/i);
      const entVal = entradaMatch ? Number(entradaMatch[1].replace(/\./g, '').replace(',', '.')) || 0 : 0;
      setPixEntrada(entVal);

      const dataEntMatch = o.formasPagamento.match(/entrada[^\n]+?\(em\s*(\d{1,2}\/\d{1,2}\/\d{4})\)/i);
      if (dataEntMatch) {
        const [d, m, y] = dataEntMatch[1].split('/');
        setPixDataEntrada(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
      } else {
        setPixDataEntrada(formatIsoDate(new Date()));
      }

      // Situação da Entrada PIX
      const entSitMatch = o.formasPagamento.match(/entrada[^\+]+?\[(?:situa[çc][aã]o:\s*)?([^\]]+)\]/i);
      if (entSitMatch && /quitad|pago/i.test(entSitMatch[1])) {
        setPixEntradaSituacao('Quitada');
      } else {
        setPixEntradaSituacao('A vencer');
      }

      const parcMatch = o.formasPagamento.match(/(\d+)\s*x/i);
      const qtdParc = parcMatch ? Number(parcMatch[1]) || 3 : 3;
      setPixParcelas(qtdParc);

      const diaMatch = o.formasPagamento.match(/(?:vencimento|dia)\s*(?:todo\s*dia)?\s*(\d{1,2})/i);
      const diaVenc = diaMatch ? Number(diaMatch[1]) || 10 : 10;
      setPixDiaVencimento(diaVenc);

      // Extrai datas personalizadas de vencimento se houver
      const trechoVenc = o.formasPagamento.match(/vencimentos?:\s*([^\)]+)/i);
      let datasDetectadas: string[] = [];
      if (trechoVenc) {
        const regexDatas = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
        const matches = Array.from(trechoVenc[1].matchAll(regexDatas));
        datasDetectadas = matches.map((m) => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
      }

      if (datasDetectadas.length === qtdParc) {
        setPixDatasParcelas(datasDetectadas);
      } else {
        setPixDatasParcelas(gerarDatasPadrao(qtdParc, diaVenc));
      }

      // Situação das Parcelas PIX
      const parcSitMatch = o.formasPagamento.match(/x\s+de[^\n]+?\[(?:situa[çc][aã]o:\s*)?([^\]]+)\]/i) || o.formasPagamento.match(/\)\[(?:situa[çc][aã]o:\s*)?([^\]]+)\]/i);
      let sitsParc: Array<'A vencer' | 'Quitada'> = Array(qtdParc).fill('A vencer');
      if (parcSitMatch) {
        const raw = parcSitMatch[1] ? parcSitMatch[1].trim() : '';
        if (raw.includes(',')) {
          sitsParc = raw.split(',').map((s) => (/quitad|pago/i.test(s.trim()) ? 'Quitada' : 'A vencer'));
        } else if (/quitad|pago/i.test(raw)) {
          sitsParc = Array(qtdParc).fill('Quitada');
        }
      }
      setPixSituacoesParcelas(sitsParc);
    } else {
      setMultiplasFormasAtivo(false);
      setPixParceladoAtivo(false);
      setPixEntrada(0);
      setPixDataEntrada(formatIsoDate(new Date()));
      setPixEntradaSituacao('A vencer');
      setPixParcelas(3);
      setPixDiaVencimento(10);
      setPixDatasParcelas(gerarDatasPadrao(3, 10));
      setPixSituacoesParcelas(['A vencer', 'A vencer', 'A vencer']);

      // Se for pagamento simples no cartão, detecta operadora para o assistente
      if (o.formasPagamento && /cart[aã]o|cr[eé]dito|d[eé]bito/i.test(o.formasPagamento)) {
        const det = extrairDetalhesCartaoDeTexto(o.formasPagamento, operadoras, configMaquinas.operadoraPadraoId);
        if (det.operadora) setCartaoOperadoraId(det.operadora.id);
        setCartaoTipo(det.isDebito ? 'debito' : 'credito');
        setCartaoParcelas(det.parcelas || 1);
        setCartaoAssistenteAtivo(true);
      } else {
        setCartaoAssistenteAtivo(false);
      }
    }
    setParceriaAtiva(!!o.parceiroId || !!o.parceiroNome);
    setParceiroId(o.parceiroId || '');
    setTipoRepasse((o.parceiroTipoRepasse as TipoRepasse) || 'percentual');
    setValorRepasse(o.parceiroValorRepasse || 0);
    setOpen(true);
  };

  const handleSave = async () => {
    if (itens.length === 0) {
      toast.error('Adicione pelo menos um procedimento');
      return;
    }

    // Saneamento preventivo para garantir que propostas nunca sejam salvas com R$ 0,00 quando total > 0
    const condicoesSaneadas = (condicoesNegociacao || []).map((c) => {
      let vTotal = typeof c.valorTotal === 'number' && c.valorTotal > 0 ? c.valorTotal : total;
      let dValor = c.descontoValor;
      let vParcela = c.valorParcela;
      let vEntrada = c.valorEntrada;
      let vSaldoParc = c.saldoValorParcela;

      if (c.tipo === 'a_vista') {
        const perc = typeof c.descontoPercentual === 'number' ? c.descontoPercentual : 0;
        if (perc > 0 && (!dValor || dValor === 0 || vTotal === total)) {
          dValor = Number(((total * perc) / 100).toFixed(2));
          vTotal = Math.max(0, Number((total - dValor).toFixed(2)));
        }
      } else if (c.tipo === 'cartao') {
        const p = Math.max(1, c.parcelas || 1);
        if (!vParcela || vParcela === 0) {
          vParcela = Number((total / p).toFixed(2));
        }
        vTotal = total;
      } else if (c.tipo === 'entrada_saldo') {
        if (!vEntrada || vEntrada === 0) {
          vEntrada = Number((total * 0.5).toFixed(2));
        }
        const saldoRestante = Math.max(0, Number((total - vEntrada).toFixed(2)));
        const parcSaldo = Math.max(1, c.saldoParcelas || 1);
        if (!vSaldoParc || vSaldoParc === 0) {
          vSaldoParc = Number((saldoRestante / parcSaldo).toFixed(2));
        }
        vTotal = total;
      }

      const descSaneada = calcularDescricaoCondicao({
        ...c,
        valorTotal: vTotal,
        descontoValor: dValor,
        valorParcela: vParcela,
        valorEntrada: vEntrada,
        saldoValorParcela: vSaldoParc,
      }, total);

      return {
        ...c,
        valorTotal: vTotal,
        descontoValor: dValor,
        valorParcela: vParcela,
        valorEntrada: vEntrada,
        saldoValorParcela: vSaldoParc,
        descricao: descSaneada,
      };
    });

    const formasParaSalvar =
      modoFormaPagamento === 'propostas' && condicoesSaneadas.length > 0
        ? serializarCondicoesPagamento(condicoesSaneadas, condicaoAtivaId)
        : formasPagamento;

    await saveOrcamento({
      id: editingId || undefined,
      titulo,
      itens,
      desconto,
      observacoes,
      formasPagamento: formasParaSalvar,
      pacienteId: patient.id,
      pacienteNome: patient.nome,
      status: statusEdicao,
      parceiroId: parceriaAtiva ? parceiroId || null : null,
      parceiroNome: parceriaAtiva ? parceiroSelecionado?.nome || novoNome || null : null,
      parceiroTipoRepasse: parceriaAtiva ? tipoRepasse : null,
      parceiroValorRepasse: parceriaAtiva ? valorRepasse || 0 : 0,
    });
    if (statusEdicao === 'aprovado' && updatePaciente && patient?.id) {
      try {
        await updatePaciente(patient.id, { status: 'Em Tratamento' });
      } catch (errP) {
        console.error('Erro ao atualizar status do paciente para Em Tratamento:', errP);
      }
    }
    setOpen(false);
    setEditingId(null);
    setStatusEdicao('rascunho');
    setTitulo('Plano de tratamento');
    setItens([]);
    setDesconto(0);
    setObservacoes('');
    setFormasPagamento('');
    setParceriaAtiva(false);
    setParceiroId('');
    setValorRepasse(0);
    setNovoParceiro(false);
    setNovoNome('');
    setEntradaAssistenteAtivo(false);
    setValorEntrada(0);
    setMetodoEntrada('pix');
    setDataEntrada(formatIsoDate(new Date()));
    setSituacaoEntrada('Quitada');
    setModalidadeSaldo('combinar');
  };

  const baixarPdf = async (o: (typeof orcamentos)[number]) => {
    const t = toast.loading('Gerando PDF...');
    const dentistaResponsavel = dentistas.find((d) => d.ativo) || dentistas[0];
    const snapAprovacao = (o.snapshotAprovacao || (o as any).snapshot_aprovacao || {}) as any;
    const ok = await gerarOrcamentoPdf(
      {
        titulo: o.titulo,
        pacienteNome: o.pacienteNome || patient?.nome,
        pacienteCpf: patient?.cpf || null,
        dentistaNome: dentistaResponsavel?.nome || null,
        dentistaCro: dentistaResponsavel?.cro || null,
        itens: o.itens,
        desconto: o.desconto,
        total: o.total,
        observacoes: o.observacoes,
        formasPagamento: o.formasPagamento,
        validade: o.validade,
        criadoEm: o.criadoEm,
        status: o.status,
        condicaoEscolhida: o.condicaoEscolhida || snapAprovacao?.condicaoEscolhida || (o.assinaturaPaciente as any)?.condicaoEscolhida,
        aprovadoEm: o.aprovadoEm || snapAprovacao?.aprovadoEm || (o.assinaturaPaciente as any)?.dataAprovacao,
        snapshotAprovacao: o.snapshotAprovacao || (o as any).snapshot_aprovacao,
        contratoId: o.contratoId || snapAprovacao?.contratoId || (o.assinaturaPaciente as any)?.contratoId,
        identificador: (o as any).identificador || o.id,
        versao: (o as any).versao || 1,
      },
      {
        nomeClinica: configuracoes?.nomeClinica,
        logoUrl: configuracoes?.logoUrl,
        cnpj: configuracoes?.cnpj,
        endereco: configuracoes?.endereco,
        telefone: configuracoes?.telefone,
        email: configuracoes?.email,
      }
    );
    toast.dismiss(t);
    if (ok) toast.success('PDF baixado');
    else toast.error('Não foi possível gerar o PDF');
  };


  const copiarLinkOrcamento = async (o: (typeof orcamentos)[number]) => {
    const res = await garantirOrcamentoPersistidoComToken(o, patient);
    if (res.link) {
      navigator.clipboard.writeText(res.link);
      toast.success('Link do orçamento copiado com sucesso!', {
        description: 'Envie para o paciente visualizar a proposta e aprovar pelo celular.',
      });
    } else {
      toast.error('Erro ao gerar link do orçamento.');
    }
  };

  const visualizarComoPaciente = async (o: (typeof orcamentos)[number]) => {
    const res = await garantirOrcamentoPersistidoComToken(o, patient);
    if (res.link) {
      window.open(res.link, '_blank');
    }
  };

  // Recupera o PDF bilateral definitivo oficial arquivado no Supabase Storage (documentos-pacientes)
  const obterPdfContratoOficial = async (o: any, contObj: any, idContratoExibicao: string) => {
    return await obterPdfContratoOficialDefinitivo(idContratoExibicao, contObj || o);
  };

  // Abre visualizador dedicado com o PDF oficial bilateralmente assinado do Storage
  const handleAbrirVisualizadorPdfAssinado = async (o: any, contObj: any, idContratoExibicao: string) => {
    setVisualizadorPdfAssinado({
      isOpen: true,
      loading: true,
      error: null,
      pdfUrl: null,
      blob: null,
      signedUrl: null,
      identificador: idContratoExibicao,
      titulo: `Contrato Odontológico Formalizado #${idContratoExibicao}`,
      tentarNovamenteFn: () => handleAbrirVisualizadorPdfAssinado(o, contObj, idContratoExibicao),
    });

    try {
      const res = await obterPdfContratoOficial(o, contObj, idContratoExibicao);
      if (res?.blobUrl || res?.signedUrl) {
        setVisualizadorPdfAssinado((prev) => ({
          ...prev,
          loading: false,
          error: null,
          pdfUrl: res.blobUrl || res.signedUrl,
          blob: res.blob,
          signedUrl: res.signedUrl,
        }));
      } else {
        setVisualizadorPdfAssinado((prev) => ({
          ...prev,
          loading: false,
          error: 'O PDF bilateral definitivo com as assinaturas arquivadas não foi localizado no Storage privado (documentos-pacientes).',
        }));
      }
    } catch (err: any) {
      setVisualizadorPdfAssinado((prev) => ({
        ...prev,
        loading: false,
        error: 'Erro de comunicação ao recuperar o contrato oficial do Storage: ' + (err?.message || 'Tente novamente.'),
      }));
    }
  };

  const enviarWhatsAppOrcamento = async (o: (typeof orcamentos)[number]) => {
    let tel = patient?.telefone?.trim() || '';
    if (!tel) {
      const inputTel = window.prompt('Informe o número de WhatsApp do paciente com DDD (ex: 82999998888):', '');
      if (!inputTel) {
        toast.info('Envio cancelado: telefone não informado.');
        return;
      }
      tel = inputTel.trim();
    }

    const resOrc = await garantirOrcamentoPersistidoComToken(o, patient);
    const linkOrcamento = resOrc.link;

    const linhas = [
      `Olá, *${patient?.nome || 'Paciente'}*! Tudo bem?`,
      '',
      `Segue a proposta de tratamento odontológico da *${configuracoes?.nomeClinica || 'Clínica Odontológica'}*:`,
      `📋 *${o.titulo}*`,
      '',
      ...o.itens.map((i) => `• ${i.nome} ${i.quantidade > 1 ? `(${i.quantidade}x) ` : ''}— ${formatMoney(i.valor * i.quantidade)}`),
      o.desconto ? `Desconto especial: -${formatMoney(o.desconto)}` : null,
      `*Valor Total: ${formatMoney(o.total)}*`,
      '',
      gerarTextoWhatsAppCondicoes(parseCondicoesPagamento(o.formasPagamento, o.total), o.total),
      o.observacoes ? `Observações: ${o.observacoes}` : null,
      '',
      `📱 *LINK PARA VISUALIZAR E APROVAR SEU ORÇAMENTO ONLINE:*`,
      `Clique no link abaixo pelo seu celular para escolher a forma de pagamento e aprovar:`,
      `👉 ${linkOrcamento}`,
      '',
      'Qualquer dúvida estamos à sua inteira disposição!',
    ];

    try {
      baixarPdf(o);
    } catch (_) {}

    openWhatsApp(tel, linhas.filter(Boolean).join('\n'));
    updateStatus(o.id, 'enviado');
    toast.info('Abrindo WhatsApp!', {
      description: 'Proposta com link do orçamento pronta para envio!',
    });
  };

  const copiarLinkContrato = async (o: (typeof orcamentos)[number]) => {
    const valContratada = validarDadosContratada(configContrato);
    if (!valContratada.valido) {
      toast.warning('Atenção: complete os dados da clínica em Configurações → Contrato & PIX.', {
        description: valContratada.erros[0],
      });
    }

    const snap = mapearDadosContrato({
      patient,
      orcamento: o,
      configuracoes,
      configuracoesContrato: configContrato,
      dentistas,
      dadosRestauracoesPreexistentes: patient?.restauracoesPreexistentes,
    });

    const valCronograma = validarCronogramaFinanceiroContrato(snap);
    if (!valCronograma.valido) {
      toast.error('Emissão do contrato bloqueada: cronograma financeiro incompleto.', {
        description: valCronograma.erros[0] || 'Aprove o orçamento selecionando a condição de pagamento acordada com o paciente.',
      });
      return;
    }

    const resEmissao = await emitirContratoPersistido(snap, o.id);
    const link = resEmissao.link;
    navigator.clipboard.writeText(link);
    toast.success('Link de assinatura do contrato copiado com sucesso!', {
      description: 'Envie para o paciente assinar pelo celular.',
    });
  };

  const enviarWhatsApp = enviarWhatsAppOrcamento;

  const enviarWhatsAppAntigo = async (o: (typeof orcamentos)[number]) => {
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
      `*${o.titulo}*`,
      ...o.itens.map((i) => `• ${i.nome} ${i.quantidade > 1 ? `(${i.quantidade}x) ` : ''}— ${formatMoney(i.valor * i.quantidade)}`),
      o.desconto ? `Desconto: ${formatMoney(o.desconto)}` : null,
      `*Total: ${formatMoney(o.total)}*`,
      '',
      gerarTextoWhatsAppCondicoes(parseCondicoesPagamento(o.formasPagamento, o.total), o.total),
      o.observacoes || null,
    ];

    const valContratadaWhats = validarDadosContratada(configContrato);
    if (!valContratadaWhats.valido) {
      toast.warning('Atenção: complete os dados da clínica em Configurações → Contrato & PIX.', {
        description: valContratadaWhats.erros[0],
      });
    }

    const snap = mapearDadosContrato({
      patient,
      orcamento: o,
      configuracoes,
      configuracoesContrato: configContrato,
      dentistas,
      dadosRestauracoesPreexistentes: patient?.restauracoesPreexistentes,
    });

    const valCronogramaWhats = validarCronogramaFinanceiroContrato(snap);
    if (!valCronogramaWhats.valido) {
      toast.error('Emissão do contrato bloqueada: cronograma financeiro incompleto.', {
        description: valCronogramaWhats.erros[0] || 'Aprove o orçamento selecionando a condição de pagamento acordada com o paciente.',
      });
      return;
    }

    const resEmissaoWhats = await emitirContratoPersistido(snap, o.id);
    const link = resEmissaoWhats.link;

    linhas.push('');
    linhas.push(`✍️ *LINK PARA VISUALIZAR E ASSINAR O CONTRATO ONLINE:*`);
    linhas.push(`Clique no link abaixo pelo seu celular para ler o contrato e assinar digitalmente:`);
    linhas.push(`👉 ${link}`);

    // Baixa o PDF do orçamento automaticamente para facilitar o anexo se desejar
    try {
      baixarPdf(o);
    } catch (_) {}

    openWhatsApp(tel, linhas.filter(Boolean).join('\n'));
    updateStatus(o.id, 'enviado');
    toast.info('Abrindo WhatsApp Web!', {
      description: 'Link de assinatura incluso na mensagem e PDF baixado para facilitar envio!',
    });
  };

  const renderStatusBadge = (status?: string, versao?: number) => {
    const v = versao && versao > 1 ? ` (v${versao})` : '';
    switch (status) {
      case 'aprovado':
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 shrink-0">
            <CheckCircle2 className="h-3 w-3" /> Aprovado{v}
          </Badge>
        );
      case 'ajuste_solicitado':
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1 shrink-0 font-semibold animate-pulse">
            <Clock className="h-3 w-3 text-amber-600" /> Ajuste Solicitado{v}
          </Badge>
        );
      case 'em_revisao':
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1 shrink-0 font-semibold">
            <Pencil className="h-3 w-3 text-blue-600" /> Em Revisão{v}
          </Badge>
        );
      case 'nova_proposta_enviada':
        return (
          <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 flex items-center gap-1 shrink-0 font-semibold">
            <Sparkles className="h-3 w-3 text-indigo-600" /> Nova Proposta Enviada{v}
          </Badge>
        );
      case 'recusado':
        return (
          <Badge variant="destructive" className="flex items-center gap-1 shrink-0">
            <X className="h-3 w-3" /> Recusado{v}
          </Badge>
        );
      case 'expirado':
        return (
          <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 flex items-center gap-1 shrink-0">
            <Clock className="h-3 w-3" /> Expirado{v}
          </Badge>
        );
      case 'enviado':
      case 'aguardando_aprovacao':
        return (
          <Badge variant="secondary" className="flex items-center gap-1 shrink-0 text-muted-foreground">
            <Clock className="h-3 w-3" /> Aguardando Aprovação{v}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="capitalize flex-shrink-0">
            {status || 'rascunho'}{v}
          </Badge>
        );
    }
  };

  const handleSalvarComoNovaProposta = async () => {
    if (!editingId) return;
    if (itens.length === 0) {
      toast.error('Adicione ao menos um procedimento');
      return;
    }
    try {
      setSalvandoNovaProposta(true);
      const formasParaSalvar =
        modoFormaPagamento === 'propostas' && condicoesNegociacao.length > 0
          ? serializarCondicoesPagamento(condicoesNegociacao, condicaoAtivaId)
          : formasPagamento;

      const res = await enviarNovaPropostaOrcamento({
        orcamentoId: editingId,
        novosItens: itens,
        novoDesconto: desconto,
        novasFormasPagamento: formasParaSalvar,
        usuarioNome: configuracoes?.dentistaResponsavel || 'Clínica',
        motivoAjuste: 'Nova versão revisada pela clínica',
      });

      if (res.ok) {
        toast.success(`Nova proposta (Versão ${res.novaVersao}) emitida com sucesso!`, {
          description: 'O paciente já pode acessar o link e aprovar as novas condições.',
        });
        setOpen(false);
        setEditingId(null);
        if (reload) reload();

        const tel = patient?.telefone?.trim() || patient?.whatsapp?.trim() || '';
        if (tel) {
          const primNome = patient?.nome ? patient.nome.split(' ')[0] : 'tudo bem';
          const msg = `Olá, ${primNome}! Atualizamos sua proposta de tratamento com novas condições. Você pode conferir os detalhes e aprovar online através deste link seguro: ${res.link}`;
          openWhatsApp(tel, msg);
        }
      } else {
        toast.error(res.error || 'Erro ao enviar nova proposta.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao enviar nova proposta');
    } finally {
      setSalvandoNovaProposta(false);
    }
  };


  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <ClipboardList className="h-5 w-5 text-primary" />
          Orçamentos e planos de tratamento
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setContratoOrcamento(null);
              setContratoModalOpen(true);
            }}
          >
            <FileSignature className="h-4 w-4 mr-1 text-primary" /> Contratos
          </Button>
          <Button size="sm" onClick={abrirNovo}>
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : orcamentos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum orçamento criado para este paciente.</p>
        ) : (
          (orcamentos || []).filter(Boolean).map((o) => {
            const contratosCandidatos = (documentos || []).filter(
              (d) => d.tipo === 'contrato' && (
                (o.contratoId && (d.id === o.contratoId || d.identificador === o.contratoId || (d.itens as any)?.contratoId === o.contratoId)) ||
                (d.itens as any)?.orcamentoId === o.id ||
                d.orcamentoId === o.id ||
                (d.pacienteId === o.pacienteId && (o.contratoId || o.status === 'aprovado'))
              )
            );

            // Ordena os contratos para priorizar a versão VIGENTE formalizada (com ambas assinaturas) e mais recente (V2 > V1)
            contratosCandidatos.sort((a, b) => {
              const aSnap = (a.itens || {}) as any;
              const bSnap = (b.itens || {}) as any;
              const aFormalizado = Boolean(a.assinadoEm || aSnap.assinaturaPaciente?.assinaturaData || aSnap.status === 'formalizado' || a.status === 'formalizado');
              const bFormalizado = Boolean(b.assinadoEm || bSnap.assinaturaPaciente?.assinaturaData || bSnap.status === 'formalizado' || b.status === 'formalizado');
              if (aFormalizado !== bFormalizado) return aFormalizado ? -1 : 1;

              const aVersao = Number(aSnap.versao || (a.titulo?.match(/v(\d+)/i) ? a.titulo.match(/v(\d+)/i)[1] : 1));
              const bVersao = Number(bSnap.versao || (b.titulo?.match(/v(\d+)/i) ? b.titulo.match(/v(\d+)/i)[1] : 1));
              if (aVersao !== bVersao) return bVersao - aVersao;

              const aTime = new Date(a.assinadoEm || a.atualizadoEm || a.criadoEm || 0).getTime();
              const bTime = new Date(b.assinadoEm || b.atualizadoEm || b.criadoEm || 0).getTime();
              return bTime - aTime;
            });

            const contObj = contratosCandidatos[0] || null;

            const temAssinaturaDra = Boolean(
              (o as any).assinaturaDraStatus === 'concluida' ||
              o.snapshotAprovacao?.assinaturaDraStatus === 'concluida' ||
              (o.assinaturaPaciente as any)?.assinaturaDraStatus === 'concluida' ||
              o.snapshotAprovacao?.assinaturaDentista ||
              (contObj?.itens as any)?.assinaturaDentista?.assinaturaData ||
              (contObj?.itens as any)?.statusAssinaturaDentista === 'assinado' ||
              contObj?.conteudo?.assinaturaDentista
            );

            const temAssinaturaPaciente = Boolean(
              (o as any).assinaturaPacienteStatus === 'concluida' ||
              (o.assinaturaPaciente as any)?.assinaturaPacienteStatus === 'concluida' ||
              o.snapshotAprovacao?.assinaturaPaciente ||
              contObj?.assinadoEm ||
              (contObj?.itens as any)?.assinaturaPaciente?.assinaturaData ||
              (contObj?.itens as any)?.statusAssinaturaPaciente === 'assinado' ||
              contObj?.conteudo?.assinaturaPaciente ||
              contObj?.status === 'assinado' ||
              contObj?.status === 'formalizado' ||
              (contObj?.itens as any)?.status === 'assinado' ||
              (contObj?.itens as any)?.status === 'formalizado'
            );

            const isContratoTotalmenteAssinado = Boolean(temAssinaturaDra && temAssinaturaPaciente);

            const temContratoEmitido = Boolean(o.contratoId || contObj);
            const idContratoExibicao = o.contratoId || contObj?.identificador || contObj?.id || 'Emitido';

            const tokenContrato = o.contratoToken || contObj?.tokenAssinatura || (contObj?.itens as any)?.token;
            const linkContratoPublico = temContratoEmitido && tokenContrato
              ? `https://app.lentesemresinamaceio.com.br/contrato/${idContratoExibicao}?token=${encodeURIComponent(tokenContrato)}`
              : null;

            const dataFormalizacao = (o as any).contratoFormalizadoEm ||
              (o.assinaturaPaciente as any)?.contratoFormalizadoEm ||
              (contObj?.itens as any)?.assinaturaPaciente?.dataHora ||
              contObj?.assinadoEm ||
              o.aprovadoEm;

            return (
              <div key={o.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{o.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {(o.itens || []).length} procedimento(s) • {formatMoney(o.total || 0)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {renderStatusBadge(o?.status, o?.versao)}
                    {isContratoTotalmenteAssinado && (
                      <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2 py-0.5 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Assinaturas realizadas
                      </Badge>
                    )}
                  </div>
                </div>

              {o.status === 'ajuste_solicitado' && (() => {
                const ultAjuste = Array.isArray(o.solicitacoesAjuste) && o.solicitacoesAjuste.length > 0
                  ? o.solicitacoesAjuste[o.solicitacoesAjuste.length - 1]
                  : null;

                return (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-950 dark:text-amber-200 space-y-2.5 my-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <AlertCircle className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                            Paciente solicitou ajuste no orçamento
                          </h4>
                          <span className="text-[10px] text-amber-800/80 dark:text-amber-300/80 block">
                            {ultAjuste?.solicitadaEm ? `Recebido em ${new Date(ultAjuste.solicitadaEm).toLocaleString('pt-BR')}` : 'Solicitação recente'} • Versão {ultAjuste?.versaoOrcamento || o.versao || 1}
                          </span>
                        </div>
                      </div>
                      <Badge className="bg-amber-600 text-white text-[9px] px-2 py-0.5 font-bold">
                        Ação Comercial Necessária
                      </Badge>
                    </div>

                    <div className="p-2.5 rounded-lg bg-background/90 border border-amber-500/20 text-xs space-y-1">
                      <div>
                        <span className="text-muted-foreground">Motivo selecionado:</span>{' '}
                        <strong className="text-foreground">{ultAjuste?.motivo || 'Ajuste solicitado pelo paciente'}</strong>
                      </div>
                      {ultAjuste?.mensagem && (
                        <div className="pt-1 border-t border-border/50">
                          <span className="text-muted-foreground">Mensagem:</span>{' '}
                          <span className="text-foreground italic">"{ultAjuste.mensagem}"</span>
                        </div>
                      )}
                    </div>

                    {/* 4 Botões Administrativos */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-amber-400 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950/40"
                        onClick={() => {
                          setOrcamentoVisualizandoAjuste(o);
                          setModalDetalhesAjusteOpen(true);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1 text-amber-600" /> Visualizar solicitação
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-amber-400 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950/40"
                        onClick={() => {
                          updateStatus(o.id, 'em_revisao');
                          abrirEdicao(o);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1 text-primary" /> Revisar orçamento
                      </Button>

                      <Button
                        size="sm"
                        className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1 shadow-xs"
                        onClick={() => {
                          setOrcamentoParaNovaProposta(o);
                          setModalEnviarNovaPropostaOpen(true);
                        }}
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Enviar nova proposta
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-emerald-400 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-semibold gap-1"
                        onClick={() => {
                          const tel = patient?.telefone || patient?.whatsapp || '';
                          const primNome = patient?.nome ? patient.nome.split(' ')[0] : 'Olá';
                          const ref = o.identificador || `ORC-${o.id.slice(0, 8).toUpperCase()}`;
                          const mot = ultAjuste?.motivo || 'sua proposta';
                          const msg = `Olá, ${primNome}! Recebemos seu pedido de ajuste sobre "${mot}" referente ao orçamento ${ref}. Nossa equipe está avaliando as melhores condições e em breve enviaremos a nova proposta!`;
                          openWhatsApp(tel, msg);
                        }}
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-emerald-600" /> Responder ao paciente
                      </Button>
                    </div>
                  </div>
                );
              })()}
              {o.parceiroNome && (
                <p className="text-xs text-muted-foreground">
                  Parceiro: <span className="text-foreground">{o.parceiroNome}</span>
                  {o.parceiroTipoRepasse === 'percentual'
                    ? ` — ${o.parceiroValorRepasse}%`
                    : o.parceiroValorRepasse
                      ? ` — ${formatMoney(o.parceiroValorRepasse)}`
                      : ''}
                </p>
              )}
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {(o.itens || []).map((i, idx) => (
                  <li key={idx}>
                    {i.nome} {i.quantidade > 1 ? `(${i.quantidade}x)` : ''} — {formatMoney(i.valor * i.quantidade)}
                  </li>
                ))}
              </ul>

              <div className="rounded-md bg-muted/40 p-2 space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatMoney((o.itens || []).reduce((s, i) => s + (i.valor || 0) * (i.quantidade || 1), 0))}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Desconto</span>
                  <span>- {formatMoney(o.desconto || 0)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-foreground border-t border-border pt-1">
                  <span>Total</span>
                  <span>{formatMoney(o.total || 0)}</span>
                </div>
                {o.formasPagamento && (() => {
                  const conds = parseCondicoesPagamento(o.formasPagamento, o.total);
                  const isAprovado = o.status === 'aprovado' || o.status === 'concluido';

                  // Orçamento Aprovado: exibe EXCLUSIVAMENTE a condição aprovada pelo paciente
                  if (isAprovado) {
                    const snapAprov = (o.snapshotAprovacao || (o as any).snapshot_aprovacao || {}) as any;
                    const snapAssinatura = (o.assinaturaPaciente || (o as any).assinatura_paciente || {}) as any;

                    // Busca condição aprovada persistida de forma confiável
                    let condEscolhida: CondicaoPagamento | null = null;
                    if (o.condicaoEscolhida && typeof o.condicaoEscolhida === 'object' && o.condicaoEscolhida.titulo) {
                      condEscolhida = o.condicaoEscolhida;
                    } else if (snapAprov?.condicaoEscolhida && typeof snapAprov.condicaoEscolhida === 'object' && snapAprov.condicaoEscolhida.titulo) {
                      condEscolhida = snapAprov.condicaoEscolhida;
                    } else if (snapAssinatura?.condicaoEscolhida && typeof snapAssinatura.condicaoEscolhida === 'object' && snapAssinatura.condicaoEscolhida.titulo) {
                      condEscolhida = snapAssinatura.condicaoEscolhida;
                    } else {
                      const encontrada = conds.find((c) => c.selecionada);
                      if (encontrada) {
                        condEscolhida = encontrada;
                      } else if (snapAprov?.condicaoEscolhidaId) {
                        const matchId = conds.find((c) => String(c.id) === String(snapAprov.condicaoEscolhidaId));
                        if (matchId) condEscolhida = matchId;
                      } else if (snapAssinatura?.condicaoEscolhidaId) {
                        const matchId = conds.find((c) => String(c.id) === String(snapAssinatura.condicaoEscolhidaId));
                        if (matchId) condEscolhida = matchId;
                      } else if (conds.length === 1 && !o.formasPagamento.includes('Opção 2') && !o.formasPagamento.includes('"id":"2"')) {
                        // Se o orçamento só possui uma única condição configurada desde a criação, ela é a acordada
                        condEscolhida = conds[0];
                      }
                    }

                    // Se não existir identificação confiável da condição aprovada, exibe mensagem clara sem escolher automaticamente a primeira
                    if (!condEscolhida) {
                      return (
                        <div className="pt-2 border-t border-border/60 space-y-1.5">
                          <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            Condição de Pagamento Aprovada:
                          </span>
                          <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 text-xs space-y-1">
                            <p className="font-semibold text-amber-700 dark:text-amber-400">Condição aprovada não identificada</p>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              O orçamento foi marcado como aprovado, mas a opção específica não foi registrada nos metadados deste documento histórico.
                            </p>
                            {o.formasPagamento && !o.formasPagamento.includes('{') && (
                              <p className="text-[11px] text-foreground font-medium pt-1">
                                Registro original: {o.formasPagamento}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // Detalhamento financeiro da condição contratada
                    const valFinal = typeof condEscolhida.valorTotal === 'number' && condEscolhida.valorTotal > 0
                      ? condEscolhida.valorTotal
                      : o.total;
                    const descVal = condEscolhida.descontoValor ?? (condEscolhida as any).valorDesconto ?? 0;
                    const descPct = condEscolhida.descontoPercentual ?? (condEscolhida as any).percentualDesconto ?? 0;
                    const temDesc = Boolean(descVal > 0 || descPct > 0);
                    const valOriginal = temDesc && descVal > 0 ? valFinal + descVal : (o.total > valFinal ? o.total : null);

                    return (
                      <div className="pt-2 border-t border-border/60 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            Condição de Pagamento Aprovada:
                          </span>
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] px-2 py-0.5 font-semibold flex items-center gap-1 shadow-xs">
                            <Check className="h-3 w-3 stroke-[3]" /> Opção Contratada pelo Paciente
                          </Badge>
                        </div>

                        {/* Card Responsivo da Condição Aprovada */}
                        <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/30 text-xs space-y-2.5">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 pb-2 border-b border-emerald-500/20">
                            <div className="flex items-center gap-2">
                              {condEscolhida.tipo === 'a_vista' && <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                              {condEscolhida.tipo === 'cartao' && <CreditCard className="h-4 w-4 text-primary shrink-0" />}
                              {condEscolhida.tipo === 'entrada_saldo' && <Layers className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />}
                              <span className="font-bold text-sm text-foreground">{condEscolhida.titulo}</span>
                            </div>

                            <span className="text-xs font-mono font-extrabold text-emerald-700 dark:text-emerald-300">
                              Valor Aprovado: {formatMoney(valFinal)}
                            </span>
                          </div>

                          {/* Detalhamento Financeiro (Original, Desconto, Entrada / Parcelas) */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                            {valOriginal && valOriginal > valFinal && (
                              <div className="p-2 rounded-lg bg-card/60 border border-border/60">
                                <span className="text-[10px] text-muted-foreground block">Valor Original</span>
                                <span className="line-through text-muted-foreground font-medium">{formatMoney(valOriginal)}</span>
                              </div>
                            )}

                            {temDesc && (
                              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-medium">Desconto Aplicado</span>
                                <span className="font-bold text-emerald-700 dark:text-emerald-300">
                                  {descVal > 0 ? `- ${formatMoney(descVal)}` : ''} {descPct ? `(${descPct}% OFF)` : ''}
                                </span>
                              </div>
                            )}

                            {condEscolhida.tipo === 'entrada_saldo' && (
                              <>
                                <div className="p-2 rounded-lg bg-card/60 border border-border/60">
                                  <span className="text-[10px] text-muted-foreground block">Entrada</span>
                                  <span className="font-semibold text-foreground">
                                    {formatMoney(condEscolhida.valorEntrada || valFinal * 0.5)}
                                  </span>
                                </div>
                                <div className="p-2 rounded-lg bg-card/60 border border-border/60">
                                  <span className="text-[10px] text-muted-foreground block">Saldo Restante</span>
                                  <span className="font-semibold text-foreground">
                                    {formatMoney(valFinal - (condEscolhida.valorEntrada || valFinal * 0.5))}
                                  </span>
                                </div>
                              </>
                            )}

                            {condEscolhida.tipo === 'cartao' && condEscolhida.parcelas && condEscolhida.parcelas > 1 && (
                              <div className="p-2 rounded-lg bg-card/60 border border-border/60 col-span-2 sm:col-span-1">
                                <span className="text-[10px] text-muted-foreground block">Parcelamento</span>
                                <span className="font-semibold text-foreground">
                                  {condEscolhida.parcelas}x de {formatMoney(condEscolhida.valorParcela || valFinal / condEscolhida.parcelas)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Descrição Completa Registrada */}
                          <p className="text-[11px] text-muted-foreground leading-relaxed pt-1.5 border-t border-emerald-500/15">
                            {condEscolhida.descricao}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  // Fluxo para orçamento NÃO aprovado (pendente, rascunho, enviado): exibe todas as opções
                  if (conds.length > 1) {
                    return (
                      <div className="pt-2 border-t border-border/60 space-y-1.5">
                        <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                          <Wallet className="h-3 w-3 text-primary" />
                          {conds.length} Condições de Pagamento Disponíveis:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {conds.map((c, i) => (
                            <div
                              key={c.id || i}
                              className="p-2.5 rounded-xl border border-border/70 bg-card/60 text-foreground text-[11px] space-y-1.5 flex flex-col justify-between transition-all"
                            >
                              <div className="space-y-1">
                                <div className="flex justify-between items-center gap-1">
                                  <span className="font-bold text-foreground truncate">{c.titulo}</span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                                  <span>Total: {formatMoney(c.valorTotal || o.total)}</span>
                                </div>
                                <p className="line-clamp-2 text-[10px] text-muted-foreground leading-tight">{c.descricao}</p>
                              </div>

                              {o.status !== 'recusado' && (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleIniciarAprovacao(o, c.id)}
                                  className="w-full h-6 text-[10px] font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs mt-1"
                                  title={`Aprovar este orçamento escolhendo a ${c.titulo}`}
                                >
                                  <Check className="h-3 w-3" /> Aprovar esta opção
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <p className="text-muted-foreground pt-1 text-xs">
                      Pagamento: <span className="text-foreground">{conds[0]?.descricao || o.formasPagamento}</span>
                    </p>
                  );
                })()}
              </div>

              {/* Painel Administrativo de Status Pós-Aprovação e Contrato */}
              {o.status === 'aprovado' && (
                <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2.5 my-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap pb-1.5 border-b border-emerald-500/20">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-bold text-xs text-emerald-950 dark:text-emerald-100">
                        Fluxo de Contrato & Assinatura Digital
                      </span>
                    </div>
                    <Badge className={`${isContratoTotalmenteAssinado ? 'bg-emerald-600' : 'bg-amber-600'} text-white text-[9px] px-2.5 py-0.5 font-bold flex items-center gap-1`}>
                      {isContratoTotalmenteAssinado ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" /> ASSINATURAS REALIZADAS
                        </>
                      ) : (
                        <>
                          <Clock className="h-3 w-3" /> Aguardando assinatura do paciente
                        </>
                      )}
                    </Badge>
                  </div>

                  {/* Os 4 Status Administrativos Exigidos */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {/* 1. Status do orçamento: Aprovado */}
                    <div className="p-2 rounded-lg bg-background/90 border border-emerald-500/30 space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Status do orçamento
                      </span>
                      <div className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        <span>Aprovado</span>
                      </div>
                    </div>

                    {/* 2. Status do contrato: Assinaturas realizadas / Emitido */}
                    <div className="p-2 rounded-lg bg-background/90 border border-emerald-500/30 space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Status do contrato
                      </span>
                      <div className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 truncate">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {isContratoTotalmenteAssinado ? 'Assinaturas realizadas' : (temContratoEmitido ? `Emitido (${idContratoExibicao})` : 'Pendente de emissão')}
                        </span>
                      </div>
                    </div>

                    {/* 3. Assinatura da profissional: Concluída (ou Pendente) */}
                    <div className="p-2 rounded-lg bg-background/90 border border-border space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Assinatura profissional
                      </span>
                      {temAssinaturaDra ? (
                        <div className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          <span>Concluída</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          <span>Pendente</span>
                        </div>
                      )}
                    </div>

                    {/* 4. Assinatura do paciente: Concluída (ou Pendente) */}
                    <div className="p-2 rounded-lg bg-background/90 border border-border space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Assinatura paciente
                      </span>
                      {temAssinaturaPaciente ? (
                        <div className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          <span>Concluída</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          <span>Pendente</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Data de Formalização */}
                  {isContratoTotalmenteAssinado && dataFormalizacao && (
                    <div className="text-[11px] text-emerald-800 dark:text-emerald-200 bg-emerald-100/60 dark:bg-emerald-950/40 px-2.5 py-1.5 rounded-lg flex items-center justify-between flex-wrap gap-1">
                      <span><strong>Data de formalização:</strong> {new Date(dataFormalizacao).toLocaleString('pt-BR')}</span>
                      <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80">Contrato formalizado e válido juridicamente</span>
                    </div>
                  )}

                  {/* Ações Rápidas do Contrato */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-emerald-500/20">
                    {linkContratoPublico && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-emerald-400 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100/50 gap-1"
                        onClick={() => {
                          navigator.clipboard.writeText(linkContratoPublico);
                          toast.success('Link do contrato copiado para a área de transferência!');
                        }}
                      >
                        <LinkIcon className="h-3.5 w-3.5" />
                        Copiar Link do Contrato
                      </Button>
                    )}

                    {linkContratoPublico && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-emerald-400 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100/50 gap-1"
                        onClick={() => {
                          window.open(linkContratoPublico, '_blank');
                        }}
                      >
                        <Eye className="h-3.5 w-3.5 text-primary" />
                        Abrir Contrato como Paciente
                      </Button>
                    )}

                    {!temAssinaturaDra && (
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1 shadow-xs"
                        onClick={() => {
                          setContratoOrcamento(o);
                          setContratoModalOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Assinar como Dra. Responsável
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs gap-1.5"
                  onClick={() => setApresentarOrcamento(o)}
                  title="Apresentar este plano de tratamento na frente do paciente no consultório"
                >
                  <Eye className="h-4 w-4" /> Apresentar ao Paciente
                </Button>
                <Button size="sm" variant="outline" onClick={() => abrirEdicao(o)}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar
                </Button>
                <Button size="sm" variant="outline" onClick={() => baixarPdf(o)}>
                  <FileText className="h-4 w-4 mr-1" /> PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => enviarWhatsApp(o)}
                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                  title="Enviar orçamento com condições e link de assinatura digital via WhatsApp"
                >
                  <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                  onClick={() => copiarLinkOrcamento(o)}
                  title="Copiar link seguro do orçamento para envio ao paciente"
                >
                  <LinkIcon className="h-4 w-4 mr-1" /> Link Orçamento
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => visualizarComoPaciente(o)}
                  title="Visualizar a página pública exatamente como o paciente vê"
                >
                  <Eye className="h-4 w-4 mr-1 text-primary" /> Como Paciente
                </Button>

                {/* Botão Dinâmico de Contrato conforme Estado Real */}
                {isContratoTotalmenteAssinado ? (
                  <>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs gap-1.5"
                      onClick={() => handleAbrirVisualizadorPdfAssinado(o, contObj, idContratoExibicao)}
                      title="Ver o PDF oficial bilateral definitivo arquivado no Storage com ambas as assinaturas"
                    >
                      <CheckCircle2 className="h-4 w-4 text-white" /> Ver Contrato Assinado
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-500/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 gap-1"
                      onClick={async () => {
                        const t = toast.loading('Localizando PDF assinado oficial...');
                        try {
                          const res = await obterPdfContratoOficial(o, contObj, idContratoExibicao);
                          if (res?.blob) {
                            const url = URL.createObjectURL(res.blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `Contrato_Assinado_${idContratoExibicao}.pdf`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                            toast.dismiss(t);
                            toast.success('PDF oficial assinado baixado com sucesso!');
                            return;
                          }

                          if (res?.signedUrl) {
                            window.open(res.signedUrl, '_blank');
                            toast.dismiss(t);
                            toast.success('PDF oficial assinado aberto para download!');
                            return;
                          }

                          // Se não foi localizado no Storage, nunca gera um documento sem assinaturas sob o nome 'PDF Assinado'
                          toast.dismiss(t);
                          toast.error('O PDF definitivo com as assinaturas arquivadas não foi localizado no Storage.', {
                            description: 'Abra o contrato formalizado pelo botão "Ver Contrato Assinado" para verificar o status.',
                          });
                        } catch (err) {
                          toast.dismiss(t);
                          toast.error('Erro ao baixar o PDF assinado oficial.');
                        }
                      }}
                      title="Baixar PDF oficial do contrato formalizado"
                    >
                      <Download className="h-4 w-4" /> Baixar PDF Assinado
                    </Button>
                  </>
                ) : temContratoEmitido ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30 gap-1.5"
                    onClick={() => {
                      setContratoOrcamento(o);
                      setContratoModalOpen(true);
                    }}
                    title={temAssinaturaDra ? "Ver contrato emitido com assinatura profissional - aguardando paciente" : "Ver contrato emitido - aguardando assinatura da profissional"}
                  >
                    <Clock className="h-4 w-4 text-amber-600" />
                    {temAssinaturaDra ? "Ver Contrato — Aguardando Paciente" : "Ver Contrato — Aguardando Profissional"}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant={o?.status === 'aprovado' ? 'default' : 'outline'}
                    className={o?.status === 'aprovado' ? 'bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5' : 'gap-1.5'}
                    onClick={() => {
                      setContratoOrcamento(o);
                      setContratoModalOpen(true);
                    }}
                    title="Gerar contrato formal com base neste orçamento"
                  >
                    <FileSignature className="h-4 w-4" /> Gerar Contrato
                  </Button>
                )}

                {o?.status === 'aprovado' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    onClick={() => handleIniciarAprovacao(o)}
                    title="Sincronizar ou relançar parcelas no Contas a Receber"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" /> Financeiro
                  </Button>
                )}

                {o?.status !== 'aprovado' && o?.status !== 'recusado' && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => handleIniciarAprovacao(o)}>
                      <Check className="h-4 w-4 mr-1 text-emerald-600" /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateStatus(o.id, 'recusado')}>
                      <X className="h-4 w-4 mr-1" /> Recusar
                    </Button>
                  </>
                )}
                <Button size="sm" variant="ghost" onClick={() => deleteOrcamento(o.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-full">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar orçamento' : 'Novo orçamento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Adicionar procedimento</Label>
                <span className="text-[11px] text-muted-foreground font-normal">
                  {procedimentosAtivos.length} pré-cadastrado{procedimentosAtivos.length === 1 ? '' : 's'}
                </span>
              </div>

            {/* Combobox Pesquisável com Busca em Tempo Real e Rolagem Nativa (sem conflito com Dialog) */}
            <div className="space-y-1.5 relative" ref={comboboxProcedimentoRef}>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Adicionar procedimento</Label>
                <span className="text-[11px] text-muted-foreground font-normal">
                  {procedimentosAtivos.length} pré-cadastrado{procedimentosAtivos.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  ref={inputBuscaProcedimentoRef}
                  placeholder="Digite o nome do procedimento (ex: canal, resina, limpeza)..."
                  value={buscaProcedimento}
                  onChange={(e) => {
                    setBuscaProcedimento(e.target.value);
                    setOpenBuscaProcedimento(true);
                    setSelectedProcedimentoIndex(0);
                  }}
                  onFocus={() => {
                    setOpenBuscaProcedimento(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setOpenBuscaProcedimento(true);
                      setSelectedProcedimentoIndex((prev) =>
                        Math.min(prev + 1, Math.max(0, procedimentosFiltrados.length - 1))
                      );
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedProcedimentoIndex((prev) => Math.max(0, prev - 1));
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (procedimentosFiltrados.length > 0) {
                        const idx = Math.min(
                          selectedProcedimentoIndex,
                          procedimentosFiltrados.length - 1
                        );
                        const p = procedimentosFiltrados[idx] || procedimentosFiltrados[0];
                        if (p) {
                          addProcedimento(p.id);
                          setBuscaProcedimento('');
                          setOpenBuscaProcedimento(false);
                          toast.success(`Procedimento "${p.nome}" adicionado!`);
                        }
                      } else if (buscaProcedimento.trim()) {
                        setItens((prev) => [
                          ...prev,
                          { nome: buscaProcedimento.trim(), quantidade: 1, valor: 0 },
                        ]);
                        const nomeAdicionado = buscaProcedimento.trim();
                        setBuscaProcedimento('');
                        setOpenBuscaProcedimento(false);
                        toast.success(`"${nomeAdicionado}" adicionado como item manual!`);
                      }
                    } else if (e.key === 'Escape') {
                      setOpenBuscaProcedimento(false);
                    }
                  }}
                  className="pl-9 pr-16 h-10 text-sm bg-background border-input focus-visible:ring-1 focus-visible:ring-primary"
                />

                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                  {buscaProcedimento && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setBuscaProcedimento('');
                        setSelectedProcedimentoIndex(0);
                        inputBuscaProcedimentoRef.current?.focus();
                      }}
                      title="Limpar busca"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setOpenBuscaProcedimento((prev) => !prev);
                      inputBuscaProcedimentoRef.current?.focus();
                    }}
                    title={openBuscaProcedimento ? 'Fechar lista' : 'Abrir lista'}
                  >
                    <ChevronsUpDown className="h-4 w-4 opacity-70" />
                  </Button>
                </div>
              </div>

              {/* Dropdown renderizado DIRETAMENTE dentro do Dialog (sem Portal, sem foco travado, com scroll fluido nativo) */}
              {openBuscaProcedimento && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-popover rounded-lg border border-border shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95">
                  <div className="px-3 py-1.5 border-b border-border bg-muted/40 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {procedimentosFiltrados.length === 1
                        ? '1 procedimento encontrado'
                        : `${procedimentosFiltrados.length} procedimentos encontrados`}
                    </span>
                    <span className="text-[10px] text-primary hidden sm:inline">
                      ↑↓ navega • Enter seleciona • Esc fecha
                    </span>
                  </div>

                  <div
                    className="max-h-60 sm:max-h-72 overflow-y-auto divide-y divide-border/40 overscroll-contain"
                    tabIndex={-1}
                  >
                    {procedimentosFiltrados.length === 0 ? (
                      <div className="p-4 text-center space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Nenhum procedimento encontrado para{' '}
                          <strong className="text-foreground">"{buscaProcedimento}"</strong>.
                        </p>
                        {buscaProcedimento.trim() && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-xs gap-1.5 border-dashed"
                            onClick={() => {
                              setItens((prev) => [
                                ...prev,
                                { nome: buscaProcedimento.trim(), quantidade: 1, valor: 0 },
                              ]);
                              const nome = buscaProcedimento.trim();
                              setBuscaProcedimento('');
                              setOpenBuscaProcedimento(false);
                              toast.success(`"${nome}" adicionado como item manual!`);
                            }}
                          >
                            <Plus className="h-3.5 w-3.5" /> Adicionar "{buscaProcedimento.trim()}" como item manual
                          </Button>
                        )}
                      </div>
                    ) : (
                      procedimentosFiltrados.map((p, index) => {
                        const isSelected = index === selectedProcedimentoIndex;
                        return (
                          <button
                            key={p.id}
                            ref={(el) => {
                              itemRefs.current[index] = el;
                            }}
                            type="button"
                            onMouseEnter={() => setSelectedProcedimentoIndex(index)}
                            onClick={() => {
                              addProcedimento(p.id);
                              setBuscaProcedimento('');
                              setOpenBuscaProcedimento(false);
                              toast.success(`Procedimento "${p.nome}" adicionado!`);
                            }}
                            className={`w-full text-left px-3.5 py-2.5 transition-colors flex items-center justify-between gap-3 group focus:outline-none ${
                              isSelected
                                ? 'bg-accent/90 text-accent-foreground'
                                : 'hover:bg-accent/60'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div
                                className={`text-xs sm:text-sm font-medium truncate ${
                                  isSelected ? 'text-primary' : 'text-foreground'
                                }`}
                              >
                                {p.nome}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {p.categoria && (
                                  <span className="text-[10px] text-muted-foreground capitalize bg-muted/80 px-1.5 py-0.2 rounded border border-border/50">
                                    {p.categoria}
                                  </span>
                                )}
                                {p.duracaoMinutos && (
                                  <span className="text-[10px] text-muted-foreground">
                                    ⏱ {p.duracaoMinutos} min
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                {formatMoney(p.preco)}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

              <Button type="button" variant="outline" size="sm" className="w-full" onClick={addItemManual}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar item manual
              </Button>
            </div>

            <div className="space-y-2">
              {itens.map((i, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={i.nome}
                    onChange={(e) =>
                      setItens((prev) => prev.map((x, k) => (k === idx ? { ...x, nome: e.target.value } : x)))
                    }
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min={1}
                    value={i.quantidade}
                    onChange={(e) =>
                      setItens((prev) =>
                        prev.map((x, k) => (k === idx ? { ...x, quantidade: Number(e.target.value) || 1 } : x))
                      )
                    }
                    className="w-16"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={i.valor}
                    onChange={(e) =>
                      setItens((prev) =>
                        prev.map((x, k) => (k === idx ? { ...x, valor: Number(e.target.value) || 0 } : x))
                      )
                    }
                    className="w-28"
                  />
                  <Button variant="ghost" size="icon" onClick={() => setItens((prev) => prev.filter((_, k) => k !== idx))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Bloco de Valores: Subtotal, Desconto e Total Final com Ajuste Automático */}
            <div className="bg-muted/30 p-3 sm:p-4 rounded-xl border border-border space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Subtotal dos itens:
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    {formatMoney(subtotal)}
                  </span>
                </div>

                {/* Seletor de Modo: Por Desconto vs Por Valor Final */}
                <div className="flex items-center bg-background border border-border p-0.5 rounded-lg text-xs shadow-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setModoCalculoValor('desconto');
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      modoCalculoValor === 'desconto'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    🏷️ Por Desconto
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModoCalculoValor('valor_final');
                      if (!inputValorFinal || Number(inputValorFinal) === 0) {
                        setInputValorFinal(total > 0 ? String(total) : String(subtotal));
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      modoCalculoValor === 'valor_final'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    💰 Ajustar Valor Final
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                {/* Campo de Desconto */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs flex items-center gap-1.5">
                      <span>Desconto (R$)</span>
                      {desconto > 0 && subtotal > 0 && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800">
                          - {((desconto / subtotal) * 100).toFixed(1)}%
                        </span>
                      )}
                    </Label>
                    {desconto > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setDesconto(0);
                          setInputValorFinal(String(subtotal));
                          toast.info('Desconto zerado!');
                        }}
                        className="text-[10px] text-muted-foreground hover:text-destructive underline"
                      >
                        Zerar desconto
                      </button>
                    )}
                  </div>
                  {modoCalculoValor === 'desconto' ? (
                    <Input
                      type="number"
                      min={0}
                      max={subtotal}
                      step="0.01"
                      value={desconto || ''}
                      placeholder="0,00"
                      onChange={(e) => handleDescontoChange(e.target.value)}
                      className="h-10 text-sm font-medium focus-visible:ring-primary"
                    />
                  ) : (
                    <div className="relative">
                      <Input
                        value={desconto > 0 ? formatMoney(desconto) : 'R$ 0,00 (sem desconto)'}
                        readOnly
                        className="h-10 text-sm font-medium bg-muted/40 cursor-pointer text-muted-foreground pr-24"
                        onClick={() => setModoCalculoValor('desconto')}
                        title="Calculado automaticamente a partir do Valor Final. Clique para editar o desconto diretamente."
                      />
                      <span className="absolute right-2.5 top-2.5 text-[10px] text-muted-foreground font-medium">
                        (Automático)
                      </span>
                    </div>
                  )}
                </div>

                {/* Campo de Total / Valor Final */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <span>Valor Final (Total)</span>
                      {modoCalculoValor === 'valor_final' && (
                        <span className="text-[10px] text-primary font-medium animate-pulse">
                          (editando final)
                        </span>
                      )}
                    </Label>
                    {modoCalculoValor === 'desconto' && (
                      <button
                        type="button"
                        onClick={() => {
                          setModoCalculoValor('valor_final');
                          setInputValorFinal(total > 0 ? String(total) : String(subtotal));
                        }}
                        className="text-[11px] text-primary hover:underline font-medium flex items-center gap-0.5"
                      >
                        <Pencil className="h-3 w-3" /> Ajustar final
                      </button>
                    )}
                  </div>

                  {modoCalculoValor === 'valor_final' ? (
                    <div className="space-y-1">
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder={subtotal > 0 ? String(subtotal) : '0,00'}
                          value={inputValorFinal}
                          onChange={(e) => handleValorFinalChange(e.target.value)}
                          autoFocus
                          className="h-10 text-sm font-bold text-foreground border-primary/50 focus-visible:ring-primary pr-24"
                        />
                        <span className="absolute right-2.5 top-2.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          = {formatMoney(Number(inputValorFinal) || total)}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        💡 Digite o valor final negociado. O desconto é calculado automaticamente.
                      </p>
                    </div>
                  ) : (
                    <div className="relative">
                      <Input
                        value={formatMoney(total)}
                        readOnly
                        onClick={() => {
                          setModoCalculoValor('valor_final');
                          setInputValorFinal(total > 0 ? String(total) : String(subtotal));
                        }}
                        className="h-10 text-sm font-bold text-foreground bg-background cursor-pointer hover:border-primary/50 transition-colors pr-20"
                        title="Clique para ajustar o valor final e calcular o desconto automaticamente"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setModoCalculoValor('valor_final');
                          setInputValorFinal(total > 0 ? String(total) : String(subtotal));
                        }}
                        className="absolute right-1 top-1 h-8 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="text-[11px] font-medium">Ajustar</span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Atalhos rápidos de negociação (descontos e arredondamentos) */}
              {subtotal > 0 && (
                <div className="pt-2 border-t border-border/40 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mr-1 flex items-center gap-1">
                    <Calculator className="h-3 w-3 text-primary" />
                    Atalhos rápidos:
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2 rounded-full border-border hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300"
                    onClick={() => aplicarDescontoPercentual(5)}
                  >
                    -5% ({formatMoney(subtotal * 0.95)})
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2 rounded-full border-border hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300"
                    onClick={() => aplicarDescontoPercentual(10)}
                  >
                    -10% ({formatMoney(subtotal * 0.9)})
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2 rounded-full border-border hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300"
                    onClick={() => aplicarDescontoPercentual(15)}
                  >
                    -15% ({formatMoney(subtotal * 0.85)})
                  </Button>
                  {subtotal >= 200 && subtotal % 100 !== 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2 rounded-full border-border hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700 dark:hover:text-blue-300"
                      onClick={() => arredondarValorFinalPara(100)}
                    >
                      Arredondar p/ {formatMoney(Math.floor(subtotal / 100) * 100)}
                    </Button>
                  )}
                  {subtotal >= 1000 && subtotal % 500 !== 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2 rounded-full border-border hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700 dark:hover:text-blue-300"
                      onClick={() => arredondarValorFinalPara(500)}
                    >
                      Arredondar p/ {formatMoney(Math.floor(subtotal / 500) * 500)}
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
                <div>
                  <Label className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                    <Wallet className="h-4 w-4 text-primary" />
                    Condições de Pagamento & Negociação
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Apresente múltiplas opções (ex: À vista com desconto, Entrada + Saldo, ou Parcelado no Cartão).
                  </p>
                </div>

                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <Button
                    type="button"
                    size="sm"
                    variant={modoFormaPagamento === 'propostas' ? 'default' : 'outline'}
                    className={`h-7 text-xs font-semibold ${
                      modoFormaPagamento === 'propostas'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => {
                      setModoFormaPagamento('propostas');
                      if (condicoesNegociacao.length === 0) {
                        const trio = gerarTrioPropostasSugeridas(total);
                        setCondicoesNegociacao(trio);
                        setCondicaoAtivaId('');
                      }
                    }}
                  >
                    <Layers className="h-3.5 w-3.5 mr-1" />
                    Múltiplas Opções ({condicoesNegociacao.length})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={modoFormaPagamento === 'livre' ? 'default' : 'outline'}
                    className={`h-7 text-xs font-semibold ${
                      modoFormaPagamento === 'livre'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setModoFormaPagamento('livre')}
                  >
                    Texto Livre / Clássico
                  </Button>
                </div>
              </div>

              {modoFormaPagamento === 'propostas' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      Defina as propostas comerciais para o paciente escolher na consulta:
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleGerarTrioSugeridoOrcamento}
                        className="h-7 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10 font-semibold"
                        title="Gera 3 opções: À Vista com 10% OFF, Entrada Facilitada + 5x, e 10x sem juros"
                      >
                        <Sparkles className="h-3 w-3" />
                        Sugerir 3 Opções Rápidas
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAbrirNovaCondicaoOrcamento}
                        className="h-7 text-xs gap-1 font-bold"
                      >
                        <Plus className="h-3 w-3" />
                        Nova Condição
                      </Button>
                    </div>
                  </div>

                  {condicoesNegociacao.length === 0 ? (
                    <div className="p-6 text-center rounded-xl border border-dashed border-border bg-muted/20 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Nenhuma proposta cadastrada ainda para este orçamento.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleGerarTrioSugeridoOrcamento}
                        className="text-xs gap-1"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Gerar 3 Opções Sugeridas Automaticamente
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {condicoesNegociacao.map((c, idx) => {
                        const isAtiva = c.id === condicaoAtivaId;
                        return (
                          <div
                            key={c.id || idx}
                            className={`p-3 rounded-xl border text-xs flex flex-col justify-between gap-2 transition-all ${
                              isAtiva
                                ? 'border-emerald-500/80 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500/30'
                                : 'border-border/80 bg-background/80 hover:border-primary/40'
                            }`}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      isAtiva ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'
                                    }`}
                                  >
                                    Opção {idx + 1}
                                  </span>
                                  {c.destaque && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                      ★ Recomendada
                                    </span>
                                  )}
                                  {isAtiva && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                      ✓ Padrão
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleAbrirEditarCondicaoOrcamento(c)}
                                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                                    title="Editar esta condição"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  {condicoesNegociacao.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoverCondicaoOrcamento(c.id)}
                                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                      title="Remover esta condição"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              <h5 className="font-bold text-foreground text-xs leading-snug">
                                {c.titulo}
                              </h5>

                              {/* Destaque Visual e Nítido do Valor Total da Forma */}
                              {(() => {
                                const vTotalCond = typeof c.valorTotal === 'number' && c.valorTotal > 0 ? c.valorTotal : total;
                                const diferenca = total - vTotalCond;
                                const temDesconto = diferenca > 0.01;
                                const percDesc = temDesconto ? Math.round((diferenca / total) * 100) : 0;
                                const ent = c.valorEntrada || 0;
                                const saldo = Math.max(0, vTotalCond - ent);

                                return (
                                  <div className="p-2.5 rounded-xl bg-card/90 border border-border/80 space-y-1.5 shadow-xs">
                                    <div className="flex items-center justify-between gap-1 flex-wrap">
                                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
                                        <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                                        Valor Total da Forma:
                                      </span>
                                      {temDesconto && (
                                        <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                                          {percDesc}% OFF
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-baseline justify-between gap-2">
                                      <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                                        {formatMoney(vTotalCond)}
                                      </span>
                                      {temDesconto && (
                                        <span className="text-xs text-muted-foreground line-through font-medium">
                                          {formatMoney(total)}
                                        </span>
                                      )}
                                    </div>

                                    {/* Resumo visual da forma de pagamento */}
                                    <div className="text-[11px] font-semibold text-foreground/90 pt-1 border-t border-border/40">
                                      {c.tipo === 'cartao' && (
                                        <span>
                                          💳 {c.parcelas || 1}x de {formatMoney(vTotalCond / (c.parcelas || 1))} sem juros
                                        </span>
                                      )}
                                      {c.tipo === 'entrada_saldo' && (
                                        <span>
                                          ⚡ Entrada: {formatMoney(ent)} + Saldo: {formatMoney(saldo)}
                                          {c.saldoTipoPrazo === 'parcelas' && c.saldoParcelas && c.saldoParcelas > 1
                                            ? ` (${c.saldoParcelas}x de ${formatMoney(saldo / c.saldoParcelas)})`
                                            : c.saldoTipoPrazo === 'dias' || (!c.saldoTipoPrazo && c.saldoPrazoDias)
                                            ? ` (em ${c.saldoPrazoDias || 30} dias)`
                                            : ''}
                                        </span>
                                      )}
                                      {c.tipo === 'pix_parcelado' && (
                                        <span>
                                          💠 {c.parcelas || 3}x de {formatMoney(saldo / (c.parcelas || 3))} no PIX
                                        </span>
                                      )}
                                      {c.tipo === 'a_vista' && (
                                        <span className="text-emerald-600 dark:text-emerald-400">
                                          {temDesconto ? `✓ Economia de ${formatMoney(diferenca)} à vista` : '✓ Pagamento integral à vista'}
                                        </span>
                                      )}
                                      {c.tipo === 'boleto' && (
                                        <span>
                                          📄 {c.parcelas || 1}x de {formatMoney(vTotalCond / (c.parcelas || 1))} no boleto
                                        </span>
                                      )}
                                      {c.tipo === 'personalizado' && (
                                        <span>
                                          🤝 Condição combinada personalizada
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}

                              <p className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">
                                {c.descricao}
                              </p>

                              {/* Visão Interna Confidencial do Líquido do Cartão para a Clínica */}
                              <BadgeLiquidoInternoCartao condicao={c} totalBase={total} />
                            </div>

                            <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                              <Button
                                type="button"
                                size="sm"
                                variant={isAtiva ? 'default' : 'outline'}
                                className={`h-6 text-[11px] w-full ${
                                  isAtiva
                                    ? 'bg-emerald-600 text-white font-semibold'
                                    : 'border-border text-muted-foreground hover:text-foreground'
                                }`}
                                onClick={() => setCondicaoAtivaId(isAtiva ? '' : c.id)}
                              >
                                {isAtiva ? '✓ Opção Padrão / Escolhida' : 'Definir como Padrão'}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 text-[11px] text-muted-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary shrink-0" />
                    <span>
                      Todas essas opções aparecerão na tela interativa de <strong>Apresentar Orçamento</strong>, no PDF gerado e na mensagem do WhatsApp.
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Assistentes rápidos:</Label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button
                        type="button"
                        size="sm"
                        variant={entradaAssistenteAtivo ? 'default' : 'outline'}
                        className={`h-7 text-xs gap-1.5 ${
                          entradaAssistenteAtivo
                            ? 'bg-purple-600 text-white font-semibold shadow-xs'
                            : 'border-purple-500/40 text-purple-600 dark:text-purple-400'
                        }`}
                        onClick={handleToggleEntradaAssistente}
                      >
                        <Wallet className="h-3.5 w-3.5" />
                        Entrada + Saldo
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={cartaoAssistenteAtivo ? 'default' : 'outline'}
                        className={`h-7 text-xs gap-1.5 ${
                          cartaoAssistenteAtivo
                            ? 'bg-blue-600 text-white font-semibold shadow-xs'
                            : 'border-blue-500/40 text-blue-600 dark:text-blue-400'
                        }`}
                        onClick={() => {
                          const novo = !cartaoAssistenteAtivo;
                          setCartaoAssistenteAtivo(novo);
                          if (novo) {
                            setPixParceladoAtivo(false);
                            setMultiplasFormasAtivo(false);
                            setEntradaAssistenteAtivo(false);
                          }
                        }}
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        Máquina de Cartão
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={multiplasFormasAtivo ? 'default' : 'outline'}
                        className={`h-7 text-xs gap-1.5 ${
                          multiplasFormasAtivo
                            ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                            : 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                        }`}
                        onClick={handleToggleMultiplasFormas}
                      >
                        <Layers className="h-3.5 w-3.5" />
                        Múltiplas Formas
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {['À vista (PIX)', 'Entrada + Saldo', 'PIX Parcelado', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', '2x sem juros', '3x sem juros', '6x', '12x', 'Boleto'].map((f) => {
                      const isPixParcelado = f === 'PIX Parcelado';
                      const isEntradaSaldo = f === 'Entrada + Saldo';
                      const isActive = (isPixParcelado && pixParceladoAtivo) || (isEntradaSaldo && entradaAssistenteAtivo);
                      return (
                        <Button
                          key={f}
                          type="button"
                          size="sm"
                          variant={isActive ? 'default' : 'outline'}
                          className={`h-7 text-xs ${isActive ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : ''}`}
                          onClick={() => {
                            if (isEntradaSaldo) {
                              handleToggleEntradaAssistente();
                            } else if (isPixParcelado) {
                              handleTogglePixParcelado();
                            } else if (f === 'Cartão de crédito') {
                              setCartaoTipo('credito');
                              setCartaoAssistenteAtivo(true);
                              setPixParceladoAtivo(false);
                              setMultiplasFormasAtivo(false);
                              setEntradaAssistenteAtivo(false);
                            } else if (f === 'Cartão de débito') {
                              setCartaoTipo('debito');
                              setCartaoParcelas(1);
                              setCartaoAssistenteAtivo(true);
                              setPixParceladoAtivo(false);
                              setMultiplasFormasAtivo(false);
                              setEntradaAssistenteAtivo(false);
                            } else {
                              setFormasPagamento((prev) => (prev ? (prev.includes(f) ? prev : `${prev}, ${f}`) : f));
                            }
                          }}
                        >
                          {f}
                        </Button>
                      );
                    })}
                  </div>

              {/* Assistente de Entrada + Saldo */}
              {entradaAssistenteAtivo && (
                <div className="rounded-lg border border-purple-500/40 bg-purple-950/20 p-3.5 space-y-3.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-400">
                      <Wallet className="h-4 w-4" />
                      Definir Entrada e Pagamento do Saldo
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setEntradaAssistenteAtivo(false)}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Fechar
                    </Button>
                  </div>

                  {/* Passo 1: Configurar a Entrada */}
                  <div className="space-y-2.5 p-3 rounded-lg bg-background/90 border border-purple-500/30">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold text-[10px]">
                          1º Passo
                        </span>
                        Valor e Condições da Entrada
                      </Label>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground mr-1">Atalhos:</span>
                        {[
                          { label: '10%', val: Math.round(total * 0.1) },
                          { label: '20%', val: Math.round(total * 0.2) },
                          { label: '30%', val: Math.round(total * 0.3) },
                          { label: '50%', val: Math.round(total * 0.5) },
                        ].map((perc) => (
                          <Button
                            key={perc.label}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-5 px-1.5 text-[10px] border-purple-500/40 hover:bg-purple-500/10 font-medium"
                            onClick={() => setValorEntrada(perc.val)}
                          >
                            {perc.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Valor Entrada (R$)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={total}
                          step="0.01"
                          placeholder="0,00"
                          value={valorEntrada || ''}
                          onChange={(e) => setValorEntrada(Math.min(total, Math.max(0, Number(e.target.value) || 0)))}
                          className="h-8 text-xs font-bold text-foreground"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Método da Entrada</Label>
                        <Select
                          value={metodoEntrada}
                          onValueChange={(v: any) => setMetodoEntrada(v)}
                        >
                          <SelectTrigger className="h-8 text-xs font-medium">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pix">PIX</SelectItem>
                            <SelectItem value="dinheiro">Dinheiro</SelectItem>
                            <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                            <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                            <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="h-3 w-3 text-purple-400" /> Data Entrada
                        </Label>
                        <Input
                          type="date"
                          value={dataEntrada}
                          onChange={(e) => setDataEntrada(e.target.value)}
                          className="h-8 text-xs font-semibold bg-background"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Situação</Label>
                        <Select
                          value={situacaoEntrada}
                          onValueChange={(v: any) => setSituacaoEntrada(v)}
                        >
                          <SelectTrigger className="h-8 text-xs font-semibold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Quitada">
                              <span className="text-emerald-500 font-medium">● Quitada (Já paga)</span>
                            </SelectItem>
                            <SelectItem value="A vencer">
                              <span className="text-amber-500 font-medium">● A vencer (A pagar)</span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Resumo Visual em Cards: Total, Entrada, Saldo */}
                    {(() => {
                      const saldo = Math.max(0, total - valorEntrada);
                      return (
                        <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                          <div className="p-2 rounded bg-muted/40 border border-border/50">
                            <span className="text-[10px] text-muted-foreground block">Total Orçamento:</span>
                            <span className="font-semibold text-foreground text-xs">{formatMoney(total)}</span>
                          </div>
                          <div className="p-2 rounded bg-purple-500/10 border border-purple-500/30">
                            <span className="text-[10px] text-purple-400 block font-medium">(-) Entrada Definida:</span>
                            <span className="font-bold text-purple-400 text-xs">{formatMoney(valorEntrada)}</span>
                          </div>
                          <div className={`p-2 rounded ${saldo > 0 ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-emerald-500/10 border border-emerald-500/30'}`}>
                            <span className={`text-[10px] block font-medium ${saldo > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                              (=) Saldo Restante:
                            </span>
                            <span className={`font-bold text-xs ${saldo > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {formatMoney(saldo)}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Opção Rápida: Salvar Apenas Entrada */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1.5 border-t border-border/50">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-purple-400 shrink-0" />
                        Quer registrar só a entrada agora e combinar o restante depois?
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => aplicarEntradaApenas()}
                        disabled={valorEntrada <= 0}
                        className="h-7 text-xs border-purple-500/50 text-purple-400 hover:bg-purple-950/40 shrink-0 font-semibold"
                      >
                        <Check className="h-3 w-3 mr-1" /> Registrar apenas a Entrada (Saldo a combinar)
                      </Button>
                    </div>
                  </div>

                  {/* Passo 2: Preencher Opções de Pagamento do Saldo */}
                  {total - valorEntrada > 0 && (
                    <div className="space-y-3 p-3 rounded-lg bg-background/90 border border-border">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-400 font-bold text-[10px]">
                            2º Passo
                          </span>
                          Preencher Forma de Pagamento do Saldo ({formatMoney(total - valorEntrada)})
                        </Label>
                        <span className="text-[10px] text-muted-foreground">
                          Selecione como o saldo restante será pago
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                        {[
                          { id: 'combinar', label: 'A combinar' },
                          { id: 'cartao', label: 'Cartão de Crédito' },
                          { id: 'pix_parcelado', label: 'PIX Parcelado' },
                          { id: 'boleto', label: 'Boleto' },
                          { id: 'conclusao', label: 'Na Conclusão' },
                        ].map((opc) => (
                          <Button
                            key={opc.id}
                            type="button"
                            variant={modalidadeSaldo === opc.id ? 'default' : 'outline'}
                            size="sm"
                            className={`h-7 text-xs font-medium ${
                              modalidadeSaldo === opc.id
                                ? 'bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs'
                                : 'border-border text-muted-foreground hover:text-foreground'
                            }`}
                            onClick={() => setModalidadeSaldo(opc.id as any)}
                          >
                            {opc.label}
                          </Button>
                        ))}
                      </div>

                      {/* Conteúdo de acordo com modalidade do saldo */}
                      {modalidadeSaldo === 'combinar' && (
                        <div className="p-2.5 rounded bg-muted/30 border border-border/50 text-xs text-muted-foreground space-y-1">
                          <p className="font-semibold text-foreground">
                            Saldo Restante de {formatMoney(total - valorEntrada)} a combinar
                          </p>
                          <p className="text-[11px]">
                            O saldo restante ficará em aberto como conta a receber pendente, podendo ser quitado ou parcelado posteriormente de acordo com as consultas do paciente.
                          </p>
                        </div>
                      )}

                      {modalidadeSaldo === 'cartao' && (() => {
                        const saldo = Math.max(0, total - valorEntrada);
                        const op = operadoras.find((o) => o.id === saldoCartaoOperadoraId) || operadoraPadrao;
                        const calc = calcularTaxaCartao(op, saldoCartaoParcelas, saldo, false);
                        return (
                          <div className="space-y-2.5 p-2.5 rounded bg-blue-950/20 border border-blue-500/30">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Operadora da Máquina</Label>
                                <Select
                                  value={saldoCartaoOperadoraId}
                                  onValueChange={setSaldoCartaoOperadoraId}
                                >
                                  <SelectTrigger className="h-8 text-xs font-bold bg-background">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {operadoras.filter((o) => o.ativa !== false).map((operadora) => (
                                      <SelectItem key={operadora.id} value={operadora.id}>
                                        <div className="flex items-center gap-1.5">
                                          <span
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: operadora.cor || '#3b82f6' }}
                                          />
                                          <span className="font-semibold">{operadora.nome}</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Parcelas do Saldo no Cartão</Label>
                                <Select
                                  value={String(saldoCartaoParcelas)}
                                  onValueChange={(v) => setSaldoCartaoParcelas(Number(v) || 1)}
                                >
                                  <SelectTrigger className="h-8 text-xs font-semibold bg-background">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18].map((n) => (
                                      <SelectItem key={n} value={String(n)}>
                                        {n === 1 ? '1x à vista no crédito' : `${n}x de ${formatMoney(saldo / n)}`}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-background/90 border border-blue-500/20 text-xs">
                              <span className="text-foreground font-medium">
                                Plano do Saldo: <strong>{saldoCartaoParcelas}x de {formatMoney(saldo / saldoCartaoParcelas)}</strong> ({op?.nome || 'Cartão'})
                              </span>
                              <div className="flex items-center gap-3">
                                <span className="text-destructive font-semibold text-[11px]">
                                  Taxa ({calc.taxaPercentual}%): -{formatMoney(calc.taxaValor)}
                                </span>
                                <span className="text-emerald-500 font-bold text-xs">
                                  Líquido Saldo: {formatMoney(calc.valorLiquido)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {modalidadeSaldo === 'pix_parcelado' && (() => {
                        const saldo = Math.max(0, total - valorEntrada);
                        return (
                          <div className="space-y-2 p-2.5 rounded bg-emerald-950/20 border border-emerald-500/30">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Parcelas no PIX</Label>
                                <Select
                                  value={String(saldoPixParcelas)}
                                  onValueChange={(v) => setSaldoPixParcelas(Number(v) || 1)}
                                >
                                  <SelectTrigger className="h-8 text-xs font-semibold bg-background">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map((n) => (
                                      <SelectItem key={n} value={String(n)}>
                                        {n === 1 ? '1x à vista' : `${n}x mensais de ${formatMoney(saldo / n)}`}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Dia do Vencimento Padrão</Label>
                                <Select
                                  value={String(saldoPixDiaVencimento)}
                                  onValueChange={(v) => setSaldoPixDiaVencimento(Number(v) || 10)}
                                >
                                  <SelectTrigger className="h-8 text-xs font-semibold bg-background">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[1, 5, 10, 15, 20, 25, 28, 30].map((d) => (
                                      <SelectItem key={d} value={String(d)}>
                                        Todo dia {d}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Saldo será dividido em <strong>{saldoPixParcelas}x de {formatMoney(saldo / saldoPixParcelas)}</strong> no PIX com vencimento todo dia {saldoPixDiaVencimento}.
                            </p>
                          </div>
                        );
                      })()}

                      {modalidadeSaldo === 'boleto' && (() => {
                        const saldo = Math.max(0, total - valorEntrada);
                        return (
                          <div className="space-y-2 p-2.5 rounded bg-amber-950/20 border border-amber-500/30">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Parcelas no Boleto</Label>
                                <Select
                                  value={String(saldoBoletoParcelas)}
                                  onValueChange={(v) => setSaldoBoletoParcelas(Number(v) || 1)}
                                >
                                  <SelectTrigger className="h-8 text-xs font-semibold bg-background">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map((n) => (
                                      <SelectItem key={n} value={String(n)}>
                                        {n === 1 ? '1x à vista' : `${n}x mensais de ${formatMoney(saldo / n)}`}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Dia do Vencimento Padrão</Label>
                                <Select
                                  value={String(saldoBoletoDiaVencimento)}
                                  onValueChange={(v) => setSaldoBoletoDiaVencimento(Number(v) || 10)}
                                >
                                  <SelectTrigger className="h-8 text-xs font-semibold bg-background">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[1, 5, 10, 15, 20, 25, 28, 30].map((d) => (
                                      <SelectItem key={d} value={String(d)}>
                                        Todo dia {d}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Saldo será emitido em <strong>{saldoBoletoParcelas}x de {formatMoney(saldo / saldoBoletoParcelas)}</strong> no boleto bancário.
                            </p>
                          </div>
                        );
                      })()}

                      {modalidadeSaldo === 'conclusao' && (
                        <div className="p-2.5 rounded bg-muted/30 border border-border/50 text-xs text-muted-foreground space-y-1">
                          <p className="font-semibold text-foreground">
                            Saldo de {formatMoney(total - valorEntrada)} a ser pago na conclusão do tratamento
                          </p>
                          <p className="text-[11px]">
                            O paciente pagará o restante na última consulta ou entrega final do procedimento.
                          </p>
                        </div>
                      )}

                      <div className="flex justify-end pt-2 border-t border-border/50">
                        <Button
                          type="button"
                          size="sm"
                          onClick={aplicarEntradaComSaldo}
                          disabled={valorEntrada <= 0}
                          className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold gap-1.5"
                        >
                          <Check className="h-3.5 w-3.5" /> Aplicar Entrada + Saldo ao Orçamento
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Assistente de Cartão (PagBank / InfinitePay) */}
              {cartaoAssistenteAtivo && (
                <div className="rounded-lg border border-blue-500/40 bg-blue-950/20 p-3.5 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-400">
                      <CreditCard className="h-4 w-4" />
                      Configuração da Máquina de Cartão (PagBank / InfinitePay)
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setCartaoAssistenteAtivo(false)}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Fechar
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Operadora da Máquina</Label>
                      <Select
                        value={cartaoOperadoraId}
                        onValueChange={setCartaoOperadoraId}
                      >
                        <SelectTrigger className="h-9 text-xs font-bold bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {operadoras.filter((o) => o.ativa !== false).map((op) => (
                            <SelectItem key={op.id} value={op.id}>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: op.cor || '#3b82f6' }}
                                />
                                <span className="font-semibold">{op.nome}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Modalidade</Label>
                      <Select
                        value={cartaoTipo}
                        onValueChange={(v: 'credito' | 'debito') => {
                          setCartaoTipo(v);
                          if (v === 'debito') setCartaoParcelas(1);
                        }}
                      >
                        <SelectTrigger className="h-9 text-xs font-medium bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="credito">Crédito</SelectItem>
                          <SelectItem value="debito">Débito</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Quantidade de Parcelas</Label>
                      <Select
                        value={String(cartaoParcelas)}
                        onValueChange={(v) => setCartaoParcelas(Number(v) || 1)}
                        disabled={cartaoTipo === 'debito'}
                      >
                        <SelectTrigger className="h-9 text-xs font-medium bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18].map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n === 1 ? '1x (À vista)' : `${n}x ${total > 0 ? `(${formatMoney(total / n)})` : ''}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {(() => {
                    const op = operadoras.find((o) => o.id === cartaoOperadoraId) || operadoraPadrao;
                    const isDeb = cartaoTipo === 'debito';
                    const calc = calcularTaxaCartao(op, cartaoParcelas, total, isDeb);
                    const opNome = op?.nome || 'Cartão';

                    const aplicarAoOrcamento = () => {
                      let textoFinal = '';
                      if (isDeb) {
                        textoFinal = 'Cartão de Débito';
                      } else if (cartaoParcelas === 1) {
                        textoFinal = 'Cartão de Crédito à vista 1x';
                      } else {
                        textoFinal = `Cartão de Crédito em ${cartaoParcelas}x de ${formatMoney(calc.valorParcelaBruto)}`;
                      }
                      setFormasPagamento(textoFinal);
                      toast.success(`Plano de cartão (${opNome}) aplicado ao orçamento!`);
                    };

                    return (
                      <div className="rounded-lg bg-background/90 border border-blue-500/30 p-3 space-y-2.5">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="p-2 rounded bg-muted/50 border border-border/50">
                            <span className="text-[10px] text-muted-foreground block">Valor do Orçamento:</span>
                            <span className="font-semibold text-foreground text-sm">{formatMoney(total)}</span>
                          </div>
                          <div className="p-2 rounded bg-muted/50 border border-border/50">
                            <span className="text-[10px] text-muted-foreground block">Taxa da Máquina ({calc.taxaPercentual}%):</span>
                            <span className="font-bold text-destructive text-sm">
                              -{formatMoney(calc.taxaValor)}
                            </span>
                            <span className="text-[9px] text-muted-foreground block">Entra como Despesa</span>
                          </div>
                          <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30">
                            <span className="text-[10px] text-emerald-400 block font-medium">Líquido da Clínica:</span>
                            <span className="font-bold text-emerald-400 text-sm">{formatMoney(calc.valorLiquido)}</span>
                          </div>
                          <div className="p-2 rounded bg-blue-500/10 border border-blue-500/30">
                            <span className="text-[10px] text-blue-400 block font-medium">Parcelamento:</span>
                            <span className="font-bold text-blue-400 text-sm">
                              {isDeb ? 'À vista (Débito)' : `${cartaoParcelas}x de ${formatMoney(calc.valorParcelaBruto)}`}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-border/40">
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-blue-400 shrink-0" />
                            Taxa de <strong>{calc.taxaPercentual}%</strong> na operadora <strong>{opNome}</strong>. Ao aprovar, o valor de {formatMoney(calc.taxaValor)} será lançado como <strong>despesa</strong> automaticamente.
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            onClick={aplicarAoOrcamento}
                            className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold shrink-0"
                          >
                            <Check className="h-3.5 w-3.5 mr-1" /> Aplicar ao Orçamento
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Compositor de Múltiplas Formas de Pagamento (Ex: Entrada PIX + Restante Cartão) */}
              {multiplasFormasAtivo && (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-3.5 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                      <Layers className="h-4 w-4" />
                      Compositor de Pagamento Misto (Entrada + Cartão/Boleto)
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setMultiplasFormasAtivo(false)}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Fechar
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {formasMultiplas.map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-lg border border-border/70 bg-background/90 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <Input
                              value={item.rotulo}
                              onChange={(e) => handleAtualizarFormaMultipla(idx, { rotulo: e.target.value })}
                              placeholder="Ex: Entrada, Restante..."
                              className="h-7 text-xs w-36 font-semibold"
                            />
                          </div>

                          {formasMultiplas.length > 1 && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoverFormaMultipla(idx)}
                              title="Remover forma"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>

                        {(() => {
                          const isParcelavel = item.metodo === 'cartao' || item.metodo === 'pix_parcelado' || item.metodo === 'boleto';
                          const isCartao = item.metodo === 'cartao';
                          const requerDatasParcelas = (item.metodo === 'pix_parcelado' || item.metodo === 'boleto') && (item.parcelas || 1) > 1;
                          const isEntrada = item.rotulo.toLowerCase().includes('entrada') || idx === 0;

                          return (
                            <>
                              <div
                                className={`grid gap-2.5 ${
                                  !isParcelavel
                                    ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4'
                                    : isCartao
                                    ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6'
                                    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5'
                                }`}
                              >
                                <div className="space-y-1">
                                  <Label className="text-[11px] text-muted-foreground">Método</Label>
                                  <Select
                                    value={item.metodo}
                                    onValueChange={(v: any) => handleAtualizarFormaMultipla(idx, { metodo: v })}
                                  >
                                    <SelectTrigger className="h-8 text-xs font-medium">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="pix">PIX</SelectItem>
                                      <SelectItem value="cartao">Cartão</SelectItem>
                                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                      <SelectItem value="boleto">Boleto Bancário</SelectItem>
                                      <SelectItem value="pix_parcelado">PIX Parcelado</SelectItem>
                                      <SelectItem value="transferencia">Transferência</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {isCartao && (
                                  <>
                                    <div className="space-y-1">
                                      <Label className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1 text-emerald-400">
                                        <CreditCard className="h-3 w-3" /> Operadora
                                      </Label>
                                      <Select
                                        value={item.operadoraCartaoId || configMaquinas.operadoraPadraoId || 'infinitepay'}
                                        onValueChange={(v) => handleAtualizarFormaMultipla(idx, { operadoraCartaoId: v })}
                                      >
                                        <SelectTrigger className="h-8 text-xs font-bold bg-background">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {operadoras.filter((o) => o.ativa !== false).map((op) => (
                                            <SelectItem key={op.id} value={op.id}>
                                              <div className="flex items-center gap-1.5">
                                                <span
                                                  className="w-2 h-2 rounded-full"
                                                  style={{ backgroundColor: op.cor || '#10b981' }}
                                                />
                                                <span className="font-semibold">{op.nome}</span>
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className="space-y-1">
                                      <Label className="text-[11px] text-muted-foreground">Tipo</Label>
                                      <Select
                                        value={item.tipoCartao || 'credito'}
                                        onValueChange={(v: 'credito' | 'debito') =>
                                          handleAtualizarFormaMultipla(idx, {
                                            tipoCartao: v,
                                            parcelas: v === 'debito' ? 1 : item.parcelas || 1,
                                          })
                                        }
                                      >
                                        <SelectTrigger className="h-8 text-xs font-medium">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="credito">Crédito</SelectItem>
                                          <SelectItem value="debito">Débito</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </>
                                )}

                                <div className="space-y-1">
                                  <div className="flex justify-between items-center">
                                    <Label className="text-[11px] text-muted-foreground">Valor (R$)</Label>
                                    {idx === formasMultiplas.length - 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const somaOutras = formasMultiplas
                                            .filter((_, i) => i !== idx)
                                            .reduce((s, f) => s + (f.valor || 0), 0);
                                          handleAtualizarFormaMultipla(idx, { valor: Math.max(0, total - somaOutras) });
                                        }}
                                        className="text-[10px] text-emerald-400 hover:underline font-medium"
                                      >
                                        Preencher saldo
                                      </button>
                                    )}
                                  </div>
                                  <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={item.valor || ''}
                                    onChange={(e) => handleAtualizarFormaMultipla(idx, { valor: Number(e.target.value) || 0 })}
                                    placeholder="0,00"
                                    className="h-8 text-xs font-semibold"
                                  />
                                </div>

                                {isParcelavel && (!isCartao || item.tipoCartao !== 'debito') && (
                                  <div className="space-y-1">
                                    <Label className="text-[11px] text-muted-foreground">Parcelas</Label>
                                    <Select
                                      value={String(item.parcelas || 1)}
                                      onValueChange={(v) => handleAtualizarFormaMultipla(idx, { parcelas: Number(v) || 1 })}
                                    >
                                      <SelectTrigger className="h-8 text-xs font-medium">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map((n) => (
                                          <SelectItem key={n} value={String(n)}>
                                            {n === 1 ? '1x (À vista)' : `${n}x ${item.valor > 0 ? `(${formatMoney(item.valor / n)})` : ''}`}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                {isCartao ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                                        <CalendarDays className="h-3 w-3 text-emerald-400" />
                                        {isEntrada ? 'Data da Entrada' : 'Data Pagamento'}
                                      </Label>
                                      <span className="text-[10px] text-emerald-400 font-medium">Fatura</span>
                                    </div>
                                    <Input
                                      type="date"
                                      value={item.dataPagamento || formatIsoDate(new Date())}
                                      onChange={(e) => handleAtualizarFormaMultipla(idx, { dataPagamento: e.target.value })}
                                      className="h-8 text-xs font-semibold bg-background"
                                      title="Data da transação (as parcelas são cobradas automaticamente na fatura do cartão)"
                                    />
                                  </div>
                                ) : requerDatasParcelas ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-[11px] text-muted-foreground">Dia Base Venc.</Label>
                                      <span className="text-[10px] text-muted-foreground">1 a 31</span>
                                    </div>
                                    <Select
                                      value={String(item.diaVencimento || 10)}
                                      onValueChange={(v) => handleAtualizarFormaMultipla(idx, { diaVencimento: Number(v) || 10 })}
                                    >
                                      <SelectTrigger className="h-8 text-xs font-semibold">
                                        <SelectValue placeholder="Selecione o dia" />
                                      </SelectTrigger>
                                      <SelectContent className="max-h-56">
                                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                                          <SelectItem key={d} value={String(d)}>
                                            Todo dia {d}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                                      <CalendarDays className="h-3 w-3 text-emerald-400" />
                                      {isEntrada ? 'Data da Entrada' : item.metodo === 'boleto' ? 'Data de Vencimento' : 'Data do Pagamento'}
                                    </Label>
                                    <Input
                                      type="date"
                                      value={item.dataPagamento || formatIsoDate(new Date())}
                                      onChange={(e) => handleAtualizarFormaMultipla(idx, { dataPagamento: e.target.value })}
                                      className="h-8 text-xs font-semibold bg-background"
                                      title="Digite dia/mês/ano ou escolha no calendário"
                                    />
                                  </div>
                                )}

                                <div className="space-y-1">
                                  <Label className="text-[11px] text-muted-foreground">Situação</Label>
                                  <Select
                                    value={item.situacao || (item.metodo === 'cartao' ? 'Autorizado' : 'A vencer')}
                                    onValueChange={(v: any) => handleAtualizarFormaMultipla(idx, { situacao: v })}
                                  >
                                    <SelectTrigger className="h-8 text-xs font-semibold">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="A vencer">
                                        <span className="text-amber-500 font-medium">● A vencer</span>
                                      </SelectItem>
                                      <SelectItem value="Quitada">
                                        <span className="text-emerald-500 font-medium">● Quitada</span>
                                      </SelectItem>
                                      <SelectItem value="Autorizado">
                                        <span className="text-blue-500 font-medium">● Autorizado</span>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              {/* Banner de resumo de taxas da maquininha em tempo real */}
                              {isCartao && item.valor > 0 && (() => {
                                const op = operadoras.find((o) => o.id === item.operadoraCartaoId) || operadoraPadrao;
                                const isDeb = item.tipoCartao === 'debito';
                                const calc = calcularTaxaCartao(op, item.parcelas || 1, item.valor, isDeb);
                                return (
                                  <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-xs">
                                    <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                                      <CreditCard className="h-3.5 w-3.5" />
                                      <span>Máquina: <strong>{calc.operadoraNome}</strong> ({isDeb ? 'Débito' : `${calc.parcelas}x Crédito`})</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-destructive font-semibold">
                                        Taxa ({calc.taxaPercentual}%): -{formatMoney(calc.taxaValor)}
                                        <span className="text-[10px] text-muted-foreground ml-1 font-normal">(Despesa no financeiro)</span>
                                      </span>
                                      <span className="text-emerald-500 font-bold">
                                        Líquido Clínica: {formatMoney(calc.valorLiquido)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Grade de vencimentos específicos para editar qualquer dia e data livremente - Apenas para Boleto Parcelado e PIX Parcelado */}
                              {requerDatasParcelas && (
                                <div className="pt-2.5 border-t border-border/60 space-y-2">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                    <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                                      <CalendarDays className="h-3.5 w-3.5 text-emerald-400" />
                                      Vencimentos e Situações das Parcelas ({item.rotulo})
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      Edite data ou situação individual de cada parcela
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto overflow-x-hidden pr-1">
                                    {Array.from({ length: item.parcelas }).map((_, pIdx) => {
                                      const valParc = item.valor > 0 ? item.valor / item.parcelas : 0;
                                      const dataAtual = item.datasParcelas?.[pIdx] || '';
                                      return (
                                        <div
                                          key={pIdx}
                                          className="p-2.5 rounded-lg bg-card/60 border border-border/80 text-xs shadow-xs hover:border-emerald-500/40 transition-colors space-y-1.5"
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold text-[10px]">
                                              {pIdx + 1}ª Parcela
                                            </span>
                                            <span className="font-semibold text-xs text-foreground">
                                              {formatMoney(valParc)}
                                            </span>
                                          </div>
                                          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-border/40">
                                            <div className="flex items-center gap-1">
                                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                                <CalendarDays className="h-3 w-3 text-emerald-400" />
                                                Venc:
                                              </span>
                                              <Input
                                                type="date"
                                                value={dataAtual}
                                                onChange={(e) => handleAtualizarDataParcelaMultipla(idx, pIdx, e.target.value)}
                                                className="h-7 text-xs w-28 font-semibold bg-background border-border/80"
                                                title={`Data de vencimento da parcela ${pIdx + 1}`}
                                              />
                                            </div>
                                            <Select
                                              value={item.situacoesParcelas?.[pIdx] || item.situacao || 'A vencer'}
                                              onValueChange={(v: any) => handleAtualizarSituacaoParcelaMultipla(idx, pIdx, v)}
                                            >
                                              <SelectTrigger className="h-7 text-[11px] w-28 font-semibold">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="A vencer">
                                                  <span className="text-amber-500 font-medium">● A vencer</span>
                                                </SelectItem>
                                                <SelectItem value="Quitada">
                                                  <span className="text-emerald-500 font-medium">● Quitada</span>
                                                </SelectItem>
                                                <SelectItem value="Autorizado">
                                                  <span className="text-blue-500 font-medium">● Autorizado</span>
                                                </SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAdicionarFormaMultipla}
                      className="w-full h-8 text-xs gap-1 border-dashed border-emerald-500/40 text-emerald-400 hover:bg-emerald-950/30"
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar Outra Forma de Pagamento
                    </Button>

                    {/* Balanceador em tempo real */}
                    {(() => {
                      const soma = formasMultiplas.reduce((s, f) => s + (f.valor || 0), 0);
                      const dif = total - soma;
                      const bateu = Math.abs(dif) < 0.01;
                      return (
                        <div className="rounded-lg bg-background/90 border border-border p-2.5 text-xs space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Total do Orçamento:</span>
                            <span className="font-bold text-foreground">{formatMoney(total)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Soma das Formas:</span>
                            <span className="font-semibold">{formatMoney(soma)}</span>
                          </div>
                          <div className="flex justify-between items-center pt-1 border-t border-border/60">
                            <span className="font-medium">Status da Composição:</span>
                            {bateu ? (
                              <Badge className="bg-emerald-600/90 text-white text-[10px] gap-1">
                                <CheckCircle2 className="h-3 w-3" /> 100% Coberto
                              </Badge>
                            ) : dif > 0 ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-amber-500 font-semibold text-[11px]">
                                  Faltam distribuir {formatMoney(dif)}
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-5 px-1.5 text-[10px] border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                                  onClick={() => {
                                    const novoItem = {
                                      id: String(Date.now()),
                                      rotulo: 'Saldo Restante',
                                      metodo: 'pix' as const,
                                      valor: dif,
                                      parcelas: 1,
                                      diaVencimento: 10,
                                      dataPagamento: formatIsoDate(new Date()),
                                      datasParcelas: [formatIsoDate(new Date())],
                                      situacao: 'A vencer' as const,
                                      situacoesParcelas: ['A vencer' as const],
                                    };
                                    const novas = [...formasMultiplas, novoItem];
                                    setFormasMultiplas(novas);
                                    setFormasPagamento(montarTextoMultiplasFormas(novas));
                                  }}
                                >
                                  Preencher saldo a combinar
                                </Button>
                              </div>
                            ) : (
                              <span className="text-red-500 font-semibold text-[11px]">
                                Excede em {formatMoney(Math.abs(dif))}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {pixParceladoAtivo && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3.5 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <Sparkles className="h-4 w-4" />
                      Configuração de PIX Parcelado (Entrada, Parcelas e Vencimento)
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setPixParceladoAtivo(false)}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Fechar
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs">Valor da Entrada (R$)</Label>
                        {pixEntrada >= total && total > 0 && (
                          <span className="text-[10px] text-amber-500 font-medium">Entrada cobre o total</span>
                        )}
                      </div>
                      <Input
                        type="number"
                        min={0}
                        max={total}
                        step="0.01"
                        placeholder="0.00 (sem entrada)"
                        value={pixEntrada || ''}
                        onChange={(e) => handleChangePixEntrada(Number(e.target.value) || 0)}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Qtd. de Parcelas</Label>
                      <Select
                        value={String(pixParcelas)}
                        onValueChange={(v) => handleChangePixParcelas(Number(v) || 1)}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n}x {n > 1 ? 'mensais' : '(à vista)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Dia do Vencimento Padrão</Label>
                      <Select
                        value={String(pixDiaVencimento)}
                        onValueChange={(v) => handleChangePixDia(Number(v) || 10)}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 5, 10, 15, 20, 25, 28, 30].map((d) => (
                            <SelectItem key={d} value={String(d)}>
                              Todo dia {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Vencimentos personalizados por pagamento (Entrada e Parcelas) */}
                  <div className="space-y-2 pt-2 border-t border-primary/20">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                        <CalendarDays className="h-3.5 w-3.5 text-primary" />
                        Datas de Vencimento dos Pagamentos (Personalizadas)
                      </Label>
                      <span className="text-[10px] text-muted-foreground">
                        Selecione no calendário ou digite dia/mês/ano diretamente
                      </span>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {pixEntrada > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-background/90 border border-emerald-500/30 text-xs shadow-xs">
                          <div className="flex items-center justify-between sm:justify-start gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500 font-bold text-[10px]">
                              Entrada (PIX)
                            </span>
                            <span className="font-semibold text-emerald-600">
                              {formatMoney(pixEntrada)}
                            </span>
                          </div>
                          <div className="flex items-center flex-wrap gap-2">
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <CalendarDays className="h-3 w-3 text-emerald-500" /> Data:
                              </span>
                              <Input
                                type="date"
                                value={pixDataEntrada}
                                onChange={(e) => handleAtualizarDataEntrada(e.target.value)}
                                className="h-8 text-xs w-32 font-semibold bg-background"
                                title="Data da entrada em PIX"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] text-muted-foreground">Situação:</span>
                              <Select
                                value={pixEntradaSituacao}
                                onValueChange={(v: any) => handleAtualizarPixEntradaSituacao(v)}
                              >
                                <SelectTrigger className="h-8 text-xs w-28 font-semibold">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="A vencer">
                                    <span className="text-amber-500 font-medium">● A vencer</span>
                                  </SelectItem>
                                  <SelectItem value="Quitada">
                                    <span className="text-emerald-500 font-medium">● Quitada</span>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}

                      {Array.from({ length: pixParcelas }).map((_, idx) => {
                        const valorParc = Math.max(0, total - pixEntrada) / Math.max(1, pixParcelas);
                        return (
                          <div
                            key={idx}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-background/90 border border-border text-xs hover:border-primary/40 transition-colors shadow-xs"
                          >
                            <div className="flex items-center justify-between sm:justify-start gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold text-[10px]">
                                {idx + 1}ª Parcela PIX
                              </span>
                              <span className="font-semibold text-foreground">
                                {formatMoney(valorParc)}
                              </span>
                            </div>
                            <div className="flex items-center flex-wrap gap-2">
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <CalendarDays className="h-3 w-3 text-primary" /> Venc.:
                                </span>
                                <Input
                                  type="date"
                                  value={pixDatasParcelas[idx] || ''}
                                  onChange={(e) => handleAtualizarDataParcela(idx, e.target.value)}
                                  className="h-8 text-xs w-32 font-semibold bg-background"
                                  title={`Data de vencimento da parcela ${idx + 1}`}
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] text-muted-foreground">Situação:</span>
                                <Select
                                  value={pixSituacoesParcelas[idx] || 'A vencer'}
                                  onValueChange={(v: any) => handleAtualizarPixSituacaoParcela(idx, v)}
                                >
                                  <SelectTrigger className="h-8 text-xs w-28 font-semibold">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="A vencer">
                                      <span className="text-amber-500 font-medium">● A vencer</span>
                                    </SelectItem>
                                    <SelectItem value="Quitada">
                                      <span className="text-emerald-500 font-medium">● Quitada</span>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Resumo do Cálculo em tempo real */}
                  <div className="rounded-md bg-background/80 border border-border p-2.5 text-xs space-y-1">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Total do Orçamento:</span>
                      <span className="font-medium text-foreground">{formatMoney(total)}</span>
                    </div>
                    {pixEntrada > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Entrada pactuada (PIX):</span>
                        <span className="font-semibold text-emerald-600">
                          +{formatMoney(pixEntrada)} {pixDataEntrada ? `(em ${formatBrDate(pixDataEntrada)})` : ''}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                      <span>Saldo a parcelar:</span>
                      <span>{formatMoney(Math.max(0, total - pixEntrada))}</span>
                    </div>
                    <div className="flex justify-between text-foreground font-semibold pt-1 border-t border-border/60">
                      <span>Plano PIX:</span>
                      <span className="text-primary font-bold">
                        {pixParcelas}x de {formatMoney(Math.max(0, total - pixEntrada) / Math.max(1, pixParcelas))}
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground pt-1">
                      <CalendarDays className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      <div>
                        <span className="font-medium text-foreground">Vencimentos configurados: </span>
                        <span>
                          {pixDatasParcelas.filter(Boolean).map(formatBrDate).join(', ') || `Todo dia ${pixDiaVencimento}`}
                        </span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Essas datas exatas serão usadas no contrato, no PDF e nas parcelas de Contas a Receber.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Textarea
                value={formasPagamento}
                onChange={(e) => setFormasPagamento(e.target.value)}
                placeholder="Ex.: À vista com 10% de desconto, ou em até 12x no cartão"
                maxLength={500}
              />
                </>
              )}
            </div>



            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-2 mb-0">
                  <Handshake className="h-4 w-4 text-primary" /> Procedimento com parceiro
                </Label>
                <Switch checked={parceriaAtiva} onCheckedChange={setParceriaAtiva} />
              </div>

              {parceriaAtiva && (
                <div className="space-y-3">
                  {!novoParceiro ? (
                    <div className="space-y-1.5">
                      <Label>Parceiro</Label>
                      <Select value={parceiroId} onValueChange={handleSelecionarParceiro}>
                        <SelectTrigger><SelectValue placeholder="Selecione o parceiro" /></SelectTrigger>
                        <SelectContent>
                          {parceiros.filter((p) => p.ativo).map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setNovoParceiro(true)}>
                        <Plus className="h-4 w-4 mr-1" /> Cadastrar novo parceiro
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label>Nome do novo parceiro</Label>
                      <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Dr. João" />
                      <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={criarParceiroRapido}>Salvar parceiro</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setNovoParceiro(false)}>Cancelar</Button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Tipo de repasse</Label>
                      <Select value={tipoRepasse} onValueChange={(v) => setTipoRepasse(v as TipoRepasse)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentual">Percentual (%)</SelectItem>
                          <SelectItem value="fixo">Valor fixo (R$)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{tipoRepasse === 'percentual' ? 'Percentual (%)' : 'Valor (R$)'}</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={valorRepasse || ''}
                        onChange={(e) => setValorRepasse(Number(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Repasse estimado ao parceiro: <span className="font-medium text-foreground">{formatMoney(repasseCalculado)}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} maxLength={1000} />
            </div>

            <div className="flex justify-end gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSalvarComoNovaProposta}
                  disabled={salvandoNovaProposta}
                  className="border-indigo-400 text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 font-semibold gap-1.5"
                >
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                  Salvar e Enviar Nova Proposta
                </Button>
              )}
              <Button onClick={handleSave}>Salvar orçamento</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {contratoModalOpen && (
        <ContratoModal
          isOpen={contratoModalOpen}
          onClose={() => setContratoModalOpen(false)}
          patient={patient}
          initialOrcamento={contratoOrcamento}
        />
      )}

      {/* Visualizador Dedicado do PDF Bilateral Oficial Assinado (Storage privado) */}
      <Dialog
        open={visualizadorPdfAssinado.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            if (visualizadorPdfAssinado.blob && visualizadorPdfAssinado.pdfUrl?.startsWith('blob:')) {
              URL.revokeObjectURL(visualizadorPdfAssinado.pdfUrl);
            }
            setVisualizadorPdfAssinado({
              isOpen: false,
              pdfUrl: null,
              titulo: '',
              identificador: '',
              loading: false,
              error: null,
              blob: null,
              signedUrl: null,
            });
          }
        }}
      >
        <DialogContent className="max-w-5xl w-[96vw] h-[92vh] max-h-[94vh] flex flex-col p-0 overflow-hidden bg-background border border-border shadow-2xl">
          {/* Header do Visualizador */}
          <div className="p-4 sm:p-5 border-b border-border bg-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 sm:p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base sm:text-lg font-bold flex flex-wrap items-center gap-2 text-foreground">
                  <span>{visualizadorPdfAssinado.titulo}</span>
                  <Badge variant="outline" className="text-[10px] sm:text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> 100% Assinado Bilateralmente
                  </Badge>
                  <Badge variant="outline" className="text-[10px] sm:text-xs font-medium border-border text-muted-foreground">
                    Padrão A4 Oficial
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  Paciente: <strong className="text-foreground">{patient?.nome}</strong> • Arquivo definitivo arquivado no Storage
                </p>
              </div>
            </div>

            {/* Ações do Header */}
            <div className="flex items-center gap-2 shrink-0">
              {visualizadorPdfAssinado.pdfUrl && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => {
                      if (visualizadorPdfAssinado.signedUrl) {
                        window.open(visualizadorPdfAssinado.signedUrl, '_blank');
                      } else if (visualizadorPdfAssinado.pdfUrl) {
                        window.open(visualizadorPdfAssinado.pdfUrl, '_blank');
                      }
                    }}
                    title="Abrir PDF em nova aba no navegador"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Nova Aba</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                    onClick={() => {
                      if (visualizadorPdfAssinado.blob) {
                        const url = URL.createObjectURL(visualizadorPdfAssinado.blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `Contrato_Assinado_${visualizadorPdfAssinado.identificador}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        toast.success('Download do PDF oficial concluído!');
                      } else if (visualizadorPdfAssinado.signedUrl) {
                        window.open(visualizadorPdfAssinado.signedUrl, '_blank');
                      }
                    }}
                    title="Baixar cópia exata do contrato assinado"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Baixar PDF</span>
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Área Central: Iframe do PDF ou Loading ou Erro */}
          <div className="flex-1 min-h-0 bg-slate-900/90 dark:bg-slate-950 p-2 sm:p-4 flex items-center justify-center overflow-hidden">
            {visualizadorPdfAssinado.loading ? (
              <div className="flex flex-col items-center justify-center gap-3 p-8 text-center text-slate-300">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                <p className="text-sm font-medium">Localizando e carregando o PDF oficial bilateral no Storage...</p>
                <p className="text-xs text-slate-400">Recuperando o arquivo com ambas as assinaturas concluídas.</p>
              </div>
            ) : visualizadorPdfAssinado.error ? (
              <div className="max-w-md w-full bg-card p-6 rounded-lg border border-destructive/40 shadow-lg text-center space-y-3">
                <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
                <h3 className="font-bold text-base text-foreground">Arquivo do Contrato Indisponível</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {visualizadorPdfAssinado.error}
                </p>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setVisualizadorPdfAssinado((prev) => ({ ...prev, isOpen: false }));
                    }}
                  >
                    Fechar
                  </Button>
                  {visualizadorPdfAssinado.tentarNovamenteFn && (
                    <Button
                      type="button"
                      size="sm"
                      className="bg-primary text-primary-foreground gap-1.5"
                      onClick={visualizadorPdfAssinado.tentarNovamenteFn}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Tentar Novamente
                    </Button>
                  )}
                </div>
              </div>
            ) : visualizadorPdfAssinado.pdfUrl ? (
              <iframe
                src={`${visualizadorPdfAssinado.pdfUrl}#toolbar=1&navpanes=0`}
                title={visualizadorPdfAssinado.titulo}
                className="w-full h-full max-w-[900px] rounded-md border border-slate-700 bg-white shadow-2xl"
              />
            ) : null}
          </div>

          {/* Rodapé Informativo */}
          <div className="px-4 py-2.5 sm:px-5 sm:py-3 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5 text-center sm:text-left">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Contrato digital bilateralmente formalizado com assinaturas da Cirurgiã-Dentista e do Paciente.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] bg-muted px-2 py-0.5 rounded border border-border">
                Hash SHA-256 Verificado
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {apresentarOrcamento && (
        <ModalApresentarOrcamento
          isOpen={!!apresentarOrcamento}
          onClose={() => setApresentarOrcamento(null)}
          orcamento={apresentarOrcamento}
          patient={patient}
          onSalvarAlteracoes={async (dados) => {
            await saveOrcamento({
              ...dados,
              pacienteId: patient?.id,
              pacienteNome: patient?.nome,
            });
            setApresentarOrcamento(null);
          }}
          onAprovar={async (orcamentoAtualizado, lancarFin, darBaixa) => {
            setDarBaixaImediataAprovacao(darBaixa);
            await handleConfirmarAprovacao(orcamentoAtualizado, lancarFin);
            setApresentarOrcamento(null);
          }}
          onGerarContrato={(o) => {
            setContratoOrcamento(o);
            setContratoModalOpen(true);
          }}
          onBaixarPdf={(o) => baixarPdf(o)}
          onEnviarWhatsApp={(o) => enviarWhatsApp(o)}
        />
      )}

      {/* Diálogo de Aprovação com Seleção e Flexibilização de Condição para Contrato */}
      {aprovandoOrcamento && (
        <Dialog open={!!aprovandoOrcamento} onOpenChange={(open) => !open && setAprovandoOrcamento(null)}>
          <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Check className="h-5 w-5 text-emerald-600" />
                Aprovação e Definição de Pagamento para Contrato
              </DialogTitle>
              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 pt-1">
                <span>Plano: <strong className="text-foreground">{aprovandoOrcamento.titulo}</strong></span>
                <span>•</span>
                <span>Total: <strong className="text-foreground">{formatMoney(aprovandoOrcamento.total)}</strong></span>
                <span>•</span>
                <span className="font-mono text-[11px]">#{aprovandoOrcamento.id ? aprovandoOrcamento.id.slice(0, 8).toUpperCase() : ''}</span>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Etapa 1: Seleção da Condição Fechada */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Wallet className="h-4 w-4 text-primary" />
                    Qual condição de pagamento foi acordada para o Contrato?
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const condAtual = condicoesAprovacao.find((c) => c.id === condicaoEscolhidaAprovacaoId) || condicoesAprovacao[0];
                      setCondicaoAprovacaoEmEdicao({ ...condAtual });
                      setFlexibilizandoAprovacao(!flexibilizandoAprovacao);
                    }}
                    className="h-7 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10 font-medium"
                  >
                    <Pencil className="h-3 w-3" />
                    {flexibilizandoAprovacao ? 'Fechar Ajustes' : 'Flexibilizar / Alterar Condição'}
                  </Button>
                </div>

                {condicoesAprovacao.length > 1 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {condicoesAprovacao.map((c, idx) => {
                      const isSel = c.id === condicaoEscolhidaAprovacaoId;
                      return (
                        <div
                          key={c.id || idx}
                          onClick={() => {
                            setCondicaoEscolhidaAprovacaoId(c.id);
                            const hoje = formatIsoDate(new Date());
                            const em30 = formatIsoDate(somarMesesSeguro(new Date(), 1));
                            const atualizada: CondicaoPagamento = {
                              ...c,
                              dataEntrada: c.dataEntrada || hoje,
                              situacaoEntrada: c.situacaoEntrada || 'Quitada',
                              dataPrimeiroVencimento: c.dataPrimeiroVencimento || em30,
                              situacaoSaldo: c.situacaoSaldo || (c.tipo === 'cartao' ? 'Autorizado' : 'A vencer'),
                            };
                            atualizada.descricao = c.descricao || calcularDescricaoCondicao(atualizada, aprovandoOrcamento.total);
                            setCondicaoAprovacaoEmEdicao(atualizada);
                          }}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between gap-2 ${
                            isSel
                              ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/20 shadow-xs ring-2 ring-emerald-500/20'
                              : 'border-border/80 bg-card hover:border-primary/40'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  isSel ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                Opção {idx + 1}
                              </span>
                              {isSel && (
                                <Badge className="bg-emerald-600 text-white text-[9px] px-1.5 py-0 h-4">
                                  ✓ Escolhida
                                </Badge>
                              )}
                            </div>
                            <h5 className="font-bold text-foreground text-xs leading-snug">{c.titulo}</h5>
                            <p className="text-[11px] text-muted-foreground line-clamp-3 leading-tight">{c.descricao}</p>
                          </div>

                          <div className="pt-1.5 border-t border-border/50 text-[10px] text-right font-semibold text-emerald-600">
                            {formatMoney(c.valorTotal || aprovandoOrcamento.total)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-card border border-border flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-foreground block">
                        {condicoesAprovacao[0]?.titulo || 'Condição Única'}
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        {condicoesAprovacao[0]?.descricao || aprovandoOrcamento.formasPagamento || 'A combinar'}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-emerald-600 border-emerald-500/40 text-[10px]">
                      Padrão
                    </Badge>
                  </div>
                )}

                {/* Banner Informativo de Descarte Automático das Opções não Escolhidas */}
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold">Condição Selecionada para o Fechamento</p>
                    <p className="text-[11px] text-muted-foreground dark:text-emerald-400/90 leading-relaxed">
                      Ao aprovar, <strong>apenas a opção escolhida será mantida</strong> no orçamento e no contrato. As outras propostas saem automaticamente.
                    </p>
                  </div>
                </div>
              </div>

              {/* Painel de Flexibilização / Alteração da Condição */}
              {flexibilizandoAprovacao && condicaoAprovacaoEmEdicao && (
                <div className="p-3.5 rounded-xl bg-muted/40 border border-primary/30 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Personalizar e Flexibilizar Condição para o Fechamento
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Ajuste valores de entrada, parcelas, prazos ou texto antes de fechar
                    </span>
                  </div>

                  {/* Templates Rápidos na Aprovação */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] text-muted-foreground font-semibold">Modelos rápidos:</span>
                    <button
                      type="button"
                      onClick={() => aplicarPresetCondicao('a_vista_10', aprovandoOrcamento.total, setCondicaoAprovacaoEmEdicao)}
                      className="px-2 py-0.5 rounded text-[10px] bg-background border border-border hover:border-primary font-semibold"
                    >
                      À Vista (10% OFF)
                    </button>
                    <button
                      type="button"
                      onClick={() => aplicarPresetCondicao('entrada_50_30dias', aprovandoOrcamento.total, setCondicaoAprovacaoEmEdicao)}
                      className="px-2 py-0.5 rounded text-[10px] bg-background border border-border hover:border-primary font-semibold text-emerald-600"
                    >
                      Entrada 50% + Saldo 30 dias
                    </button>
                    <button
                      type="button"
                      onClick={() => aplicarPresetCondicao('entrada_30_6x', aprovandoOrcamento.total, setCondicaoAprovacaoEmEdicao)}
                      className="px-2 py-0.5 rounded text-[10px] bg-background border border-border hover:border-primary font-semibold"
                    >
                      Entrada 30% + Saldo em 6x
                    </button>
                    <button
                      type="button"
                      onClick={() => aplicarPresetCondicao('cartao_10x', aprovandoOrcamento.total, setCondicaoAprovacaoEmEdicao)}
                      className="px-2 py-0.5 rounded text-[10px] bg-background border border-border hover:border-primary font-semibold"
                    >
                      Cartão em 10x
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">Título Comercial:</Label>
                      <Input
                        value={condicaoAprovacaoEmEdicao.titulo || ''}
                        onChange={(e) => setCondicaoAprovacaoEmEdicao((prev) => ({ ...prev, titulo: e.target.value }))}
                        className="h-8 text-xs font-semibold"
                        placeholder="Ex: Opção Acordada em Consulta"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">Tipo de Pagamento:</Label>
                      <select
                        value={condicaoAprovacaoEmEdicao.tipo || 'personalizado'}
                        onChange={(e) => {
                          const t = e.target.value as any;
                          const upd: Partial<CondicaoPagamento> = { ...condicaoAprovacaoEmEdicao, tipo: t };
                          if (t === 'a_vista') {
                            upd.descontoPercentual = upd.descontoPercentual ?? 10;
                            upd.descontoValor = Number(((aprovandoOrcamento.total * (upd.descontoPercentual || 10)) / 100).toFixed(2));
                            upd.valorTotal = Math.max(0, aprovandoOrcamento.total - (upd.descontoValor || 0));
                          } else if (t === 'cartao') {
                            upd.parcelas = upd.parcelas || 6;
                            upd.valorTotal = aprovandoOrcamento.total;
                            upd.valorParcela = Number((aprovandoOrcamento.total / (upd.parcelas || 6)).toFixed(2));
                            upd.tipoCartao = 'credito';
                          } else if (t === 'entrada_saldo') {
                            upd.valorEntrada = upd.valorEntrada ?? Number((aprovandoOrcamento.total * 0.5).toFixed(2));
                            upd.metodoEntrada = upd.metodoEntrada || 'pix';
                            upd.saldoTipoPrazo = upd.saldoTipoPrazo || 'dias';
                            upd.saldoPrazoDias = upd.saldoPrazoDias || 30;
                            upd.saldoParcelas = upd.saldoParcelas || 1;
                            upd.saldoMetodo = upd.saldoMetodo || 'cartao';
                            const s = Math.max(0, aprovandoOrcamento.total - (upd.valorEntrada || 0));
                            upd.saldoValorParcela = s;
                            upd.valorTotal = aprovandoOrcamento.total;
                          } else if (t === 'pix_parcelado') {
                            upd.parcelas = upd.parcelas || 4;
                            upd.diaVencimento = upd.diaVencimento || 10;
                            upd.valorTotal = aprovandoOrcamento.total;
                            upd.valorParcela = Number((aprovandoOrcamento.total / (upd.parcelas || 4)).toFixed(2));
                          }
                          upd.descricao = calcularDescricaoCondicao(upd, aprovandoOrcamento.total);
                          setCondicaoAprovacaoEmEdicao(upd);
                        }}
                        className="w-full h-8 px-2 text-xs font-semibold rounded-md bg-background border border-border"
                      >
                        <option value="a_vista">À Vista (PIX / Transferência)</option>
                        <option value="cartao">Cartão de Crédito</option>
                        <option value="entrada_saldo">Entrada + Saldo (em Dias ou Parcelas)</option>
                        <option value="pix_parcelado">PIX Parcelado</option>
                        <option value="boleto">Boleto Bancário</option>
                        <option value="personalizado">Personalizado</option>
                      </select>
                    </div>
                  </div>

                  {/* Ajuste Direto do Valor Total da Condição Fechada */}
                  {(() => {
                    const vTot = typeof condicaoAprovacaoEmEdicao.valorTotal === 'number' && condicaoAprovacaoEmEdicao.valorTotal > 0
                      ? condicaoAprovacaoEmEdicao.valorTotal
                      : aprovandoOrcamento.total;
                    const diff = aprovandoOrcamento.total - vTot;
                    const temDesconto = diff > 0.01;
                    const percDesc = temDesconto ? ((diff / aprovandoOrcamento.total) * 100).toFixed(0) : 0;
                    return (
                      <div className="p-2.5 rounded-lg bg-muted/40 border border-border/80 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                            Valor Desta Condição (R$):
                          </Label>
                          {temDesconto && (
                            <button
                              type="button"
                              onClick={() => {
                                const recalculada = recalcularValoresCondicaoComNovoTotal(
                                  condicaoAprovacaoEmEdicao,
                                  aprovandoOrcamento.total,
                                  aprovandoOrcamento.total
                                );
                                setCondicaoAprovacaoEmEdicao(recalculada);
                              }}
                              className="text-[10px] text-muted-foreground hover:text-primary underline font-medium"
                            >
                              Resetar p/ Total Base ({formatMoney(aprovandoOrcamento.total)})
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={condicaoAprovacaoEmEdicao.valorTotal ?? aprovandoOrcamento.total}
                            onChange={(e) => {
                              const vNovo = Number(e.target.value) || 0;
                              const recalculada = recalcularValoresCondicaoComNovoTotal(
                                condicaoAprovacaoEmEdicao,
                                vNovo,
                                aprovandoOrcamento.total
                              );
                              setCondicaoAprovacaoEmEdicao(recalculada);
                            }}
                            className="h-8 text-xs font-bold w-40"
                          />
                          {temDesconto ? (
                            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/30">
                              Desconto de {formatMoney(diff)} ({percDesc}% OFF)
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">
                              Valor idêntico ao total base do orçamento
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Campos contextuais por tipo */}
                  {condicaoAprovacaoEmEdicao.tipo === 'a_vista' && (
                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded bg-background border border-border text-xs">
                      <div className="space-y-1">
                        <Label className="text-[11px]">% Desconto:</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={condicaoAprovacaoEmEdicao.descontoPercentual ?? ''}
                          onChange={(e) => {
                            const p = Number(e.target.value) || 0;
                            const descVal = Number(((aprovandoOrcamento.total * p) / 100).toFixed(2));
                            const novoTotal = Math.max(0, aprovandoOrcamento.total - descVal);
                            const recalculada = recalcularValoresCondicaoComNovoTotal(
                              { ...condicaoAprovacaoEmEdicao, descontoPercentual: p },
                              novoTotal,
                              aprovandoOrcamento.total
                            );
                            setCondicaoAprovacaoEmEdicao(recalculada);
                          }}
                          className="h-7 text-xs font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Valor Final com Desconto:</Label>
                        <div className="h-7 px-2 flex items-center font-bold text-xs text-emerald-600 bg-muted/30 rounded border border-border">
                          {formatMoney(condicaoAprovacaoEmEdicao.valorTotal || aprovandoOrcamento.total)}
                        </div>
                      </div>
                    </div>
                  )}

                  {condicaoAprovacaoEmEdicao.tipo === 'cartao' && (() => {
                    const vTot = typeof condicaoAprovacaoEmEdicao.valorTotal === 'number' && condicaoAprovacaoEmEdicao.valorTotal > 0
                      ? condicaoAprovacaoEmEdicao.valorTotal
                      : aprovandoOrcamento.total;
                    return (
                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded bg-background border border-border text-xs">
                        <div className="space-y-1">
                          <Label className="text-[11px]">Qtd. Parcelas Cartão:</Label>
                          <select
                            value={condicaoAprovacaoEmEdicao.parcelas || 1}
                            onChange={(e) => {
                              const p = Number(e.target.value) || 1;
                              const upd = {
                                ...condicaoAprovacaoEmEdicao,
                                parcelas: p,
                                valorParcela: Number((vTot / p).toFixed(2)),
                              };
                              upd.descricao = calcularDescricaoCondicao(upd, aprovandoOrcamento.total);
                              setCondicaoAprovacaoEmEdicao(upd);
                            }}
                            className="w-full h-7 px-2 text-xs font-semibold rounded bg-background border border-border"
                          >
                            {[1, 2, 3, 4, 5, 6, 8, 10, 12, 18].map((n) => (
                              <option key={n} value={n}>
                                {n}x de {formatMoney(vTot / n)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Tipo:</Label>
                          <select
                            value={condicaoAprovacaoEmEdicao.tipoCartao || 'credito'}
                            onChange={(e) => {
                              const upd = { ...condicaoAprovacaoEmEdicao, tipoCartao: e.target.value as any };
                              upd.descricao = calcularDescricaoCondicao(upd, aprovandoOrcamento.total);
                              setCondicaoAprovacaoEmEdicao(upd);
                            }}
                            className="w-full h-7 px-2 text-xs font-semibold rounded bg-background border border-border"
                          >
                            <option value="credito">Crédito</option>
                            <option value="debito">Débito (à vista)</option>
                          </select>
                        </div>
                      </div>
                    );
                  })()}

                  {condicaoAprovacaoEmEdicao.tipo === 'entrada_saldo' && (() => {
                    const vTot = typeof condicaoAprovacaoEmEdicao.valorTotal === 'number' && condicaoAprovacaoEmEdicao.valorTotal > 0
                      ? condicaoAprovacaoEmEdicao.valorTotal
                      : aprovandoOrcamento.total;
                    const entAtual = Math.min(vTot, Math.max(0, condicaoAprovacaoEmEdicao.valorEntrada || 0));
                    const saldoAtual = Math.max(0, vTot - entAtual);
                    const parcAtual = condicaoAprovacaoEmEdicao.saldoParcelas || 1;
                    return (
                      <div className="space-y-2.5 p-2.5 rounded bg-background border border-border text-xs">
                        {/* Chips de porcentagem rápida de entrada */}
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <Label className="text-[11px] font-semibold text-muted-foreground">
                            Atalhos de Entrada (% do Total):
                          </Label>
                          <div className="flex items-center gap-1">
                            {[10, 20, 30, 40, 50, 70].map((perc) => (
                              <button
                                key={perc}
                                type="button"
                                onClick={() => {
                                  const ent = Number(((vTot * perc) / 100).toFixed(2));
                                  const saldo = Math.max(0, Number((vTot - ent).toFixed(2)));
                                  const upd: Partial<CondicaoPagamento> = {
                                    ...condicaoAprovacaoEmEdicao,
                                    valorEntrada: ent,
                                    saldoValorParcela: Number((saldo / parcAtual).toFixed(2)),
                                  };
                                  upd.descricao = calcularDescricaoCondicao(upd, aprovandoOrcamento.total);
                                  setCondicaoAprovacaoEmEdicao(upd);
                                }}
                                className="px-1.5 py-0.5 text-[10px] rounded bg-muted hover:bg-primary/20 hover:text-primary font-bold border border-border"
                              >
                                {perc}%
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[11px]">Valor Entrada (R$):</Label>
                            <Input
                              type="number"
                              min={0}
                              max={vTot}
                              step="0.01"
                              value={condicaoAprovacaoEmEdicao.valorEntrada ?? ''}
                              onChange={(e) => {
                                const ent = Number(e.target.value) || 0;
                                const s = Math.max(0, vTot - ent);
                                const parc = condicaoAprovacaoEmEdicao.saldoParcelas || 1;
                                const upd: Partial<CondicaoPagamento> = {
                                  ...condicaoAprovacaoEmEdicao,
                                  valorEntrada: ent,
                                  saldoValorParcela: Number((s / parc).toFixed(2)),
                                };
                                upd.descricao = calcularDescricaoCondicao(upd, aprovandoOrcamento.total);
                                setCondicaoAprovacaoEmEdicao(upd);
                              }}
                              className="h-7 text-xs font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">Método Entrada:</Label>
                            <select
                              value={condicaoAprovacaoEmEdicao.metodoEntrada || 'pix'}
                              onChange={(e) => {
                                const upd: Partial<CondicaoPagamento> = { ...condicaoAprovacaoEmEdicao, metodoEntrada: e.target.value as any };
                                upd.descricao = calcularDescricaoCondicao(upd, aprovandoOrcamento.total);
                                setCondicaoAprovacaoEmEdicao(upd);
                              }}
                              className="w-full h-7 px-2 text-xs font-semibold rounded bg-background border border-border"
                            >
                              <option value="pix">PIX</option>
                              <option value="dinheiro">Dinheiro</option>
                              <option value="cartao_debito">Débito</option>
                              <option value="cartao_credito">Crédito</option>
                              <option value="transferencia">Transferência</option>
                            </select>
                          </div>
                        </div>

                        {/* Modalidade do Saldo: Dias, Parcelas ou Conclusão */}
                        <div className="pt-2 border-t border-border/60 space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-[11px] font-semibold">Como o saldo será pago?</Label>
                            <select
                              value={condicaoAprovacaoEmEdicao.saldoTipoPrazo || (condicaoAprovacaoEmEdicao.saldoPrazoDias ? 'dias' : 'parcelas')}
                              onChange={(e) => {
                                const stp = e.target.value as 'dias' | 'parcelas' | 'conclusao';
                                const upd: Partial<CondicaoPagamento> = {
                                  ...condicaoAprovacaoEmEdicao,
                                  saldoTipoPrazo: stp,
                                };
                                if (stp === 'dias') {
                                  upd.saldoPrazoDias = upd.saldoPrazoDias || 30;
                                }
                                upd.descricao = calcularDescricaoCondicao(upd, aprovandoOrcamento.total);
                                setCondicaoAprovacaoEmEdicao(upd);
                              }}
                              className="h-7 px-2 text-[11px] font-semibold rounded bg-background border border-primary/50"
                            >
                              <option value="dias">Prazo em Dias (ex: em 30 dias)</option>
                              <option value="parcelas">Parcelado em vezes mensais</option>
                              <option value="conclusao">Na Conclusão do Tratamento</option>
                            </select>
                          </div>

                          {(condicaoAprovacaoEmEdicao.saldoTipoPrazo === 'dias' || (!condicaoAprovacaoEmEdicao.saldoTipoPrazo && condicaoAprovacaoEmEdicao.saldoPrazoDias)) && (
                            <div className="space-y-1.5 p-2 rounded bg-muted/30 border border-border/60">
                              <div className="flex items-center justify-between gap-1 flex-wrap">
                                <span className="text-[10px] text-muted-foreground font-medium">Atalhos de prazo:</span>
                                <div className="flex items-center gap-1">
                                  {[15, 30, 45, 60, 90].map((dias) => (
                                    <button
                                      key={dias}
                                      type="button"
                                      onClick={() => {
                                        const upd: Partial<CondicaoPagamento> = {
                                          ...condicaoAprovacaoEmEdicao,
                                          saldoTipoPrazo: 'dias',
                                          saldoPrazoDias: dias,
                                        };
                                        upd.descricao = calcularDescricaoCondicao(upd, aprovandoOrcamento.total);
                                        setCondicaoAprovacaoEmEdicao(upd);
                                      }}
                                      className="px-1.5 py-0.5 text-[10px] rounded bg-background hover:bg-primary/20 hover:text-primary font-semibold border border-border"
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
                                    value={condicaoAprovacaoEmEdicao.saldoPrazoDias || 30}
                                    onChange={(e) => {
                                      const d = Number(e.target.value) || 30;
                                      const upd: Partial<CondicaoPagamento> = {
                                        ...condicaoAprovacaoEmEdicao,
                                        saldoTipoPrazo: 'dias',
                                        saldoPrazoDias: d,
                                      };
                                      upd.descricao = calcularDescricaoCondicao(upd, aprovandoOrcamento.total);
                                      setCondicaoAprovacaoEmEdicao(upd);
                                    }}
                                    className="h-7 text-xs font-bold"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[11px]">Meio do Saldo:</Label>
                                  <select
                                    value={condicaoAprovacaoEmEdicao.saldoMetodo || 'cartao'}
                                    onChange={(e) => {
                                      const upd: Partial<CondicaoPagamento> = { ...condicaoAprovacaoEmEdicao, saldoMetodo: e.target.value as any };
                                      upd.descricao = calcularDescricaoCondicao(upd, aprovandoOrcamento.total);
                                      setCondicaoAprovacaoEmEdicao(upd);
                                    }}
                                    className="w-full h-7 px-2 text-xs font-semibold rounded bg-background border border-border"
                                  >
                                    <option value="cartao">Cartão de Crédito</option>
                                    <option value="pix_parcelado">PIX</option>
                                    <option value="boleto">Boleto Bancário</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          )}

                          {condicaoAprovacaoEmEdicao.saldoTipoPrazo === 'parcelas' && (
                            <div className="grid grid-cols-2 gap-2 p-2 rounded bg-muted/30 border border-border/60">
                              <div className="space-y-1">
                                <Label className="text-[11px]">Parcelas do Saldo:</Label>
                                <select
                                  value={condicaoAprovacaoEmEdicao.saldoParcelas || 1}
                                  onChange={(e) => {
                                    const parc = Number(e.target.value) || 1;
                                    const upd: Partial<CondicaoPagamento> = {
                                      ...condicaoAprovacaoEmEdicao,
                                      saldoParcelas: parc,
                                      saldoValorParcela: Number((saldoAtual / parc).toFixed(2)),
                                    };
                                    upd.descricao = calcularDescricaoCondicao(upd, aprovandoOrcamento.total);
                                    setCondicaoAprovacaoEmEdicao(upd);
                                  }}
                                  className="w-full h-7 px-2 text-xs font-semibold rounded bg-background border border-border"
                                >
                                  {[1, 2, 3, 4, 5, 6, 8, 10, 12, 18].map((n) => (
                                    <option key={n} value={n}>
                                      {n === 1 ? '1x à vista' : `${n}x de ${formatMoney(saldoAtual / n)}`}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px]">Forma do Saldo:</Label>
                                <select
                                  value={condicaoAprovacaoEmEdicao.saldoMetodo || 'cartao'}
                                  onChange={(e) => {
                                    const upd: Partial<CondicaoPagamento> = { ...condicaoAprovacaoEmEdicao, saldoMetodo: e.target.value as any };
                                    upd.descricao = calcularDescricaoCondicao(upd, aprovandoOrcamento.total);
                                    setCondicaoAprovacaoEmEdicao(upd);
                                  }}
                                  className="w-full h-7 px-2 text-xs font-semibold rounded bg-background border border-border"
                                >
                                  <option value="cartao">Cartão de Crédito</option>
                                  <option value="pix_parcelado">PIX Parcelado</option>
                                  <option value="boleto">Boleto Bancário</option>
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {condicaoAprovacaoEmEdicao.tipo === 'pix_parcelado' && (() => {
                    const vTot = typeof condicaoAprovacaoEmEdicao.valorTotal === 'number' && condicaoAprovacaoEmEdicao.valorTotal > 0
                      ? condicaoAprovacaoEmEdicao.valorTotal
                      : aprovandoOrcamento.total;
                    const ent = condicaoAprovacaoEmEdicao.valorEntrada || 0;
                    const saldo = Math.max(0, vTot - ent);
                    return (
                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded bg-background border border-border text-xs">
                        <div className="space-y-1">
                          <Label className="text-[11px]">Parcelas no PIX:</Label>
                          <select
                            value={condicaoAprovacaoEmEdicao.parcelas || 3}
                            onChange={(e) => {
                              const p = Number(e.target.value) || 3;
                              const upd = {
                                ...condicaoAprovacaoEmEdicao,
                                parcelas: p,
                                valorParcela: Number((saldo / p).toFixed(2)),
                              };
                              upd.descricao = calcularDescricaoCondicao(upd, aprovandoOrcamento.total);
                              setCondicaoAprovacaoEmEdicao(upd);
                            }}
                            className="w-full h-7 px-2 text-xs font-semibold rounded bg-background border border-border"
                          >
                            {[2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                              <option key={n} value={n}>
                                {n}x de {formatMoney(saldo / n)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Vencimento:</Label>
                          <select
                            value={condicaoAprovacaoEmEdicao.diaVencimento || 10}
                            onChange={(e) => {
                              const d = Number(e.target.value) || 10;
                              const upd = { ...condicaoAprovacaoEmEdicao, diaVencimento: d };
                              upd.descricao = calcularDescricaoCondicao(upd, aprovandoOrcamento.total);
                              setCondicaoAprovacaoEmEdicao(upd);
                            }}
                            className="w-full h-7 px-2 text-xs font-semibold rounded bg-background border border-border"
                          >
                            {[1, 5, 10, 15, 20, 25, 28, 30].map((d) => (
                              <option key={d} value={d}>
                                Todo dia {d}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Bloco de Ajuste de Datas e Situação de Pagamento */}
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        Ajuste de Datas e Situação de Pagamento (Contrato & Caixa)
                      </Label>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        Define vencimentos e status no contrato e financeiro
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Entrada / À Vista */}
                      {(condicaoAprovacaoEmEdicao.tipo === 'entrada_saldo' ||
                        condicaoAprovacaoEmEdicao.tipo === 'a_vista' ||
                        (condicaoAprovacaoEmEdicao.valorEntrada && condicaoAprovacaoEmEdicao.valorEntrada > 0) ||
                        condicaoAprovacaoEmEdicao.tipo === 'personalizado') && (
                        <div className="p-2.5 rounded-lg bg-background border border-border/70 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                              {condicaoAprovacaoEmEdicao.tipo === 'a_vista' ? 'Pagamento À Vista' : 'Entrada (Sinal)'}
                            </span>
                            {condicaoAprovacaoEmEdicao.situacaoEntrada === 'Quitada' ? (
                              <Badge className="bg-emerald-600 text-white text-[9px] px-1.5 py-0 h-4">
                                ✓ Quitada no Caixa
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-500/40 text-[9px] px-1.5 py-0 h-4">
                                A Vencer / Pendente
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground font-medium">Data do Pagamento:</Label>
                              <Input
                                type="date"
                                value={condicaoAprovacaoEmEdicao.dataEntrada || formatIsoDate(new Date())}
                                onChange={(e) => {
                                  const upd = { ...condicaoAprovacaoEmEdicao, dataEntrada: e.target.value };
                                  upd.descricao = calcularDescricaoCondicao(upd, aprovandoOrcamento.total);
                                  setCondicaoAprovacaoEmEdicao(upd);
                                }}
                                className="h-7 text-xs font-semibold"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground font-medium">Situação:</Label>
                              <select
                                value={condicaoAprovacaoEmEdicao.situacaoEntrada || 'Quitada'}
                                onChange={(e) => {
                                  const upd = { ...condicaoAprovacaoEmEdicao, situacaoEntrada: e.target.value as any };
                                  upd.descricao = calcularDescricaoCondicao(upd, aprovandoOrcamento.total);
                                  setCondicaoAprovacaoEmEdicao(upd);
                                }}
                                className="w-full h-7 px-1.5 text-xs font-semibold rounded bg-background border border-border"
                              >
                                <option value="Quitada">Quitada (Recebida agora)</option>
                                <option value="A vencer">A vencer (Pendente / A receber)</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Saldo / Parcelas / Cartão */}
                      {(condicaoAprovacaoEmEdicao.tipo === 'cartao' ||
                        condicaoAprovacaoEmEdicao.tipo === 'entrada_saldo' ||
                        condicaoAprovacaoEmEdicao.tipo === 'pix_parcelado' ||
                        condicaoAprovacaoEmEdicao.tipo === 'boleto' ||
                        condicaoAprovacaoEmEdicao.tipo === 'personalizado') && (
                        <div className="p-2.5 rounded-lg bg-background border border-border/70 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-primary">
                              {condicaoAprovacaoEmEdicao.tipo === 'cartao' ? 'Cartão / Parcelamento' : 'Saldo Restante / Parcelas'}
                            </span>
                            <Badge variant="outline" className="text-primary border-primary/40 text-[9px] px-1.5 py-0 h-4">
                              {condicaoAprovacaoEmEdicao.situacaoSaldo || 'A vencer'}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground font-medium">
                                {condicaoAprovacaoEmEdicao.tipo === 'entrada_saldo' && condicaoAprovacaoEmEdicao.saldoTipoPrazo === 'dias'
                                  ? 'Data Vencimento Saldo:'
                                  : 'Data 1º Vencimento:'}
                              </Label>
                              <Input
                                type="date"
                                value={condicaoAprovacaoEmEdicao.dataPrimeiroVencimento || formatIsoDate(somarMesesSeguro(new Date(), 1))}
                                onChange={(e) => {
                                  const upd = { ...condicaoAprovacaoEmEdicao, dataPrimeiroVencimento: e.target.value };
                                  upd.descricao = calcularDescricaoCondicao(upd, aprovandoOrcamento.total);
                                  setCondicaoAprovacaoEmEdicao(upd);
                                }}
                                className="h-7 text-xs font-semibold"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground font-medium">Situação do Saldo:</Label>
                              <select
                                value={condicaoAprovacaoEmEdicao.situacaoSaldo || (condicaoAprovacaoEmEdicao.tipo === 'cartao' ? 'Autorizado' : 'A vencer')}
                                onChange={(e) => {
                                  const upd = { ...condicaoAprovacaoEmEdicao, situacaoSaldo: e.target.value as any };
                                  upd.descricao = calcularDescricaoCondicao(upd, aprovandoOrcamento.total);
                                  setCondicaoAprovacaoEmEdicao(upd);
                                }}
                                className="w-full h-7 px-1.5 text-xs font-semibold rounded bg-background border border-border"
                              >
                                <option value="A vencer">A vencer no prazo</option>
                                <option value="Quitado">Quitado antecipado</option>
                                <option value="Autorizado">Autorizado na máquina</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Visão Interna da Clínica — Desconto das Taxas do Cartão */}
                  <CardSimulacaoTaxasCartao
                    condicao={condicaoAprovacaoEmEdicao}
                    totalBase={aprovandoOrcamento.total}
                    operadoraIdSelecionada={condicaoAprovacaoEmEdicao.operadoraCartaoId}
                    onAlterarOperadora={(opId) =>
                      setCondicaoAprovacaoEmEdicao((prev) => (prev ? { ...prev, operadoraCartaoId: opId } : null))
                    }
                  />

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <Label className="text-[11px] font-semibold">Texto da Condição Fechada:</Label>
                      <button
                        type="button"
                        onClick={() => {
                          const desc = calcularDescricaoCondicao(condicaoAprovacaoEmEdicao, aprovandoOrcamento.total);
                          setCondicaoAprovacaoEmEdicao((prev) => ({ ...prev, descricao: desc }));
                          toast.info('Texto recalculado!');
                        }}
                        className="text-[10px] text-primary hover:underline font-medium"
                      >
                        Recalcular texto
                      </button>
                    </div>
                    <Textarea
                      rows={2}
                      value={condicaoAprovacaoEmEdicao.descricao || ''}
                      onChange={(e) => setCondicaoAprovacaoEmEdicao((prev) => ({ ...prev, descricao: e.target.value }))}
                      className="text-xs"
                      placeholder="Descrição dos pagamentos..."
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setFlexibilizandoAprovacao(false)}
                    >
                      Cancelar Ajuste
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-xs font-bold"
                      onClick={() => {
                        if (!condicaoAprovacaoEmEdicao.titulo?.trim()) {
                          toast.error('Informe um título');
                          return;
                        }
                        const finalCond: CondicaoPagamento = {
                          id: condicaoAprovacaoEmEdicao.id || String(Date.now()),
                          titulo: condicaoAprovacaoEmEdicao.titulo.trim(),
                          tipo: condicaoAprovacaoEmEdicao.tipo || 'personalizado',
                          descontoPercentual: condicaoAprovacaoEmEdicao.descontoPercentual,
                          descontoValor: condicaoAprovacaoEmEdicao.descontoValor,
                          valorTotal: condicaoAprovacaoEmEdicao.valorTotal || aprovandoOrcamento.total,
                          parcelas: condicaoAprovacaoEmEdicao.parcelas,
                          valorParcela: condicaoAprovacaoEmEdicao.valorParcela,
                          valorEntrada: condicaoAprovacaoEmEdicao.valorEntrada,
                          metodoEntrada: condicaoAprovacaoEmEdicao.metodoEntrada,
                          saldoTipoPrazo: condicaoAprovacaoEmEdicao.saldoTipoPrazo,
                          saldoPrazoDias: condicaoAprovacaoEmEdicao.saldoPrazoDias,
                          saldoParcelas: condicaoAprovacaoEmEdicao.saldoParcelas,
                          saldoMetodo: condicaoAprovacaoEmEdicao.saldoMetodo,
                          saldoValorParcela: condicaoAprovacaoEmEdicao.saldoValorParcela,
                          diaVencimento: condicaoAprovacaoEmEdicao.diaVencimento,
                          tipoCartao: condicaoAprovacaoEmEdicao.tipoCartao,
                          dataEntrada: condicaoAprovacaoEmEdicao.dataEntrada,
                          situacaoEntrada: condicaoAprovacaoEmEdicao.situacaoEntrada,
                          dataPrimeiroVencimento: condicaoAprovacaoEmEdicao.dataPrimeiroVencimento,
                          situacaoSaldo: condicaoAprovacaoEmEdicao.situacaoSaldo,
                          descricao: condicaoAprovacaoEmEdicao.descricao?.trim() || calcularDescricaoCondicao(condicaoAprovacaoEmEdicao, aprovandoOrcamento.total),
                          destaque: true,
                          selecionada: true,
                        };

                        setCondicoesAprovacao((prev) => {
                          const idx = prev.findIndex((c) => c.id === finalCond.id);
                          if (idx >= 0) {
                            const cpy = [...prev];
                            cpy[idx] = finalCond;
                            return cpy;
                          }
                          return [...prev, finalCond];
                        });
                        setCondicaoEscolhidaAprovacaoId(finalCond.id);
                        setFlexibilizandoAprovacao(false);
                        toast.success('Condição atualizada para aprovação!');
                      }}
                    >
                      Aplicar Ajuste da Condição
                    </Button>
                  </div>
                </div>
              )}

              {/* Etapa 2: Lançamento Financeiro */}
              <div className="rounded-xl bg-muted/40 p-3 border border-border text-xs space-y-2">
                <div className="text-muted-foreground">
                  Deseja lançar no <strong>Contas a Receber (Financeiro)</strong> para monitoramento de receitas, taxas de máquina e extrato do paciente?
                </div>
                <label className="flex items-center gap-2 pt-2 border-t border-border/70 text-xs font-semibold text-emerald-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={darBaixaImediataAprovacao}
                    onChange={(e) => setDarBaixaImediataAprovacao(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>Dar baixa imediata apenas na entrada recebida agora (se for a receber ou passar cartão, deixe desmarcado)</span>
                </label>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t border-border/70">
              <Button
                variant="outline"
                size="sm"
                disabled={lancandoFinanceiro}
                onClick={() => setAprovandoOrcamento(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={lancandoFinanceiro}
                onClick={() => prepararEConfirmarAprovacao(false, false)}
              >
                Apenas Aprovar
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={lancandoFinanceiro}
                onClick={() => prepararEConfirmarAprovacao(true, false)}
                className="border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
              >
                {lancandoFinanceiro ? 'Lançando...' : 'Aprovar + Financeiro'}
              </Button>
              <Button
                size="sm"
                disabled={lancandoFinanceiro}
                onClick={() => prepararEConfirmarAprovacao(true, true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 shadow-sm"
              >
                <FileSignature className="h-4 w-4" />
                ✓ Aprovar e Gerar Contrato
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {/* Modal para Adicionar / Editar Condição de Pagamento do Orçamento */}
      <Dialog open={modalEdicaoCondicaoOpen} onOpenChange={(open) => !open && setModalEdicaoCondicaoOpen(false)}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-5 w-5 text-primary" />
              {condicaoEmEdicao?.id && condicoesNegociacao.some((c) => c.id === condicaoEmEdicao.id)
                ? 'Editar Condição de Pagamento'
                : 'Nova Condição de Pagamento'}
            </DialogTitle>
          </DialogHeader>

          {condicaoEmEdicao && (
            <div className="space-y-3.5 py-1">
              {/* Templates Rápidos de Condição */}
              <div className="space-y-1 p-2 rounded-xl bg-muted/40 border border-border/70">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                  Modelos Prontos de Condição:
                </span>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => aplicarPresetCondicao('a_vista_10', total, setCondicaoEmEdicao)}
                    className="px-2 py-0.5 rounded text-[10px] bg-background border border-border hover:border-primary font-semibold"
                  >
                    À Vista (10% OFF)
                  </button>
                  <button
                    type="button"
                    onClick={() => aplicarPresetCondicao('entrada_50_30dias', total, setCondicaoEmEdicao)}
                    className="px-2 py-0.5 rounded text-[10px] bg-background border border-border hover:border-primary font-semibold text-emerald-600"
                  >
                    Entrada 50% + Saldo 30 dias
                  </button>
                  <button
                    type="button"
                    onClick={() => aplicarPresetCondicao('entrada_30_6x', total, setCondicaoEmEdicao)}
                    className="px-2 py-0.5 rounded text-[10px] bg-background border border-border hover:border-primary font-semibold"
                  >
                    Entrada 30% + Saldo 6x
                  </button>
                  <button
                    type="button"
                    onClick={() => aplicarPresetCondicao('cartao_10x', total, setCondicaoEmEdicao)}
                    className="px-2 py-0.5 rounded text-[10px] bg-background border border-border hover:border-primary font-semibold"
                  >
                    Cartão 10x
                  </button>
                  <button
                    type="button"
                    onClick={() => aplicarPresetCondicao('pix_parcelado', total, setCondicaoEmEdicao)}
                    className="px-2 py-0.5 rounded text-[10px] bg-background border border-border hover:border-primary font-semibold"
                  >
                    PIX Parcelado
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Título da Opção Comercial:</Label>
                <Input
                  value={condicaoEmEdicao.titulo || ''}
                  onChange={(e) => setCondicaoEmEdicao((prev) => ({ ...prev, titulo: e.target.value }))}
                  placeholder="Ex.: Opção 1: À Vista Especial (10% OFF)"
                  className="text-xs font-semibold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Modelo da Condição:</Label>
                <select
                  value={condicaoEmEdicao.tipo || 'personalizado'}
                  onChange={(e) => {
                    const t = e.target.value as any;
                    const updated: Partial<CondicaoPagamento> = {
                      ...condicaoEmEdicao,
                      tipo: t,
                    };
                    if (t === 'a_vista') {
                      updated.descontoPercentual = updated.descontoPercentual ?? 10;
                      updated.descontoValor = Number(((total * (updated.descontoPercentual || 10)) / 100).toFixed(2));
                      updated.valorTotal = Math.max(0, total - (updated.descontoValor || 0));
                    } else if (t === 'cartao') {
                      updated.parcelas = updated.parcelas || 10;
                      updated.valorTotal = total;
                      updated.valorParcela = Number((total / (updated.parcelas || 10)).toFixed(2));
                      updated.tipoCartao = 'credito';
                    } else if (t === 'entrada_saldo') {
                      updated.valorEntrada = updated.valorEntrada ?? Number((total * 0.5).toFixed(2));
                      updated.metodoEntrada = updated.metodoEntrada || 'pix';
                      updated.saldoTipoPrazo = updated.saldoTipoPrazo || 'dias';
                      updated.saldoPrazoDias = updated.saldoPrazoDias || 30;
                      updated.saldoParcelas = updated.saldoParcelas || 1;
                      updated.saldoMetodo = updated.saldoMetodo || 'cartao';
                      const s = Math.max(0, total - (updated.valorEntrada || 0));
                      updated.saldoValorParcela = s;
                      updated.valorTotal = total;
                    } else if (t === 'pix_parcelado') {
                      updated.parcelas = updated.parcelas || 4;
                      updated.diaVencimento = updated.diaVencimento || 10;
                      updated.valorTotal = total;
                      updated.valorParcela = Number((total / (updated.parcelas || 4)).toFixed(2));
                    } else if (t === 'personalizado') {
                      if (!updated.formasCompostas || updated.formasCompostas.length === 0) {
                        updated.formasCompostas = parseTextoParaFormasCompostas(updated.descricao || '', total);
                      }
                    }
                    updated.descricao = calcularDescricaoCondicao(updated, total);
                    setCondicaoEmEdicao(updated);
                  }}
                  className="w-full h-9 px-3 text-xs font-semibold rounded-md bg-background border border-border"
                >
                  <option value="a_vista">À Vista (PIX / Transferência com ou sem Desconto)</option>
                  <option value="cartao">Cartão de Crédito / Débito (Parcelamento)</option>
                  <option value="entrada_saldo">Entrada Facilitada + Saldo (em Dias ou Parcelas)</option>
                  <option value="pix_parcelado">PIX Parcelado (Sem Cartão)</option>
                  <option value="boleto">Boleto Bancário</option>
                  <option value="personalizado">Personalizado (Composição com Todas as Formas)</option>
                </select>
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

              {/* Detalhes de À Vista */}
              {condicaoEmEdicao.tipo === 'a_vista' && (
                <div className="p-3 rounded-xl bg-muted/40 border border-border/70 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-semibold">Desconto Especial:</Label>
                    <div className="flex gap-1">
                      {[5, 10, 15].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            const descVal = Number(((total * p) / 100).toFixed(2));
                            const updated: Partial<CondicaoPagamento> = {
                              ...condicaoEmEdicao,
                              descontoPercentual: p,
                              descontoValor: descVal,
                              valorTotal: Math.max(0, total - descVal),
                            };
                            updated.descricao = calcularDescricaoCondicao(updated, total);
                            setCondicaoEmEdicao(updated);
                          }}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-background border border-border hover:border-primary font-semibold"
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">% Desconto:</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={condicaoEmEdicao.descontoPercentual ?? ''}
                        onChange={(e) => {
                          const p = Number(e.target.value) || 0;
                          const descVal = Number(((total * p) / 100).toFixed(2));
                          const updated: Partial<CondicaoPagamento> = {
                            ...condicaoEmEdicao,
                            descontoPercentual: p,
                            descontoValor: descVal,
                            valorTotal: Math.max(0, total - descVal),
                          };
                          updated.descricao = calcularDescricaoCondicao(updated, total);
                          setCondicaoEmEdicao(updated);
                        }}
                        className="h-8 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Valor Final (R$):</Label>
                      <div className="h-8 px-2.5 flex items-center rounded-md bg-background border border-border font-bold text-xs text-emerald-600">
                        {formatMoney(condicaoEmEdicao.valorTotal || total)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Detalhes de Cartão */}
              {condicaoEmEdicao.tipo === 'cartao' && (() => {
                const vTotal = typeof condicaoEmEdicao.valorTotal === 'number' && condicaoEmEdicao.valorTotal > 0 ? condicaoEmEdicao.valorTotal : total;
                return (
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/70 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Qtd. Parcelas:</Label>
                        <select
                          value={condicaoEmEdicao.parcelas || 1}
                          onChange={(e) => {
                            const p = Number(e.target.value) || 1;
                            const updated: Partial<CondicaoPagamento> = {
                              ...condicaoEmEdicao,
                              parcelas: p,
                              valorParcela: Number((vTotal / p).toFixed(2)),
                            };
                            updated.descricao = calcularDescricaoCondicao(updated, total);
                            setCondicaoEmEdicao(updated);
                          }}
                          className="w-full h-8 px-2 text-xs font-semibold rounded-md bg-background border border-border"
                        >
                          {[1, 2, 3, 4, 5, 6, 8, 10, 12, 18].map((n) => (
                            <option key={n} value={n}>
                              {n === 1 ? '1x (À vista)' : `${n}x de ${formatMoney(vTotal / n)}`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Tipo Cartão:</Label>
                        <select
                          value={condicaoEmEdicao.tipoCartao || 'credito'}
                          onChange={(e) => {
                            const tc = e.target.value as 'credito' | 'debito';
                            const updated: Partial<CondicaoPagamento> = {
                              ...condicaoEmEdicao,
                              tipoCartao: tc,
                              parcelas: tc === 'debito' ? 1 : condicaoEmEdicao.parcelas || 1,
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
                );
              })()}

              {/* Detalhes de Entrada + Saldo */}
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
                            const ent = Number(e.target.value) || 0;
                            const saldo = Math.max(0, vTotal - ent);
                            const updated: Partial<CondicaoPagamento> = {
                              ...condicaoEmEdicao,
                              valorEntrada: ent,
                              saldoValorParcela: Number((saldo / parcAtual).toFixed(2)),
                            };
                            updated.descricao = calcularDescricaoCondicao(updated, total);
                            setCondicaoEmEdicao(updated);
                          }}
                          className="h-8 text-xs font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Meio da Entrada:</Label>
                        <select
                        value={condicaoEmEdicao.metodoEntrada || 'pix'}
                        onChange={(e) => {
                          const me = e.target.value as any;
                          const updated: Partial<CondicaoPagamento> = {
                            ...condicaoEmEdicao,
                            metodoEntrada: me,
                          };
                          updated.descricao = calcularDescricaoCondicao(updated, total);
                          setCondicaoEmEdicao(updated);
                        }}
                        className="w-full h-8 px-2 text-xs font-semibold rounded-md bg-background border border-border"
                      >
                        <option value="pix">PIX</option>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="cartao_debito">Débito</option>
                        <option value="cartao_credito">Crédito</option>
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
                      const vTotal = typeof condicaoEmEdicao.valorTotal === 'number' && condicaoEmEdicao.valorTotal > 0 ? condicaoEmEdicao.valorTotal : total;
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

              {/* Detalhes de PIX Parcelado */}
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

              {/* Bloco de Ajuste de Datas e Situação de Pagamento */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Datas e Situação de Pagamento (Contrato & Caixa)
                  </Label>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    Opcional: defina datas e situações
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Entrada / À Vista */}
                  {(condicaoEmEdicao.tipo === 'entrada_saldo' ||
                    condicaoEmEdicao.tipo === 'a_vista' ||
                    (condicaoEmEdicao.valorEntrada && condicaoEmEdicao.valorEntrada > 0) ||
                    condicaoEmEdicao.tipo === 'personalizado') && (
                    <div className="p-2.5 rounded-lg bg-background border border-border/70 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          {condicaoEmEdicao.tipo === 'a_vista' ? 'Pagamento À Vista' : 'Entrada (Sinal)'}
                        </span>
                        {condicaoEmEdicao.situacaoEntrada === 'Quitada' ? (
                          <Badge className="bg-emerald-600 text-white text-[9px] px-1.5 py-0 h-4">
                            ✓ Quitada no Caixa
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-500/40 text-[9px] px-1.5 py-0 h-4">
                            A Vencer / Pendente
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground font-medium">Data do Pagamento:</Label>
                          <Input
                            type="date"
                            value={condicaoEmEdicao.dataEntrada || formatIsoDate(new Date())}
                            onChange={(e) => {
                              const upd = { ...condicaoEmEdicao, dataEntrada: e.target.value };
                              upd.descricao = calcularDescricaoCondicao(upd, total);
                              setCondicaoEmEdicao(upd);
                            }}
                            className="h-7 text-xs font-semibold"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground font-medium">Situação:</Label>
                          <select
                            value={condicaoEmEdicao.situacaoEntrada || 'Quitada'}
                            onChange={(e) => {
                              const upd = { ...condicaoEmEdicao, situacaoEntrada: e.target.value as any };
                              upd.descricao = calcularDescricaoCondicao(upd, total);
                              setCondicaoEmEdicao(upd);
                            }}
                            className="w-full h-7 px-1.5 text-xs font-semibold rounded bg-background border border-border"
                          >
                            <option value="Quitada">Quitada (Recebida agora)</option>
                            <option value="A vencer">A vencer (Pendente / A receber)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Saldo / Parcelas / Cartão */}
                  {(condicaoEmEdicao.tipo === 'cartao' ||
                    condicaoEmEdicao.tipo === 'entrada_saldo' ||
                    condicaoEmEdicao.tipo === 'pix_parcelado' ||
                    condicaoEmEdicao.tipo === 'boleto' ||
                    condicaoEmEdicao.tipo === 'personalizado') && (
                    <div className="p-2.5 rounded-lg bg-background border border-border/70 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-primary">
                          {condicaoEmEdicao.tipo === 'cartao' ? 'Cartão / Parcelamento' : 'Saldo Restante / Parcelas'}
                        </span>
                        <Badge variant="outline" className="text-primary border-primary/40 text-[9px] px-1.5 py-0 h-4">
                          {condicaoEmEdicao.situacaoSaldo || 'A vencer'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground font-medium">
                            {condicaoEmEdicao.tipo === 'entrada_saldo' && condicaoEmEdicao.saldoTipoPrazo === 'dias'
                              ? 'Data Vencimento Saldo:'
                              : 'Data 1º Vencimento:'}
                          </Label>
                          <Input
                            type="date"
                            value={condicaoEmEdicao.dataPrimeiroVencimento || formatIsoDate(somarMesesSeguro(new Date(), 1))}
                            onChange={(e) => {
                              const upd = { ...condicaoEmEdicao, dataPrimeiroVencimento: e.target.value };
                              upd.descricao = calcularDescricaoCondicao(upd, total);
                              setCondicaoEmEdicao(upd);
                            }}
                            className="h-7 text-xs font-semibold"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground font-medium">Situação do Saldo:</Label>
                          <select
                            value={condicaoEmEdicao.situacaoSaldo || (condicaoEmEdicao.tipo === 'cartao' ? 'Autorizado' : 'A vencer')}
                            onChange={(e) => {
                              const upd = { ...condicaoEmEdicao, situacaoSaldo: e.target.value as any };
                              upd.descricao = calcularDescricaoCondicao(upd, total);
                              setCondicaoEmEdicao(upd);
                            }}
                            className="w-full h-7 px-1.5 text-xs font-semibold rounded bg-background border border-border"
                          >
                            <option value="A vencer">A vencer no prazo</option>
                            <option value="Quitado">Quitado antecipado</option>
                            <option value="Autorizado">Autorizado na máquina</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

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
                  <span>Marcar como <strong>"★ Mais Escolhida / Recomendada"</strong></span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={!!condicaoEmEdicao.selecionada}
                    onChange={(e) => setCondicaoEmEdicao((prev) => ({ ...prev, selecionada: e.target.checked }))}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span>Definir como <strong>Opção Padrão</strong></span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setModalEdicaoCondicaoOpen(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSalvarCondicaoEmEdicaoOrcamento} className="font-bold">
                  Salvar Condição
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL: Visualizar Detalhes das Solicitações de Ajuste */}
      <Dialog open={modalDetalhesAjusteOpen} onOpenChange={setModalDetalhesAjusteOpen}>
        <DialogContent className="max-w-lg w-full p-5 space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Eye className="h-5 w-5 text-amber-600" />
              Solicitações de Ajuste do Paciente
            </DialogTitle>
          </DialogHeader>

          {orcamentoVisualizandoAjuste && (
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-muted/60 border border-border/80 flex justify-between items-center">
                <div>
                  <span className="font-bold text-foreground text-sm block">
                    {orcamentoVisualizandoAjuste.titulo}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Ref: #{orcamentoVisualizandoAjuste.identificador || orcamentoVisualizandoAjuste.id.slice(0, 8).toUpperCase()} • Versão Atual: {orcamentoVisualizandoAjuste.versao || 1}
                  </span>
                </div>
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  {orcamentoVisualizandoAjuste.status}
                </Badge>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {(orcamentoVisualizandoAjuste.solicitacoesAjuste || []).length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Nenhuma solicitação registrada.</p>
                ) : (
                  (orcamentoVisualizandoAjuste.solicitacoesAjuste || []).map((sol: any, idx: number) => (
                    <div key={sol.id || idx} className="p-3 rounded-xl border border-border/70 bg-card space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                          Versão {sol.versaoOrcamento || 1}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {sol.solicitadaEm ? new Date(sol.solicitadaEm).toLocaleString('pt-BR') : ''}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground font-semibold">Motivo:</span>{' '}
                        <strong className="text-foreground">{sol.motivo}</strong>
                      </div>
                      {sol.mensagem && (
                        <div className="p-2 rounded bg-muted/40 text-foreground italic border-l-2 border-primary/40">
                          "{sol.mensagem}"
                        </div>
                      )}
                      <div className="pt-1 flex items-center justify-between text-[10px]">
                        <span className={sol.atendida ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                          {sol.atendida ? '✓ Atendida em nova proposta' : '⏳ Aguardando revisão da clínica'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const ult = (orcamentoVisualizandoAjuste.solicitacoesAjuste || [])[orcamentoVisualizandoAjuste.solicitacoesAjuste!.length - 1];
                    const tel = patient?.telefone || patient?.whatsapp || '';
                    const primNome = patient?.nome ? patient.nome.split(' ')[0] : 'Olá';
                    const ref = orcamentoVisualizandoAjuste.identificador || `ORC-${orcamentoVisualizandoAjuste.id.slice(0, 8).toUpperCase()}`;
                    const msg = `Olá, ${primNome}! Recebemos seu pedido de ajuste no orçamento ${ref}. Gostaria de entender mais detalhadamente o que você prefere.`;
                    openWhatsApp(tel, msg);
                  }}
                  className="text-xs text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-300 gap-1"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Falar no WhatsApp
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setModalDetalhesAjusteOpen(false);
                    updateStatus(orcamentoVisualizandoAjuste.id, 'em_revisao');
                    abrirEdicao(orcamentoVisualizandoAjuste);
                  }}
                  className="text-xs gap-1"
                >
                  <Pencil className="h-3.5 w-3.5" /> Revisar Orçamento
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL: Enviar Nova Proposta Rápida */}
      <Dialog open={modalEnviarNovaPropostaOpen} onOpenChange={setModalEnviarNovaPropostaOpen}>
        <DialogContent className="max-w-md w-full p-5 space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Sparkles className="h-5 w-5 text-indigo-600" />
              Enviar Nova Versão da Proposta
            </DialogTitle>
          </DialogHeader>

          {orcamentoParaNovaProposta && (
            <div className="space-y-3 text-xs">
              <p className="text-muted-foreground leading-relaxed">
                Esta ação gerará a <strong>Versão {(orcamentoParaNovaProposta.versao || 1) + 1}</strong> deste orçamento. O histórico da versão atual será arquivado e o paciente poderá aprovar as novas condições diretamente no <strong>mesmo link</strong> oficial já compartilhado.
              </p>

              <div className="p-3 rounded-xl bg-muted/60 border border-border/80 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plano:</span>
                  <strong className="text-foreground">{orcamentoParaNovaProposta.titulo}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor Total Atual:</span>
                  <strong className="text-foreground font-mono">{formatMoney(orcamentoParaNovaProposta.total)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Versão:</span>
                  <Badge variant="outline">v{(orcamentoParaNovaProposta.versao || 1) + 1} (Nova)</Badge>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-950 dark:text-indigo-200 text-[11px]">
                Deseja alterar os procedimentos ou condições antes de enviar? Você pode abrir a tela de edição completa.
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-border">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setModalEnviarNovaPropostaOpen(false);
                    abrirEdicao(orcamentoParaNovaProposta);
                  }}
                  className="text-xs w-full sm:w-auto"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Editar Valores / Condições
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      setSalvandoNovaProposta(true);
                      const res = await enviarNovaPropostaOrcamento({
                        orcamentoId: orcamentoParaNovaProposta.id,
                        novosItens: orcamentoParaNovaProposta.itens,
                        novoDesconto: orcamentoParaNovaProposta.desconto,
                        novasFormasPagamento: orcamentoParaNovaProposta.formasPagamento,
                        usuarioNome: configuracoes?.dentistaResponsavel || 'Clínica',
                        motivoAjuste: 'Nova proposta comercial formalizada',
                      });
                      if (res.ok) {
                        toast.success(`Versão ${res.novaVersao} emitida com sucesso!`);
                        setModalEnviarNovaPropostaOpen(false);
                        if (reload) reload();

                        const tel = patient?.telefone || patient?.whatsapp || '';
                        if (tel) {
                          const primNome = patient?.nome ? patient.nome.split(' ')[0] : 'tudo bem';
                          const msg = `Olá, ${primNome}! Atualizamos sua proposta de tratamento com novas condições. Você pode conferir os detalhes e aprovar online através deste link seguro: ${res.link}`;
                          openWhatsApp(tel, msg);
                        }
                      } else {
                        toast.error(res.error || 'Erro ao emitir nova proposta.');
                      }
                    } catch (e: any) {
                      toast.error('Erro ao emitir nova versão');
                    } finally {
                      setSalvandoNovaProposta(false);
                    }
                  }}
                  disabled={salvandoNovaProposta}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow-sm w-full sm:w-auto"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Confirmar e Enviar v{(orcamentoParaNovaProposta.versao || 1) + 1}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default PatientOrcamentos;
