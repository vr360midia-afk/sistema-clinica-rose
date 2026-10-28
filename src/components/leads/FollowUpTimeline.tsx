import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  MessageCircle,
  Phone,
  Mail,
  Users,
  Plus,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { NovoLead, FollowUpItem } from '@/types/novosLeads';

interface FollowUpTimelineProps {
  lead: NovoLead;
  onRegistrarContato: (
    etapa: FollowUpItem['etapa'],
    contato: {
      canal: FollowUpItem['canal'];
      observacao?: string;
      data_contato?: string;
    }
  ) => Promise<any>;
}

export default function FollowUpTimeline({
  lead,
  onRegistrarContato,
}: FollowUpTimelineProps) {
  const [etapaSelecionada, setEtapaSelecionada] = useState<FollowUpItem | null>(null);
  const [canal, setCanal] = useState<FollowUpItem['canal']>('whatsapp');
  const [dataHora, setDataHora] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [observacao, setObservacao] = useState<string>('');
  const [salvando, setSalvando] = useState<boolean>(false);

  // Calcula prazos com base na data de criação do lead
  const dataCriacaoMs = new Date(lead.data_criacao).getTime();

  const handleAbrirRegistro = (item: FollowUpItem) => {
    setEtapaSelecionada(item);
    setCanal('whatsapp');
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setDataHora(d.toISOString().slice(0, 16));
    setObservacao('');
  };

  const handleSalvarContato = async () => {
    if (!etapaSelecionada) return;
    setSalvando(true);
    try {
      await onRegistrarContato(etapaSelecionada.etapa, {
        canal,
        observacao,
        data_contato: new Date(dataHora).toISOString(),
      });
      setEtapaSelecionada(null);
    } catch {
      // tratado no hook
    } finally {
      setSalvando(false);
    }
  };

  const getCanalIcon = (c?: FollowUpItem['canal']) => {
    switch (c) {
      case 'whatsapp':
        return <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />;
      case 'ligacao':
        return <Phone className="w-3.5 h-3.5 text-blue-600" />;
      case 'email':
        return <Mail className="w-3.5 h-3.5 text-indigo-600" />;
      case 'presencial':
        return <Users className="w-3.5 h-3.5 text-amber-600" />;
      default:
        return <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />;
    }
  };

  const getCanalLabel = (c?: FollowUpItem['canal']) => {
    switch (c) {
      case 'whatsapp':
        return 'WhatsApp';
      case 'ligacao':
        return 'Ligação Telefônica';
      case 'email':
        return 'E-mail';
      case 'presencial':
        return 'Presencial na Clínica';
      default:
        return 'WhatsApp';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            Régua de Follow-up (3h, 15h, 24h, 3º, 4º, 6º, 8º, 15º e 30º dia)
          </h4>
          <p className="text-xs text-muted-foreground">
            Acompanhe a cadência e registre a data/hora exata de cada contato realizado.
          </p>
        </div>
      </div>

      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
        {lead.follow_ups.map((item, index) => {
          const limiteMs = dataCriacaoMs + item.prazoHoras * 60 * 60 * 1000;
          const limiteData = new Date(limiteMs);
          const agora = Date.now();
          const atrasado = !item.concluido && agora > limiteMs;

          return (
            <div key={item.id || index} className="relative group">
              {/* Marcador do Timeline */}
              <div
                className={`absolute -left-[1.65rem] top-1 w-5 h-5 rounded-full flex items-center justify-center border-2 bg-background ${
                  item.concluido
                    ? 'border-emerald-600 text-emerald-600'
                    : atrasado
                    ? 'border-rose-500 text-rose-500 animate-pulse'
                    : 'border-muted-foreground/40 text-muted-foreground'
                }`}
              >
                {item.concluido ? (
                  <CheckCircle2 className="w-3.5 h-3.5 fill-emerald-100 dark:fill-emerald-950 text-emerald-600" />
                ) : (
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      atrasado ? 'bg-rose-500' : 'bg-muted-foreground/40'
                    }`}
                  />
                )}
              </div>

              {/* Card da Etapa */}
              <div
                className={`p-3 rounded-xl border transition-all ${
                  item.concluido
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
                    : atrasado
                    ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                    : 'bg-card border-border/70 hover:border-border'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-foreground">
                      {item.label}
                    </span>
                    {item.concluido ? (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 text-[10px] px-1.5 py-0 h-4">
                        Realizado
                      </Badge>
                    ) : atrasado ? (
                      <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 text-[10px] px-1.5 py-0 h-4 flex items-center gap-0.5">
                        <AlertCircle className="w-2.5 h-2.5" /> Atrasado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
                        Pendente
                      </Badge>
                    )}
                  </div>

                  {!item.concluido && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2.5 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300"
                      onClick={() => handleAbrirRegistro(item)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Registrar Contato
                    </Button>
                  )}
                </div>

                {/* Detalhes de quando foi realizado ou prazo esperado */}
                <div className="mt-2 text-xs">
                  {item.concluido ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                        <span className="flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                          {getCanalIcon(item.canal)}
                          {getCanalLabel(item.canal)}
                        </span>
                        <span>•</span>
                        <span>
                          {item.data_contato
                            ? new Date(item.data_contato).toLocaleString('pt-BR', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : 'Data não registrada'}
                        </span>
                      </div>
                      {item.observacao && (
                        <p className="p-2 rounded-lg bg-background/80 border border-border/50 text-foreground italic text-[11px]">
                          "{item.observacao}"
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      Prazo ideal:{' '}
                      {limiteData.toLocaleString('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal para registrar contato da etapa */}
      <Dialog
        open={Boolean(etapaSelecionada)}
        onOpenChange={(aberto) => !aberto && setEtapaSelecionada(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Registrar Contato - {etapaSelecionada?.label}
            </DialogTitle>
            <DialogDescription>
              Confirme a data, hora e canal utilizado para falar com{' '}
              <strong>{lead.nome}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Data e Hora do Contato *</Label>
              <Input
                type="datetime-local"
                value={dataHora}
                onChange={(e) => setDataHora(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Canal do Contato *</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
                  { id: 'ligacao', label: 'Ligação', icon: Phone },
                  { id: 'email', label: 'E-mail', icon: Mail },
                  { id: 'presencial', label: 'Presencial', icon: Users },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCanal(c.id as FollowUpItem['canal'])}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                      canal === c.id
                        ? 'border-blue-600 bg-blue-50/70 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 ring-1 ring-blue-600'
                        : 'border-border hover:bg-muted/50 text-foreground'
                    }`}
                  >
                    <c.icon className="w-4 h-4 shrink-0" />
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Resumo do Contato (opcional)</Label>
              <Textarea
                rows={3}
                placeholder="Ex: Paciente demonstrou interesse em facetas, pediu para enviar fotos de antes e depois..."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setEtapaSelecionada(null)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSalvarContato}
              disabled={salvando}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              {salvando ? 'Salvando...' : 'Confirmar Registro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
