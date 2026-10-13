import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  MessageCircle,
  Send,
  Sparkles,
  MapPin,
  Calendar,
  CreditCard,
  Edit3,
  ExternalLink,
} from 'lucide-react';
import {
  TEMPLATES_POR_STATUS,
  TEMPLATES_EXTRAS,
  abrirWhatsAppWeb,
} from '@/utils/crmWhatsApp';

interface WhatsAppLeadMenuProps {
  lead: {
    id: string;
    nome: string;
    telefone: string | null;
    status: string;
  };
  buttonVariant?: 'icon' | 'badge' | 'full';
  className?: string;
}

export const WhatsAppLeadMenu: React.FC<WhatsAppLeadMenuProps> = ({
  lead,
  buttonVariant = 'icon',
  className = '',
}) => {
  const [modalEdicaoOpen, setModalEdicaoOpen] = useState(false);
  const [mensagemPersonalizada, setMensagemPersonalizada] = useState('');
  const [tituloTemplateAtual, setTituloTemplateAtual] = useState('');

  // Identifica o template padrão baseado no status do lead
  const statusKey = lead.status || 'novo';
  const templateEtapa =
    TEMPLATES_POR_STATUS[statusKey] || TEMPLATES_POR_STATUS['novo'];
  const mensagemEtapaSugerida = templateEtapa.gerarMensagem(lead.nome);

  const handleEnviarDireto = (texto: string) => {
    abrirWhatsAppWeb(lead.telefone, texto);
  };

  const handleAbrirEdicao = (texto: string, titulo: string) => {
    setMensagemPersonalizada(texto);
    setTituloTemplateAtual(titulo);
    setModalEdicaoOpen(true);
  };

  const handleConfirmarEnvioPersonalizado = () => {
    if (!mensagemPersonalizada.trim()) return;
    abrirWhatsAppWeb(lead.telefone, mensagemPersonalizada);
    setModalEdicaoOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {buttonVariant === 'icon' ? (
            <Button
              size="sm"
              type="button"
              className={`h-6 w-6 p-0 rounded-full bg-[#25D366] hover:bg-[#128C7E] text-white shadow-sm shrink-0 transition-transform active:scale-95 ${className}`}
              title="Opções de mensagem no WhatsApp Web"
              onClick={(e) => e.stopPropagation()}
            >
              <MessageCircle className="h-3 w-3" />
            </Button>
          ) : buttonVariant === 'badge' ? (
            <button
              type="button"
              className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] dark:text-[#25D366] transition-colors ${className}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>WhatsApp Web</span>
            </button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`h-8 gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950 ${className}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
              <span>Conversar no WhatsApp</span>
            </Button>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-72 sm:w-80 p-1.5 shadow-xl">
          <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Modelos WhatsApp para {lead.nome.split(' ')[0]}</span>
            <span className="text-[10px] text-emerald-600 font-mono">Web</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Opção 1: Mensagem Inteligente da Etapa Atual */}
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              handleEnviarDireto(mensagemEtapaSugerida);
            }}
            className="flex items-start gap-2.5 p-2 bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-md cursor-pointer mb-1 border border-emerald-200/60 dark:border-emerald-800/40"
          >
            <Sparkles className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-emerald-800 dark:text-emerald-200">
                {templateEtapa.titulo}
              </div>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 line-clamp-2 mt-0.5 leading-snug">
                "{mensagemEtapaSugerida.replace(/\n+/g, ' ')}"
              </p>
              <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                <span>Abrir no WhatsApp Web</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground py-1">
            Outros Modelos Prontos:
          </DropdownMenuLabel>

          {/* Outros modelos rápidos */}
          {TEMPLATES_EXTRAS.map((tmpl) => {
            const txt = tmpl.gerarMensagem(lead.nome);
            return (
              <DropdownMenuItem
                key={tmpl.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEnviarDireto(txt);
                }}
                className="flex items-start gap-2 p-1.5 text-xs cursor-pointer rounded-md"
              >
                {tmpl.categoria === 'clinica' && (
                  <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                )}
                {tmpl.categoria === 'agendamento' && (
                  <Calendar className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-foreground block truncate">
                    {tmpl.titulo}
                  </span>
                  <span className="text-[10px] text-muted-foreground block truncate">
                    {tmpl.descricao}
                  </span>
                </div>
              </DropdownMenuItem>
            );
          })}

          <DropdownMenuSeparator />

          {/* Opção para Personalizar antes de Enviar */}
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              handleAbrirEdicao(mensagemEtapaSugerida, templateEtapa.titulo);
            }}
            className="flex items-center gap-2 p-1.5 text-xs text-primary font-semibold cursor-pointer"
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>Editar mensagem antes de enviar...</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Modal para Editar Mensagem Personalizada */}
      {modalEdicaoOpen && (
        <Dialog open={modalEdicaoOpen} onOpenChange={setModalEdicaoOpen}>
          <DialogContent
            className="sm:max-w-[500px]"
            onClick={(e) => e.stopPropagation()}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <MessageCircle className="h-5 w-5 text-[#25D366]" />
                Personalizar Mensagem no WhatsApp Web
              </DialogTitle>
              <DialogDescription className="text-xs">
                Ajuste o texto abaixo. Ao clicar em enviar, a conversa será aberta diretamente no WhatsApp Web com o texto preenchido para <strong>{lead.nome}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Texto da Mensagem:</Label>
                  <span className="text-[10px] text-muted-foreground">
                    Destinatário: <strong className="text-foreground">{lead.telefone || 'Sem telefone'}</strong>
                  </span>
                </div>
                <Textarea
                  value={mensagemPersonalizada}
                  onChange={(e) => setMensagemPersonalizada(e.target.value)}
                  rows={6}
                  className="text-xs font-sans resize-none"
                  placeholder="Digite a mensagem para o paciente..."
                />
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalEdicaoOpen(false)}
                className="h-8 text-xs"
              >
                Cancelar
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleConfirmarEnvioPersonalizado}
                className="h-8 text-xs gap-1.5 bg-[#25D366] hover:bg-[#128C7E] text-white shadow-sm"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Abrir no WhatsApp Web</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default WhatsAppLeadMenu;
