import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProcedimentoItemData } from './ModalNovoProcedimento';
import { DollarSign, FileText, Calendar, CheckCircle2, Clock, Activity, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';

interface ModalDetalhesProcedimentoProps {
  isOpen: boolean;
  onClose: () => void;
  procedimento: ProcedimentoItemData | null;
  modo: 'detalhes' | 'debito';
  onMarcarRealizado?: (proc: ProcedimentoItemData) => void;
  onAbrirOrcamento?: (orcamentoId: string) => void;
}

export const ModalDetalhesProcedimento: React.FC<ModalDetalhesProcedimentoProps> = ({
  isOpen,
  onClose,
  procedimento,
  modo,
  onMarcarRealizado,
  onAbrirOrcamento,
}) => {
  if (!procedimento) return null;

  const renderBadge = (estado: string) => {
    switch (estado) {
      case 'a_realizar':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-semibold">A realizar</Badge>;
      case 'iniciado':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-semibold">Iniciado</Badge>;
      case 'realizado':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold">
            Realizado em {procedimento.dataRealizado ? format(new Date(procedimento.dataRealizado), 'dd/MM/yyyy') : 'Concluído'}
          </Badge>
        );
      case 'pre_existente':
        return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 font-semibold">Pré-existente</Badge>;
      default:
        return <Badge variant="secondary">{estado}</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md sm:max-w-lg p-5 rounded-2xl">
        <DialogHeader className="pb-2 text-left">
          <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            {modo === 'debito' ? (
              <>
                <DollarSign className="h-5 w-5 text-purple-700 dark:text-purple-400" />
                Débito do Procedimento
              </>
            ) : (
              <>
                <FileText className="h-5 w-5 text-purple-700 dark:text-purple-400" />
                Detalhes do Procedimento
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {modo === 'debito' ? (
          <div className="space-y-4 pt-1">
            <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Procedimento</span>
                <span className="text-sm font-bold text-foreground">{procedimento.nome}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Elemento Dental</span>
                <span className="text-xs font-bold text-foreground">Dente {procedimento.dente}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-purple-200/60 dark:border-purple-900/60">
                <span className="text-xs text-muted-foreground font-semibold">Valor Contratado</span>
                <span className="text-base font-bold text-purple-700 dark:text-purple-300">
                  {procedimento.valor !== undefined
                    ? `R$ ${Number(procedimento.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    : 'Incluso no Pacote / Orçamento'}
                </span>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Orçamento de Origem:</span>
                {procedimento.orcamentoId ? (
                  <button
                    type="button"
                    onClick={() => onAbrirOrcamento && onAbrirOrcamento(procedimento.orcamentoId!)}
                    className="text-purple-700 dark:text-purple-400 font-semibold hover:underline"
                  >
                    {procedimento.orcamentoTitulo || 'Visualizar Orçamento'}
                  </button>
                ) : (
                  <span className="text-muted-foreground">Lançamento Direto</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Estado Clínico:</span>
                <div>{renderBadge(procedimento.estado)}</div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <Button
                type="button"
                onClick={onClose}
                className="h-9 px-5 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg shadow-2xs"
              >
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            <div className="bg-card border border-border rounded-xl p-4 space-y-3 text-xs sm:text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-base text-foreground">{procedimento.nome}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">Dente {procedimento.dente}</p>
                </div>
                <div>{renderBadge(procedimento.estado)}</div>
              </div>

              {procedimento.faces && procedimento.faces.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-xs text-muted-foreground font-medium">Faces:</span>
                  {procedimento.faces.map((f) => (
                    <Badge key={f} variant="outline" className="text-[11px] border-purple-400/40 text-purple-700 dark:text-purple-300">
                      {f}
                    </Badge>
                  ))}
                </div>
              )}

              {procedimento.observacoes && (
                <div className="pt-2 border-t border-border/60">
                  <span className="text-xs text-muted-foreground font-semibold block mb-1">Observações Clínicas:</span>
                  <p className="text-xs text-foreground bg-muted/40 p-2.5 rounded-lg whitespace-pre-line leading-relaxed">
                    {procedimento.observacoes}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-xs">
                <div>
                  <span className="text-muted-foreground block">Data de Criação:</span>
                  <span className="font-medium text-foreground">
                    {procedimento.criadoEm ? format(new Date(procedimento.criadoEm), 'dd/MM/yyyy') : '—'}
                  </span>
                </div>
                {procedimento.dataRealizado && (
                  <div>
                    <span className="text-muted-foreground block">Data de Realização:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {format(new Date(procedimento.dataRealizado), 'dd/MM/yyyy')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
              {procedimento.estado !== 'realizado' && onMarcarRealizado ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onClose();
                    onMarcarRealizado(procedimento);
                  }}
                  className="h-9 px-4 text-xs font-semibold border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Marcar como realizado
                </Button>
              ) : (
                <div />
              )}

              <Button
                type="button"
                onClick={onClose}
                className="h-9 px-5 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg shadow-2xs"
              >
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ModalDetalhesProcedimento;
