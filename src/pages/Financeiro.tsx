
import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, TrendingDown, Plus, CreditCard, Receipt, Pencil, Trash2 } from 'lucide-react';
import TransactionForm from '@/components/financeiro/TransactionForm';
import { registrarAuditoria } from '@/hooks/useAuditLog';
import { useDentalSystem } from '@/context/DentalSystemContext';
import Inadimplencia from '@/components/financeiro/Inadimplencia';
import { gerarRecibo } from '@/utils/recibo';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { toast } from 'sonner';

const Financeiro = () => {
  const { transacoes, pacientes, deleteTransacao } = useDentalSystem();
  const { configuracoes } = useConfiguracoes();
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingTransacao, setEditingTransacao] = useState<any | null>(null);

  const handleSaveTransaction = (transactionData: any) => {
    // O TransactionForm já salva através do contexto
    setShowTransactionForm(false);
    setEditingTransacao(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir esta transação?')) return;
    try {
      await deleteTransacao(id);
      await registrarAuditoria({ acao: 'excluir', entidade: 'transacao', entidadeId: id, descricao: 'Transação excluída' });
      toast.success('Transação excluída');
    } catch {
      toast.error('Erro ao excluir transação');
    }
  };

  const totalReceived = transacoes.filter(t => t.status === 'pago' && t.tipo === 'receita').reduce((sum, t) => sum + t.valor, 0);
  const totalPending = transacoes.filter(t => t.status === 'pendente' && t.tipo === 'receita').reduce((sum, t) => sum + t.valor, 0);

  const getPacienteName = (pacienteId: string) => {
    const paciente = pacientes.find(p => p.id === pacienteId);
    return paciente?.nome || 'Paciente não encontrado';
  };

  const emitirRecibo = (transacao: any) => {
    const ok = gerarRecibo(
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
    if (!ok) toast.error('Permita pop-ups para emitir o recibo');
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Recebido</p>
                  <p className="text-xl sm:text-2xl font-bold text-green-600">R$ {totalReceived.toFixed(2)}</p>
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
                  <p className="text-xl sm:text-2xl font-bold text-yellow-600">R$ {totalPending.toFixed(2)}</p>
                </div>
                <TrendingDown className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Geral</p>
                  <p className="text-xl sm:text-2xl font-bold">R$ {(totalReceived + totalPending).toFixed(2)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>

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
                        <div className="font-semibold">R$ {transacao.valor.toFixed(2)}</div>
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
