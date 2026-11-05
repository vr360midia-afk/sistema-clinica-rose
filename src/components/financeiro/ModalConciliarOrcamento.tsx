import React, { useState, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Handshake,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  UserCheck,
  Search,
  Lock,
} from 'lucide-react';
import { formatMoney } from '@/utils/exportCsv';
import { supabase } from '@/integrations/supabase/client';
import { registrarAuditoria } from '@/hooks/useAuditLog';
import { useSecurityGate } from '@/context/SecurityContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import type { Orcamento } from '@/hooks/useOrcamentos';

interface ModalConciliarOrcamentoProps {
  orcamento: Orcamento | null;
  pacientes: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ModalConciliarOrcamento({
  orcamento,
  pacientes = [],
  open,
  onOpenChange,
  onSuccess,
}: ModalConciliarOrcamentoProps) {
  const { requireMasterPassword } = useSecurityGate();
  const { user } = useAuth();

  const [selectedPacienteId, setSelectedPacienteId] = useState<string>('');
  const [buscaPaciente, setBuscaPaciente] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('');
  const [processando, setProcessando] = useState<boolean>(false);

  // Normalizador para busca de sugestão inteligente
  const normalizar = (txt?: string | null) =>
    (txt || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  // Sugestão de paciente com base no nome gravado em texto no orçamento
  const sugestaoPaciente = useMemo(() => {
    if (!orcamento?.pacienteNome || pacientes.length === 0) return null;
    const nomeOrc = normalizar(orcamento.pacienteNome);
    if (!nomeOrc) return null;

    // Correspondência exata normalizada
    const exato = pacientes.find((p) => normalizar(p.nome) === nomeOrc);
    if (exato) return exato;

    // Correspondência parcial
    const parcial = pacientes.find(
      (p) => normalizar(p.nome).includes(nomeOrc) || nomeOrc.includes(normalizar(p.nome))
    );
    return parcial || null;
  }, [orcamento?.pacienteNome, pacientes]);

  // Pré-seleciona a sugestão quando abrir
  React.useEffect(() => {
    if (open) {
      setMotivo('');
      setBuscaPaciente('');
      if (sugestaoPaciente) {
        setSelectedPacienteId(sugestaoPaciente.id);
      } else {
        setSelectedPacienteId('');
      }
    }
  }, [open, sugestaoPaciente]);

  const pacienteSelecionado = useMemo(() => {
    return pacientes.find((p) => p.id === selectedPacienteId) || null;
  }, [pacientes, selectedPacienteId]);

  // Lista de pacientes filtrados para o dropdown
  const pacientesFiltrados = useMemo(() => {
    if (!buscaPaciente.trim()) return pacientes.slice(0, 50);
    const q = normalizar(buscaPaciente);
    return pacientes.filter((p) => normalizar(p.nome).includes(q) || (p.cpf && p.cpf.includes(q))).slice(0, 50);
  }, [pacientes, buscaPaciente]);

  if (!orcamento) return null;

  const handleConciliar = async () => {
    if (!selectedPacienteId || !pacienteSelecionado) {
      toast.error('Selecione o paciente ao qual este orçamento deve ser vinculado.');
      return;
    }

    if (!motivo.trim() || motivo.trim().length < 3) {
      toast.error('Informe o motivo administrativo da conciliação (mínimo de 3 caracteres).');
      return;
    }

    // Exige autorização administrativa com Senha Mestra
    requireMasterPassword(async () => {
      setProcessando(true);
      try {
        const snapExistente = (orcamento as any).assinatura_paciente || (orcamento as any).assinaturaPaciente || {};
        const payloadAtualizacao: any = {
          paciente_id: pacienteSelecionado.id,
          atualizado_em: new Date().toISOString(),
          assinatura_paciente: {
            ...snapExistente,
            pacienteNome: pacienteSelecionado.nome,
          },
        };

        // 1. Atualiza o orçamento no Supabase
        const { error: orcErr } = await supabase
          .from('orcamentos')
          .update(payloadAtualizacao)
          .eq('id', orcamento.id);

        if (orcErr) throw orcErr;

        // 2. Atualiza transações órfãs do mesmo orçamento se houver
        await supabase
          .from('transacoes')
          .update({
            paciente_id: pacienteSelecionado.id,
            paciente_nome: pacienteSelecionado.nome,
          })
          .eq('orcamento_id', orcamento.id);

        // 3. Registra auditoria rigorosa
        await registrarAuditoria({
          acao: 'conciliacao_orcamento_paciente',
          entidade: 'orcamento',
          entidadeId: orcamento.id,
          descricao: `Orçamento ${orcamento.identificador || orcamento.id} conciliado e vinculado ao paciente ${pacienteSelecionado.nome} — Motivo: ${motivo.trim()}`,
          dados: {
            orcamentoId: orcamento.id,
            pacienteAnteriorId: orcamento.pacienteId || null,
            pacienteAnteriorNome: orcamento.pacienteNome || null,
            pacienteNovoId: pacienteSelecionado.id,
            pacienteNovoNome: pacienteSelecionado.nome,
            totalOrcamento: orcamento.total,
            usuarioEmail: user?.email || null,
          },
        });

        toast.success(`Orçamento conciliado com sucesso com a ficha de ${pacienteSelecionado.nome}!`);
        onOpenChange(false);
        onSuccess?.();
      } catch (err: any) {
        console.error('Erro na conciliação:', err);
        toast.error(`Falha ao conciliar orçamento: ${err?.message || 'Erro desconhecido'}`);
      } finally {
        setProcessando(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Handshake className="h-5 w-5 text-amber-600" />
            Conciliação Administrativa de Orçamento
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Associe um orçamento pendente ou com paciente não localizado à ficha do paciente correto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Card de Detalhes do Orçamento Alvo */}
          <div className="p-3.5 rounded-lg border bg-muted/30 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <span>Lançamento Selecionado</span>
              <Badge variant="outline" className="text-[10px] font-bold text-amber-600 border-amber-500/30">
                Pendente de Conciliação
              </Badge>
            </div>
            <div className="text-sm font-bold text-foreground">
              {orcamento.titulo}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1">
              <div>
                <span className="text-muted-foreground block text-[11px]">Nome no Orçamento:</span>
                <strong className="text-foreground">{orcamento.pacienteNome || 'Não registrado'}</strong>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Valor Total:</span>
                <strong className="text-emerald-600 font-bold">{formatMoney(orcamento.total)}</strong>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Status:</span>
                <strong className="capitalize">{orcamento.status}</strong>
              </div>
            </div>
          </div>

          {/* Sugestão Inteligente (Se encontrada) */}
          {sugestaoPaciente && (
            <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4" /> Sugestão de Associação Encontrada
                </span>
                {selectedPacienteId === sugestaoPaciente.id ? (
                  <Badge className="bg-emerald-600 text-white text-[10px]">Selecionado</Badge>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] text-emerald-600 border-emerald-500/40"
                    onClick={() => setSelectedPacienteId(sugestaoPaciente.id)}
                  >
                    Usar Sugestão
                  </Button>
                )}
              </div>
              <p className="text-xs text-foreground font-medium">
                {sugestaoPaciente.nome}{' '}
                {sugestaoPaciente.cpf ? `(CPF: ${sugestaoPaciente.cpf})` : ''}{' '}
                {sugestaoPaciente.telefone ? `· Tel: ${sugestaoPaciente.telefone}` : ''}
              </p>
            </div>
          )}

          {/* Seleção do Paciente */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">
              Vincular ao Paciente Cadastrado <span className="text-destructive">*</span>
            </Label>
            <div className="space-y-1.5">
              <Input
                placeholder="Filtrar por nome ou CPF..."
                value={buscaPaciente}
                onChange={(e) => setBuscaPaciente(e.target.value)}
                className="h-8 text-xs"
              />
              <Select value={selectedPacienteId} onValueChange={setSelectedPacienteId}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Selecione o paciente cadastrado..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {pacientesFiltrados.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.nome} {p.cpf ? `· CPF: ${p.cpf}` : ''}
                    </SelectItem>
                  ))}
                  {pacientesFiltrados.length === 0 && (
                    <div className="p-2 text-center text-xs text-muted-foreground">
                      Nenhum paciente encontrado.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Justificativa Administrativa */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Motivo Administrativo da Conciliação <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Ex: Regularização de paciente com cadastro recriado ou ID desvinculado"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="text-xs h-9"
            />
            <p className="text-[11px] text-muted-foreground">
              Esta ação e seu motivo serão registrados de forma indelével na trilha de auditoria.
            </p>
          </div>

          {/* Alerta de Segurança e Preservação Jurídica */}
          <Alert className="border-amber-500/30 bg-amber-500/5 py-2.5">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-xs font-bold text-amber-700 dark:text-amber-400">
              Preservação de Documentos Oficiais
            </AlertTitle>
            <AlertDescription className="text-[11px] text-muted-foreground">
              A conciliação restabelece o vínculo entre o orçamento e o prontuário do paciente selecionado. Documentos jurídicos, assinaturas digitais ou contratos já emitidos <strong>não têm seus metadados ou tokens alterados automaticamente</strong>.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={processando}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConciliar}
            disabled={processando || !selectedPacienteId || !motivo.trim()}
            className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1.5"
          >
            {processando ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Conciliando...
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5" /> Confirmar com Senha Mestra
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

