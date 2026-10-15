import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatsCardProps {
  title: string;
  value: string;
  change: React.ReactNode;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  iconBg: string;
  isMaskable?: boolean;
  defaultMasked?: boolean;
  storageKey?: string;
}

const StatsCard = ({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  iconBg,
  isMaskable = false,
  defaultMasked = true,
  storageKey,
}: StatsCardProps) => {
  const changeColor = {
    positive: 'text-green-600',
    negative: 'text-red-600',
    neutral: 'text-muted-foreground',
  };

  const [isMasked, setIsMasked] = useState<boolean>(() => {
    if (!isMaskable) return false;
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved !== null) {
          return saved === 'true';
        }
      } catch (e) {
        // Ignora erro de localStorage se houver
      }
    }
    return defaultMasked;
  });

  const toggleMask = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsMasked((prev) => {
      const next = !prev;
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, String(next));
        } catch (err) {
          // Ignora
        }
      }
      return next;
    });
  };

  return (
    <Card className="transition-all hover:border-primary/40 relative overflow-hidden group">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-1 flex-1">
            {/* Linha do Título com Olho de Privacidade */}
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground truncate">
                {title}
              </p>
              {isMaskable && (
                <button
                  type="button"
                  onClick={toggleMask}
                  className="p-1 -m-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer shrink-0"
                  title={isMasked ? 'Clique no olho para revelar o valor' : 'Clique para ocultar / borrar valor'}
                  aria-label={isMasked ? 'Revelar valor' : 'Ocultar valor'}
                >
                  {isMasked ? (
                    <EyeOff className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 text-primary" />
                  )}
                </button>
              )}
            </div>

            {/* Valor com Efeito de Borrado Suave */}
            <div
              onClick={isMaskable && isMasked ? toggleMask : undefined}
              className={cn(
                'relative select-none transition-all duration-300',
                isMaskable && isMasked && 'cursor-pointer'
              )}
              title={isMaskable && isMasked ? 'Clique para revelar o valor' : undefined}
            >
              <p
                className={cn(
                  'text-2xl font-bold tracking-tight text-foreground tabular-nums truncate transition-all duration-300',
                  isMaskable && isMasked
                    ? 'filter blur-[7px] opacity-75 group-hover:opacity-90 scale-[0.98]'
                    : 'filter-none opacity-100 scale-100'
                )}
              >
                {value}
              </p>

              {/* Dica ao passar o mouse se estiver borrado */}
              {isMaskable && isMasked && (
                <span className="absolute inset-0 flex items-center justify-start text-[11px] font-semibold text-primary/80 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  👀 Revelar
                </span>
              )}
            </div>

            {/* Subtítulo / Variação */}
            <div
              className={cn(
                'text-xs transition-all duration-300',
                changeColor[changeType],
                isMaskable && isMasked && 'filter blur-[4px] opacity-70 select-none'
              )}
            >
              {change}
            </div>
          </div>

          {/* Ícone */}
          <div className={`p-2.5 rounded-xl shrink-0 ${iconBg}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatsCard;
