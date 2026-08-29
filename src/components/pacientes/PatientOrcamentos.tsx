import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, Plus, Trash2, MessageCircle, Check, X, Handshake, FileText, Pencil } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useOrcamentos, OrcamentoItem } from '@/hooks/useOrcamentos';
import { useProcedimentos } from '@/hooks/useProcedimentos';
import { useParceiros, TipoRepasse } from '@/hooks/useParceiros';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useDentistas } from '@/hooks/useDentistas';
import { gerarOrcamentoPdf } from '@/utils/orcamentoPdf';
import { openWhatsApp } from '@/lib/whatsapp';
import { formatMoney } from '@/utils/exportCsv';
import { toast } from 'sonner';

interface Props {
  patient: any;
}

const PatientOrcamentos = ({ patient }: Props) => {
  const { orcamentos, loading, saveOrcamento, updateStatus, deleteOrcamento } = useOrcamentos(patient?.id);
  const { procedimentos } = useProcedimentos();
  const { parceiros, addParceiro, refetch: refetchParceiros } = useParceiros();
  const { configuracoes } = useConfiguracoes();
  const { dentistas } = useDentistas();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('Plano de tratamento');
  const [itens, setItens] = useState<OrcamentoItem[]>([]);
  const [desconto, setDesconto] = useState(0);
  const [observacoes, setObservacoes] = useState('');
  const [formasPagamento, setFormasPagamento] = useState('');
  const [selectKey, setSelectKey] = useState(0);
  const [statusEdicao, setStatusEdicao] = useState<'rascunho' | 'enviado' | 'aprovado' | 'recusado'>('rascunho');


  // Parceria
  const [parceriaAtiva, setParceriaAtiva] = useState(false);
  const [parceiroId, setParceiroId] = useState('');
  const [tipoRepasse, setTipoRepasse] = useState<TipoRepasse>('percentual');
  const [valorRepasse, setValorRepasse] = useState(0);
  const [novoParceiro, setNovoParceiro] = useState(false);
  const [novoNome, setNovoNome] = useState('');

  const subtotal = itens.reduce((s, i) => s + i.valor * i.quantidade, 0);
  const total = Math.max(0, subtotal - desconto);

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
    const ok = await gerarOrcamentoPdf(
      {
        titulo: o.titulo,
        pacienteNome: o.pacienteNome || patient?.nome,
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
      '',
      'Podemos seguir com este plano de tratamento?',
    ].filter(Boolean);
    openWhatsApp(patient.telefone, linhas.join('\n'));
    updateStatus(o.id, 'enviado');
  };


  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <ClipboardList className="h-5 w-5 text-primary" />
          Orçamentos e planos de tratamento
        </CardTitle>
        <Button size="sm" onClick={abrirNovo}>
          <Plus className="h-4 w-4 mr-1" /> Novo
        </Button>
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

                {o.status !== 'aprovado' && o.status !== 'recusado' && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => updateStatus(o.id, 'aprovado')}>
                      <Check className="h-4 w-4 mr-1" /> Aprovar
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

            <div className="space-y-1.5">
              <Label>Formas de pagamento</Label>
              <div className="flex flex-wrap gap-1.5">
                {['À vista (PIX)', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', '2x sem juros', '3x sem juros', '6x', '12x', 'Boleto'].map((f) => (
                  <Button
                    key={f}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() =>
                      setFormasPagamento((prev) => (prev ? (prev.includes(f) ? prev : `${prev}, ${f}`) : f))
                    }
                  >
                    {f}
                  </Button>
                ))}
              </div>
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
    </Card>
  );
};

export default PatientOrcamentos;
