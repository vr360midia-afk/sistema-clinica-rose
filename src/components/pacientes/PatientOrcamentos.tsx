import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, Plus, Trash2, MessageCircle, Check, X, Handshake, FileText, Pencil, FileSignature, Sparkles, CalendarDays, Link as LinkIcon, Layers, CreditCard, Wallet, CheckCircle2, RefreshCw, Search, ChevronsUpDown, Calculator, Eye } from 'lucide-react';
import ModalApresentarOrcamento from '@/components/orcamentos/ModalApresentarOrcamento';
import { Switch } from '@/components/ui/switch';
import { useOrcamentos, OrcamentoItem, Orcamento } from '@/hooks/useOrcamentos';
import { useProcedimentos } from '@/hooks/useProcedimentos';
import { useParceiros, TipoRepasse } from '@/hooks/useParceiros';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useDentistas } from '@/hooks/useDentistas';
import { gerarOrcamentoPdf } from '@/utils/orcamentoPdf';
import { openWhatsApp } from '@/lib/whatsapp';
import { formatMoney } from '@/utils/exportCsv';
import { toast } from 'sonner';
import ContratoModal from '@/components/contratos/ContratoModal';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { mapearDadosContrato, gerarLinkAssinaturaContrato, parseBrMoney } from '@/utils/contratoEngine';
import { somarMesesSeguro } from '@/utils/documentoFormat';
import { downloadTcleLentesResinaPdf } from '@/utils/tcleLentesResina';
import { useMaquinasCartao, calcularTaxaCartao, extrairDetalhesCartaoDeTexto } from '@/hooks/useMaquinasCartao';
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
  const { orcamentos, loading, saveOrcamento, updateStatus, deleteOrcamento } = useOrcamentos(patient?.id);
  const { procedimentos } = useProcedimentos();
  const { parceiros, addParceiro, refetch: refetchParceiros } = useParceiros();
  const { configuracoes } = useConfiguracoes();
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
  const [selectKey, setSelectKey] = useState(0);
  const [statusEdicao, setStatusEdicao] = useState<'rascunho' | 'enviado' | 'aprovado' | 'recusado'>('rascunho');
  const [contratoModalOpen, setContratoModalOpen] = useState(false);
  const [contratoOrcamento, setContratoOrcamento] = useState<Orcamento | null>(null);
  const [apresentarOrcamento, setApresentarOrcamento] = useState<Orcamento | null>(null);

  // Aprovação com lançamento financeiro
  const [aprovandoOrcamento, setAprovandoOrcamento] = useState<Orcamento | null>(null);
  const [lancandoFinanceiro, setLancandoFinanceiro] = useState(false);
  const [darBaixaImediataAprovacao, setDarBaixaImediataAprovacao] = useState(false);

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

  const handleConfirmarAprovacao = async (o: Orcamento, lancarFinanceiro: boolean) => {
    try {
      setLancandoFinanceiro(true);
      await updateStatus(o.id, 'aprovado');
      if (updatePaciente && (patient?.id || o.pacienteId)) {
        try {
          await updatePaciente(patient?.id || o.pacienteId, { status: 'Em Tratamento' });
        } catch (errP) {
          console.error('Erro ao atualizar status do paciente para Em Tratamento:', errP);
        }
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
          patient: patient || { id: o.pacienteId, nome: o.pacienteNome },
          orcamento: o,
          transacoes: [],
          configuracoes,
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
          // 4. Só é considerado quitado imediatamente se:
          //    - Estiver expressamente marcado como quitado no descritivo ([Quitada], [Pago]), OU
          //    - O usuário marcou 'Dar Baixa Imediata' E for entrada em PIX/dinheiro (não-cartão).
          const isQuitada =
            !isACombinar && (
              isExplicitamenteQuitada ||
              (!isCartao && darBaixaImediataAprovacao && (isEntrada || isUnicaParcela))
            );
          
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
          if (p.vencimento && typeof p.vencimento === 'string') {
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
    } catch (err: any) {
      console.error('Erro ao aprovar orçamento:', err);
      toast.error('Erro ao aprovar orçamento ou lançar parcelas: ' + (err?.message || 'Verifique os dados.'));
    } finally {
      setLancandoFinanceiro(false);
      setAprovandoOrcamento(null);
    }
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
    await saveOrcamento({
      id: editingId || undefined,
      titulo,
      itens,
      desconto,
      observacoes,
      formasPagamento,
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


  const copiarLinkContrato = (o: (typeof orcamentos)[number]) => {
    const snap = mapearDadosContrato({
      patient,
      orcamento: o,
      configuracoes,
      dentistas,
      dadosRestauracoesPreexistentes: patient?.restauracoesPreexistentes,
    });
    const link = gerarLinkAssinaturaContrato(snap);
    navigator.clipboard.writeText(link);
    toast.success('Link de assinatura do contrato copiado com sucesso!', {
      description: 'Envie para o paciente assinar pelo celular.',
    });
  };

  const enviarWhatsApp = (o: (typeof orcamentos)[number]) => {
    if (!patient?.telefone) {
      toast.error('Paciente sem telefone cadastrado');
      return;
    }
    const linhas = [
      `*${o.titulo}*`,
      ...o.itens.map((i) => `• ${i.nome} ${i.quantidade > 1 ? `(${i.quantidade}x) ` : ''}— ${formatMoney(i.valor * i.quantidade)}`),
      o.desconto ? `Desconto: ${formatMoney(o.desconto)}` : null,
      `*Total: ${formatMoney(o.total)}*`,
      o.formasPagamento ? `Formas de pagamento: ${o.formasPagamento}` : null,
      o.observacoes || null,
    ];

    if (o?.status === 'aprovado') {
      const snap = mapearDadosContrato({
        patient,
        orcamento: o,
        configuracoes,
        dentistas,
        dadosRestauracoesPreexistentes: patient?.restauracoesPreexistentes,
      });
      const link = gerarLinkAssinaturaContrato(snap);
      linhas.push('');
      linhas.push(`✍️ *LINK PARA VISUALIZAR E ASSINAR O CONTRATO ONLINE:*`);
      linhas.push(`Clique no link abaixo pelo seu celular para ler o contrato e assinar digitalmente:`);
      linhas.push(`👉 ${link}`);

      // Baixa o PDF do orçamento automaticamente para facilitar o anexo se desejar
      try {
        baixarPdf(o);
      } catch (_) {}
    } else {
      linhas.push('');
      linhas.push('Podemos seguir com este plano de tratamento?');
    }

    openWhatsApp(patient.telefone, linhas.filter(Boolean).join('\n'));
    updateStatus(o.id, 'enviado');
    toast.info('Abrindo WhatsApp Web!', {
      description:
        o?.status === 'aprovado'
          ? 'Link de assinatura incluso na mensagem e PDF baixado para facilitar envio!'
          : 'Mensagem do orçamento pronta no WhatsApp.',
    });
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
          (orcamentos || []).filter(Boolean).map((o) => (
            <div key={o.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{o.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {(o.itens || []).length} procedimento(s) • {formatMoney(o.total || 0)}
                  </p>
                </div>
                <Badge
                  variant={o?.status === 'aprovado' ? 'default' : o?.status === 'recusado' ? 'destructive' : 'secondary'}
                  className="capitalize flex-shrink-0"
                >
                  {o?.status || 'rascunho'}
                </Badge>
              </div>
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
                {o.formasPagamento && (
                  <p className="text-muted-foreground pt-1">
                    Pagamento: <span className="text-foreground">{o.formasPagamento}</span>
                  </p>
                )}
              </div>

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
                <Button size="sm" variant="outline" onClick={() => enviarWhatsApp(o)}>
                  <MessageCircle className="h-4 w-4 mr-1" /> Enviar
                </Button>

                <Button
                  size="sm"
                  variant={o?.status === 'aprovado' ? 'default' : 'outline'}
                  className={o?.status === 'aprovado' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}
                  onClick={() => {
                    setContratoOrcamento(o);
                    setContratoModalOpen(true);
                  }}
                  title="Gerar contrato formal com base neste orçamento"
                >
                  <FileSignature className="h-4 w-4 mr-1" /> Contrato
                </Button>

                {o?.status === 'aprovado' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => copiarLinkContrato(o)}
                      title="Copiar link oficial para o paciente assinar digitalmente"
                    >
                      <LinkIcon className="h-4 w-4 mr-1" /> Copiar Link
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      onClick={() => setAprovandoOrcamento(o)}
                      title="Sincronizar ou relançar parcelas no Contas a Receber"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" /> Financeiro
                    </Button>
                  </>
                )}

                {o?.status !== 'aprovado' && o?.status !== 'recusado' && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setAprovandoOrcamento(o)}>
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
          ))
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Formas de pagamento</Label>
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

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
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

      {/* Diálogo de Aprovação com Lançamento Financeiro Opcional */}
      {aprovandoOrcamento && (
        <AlertDialog open={!!aprovandoOrcamento} onOpenChange={(open) => !open && setAprovandoOrcamento(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-emerald-600" />
                Aprovar Orçamento #{aprovandoOrcamento.id ? aprovandoOrcamento.id.slice(0, 8).toUpperCase() : ''}
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2 text-sm text-muted-foreground pt-1">
                <p>
                  O plano <strong>{aprovandoOrcamento.titulo}</strong> no valor total de{' '}
                  <strong className="text-foreground">{formatMoney(aprovandoOrcamento.total)}</strong> será aprovado.
                </p>
                <div className="rounded-md bg-muted/50 p-2.5 border border-border text-xs space-y-2">
                  <div><strong>Condição de Pagamento:</strong> {aprovandoOrcamento.formasPagamento || 'A combinar'}</div>
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
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel disabled={lancandoFinanceiro}>Cancelar</AlertDialogCancel>
              <Button
                variant="outline"
                disabled={lancandoFinanceiro}
                onClick={() => handleConfirmarAprovacao(aprovandoOrcamento, false)}
              >
                Apenas Aprovar
              </Button>
              <AlertDialogAction
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={lancandoFinanceiro}
                onClick={() => handleConfirmarAprovacao(aprovandoOrcamento, true)}
              >
                {lancandoFinanceiro ? 'Lançando...' : 'Sim, Lançar no Financeiro'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Card>
  );
};

export default PatientOrcamentos;
