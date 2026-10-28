import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageCircle,
  Phone,
  Mail,
  Calendar,
  Clock,
  Sparkles,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Archive,
  DollarSign,
  Tag,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { NovoLead, StatusNovoLead, PrioridadeNovoLead } from '@/types/novosLeads';
import {
  formatarTelefoneExibicao,
  normalizarTelefone,
} from '@/services/novosLeadsService';
import FollowUpTimeline from './FollowUpTimeline';
import ModalAgendamentoLead from './ModalAgendamentoLead';
import ModalConversaoLead from './ModalConversaoLead';
import ModalPerdaLead from './ModalPerdaLead';
import ModalRevisarLead from './ModalRevisarLead';
import { toast } from 'sonner';

interface LeadDetalhesModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: NovoLead | null;
  onMudarStatus: (
    id: string,
    status: StatusNovoLead,
    dadosExtras?: any
  ) => Promise<any>;
  onRegistrarFollowUp: (leadId: string, etapa: any, dados: any) => Promise<any>;
  onLeadAtualizado: (lead: NovoLead) => void;
}

export default function LeadDetalhesModal({
  isOpen,
  onClose,
  lead,
  onMudarStatus,
  onRegistrarFollowUp,
  onLeadAtualizado,
}: LeadDetalhesModalProps) {
  const [tabAtiva, setTabAtiva] = useState<'geral' | 'followup' | 'mensagens'>('geral');

  // Modais de ação de status
  const [modalAgendamentoAberto, setModalAgendamentoAberto] = useState(false);
  const [modalConversaoAberto, setModalConversaoAberto] = useState(false);
  const [modalPerdaAberto, setModalPerdaAberto] = useState(false);
  const [modalRevisarAberto, setModalRevisarAberto] = useState(false);

  if (!lead) return null;

  // Abre WhatsApp com saudação personalizada
  const handleAbrirWhatsApp = () => {
    const tel = normalizarTelefone(lead.telefone).replace(/\D/g, '');
    if (!tel) {
      toast.error('Telefone inválido ou não informado para este lead.');
      return;
    }

    const primeiroNome = (lead.nome || '').split(' ')[0] || 'Olá';
    const saudacao = encodeURIComponent(
      `Olá ${primeiroNome}, tudo bem? Sou da equipe da Clínica Dra. Rosangela Santos. Vimos que você preencheu nosso formulário demonstrando interesse em tratamentos odontológicos e gostaria de te passar mais informações!`
    );

    window.open(`https://wa.me/${tel}?text=${saudacao}`, '_blank');
  };

  const handleSelecionarStatus = (novoStatus: StatusNovoLead) => {
    if (novoStatus === 'Agendado') {
      setModalAgendamentoAberto(true);
    } else if (novoStatus === 'Convertido') {
      setModalConversaoAberto(true);
    } else if (novoStatus === 'Perdido') {
      setModalPerdaAberto(true);
    } else {
      onMudarStatus(lead.id, novoStatus);
    }
  };

  const getStatusBadge = (status: StatusNovoLead) => {
    switch (status) {
      case 'Pendente':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">Pendente</Badge>;
      case 'Interessado':
        return <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200">Interessado</Badge>;
      case 'Agendado':
        return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">Agendado</Badge>;
      case 'Começou mas não deu andamento':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">Começou mas não deu andamento</Badge>;
      case 'Convertido':
        return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200">Convertido</Badge>;
      case 'Perdido':
        return <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200">Perdido</Badge>;
    }
  };

  const getPrioridadeBadge = (p: PrioridadeNovoLead) => {
    switch (p) {
      case 'alta':
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300">Prioridade Alta</Badge>;
      case 'media':
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">Prioridade Média</Badge>;
      case 'baixa':
        return <Badge className="bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300">Prioridade Baixa</Badge>;
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
          {/* Header estilizado */}
          <div className="p-6 pb-4 bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-background dark:from-blue-950/30 dark:via-background dark:to-background border-b border-border">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-bold text-foreground">
                    {lead.nome}
                  </h3>
                  {lead.revisado ? (
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Revisado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400 text-[10px] animate-pulse">
                      Não Revisado
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    {formatarTelefoneExibicao(lead.telefone)}
                  </span>
                  {lead.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" />
                      {lead.email}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(lead.data_criacao).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                  <span>Origem: <strong>{lead.origem}</strong></span>
                </div>
              </div>

              {/* Botões de Ação Rápida */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={handleAbrirWhatsApp}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 px-3.5 shadow-sm"
                >
                  <MessageCircle className="w-4 h-4 mr-1.5 fill-current" />
                  Abrir WhatsApp
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setModalRevisarAberto(true)}
                  className="text-xs h-9 px-3 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300"
                >
                  <UserCheck className="w-4 h-4 mr-1.5" />
                  {lead.revisado ? 'Ver Prontuário / Cadastro' : 'Revisar Lead'}
                </Button>
              </div>
            </div>

            {/* Linha de Status e Prioridade */}
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-border/60">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-semibold">Status:</span>
                <select
                  value={lead.status}
                  onChange={(e) => handleSelecionarStatus(e.target.value as StatusNovoLead)}
                  className="text-xs font-semibold rounded-lg border border-border bg-background px-2.5 py-1 text-foreground focus:ring-1 focus:ring-blue-600 cursor-pointer"
                >
                  <option value="Pendente">Pendente</option>
                  <option value="Interessado">Interessado</option>
                  <option value="Agendado">Agendado</option>
                  <option value="Começou mas não deu andamento">Começou mas não deu andamento</option>
                  <option value="Convertido">Convertido</option>
                  <option value="Perdido">Perdido</option>
                </select>
                {getStatusBadge(lead.status)}
              </div>

              <div>{getPrioridadeBadge(lead.prioridade)}</div>
            </div>
          </div>

          {/* Abas Internas */}
          <Tabs
            value={tabAtiva}
            onValueChange={(v: any) => setTabAtiva(v)}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="px-6 border-b border-border bg-muted/20">
              <TabsList className="bg-transparent h-11 p-0 gap-4">
                <TabsTrigger
                  value="geral"
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none text-xs font-semibold px-1 pb-3"
                >
                  Respostas & Visão Geral
                </TabsTrigger>
                <TabsTrigger
                  value="followup"
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none text-xs font-semibold px-1 pb-3"
                >
                  Régua de Follow-up (9 Etapas)
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
              <TabsContent value="geral" className="m-0 space-y-4">
                {/* Respostas do Formulário Meta Lead Ads */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    Respostas do Formulário da Meta Lead Ads
                  </h4>

                  {lead.respostas && lead.respostas.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {lead.respostas.map((r, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl border border-border/80 bg-muted/30 space-y-1"
                        >
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                            {r.pergunta}
                          </span>
                          <p className="text-xs font-bold text-foreground">
                            {r.resposta}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed text-center text-xs text-muted-foreground bg-muted/10">
                      Nenhuma pergunta personalizada no formulário. Informações básicas registradas (Nome, Telefone e Origem).
                    </div>
                  )}
                </div>

                {/* Se agendado: Exibe dados do agendamento e alertas */}
                {lead.status === 'Agendado' && lead.agendado_para && (
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-emerald-600" />
                        Consulta Agendada
                      </span>
                      <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                        {new Date(lead.agendado_para).toLocaleString('pt-BR', {
                          dateStyle: 'full',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>

                    {lead.alertas_agendamento && (
                      <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                        <span className="text-muted-foreground">Alertas ativos:</span>
                        {lead.alertas_agendamento.h72 && <Badge variant="outline">72h antes</Badge>}
                        {lead.alertas_agendamento.h48 && <Badge variant="outline">48h antes</Badge>}
                        {lead.alertas_agendamento.h24 && <Badge variant="outline">24h antes</Badge>}
                        {lead.alertas_agendamento.h3 && <Badge variant="outline">3h antes</Badge>}
                      </div>
                    )}
                  </div>
                )}

                {/* Se Convertido: Valor da Venda */}
                {lead.status === 'Convertido' && (
                  <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-purple-600" />
                        Tratamento Fechado / Venda
                      </span>
                      <p className="text-xs text-purple-700 dark:text-purple-400 mt-0.5">
                        Lead convertido com sucesso em atendimento da clínica.
                      </p>
                    </div>
                    <div className="text-lg font-extrabold text-purple-900 dark:text-purple-200">
                      {lead.valor_venda
                        ? new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(lead.valor_venda)
                        : 'Valor a confirmar'}
                    </div>
                  </div>
                )}

                {/* Se Perdido: Motivo da Perda */}
                {lead.status === 'Perdido' && lead.motivo_perda && (
                  <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 space-y-1">
                    <span className="text-xs font-bold text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
                      <Archive className="w-4 h-4 text-rose-600" />
                      Motivo do Arquivamento / Perda
                    </span>
                    <p className="text-xs text-rose-800 dark:text-rose-200 font-medium">
                      {lead.motivo_perda}
                    </p>
                  </div>
                )}

                {/* Observações */}
                {lead.observacoes && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Observações / Histórico
                    </span>
                    <div className="p-3 rounded-xl border border-border bg-muted/20 text-xs text-foreground whitespace-pre-wrap">
                      {lead.observacoes}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="followup" className="m-0">
                <FollowUpTimeline
                  lead={lead}
                  onRegistrarContato={async (etapa, dados) => {
                    const atualizado = await onRegistrarFollowUp(lead.id, etapa, dados);
                    if (atualizado) onLeadAtualizado(atualizado);
                  }}
                />
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Modais de Agendamento, Conversão, Perda e Revisão */}
      <ModalAgendamentoLead
        isOpen={modalAgendamentoAberto}
        onClose={() => setModalAgendamentoAberto(false)}
        lead={lead}
        onConfirmar={async (dataHoraIso, alertas) => {
          const at = await onMudarStatus(lead.id, 'Agendado', {
            agendado_para: dataHoraIso,
            alertas_agendamento: alertas,
          });
          if (at) onLeadAtualizado(at);
        }}
      />

      <ModalConversaoLead
        isOpen={modalConversaoAberto}
        onClose={() => setModalConversaoAberto(false)}
        lead={lead}
        onConfirmar={async (valorVenda, converterEmPaciente) => {
          const at = await onMudarStatus(lead.id, 'Convertido', {
            valor_venda: valorVenda,
          });
          if (at) onLeadAtualizado(at);
          if (converterEmPaciente) {
            setModalRevisarAberto(true);
          }
        }}
      />

      <ModalPerdaLead
        isOpen={modalPerdaAberto}
        onClose={() => setModalPerdaAberto(false)}
        lead={lead}
        onConfirmar={async (motivo, detalhes) => {
          const at = await onMudarStatus(lead.id, 'Perdido', {
            motivo_perda: motivo,
          });
          if (at) onLeadAtualizado(at);
        }}
      />

      <ModalRevisarLead
        isOpen={modalRevisarAberto}
        onClose={() => setModalRevisarAberto(false)}
        lead={lead}
        onLeadAtualizado={onLeadAtualizado}
      />
    </>
  );
}
