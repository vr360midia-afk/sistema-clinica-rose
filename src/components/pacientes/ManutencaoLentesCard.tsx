import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, CalendarPlus } from 'lucide-react';
import { useManutencaoLentes } from '@/hooks/useManutencaoLentes';

interface Props {
  onSchedule?: (pacienteId: string) => void;
}

const ManutencaoLentesCard = ({ onSchedule }: Props) => {
  const { pendentes } = useManutencaoLentes(30);

  if (pendentes.length === 0) return null;

  return (
    <Card className="border-amber-500/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-amber-500" />
          Manutenção de lentes em resina (6 meses)
          <Badge variant="secondary">{pendentes.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {pendentes.map((m) => (
          <div
            key={m.pacienteId}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 rounded-lg border border-border"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{m.pacienteNome}</p>
              <p className="text-xs text-muted-foreground">
                Último procedimento: {m.ultimaData.toLocaleDateString('pt-BR')} • Manutenção:{' '}
                {m.proximaManutencao.toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={m.vencida ? 'bg-red-500/15 text-red-500 border-red-500/30' : 'bg-amber-500/15 text-amber-500 border-amber-500/30'}>
                {m.vencida ? `Atrasada ${Math.abs(m.diasRestantes)} dia(s)` : `Em ${m.diasRestantes} dia(s)`}
              </Badge>
              {onSchedule && (
                <Button size="sm" variant="outline" onClick={() => onSchedule(m.pacienteId)}>
                  <CalendarPlus className="h-4 w-4 mr-1" />
                  Agendar
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default ManutencaoLentesCard;
