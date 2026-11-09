import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, ShieldAlert, AlertTriangle, Layers, Info } from 'lucide-react';
import { ItemOrcamentoAnalise } from '@/utils/tratamentoFiltros';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  orcamentoId: string;
  itensAnalise: ItemOrcamentoAnalise[];
  onConfirmar: (indicesSelecionados: number[]) => Promise<void>;
  isSyncing: boolean;
}

export const ModalRevisaoItensOrcamento: React.FC<Props> = ({
  isOpen,
  onClose,
  orcamentoId,
  itensAnalise,
  onConfirmar,
  isSyncing,
}) => {
  // Inicialmente marca como selecionados: itens clínicos e itens ambíguos recomendados
  const [selecionados, setSelecionados] = useState<number[]>(() => {
    return itensAnalise
      .filter((i) => i.tipoClassificacao === 'clinico' || i.tipoClassificacao === 'ambiguo')
      .map((i) => i.index);
  });

  const toggleItem = (index: number) => {
    setSelecionados((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleSalvar = async () => {
    await onConfirmar(selecionados);
    onClose();
  };

  const itensAmbiguos = itensAnalise.filter((i) => i.tipoClassificacao === 'ambiguo');
  const itensFinanceiros = itensAnalise.filter((i) => i.tipoClassificacao === 'financeiro');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 sm:p-5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 flex items-center justify-center shrink-0">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Revisão e Classificação de Itens do Orçamento
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Orçamento #{orcamentoId.substring(0, 8)} • Confirme quais procedimentos clínicos devem gerar etapas de tratamento.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {itensAmbiguos.length > 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2.5 text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Itens com Classificação Ambígua Detectados</p>
                <p className="text-[11px] opacity-90 mt-0.5">
                  Alguns itens possuem nomenclaturas complementares ou genéricas. Confirme individualmente abaixo quais você deseja acompanhar como procedimentos clínicos.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="font-medium text-foreground">Itens Identificados no Orçamento:</p>
            <div className="space-y-2 border border-border rounded-lg divide-y divide-border">
              {itensAnalise.map((item) => {
                const isSelected = selecionados.includes(item.index);
                const isFinanceiro = item.tipoClassificacao === 'financeiro';
                const isAmbiguo = item.tipoClassificacao === 'ambiguo';
                const isClinico = item.tipoClassificacao === 'clinico';

                return (
                  <div
                    key={item.index}
                    className={`p-3 flex items-start gap-3 transition-colors ${
                      isSelected ? 'bg-primary/5' : 'bg-background opacity-80'
                    }`}
                  >
                    <Checkbox
                      id={`item-${item.index}`}
                      checked={isSelected}
                      onCheckedChange={() => toggleItem(item.index)}
                      className="mt-0.5"
                    />

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <label
                          htmlFor={`item-${item.index}`}
                          className="font-semibold text-foreground cursor-pointer text-xs"
                        >
                          {item.index}. {item.nome}
                        </label>

                        {isClinico && (
                          <Badge className="bg-emerald-600 text-white text-[10px] py-0 px-2 gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Procedimento Clínico
                          </Badge>
                        )}

                        {isAmbiguo && (
                          <Badge className="bg-amber-500 text-white text-[10px] py-0 px-2 gap-1">
                            <AlertTriangle className="h-2.5 w-2.5" /> Requer Confirmação
                          </Badge>
                        )}

                        {isFinanceiro && (
                          <Badge variant="secondary" className="text-[10px] py-0 px-2 text-muted-foreground gap-1">
                            <ShieldAlert className="h-2.5 w-2.5" /> Taxa Financeira / Desconto
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>Quantidade: {item.quantidade}</span>
                        <span>•</span>
                        <span>
                          Valor: R${' '}
                          {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        {item.dente_regiao && (
                          <>
                            <span>•</span>
                            <span className="text-teal-600 font-medium">
                              Região/Dente: {item.dente_regiao}
                            </span>
                          </>
                        )}
                      </div>

                      <p className="text-[10.5px] text-muted-foreground/80 italic">
                        {item.motivoClassificacao}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/20 flex flex-row items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {selecionados.length} de {itensAnalise.length} item(ns) selecionado(s) para importação
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isSyncing}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSalvar}
              disabled={isSyncing || selecionados.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isSyncing ? 'Sincronizando...' : 'Confirmar e Sincronizar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

