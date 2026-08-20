import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, History } from 'lucide-react';
import { OdontogramaVersao, ToothStatusMap } from '@/hooks/useOdontograma';
import { ALL_TEETH, LOWER_TEETH, UPPER_TEETH, treatmentColor, treatmentLabel } from '@/lib/odontograma';

interface Props {
  versoes: OdontogramaVersao[];
  atual: ToothStatusMap;
}

const MiniArcada = ({ dados, destaque }: { dados: ToothStatusMap; destaque: Set<string> }) => {
  const renderTooth = (n: number) => (
    <div
      key={n}
      title={`Dente ${n} — ${treatmentLabel(dados[String(n)])}`}
      className={`w-6 h-8 border rounded-sm flex items-center justify-center ${treatmentColor(dados[String(n)])} ${
        destaque.has(String(n)) ? 'border-primary border-2 ring-1 ring-primary/50' : 'border-border'
      }`}
    >
      <span className="text-[9px] font-semibold text-foreground mix-blend-difference">{n}</span>
    </div>
  );

  return (
    <div className="space-y-2 overflow-x-auto">
      <div className="flex gap-0.5 min-w-[430px]">{UPPER_TEETH.map(renderTooth)}</div>
      <div className="flex gap-0.5 min-w-[430px]">{LOWER_TEETH.map(renderTooth)}</div>
    </div>
  );
};

const OdontogramaComparativo = ({ versoes, atual }: Props) => {
  const opcoes = React.useMemo(
    () => [
      ...versoes.map((v) => ({
        id: v.id,
        label: `${v.criadoEm.toLocaleDateString('pt-BR')} ${v.criadoEm.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })}${v.observacoes ? ` — ${v.observacoes}` : ''}`,
        dados: v.dados,
      })),
      { id: 'atual', label: 'Estado atual (não salvo)', dados: atual },
    ],
    [versoes, atual]
  );

  const [antesId, setAntesId] = React.useState<string>('');
  const [depoisId, setDepoisId] = React.useState<string>('');

  React.useEffect(() => {
    if (!opcoes.length) return;
    setAntesId((prev) => (prev && opcoes.some((o) => o.id === prev) ? prev : opcoes[opcoes.length - 2]?.id || opcoes[0].id));
    setDepoisId((prev) => (prev && opcoes.some((o) => o.id === prev) ? prev : opcoes[0].id));
  }, [opcoes]);

  const antes = opcoes.find((o) => o.id === antesId)?.dados || {};
  const depois = opcoes.find((o) => o.id === depoisId)?.dados || {};

  const mudancas = ALL_TEETH.map((n) => {
    const a = antes[String(n)] || 'healthy';
    const d = depois[String(n)] || 'healthy';
    return { dente: n, de: a, para: d, mudou: a !== d };
  }).filter((m) => m.mudou);

  const destaque = new Set(mudancas.map((m) => String(m.dente)));

  // Evolução por dente ao longo do tempo (usa todas as versões, mais antigas primeiro)
  const [denteFoco, setDenteFoco] = React.useState<string>('');
  const linhaDoTempo = React.useMemo(() => {
    if (!denteFoco) return [];
    const ordenadas = [...versoes].sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime());
    const eventos: { data: Date; status: string }[] = [];
    let ultimo: string | null = null;
    ordenadas.forEach((v) => {
      const status = v.dados[denteFoco] || 'healthy';
      if (status !== ultimo) {
        eventos.push({ data: v.criadoEm, status });
        ultimo = status;
      }
    });
    return eventos;
  }, [denteFoco, versoes]);

  if (!versoes.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma versão arquivada ainda. Salve o odontograma para começar o histórico comparativo.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Comparativo antes / depois
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Antes</p>
              <Select value={antesId} onValueChange={setAntesId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {opcoes.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-3"><MiniArcada dados={antes} destaque={destaque} /></div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Depois</p>
              <Select value={depoisId} onValueChange={setDepoisId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {opcoes.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-3"><MiniArcada dados={depois} destaque={destaque} /></div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">
              Mudanças detectadas: <span className="text-muted-foreground">{mudancas.length}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {mudancas.map((m) => (
                <Badge
                  key={m.dente}
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => setDenteFoco(String(m.dente))}
                >
                  {m.dente}: {treatmentLabel(m.de)} <ArrowRight className="h-3 w-3 mx-1" /> {treatmentLabel(m.para)}
                </Badge>
              ))}
              {!mudancas.length && <span className="text-sm text-muted-foreground">Nenhuma alteração entre as versões.</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Evolução por dente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={denteFoco} onValueChange={setDenteFoco}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Selecione um dente" /></SelectTrigger>
            <SelectContent>
              {ALL_TEETH.map((n) => (
                <SelectItem key={n} value={String(n)}>Dente {n}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {denteFoco && (
            linhaDoTempo.length ? (
              <ol className="relative border-l border-border pl-4 space-y-3">
                {linhaDoTempo.map((e, i) => (
                  <li key={i} className="relative">
                    <span className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border border-border ${treatmentColor(e.status)}`} />
                    <p className="text-sm font-medium">{treatmentLabel(e.status)}</p>
                    <p className="text-xs text-muted-foreground">{e.data.toLocaleString('pt-BR')}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">Sem registros para este dente.</p>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OdontogramaComparativo;
