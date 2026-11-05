import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Pencil,
  Lock,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  FileText,
} from 'lucide-react';
import { formatMoney } from '@/utils/exportCsv';
import {
  validarPodeEditarRegistro,
  executarEdicaoRegistroFinanceiro,
} from '@/utils/financeiroExclusao';
import { useSecurityGate } from '@/context/SecurityContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import type { Orcamento } from '@/hooks/useOrcamentos';

interface ModalEditarRegistroFinanceiroProps {
  orcamento: Orcamento | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ModalEditarRegistroFinanceiro({
  orcamento,
  open,
  onOpenChange,
  onSuccess,
}: ModalEditarRegistroFinanceiroProps) {
  const { requireMasterPassword } = useSecurityGate();
  const { user } = useAuth();

  const [titulo, setTitulo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [total, setTotal] = useState<number>(0);
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  const validacao = orcamento
    ? validarPodeEditarRegistro(orcamento)
    : { podeEditarValores: false, podeEditarTermos: false, temContratoEmitidoOuAssinado: false };

  useEffect(() => {
    if (orcamento && open) {
      setTitulo(orcamento.titulo || '');
      setObservacoes(orcamento.observacoes || '');
      setTotal(Number(orcamento.total || 0));
      setMotivo('');
    }
  }, [orcamento, open]);

  if (!orcamento) return null;

  const handleSalvar = async () => {
    if (!motivo.trim() || motivo.trim().length < 3) {
      toast.error('Informe a justificativa da edição (mínimo de 3 caracteres).');
      return;
    }

    requireMasterPassword(async () => {
      setSalvando(true);
      try {
        const res = await executarEdicaoRegistroFinanceiro({
          orcamento,
          dadosAtualizados: {
            titulo: titulo.trim(),
            observacoes: observacoes.trim(),
            total: validacao.podeEditarValores ? Number(total) : orcamento.total,
          },
          motivo: motivo.trim(),
          usuarioEmail: user?.email || null,
        });

        if (res.ok) {
          toast.success(res.mensagem);
          onOpenChange(false);
          onSuccess?.();
        } else {
          toast.error(res.mensagem);
        }
      } catch (err: any) {
        toast.error(`Falha ao editar lançamento: ${err?.message || 'Erro desconhecido'}`);
      } finally {
        setSalvando(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <Pencil className="h-5 w-5 text-primary" />
            Editar Lançamento Financeiro
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Ajuste informações administrativas ou observações do orçamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Card Resumo */}
          <div className="p-3 rounded-lg border bg-muted/30 text-xs space-y-1">
            <div className="flex justify-between items-center font-bold text-foreground">
              <span>{orcamento.titulo}</span>
              <span className="text-emerald-600 font-black">{formatMoney(orcamento.total)}</span>
            </div>
            <div className="text-muted-foreground">
              Paciente: <strong className="text-foreground">{orcamento.pacienteNome || 'Sem paciente'}</strong>
            </div>
            <div className="text-muted-foreground">
              Status: <strong className="capitalize">{orcamento.status}</strong>
            </div>
          </div>

          {/* Alerta de Segurança se possuir Contrato */}
          {validacao.temContratoEmitidoOuAssinado ? (
            <Alert className="border-amber-500/30 bg-amber-500/5 py-2.5">
              <Lock className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-xs font-bold text-amber-700 dark:text-amber-400">
                Segurança Jurídica: Valores Contratuais Protegidos
              </AlertTitle>
              <AlertDescription className="text-[11px] text-muted-foreground">
                Este orçamento possui contrato jurídico emitido ou formalizado. Por diretriz de integridade jurídica, os valores contratados não podem ser alterados retroativamente. Você pode atualizar o título de controle interno e as observações.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-emerald-500/30 bg-emerald-500/5 py-2.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <AlertTitle className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                Edição Prévia Autorizada
              </AlertTitle>
              <AlertDescription className="text-[11px] text-muted-foreground">
                Lançamento sem contrato assinado vinculado. Ajustes nos valores e observações serão auditados e registrados.
              </AlertDescription>
            </Alert>
          )}

          {/* Campo Título */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Título do Lançamento / Procedimento</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="text-xs h-9"
              placeholder="Título descritivo"
            />
          </div>

          {/* Campo Valor Total (Se permitido) */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Valor Total (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={total}
              disabled={!validacao.podeEditarValores}
              onChange={(e) => setTotal(Number(e.target.value))}
              className="text-xs h-9"
            />
            {!validacao.podeEditarValores && (
              <p className="text-[10px] text-muted-foreground">
                Valor bloqueado para preservar a integridade do contrato assinado.
              </p>
            )}
          </div>

          {/* Campo Observações */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Observações Financeiras</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              className="text-xs resize-none"
              placeholder="Anotações internas, condições acordadas, etc."
            />
          </div>

          {/* Justificativa Obrigatória */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">
              Motivo Administrativo da Edição <span className="text-destructive">*</span>
            </Label>
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="text-xs h-9"
              placeholder="Ex: Correção de observações financeiras a pedido da dentista"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={salvando}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSalvar}
            disabled={salvando || !motivo.trim()}
            className="text-xs font-semibold gap-1.5"
          >
            {salvando ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5" /> Salvar com Senha Mestra
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

