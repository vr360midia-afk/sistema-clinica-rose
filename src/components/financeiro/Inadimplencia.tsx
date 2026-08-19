import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, MessageCircle, CheckCircle2 } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { openWhatsApp } from '@/lib/whatsapp';
import { formatMoney } from '@/utils/exportCsv';
import { toast } from 'sonner';

const diasAtraso = (vencimento: Date) =>
  Math.floor((Date.now() - vencimento.getTime()) / (1000 * 60 * 60 * 24));

const Inadimplencia = () => {
  const { transacoes, pacientes, updateTransacao } = useDentalSystem();
  const [salvando, setSalvando] = useState<string | null>(null);

  const pendentes = useMemo(() => {
    return transacoes
      .filter((t) => t.tipo === 'receita' && (t.status === 'pendente' || t.status === 'vencido'))
      .map((t) => {
        const venc = new Date((t.vencimento as any) || t.data);
        return { t, venc, dias: diasAtraso(venc) };
      })
      .filter((i) => !isNaN(i.venc.getTime()) && i.dias > 0)
      .sort((a, b) => b.dias - a.dias);
  }, [transacoes]);

  const totalAtraso = pendentes.reduce((s, i) => s + Number(i.t.valor || 0), 0);

  const getPaciente = (id: string) => pacientes.find((p) => p.id === id);

  const cobrar = (item: (typeof pendentes)[number]) => {
    const paciente = getPaciente(item.t.pacienteId);
    const msg = [
      `Olá${paciente?.nome ? `, ${paciente.nome}` : ''}!`,
      '',
      'Identificamos um pagamento em aberto:',
      item.t.descricao ? `Referente a: ${item.t.descricao}` : null,
      `Valor: ${formatMoney(Number(item.t.valor || 0))}`,
      `Vencimento: ${item.venc.toLocaleDateString('pt-BR')} (${item.dias} dia(s) em atraso)`,
      '',
      'Pode nos confirmar a melhor forma de regularizar? Obrigado!',
    ]
      .filter(Boolean)
      .join('\n');

    if (!openWhatsApp(paciente?.telefone, msg)) {
      toast.error('Paciente sem telefone válido cadastrado');
    }
  };

  const marcarPago = async (id: string) => {
    setSalvando(id);
    try {
      await updateTransacao(id, { status: 'pago' });
      toast.success('Pagamento registrado');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível atualizar a transação');
    } finally {
      setSalvando(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          Inadimplência
          {pendentes.length > 0 && (
            <Badge variant="destructive" className="ml-1">
              {pendentes.length} • {formatMoney(totalAtraso)}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pendentes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum pagamento em atraso. Tudo em dia!
          </p>
        ) : (
          <div className="space-y-3">
            {pendentes.map((item) => {
              const paciente = getPaciente(item.t.pacienteId);
              return (
                <div
                  key={item.t.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{paciente?.nome || 'Paciente'}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">
                      {item.t.descricao || 'Sem descrição'}
                    </p>
                    <p className="text-xs text-red-500">
                      Venc. {item.venc.toLocaleDateString('pt-BR')} • {item.dias} dia(s) em atraso
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold">{formatMoney(Number(item.t.valor || 0))}</span>
                    <Button size="sm" variant="outline" onClick={() => cobrar(item)}>
                      <MessageCircle className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Cobrar</span>
                    </Button>
                    <Button
                      size="sm"
                      disabled={salvando === item.t.id}
                      onClick={() => marcarPago(item.t.id)}
                    >
                      <CheckCircle2 className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Pago</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Inadimplencia;
