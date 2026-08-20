import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, RefreshCw } from 'lucide-react';
import { useAuditLog } from '@/hooks/useAuditLog';
import { format } from 'date-fns';

const AuditLogViewer = () => {
  const { entries, loading, reload } = useAuditLog(150);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <History className="h-5 w-5 text-primary" />
          Log de auditoria
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={reload} aria-label="Atualizar">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-2.5">
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium capitalize">{e.acao}</span>{' '}
                    <Badge variant="outline" className="ml-1">{e.entidade}</Badge>
                  </p>
                  {e.descricao && <p className="text-xs text-muted-foreground truncate">{e.descricao}</p>}
                  {e.atorEmail && <p className="text-[11px] text-muted-foreground">{e.atorEmail}</p>}
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {format(e.criadoEm, 'dd/MM/yy HH:mm')}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AuditLogViewer;
