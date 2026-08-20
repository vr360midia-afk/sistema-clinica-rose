import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import { useBloqueios, toISODate } from '@/hooks/useBloqueios';
import { useDentistas } from '@/hooks/useDentistas';
import { toast } from 'sonner';

const hoje = toISODate(new Date());

const BloqueiosManager = () => {
  const { bloqueios, loading, addBloqueio, deleteBloqueio } = useBloqueios();
  const { dentistas } = useDentistas();

  const [titulo, setTitulo] = useState('');
  const [dentista, setDentista] = useState('todos');
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState(hoje);
  const [diaInteiro, setDiaInteiro] = useState(true);
  const [horaInicio, setHoraInicio] = useState('12:00');
  const [horaFim, setHoraFim] = useState('13:00');

  const handleAdd = async () => {
    if (!titulo.trim()) {
      toast.error('Informe um título para o bloqueio');
      return;
    }
    if (dataFim < dataInicio) {
      toast.error('A data final não pode ser anterior à inicial');
      return;
    }
    await addBloqueio({
      titulo: titulo.trim(),
      dentista: dentista === 'todos' ? null : dentista,
      dataInicio,
      dataFim,
      diaInteiro,
      horaInicio,
      horaFim,
    });
    setTitulo('');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <CalendarOff className="h-5 w-5 text-primary" />
          Bloqueios de agenda
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Férias, feriados e horário de almoço. Consultas não podem ser marcadas nos períodos bloqueados.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Férias / Almoço" maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label>Dentista</Label>
            <Select value={dentista} onValueChange={setDentista}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {dentistas.filter((d) => d.ativo).map((d) => (
                  <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>De</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Até</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch checked={diaInteiro} onCheckedChange={setDiaInteiro} id="dia-inteiro" />
            <Label htmlFor="dia-inteiro">Dia inteiro</Label>
          </div>
          {!diaInteiro && (
            <>
              <div className="space-y-1.5">
                <Label>Hora início</Label>
                <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Hora fim</Label>
                <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
              </div>
            </>
          )}
        </div>

        <Button onClick={handleAdd} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar bloqueio
        </Button>

        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : bloqueios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum bloqueio cadastrado.</p>
          ) : (
            bloqueios.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{b.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.dataInicio.split('-').reverse().join('/')} até {b.dataFim.split('-').reverse().join('/')}
                    {b.diaInteiro ? ' • dia inteiro' : ` • ${b.horaInicio} - ${b.horaFim}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="secondary">{b.dentista || 'Todos'}</Badge>
                  <Button variant="ghost" size="icon" onClick={() => deleteBloqueio(b.id)} aria-label="Remover bloqueio">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default BloqueiosManager;
