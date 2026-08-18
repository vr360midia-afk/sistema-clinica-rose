import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserCog, Plus, Trash2, Loader2, Pencil } from 'lucide-react';
import { useDentistas, type Dentista } from '@/hooks/useDentistas';

const emptyForm = { nome: '', cro: '', especialidade: '', telefone: '', email: '' };

const DentistasManager = () => {
  const { dentistas, loading, addDentista, updateDentista, deleteDentista } = useDentistas();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Dentista | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [savingEdit, setSavingEdit] = useState(false);

  const openEdit = (d: Dentista) => {
    setEditing(d);
    setEditForm({
      nome: d.nome || '',
      cro: d.cro || '',
      especialidade: d.especialidade || '',
      telefone: d.telefone || '',
      email: d.email || '',
    });
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editForm.nome.trim()) return;
    setSavingEdit(true);
    await updateDentista(editing.id, {
      nome: editForm.nome.trim(),
      cro: editForm.cro || null,
      especialidade: editForm.especialidade || null,
      telefone: editForm.telefone || null,
      email: editForm.email || null,
    });
    setSavingEdit(false);
    setEditing(null);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSaving(true);
    await addDentista(form);
    setForm(emptyForm);
    setSaving(false);
  };


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Adicionar Dentista
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="d-nome">Nome *</Label>
              <Input id="d-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="d-cro">CRO</Label>
              <Input id="d-cro" value={form.cro} onChange={(e) => setForm({ ...form, cro: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="d-esp">Especialidade</Label>
              <Input id="d-esp" value={form.especialidade} onChange={(e) => setForm({ ...form, especialidade: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="d-tel">Telefone</Label>
              <Input id="d-tel" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="d-email">Email</Label>
              <Input id="d-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Adicionar Dentista
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Dentistas Cadastrados ({dentistas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : dentistas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum dentista cadastrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {dentistas.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{d.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[d.especialidade, d.cro && `CRO ${d.cro}`, d.telefone].filter(Boolean).join(' • ') || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={d.ativo}
                        onCheckedChange={(checked) => updateDentista(d.id, { ativo: checked })}
                      />
                      <span className="text-xs text-muted-foreground">{d.ativo ? 'Ativo' : 'Inativo'}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Remover ${d.nome}?`)) deleteDentista(d.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DentistasManager;
