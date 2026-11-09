import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  MoreVertical,
  Plus,
  RotateCcw,
  Send,
  Award,
  ChevronDown,
  ChevronUp,
  FileCheck,
  AlertCircle,
  Link as LinkIcon,
  Copy,
  MessageCircle,
  FileText,
} from 'lucide-react';
import { ProcedimentoTratamento, SessaoTratamento, StatusProcedimentoTratamento } from '@/types/tratamento';
import { ModalSessaoTratamento } from './ModalSessaoTratamento';
import { ModalMarcarRealizada } from './ModalMarcarRealizada';
import { ModalReagendarSessao } from './ModalReagendarSessao';
import { ModalConcluirProcedimento } from './ModalConcluirProcedimento';
import { ModalReabrirProcedimento } from './ModalReabrirProcedimento';
import { toast } from 'sonner';

interface Props {
  procedimento: ProcedimentoTratamento;
  pacienteTelefone?: string;
  onAdicionarSessao: (dados: any) => Promise<any>;
  onMarcarRealizada: (sessaoId: string, dados: any) => Promise<any>;
  onReagendarSessao: (sessaoId: string, novaData: string, motivo: string) => Promise<any>;
  onGerarLinkConfirmacao: (sessaoId: string, diasValidade?: number) => Promise<any>;
  onConcluirProcedimento: (procedimentoId: string, observacoes?: string) => Promise<any>;
  onReabrirProcedimento: (procedimentoId: string, justificativa: string) => Promise<any>;
  onAtualizarStatusProcedimento: (procedimentoId: string, status: StatusProcedimentoTratamento, justificativa?: string) => Promise<any>;
}

