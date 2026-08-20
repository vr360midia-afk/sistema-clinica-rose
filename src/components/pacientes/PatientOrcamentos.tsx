import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, Plus, Trash2, MessageCircle, Check, X } from 'lucide-react';
import { useOrcamentos, OrcamentoItem } from '@/hooks/useOrcamentos';
import { useProcedimentos } from '@/hooks/useProcedimentos';
import { openWhatsApp } from '@/lib/whatsapp';
import { formatMoney } from '@/utils/exportCsv';
import { toast } from 'sonner';

interface Props {
  patient: any;
}

const PatientOrcamentos = ({ patient }: Props) => {
  const { orcamentos, loading, saveOrcamento, updateStatus, deleteOrcamento } = useOrcamentos(patient?.id);
  const { procedimentos } = useProcedimentos();

  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState('Plano de tratamento');
  const [itens, setItens] = useState<OrcamentoItem[]>([]);
  const [desconto, setDesconto] = useState(0);
  const [observacoes, setObservacoes] = useState('');

  const subtotal = itens.reduce((s, i) => s + i.valor * i.quantidade, 0);
  const total = Math.max(0, subtotal - desconto);

  const addProcedimento = (id: string) => {
    const p = procedimentos.find((x) => x.id === id);
    if (!p) return;
    setItens((prev) => [...prev, { nome: p.nome, quantidade: 1, valor: p.preco }]);
  };

  const handleSave = async () => {
    if (itens.length === 0) {
      toast.error('Adicione pelo menos um procedimento');
      return;
    }
    await saveOrcamento({
      titulo,
      itens,
      desconto,
      observacoes,
      pacienteId: patient.id,
      pacienteNome: patient.nome,
      status: 'rascunho',
    });
    setOpen(false);
    setItens([]);
    setDesconto(0);
    setObservacoes('');
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
        <Button size="sm" onClick={() => setOpen(true)}>
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
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {o.itens.map((i, idx) => (
                  <li key={idx}>
                    {i.nome} {i.quantidade > 1 ? `(${i.quantidade}x)` : ''} — {formatMoney(i.valor * i.quantidade)}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => enviarWhatsApp(o)}>
                  <MessageCircle className="h-4 w-4 mr-1" /> Enviar
                </Button>
                <Button size="sm" variant="outline" onClick={() => updateStatus(o.id, 'aprovado')}>
                  <Check className="h-4 w-4 mr-1" /> Aprovar
                </Button>
                <Button size="sm" variant="outline" onClick={() => updateStatus(o.id, 'recusado')}>
                  <X className="h-4 w-4 mr-1" /> Recusar
                </Button>
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
            <DialogTitle>Novo orçamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} />
            </div>

            <div className="space-y-1.5">
              <Label>Adicionar procedimento</Label>
              <Select value="" onValueChange={addProcedimento}>
                <SelectTrigger><SelectValue placeholder="Selecione um procedimento" /></SelectTrigger>
                <SelectContent>
                  {procedimentos.filter((p) => p.ativo).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} — {formatMoney(p.preco)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
