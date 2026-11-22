import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Sparkles,
  QrCode,
  CreditCard,
  Banknote,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  Wallet,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  X,
  Search,
} from 'lucide-react';
import { useContasBancarias } from '@/hooks/useContasBancarias';
import { ContaBancaria, TipoContaBancaria } from '@/types/contaBancaria';
import { formatMoney } from '@/utils/exportCsv';
import { useDentalSystem } from '@/context/DentalSystemContext';

interface ModalContasBancariasProps {
  isOpen: boolean;
  onClose: () => void;
  onSelecionarConta?: (conta: ContaBancaria) => void;
  contaInicialId?: string;
}

const CORES_PALETA = [
  { hex: '#FF7A00', label: 'Laranja (Inter)' },
  { hex: '#8A05BE', label: 'Roxo (Nubank)' },
  { hex: '#00D084', label: 'Verde Claro (InfinitePay)' },
  { hex: '#00A868', label: 'Verde Escuro (PagBank)' },
  { hex: '#10B981', label: 'Esmeralda (Caixa Físico)' },
  { hex: '#EC7000', label: 'Laranja Escuro (Itaú)' },
  { hex: '#CC0000', label: 'Vermelho (Bradesco / Santander)' },
  { hex: '#003399', label: 'Azul (Caixa / BB)' },
  { hex: '#2563EB', label: 'Azul Royal' },
  { hex: '#0D9488', label: 'Ciano / Cora' },
  { hex: '#6366F1', label: 'Índigo' },
];

