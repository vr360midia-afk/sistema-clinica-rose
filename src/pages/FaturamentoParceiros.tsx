import React, { useMemo, useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Handshake, TrendingUp, Wallet, Receipt, Users } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { useParceiros } from '@/hooks/useParceiros';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const FaturamentoParceiros = () => {
  const { transacoes } = useDentalSystem();
  const { parceiros } = useParceiros();
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [parceiroFiltro, setParceiroFiltro] = useState<string>('todos');

  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()]);
    transacoes.forEach((t: any) => {
      const d = new Date(t.data);
      if (!isNaN(d.getTime())) set.add(d.getFullYear());
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [transacoes]);

  // Transações com parceiro no ano selecionado
  const comParceiro = useMemo(
    () =>
      transacoes.filter((t: any) => {
        if (!t.parceiroId && !t.parceiroNome) return false;
        const d = new Date(t.data);
        if (isNaN(d.getTime()) || d.getFullYear() !== ano) return false;
        if (parceiroFiltro !== 'todos' && t.parceiroId !== parceiroFiltro) return false;
        return true;
      }),
    [transacoes, ano, parceiroFiltro]
  );

  const resumo = useMemo(() => {
    const totalBruto = comParceiro.reduce((s, t: any) => s + Number(t.valor || 0), 0);
    const totalRepasse = comParceiro.reduce((s, t: any) => s + Number(t.valorParceiro || 0), 0);
    return {
      totalBruto,
      totalRepasse,
      resultadoClinica: totalBruto - totalRepasse,
      lancamentos: comParceiro.length,
    };
  }, [comParceiro]);

  const porParceiro = useMemo(() => {
    const map = new Map<string, { nome: string; bruto: number; repasse: number; qtd: number }>();
    comParceiro.forEach((t: any) => {
      const key = t.parceiroId || t.parceiroNome || 'desconhecido';
      const nome = t.parceiroNome || 'Parceiro removido';
      const cur = map.get(key) || { nome, bruto: 0, repasse: 0, qtd: 0 };
      cur.bruto += Number(t.valor || 0);
      cur.repasse += Number(t.valorParceiro || 0);
      cur.qtd += 1;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.repasse - a.repasse);
  }, [comParceiro]);

  const porMes = useMemo(() => {
    const base = MESES.map((m) => ({ mes: m, Bruto: 0, Repasse: 0 }));
    comParceiro.forEach((t: any) => {
      const d = new Date(t.data);
      if (isNaN(d.getTime())) return;
      const idx = d.getMonth();
      base[idx].Bruto += Number(t.valor || 0);
      base[idx].Repasse += Number(t.valorParceiro || 0);
    });
    return base;
  }, [comParceiro]);

  const cards = [
    { titulo: 'Faturamento c/ parceiros', valor: formatBRL(resumo.totalBruto), icon: TrendingUp },
    { titulo: 'Total repassado', valor: formatBRL(resumo.totalRepasse), icon: Handshake },
    { titulo: 'Resultado da clínica', valor: formatBRL(resumo.resultadoClinica), icon: Wallet },
    { titulo: 'Lançamentos', valor: String(resumo.lancamentos), icon: Receipt },
  ];

  return (
    <Layout>
      <div className="p-3 sm:p-6 space-y-4 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Handshake className="h-6 w-6" />
              Faturamento de Parceiros
            </h1>
            <p className="text-sm text-muted-foreground">
              Visão dos repasses e faturamento vinculado a parceiros.
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anosDisponiveis.map((a) => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={parceiroFiltro} onValueChange={setParceiroFiltro}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Parceiro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os parceiros</SelectItem>
                {parceiros.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map((c) => (
            <Card key={c.titulo}>
              <CardHeader className="pb-1 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">{c.titulo}</CardTitle>
                <c.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-lg sm:text-xl font-bold">{c.valor}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução mensal ({ano})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porMes}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mes" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => formatBRL(value)}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                  />
                  <Legend />
                  <Bar dataKey="Bruto" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Repasse" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Por parceiro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {porParceiro.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum lançamento com parceiro no período selecionado.
              </p>
            )}
            {porParceiro.map((p) => {
              const pct = p.bruto > 0 ? (p.repasse / p.bruto) * 100 : 0;
              return (
                <div key={p.nome} className="border rounded-lg p-3 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="font-medium truncate">{p.nome}</p>
                      <Badge variant="secondary">{p.qtd} lançamento{p.qtd !== 1 ? 's' : ''}</Badge>
                    </div>
                    <div className="text-sm text-right">
                      <span className="text-muted-foreground">Bruto {formatBRL(p.bruto)}</span>
                      <span className="mx-2">•</span>
                      <span className="font-semibold">Repasse {formatBRL(p.repasse)}</span>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{pct.toFixed(1)}% repassado sobre o bruto</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default FaturamentoParceiros;
