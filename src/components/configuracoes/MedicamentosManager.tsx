import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pill, Plus, Pencil, Trash2 } from 'lucide-react';
import { useMedicamentos, Medicamento } from '@/hooks/useMedicamentos';

const emptyForm = {
  nome: '',
  principioAtivo: '',
  apresentacao: '',
  dosagem: '',
  posologia: '',
  periodo: '',
  quantidade: '',
  observacoes: '',
  ativo: true,
};

const MedicamentosManager = () => {
  const { medicamentos, loading, addMedicamento, updateMedicamento, deleteMedicamento } = useMedicamentos();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Medicamento | null>(null);
  const [form, setForm] = useState(emptyForm);

  const abrirNovo = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const abrirEdicao = (m: Medicamento) => {
    setEditing(m);
    setForm({
      nome: m.nome,
      principioAtivo: m.principioAtivo || '',
      apresentacao: m.apresentacao || '',
      dosagem: m.dosagem || '',
      posologia: m.posologia || '',
      periodo: m.periodo || '',
      quantidade: m.quantidade || '',
      observacoes: m.observacoes || '',
      ativo: m.ativo,
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    if (editing) {
      await updateMedicamento(editing.id, form);
    } else {
      await addMedicamento(form);
    }
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Pill className="h-5 w-5" /> Medicamentos pré-cadastrados
        </CardTitle>
        <Button size="sm" onClick={abrirNovo}>
          <Plus className="h-4 w-4 mr-2" /> Novo
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Cadastre medicamentos com dosagem, posologia e período padrão. Ao emitir uma prescrição, basta
          selecionar o medicamento que os campos são preenchidos automaticamente.
        </p>

        {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}

        {!loading && !medicamentos.length && (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum medicamento cadastrado.</p>
        )}

        <div className="grid gap-2">
          {medicamentos.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{m.nome}</span>
                  {m.dosagem && <Badge variant="outline">{m.dosagem}</Badge>}
                  {!m.ativo && <Badge variant="secondary">Inativo</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1 break-words">
                  {[m.principioAtivo, m.apresentacao, m.posologia, m.periodo, m.quantidade]
                    .filter(Boolean)
                    .join(' • ') || 'Sem detalhes'}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="outline" onClick={() => abrirEdicao(m)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteMedicamento(m.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar medicamento' : 'Novo medicamento'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required placeholder="Ex.: Amoxicilina 500mg" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Princípio ativo</Label>
                <Input value={form.principioAtivo} onChange={(e) => setForm({ ...form, principioAtivo: e.target.value })} />
              </div>
              <div>
                <Label>Apresentação</Label>
                <Input value={form.apresentacao} onChange={(e) => setForm({ ...form, apresentacao: e.target.value })} placeholder="Comprimido, suspensão..." />
              </div>
              <div>
                <Label>Dosagem</Label>
                <Input value={form.dosagem} onChange={(e) => setForm({ ...form, dosagem: e.target.value })} placeholder="500 mg" />
              </div>
              <div>
                <Label>Quantidade</Label>
                <Input value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} placeholder="1 caixa / 21 comprimidos" />
              </div>
              <div>
                <Label>Posologia</Label>
                <Input value={form.posologia} onChange={(e) => setForm({ ...form, posologia: e.target.value })} placeholder="1 comprimido de 8/8h" />
              </div>
              <div>
                <Label>Período</Label>
                <Input value={form.periodo} onChange={(e) => setForm({ ...form, periodo: e.target.value })} placeholder="Por 7 dias" />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              <Label className="mb-0">Ativo</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default MedicamentosManager;
