
import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, TrendingDown, Plus, CreditCard, Receipt } from 'lucide-react';
import TransactionForm from '@/components/financeiro/TransactionForm';

const Financeiro = () => {
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [transactions, setTransactions] = useState([
    {
      id: 1,
      patientName: 'Maria Silva',
      date: '15/01/2024',
      amount: 350,
      status: 'Pago',
      paymentMethod: 'cartao',
      procedures: ['Limpeza', 'Restauração']
    },
    {
      id: 2,
      patientName: 'João Santos',
      date: '10/01/2024',
      amount: 150,
      status: 'Pendente',
      paymentMethod: 'boleto',
      procedures: ['Consulta']
    }
  ]);

  const handleSaveTransaction = (transactionData: any) => {
    setTransactions(prev => [...prev, transactionData]);
    setShowTransactionForm(false);
  };

  const totalReceived = transactions.filter(t => t.status === 'Pago').reduce((sum, t) => sum + t.amount, 0);
  const totalPending = transactions.filter(t => t.status === 'Pendente').reduce((sum, t) => sum + t.amount, 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Financeiro</h1>
            <p className="text-gray-600">Controle financeiro e faturamento</p>
          </div>
          <Button onClick={() => setShowTransactionForm(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nova Transação
          </Button>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Recebido</p>
                  <p className="text-2xl font-bold text-green-600">R$ {totalReceived.toFixed(2)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">A Receber</p>
                  <p className="text-2xl font-bold text-yellow-600">R$ {totalPending.toFixed(2)}</p>
                </div>
                <TrendingDown className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Geral</p>
                  <p className="text-2xl font-bold">R$ {(totalReceived + totalPending).toFixed(2)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Transações */}
        <Card>
          <CardHeader>
            <CardTitle>Transações Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-full bg-blue-100">
                      {transaction.paymentMethod === 'cartao' ? (
                        <CreditCard className="h-5 w-5 text-blue-600" />
                      ) : (
                        <Receipt className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium">{transaction.patientName}</div>
                      <div className="text-sm text-gray-600">
                        {transaction.procedures.join(', ')}
                      </div>
                      <div className="text-sm text-gray-500">{transaction.date}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">R$ {transaction.amount.toFixed(2)}</div>
                    <Badge 
                      className={transaction.status === 'Pago' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                      }
                    >
                      {transaction.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <TransactionForm
          isOpen={showTransactionForm}
          onClose={() => setShowTransactionForm(false)}
          onSave={handleSaveTransaction}
        />
      </div>
    </Layout>
  );
};

export default Financeiro;
