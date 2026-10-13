import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, Plus, Trash2, MessageCircle, Check, X, Handshake, FileText, Pencil, FileSignature, Sparkles, CalendarDays, Link as LinkIcon } from 'lucide-react';
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
import { mapearDadosContrato, gerarLinkAssinaturaContrato } from '@/utils/contratoEngine';
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

interface Props {
  patient: any;
}

const PatientOrcamentos = ({ patient }: Props) => {
  const { orcamentos, loading, saveOrcamento, updateStatus, deleteOrcamento } = useOrcamentos(patient?.id);
  const { procedimentos } = useProcedimentos();
  const { parceiros, addParceiro, refetch: refetchParceiros } = useParceiros();
  const { configuracoes } = useConfiguracoes();
  const { dentistas } = useDentistas();
  const { addTransacao } = useDentalSystem();

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
  const [pixParcelas, setPixParcelas] = useState<number>(3);
  const [pixDiaVencimento, setPixDiaVencimento] = useState<number>(10);


  // Parceria
  const [parceriaAtiva, setParceriaAtiva] = useState(false);
  const [parceiroId, setParceiroId] = useState('');
  const [tipoRepasse, setTipoRepasse] = useState<TipoRepasse>('percentual');
  const [valorRepasse, setValorRepasse] = useState(0);
  const [novoParceiro, setNovoParceiro] = useState(false);
  const [novoNome, setNovoNome] = useState('');

  const subtotal = itens.reduce((s, i) => s + i.valor * i.quantidade, 0);
  const total = Math.max(0, subtotal - desconto);

  const montarTextoPixParcelado = (entradaVal: number, parcelasVal: number, diaVal: number, totalVal: number) => {
    const qtd = Math.max(1, parcelasVal);
    const saldo = Math.max(0, totalVal - entradaVal);
    const valorParc = saldo / qtd;
    if (entradaVal > 0) {
      return `PIX Parcelado: Entrada de ${formatMoney(entradaVal)} + ${qtd}x de ${formatMoney(valorParc)} (Vencimento todo dia ${diaVal})`;
    }
    return `PIX Parcelado: ${qtd}x de ${formatMoney(valorParc)} (Vencimento todo dia ${diaVal})`;
  };

  const handleTogglePixParcelado = () => {
    const novo = !pixParceladoAtivo;
    setPixParceladoAtivo(novo);
    if (novo) {
      setFormasPagamento(montarTextoPixParcelado(pixEntrada, pixParcelas, pixDiaVencimento, total));
    }
  };

  const handleChangePixEntrada = (valor: number) => {
    const clamped = Math.min(total, Math.max(0, valor));
    setPixEntrada(clamped);
    if (pixParceladoAtivo) {
      setFormasPagamento(montarTextoPixParcelado(clamped, pixParcelas, pixDiaVencimento, total));
    }
  };

  const handleConfirmarAprovacao = async (o: Orcamento, lancarFinanceiro: boolean) => {
    try {
      setLancandoFinanceiro(true);
      await updateStatus(o.id, 'aprovado');

      if (lancarFinanceiro) {
        const snap = mapearDadosContrato({
          patient,
          orcamento: o,
          transacoes: [],
          configuracoes,
        });

        const parcelas = snap.financeiro.parcelas;
        for (const p of parcelas) {
          const isEntrada = p.descricao.toLowerCase().includes('entrada');
          
          let dataVenc: Date = new Date();
          if (p.vencimento && p.vencimento.includes('/')) {
            const [dia, mes, ano] = p.vencimento.split('/');
            dataVenc = new Date(Number(ano), Number(mes) - 1, Number(dia), 12, 0, 0);
          }

          await addTransacao({
            pacienteId: patient.id,
            valor: p.valor,
            tipo: 'receita',
            status: isEntrada ? 'pendente' : 'pendente',
            metodoPagamento: 'pix_parcelado',
            data: new Date(),
            vencimento: dataVenc,
            descricao: `${o.titulo}: ${p.descricao}`,
            categoria: 'Tratamentos',
            orcamentoId: o.id,
          });
        }
        toast.success('Orçamento aprovado e parcelas lançadas no Contas a Receber!');
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
    if (pixParceladoAtivo) {
      setFormasPagamento(montarTextoPixParcelado(pixEntrada, qtd, pixDiaVencimento, total));
    }
  };

  const handleChangePixDia = (dia: number) => {
    setPixDiaVencimento(dia);
    if (pixParceladoAtivo) {
      setFormasPagamento(montarTextoPixParcelado(pixEntrada, pixParcelas, dia, total));
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
    setPixParcelas(3);
    setPixDiaVencimento(10);
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

    if (o.formasPagamento && /pix\s*parcelado/i.test(o.formasPagamento)) {
      setPixParceladoAtivo(true);
      const entradaMatch = o.formasPagamento.match(/entrada(?:\s+de)?\s*(?:r\$)?\s*([\d.,]+)/i);
      if (entradaMatch) {
        setPixEntrada(Number(entradaMatch[1].replace(/\./g, '').replace(',', '.')) || 0);
      } else {
        setPixEntrada(0);
      }
      const parcMatch = o.formasPagamento.match(/(\d+)\s*x/i);
      if (parcMatch) {
        setPixParcelas(Number(parcMatch[1]) || 3);
      }
      const diaMatch = o.formasPagamento.match(/(?:vencimento|dia)\s*(?:todo\s*dia)?\s*(\d{1,2})/i);
      if (diaMatch) {
        setPixDiaVencimento(Number(diaMatch[1]) || 10);
      }
    } else {
      setPixParceladoAtivo(false);
      setPixEntrada(0);
      setPixParcelas(3);
      setPixDiaVencimento(10);
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
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => copiarLinkContrato(o)}
                    title="Copiar link oficial para o paciente assinar digitalmente"
                  >
                    <LinkIcon className="h-4 w-4 mr-1" /> Copiar Link
                  </Button>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
              <Label>Formas de pagamento</Label>
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
                      <Label className="text-xs">Dia do Vencimento</Label>
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

                  {/* Resumo do Cálculo em tempo real */}
                  <div className="rounded-md bg-background/80 border border-border p-2.5 text-xs space-y-1">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Total do Orçamento:</span>
                      <span className="font-medium text-foreground">{formatMoney(total)}</span>
                    </div>
                    {pixEntrada > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Entrada pactuada (PIX):</span>
                        <span className="font-semibold text-emerald-600">+{formatMoney(pixEntrada)}</span>
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
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-0.5">
                      <CalendarDays className="h-3.5 w-3.5 text-primary" />
                      Vencimentos: Todo dia <strong>{pixDiaVencimento}</strong> de cada mês (gerará o cronograma do contrato).
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
