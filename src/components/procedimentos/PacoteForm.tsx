import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Procedimento } from '@/types/procedimentos';
import { Pacote } from '@/hooks/useProcedimentos';

interface PacoteFormProps {
  procedimentos: Procedimento[];
  onSave: (pacote: Omit<Pacote, 'id'>) => void | Promise<void>;
  onCancel: () => void;
}

const PacoteForm = ({ procedimentos, onSave, onCancel }: PacoteFormProps) => {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [desconto, setDesconto] = useState(0);

  const bruto = useMemo(
    () => procedimentos.filter((p) => selecionados.includes(p.id)).reduce((s, p) => s + p.preco, 0),
    [procedimentos, selecionados]
  );
  const precoFinal = useMemo(() => bruto * (1 - (desconto || 0) / 100), [bruto, desconto]);

  const toggle = (id: string) =>
    setSelecionados((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || selecionados.length === 0) return;
    onSave({
      nome: nome.trim(),
      descricao: descricao.trim(),
      procedimentos: selecionados,
      precoTotal: Number(precoFinal.toFixed(2)),
      desconto: Number(desconto) || 0,
      ativo: true,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Pacote</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pacote-nome">Nome do pacote</Label>
            <Input id="pacote-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pacote-desc">Descrição</Label>
            <Textarea id="pacote-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
          </div>

          <div className="space-y-2">
            <Label>Procedimentos incluídos</Label>
            {procedimentos.length === 0 ? (
              <p className="text-sm text-gray-500">Cadastre procedimentos antes de criar um pacote.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-2">
                {procedimentos.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={selecionados.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
                    <span className="flex-1 truncate">{p.nome}</span>
                    <span className="text-gray-500">R$ {p.preco.toFixed(2)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pacote-desconto">Desconto (%)</Label>
            <Input
              id="pacote-desconto"
              type="number"
              min={0}
              max={100}
              value={desconto}
              onChange={(e) => setDesconto(Number(e.target.value))}
            />
          </div>

          <div className="flex justify-between text-sm bg-gray-50 rounded-md p-3">
            <span>Valor bruto: R$ {bruto.toFixed(2)}</span>
            <span className="font-semibold text-green-700">Total: R$ {precoFinal.toFixed(2)}</span>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!nome.trim() || selecionados.length === 0}>
              Salvar pacote
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PacoteForm;