export const ProcedimentoTratamentoCard: React.FC<Props> = ({
  procedimento,
  pacienteTelefone,
  onAdicionarSessao,
  onMarcarRealizada,
  onReagendarSessao,
  onGerarLinkConfirmacao,
  onConcluirProcedimento,
  onReabrirProcedimento,
  onAtualizarStatusProcedimento,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [isModalAddOpen, setIsModalAddOpen] = useState<boolean>(false);
  const [isModalRealizadaOpen, setIsModalRealizadaOpen] = useState<boolean>(false);
  const [isModalReagendarOpen, setIsModalReagendarOpen] = useState<boolean>(false);
  const [isModalConcluirOpen, setIsModalConcluirOpen] = useState<boolean>(false);
  const [isModalReabrirOpen, setIsModalReabrirOpen] = useState<boolean>(false);
  const [sessaoSelecionada, setSessaoSelecionada] = useState<SessaoTratamento | null>(null);

  const sessoes = procedimento.sessoes || [];
  const totalSessoes = sessoes.length;
  const sessoesRealizadas = sessoes.filter(
    s => s.status === 'realizada' || s.status === 'confirmada' || s.status === 'aguardando_confirmacao'
  ).length;
  const sessoesConfirmadas = sessoes.filter(s => s.status === 'confirmada').length;

  const percentual = totalSessoes > 0 ? Math.round((sessoesRealizadas / totalSessoes) * 100) : 0;

  const renderBadgeStatus = (status: StatusProcedimentoTratamento) => {
    switch (status) {
      case 'em_tratamento':
        return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">Em Tratamento</Badge>;
      case 'concluido':
        return <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30">Concluído</Badge>;
      case 'pausado':
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">Pausado</Badge>;
      case 'cancelado':
        return <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30">Cancelado</Badge>;
      default:
        return <Badge variant="secondary">Não Iniciado</Badge>;
    }
  };

  const renderBadgeSessao = (status: string) => {
    switch (status) {
      case 'confirmada':
        return <Badge className="bg-emerald-600 text-white text-[10px] py-0 px-2">Assinada & Confirmada</Badge>;
      case 'aguardando_confirmacao':
        return <Badge className="bg-amber-500 text-white text-[10px] py-0 px-2 animate-pulse">Aguardando Assinatura</Badge>;
      case 'realizada':
        return <Badge className="bg-blue-600 text-white text-[10px] py-0 px-2">Realizada</Badge>;
      case 'agendada':
        return <Badge variant="outline" className="text-blue-600 border-blue-300 text-[10px] py-0 px-2">Agendada</Badge>;
      case 'cancelada':
        return <Badge variant="destructive" className="text-[10px] py-0 px-2">Cancelada</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] py-0 px-2">Prevista</Badge>;
    }
  };

  const handleCopiarLink = async (sessaoId: string) => {
    try {
      const res = await onGerarLinkConfirmacao(sessaoId);
      navigator.clipboard.writeText(res.link);
      toast.success('Link de confirmação gerado e copiado!');
    } catch (err: any) {
      toast.error('Erro ao gerar link');
    }
  };

  const handleEnviarWhatsApp = async (sessao: SessaoTratamento) => {
    try {
      const res = await onGerarLinkConfirmacao(sessao.id);
      if (!pacienteTelefone) {
        navigator.clipboard.writeText(res.link);
        toast.info('Link copiado (paciente não possui telefone cadastrado).');
        return;
      }
      const foneLimpo = pacienteTelefone.replace(/\D/g, '');
      const foneCompleto = foneLimpo.startsWith('55') ? foneLimpo : `55${foneLimpo}`;
      const msg = encodeURIComponent(
        `Olá! Aqui é da Clínica Rosângela. Segue o link seguro para você confirmar o atendimento da Sessão ${sessao.numero_sessao} (${procedimento.procedimento_nome}):\n\n${res.link}\n\nObrigado pela confiança!`
      );
      window.open(`https://wa.me/${foneCompleto}?text=${msg}`, '_blank');
    } catch (err: any) {
      toast.error('Erro ao gerar link para WhatsApp');
    }
  };

  return (
    <>
      <Card className="border-border shadow-xs overflow-hidden transition-all">
        <CardHeader className="p-3.5 sm:p-4 bg-muted/30 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm sm:text-base text-foreground truncate">
                  {procedimento.procedimento_nome}
                </span>
                {renderBadgeStatus(procedimento.status)}
                {procedimento.contrato_id && (
                  <Badge variant="outline" className="text-[11px] font-mono text-muted-foreground">
                    Contrato: {procedimento.contrato_id}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span>
                  Valor: <strong>R$ {Number(procedimento.valor_aprovado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                </span>
                <span>•</span>
                <span>
                  Sessões: <strong>{sessoesRealizadas} de {totalSessoes}</strong> realizadas
                </span>
                {sessoesConfirmadas > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-emerald-600 font-medium">
                      {sessoesConfirmadas} assinada(s)
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                onClick={() => {
                  setSessaoSelecionada(null);
                  setIsModalAddOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Sessão</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 text-xs">
                  {procedimento.status !== 'concluido' ? (
                    <DropdownMenuItem
                      onClick={() => setIsModalConcluirOpen(true)}
                      className="text-purple-600 font-medium"
                    >
                      <Award className="h-3.5 w-3.5 mr-2" />
                      Concluir Procedimento
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => setIsModalReabrirOpen(true)}
                      className="text-amber-600 font-medium"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-2" />
                      Reabrir Procedimento
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />

                  {procedimento.status !== 'em_tratamento' && (
                    <DropdownMenuItem onClick={() => onAtualizarStatusProcedimento(procedimento.id, 'em_tratamento')}>
                      Marcar como Em Tratamento
                    </DropdownMenuItem>
                  )}
                  {procedimento.status !== 'pausado' && (
                    <DropdownMenuItem onClick={() => onAtualizarStatusProcedimento(procedimento.id, 'pausado')}>
                      Pausar Tratamento
                    </DropdownMenuItem>
                  )}
                  {procedimento.status !== 'cancelado' && (
                    <DropdownMenuItem
                      onClick={() => {
                        const motivo = prompt('Informe a justificativa obrigatória para o cancelamento:');
                        if (motivo) onAtualizarStatusProcedimento(procedimento.id, 'cancelado', motivo);
                      }}
                      className="text-rose-600"
                    >
                      Cancelar Procedimento
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Recolher sessões' : 'Expandir sessões'}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Barra de progresso */}
          {totalSessoes > 0 && (
            <div className="pt-2">
              <div className="flex justify-between items-center text-[11px] text-muted-foreground mb-1">
                <span>Evolução das Sessões</span>
                <span>{percentual}%</span>
              </div>
              <Progress value={percentual} className="h-1.5" />
            </div>
          )}
        </CardHeader>

        {isExpanded && (
          <CardContent className="p-3.5 sm:p-4 space-y-3">
            {sessoes.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground space-y-2">
                <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <p>Nenhuma sessão cadastrada para este procedimento.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalAddOpen(true)}
                  className="h-8 text-xs gap-1 border-dashed"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar 1ª Sessão
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {sessoes.map((s, idx) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">
                          Sessão {s.numero_sessao}: {s.nome_objetivo}
                        </span>
                        {renderBadgeSessao(s.status)}
                      </div>

                      <div className="flex items-center gap-3 text-muted-foreground flex-wrap">
                        {s.data_realizada ? (
                          <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                            Realizada em: {new Date(s.data_realizada + 'T12:00:00').toLocaleDateString('pt-BR')} {s.hora_realizada && `às ${s.hora_realizada}`}
                          </span>
                        ) : s.data_prevista ? (
                          <span>
                            Prevista: {new Date(s.data_prevista + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </span>
                        ) : null}

                        {s.data_prevista_anterior && (
                          <span className="text-amber-600 line-through text-[11px]" title={`Reagendado. Motivo: ${s.motivo_reagendamento}`}>
                            (Antes: {new Date(s.data_prevista_anterior + 'T12:00:00').toLocaleDateString('pt-BR')})
                          </span>
                        )}

                        <span>•</span>
                        <span>{s.profissional_nome}</span>
                      </div>

                      {s.descricao_atos && (
                        <p className="text-foreground/90 text-[11.5px] italic line-clamp-2 pt-0.5">
                          "{s.descricao_atos}"
                        </p>
                      )}

                      {s.confirmacao && s.confirmacao.observacoes_paciente && (
                        <div className="p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded text-[11px] text-amber-800 dark:text-amber-300 mt-1">
                          <strong>Observação do Paciente:</strong> {s.confirmacao.observacoes_paciente}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0 flex-wrap">
                      {/* Se prevista ou agendada: permite realizar ou reagendar */}
                      {(s.status === 'prevista' || s.status === 'agendada') && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 px-2.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                            onClick={() => {
                              setSessaoSelecionada(s);
                              setIsModalRealizadaOpen(true);
                            }}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Realizada
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px] gap-1"
                            onClick={() => {
                              setSessaoSelecionada(s);
                              setIsModalReagendarOpen(true);
                            }}
                          >
                            <RotateCcw className="h-3 w-3 text-blue-500" />
                            Remarcar
                          </Button>
                        </>
                      )}

                      {/* Se realizada ou aguardando confirmação: botões de link digital */}
                      {(s.status === 'realizada' || s.status === 'aguardando_confirmacao') && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px] gap-1 border-emerald-500/40 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => handleEnviarWhatsApp(s)}
                            title="Enviar link seguro de confirmação pelo WhatsApp"
                          >
                            <MessageCircle className="h-3 w-3 text-emerald-600" />
                            WhatsApp
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px] gap-1"
                            onClick={() => handleCopiarLink(s.id)}
                            title="Copiar link de confirmação"
                          >
                            <Copy className="h-3 w-3" />
                            Link
                          </Button>
                        </>
                      )}

                      {/* Se confirmada: exibe comprovante */}
                      {s.status === 'confirmada' && s.confirmacao && (
                        <Badge variant="outline" className="text-[10.5px] border-emerald-500/40 text-emerald-700 dark:text-emerald-300 gap-1 py-1">
                          <FileCheck className="h-3 w-3 text-emerald-600" />
                          Assinado em {new Date(s.confirmacao.assinado_em || '').toLocaleDateString('pt-BR')}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Modais de Controle */}
      <ModalSessaoTratamento
        isOpen={isModalAddOpen}
        onClose={() => setIsModalAddOpen(false)}
        onSalvar={onAdicionarSessao}
        procedimentoId={procedimento.id}
        pacienteId={procedimento.paciente_id}
        clinicaId={procedimento.clinica_id}
        sessaoExistente={sessaoSelecionada}
        proximoNumeroSessao={totalSessoes + 1}
      />

      <ModalMarcarRealizada
        isOpen={isModalRealizadaOpen}
        onClose={() => {
          setIsModalRealizadaOpen(false);
          setSessaoSelecionada(null);
        }}
        sessao={sessaoSelecionada}
        onConfirmar={dados => onMarcarRealizada(sessaoSelecionada!.id, dados)}
        onGerarLink={sessaoId => onGerarLinkConfirmacao(sessaoId)}
        pacienteTelefone={pacienteTelefone}
      />

      <ModalReagendarSessao
        isOpen={isModalReagendarOpen}
        onClose={() => {
          setIsModalReagendarOpen(false);
          setSessaoSelecionada(null);
        }}
        sessao={sessaoSelecionada}
        onConfirmar={onReagendarSessao}
      />

      <ModalConcluirProcedimento
        isOpen={isModalConcluirOpen}
        onClose={() => setIsModalConcluirOpen(false)}
        procedimento={procedimento}
        onConcluir={onConcluirProcedimento}
      />

      <ModalReabrirProcedimento
        isOpen={isModalReabrirOpen}
        onClose={() => setIsModalReabrirOpen(false)}
        procedimento={procedimento}
        onReabrir={onReabrirProcedimento}
      />
    </>
  );
};

