import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useProcedimentos } from '@/hooks/useProcedimentos';
import { Clock, DollarSign, Plus, Search, Stethoscope, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney } from '@/utils/exportCsv';

interface ProcedimentoSelectorProps {
  selectedProcedimentos: string[]; // nomes dos procedimentos
  onSelectionChange: (selected: string[]) => void;
  valorTotal: number;
  precosLivres?: Record<string, number>;
  onPrecoLivreChange?: (nome: string, preco: number) => void;
}

const getCategoriaColor = (categoria: string) => {
  const colors: Record<string, string> = {
    preventivo: 'bg-green-100 text-green-800',
    restaurador: 'bg-blue-100 text-blue-800',
    endodontico: 'bg-purple-100 text-purple-800',
    periodontico: 'bg-orange-100 text-orange-800',
    cirurgico: 'bg-red-100 text-red-800',
    protese: 'bg-indigo-100 text-indigo-800',
    ortodontico: 'bg-pink-100 text-pink-800',
    estetico: 'bg-yellow-100 text-yellow-800',
    emergencia: 'bg-red-100 text-red-800',
    outros: 'bg-muted text-foreground'
  };
  return colors[categoria] || colors.outros;
};

const getComplexidadeColor = (complexidade: string) => {
  const colors: Record<string, string> = {
    baixa: 'bg-green-100 text-green-800',
    media: 'bg-yellow-100 text-yellow-800',
    alta: 'bg-orange-100 text-orange-800',
    'muito-alta': 'bg-red-100 text-red-800'
  };
  return colors[complexidade] || colors.media;
};

const ProcedimentoSelector = ({ selectedProcedimentos, onSelectionChange, valorTotal, precosLivres = {}, onPrecoLivreChange }: ProcedimentoSelectorProps) => {
  const { procedimentos } = useProcedimentos();
  const [busca, setBusca] = useState('');
  const ativos = useMemo(() => procedimentos.filter((p) => p.ativo), [procedimentos]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return ativos;
    return ativos.filter(
      (p) =>
        p.nome.toLowerCase().includes(termo) ||
        (p.descricao || '').toLowerCase().includes(termo) ||
        p.categoria.toLowerCase().includes(termo)
    );
  }, [ativos, busca]);

  const nomeExiste = (nome: string) =>
    selectedProcedimentos.some((n) => n.toLowerCase() === nome.toLowerCase());

  const toggle = (nome: string) => {
    if (nomeExiste(nome)) {
      onSelectionChange(selectedProcedimentos.filter((n) => n.toLowerCase() !== nome.toLowerCase()));
    } else {
      onSelectionChange([...selectedProcedimentos, nome]);
    }
  };

  const adicionarLivre = () => {
    const limpo = busca.trim();
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

  // Itens livres (digitados, não cadastrados) selecionados
  const livresSelecionados = selectedProcedimentos.filter(
    (nome) => !ativos.some((p) => p.nome.toLowerCase() === nome.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Busca + adicionar livre */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar procedimento ou digitar um novo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                adicionarLivre();
              }
            }}
            className="pl-9"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={adicionarLivre}
          disabled={!busca.trim() || nomeExiste(busca.trim())}
        >
          <Plus className="h-4 w-4 mr-1" />
          Adicionar
        </Button>
      </div>

      {/* Grade de cards — mesmo visual da tela de Procedimentos */}
      {filtrados.length === 0 && livresSelecionados.length === 0 ? (
        <div className="text-center py-8">
          <Stethoscope className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {busca.trim()
              ? 'Nenhum procedimento encontrado. Clique em "Adicionar" para incluir como texto livre.'
              : 'Nenhum procedimento cadastrado.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[45vh] overflow-y-auto pr-1">
          {filtrados.map((procedimento) => {
            const isSelected = nomeExiste(procedimento.nome);
            return (
              <Card
                key={procedimento.id}
                className={`cursor-pointer transition-all ${
                  isSelected ? 'border-primary ring-1 ring-primary bg-primary/5' : 'hover:shadow-md'
                }`}
                onClick={() => toggle(procedimento.nome)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox checked={isSelected} className="mt-1 pointer-events-none" />
                    <div className="flex-1 space-y-3">
                      <div>
                        <h4 className="font-semibold text-foreground line-clamp-1">{procedimento.nome}</h4>
                        {procedimento.descricao && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {procedimento.descricao}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        <Badge className={getCategoriaColor(procedimento.categoria)}>
                          {procedimento.categoria}
                        </Badge>
                        <Badge className={getComplexidadeColor(procedimento.complexidade)}>
                          {procedimento.complexidade}
                        </Badge>
                        {procedimento.requererAnestesia && (
                          <Badge variant="outline" className="text-xs">Anestesia</Badge>
                        )}
                        {procedimento.requererRaioX && (
                          <Badge variant="outline" className="text-xs">Raio-X</Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1.5 text-green-600">
                          <DollarSign className="h-4 w-4" />
                          <span className="font-semibold">{formatMoney(procedimento.preco)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <span>{procedimento.duracaoMinutos} min</span>
                        </div>
                      </div>

                      {procedimento.precoConvenio != null && procedimento.precoConvenio > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Convênio: {formatMoney(procedimento.precoConvenio)}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Itens livres adicionados */}
      {livresSelecionados.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Adicionados manualmente
          </p>
          {livresSelecionados.map((nome) => (
            <div key={nome} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
              <span className="text-sm flex-1">{nome}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">R$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  className="h-8 w-28"
                  value={precosLivres[nome] ?? ''}
                  onChange={(e) => onPrecoLivreChange?.(nome, parseFloat(e.target.value) || 0)}
                />
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => remover(nome)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Resumo */}
      {selectedProcedimentos.length > 0 && (
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedProcedimentos.length} procedimento(s) selecionado(s)
              </span>
              <span className="text-lg font-bold text-green-700 dark:text-green-400">
                Total: {formatMoney(valorTotal)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProcedimentoSelector;
