import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Handshake, Plus, Trash2, Loader2, Pencil } from 'lucide-react';
import { useParceiros, type Parceiro, type TipoRepasse } from '@/hooks/useParceiros';
import { formatMoney } from '@/utils/exportCsv';

const emptyForm = {
  nome: '',
  especialidade: '',
  telefone: '',
  email: '',
  tipoRepasse: 'percentual' as TipoRepasse,
  valorRepasse: '',
  observacoes: '',
};

type FormState = typeof emptyForm;

const ParceirosManager = () => {
  const { parceiros, loading, addParceiro, updateParceiro, deleteParceiro } = useParceiros();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Parceiro | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [savingEdit, setSavingEdit] = useState(false);

  const openEdit = (p: Parceiro) => {
    setEditing(p);
    setEditForm({
      nome: p.nome || '',
      especialidade: p.especialidade || '',
      telefone: p.telefone || '',
      email: p.email || '',
      tipoRepasse: p.tipoRepasse,
      valorRepasse: p.valorRepasse ? String(p.valorRepasse) : '',
      observacoes: p.observacoes || '',
    });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSaving(true);
    await addParceiro({
      nome: form.nome.trim(),
      especialidade: form.especialidade,
      telefone: form.telefone,
      email: form.email,
      tipoRepasse: form.tipoRepasse,
      valorRepasse: parseFloat(form.valorRepasse) || 0,
      observacoes: form.observacoes,
      ativo: true,
    });
    setForm(emptyForm);
    setSaving(false);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editForm.nome.trim()) return;
    setSavingEdit(true);
    await updateParceiro(editing.id, {
      nome: editForm.nome.trim(),
      especialidade: editForm.especialidade,
      telefone: editForm.telefone,
      email: editForm.email,
      tipoRepasse: editForm.tipoRepasse,
      valorRepasse: parseFloat(editForm.valorRepasse) || 0,
      observacoes: editForm.observacoes,
    });
    setSavingEdit(false);
    setEditing(null);
  };

  const camposRepasse = (state: FormState, set: (s: FormState) => void) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <Label>Tipo de repasse</Label>
        <Select value={state.tipoRepasse} onValueChange={(v: TipoRepasse) => set({ ...state, tipoRepasse: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="percentual">Percentual (%) do procedimento</SelectItem>
            <SelectItem value="fixo">Valor fixo (R$)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>{state.tipoRepasse === 'percentual' ? 'Percentual (%)' : 'Valor fixo (R$)'}</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="0,00"
          value={state.valorRepasse}
          onChange={(e) => set({ ...state, valorRepasse: e.target.value })}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5" />
            Novo Parceiro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do parceiro" />
              </div>
              <div>
                <Label>Especialidade</Label>
                <Input value={form.especialidade} onChange={(e) => setForm({ ...form, especialidade: e.target.value })} placeholder="Ex: Implantodontia" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
              </div>
            </div>
            {camposRepasse(form, setForm)}
            <div>
              <Label>Observações</Label>
              <Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar parceiro
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parceiros cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!loading && parceiros.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum parceiro cadastrado.</p>
          )}
          {parceiros.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 border rounded-lg p-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{p.nome}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[p.especialidade, p.telefone].filter(Boolean).join(' • ') || 'Sem dados adicionais'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Repasse: {p.tipoRepasse === 'percentual' ? `${p.valorRepasse}%` : `${formatMoney(Number(p.valorRepasse || 0))}`}
                </p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="text-destructive" onClick={() => deleteParceiro(p.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar parceiro</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSave} className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} />
            </div>
            <div>
              <Label>Especialidade</Label>
              <Input value={editForm.especialidade} onChange={(e) => setEditForm({ ...editForm, especialidade: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Telefone</Label>
                <Input value={editForm.telefone} onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
            </div>
            {camposRepasse(editForm, setEditForm)}
            <div>
              <Label>Observações</Label>
              <Input value={editForm.observacoes} onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ParceirosManager;
