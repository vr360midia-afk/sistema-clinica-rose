import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, RefreshCw, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Mensagem {
  id: string;
  paciente_id: string | null;
  telefone: string;
  nome_contato: string | null;
  direcao: string;
  corpo: string | null;
  status: string;
  criado_em: string;
}

const formatarTelefone = (tel: string) => {
  const d = (tel || '').replace(/\D/g, '');
  const local = d.startsWith('55') ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return tel;
};

const WhatsAppConversas = () => {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ativo, setAtivo] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('whatsapp_mensagens')
      .select('*')
      .order('criado_em', { ascending: true })
      .limit(500);
    if (error) {
      console.error(error);
      toast.error('Não foi possível carregar as conversas');
    } else {
      setMensagens((data ?? []) as Mensagem[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
    const canal = supabase
      .channel('whatsapp-mensagens')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_mensagens' },
        (payload) => setMensagens((prev) => [...prev, payload.new as Mensagem]),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [carregar]);

  const conversas = useMemo(() => {
    const mapa = new Map<string, { telefone: string; nome: string; ultima: Mensagem }>();
    mensagens.forEach((m) => {
      const atual = mapa.get(m.telefone);
      mapa.set(m.telefone, {
        telefone: m.telefone,
        nome: m.nome_contato || atual?.nome || formatarTelefone(m.telefone),
        ultima: m,
      });
    });
    return Array.from(mapa.values()).sort(
      (a, b) => new Date(b.ultima.criado_em).getTime() - new Date(a.ultima.criado_em).getTime(),
    );
  }, [mensagens]);

  const thread = useMemo(
    () => mensagens.filter((m) => m.telefone === ativo),
    [mensagens, ativo],
  );

  const enviar = async () => {
    if (!ativo || !texto.trim()) return;
    setEnviando(true);
    try {
      const pacienteId = thread.find((m) => m.paciente_id)?.paciente_id ?? null;
      const { data, error } = await supabase.functions.invoke('whatsapp-enviar', {
        body: { telefone: ativo, mensagem: texto.trim(), pacienteId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setTexto('');
      toast.success('Mensagem enviada');
      carregar();
    } catch (e) {
      console.error(e);
      toast.error('Falha ao enviar. Verifique a conexão do WhatsApp.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
      <Card className="min-h-[200px]">
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4" /> Conversas
          </CardTitle>
          <Button size="icon" variant="ghost" onClick={carregar}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-2">
          {loading ? (
            <p className="text-sm text-muted-foreground p-3">Carregando...</p>
          ) : conversas.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3">
              Nenhuma mensagem ainda. Assim que alguém enviar uma mensagem para o número da
              clínica, a conversa aparece aqui.
            </p>
          ) : (
            <ScrollArea className="h-[420px] pr-2">
              <div className="space-y-1">
                {conversas.map((c) => (
                  <button
                    key={c.telefone}
                    onClick={() => setAtivo(c.telefone)}
                    className={`w-full text-left p-2 rounded-md transition-colors ${
                      ativo === c.telefone ? 'bg-accent' : 'hover:bg-accent/50'
                    }`}
                  >
                    <p className="text-sm font-medium truncate">{c.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.ultima.corpo || '(mídia)'}
                    </p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            {ativo ? formatarTelefone(ativo) : 'Selecione uma conversa'}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-3">
          <ScrollArea className="h-[360px] pr-2">
            <div className="space-y-2">
              {thread.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    m.direcao === 'enviada'
                      ? 'ml-auto bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.corpo}</p>
                  <span className="block text-[10px] opacity-70 mt-1">
                    {new Date(m.criado_em).toLocaleString('pt-BR')}
                    {m.status === 'automatica' && ' • automática'}
                  </span>
                </div>
              ))}
              {ativo && thread.length === 0 && (
                <p className="text-sm text-muted-foreground">Sem mensagens.</p>
              )}
            </div>
          </ScrollArea>

          <div className="flex gap-2">
            <Input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escreva uma mensagem..."
              disabled={!ativo || enviando}
              onKeyDown={(e) => e.key === 'Enter' && enviar()}
            />
            <Button onClick={enviar} disabled={!ativo || enviando || !texto.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <Badge variant="outline" className="w-fit text-xs">
            Respostas só são permitidas até 24h após a última mensagem do paciente
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppConversas;
