import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Cake, FileText, AlertTriangle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotificacoes, NotificacaoTipo } from '@/hooks/useNotificacoes';

const iconFor = (tipo: NotificacaoTipo) => {
  if (tipo === 'aniversario') return <Cake className="h-4 w-4 text-pink-500" />;
  if (tipo === 'orcamento') return <FileText className="h-4 w-4 text-amber-500" />;
  if (tipo === 'manutencao') return <Sparkles className="h-4 w-4 text-amber-500" />;
  return <AlertTriangle className="h-4 w-4 text-red-500" />;
};

const NotificationsBell = () => {
  const { notificacoes, total } = useNotificacoes();
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10" aria-label="Notificações">
          <Bell className="h-5 w-5" />
          {total > 0 && (
            <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
              {total > 99 ? '99+' : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 z-50 bg-card">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold">Notificações</p>
          <p className="text-xs text-muted-foreground">Aniversários, orçamentos e inadimplência</p>
        </div>
        <ScrollArea className="max-h-80">
          {!notificacoes.length && (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma notificação no momento.</p>
          )}
          <ul className="divide-y divide-border">
            {notificacoes.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className="w-full text-left px-4 py-3 hover:bg-muted transition-colors flex gap-3"
                  onClick={() => {
                    setOpen(false);
                    navigate(n.link);
                  }}
                >
                  <span className="mt-0.5">{iconFor(n.tipo)}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate">{n.titulo}</span>
                    <span className="block text-xs text-muted-foreground truncate">{n.descricao}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsBell;
