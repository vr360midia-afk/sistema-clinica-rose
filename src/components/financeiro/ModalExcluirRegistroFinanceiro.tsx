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
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  FileCheck,
  Trash2,
  Archive,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Orcamento } from '@/hooks/useOrcamentos';
import type { Transacao } from '@/types/shared';
import { formatMoney } from '@/utils/exportCsv';
import {
  analisarElegibilidadeFinanceira,
  executarExclusaoOuCancelamentoFinanceiro,
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
  orcamento: Orcamento | null;
  transacoes: Transacao[];
  onSucesso?: (resultado: { orcamentoId: string; tipo: 'excluido' | 'cancelado' }) => void;
  onSuccess?: () => void;
}

export const ModalExcluirRegistroFinanceiro: React.FC<Props> = ({
  isOpen,
  open,
  onClose,
  onOpenChange,
  orcamento,
  transacoes,
  onSucesso,
  onSuccess,
}) => {
  const isVisible = Boolean(open ?? isOpen);
  const handleClose = () => {
    if (onClose) onClose();
    if (onOpenChange) onOpenChange(false);
  };
  const { user } = useAuth();
  const { isAdmin } = useUserRoles();
  const { requireMasterPassword } = useSecurityGate();

  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  if (!orcamento) return null;

  const transVinculadas = (transacoes || []).filter((t) => t.orcamentoId === orcamento.id);
  const analise: ElegibilidadeExclusaoFinanceira = analisarElegibilidadeFinanceira(
    orcamento,
    transVinculadas
  );

  const handleConfirmar = async () => {
    if (!motivo || motivo.trim().length < 3) {
      toast.error('Informe o motivo da exclusão ou cancelamento (mínimo 3 caracteres).');
      return;
    }

    // Validação de perfil administrativo
    if (!isAdmin) {
      toast.error('Apenas administradores possuem permissão para excluir ou cancelar lançamentos financeiros.');
      return;
    }

    // Solicitação de Senha Administrativa via Security Gate
    const autorizado = await requireMasterPassword(
      `Confirmação de segurança para ${
        analise.podeExcluirDireto ? 'excluir' : 'cancelar/arquivar'
      } o lançamento financeiro de ${analise.pacienteNome} (${formatMoney(analise.valorTotal)}).`
    );

    if (!autorizado) {
      return;
    }

    setSalvando(true);
    try {
      const res = await executarExclusaoOuCancelamentoFinanceiro({
        orcamento,
        transacoesVinculadas: transVinculadas,
        motivo: motivo.trim(),
        usuarioEmail: user?.email,
      });

      if (res.ok) {
        toast.success(res.mensagem);
        if (onSucesso) onSucesso({ orcamentoId: orcamento.id, tipo: res.tipo });
        if (onSuccess) onSuccess();
        handleClose();
        setMotivo('');
      } else {
        let msg = res.mensagem || 'Não foi possível concluir a operação.';
        if (res.error && !msg.includes(res.error)) {
          msg = `${msg} (${res.error})`;
        }
        toast.error(msg);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro inesperado ao processar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={isVisible} onOpenChange={(val) => !salvando && !val && handleClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            {analise.podeExcluirDireto ? (
              <Trash2 className="h-5 w-5 text-destructive" />
            ) : (
              <Archive className="h-5 w-5 text-amber-600" />
            )}
            {analise.tituloAcao}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Gerenciamento seguro de lançamentos financeiros com rastreabilidade e auditoria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Card Resumo do Registro */}
          <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
              <div>
                <span className="text-xs text-muted-foreground uppercase font-semibold">Paciente</span>
                <p className="font-bold text-foreground text-sm">{analise.pacienteNome}</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted-foreground uppercase font-semibold">Valor Total</span>
                <p className="font-black text-foreground text-base text-primary">
                  {formatMoney(analise.valorTotal)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
              <div>
                <span className="text-muted-foreground">Plano/Orçamento:</span>
                <p className="font-medium text-foreground truncate">{analise.titulo}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Parcelas/Lançamentos:</span>
                <p className="font-medium text-foreground">
                  {analise.qtdTransacoes} vinculada(s) (Recebido: {formatMoney(analise.totalPago)})
                </p>
              </div>
            </div>

            {analise.contratoId && (
              <div className="flex items-center gap-1.5 pt-2 border-t text-xs text-muted-foreground">
                <FileCheck className="h-4 w-4 text-emerald-600" />
                <span>
                  Contrato Vinculado: <strong className="text-foreground">{analise.contratoId}</strong>
                </span>
                <Badge variant="outline" className="text-[10px] h-5">
                  {analise.contratoStatus || 'registrado'}
                </Badge>
              </div>
            )}
          </div>

          {/* Alertas de Segurança baseados na regra de negócio */}
          {analise.temPagamentosPagos && (
            <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200">
              <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle className="text-xs font-bold uppercase tracking-wider">
                Pagamentos Registrados no Caixa
              </AlertTitle>
              <AlertDescription className="text-xs mt-1">
                Constam <strong>{formatMoney(analise.totalPago)}</strong> efetivamente quitados. Para conformidade contábil e fiscal, <strong>os comprovantes e as movimentações do caixa NÃO serão apagados</strong>. Apenas as parcelas em aberto ({formatMoney(analise.totalPendente)}) serão canceladas e o lançamento será retirado da visão operacional.
              </AlertDescription>
            </Alert>
          )}

          {analise.temContratoAssinado && (
            <Alert className="border-indigo-500/40 bg-indigo-500/10 text-indigo-900 dark:text-indigo-200">
              <FileCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <AlertTitle className="text-xs font-bold uppercase tracking-wider">
                Contrato Jurídico Preservado
              </AlertTitle>
              <AlertDescription className="text-xs mt-1">
                O contrato digital <strong>{analise.contratoId}</strong>, suas assinaturas eletrônicas e o arquivo PDF definitivo <strong>permanecerão 100% preservados e inalterados</strong>. O status jurídico não é afetado.
              </AlertDescription>
            </Alert>
          )}

          {analise.podeExcluirDireto && (
            <Alert className="border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <AlertTitle className="text-xs font-bold uppercase tracking-wider">
                {analise.isRegistroFicticio ? 'Registro Fictício / Homologação' : 'Sem Vínculos Financeiros Reais'}
              </AlertTitle>
              <AlertDescription className="text-xs mt-1">
                {analise.motivoSeguranca}
              </AlertDescription>
            </Alert>
          )}

          {/* Campo Motivo Obrigatório */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Motivo da Exclusão / Cancelamento <strong className="text-destructive">*</strong></span>
              <span className="text-[11px] text-muted-foreground font-normal">Obrigatório para auditoria</span>
            </label>
            <Textarea
              placeholder="Ex: Registro fictício de teste de contrato em homologação / cancelado por solicitação do paciente..."
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
              Ação restrita a administradores. A confirmação exigirá a Senha Administrativa do sistema.
            </span>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            size="sm"
            variant={analise.podeExcluirDireto ? 'destructive' : 'default'}
            className={!analise.podeExcluirDireto ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}
            onClick={handleConfirmar}
            disabled={salvando || motivo.trim().length < 3}
          >
            {salvando ? (
              'Processando...'
            ) : analise.podeExcluirDireto ? (
              <>
                <Trash2 className="h-4 w-4 mr-1.5" /> Confirmar Exclusão
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-1.5" /> Confirmar Cancelamento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
export default ModalExcluirRegistroFinanceiro;

