import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProcedimentoItemData } from './ModalNovoProcedimento';
import { DollarSign, FileText, CheckCircle2, Camera } from 'lucide-react';
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
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);

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
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl p-0 h-full flex flex-col bg-background border-l border-border shadow-2xl z-50 overflow-hidden"
      >
        {/* Header do Drawer Lateral */}
        <div className="p-4 sm:p-5 border-b border-border/70 flex items-center justify-between shrink-0 bg-background">
          <SheetTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            {modo === 'debito' ? (
              <>
                <DollarSign className="h-5 w-5 text-purple-700 dark:text-purple-400" />
                <span>Débito do Procedimento</span>
              </>
            ) : (
              <>
                <FileText className="h-5 w-5 text-purple-700 dark:text-purple-400" />
                <span>Detalhes do Procedimento</span>
              </>
            )}
          </SheetTitle>
        </div>

        {/* Conteúdo com Rolagem Lateral */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 no-scrollbar">
          {modo === 'debito' ? (
            <div className="space-y-4">
              <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 rounded-2xl p-4.5 space-y-3 shadow-2xs">
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

              <div className="bg-card border border-border rounded-xl p-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Orçamento de Origem:</span>
                  {procedimento.orcamentoId ? (
                    <button
                      type="button"
                      onClick={() => onAbrirOrcamento && onAbrirOrcamento(procedimento.orcamentoId!)}
                      className="text-purple-700 dark:text-purple-400 font-semibold hover:underline cursor-pointer"
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
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-4.5 space-y-3.5 text-xs sm:text-sm shadow-2xs">
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
                    <p className="text-xs text-foreground bg-muted/40 p-3 rounded-lg whitespace-pre-line leading-relaxed">
                      {procedimento.observacoes}
                    </p>
                  </div>
                )}

                {/* FOTOS E IMAGENS ANEXADAS */}
                {procedimento.fotos && procedimento.fotos.length > 0 && (
                  <div className="pt-2 border-t border-border/60 space-y-2">
                    <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
                      <Camera className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                      <span>Fotos Anexadas ({procedimento.fotos.length}):</span>
                    </span>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {procedimento.fotos.map((f) => (
                        <div
                          key={f.id}
                          className="relative h-20 w-24 rounded-lg overflow-hidden border border-border group bg-black/5 shadow-2xs cursor-pointer hover:ring-2 hover:ring-purple-600 transition-all"
                          onClick={() => setPreviewFoto(f.url)}
                          title={f.nome || 'Clique para ampliar'}
                        >
                          <img
                            src={f.url}
                            alt={f.nome || 'Foto do procedimento'}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                      ))}
                    </div>
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
            </div>
          )}
        </div>

        {/* Rodapé Fixo */}
        <div className="p-4 sm:p-5 border-t border-border/70 bg-card/95 backdrop-blur-xs flex items-center justify-between gap-3 shrink-0">
          {modo === 'detalhes' && procedimento.estado !== 'realizado' && onMarcarRealizado ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onClose();
                onMarcarRealizado(procedimento);
              }}
              className="h-10 px-4 text-xs font-semibold border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl gap-1.5"
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
            className="h-10 px-8 text-xs sm:text-sm font-bold bg-purple-700 hover:bg-purple-800 text-white rounded-xl shadow-xs cursor-pointer"
          >
            Fechar
          </Button>
        </div>

        {/* Zoom da Imagem */}
        {previewFoto && (
          <Dialog open={Boolean(previewFoto)} onOpenChange={() => setPreviewFoto(null)}>
            <DialogContent position="center" className="max-w-2xl p-2 bg-black/95 border-none">
              <div className="relative flex items-center justify-center p-2">
                <img src={previewFoto} alt="Pré-visualização da Foto" className="max-h-[80vh] w-auto rounded-lg object-contain" />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default ModalDetalhesProcedimento;
