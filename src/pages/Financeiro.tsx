
import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  CreditCard,
  AlertCircle,
  Plus
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const mockFinancialData = {
  totalReceived: 45230,
  totalPending: 12350,
  monthlyGrowth: 8.5,
  pendingPayments: [
    {
      id: 1,
      patient: 'Maria Silva',
      procedure: 'Implante',
      amount: 3500,
      dueDate: '2024-01-20',
      status: 'overdue'
    },
    {
      id: 2,
      patient: 'João Santos',
      procedure: 'Ortodontia',
      amount: 450,
      dueDate: '2024-01-25',
      status: 'pending'
    }
  ],
  recentTransactions: [
    {
      id: 1,
      patient: 'Ana Costa',
      procedure: 'Limpeza',
      amount: 150,
      date: '2024-01-15',
      method: 'Cartão',
      status: 'completed'
    },
    {
      id: 2,
      patient: 'Carlos Lima',
      procedure: 'Restauração',
      amount: 350,
      date: '2024-01-14',
      method: 'PIX',
      status: 'completed'
    }
  ]
};

const Financeiro = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Pago';
      case 'pending': return 'Pendente';
      case 'overdue': return 'Vencido';
      default: return status;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Financeiro</h1>
            <p className="text-gray-600">Controle financeiro e faturamento</p>
          </div>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nova Transação
          </Button>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Receita Mensal</p>
                  <p className="text-2xl font-bold text-gray-900">
                    R$ {mockFinancialData.totalReceived.toLocaleString()}
                  </p>
                  <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3" />
                    +{mockFinancialData.monthlyGrowth}% vs mês anterior
                  </p>
                </div>
                <div className="p-3 rounded-full bg-green-500">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Contas a Receber</p>
                  <p className="text-2xl font-bold text-gray-900">
                    R$ {mockFinancialData.totalPending.toLocaleString()}
                  </p>
                  <p className="text-sm text-yellow-600 flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    {mockFinancialData.pendingPayments.length} pendentes
                  </p>
                </div>
                <div className="p-3 rounded-full bg-yellow-500">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Taxa de Conversão</p>
                  <p className="text-2xl font-bold text-gray-900">92%</p>
                  <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3" />
                    +3% esta semana
                  </p>
                </div>
                <div className="p-3 rounded-full bg-blue-500">
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs de Conteúdo */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending">Contas a Receber</TabsTrigger>
            <TabsTrigger value="transactions">Transações</TabsTrigger>
            <TabsTrigger value="reports">Relatórios</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Contas a Receber</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockFinancialData.pendingPayments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-medium">{payment.patient}</div>
                        <div className="text-sm text-gray-600">{payment.procedure}</div>
                        <div className="text-sm text-gray-500">Vencimento: {payment.dueDate}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold">R$ {payment.amount.toLocaleString()}</div>
                        <Badge className={getStatusColor(payment.status)}>
                          {getStatusText(payment.status)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle>Transações Recentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockFinancialData.recentTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-medium">{transaction.patient}</div>
                        <div className="text-sm text-gray-600">{transaction.procedure}</div>
                        <div className="text-sm text-gray-500">
                          {transaction.date} • {transaction.method}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-green-600">
                          R$ {transaction.amount.toLocaleString()}
                        </div>
                        <Badge className={getStatusColor(transaction.status)}>
                          {getStatusText(transaction.status)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Faturamento por Período</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>Janeiro 2024</span>
                      <span className="font-semibold">R$ 45.230</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Dezembro 2023</span>
                      <span className="font-semibold">R$ 41.850</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Novembro 2023</span>
                      <span className="font-semibold">R$ 38.990</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Métodos de Pagamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>PIX</span>
                      <span className="font-semibold">45%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cartão de Crédito</span>
                      <span className="font-semibold">35%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Dinheiro</span>
                      <span className="font-semibold">20%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Financeiro;
