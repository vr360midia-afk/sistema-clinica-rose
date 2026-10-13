import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Send,
  MessageCircle,
  Clock,
  Check,
  CheckCheck,
  AlertCircle,
  ExternalLink,
  Phone,
  Sparkles,
  Loader2,
  User,
  ShieldCheck,
  Smile,
  Bot,
  Flame,
  ThermometerSnowflake,
  Sun,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Copy,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { abrirWhatsAppWeb } from '@/utils/crmWhatsApp';
import { COLUMNS } from './KanbanBoard';
import { sugerirRespostasCrm, type CrmAnaliseIa } from '@/services/chatgptService';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';

export interface ChatMessage {
  id: string;
  lead_id: string;
  direction: 'in' | 'out';
  body: string;
  wa_message_id?: string | null;
  created_at: string;
}

interface LeadChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: any;
  onLeadUpdated?: (leadAtualizado: any) => void;
}

export const LeadChatModal: React.FC<LeadChatModalProps> = ({
  isOpen,
  onClose,
  lead,
  onLeadUpdated,
}) => {
  const { configuracoes } = useConfiguracoes();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [textoResposta, setTextoResposta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [currentStage, setCurrentStage] = useState<string>(
    lead?.stage || lead?.status || 'novo_lead'
  );

  // Estados do Copiloto IA (ChatGPT)
  const [copilotoAberto, setCopilotoAberto] = useState(false);
  const [gerandoIa, setGerandoIa] = useState(false);
  const [analiseIa, setAnaliseIa] = useState<CrmAnaliseIa | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleGerarSugestoesIa = async () => {
    setGerandoIa(true);
    setCopilotoAberto(true);
    try {
      const resultado = await sugerirRespostasCrm({
        lead,
        messages,
        apiKey: configuracoes?.openaiApiKey,
        model: configuracoes?.openaiModel || 'gpt-4o-mini',
        systemPrompt: configuracoes?.openaiSystemPrompt,
      });
      setAnaliseIa(resultado);
      toast.success('Sugestões geradas com o ChatGPT!');
    } catch (err: any) {
      toast.error(err.message || 'Falha ao consultar ChatGPT', {
        description: 'Verifique se sua chave da OpenAI está cadastrada em Configurações > APIs.',
      });
    } finally {
      setGerandoIa(false);
    }
  };

  const handleUsarSugestao = (texto: string) => {
    setTextoResposta(texto);
    toast.success('Sugestão inserida no chat! Edite ou clique em Enviar.');
  };

  useEffect(() => {
    if (!lead?.id) return;
    setCurrentStage(lead.stage || lead.status || 'novo_lead');
    carregarMensagens();

    // ------------------------------------------------------------------------
    // Realtime Supabase: Novas mensagens do WhatsApp chegam em tempo real
    // ------------------------------------------------------------------------
    const canal = supabase
      .channel(`chat_lead_${lead.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'crm_messages',
          filter: `lead_id=eq.${lead.id}`,
        },
        (payload) => {
          const novaMsg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === novaMsg.id || (m.wa_message_id && m.wa_message_id === novaMsg.wa_message_id))) {
              return prev;
            }
            return [...prev, novaMsg];
          });
          scrollToBottom();
          if (novaMsg.direction === 'in') {
            toast.info(`Nova mensagem de ${lead.name || lead.nome}!`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [lead?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const carregarMensagens = async () => {
    if (!lead?.id) return;
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('crm_messages')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar mensagens do lead:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Envio via Supabase Edge Function (WhatsApp Cloud API v21.0)
  const handleEnviarMensagem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const texto = textoResposta.trim();
    if (!texto || enviando || !lead?.id) return;

    setEnviando(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        toast.error('Você precisa estar logado para enviar mensagens.');
        return;
      }

      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: {
          lead_id: lead.id,
          text: texto,
          phone: lead.phone || lead.telefone,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao enviar pela Cloud API');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setTextoResposta('');
      toast.success('Mensagem enviada com sucesso!');

      // Se a mensagem enviada foi salva, adiciona localmente se ainda não estiver
      if (data?.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      } else {
        carregarMensagens();
      }

      // Atualiza stage no estado pai se houve transição (novo_lead -> primeiro_contato)
      if (currentStage === 'novo_lead' || currentStage === 'novo') {
        setCurrentStage('primeiro_contato');
        if (onLeadUpdated) {
          onLeadUpdated({ ...lead, stage: 'primeiro_contato', status: 'primeiro_contato' });
        }
      }
    } catch (err: any) {
      console.error('Erro ao enviar mensagem:', err);
      toast.error(err.message || 'Falha ao enviar mensagem pelo WhatsApp Cloud API', {
        description: 'Você também pode usar a opção de abrir no WhatsApp Web.',
      });
    } finally {
      setEnviando(false);
    }
  };

  // Alteração de etapa direta no cabeçalho do chat
  const handleTrocarStage = async (novoStage: string) => {
    setCurrentStage(novoStage);
    try {
      const { error } = await supabase
        .from('crm_leads')
        .update({
          stage: novoStage,
          status: novoStage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id);

      if (error) throw error;
      toast.success('Etapa do lead atualizada!');
      if (onLeadUpdated) {
        onLeadUpdated({ ...lead, stage: novoStage, status: novoStage });
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar etapa do lead');
    }
  };

  // Cálculo da janela de 24h da Meta para mensagens livres
  const lastInbound = lead?.last_inbound_at ? new Date(lead.last_inbound_at) : null;
  const horasDesdeUltimaEntrada = lastInbound
    ? (Date.now() - lastInbound.getTime()) / (1000 * 60 * 60)
    : 999;
  const dentroDaJanela24h = horasDesdeUltimaEntrada <= 24;

  const phoneFormatado = lead?.phone || lead?.telefone || 'Sem número';
  const nomeLead = lead?.name || lead?.nome || 'Paciente';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[650px] h-[85vh] flex flex-col p-0 overflow-hidden bg-slate-950 border-slate-800 text-slate-100">
        {/* Cabeçalho do Chat */}
        <DialogHeader className="p-4 bg-slate-900 border-b border-slate-800 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shrink-0">
              {nomeLead.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm sm:text-base font-bold text-slate-100 truncate">
                  {nomeLead}
                </DialogTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 border-emerald-600/40 text-emerald-400 bg-emerald-950/40"
                >
                  WhatsApp
                </Badge>
              </div>
              <DialogDescription className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Phone className="h-3 w-3 text-slate-500" />
                <span className="font-mono">{phoneFormatado}</span>
                {lead?.origin && (
                  <span className="text-[10px] text-slate-500">
                    • Origem: {lead.origin}
                  </span>
                )}
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Seletor de Etapa */}
            <Select value={currentStage} onValueChange={handleTrocarStage}>
              <SelectTrigger className="h-8 text-xs bg-slate-800 border-slate-700 text-slate-200 w-36">
                <SelectValue placeholder="Etapa" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                {COLUMNS.map((col) => (
                  <SelectItem key={col.id} value={col.id} className="text-xs">
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                      {col.title}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Atalho WhatsApp Web */}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => abrirWhatsAppWeb(phoneFormatado, '')}
              className="h-8 w-8 p-0 border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300"
              title="Abrir no WhatsApp Web"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </DialogHeader>

        {/* Indicador de Janela de Atendimento da Meta (24 Horas) */}
        <div className="px-4 py-1.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5">
            {dentroDaJanela24h ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Janela de Atendimento Ativa (Dentro de 24h)
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-400">
                <AlertCircle className="h-3 w-3" />
                Janela de 24h expirada (Meta exige resposta do paciente ou Template)
              </span>
            )}
          </div>

          {lastInbound && (
            <span className="text-slate-500">
              Última mensagem do paciente:{' '}
              {lastInbound.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>

        {/* Área Central: Balões de Conversa do WhatsApp */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] bg-slate-950">
          {loadingMessages ? (
            <div className="flex items-center justify-center h-full text-xs text-slate-500 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
              <span>Carregando histórico do WhatsApp...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-500">
              <div className="p-3 bg-slate-900 rounded-full mb-2 text-emerald-500">
                <MessageCircle className="h-8 w-8" />
              </div>
              <p className="text-sm font-medium text-slate-300">Nenhuma mensagem registrada ainda</p>
              <p className="text-xs text-slate-500 max-w-xs mt-1">
                Envie uma mensagem abaixo pelo sistema ou converse pelo app no celular (Coexistência) para iniciar o histórico.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOut = msg.direction === 'out';
              const hora = msg.created_at
                ? new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '';

              return (
                <div
                  key={msg.id}
                  className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-xs shadow-sm space-y-1 ${
                      isOut
                        ? 'bg-emerald-600 text-white rounded-br-xs'
                        : 'bg-slate-800 text-slate-100 border border-slate-700/60 rounded-bl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words leading-relaxed">
                      {msg.body}
                    </p>
                    <div
                      className={`flex items-center justify-end gap-1 text-[10px] ${
                        isOut ? 'text-emerald-100/80' : 'text-slate-400'
                      }`}
                    >
                      <span>{hora}</span>
                      {isOut && <CheckCheck className="h-3 w-3 text-emerald-200" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ================================================================== */}
        {/* Painel do Copiloto IA (ChatGPT) */}
        {/* ================================================================== */}
        <div className="bg-slate-900 border-t border-slate-800 shrink-0">
          {/* Barra de Gatilho do Copiloto */}
          <div className="px-3 py-2 flex items-center justify-between bg-slate-900/90 text-xs">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!analiseIa && !copilotoAberto) {
                    handleGerarSugestoesIa();
                  } else {
                    setCopilotoAberto(!copilotoAberto);
                  }
                }}
                disabled={gerandoIa}
                className="h-7 text-xs gap-1.5 border-emerald-500/40 bg-emerald-950/30 text-emerald-400 hover:bg-emerald-900/40 hover:text-emerald-300 shadow-xs"
              >
                {gerandoIa ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                )}
                <span>Copiloto ChatGPT</span>
                {copilotoAberto ? (
                  <ChevronDown className="h-3 w-3 opacity-70" />
                ) : (
                  <ChevronUp className="h-3 w-3 opacity-70" />
                )}
              </Button>

              {analiseIa?.temperatura && (
                <Badge
                  variant="outline"
                  className={`text-[10px] px-2 py-0 border ${
                    analiseIa.temperatura === 'Quente'
                      ? 'border-orange-500/50 text-orange-400 bg-orange-950/40'
                      : analiseIa.temperatura === 'Morno'
                      ? 'border-amber-500/50 text-amber-400 bg-amber-950/40'
                      : 'border-blue-500/50 text-blue-400 bg-blue-950/40'
                  }`}
                >
                  {analiseIa.temperatura === 'Quente' && '🔥 Lead Quente'}
                  {analiseIa.temperatura === 'Morno' && '🌤️ Lead Morno'}
                  {analiseIa.temperatura === 'Frio' && '❄️ Lead Frio'}
                </Badge>
              )}

              {analiseIa?.interesse && (
                <span className="text-[11px] text-slate-400 truncate max-w-[200px] hidden sm:inline">
                  • {analiseIa.interesse}
                </span>
              )}
            </div>

            {copilotoAberto && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleGerarSugestoesIa}
                disabled={gerandoIa}
                className="h-7 text-[11px] gap-1 text-slate-400 hover:text-emerald-400 px-2"
                title="Regerar sugestões com ChatGPT"
              >
                <RefreshCw className={`h-3 w-3 ${gerandoIa ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Novas Opções</span>
              </Button>
            )}
          </div>

          {/* Gaveta Aberta com as Sugestões */}
          {copilotoAberto && (
            <div className="p-3 bg-slate-950/80 border-t border-slate-800/80 max-h-56 overflow-y-auto space-y-2.5">
              {gerandoIa ? (
                <div className="flex items-center justify-center py-6 gap-2.5 text-xs text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                  <span>ChatGPT está analisando as mensagens e gerando respostas personalizadas...</span>
                </div>
              ) : analiseIa?.sugestoes && analiseIa.sugestoes.length > 0 ? (
                <div className="space-y-2">
                  {analiseIa.resumo && (
                    <p className="text-[11px] text-slate-400 italic bg-slate-900/60 p-2 rounded border border-slate-800">
                      💡 <strong>Resumo do ChatGPT:</strong> {analiseIa.resumo}
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {analiseIa.sugestoes.map((sug, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg border border-slate-800 hover:border-emerald-500/50 bg-slate-900/90 transition-all flex flex-col justify-between group"
                      >
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                            {sug.titulo}
                          </span>
                          <p className="text-[11px] text-slate-200 line-clamp-3 leading-relaxed">
                            {sug.texto}
                          </p>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleUsarSugestao(sug.texto)}
                          className="h-6 text-[10px] mt-2 gap-1 bg-emerald-600/80 hover:bg-emerald-600 text-white font-medium"
                        >
                          <Zap className="h-2.5 w-2.5" />
                          Usar no Chat
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-slate-400 space-y-2">
                  <p>Clique abaixo para o ChatGPT analisar a conversa deste paciente e sugerir a melhor resposta.</p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleGerarSugestoesIa}
                    className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Gerar Sugestões com ChatGPT
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé: Campo de Envio de Resposta */}
        <form
          onSubmit={handleEnviarMensagem}
          className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2 shrink-0"
        >
          <Input
            value={textoResposta}
            onChange={(e) => setTextoResposta(e.target.value)}
            placeholder="Digite sua resposta pelo WhatsApp..."
            className="flex-1 h-10 text-xs bg-slate-950 border-slate-700 text-slate-100 focus-visible:ring-emerald-500"
            disabled={enviando}
          />

          <Button
            type="submit"
            size="sm"
            disabled={enviando || !textoResposta.trim()}
            className="h-10 px-4 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold text-xs"
          >
            {enviando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Enviar</span>
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LeadChatModal;
