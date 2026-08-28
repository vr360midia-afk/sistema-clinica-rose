import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, CalendarClock, DollarSign, TrendingUp, AlertTriangle, Stethoscope, MessageCircle, Loader2, ListChecks, Plus, Pencil, Trash2 } from 'lucide-react';
import { useSecurityGate } from '@/context/SecurityContext';
import { useDentalSystem } from '@/context/DentalSystemContext';
import EmptyState from '@/components/common/EmptyState';
import TransactionForm from '@/components/financeiro/TransactionForm';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { openWhatsApp, buildExtratoMessage } from '@/lib/whatsapp';
import { toast } from 'sonner';
import { formatMoney } from '@/utils/exportCsv';

interface PatientFinancialProps {
  patient: any;
}

const brl = (v: number) => `${formatMoney(Number(v || 0))}`;

const PatientFinancial = ({ patient }: PatientFinancialProps) => {
  const { consultas, prontuarios, transacoes, deleteTransacao } = useDentalSystem();
  const { requireMasterPassword } = useSecurityGate();
  const { user } = useAuth();
  const { configuracoes } = useConfiguracoes();
  const [enviando, setEnviando] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingTransacao, setEditingTransacao] = useState<any | null>(null);


  const { realizados, previstos, etapas, resumo, lancamentos } = useMemo(() => {
    const cons = consultas.filter((c) => c.pacienteId === patient.id);
    const pront = prontuarios.filter((p) => p.pacienteId === patient.id);
    const trans = transacoes.filter((t) => t.pacienteId === patient.id);

    const realizados = [
      ...cons
        .filter((c) => c.status === 'realizado')
        .map((c) => ({
          id: `c-${c.id}`,
          nome: c.procedimento || 'Consulta',
          data: new Date(c.data),
          valor: Number(c.valor || 0),
          origem: 'Consulta',
          dentista: c.dentista,
        })),
      ...pront.flatMap((p) =>
        (p.procedimentosRealizados || []).map((nome: any, i: number) => ({
          id: `p-${p.id}-${i}`,
          nome: typeof nome === 'string' ? nome : nome?.nome || 'Procedimento',
          data: new Date(p.data),
          valor: typeof nome === 'object' ? Number(nome?.valor || 0) : 0,
          origem: 'Prontuário',
          dentista: undefined as string | undefined,
        }))
      ),
    ].sort((a, b) => b.data.getTime() - a.data.getTime());

    const previstos = cons
      .filter((c) => ['agendado', 'confirmado'].includes(c.status))
      .map((c) => ({
        id: `f-${c.id}`,
        nome: c.procedimento || 'Consulta',
        data: new Date(c.data),
        valor: Number(c.valor || 0),
        status: c.status,
        hora: c.hora,
        dentista: c.dentista,
      }))
      .sort((a, b) => a.data.getTime() - b.data.getTime());

    const receitas = trans.filter((t) => t.tipo === 'receita');
    const pago = receitas.filter((t) => t.status === 'pago').reduce((s, t) => s + Number(t.valor || 0), 0);
    const pendente = receitas.filter((t) => t.status === 'pendente').reduce((s, t) => s + Number(t.valor || 0), 0);
    const vencido = receitas
      .filter((t) => t.status === 'vencido' || (t.status === 'pendente' && t.vencimento && new Date(t.vencimento) < new Date()))
      .reduce((s, t) => s + Number(t.valor || 0), 0);
    const total = pago + pendente;
    const previstoValor = previstos.reduce((s, p) => s + p.valor, 0);

    const etapasMap = new Map<string, any>();
    cons
      .filter((c) => ['realizado', 'agendado', 'confirmado'].includes(c.status))
      .forEach((c) => {
        const key = new Date(c.data).toISOString().slice(0, 10);
        const item = etapasMap.get(key) || { data: new Date(c.data), itens: [], valor: 0, status: c.status };
        item.itens.push({
          nome: c.procedimento || 'Consulta',
          valor: Number(c.valor || 0),
          status: c.status,
          hora: c.hora,
          dentista: c.dentista,
          origem: 'Consulta',
        });
        item.valor += Number(c.valor || 0);
        etapasMap.set(key, item);
      });
    pront.forEach((p) => {
      const key = new Date(p.data).toISOString().slice(0, 10);
      const item = etapasMap.get(key) || { data: new Date(p.data), itens: [], valor: 0, status: 'realizado' };
      (p.procedimentosRealizados || []).forEach((n: any) => {
        item.itens.push({
          nome: typeof n === 'string' ? n : n?.nome || 'Procedimento',
          valor: typeof n === 'object' ? Number(n?.valor || 0) : 0,
          status: 'realizado',
          origem: 'Prontuário',
        });
        item.valor += typeof n === 'object' ? Number(n?.valor || 0) : 0;
      });
      etapasMap.set(key, item);
    });
    const etapas = Array.from(etapasMap.values()).sort((a, b) => a.data.getTime() - b.data.getTime());

    return {
      realizados,
      previstos,
      etapas,
      resumo: { pago, pendente, vencido, total, previstoValor },
      lancamentos: receitas.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()),
    };
  }, [consultas, prontuarios, transacoes, patient.id]);

  const percentPago = resumo.total > 0 ? Math.round((resumo.pago / resumo.total) * 100) : 0;

  const enviarParaAssinar = async () => {
    if (!patient.telefone) {
      toast.error('Paciente sem telefone cadastrado.');
      return;
    }
    setEnviando(true);
    try {
      const token = crypto.randomUUID().replace(/-/g, '');
      const payload = {
        user_id: user?.id,
        paciente_id: patient.id,
        paciente_nome: patient.nome,
        dados: {
          clinicaNome: configuracoes?.nomeClinica || '',
          logoUrl: configuracoes?.logoUrl || '',
          realizados: realizados.map((r) => ({ nome: r.nome, valor: r.valor, data: r.data.toLocaleDateString('pt-BR') })),
          previstos: previstos.map((p) => ({ nome: p.nome, valor: p.valor, data: p.data.toLocaleDateString('pt-BR') })),
          pagamentos: lancamentos.map((t: any) => ({
            descricao: t.descricao || 'Pagamento',
            valor: Number(t.valor || 0),
            status: t.status,
            data: new Date(t.data).toLocaleDateString('pt-BR'),
          })),
        },
        total_pago: resumo.pago,
        total_pendente: resumo.pendente,
        total_previsto: resumo.previstoValor,
        total: resumo.total,
        token_assinatura: token,
        data_expiracao_link: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status_assinatura: 'pendente',
      };

      const { data, error } = await supabase
        .from('extratos_financeiros')
        .insert(payload as any)
        .select('id')
        .single();
      if (error) throw error;

      const link = `${window.location.origin}/assinar-extrato/${data.id}?token=${token}`;
      const msg = buildExtratoMessage({
        pacienteNome: patient.nome,
        clinicaNome: configuracoes?.nomeClinica || undefined,
        totalPago: resumo.pago,
        totalPendente: resumo.pendente,
        totalPrevisto: resumo.previstoValor,
        link,
      });

      if (!openWhatsApp(patient.telefone, msg)) {
        toast.error('Telefone inválido para WhatsApp.');
        return;
      }
      toast.success('Extrato gerado e WhatsApp aberto.');
    } catch (e: any) {
      toast.error('Erro ao gerar extrato', { description: e?.message });
    } finally {
      setEnviando(false);
    }
  };


  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-muted-foreground">Resumo financeiro e tratamento do paciente</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setEditingTransacao(null); setShowTransactionForm(true); }}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-1" />
            Novo
          </Button>
          <Button onClick={enviarParaAssinar} disabled={enviando} className="w-full sm:w-auto">
            {enviando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-2" />}
            Enviar para assinar (WhatsApp)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Pago</p>
                <p className="text-base sm:text-xl font-bold text-emerald-500 truncate">{brl(resumo.pago)}</p>
              </div>
              <TrendingUp className="h-5 w-5 text-emerald-500 shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Em aberto</p>
                <p className="text-base sm:text-xl font-bold text-amber-500 truncate">{brl(resumo.pendente)}</p>
              </div>
              <DollarSign className="h-5 w-5 text-amber-500 shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Vencido</p>
                <p className="text-base sm:text-xl font-bold text-destructive truncate">{brl(resumo.vencido)}</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Previsto (agenda)</p>
                <p className="text-base sm:text-xl font-bold truncate">{brl(resumo.previstoValor)}</p>
              </div>
              <CalendarClock className="h-5 w-5 text-muted-foreground shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Quitação do tratamento</span>
            <span className="font-medium">{percentPago}% · {brl(resumo.pago)} de {brl(resumo.total)}</span>
          </div>
          <Progress value={percentPago} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-3 sm:p-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            Passo a passo por consulta ({etapas.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 pt-0">
          {etapas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma consulta registrada.</p>
          ) : (
            <ol className="relative border-l border-border ml-2 space-y-4">
              {etapas.map((e: any, idx: number) => (
                <li key={idx} className="ml-4">
                  <span className="absolute -left-[7px] flex h-3 w-3 rounded-full bg-primary" />
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-medium">
                      Etapa {idx + 1} · {e.data.toLocaleDateString('pt-BR')}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant={e.status === 'realizado' ? 'default' : 'secondary'} className="text-[10px]">
                        {e.status === 'realizado' ? 'realizado' : 'previsto'}
                      </Badge>
                      {e.valor > 0 && <span className="text-sm font-semibold">{brl(e.valor)}</span>}
                    </div>
                  </div>
                  <ul className="mt-1 space-y-1">
                    {e.itens.map((it: any, i: number) => (
                      <li key={i} className="text-xs text-muted-foreground flex justify-between gap-2">
                        <span className="truncate">
                          • {it.nome}
                          {it.hora ? ` · ${it.hora}` : ''}
                          {it.dentista ? ` · ${it.dentista}` : ''}
                          {` · ${it.origem}`}
                        </span>
                        {it.valor > 0 && <span className="shrink-0">{brl(it.valor)}</span>}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>



      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="p-3 sm:p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Procedimentos realizados ({realizados.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 space-y-2">
            {realizados.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum procedimento realizado.</p>
            ) : (
              realizados.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 border rounded-md p-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.data.toLocaleDateString('pt-BR')}
                      {r.dentista ? ` • ${r.dentista}` : ''} • {r.origem}
                    </p>
                  </div>
                  {r.valor > 0 && <span className="text-sm font-semibold shrink-0">{brl(r.valor)}</span>}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 sm:p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-blue-500" />
              Previstos ({previstos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 space-y-2">
            {previstos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum procedimento agendado.</p>
            ) : (
              previstos.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 border rounded-md p-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.data.toLocaleDateString('pt-BR')}
                      {p.hora ? ` às ${p.hora}` : ''}
                      {p.dentista ? ` • ${p.dentista}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-[10px]">{p.status}</Badge>
                    {p.valor > 0 && <span className="text-sm font-semibold">{brl(p.valor)}</span>}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-3 sm:p-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-muted-foreground" />
            Pagamentos ({lancamentos.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 pt-0 space-y-2">
          {lancamentos.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="Sem lançamentos"
              description="Ainda não há pagamentos registrados para este paciente."
            />
          ) : (
            lancamentos.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between gap-2 border rounded-md p-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{t.descricao || 'Pagamento'}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(t.data).toLocaleDateString('pt-BR')}
                    {t.metodoPagamento ? ` • ${t.metodoPagamento}` : ''}
                    {t.parcelas && t.parcelas > 1 ? ` • ${t.parcelas}x ${brl(t.valorParcela || 0)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={t.status === 'pago' ? 'default' : t.status === 'vencido' ? 'destructive' : 'secondary'}
                    className="text-[10px]"
                  >
                    {t.status}
                  </Badge>
                  <span className="text-sm font-semibold">{brl(t.valor)}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => { setEditingTransacao(t); setShowTransactionForm(true); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={async () => {
                      const autorizado = await requireMasterPassword('O lançamento será movido para a lixeira por 30 dias.');
                      if (!autorizado) return;
                      try {
                        await deleteTransacao(t.id);
                        toast.success('Lançamento excluído');
                      } catch {
                        toast.error('Erro ao excluir lançamento');
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {showTransactionForm && (
        <TransactionForm
          isOpen={showTransactionForm}
          onClose={() => { setShowTransactionForm(false); setEditingTransacao(null); }}
          onSave={() => { setShowTransactionForm(false); setEditingTransacao(null); }}
          transacao={editingTransacao || { pacienteId: patient.id, pacienteNome: patient.nome }}
        />
      )}
    </div>
  );
};

export default PatientFinancial;
