import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProcedimentos } from '@/hooks/useProcedimentos';
import { Clock, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

interface ProcedimentoSelectorProps {
  selectedProcedimentos: string[]; // nomes dos procedimentos
  onSelectionChange: (selected: string[]) => void;
  valorTotal: number;
}

const ProcedimentoSelector = ({ selectedProcedimentos, onSelectionChange }: ProcedimentoSelectorProps) => {
  const { procedimentos } = useProcedimentos();
  const [busca, setBusca] = useState('');
  const ativos = useMemo(() => procedimentos.filter((p) => p.ativo), [procedimentos]);

  const sugestoes = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return ativos.slice(0, 8);
    return ativos.filter((p) => p.nome.toLowerCase().includes(termo)).slice(0, 8);
  }, [ativos, busca]);

  const nomeExiste = (nome: string) =>
    selectedProcedimentos.some((n) => n.toLowerCase() === nome.toLowerCase());

  const adicionar = (nome: string) => {
    const limpo = nome.trim();
    if (!limpo) return;
    if (nomeExiste(limpo)) {
      toast.info('Procedimento já adicionado.');
      return;
    }
    onSelectionChange([...selectedProcedimentos, limpo]);
    setBusca('');
  };

  const remover = (nome: string) => {
    onSelectionChange(selectedProcedimentos.filter((n) => n !== nome));
  };

  const precoDe = (nome: string) =>
    ativos.find((p) => p.nome.toLowerCase() === nome.toLowerCase());

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="Busque na lista ou digite um novo procedimento..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                adicionar(busca);
              }
            }}
            list="lista-procedimentos-prontuario"
          />
          <Button type="button" variant="outline" onClick={() => adicionar(busca)} disabled={!busca.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
        <datalist id="lista-procedimentos-prontuario">
          {ativos.map((p) => (
            <option key={p.id} value={p.nome} />
          ))}
        </datalist>

        {busca.trim() && sugestoes.length > 0 && (
          <Card>
            <CardContent className="p-2 space-y-1">
              {sugestoes.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => adicionar(p.nome)}
                  className="w-full flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent text-left"
                >
                  <span className="flex items-center gap-2">
                    {p.nome}
                    <Badge variant="secondary" className="text-xs">{p.categoria}</Badge>
                  </span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {p.duracaoMinutos} min
                    </span>
                    <span className="font-medium text-green-600">R$ {p.preco.toFixed(2)}</span>
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {selectedProcedimentos.length > 0 ? (
        <Card>
          <CardContent className="p-3 space-y-2">
            {selectedProcedimentos.map((nome) => {
              const proc = precoDe(nome);
              return (
                <div key={nome} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <span className="text-sm flex-1">{nome}</span>
                  {proc && proc.preco > 0 && (
                    <span className="text-sm font-medium text-green-600">R$ {proc.preco.toFixed(2)}</span>
                  )}
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => remover(nome)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhum procedimento adicionado. Selecione da lista ou digite um novo.
        </p>
      )}
    </div>
  );
};

export default ProcedimentoSelector;
