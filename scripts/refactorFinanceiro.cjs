const fs = require('fs');

const path = 'src/pages/Financeiro.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `import { Badge } from '@/components/ui/badge';`,
  `import { Badge } from '@/components/ui/badge';\nimport { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';`
);

// We need to extract the mapping of transactions into a function and add the tabs
// The rendering of the list of transactions starts at {/* Lista de Transações */} and ends at </Card> before FinanceiroDRE

const newRenderFn = `
  const receitas = filteredTransacoes.filter(t => t.tipo === 'receita');
  const despesasTransactions = filteredTransacoes.filter(t => t.tipo === 'despesa');

  const renderTransactions = (transacoesToRender: any[]) => (
    <Card>
      <CardHeader>
        <CardTitle>{transacoesToRender[0]?.tipo === 'despesa' ? 'Contas a Pagar/Pagas' : 'Recebimentos (Faturamento)'}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transacoesToRender.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma transação registrada neste mês</p>
            </div>
          ) : (
            transacoesToRender
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
                      <div className="font-medium">{transacao.tipo === 'despesa' && transacao.parceiroNome ? transacao.parceiroNome : getPacienteName(transacao.pacienteId)}</div>
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
  );
`;

content = content.replace('return (', newRenderFn + '\n  return (');

const cardsResumoRegex = /\{\/\* Cards de Resumo \*\/\}[\s\S]*?(?=<OrcamentosAbertos)/;
const cardsResumoMatch = content.match(cardsResumoRegex);
const cardsResumoHTML = cardsResumoMatch[0];

const orcamentosInadimplenciaRegex = /<OrcamentosAbertos[\s\S]*?<Inadimplencia \/>/;
const orcamentosInadimplenciaMatch = content.match(orcamentosInadimplenciaRegex);
const orcamentosInadimplenciaHTML = orcamentosInadimplenciaMatch[0];

const tabsHTML = \`
        <Tabs defaultValue="geral" className="space-y-6">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto">
            <TabsTrigger value="geral" className="py-2">Visão Geral & DRE</TabsTrigger>
            <TabsTrigger value="pacientes" className="py-2">Pacientes & Faturamento</TabsTrigger>
            <TabsTrigger value="despesas" className="py-2">Despesas do Consultório</TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="space-y-6">
            \${cardsResumoHTML}
            <FinanceiroDRE selectedMonth={selectedMonth} />
          </TabsContent>

          <TabsContent value="pacientes" className="space-y-6">
            \${orcamentosInadimplenciaHTML}
            {renderTransactions(receitas)}
          </TabsContent>

          <TabsContent value="despesas" className="space-y-6">
            {renderTransactions(despesasTransactions)}
            {/* Calendario WebCal de despesas entrará aqui em breve */}
          </TabsContent>
        </Tabs>
\`;

// Remove everything from {/* Cards de Resumo */} up to <FinanceiroDRE ... /> inclusive
const replaceRegex = /\{\/\* Cards de Resumo \*\/\}[\s\S]*?<FinanceiroDRE selectedMonth=\{selectedMonth\} \/>/;
content = content.replace(replaceRegex, tabsHTML);

// Remove the old {/* Lista de Transações */} that might have been left out of the regex if it was after or before
// Actually, the replaceRegex captured EVERYTHING from Cards de Resumo down to FinanceiroDRE, which includes the list of transactions! Perfect.

fs.writeFileSync(path, content, 'utf8');
