import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, Send, Clock, Calendar, MessageCircle, Copy, ExternalLink } from 'lucide-react';
import { SessaoTratamento } from '@/types/tratamento';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sessao: SessaoTratamento | null;
  onConfirmar: (dados: {
    data_realizada: string;
    hora_realizada: string;
    descricao_atos: string;
    observacoes_clinicas?: string;
  }) => Promise<void>;
  onGerarLink?: (sessaoId: string) => Promise<{ token: string; link: string }>;
  pacienteTelefone?: string;
}

export const ModalMarcarRealizada: React.FC<Props> = ({
  isOpen,
  onClose,
  sessao,
  onConfirmar,
  onGerarLink,
  pacienteTelefone,
}) => {
  const [dataRealizada, setDataRealizada] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [horaRealizada, setHoraRealizada] = useState<string>(
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  );
  const [descricaoAtos, setDescricaoAtos] = useState<string>(
    sessao?.descricao_atos || ''
  );
  const [observacoesClinicas, setObservacoesClinicas] = useState<string>('');
  const [gerarLinkImediato, setGerarLinkImediato] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [linkGerado, setLinkGerado] = useState<string | null>(null);

  if (!sessao) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricaoAtos.trim()) {
      toast.error('Informe a descrição dos atos realizados no atendimento.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirmar({
        data_realizada: dataRealizada,
        hora_realizada: horaRealizada,
        descricao_atos: descricaoAtos.trim(),
        observacoes_clinicas: observacoesClinicas.trim() || undefined,
      });

      if (gerarLinkImediato && onGerarLink) {
        const res = await onGerarLink(sessao.id);
        setLinkGerado(res.link);
      } else {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const copiarLink = () => {
    if (!linkGerado) return;
    navigator.clipboard.writeText(linkGerado);
    toast.success('Link de confirmação copiado para a área de transferência!');
  };

  const enviarWhatsApp = () => {
    if (!linkGerado || !pacienteTelefone) return;
    const foneLimpo = pacienteTelefone.replace(/\D/g, '');
    const foneCompleto = foneLimpo.startsWith('55') ? foneLimpo : `55${foneLimpo}`;
    const msg = encodeURIComponent(
      `Olá! Aqui é da Clínica Rosângela. Segue o link seguro para você confirmar o atendimento realizado hoje (${sessao.nome_objetivo}):\n\n${linkGerado}\n\nObrigado pela confiança!`
    );
    window.open(`https://wa.me/${foneCompleto}?text=${msg}`, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Concluir Sessão {sessao.numero_sessao}
          </DialogTitle>
          <DialogDescription>
            {sessao.nome_objetivo} — Registre a realização clínica do atendimento.
          </DialogDescription>
        </DialogHeader>

        {!linkGerado ? (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="data-real">Data do Atendimento *</Label>
                <Input
                  id="data-real"
                  type="date"
                  value={dataRealizada}
                  onChange={e => setDataRealizada(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hora-real">Horário *</Label>
                <Input
                  id="hora-real"
                  type="time"
                  value={horaRealizada}
                  onChange={e => setHoraRealizada(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="atos-real">Atos Praticados e Evolução Clínica *</Label>
              <Textarea
                id="atos-real"
                rows={4}
                placeholder="Ex: Realizada profilaxia prévia, condicionamento ácido e aplicação de resina nos dentes 11 e 21..."
                value={descricaoAtos}
                onChange={e => setDescricaoAtos(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obs-pos">Orientações Pós-Atendimento e Recomendações</Label>
              <Input
                id="obs-pos"
                placeholder="Ex: Evitar alimentos corantes por 24h, agendar polimento em 15 dias..."
                value={observacoesClinicas}
                onChange={e => setObservacoesClinicas(e.target.value)}
              />
            </div>

            <div className="flex items-start gap-2 pt-2 border-t border-border">
              <Checkbox
                id="gerar-link"
                checked={gerarLinkImediato}
                onCheckedChange={checked => setGerarLinkImediato(Boolean(checked))}
                className="mt-0.5"
              />
              <Label htmlFor="gerar-link" className="text-xs text-muted-foreground cursor-pointer">
                <strong className="text-foreground">Gerar link de confirmação digital imediatamente</strong>
                <p>Cria um link seguro de 7 dias para o paciente conferir e assinar digitalmente a realização desta sessão.</p>
              </Label>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {isSubmitting ? 'Gravando...' : 'Confirmar Realização'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4 py-4 text-center">
            <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-base text-foreground">Sessão Concluída com Sucesso!</h3>
              <p className="text-xs text-muted-foreground">
                O link de confirmação digital do paciente foi gerado com validade de 7 dias.
              </p>
            </div>

            <div className="p-3 bg-muted/60 rounded-lg border border-border flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={linkGerado}
                className="bg-transparent text-xs text-foreground flex-1 outline-hidden select-all font-mono"
              />
              <Button size="sm" variant="outline" onClick={copiarLink} className="h-7 px-2 text-xs gap-1">
                <Copy className="h-3 w-3" />
                Copiar
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              {pacienteTelefone && (
                <Button onClick={enviarWhatsApp} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-xs">
                  <MessageCircle className="h-4 w-4" />
                  Enviar no WhatsApp do Paciente
                </Button>
              )}
              <Button variant="outline" onClick={onClose} className="text-xs">
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

