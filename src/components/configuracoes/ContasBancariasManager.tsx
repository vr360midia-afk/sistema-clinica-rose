import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Wallet,
  RotateCcw,
  Star,
  Receipt,
  QrCode,
  CreditCard,
  Banknote,
} from 'lucide-react';
import { useContasBancarias } from '@/hooks/useContasBancarias';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { formatMoney } from '@/utils/exportCsv';
import { ModalContasBancarias } from '@/components/financeiro/ModalContasBancarias';
import { ContaBancaria } from '@/types/contaBancaria';
import { toast } from 'sonner';

export const ContasBancariasManager: React.FC = () => {
  const {
    contas,
    contasAtivas,
    contaPadraoPix,
    contaPadraoCartao,
    removerConta,
    definirPadrao,
    restaurarPadroes,
    calcularSaldosContas,
  } = useContasBancarias();
  const { transacoes } = useDentalSystem();

  const [modalContasOpen, setModalContasOpen] = useState(false);
  const [contaSelecionadaId, setContaSelecionadaId] = useState<string | undefined>(undefined);

  const saldosContas = calcularSaldosContas(transacoes || []);
  const saldoTotalConsolidado = saldosContas.reduce((acc, s) => acc + s.saldoAtual, 0);
  const totalSaldoInicial = contas.reduce((acc, c) => acc + (c.saldoInicial || 0), 0);

  const handleAbrirCriar = () => {
    setContaSelecionadaId(undefined);
    setModalContasOpen(true);
  };

  const handleAbrirEditar = (conta: ContaBancaria) => {
    setContaSelecionadaId(conta.id);
    setModalContasOpen(true);
  };

  const handleDefinirPadraoPix = async (id: string, nome: string) => {
    await definirPadrao(id, 'pix');
    toast.success(`"${nome}" definida como conta padrão para recebimentos via PIX.`);
  };

  const handleRemover = async (conta: ContaBancaria) => {
    if (confirm(`Tem certeza que deseja excluir a conta "${conta.nome}"?`)) {
      await removerConta(conta.id);
      toast.success(`Conta "${conta.nome}" removida.`);
    }
  };

  const handleRestaurar = async () => {
    if (confirm('Deseja restaurar as contas bancárias modelo (Caixa Físico, Nubank, Inter, InfinitePay, PagBank)?')) {
      await restaurarPadroes();
      toast.success('Contas modelo restauradas com sucesso.');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              <CardTitle className="text-xl font-bold">Contas Bancárias & Financeiras</CardTitle>
            </div>
            <CardDescription className="text-sm mt-1">
              Cadastre e gerencie as contas bancárias da clínica (Banco Inter, Nubank, Itaú, etc.), contas de maquininhas e o Caixa Físico da recepção.
              Ao lançar despesas ou receber pagamentos (PIX, cartão, dinheiro), selecione exatamente a conta de destino para conciliação automática.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRestaurar}
              className="text-xs gap-1.5 h-9"
              title="Restaurar lista de contas modelo"
            >
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
              <span className="hidden sm:inline">Restaurar Padrões</span>
            </Button>

            <Button
              type="button"
              onClick={handleAbrirCriar}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold h-9 gap-1.5 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Nova Conta Bancária
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Indicadores Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border bg-muted/20 space-y-1">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Total de Contas Ativas</p>
              <p className="text-2xl font-black text-foreground">{contasAtivas.length}</p>
              <p className="text-[11px] text-muted-foreground">{contas.length} contas cadastradas</p>
            </div>

            <div className="p-4 rounded-xl border bg-muted/20 space-y-1">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Conta Padrão PIX</p>
              <p className="text-lg font-bold text-primary truncate">
                {contaPadraoPix ? contaPadraoPix.nome : 'Nenhuma'}
              </p>
              <p className="text-[11px] text-muted-foreground">{contaPadraoPix?.banco || 'Principal'}</p>
            </div>

            <div className="p-4 rounded-xl border bg-muted/20 space-y-1">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Soma de Saldos Iniciais</p>
              <p className="text-2xl font-black text-foreground">{formatMoney(totalSaldoInicial)}</p>
              <p className="text-[11px] text-muted-foreground">Ponto de partida cadastrado</p>
            </div>

            <div className="p-4 rounded-xl border bg-muted/20 space-y-1">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Saldo Consolidado Atual</p>
              <p className={`text-2xl font-black ${saldoTotalConsolidado >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatMoney(saldoTotalConsolidado)}
              </p>
              <p className="text-[11px] text-muted-foreground">Entradas (+) menos saídas (-)</p>
            </div>
          </div>

          {/* Lista de Contas Cadastradas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                Contas Cadastradas na Clínica
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setModalContasOpen(true)}
                className="text-xs text-primary gap-1"
              >
                <Receipt className="h-3.5 w-3.5" /> Abrir Extrato Detalhado de Todas as Contas
              </Button>
            </div>

            {contas.length === 0 ? (
              <div className="text-center py-12 border rounded-xl bg-muted/10 space-y-3">
                <Building2 className="h-10 w-10 mx-auto text-muted-foreground opacity-50" />
                <p className="text-sm font-semibold text-foreground">Nenhuma conta cadastrada</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Cadastre o Caixa Físico da clínica e suas contas bancárias (Banco Inter, Nubank, InfinitePay, etc.) para controlar seus saldos.
                </p>
                <Button size="sm" onClick={handleAbrirCriar} className="gap-1.5 mt-2">
                  <Plus className="h-4 w-4" /> Cadastrar Primeira Conta
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {contas.map((conta) => {
                  const saldoInfo = saldosContas.find((s) => s.conta.id === conta.id);
                  const saldoAtual = saldoInfo ? saldoInfo.saldoAtual : (conta.saldoInicial || 0);
                  const totalEntradas = saldoInfo ? saldoInfo.totalEntradas : 0;
                  const totalSaidas = saldoInfo ? saldoInfo.totalSaidas : 0;
                  const isPadraoPix = contaPadraoPix?.id === conta.id;

                  return (
                    <Card
                      key={conta.id}
                      className={`relative overflow-hidden border transition-all ${
                        isPadraoPix
                          ? 'ring-2 ring-primary border-primary shadow-sm bg-primary/5'
                          : 'hover:border-primary/50 bg-card'
                      }`}
                    >
                      {/* Faixa colorida do banco */}
                      <div
                        className="h-1.5 w-full"
                        style={{ backgroundColor: conta.cor || '#3b82f6' }}
                      />

                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: conta.cor || '#3b82f6' }}
                              />
                              <h4 className="font-bold text-sm text-foreground truncate" title={conta.nome}>
                                {conta.nome}
                              </h4>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{conta.banco}</p>
                          </div>

                          {isPadraoPix && (
                            <Badge variant="default" className="text-[10px] gap-1 shrink-0 bg-primary font-semibold">
                              <Star className="h-3 w-3 fill-current" /> Padrão PIX
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-border/60">
                          <div>
                            <span className="text-muted-foreground text-[11px] block">Tipo:</span>
                            <span className="font-medium capitalize text-foreground">
                              {conta.tipo.replace('_', ' ')}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-[11px] block">Saldo Inicial:</span>
                            <span className="font-medium text-foreground">
                              {formatMoney(conta.saldoInicial || 0)}
                            </span>
                          </div>
                          {conta.chavePix && (
                            <div className="col-span-2 truncate">
                              <span className="text-muted-foreground text-[11px] block">Chave PIX:</span>
                              <span className="font-mono text-[11px] text-foreground truncate block" title={conta.chavePix}>
                                {conta.chavePix}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Saldo Atual */}
                        <div className="flex items-center justify-between pt-1">
                          <div>
                            <span className="text-[11px] text-muted-foreground block font-medium">Saldo Atual</span>
                            <span
                              className={`text-base font-black ${
                                saldoAtual >= 0 ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {formatMoney(saldoAtual)}
                            </span>
                          </div>

                          <div className="text-right text-[10px] text-muted-foreground">
                            <span className="text-emerald-600 block">+{formatMoney(totalEntradas)}</span>
                            <span className="text-rose-600 block">-{formatMoney(totalSaidas)}</span>
                          </div>
                        </div>

                        {/* Ações da Conta */}
                        <div className="flex items-center justify-end gap-1.5 pt-2 border-t">
                          {!isPadraoPix && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDefinirPadraoPix(conta.id, conta.nome)}
                              className="h-7 text-xs px-2 text-muted-foreground hover:text-primary gap-1"
                              title="Tornar conta principal para PIX"
                            >
                              <Star className="h-3.5 w-3.5" /> Padrão PIX
                            </Button>
                          )}

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAbrirEditar(conta)}
                            className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground gap-1"
                            title="Editar conta"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </Button>

                          {contas.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemover(conta)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600"
                              title="Remover conta"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal Completo de Gestão e Extrato */}
      <ModalContasBancarias
        isOpen={modalContasOpen}
        onClose={() => {
          setModalContasOpen(false);
          setContaSelecionadaId(undefined);
        }}
        contaInicialId={contaSelecionadaId}
      />
    </div>
  );
};

export default ContasBancariasManager;
