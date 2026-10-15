import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, Plus, Trash2, MessageCircle, Check, X, Handshake, FileText, Pencil, FileSignature, Sparkles, CalendarDays, Link as LinkIcon, Layers, CreditCard, Wallet, CheckCircle2, RefreshCw } from 'lucide-react';
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
import { mapearDadosContrato, gerarLinkAssinaturaContrato, parseBrMoney } from '@/utils/contratoEngine';
import { somarMesesSeguro } from '@/utils/documentoFormat';
import { downloadTcleLentesResinaPdf } from '@/utils/tcleLentesResina';
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
  const { transacoes, addTransacao, deleteTransacao } = useDentalSystem();

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

  // Aprovação com lançamento financeiro
  const [aprovandoOrcamento, setAprovandoOrcamento] = useState<Orcamento | null>(null);
  const [lancandoFinanceiro, setLancandoFinanceiro] = useState(false);

  // PIX Parcelado
  const [pixParceladoAtivo, setPixParceladoAtivo] = useState(false);
  const [pixEntrada, setPixEntrada] = useState<number>(0);
  const [pixDataEntrada, setPixDataEntrada] = useState<string>(() => formatIsoDate(new Date()));
  const [pixEntradaSituacao, setPixEntradaSituacao] = useState<'A vencer' | 'Quitada'>('A vencer');
  const [pixParcelas, setPixParcelas] = useState<number>(3);
  const [pixDiaVencimento, setPixDiaVencimento] = useState<number>(10);
  const [pixDatasParcelas, setPixDatasParcelas] = useState<string[]>(() => gerarDatasPadrao(3, 10));
  const [pixSituacoesParcelas, setPixSituacoesParcelas] = useState<Array<'A vencer' | 'Quitada'>>(() => ['A vencer', 'A vencer', 'A vencer']);

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
    }>
  >(() => {
    const hoje = formatIsoDate(new Date());
    return [
      { id: '1', rotulo: 'Entrada', metodo: 'pix', valor: 0, parcelas: 1, diaVencimento: 10, dataPagamento: hoje, datasParcelas: [hoje], situacao: 'A vencer', situacoesParcelas: ['A vencer'] },
      { id: '2', rotulo: 'Restante', metodo: 'cartao', valor: 0, parcelas: 3, diaVencimento: 10, dataPagamento: hoje, datasParcelas: gerarDatasPadrao(3, 10), situacao: 'Autorizado', situacoesParcelas: ['Autorizado', 'Autorizado', 'Autorizado'] },
    ];
  });


  // Parceria
  const [parceriaAtiva, setParceriaAtiva] = useState(false);
  const [parceiroId, setParceiroId] = useState('');
  const [tipoRepasse, setTipoRepasse] = useState<TipoRepasse>('percentual');
  const [valorRepasse, setValorRepasse] = useState(0);
  const [novoParceiro, setNovoParceiro] = useState(false);
  const [novoNome, setNovoNome] = useState('');

  const subtotal = itens.reduce((s, i) => s + i.valor * i.quantidade, 0);
  const total = Math.max(0, subtotal - desconto);

  const montarTextoMultiplasFormas = (lista: typeof formasMultiplas) => {
    const partes: string[] = [];
    for (const f of lista) {
      if (!f.valor || f.valor <= 0) continue;
      const nomeMetodo =
        f.metodo === 'pix'
          ? 'PIX'
          : f.metodo === 'cartao'
          ? 'Cartão de Crédito'
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
        const valParc = (f.parcelas || 1) > 1 ? f.valor / f.parcelas : f.valor;
        if ((f.parcelas || 1) > 1) {
          partes.push(
            `${f.rotulo}: ${formatMoney(f.valor)} em ${f.parcelas}x de ${formatMoney(valParc)} no Cartão de Crédito${sitStr}`
          );
        } else {
          const dataStr = f.dataPagamento ? ` (em ${formatBrDate(f.dataPagamento)})` : '';
          partes.push(`${f.rotulo}: ${formatMoney(f.valor)} via Cartão de Crédito${dataStr}${sitStr}`);
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
        const dataStr = f.dataPagamento ? ` (em ${formatBrDate(f.dataPagamento)})` : '';
        partes.push(`${f.rotulo}: ${formatMoney(f.valor)} via ${nomeMetodo}${dataStr}${sitStr}`);
      }
    }
    return partes.join(' + ');
  };

  const handleToggleMultiplasFormas = () => {
    const novo = !multiplasFormasAtivo;
    setMultiplasFormasAtivo(novo);
    if (novo) {
      setPixParceladoAtivo(false);
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
        } else if (campos.metodo !== 'cartao' && atualizado.situacao === 'Autorizado') {
          atualizado.situacao = 'A vencer';
          atualizado.situacoesParcelas = Array.from({ length: atualizado.parcelas || 1 }, () => 'A vencer');
        }
      }

      // Se alterou o dia base de vencimento, regenera as datas padrão
      if (campos.diaVencimento !== undefined && campos.diaVencimento !== item.diaVencimento) {
        atualizado.datasParcelas = gerarDatasPadrao(atualizado.parcelas, campos.diaVencimento);
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

  const handleConfirmarAprovacao = async (o: Orcamento, lancarFinanceiro: boolean) => {
    try {
      setLancandoFinanceiro(true);
      await updateStatus(o.id, 'aprovado');

      if (lancarFinanceiro) {
        // Remove quaisquer transações existentes vinculadas a este orçamento para garantir sincronismo e evitar valores obsoletos ou duplicados
        const existentes = (transacoes || []).filter((t: any) => t.orcamentoId === o.id);
        for (const t of existentes) {
          try {
            await deleteTransacao(t.id);
          } catch (e) {
            console.error('Erro ao remover transação antiga:', e);
          }
        }

        const snap = mapearDadosContrato({
          patient,
          orcamento: o,
          transacoes: [],
          configuracoes,
        });

        const parcelas = snap.financeiro.parcelas;
        for (const p of parcelas) {
          const isEntrada = p.descricao.toLowerCase().includes('entrada');
          const isQuitada = (p.status || '').toLowerCase().includes('quitad') || (p.status || '').toLowerCase().includes('pago');
          
          let dataVenc: Date = new Date();
          if (p.vencimento && p.vencimento.includes('/')) {
            const [dia, mes, ano] = p.vencimento.split('/');
            dataVenc = new Date(Number(ano), Number(mes) - 1, Number(dia), 12, 0, 0);
          } else {
            const parcIdxMatch = (p.descricao || '').match(/\((\d+)\/\d+/);
            const mesOffset = parcIdxMatch ? Number(parcIdxMatch[1]) : (typeof p.numero === 'number' ? p.numero : 1);
            dataVenc = somarMesesSeguro(new Date(), mesOffset);
          }

          // Identifica o método específico desta parcela dinamicamente
          let metodoFinal: any = 'pix';
          const descLower = (p.metodo || p.descricao || '').toLowerCase();
          if (descLower.includes('cartao') || descLower.includes('cartão') || descLower.includes('crédito') || descLower.includes('debito')) {
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
          }

          await addTransacao({
            pacienteId: patient.id,
            valor: p.valor,
            tipo: 'receita',
            status: isQuitada ? 'pago' : 'pendente',
            metodoPagamento: metodoFinal,
            data: new Date(),
            vencimento: dataVenc,
            descricao: `${o.titulo}: ${p.descricao}`,
            categoria: 'Tratamentos',
            orcamentoId: o.id,
          });
        }
        toast.success('Orçamento aprovado e parcelas lançadas no Contas a Receber com as formas corretas!');
      } else {
        toast.success('Orçamento aprovado com sucesso!');
      }
    } catch (err: any) {
      console.error('Erro ao aprovar orçamento:', err);
      toast.error('Erro ao aprovar orçamento ou lançar parcelas');
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
      { id: '2', rotulo: 'Restante', metodo: 'cartao', valor: 0, parcelas: 3, diaVencimento: 10, dataPagamento: hojeIso, datasParcelas: gerarDatasPadrao(3, 10), situacao: 'Autorizado', situacoesParcelas: ['Autorizado', 'Autorizado', 'Autorizado'] },
    ]);
    setParceriaAtiva(false);
    setParceiroId('');
    setValorRepasse(0);
    setOpen(true);
  };

  const abrirEdicao = (o: (typeof orcamentos)[number]) => {
    setEditingId(o.id);
    setStatusEdicao(o.status);
    setTitulo(o.titulo);
    setItens(o.itens.map((i) => ({ ...i })));
    setDesconto(o.desconto || 0);
    setObservacoes(o.observacoes || '');
    setFormasPagamento(o.formasPagamento || '');

    // Verifica se possui múltiplas formas de pagamento (ex: Entrada PIX + Restante Cartão)
    if (
      o.formasPagamento &&
      (o.formasPagamento.includes('+') ||
        /entrada.*cart[aã]o/i.test(o.formasPagamento) ||
        /entrada.*via/i.test(o.formasPagamento))
    ) {
      setMultiplasFormasAtivo(true);
      setPixParceladoAtivo(false);
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
        });
      }

      if (formasCarregadas.length > 0) {
        setFormasMultiplas(formasCarregadas);
      }
    } else if (o.formasPagamento && /pix\s*parcelado/i.test(o.formasPagamento)) {
      setMultiplasFormasAtivo(false);
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

    if (o.status === 'aprovado') {
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
        o.status === 'aprovado'
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
          orcamentos.map((o) => (
            <div key={o.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{o.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.itens.length} procedimento(s) • {formatMoney(o.total)}
                  </p>
                </div>
                <Badge
                  variant={o.status === 'aprovado' ? 'default' : o.status === 'recusado' ? 'destructive' : 'secondary'}
                  className="capitalize flex-shrink-0"
                >
                  {o.status}
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
                {o.itens.map((i, idx) => (
                  <li key={idx}>
                    {i.nome} {i.quantidade > 1 ? `(${i.quantidade}x)` : ''} — {formatMoney(i.valor * i.quantidade)}
                  </li>
                ))}
              </ul>

              <div className="rounded-md bg-muted/40 p-2 space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatMoney(o.itens.reduce((s, i) => s + i.valor * i.quantidade, 0))}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Desconto</span>
                  <span>- {formatMoney(o.desconto || 0)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-foreground border-t border-border pt-1">
                  <span>Total</span>
                  <span>{formatMoney(o.total)}</span>
                </div>
                {o.formasPagamento && (
                  <p className="text-muted-foreground pt-1">
                    Pagamento: <span className="text-foreground">{o.formasPagamento}</span>
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
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
                  variant={o.status === 'aprovado' ? 'default' : 'outline'}
                  className={o.status === 'aprovado' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}
                  onClick={() => {
                    setContratoOrcamento(o);
                    setContratoModalOpen(true);
                  }}
                  title="Gerar contrato formal com base neste orçamento"
                >
                  <FileSignature className="h-4 w-4 mr-1" /> Contrato
                </Button>

                {o.status === 'aprovado' && (
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

                {o.status !== 'aprovado' && o.status !== 'recusado' && (
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
              <Label>Adicionar procedimento</Label>
              <Select key={selectKey} value="" onValueChange={addProcedimento}>
                <SelectTrigger><SelectValue placeholder="Selecione um procedimento" /></SelectTrigger>
                <SelectContent>
                  {procedimentos.filter((p) => p.ativo).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} — {formatMoney(p.preco)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Desconto (R$)</Label>
                <Input type="number" min={0} step="0.01" value={desconto} onChange={(e) => setDesconto(Number(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label>Total</Label>
                <Input value={formatMoney(total)} readOnly />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Formas de pagamento</Label>
                <div className="flex items-center gap-1.5">
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
                    Múltiplas Formas (Entrada + Cartão/Boleto)
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {['À vista (PIX)', 'PIX Parcelado', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', '2x sem juros', '3x sem juros', '6x', '12x', 'Boleto'].map((f) => {
                  const isPixParcelado = f === 'PIX Parcelado';
                  const isActive = isPixParcelado && pixParceladoAtivo;
                  return (
                    <Button
                      key={f}
                      type="button"
                      size="sm"
                      variant={isActive ? 'default' : 'outline'}
                      className={`h-7 text-xs ${isActive ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : ''}`}
                      onClick={() => {
                        if (isPixParcelado) {
                          handleTogglePixParcelado();
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
                                      <SelectItem value="cartao">Cartão de Crédito</SelectItem>
                                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                      <SelectItem value="boleto">Boleto Bancário</SelectItem>
                                      <SelectItem value="pix_parcelado">PIX Parcelado</SelectItem>
                                      <SelectItem value="transferencia">Transferência</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

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

                                {isParcelavel && (
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
                                        {isEntrada ? 'Data da Entrada' : 'Data do Pagamento'}
                                      </Label>
                                      <span className="text-[10px] text-emerald-400 font-medium">Fatura automática</span>
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
                              <span className="text-amber-500 font-semibold text-[11px]">
                                Faltam distribuir {formatMoney(dif)}
                              </span>
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
                <div className="rounded-md bg-muted/50 p-2.5 border border-border text-xs space-y-1">
                  <div><strong>Condição de Pagamento:</strong> {aprovandoOrcamento.formasPagamento || 'A combinar'}</div>
                  <div className="text-muted-foreground">
                    Deseja lançar a entrada e as parcelas automaticamente no <strong>Contas a Receber (Financeiro)</strong> para monitoramento de vencimentos e lembretes de PIX?
                  </div>
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
