import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, CheckCircle, BellRing } from 'lucide-react';
import { format, isSameDay, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { buildConfirmacaoPacienteMessage, openWhatsApp } from '@/lib/whatsapp';
import { toast } from 'sonner';

/** Lembretes das próximas 48h com envio de WhatsApp em 1 clique e marcação de confirmação */
const ConfirmacoesPendentes = () => {
  const { consultas, pacientes, updateConsulta } = useDentalSystem();

  const proximas = useMemo(() => {
    const hoje = new Date();
    const amanha = addDays(hoje, 1);
    return consultas
      .filter((c) => {
        const d = new Date(c.data);
        return (
          (isSameDay(d, hoje) || isSameDay(d, amanha)) &&
          c.status !== 'cancelado' &&
          c.status !== 'realizado' &&
          (c.confirmacaoStatus || 'pendente') === 'pendente'
        );
      })
      .sort((a, b) => `${format(new Date(a.data), 'yyyy-MM-dd')}${a.hora}`.localeCompare(`${format(new Date(b.data), 'yyyy-MM-dd')}${b.hora}`));
  }, [consultas]);

  const enviar = (consulta: any) => {
    const paciente = pacientes.find((p) => p.id === consulta.pacienteId);
    const mensagem = buildConfirmacaoPacienteMessage({
      pacienteNome: paciente?.nome,
      data: consulta.data,
      hora: consulta.hora,
      dentistaNome: consulta.dentista,
      procedimento: consulta.procedimento,
    });
    if (!openWhatsApp(paciente?.telefone, mensagem)) {
      toast.warning('Paciente sem telefone válido para WhatsApp.');
    }
  };

  const marcarConfirmado = async (id: string) => {
    try {
      await updateConsulta(id, { confirmacaoStatus: 'confirmado', confirmadoEm: new Date(), status: 'confirmado' });
      toast.success('Consulta confirmada');
    } catch {
      toast.error('Não foi possível confirmar');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="h-4 w-4 text-yellow-500" />
          Confirmações pendentes (48h)
          {proximas.length > 0 && <Badge variant="secondary">{proximas.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {proximas.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma consulta aguardando confirmação.</p>
        )}
        {proximas.map((c) => {
          const paciente = pacientes.find((p) => p.id === c.pacienteId);
          return (
            <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border rounded-lg p-2">
              <div className="min-w-0">
                <p className="font-medium truncate">{paciente?.nome || 'Paciente'}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(c.data), "dd 'de' MMM", { locale: ptBR })} às {c.hora} · {c.dentista || 'sem dentista'}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" className="gap-1" onClick={() => enviar(c)}>
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </Button>
                <Button size="sm" variant="outline" className="gap-1 text-green-600" onClick={() => marcarConfirmado(c.id)}>
                  <CheckCircle className="h-4 w-4" />
                  Confirmar
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default ConfirmacoesPendentes;
