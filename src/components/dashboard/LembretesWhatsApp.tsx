import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BellRing, MessageCircle } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { buildConfirmacaoPacienteMessage, openWhatsApp } from '@/lib/whatsapp';
import { format, isSameDay, addDays } from 'date-fns';
import { toast } from 'sonner';

const LembretesWhatsApp = () => {
  const { consultas, pacientes } = useDentalSystem();

  const amanha = addDays(new Date(), 1);

  const lembretes = useMemo(() => {
    return consultas
      .filter((c) => {
        const d = new Date(c.data);
        return (
          (isSameDay(d, new Date()) || isSameDay(d, amanha)) &&
          c.status !== 'cancelado' &&
          c.status !== 'realizado'
        );
      })
      .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime() || (a.hora || '').localeCompare(b.hora || ''))
      .map((c) => ({ consulta: c, paciente: pacientes.find((p) => p.id === c.pacienteId) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultas, pacientes]);

  const enviar = (item: (typeof lembretes)[number]) => {
    const telefone = item.paciente?.telefone;
    if (!telefone) {
      toast.error('Paciente sem telefone cadastrado');
      return;
    }
    const msg = buildConfirmacaoPacienteMessage({
      pacienteNome: item.paciente?.nome,
      data: item.consulta.data,
      hora: item.consulta.hora,
      dentistaNome: item.consulta.dentista,
      procedimento: item.consulta.procedimento,
    });
    openWhatsApp(telefone, msg);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <BellRing className="h-5 w-5 text-primary" />
          Lembretes de hoje e amanhã
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {lembretes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma consulta para lembrar.</p>
        ) : (
          lembretes.map(({ consulta, paciente }) => (
            <div key={consulta.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{paciente?.nome || 'Paciente'}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(consulta.data), 'dd/MM')} às {consulta.hora}
                  {consulta.dentista ? ` • ${consulta.dentista}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant={consulta.confirmacaoStatus === 'confirmado' ? 'default' : 'secondary'}>
                  {consulta.confirmacaoStatus === 'confirmado' ? 'Confirmado' : 'Pendente'}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => enviar({ consulta, paciente })}>
                  <MessageCircle className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Lembrar</span>
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default LembretesWhatsApp;