export const ModalContasBancarias: React.FC<ModalContasBancariasProps> = ({
  isOpen,
  onClose,
  onSelecionarConta,
  contaInicialId,
}) => {
  const {
    contas,
    adicionarConta,
    atualizarConta,
    removerConta,
    definirPadrao,
    restaurarPadroes,
    calcularSaldosContas,
    gerarExtratoConta,
    getContaById,
  } = useContasBancarias();
  const { transacoes } = useDentalSystem();

  const [modoEdicao, setModoEdicao] = useState(false);
  const [contaEmEdicaoId, setContaEmEdicaoId] = useState<string | null>(null);
  const [contaVisualizarExtratoId, setContaVisualizarExtratoId] = useState<string | null>(contaInicialId || null);
  const [buscaExtrato, setBuscaExtrato] = useState('');

  // Form states
  const [nome, setNome] = useState('');
  const [banco, setBanco] = useState('');
  const [tipo, setTipo] = useState<TipoContaBancaria>('corrente');
  const [chavePix, setChavePix] = useState('');
  const [tipoChavePix, setTipoChavePix] = useState<'cnpj' | 'cpf' | 'email' | 'telefone' | 'aleatoria'>('cnpj');
  const [agencia, setAgencia] = useState('');
  const [contaNumero, setContaNumero] = useState('');
  const [titular, setTitular] = useState('');
  const [cor, setCor] = useState('#FF7A00');
  const [saldoInicial, setSaldoInicial] = useState<string>('0');
  const [padraoPix, setPadraoPix] = useState(false);
  const [padraoCartao, setPadraoCartao] = useState(false);
  const [padraoDinheiro, setPadraoDinheiro] = useState(false);
  const [padraoDespesa, setPadraoDespesa] = useState(false);

  const saldosContas = calcularSaldosContas(transacoes);

  const abrirNovaConta = () => {
    setContaVisualizarExtratoId(null);
    setContaEmEdicaoId(null);
    setNome('');
    setBanco('');
    setTipo('corrente');
    setChavePix('');
    setTipoChavePix('cnpj');
    setAgencia('');
    setContaNumero('');
    setTitular('');
    setCor(CORES_PALETA[Math.floor(Math.random() * CORES_PALETA.length)].hex);
    setSaldoInicial('0');
    setPadraoPix(false);
    setPadraoCartao(false);
    setPadraoDinheiro(false);
    setPadraoDespesa(false);
    setModoEdicao(true);
  };

  const abrirEditarConta = (conta: ContaBancaria) => {
    setContaVisualizarExtratoId(null);
    setContaEmEdicaoId(conta.id);
    setNome(conta.nome);
    setBanco(conta.banco);
    setTipo(conta.tipo);
    setChavePix(conta.chavePix || '');
    setTipoChavePix(conta.tipoChavePix || 'cnpj');
    setAgencia(conta.agencia || '');
    setContaNumero(conta.conta || '');
    setTitular(conta.titular || '');
    setCor(conta.cor || '#FF7A00');
    setSaldoInicial(String(conta.saldoInicial || 0));
    setPadraoPix(Boolean(conta.padraoPara?.includes('pix')));
    setPadraoCartao(Boolean(conta.padraoPara?.includes('cartao')));
    setPadraoDinheiro(Boolean(conta.padraoPara?.includes('dinheiro')));
    setPadraoDespesa(Boolean(conta.padraoPara?.includes('despesa')));
    setModoEdicao(true);
  };

  const salvarForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    const padroes: ('pix' | 'cartao' | 'dinheiro' | 'despesa')[] = [];
    if (padraoPix) padroes.push('pix');
    if (padraoCartao) padroes.push('cartao');
    if (padraoDinheiro) padroes.push('dinheiro');
    if (padraoDespesa) padroes.push('despesa');

    const sInicial = parseFloat(saldoInicial) || 0;

    if (contaEmEdicaoId) {
      atualizarConta(contaEmEdicaoId, {
        nome: nome.trim(),
        banco: banco.trim() || nome.trim(),
        tipo,
        chavePix: chavePix.trim() || undefined,
        tipoChavePix,
        agencia: agencia.trim() || undefined,
        conta: contaNumero.trim() || undefined,
        titular: titular.trim() || undefined,
        cor,
        saldoInicial: sInicial,
        padraoPara: padroes,
      });
    } else {
      adicionarConta({
        nome: nome.trim(),
        banco: banco.trim() || nome.trim(),
        tipo,
        chavePix: chavePix.trim() || undefined,
        tipoChavePix,
        agencia: agencia.trim() || undefined,
        conta: contaNumero.trim() || undefined,
        titular: titular.trim() || undefined,
        cor,
        saldoInicial: sInicial,
        ativa: true,
        padraoPara: padroes,
      });
    }

    setModoEdicao(false);
  };

  // Se estiver visualizando o extrato detalhado de uma conta específica
  const contaSelecionadaExtrato = contaVisualizarExtratoId ? getContaById(contaVisualizarExtratoId) : null;
  const resumoContaExtrato = contaVisualizarExtratoId ? saldosContas.find((s) => s.conta.id === contaVisualizarExtratoId) : null;
  const movimentacoesExtrato = contaVisualizarExtratoId ? gerarExtratoConta(contaVisualizarExtratoId, transacoes) : [];

  const movimentacoesFiltradas = movimentacoesExtrato.filter((m) => {
    if (!buscaExtrato.trim()) return true;
    const q = buscaExtrato.toLowerCase();
    return (
      m.descricao.toLowerCase().includes(q) ||
      (m.pacienteNome && m.pacienteNome.toLowerCase().includes(q)) ||
      (m.metodoPagamento && m.metodoPagamento.toLowerCase().includes(q))
    );
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-background">
        <DialogHeader className="p-5 pb-3 border-b bg-card/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                  {contaVisualizarExtratoId && contaSelecionadaExtrato
                    ? `Extrato da Conta: ${contaSelecionadaExtrato.nome}`
                    : 'Contas Financeiras & Bancárias da Clínica'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {contaVisualizarExtratoId
                    ? 'Acompanhe as entradas adicionando saldo e as despesas sendo descontadas em tempo real.'
                    : 'Controle em qual banco cai cada PIX e cartão, e de qual conta saem os pagamentos da clínica.'}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {contaVisualizarExtratoId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setContaVisualizarExtratoId(null)}
                  className="text-xs gap-1.5 h-8 font-medium"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar às Contas
                </Button>
              ) : (
                !modoEdicao && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={abrirNovaConta}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 h-8 shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar Conta
                  </Button>
                )
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* MODO 1: EXTRATO DA CONTA SELECIONADA */}
          {contaVisualizarExtratoId && contaSelecionadaExtrato ? (
            <div className="space-y-4">
              {/* Header do Extrato com o Saldo Dinâmico */}
              <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-4 h-4 rounded-full shadow-sm shrink-0"
                      style={{ backgroundColor: contaSelecionadaExtrato.cor || '#3b82f6' }}
                    />
                    <div>
                      <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                        {contaSelecionadaExtrato.nome}
                        <Badge variant="outline" className="text-[10px]">
                          {contaSelecionadaExtrato.tipo}
                        </Badge>
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {contaSelecionadaExtrato.banco}
                        {contaSelecionadaExtrato.chavePix && ` • PIX: ${contaSelecionadaExtrato.chavePix}`}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-muted-foreground block">
                      Saldo Disponível em Conta:
                    </span>
                    <span
                      className={`text-2xl font-black ${
                        (resumoContaExtrato?.saldoAtual || 0) >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatMoney(resumoContaExtrato?.saldoAtual || 0)}
                    </span>
                  </div>
                </div>

                {/* Resumo do Fluxo: Entradas x Saídas */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t text-center">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold uppercase flex items-center justify-center gap-1">
                      <ArrowUpRight className="h-3.5 w-3.5" /> Total Entradas (+)
                    </span>
                    <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                      +{formatMoney(resumoContaExtrato?.totalEntradas || 0)}
                    </p>
                  </div>

                  <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                    <span className="text-[10px] text-rose-700 dark:text-rose-300 font-semibold uppercase flex items-center justify-center gap-1">
                      <ArrowDownRight className="h-3.5 w-3.5" /> Despesas Descontadas (-)
                    </span>
                    <p className="text-sm font-black text-rose-600 dark:text-rose-400 mt-0.5">
                      -{formatMoney(resumoContaExtrato?.totalSaidas || 0)}
                    </p>
                  </div>

                  <div className="p-2 rounded-lg bg-background border">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase flex items-center justify-center gap-1">
                      <Wallet className="h-3.5 w-3.5 text-primary" /> Saldo Inicial
                    </span>
                    <p className="text-sm font-bold text-foreground mt-0.5">
                      {formatMoney(contaSelecionadaExtrato.saldoInicial || 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Barra de Busca no Extrato */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar neste extrato (paciente, descrição...)"
                    value={buscaExtrato}
                    onChange={(e) => setBuscaExtrato(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {movimentacoesFiltradas.length} movimentação(ões)
                </span>
              </div>

              {/* Lista Cronológica do Extrato com Saldo Progressivo */}
              {movimentacoesFiltradas.length === 0 ? (
                <div className="text-center py-10 border border-dashed rounded-xl space-y-2">
                  <Wallet className="h-8 w-8 text-muted-foreground/60 mx-auto" />
                  <p className="text-xs text-muted-foreground">
                    Nenhuma movimentação registrada nesta conta ainda.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {movimentacoesFiltradas.map((m) => {
                    const isReceita = m.tipo === 'receita';
                    const isPago = m.status === 'pago';

                    return (
                      <div
                        key={m.transacaoId}
                        className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                          isReceita ? 'bg-card hover:bg-emerald-500/5' : 'bg-card hover:bg-rose-500/5'
                        }`}
                      >
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          <div
                            className={`p-2 rounded-lg shrink-0 ${
                              isReceita
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isReceita ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                          </div>

                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-xs text-foreground truncate">
                                {m.pacienteNome || m.descricao}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[9px] font-bold px-1.5 py-0 ${
                                  isReceita
                                    ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                                    : 'bg-rose-500/15 text-rose-600 border-rose-500/30'
                                }`}
                              >
                                {isReceita ? '+ Entrada' : '- Saída / Despesa'}
                              </Badge>
                              {m.metodoPagamento && (
                                <span className="text-[10px] text-muted-foreground uppercase font-medium">
                                  ({m.metodoPagamento})
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {m.descricao}
                            </p>
                            <span className="text-[10px] text-muted-foreground block">
                              {m.data.toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>

                        {/* Valor e Saldo Resultante em Conta */}
                        <div className="text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                          <p
                            className={`text-sm font-black ${
                              isReceita ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isReceita ? '+' : '-'} {formatMoney(m.valor)}
                          </p>

                          {isPago && (
                            <div className="flex items-center justify-end gap-1 text-[11px] font-semibold text-muted-foreground mt-0.5">
                              <span className="text-[10px] text-muted-foreground/80">Saldo em Conta:</span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-bold px-1.5 py-0 border ${
                                  m.saldoApos >= 0
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                }`}
                              >
                                {formatMoney(m.saldoApos)}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : modoEdicao ? (
            /* MODO 2: FORMULÁRIO DE ADICIONAR / EDITAR CONTA */
            <form onSubmit={salvarForm} className="space-y-4 bg-muted/20 border rounded-xl p-4">
              <div className="flex items-center justify-between pb-2 border-b">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {contaEmEdicaoId ? 'Editar Conta Bancária' : 'Nova Conta Bancária / Financeira'}
                </h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setModoEdicao(false)}
                  className="h-7 px-2 text-xs"
                >
                  <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="nomeConta" className="text-xs font-semibold">
                    Nome de Exibição *
                  </Label>
                  <Input
                    id="nomeConta"
                    placeholder="Ex: Banco Inter, Nubank, Itaú..."
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    className="h-9 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="bancoInstituicao" className="text-xs font-semibold">
                    Instituição / Banco Oficial
                  </Label>
                  <Input
                    id="bancoInstituicao"
                    placeholder="Ex: Banco Inter (077), Nu Pagamentos..."
                    value={banco}
                    onChange={(e) => setBanco(e.target.value)}
                    className="h-9 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="tipoConta" className="text-xs font-semibold">
                    Tipo de Conta
                  </Label>
                  <Select value={tipo} onValueChange={(val) => setTipo(val as TipoContaBancaria)}>
                    <SelectTrigger id="tipoConta" className="h-9 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corrente">Conta Corrente</SelectItem>
                      <SelectItem value="pagamento">Conta de Pagamento (Fintech / Maquininha)</SelectItem>
                      <SelectItem value="caixa">Caixa Físico / Gaveta</SelectItem>
                      <SelectItem value="poupanca">Conta Poupança</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="saldoInicialInput" className="text-xs font-semibold">
                    Saldo Inicial (R$)
                  </Label>
                  <Input
                    id="saldoInicialInput"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={saldoInicial}
                    onChange={(e) => setSaldoInicial(e.target.value)}
                    className="h-9 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Cor Visual do Banco</Label>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    {CORES_PALETA.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setCor(c.hex)}
                        title={c.label}
                        className={`w-6 h-6 rounded-full transition-transform border ${
                          cor === c.hex ? 'scale-125 border-foreground shadow-sm' : 'border-transparent hover:scale-110'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="chavePix" className="text-xs font-semibold">
                    Chave PIX da Conta (opcional)
                  </Label>
                  <Input
                    id="chavePix"
                    placeholder="CNPJ, telefone ou e-mail PIX"
                    value={chavePix}
                    onChange={(e) => setChavePix(e.target.value)}
                    className="h-9 text-xs mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="agencia" className="text-xs font-semibold">
                      Agência
                    </Label>
                    <Input
                      id="agencia"
                      placeholder="0001"
                      value={agencia}
                      onChange={(e) => setAgencia(e.target.value)}
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contaNumero" className="text-xs font-semibold">
                      Nº da Conta
                    </Label>
                    <Input
                      id="contaNumero"
                      placeholder="123456-7"
                      value={contaNumero}
                      onChange={(e) => setContaNumero(e.target.value)}
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Padrões automáticos */}
              <div className="pt-2 border-t space-y-2">
                <Label className="text-xs font-semibold text-foreground">
                  Definir como conta padrão automática para lançamentos:
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <label
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs transition-all ${
                      padraoPix ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-700 dark:text-emerald-300 font-semibold' : 'hover:bg-muted/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={padraoPix}
                      onChange={(e) => setPadraoPix(e.target.checked)}
                      className="rounded text-primary focus:ring-0"
                    />
                    <QrCode className="h-3.5 w-3.5 text-emerald-500" />
                    Padrão PIX
                  </label>

                  <label
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs transition-all ${
                      padraoCartao ? 'bg-blue-500/10 border-blue-500/50 text-blue-700 dark:text-blue-300 font-semibold' : 'hover:bg-muted/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={padraoCartao}
                      onChange={(e) => setPadraoCartao(e.target.checked)}
                      className="rounded text-primary focus:ring-0"
                    />
                    <CreditCard className="h-3.5 w-3.5 text-blue-500" />
                    Padrão Cartão
                  </label>

                  <label
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs transition-all ${
                      padraoDinheiro ? 'bg-amber-500/10 border-amber-500/50 text-amber-700 dark:text-amber-300 font-semibold' : 'hover:bg-muted/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={padraoDinheiro}
                      onChange={(e) => setPadraoDinheiro(e.target.checked)}
                      className="rounded text-primary focus:ring-0"
                    />
                    <Banknote className="h-3.5 w-3.5 text-amber-500" />
                    Padrão Dinheiro
                  </label>

                  <label
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs transition-all ${
                      padraoDespesa ? 'bg-rose-500/10 border-rose-500/50 text-rose-700 dark:text-rose-300 font-semibold' : 'hover:bg-muted/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={padraoDespesa}
                      onChange={(e) => setPadraoDespesa(e.target.checked)}
                      className="rounded text-primary focus:ring-0"
                    />
                    <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                    Padrão Despesas
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModoEdicao(false)}
                  className="h-8 text-xs"
                >
                  Cancelar
                </Button>
                <Button type="submit" size="sm" className="h-8 text-xs font-semibold">
                  {contaEmEdicaoId ? 'Salvar Alterações' : 'Criar Conta Bancária'}
                </Button>
              </div>
            </form>
          ) : (
            /* MODO 3: LISTA DE CONTAS CADASTRADAS COM SALDOS */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span className="font-medium">
                  {contas.length} conta(s) configurada(s) para a clínica
                </span>
                <span className="text-[11px]">
                  Clique em "Ver Extrato" para conferir cada entrada e saída descontada
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {contas.map((conta) => {
                  const resumo = saldosContas.find((s) => s.conta.id === conta.id);
                  const saldoAtual = resumo?.saldoAtual || 0;
                  const totalEntradas = resumo?.totalEntradas || 0;
                  const totalSaidas = resumo?.totalSaidas || 0;

                  return (
                    <Card
                      key={conta.id}
                      className="border hover:border-primary/40 transition-all shadow-sm bg-card"
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                              style={{ backgroundColor: conta.cor || '#3B82F6' }}
                            />
                            <div>
                              <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                                {conta.nome}
                              </h4>
                              <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                                {conta.banco} • {conta.tipo === 'caixa' ? 'Caixa da Clínica' : conta.tipo}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => abrirEditarConta(conta)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              title="Editar conta"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm(`Deseja realmente remover a conta "${conta.nome}"?`)) {
                                  removerConta(conta.id);
                                }
                              }}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500"
                              title="Remover conta"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Dados bancários e chave PIX */}
                        {(conta.chavePix || conta.agencia || conta.conta) && (
                          <div className="text-[11px] bg-muted/40 rounded-lg p-2 space-y-0.5 border border-muted">
                            {conta.chavePix && (
                              <p className="text-muted-foreground flex items-center gap-1 truncate">
                                <QrCode className="h-3 w-3 text-emerald-500 shrink-0" />
                                <span className="font-medium text-foreground">PIX:</span> {conta.chavePix}
                              </p>
                            )}
                            {(conta.agencia || conta.conta) && (
                              <p className="text-muted-foreground flex items-center gap-1">
                                <Building2 className="h-3 w-3 text-primary shrink-0" />
                                <span>Ag: {conta.agencia || '-'} • Conta: {conta.conta || '-'}</span>
                              </p>
                            )}
                          </div>
                        )}

                        {/* Saldos da Conta: Entradas (+) e Saídas (-) */}
                        <div className="grid grid-cols-3 gap-1.5 pt-2 border-t text-center">
                          <div className="bg-emerald-500/5 rounded p-1.5 border border-emerald-500/10">
                            <span className="text-[9px] uppercase tracking-wider text-muted-foreground block">
                              Entradas (+)
                            </span>
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              +{formatMoney(totalEntradas)}
                            </span>
                          </div>
                          <div className="bg-rose-500/5 rounded p-1.5 border border-rose-500/10">
                            <span className="text-[9px] uppercase tracking-wider text-muted-foreground block">
                              Saídas (-)
                            </span>
                            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                              -{formatMoney(totalSaidas)}
                            </span>
                          </div>
                          <div className="bg-primary/5 rounded p-1.5 border border-primary/10">
                            <span className="text-[9px] uppercase tracking-wider text-muted-foreground block">
                              Saldo Atual
                            </span>
                            <span
                              className={`text-xs font-black ${
                                saldoAtual >= 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {formatMoney(saldoAtual)}
                            </span>
                          </div>
                        </div>

                        {/* Badges de Padrão e Botão Ver Extrato */}
                        <div className="flex items-center justify-between pt-1 gap-1 flex-wrap">
                          <div className="flex items-center gap-1 flex-wrap">
                            {conta.padraoPara?.includes('pix') && (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] gap-1 px-1.5 py-0 font-medium">
                                <QrCode className="h-2.5 w-2.5" /> Padrão PIX
                              </Badge>
                            )}
                            {conta.padraoPara?.includes('cartao') && (
                              <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px] gap-1 px-1.5 py-0 font-medium">
                                <CreditCard className="h-2.5 w-2.5" /> Padrão Cartão
                              </Badge>
                            )}
                            {conta.padraoPara?.includes('dinheiro') && (
                              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] gap-1 px-1.5 py-0 font-medium">
                                <Banknote className="h-2.5 w-2.5" /> Padrão Dinheiro
                              </Badge>
                            )}
                            {conta.padraoPara?.includes('despesa') && (
                              <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 text-[10px] gap-1 px-1.5 py-0 font-medium">
                                <TrendingDown className="h-2.5 w-2.5" /> Padrão Despesas
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setContaVisualizarExtratoId(conta.id);
                                setBuscaExtrato('');
                              }}
                              className="h-6 text-[10px] px-2 font-semibold text-primary border-primary/30 hover:bg-primary/10 gap-1"
                            >
                              <FileText className="h-3 w-3" /> Ver Extrato
                            </Button>

                            {onSelecionarConta && (
                              <Button
                                type="button"
                                size="sm"
                                variant="default"
                                onClick={() => {
                                  onSelecionarConta(conta);
                                  onClose();
                                }}
                                className="h-6 text-[10px] px-2"
                              >
                                Selecionar
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-card/60 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={restaurarPadroes}
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-8"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar Contas Padrão
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onClose}
            className="text-xs h-8 px-4 font-semibold"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
