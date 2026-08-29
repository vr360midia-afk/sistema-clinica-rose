
import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, TrendingDown, Plus, CreditCard, Receipt, Pencil, Trash2, Handshake, Target } from 'lucide-react';
import TransactionForm from '@/components/financeiro/TransactionForm';
import { registrarAuditoria } from '@/hooks/useAuditLog';
import { useSecurityGate } from '@/context/SecurityContext';
import { useDentalSystem } from '@/context/DentalSystemContext';
import Inadimplencia from '@/components/financeiro/Inadimplencia';
import OrcamentosAbertos from '@/components/financeiro/OrcamentosAbertos';
import { gerarRecibo } from '@/utils/recibo';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { calcularSaldosOrcamentos } from '@/utils/orcamentoSaldo';
import { toast } from 'sonner';
import { formatMoney } from '@/utils/exportCsv';

const Financeiro = () => {
  const { transacoes, pacientes, deleteTransacao } = useDentalSystem();
  const { requireMasterPassword } = useSecurityGate();
  const { configuracoes } = useConfiguracoes();
  const { orcamentos } = useOrcamentos();
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingTransacao, setEditingTransacao] = useState<any | null>(null);

  const handleSaveTransaction = (transactionData: any) => {
    // O TransactionForm já salva através do contexto
    setShowTransactionForm(false);
    setEditingTransacao(null);
  };

  const handleDelete = async (id: string) => {
    const autorizado = await requireMasterPassword('O lançamento será movido para a lixeira por 30 dias.');
    if (!autorizado) return;
    try {
      await deleteTransacao(id);
      await registrarAuditoria({ acao: 'excluir', entidade: 'transacao', entidadeId: id, descricao: 'Transação excluída' });
      toast.success('Transação excluída');
    } catch {
      toast.error('Erro ao excluir transação');
    }
  };

  const totalReceived = transacoes.filter(t => t.status === 'pago' && t.tipo === 'receita').reduce((sum, t) => sum + Number(t.valor || 0), 0);
  const totalPending = transacoes.filter(t => t.status === 'pendente' && t.tipo === 'receita').reduce((sum, t) => sum + Number(t.valor || 0), 0);
  const despesas = transacoes.filter(t => t.tipo === 'despesa');
  const totalDespesas = despesas.reduce((sum, t) => sum + Number(t.valor || 0), 0);
  const totalRepasses = despesas
    .filter(t => t.parceiroId || t.parceiroNome || t.categoria === 'parceria')
    .reduce((sum, t) => sum + Number(t.valor || 0), 0);
  const saldoLiquido = totalReceived - totalDespesas;

  // Saldo em aberto de orçamentos aprovados (já desconta o que foi pago)
  const saldosOrcamentos = calcularSaldosOrcamentos(orcamentos, transacoes);
  const totalOrcamentosAberto = orcamentos
    .filter((o) => o.status === 'aprovado')
    .reduce((sum, o) => sum + (saldosOrcamentos.get(o.id)?.saldo || 0), 0);
  const totalAReceber = totalPending + totalOrcamentosAberto;

  // Projeção de faturamento: orçamentos ainda não aprovados (rascunho/enviado)
  const orcamentosPendentes = orcamentos.filter((o) => o.status !== 'aprovado' && o.status !== 'recusado');
  const totalProjecao = orcamentosPendentes.reduce((sum, o) => sum + Number(o.total || 0), 0);

  const getPacienteName = (pacienteId: string) => {
    const paciente = pacientes.find(p => p.id === pacienteId);
    return paciente?.nome || 'Paciente não encontrado';
  };

  const emitirRecibo = async (transacao: any) => {
    const t = toast.loading('Gerando recibo...');
    const ok = await gerarRecibo(
      {
        numero: String(transacao.id).slice(0, 8).toUpperCase(),
        pacienteNome: transacao.pacienteNome || getPacienteName(transacao.pacienteId),
        descricao: transacao.descricao,
        valor: Number(transacao.valor || 0),
        data: transacao.data,
        metodoPagamento: transacao.metodoPagamento,
        parcelas: transacao.parcelas,
        valorParcela: transacao.valorParcela,
      },
      configuracoes
    );
    toast.dismiss(t);
    if (ok) toast.success('Recibo baixado');
    else toast.error('Não foi possível gerar o recibo');
  };


  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Financeiro</h1>
            <p className="text-muted-foreground">Controle financeiro e faturamento</p>
          </div>
          <Button onClick={() => { setEditingTransacao(null); setShowTransactionForm(true); }} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nova Transação
          </Button>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Recebido</p>
                  <p className="text-xl sm:text-2xl font-bold text-green-600">{formatMoney(totalReceived)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">A Receber</p>
                  <p className="text-xl sm:text-2xl font-bold text-yellow-600">{formatMoney(totalAReceber)}</p>
                  {totalOrcamentosAberto > 0 && (
                    <p className="text-[11px] text-muted-foreground">Orçamentos aprovados: {formatMoney(totalOrcamentosAberto)}</p>
                  )}
                </div>
                <TrendingDown className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Despesas / Parcerias</p>
                  <p className="text-xl sm:text-2xl font-bold text-red-500">{formatMoney(totalDespesas)}</p>
                  <p className="text-[11px] text-muted-foreground">Repasses a parceiros: {formatMoney(totalRepasses)}</p>
                </div>
                <Handshake className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Líquido (recebido - despesas)</p>
                  <p className={`text-xl sm:text-2xl font-bold ${saldoLiquido >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatMoney(saldoLiquido)}</p>
                  <p className="text-[11px] text-muted-foreground">Previsto c/ a receber: {formatMoney((saldoLiquido + totalAReceber))}</p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <OrcamentosAbertos
          onLancarPagamento={(prefill) => {
            setEditingTransacao(prefill);
            setShowTransactionForm(true);
          }}
        />

        <Inadimplencia />

        {/* Lista de Transações */}
        <Card>
          <CardHeader>
            <CardTitle>Transações Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transacoes.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhuma transação registrada</p>
                </div>
              ) : (
                transacoes
                  .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                  .map((transacao) => (
                    <div key={transacao.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-full bg-blue-100">
                          {transacao.metodoPagamento === 'cartao' ? (
                            <CreditCard className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Receipt className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{getPacienteName(transacao.pacienteId)}</div>
                          <div className="text-sm text-muted-foreground">
                            {transacao.descricao}
                          </div>
                          <div className="text-sm text-muted-foreground">{new Date(transacao.data).toLocaleDateString('pt-BR')}</div>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="font-semibold">{formatMoney(transacao.valor)}</div>
                        <Badge 
                          className={transacao.status === 'pago' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                          }
                        >
                          {transacao.status === 'pago' ? 'Pago' : 'Pendente'}
                        </Badge>
                        <div className="flex flex-wrap justify-end gap-1 pt-1">
                          {transacao.tipo === 'receita' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => emitirRecibo(transacao)}
                            >
                              <Receipt className="h-3.5 w-3.5" />
                              Recibo
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => { setEditingTransacao(transacao); setShowTransactionForm(true); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-destructive"
                            onClick={() => handleDelete(transacao.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>

        <TransactionForm
          isOpen={showTransactionForm}
          onClose={() => { setShowTransactionForm(false); setEditingTransacao(null); }}
          onSave={handleSaveTransaction}
          transacao={editingTransacao}
        />
      </div>
    </Layout>
  );
};

export default Financeiro;
