import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Trash2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  FileCheck,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Orcamento } from '@/hooks/useOrcamentos';
import type { Transacao } from '@/types/shared';
import { formatMoney } from '@/utils/exportCsv';
import {
  analisarElegibilidadeFinanceira,
  executarExclusaoLoteFinanceiro,
  ElegibilidadeExclusaoFinanceira,
} from '@/utils/financeiroExclusao';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useSecurityGate } from '@/context/SecurityContext';
import { useAuth } from '@/context/AuthContext';

interface Props {
  isOpen?: boolean;
  open?: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  orcamentosSelecionados?: Orcamento[];
  itens?: Orcamento[];
  transacoes: Transacao[];
  onSucesso?: (resultado: { totalExcluidos: number; totalCancelados: number }) => void;
  onSuccess?: () => void;
}

export const ModalExclusaoLoteFinanceiro: React.FC<Props> = ({
  isOpen,
  open,
  onClose,
  onOpenChange,
  orcamentosSelecionados,
  itens,
  transacoes,
  onSucesso,
  onSuccess,
}) => {
  const isVisible = Boolean(open ?? isOpen);
  const handleClose = () => {
    if (onClose) onClose();
    if (onOpenChange) onOpenChange(false);
  };
  const listaOrcamentos = orcamentosSelecionados || itens || [];
  const { user } = useAuth();
  const { isAdmin } = useUserRoles();
  const { requireMasterPassword } = useSecurityGate();

  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  if (!listaOrcamentos || listaOrcamentos.length === 0) return null;

  // Analisa todos os orçamentos selecionados
  const analises: ElegibilidadeExclusaoFinanceira[] = listaOrcamentos.map((orc) => {
    const transVinculadas = transacoes.filter((t) => t.orcamentoId === orc.id);
    return analisarElegibilidadeFinanceira(orc, transVinculadas);
  });

  const totalQtd = analises.length;
  const valorTotal = analises.reduce((s, a) => s + a.valorTotal, 0);

  const comPagamentos = analises.filter((a) => a.temPagamentosPagos);
  const totalValorPago = comPagamentos.reduce((s, a) => s + a.totalPago, 0);

  const comContratos = analises.filter((a) => a.temContratoAssinado);
  const elegiveisExclusaoDireta = analises.filter((a) => a.podeExcluirDireto);
  const elegiveisCancelamento = analises.filter((a) => !a.podeExcluirDireto);

  const handleConfirmarLote = async () => {
    if (!motivo || motivo.trim().length < 3) {
      toast.error('Informe o motivo da exclusão em lote (mínimo 3 caracteres).');
      return;
    }

    if (!isAdmin) {
      toast.error('Apenas administradores possuem permissão para excluir registros em lote.');
      return;
    }

    const autorizado = await requireMasterPassword(
      `Autorização para processar ${totalQtd} registros financeiros em lote no valor de ${formatMoney(valorTotal)}.`
    );

    if (!autorizado) return;

    setSalvando(true);
    try {
      const res = await executarExclusaoLoteFinanceiro({
        itens: listaOrcamentos,
        transacoes,
        motivo: motivo.trim(),
        usuarioEmail: user?.email,
      });

      toast.success(
        `Lote concluído: ${res.totalExcluidos} excluídos, ${res.totalCancelados} cancelados.`
      );
      onSucesso({ totalExcluidos: res.totalExcluidos, totalCancelados: res.totalCancelados });
      onClose();
      setMotivo('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar lote.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={isVisible} onOpenChange={(val) => !salvando && !val && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Trash2 className="h-5 w-5 text-destructive" />
            Exclusão / Cancelamento Financeiro em Lote
          </DialogTitle>
          <DialogDescription className="text-xs">
            Auditoria prévia obrigatória antes de processar múltiplos registros financeiros.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Painel Consolidado Exigido */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 bg-muted/50 rounded-lg border text-center">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase block">
                Selecionados
              </span>
              <strong className="text-xl font-black text-foreground">{totalQtd}</strong>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg border text-center">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase block">
                Valor Total
              </span>
              <strong className="text-sm font-black text-primary block truncate">
                {formatMoney(valorTotal)}
              </strong>
            </div>

            <div className="p-3 bg-emerald-500/10 border-emerald-500/30 rounded-lg border text-center">
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase block">
                Elegíveis P/ Excluir
              </span>
              <strong className="text-xl font-black text-emerald-700 dark:text-emerald-400">
                {elegiveisExclusaoDireta.length}
              </strong>
            </div>

            <div className="p-3 bg-amber-500/10 border-amber-500/30 rounded-lg border text-center">
              <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase block">
                Cancelamento Seguro
              </span>
              <strong className="text-xl font-black text-amber-700 dark:text-amber-400">
                {elegiveisCancelamento.length}
              </strong>
            </div>
          </div>

          {/* Avisos de Regras de Segurança */}
          {comPagamentos.length > 0 && (
            <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200">
              <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle className="text-xs font-bold uppercase tracking-wider">
                {comPagamentos.length} Registro(s) com Pagamentos no Caixa ({formatMoney(totalValorPago)})
              </AlertTitle>
              <AlertDescription className="text-xs mt-1">
                Para conformidade fiscal, <strong>os pagamentos realizados no caixa e seus comprovantes NÃO serão excluídos</strong>. Esses registros serão apenas cancelados/arquivados na visão operacional e os saldos em aberto serão desconsiderados.
              </AlertDescription>
            </Alert>
          )}

          {comContratos.length > 0 && (
            <Alert className="border-indigo-500/40 bg-indigo-500/10 text-indigo-900 dark:text-indigo-200">
              <FileCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <AlertTitle className="text-xs font-bold uppercase tracking-wider">
                {comContratos.length} Registro(s) com Contratos Digitais
              </AlertTitle>
              <AlertDescription className="text-xs mt-1">
                Contratos assinados, assinaturas eletrônicas e PDFs definitivos <strong>permanecem 100% preservados</strong> nos prontuários dos pacientes.
              </AlertDescription>
            </Alert>
          )}

          {/* Lista Discriminada dos Registros Selecionados */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Detalhamento dos Itens Selecionados ({totalQtd})
            </span>
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 border rounded-lg p-2 bg-muted/20">
              {analises.map((a) => (
                <div
                  key={a.orcamentoId}
                  className="flex items-center justify-between text-xs p-2 rounded border bg-card gap-2"
                >
                  <div className="min-w-0 flex-1 truncate">
                    <strong className="text-foreground block truncate">{a.pacienteNome}</strong>
                    <span className="text-muted-foreground text-[11px] truncate block">
                      {a.titulo} • {formatMoney(a.valorTotal)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {a.podeExcluirDireto ? (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px]">
                        Remoção Direta
                      </Badge>
                    ) : a.temPagamentosPagos ? (
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 text-[10px]">
                        Preserva Caixa
                      </Badge>
                    ) : (
                      <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400 text-[10px]">
                        Preserva Contrato
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Campo Motivo Obrigatório */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Motivo da Operação em Lote <strong className="text-destructive">*</strong></span>
              <span className="text-[11px] text-muted-foreground font-normal">Obrigatório para auditoria</span>
            </label>
            <Textarea
              placeholder="Ex: Limpeza de orçamentos e lançamentos fictícios gerados em testes de homologação de contratos..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="text-xs"
              disabled={salvando}
            />
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/20 p-2 rounded">
            <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span>
              Ação restrita a administradores com confirmação por Senha Administrativa. Nenhum paciente ou prontuário clínico é excluído.
            </span>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleConfirmarLote}
            disabled={salvando || motivo.trim().length < 3}
          >
            {salvando ? (
              'Processando Lote...'
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-1.5" /> Confirmar Exclusão do Lote ({totalQtd})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
export default ModalExclusaoLoteFinanceiro;

