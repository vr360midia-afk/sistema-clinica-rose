export type TipoContaBancaria = 'corrente' | 'poupanca' | 'pagamento' | 'caixa';

export interface ContaBancaria {
  id: string; // Ex: 'inter', 'nubank', 'infinitepay', 'pagbank', 'caixa_fisico'
  nome: string; // Ex: 'Banco Inter', 'Nubank', 'InfinitePay', 'Caixa Físico'
  banco: string; // Ex: 'Banco Inter (077)', 'Nu Pagamentos (260)', 'InfinitePay / CloudWalk'
  tipo: TipoContaBancaria;
  agencia?: string;
  conta?: string;
  chavePix?: string;
  tipoChavePix?: 'cnpj' | 'cpf' | 'email' | 'telefone' | 'aleatoria';
  titular?: string;
  cor: string; // Cor visual (hex)
  ativa: boolean;
  padraoPara?: ('pix' | 'cartao' | 'dinheiro' | 'despesa')[];
  saldoInicial?: number;
  descricao?: string;
}

export interface ResumoSaldoConta {
  conta: ContaBancaria;
  totalEntradas: number;
  totalSaidas: number;
  saldoAtual: number;
  totalPendente: number;
  quantidadeTransacoes: number;
}

export interface SaldoProgressivoInfo {
  saldoAnterior: number;
  impacto: number; // +valor (receita) ou -valor (despesa)
  saldoApos: number;
  isPendente?: boolean;
}

export interface MovimentacaoExtratoConta {
  transacaoId: string;
  data: Date;
  descricao: string;
  pacienteNome?: string;
  metodoPagamento?: string;
  tipo: 'receita' | 'despesa';
  valor: number;
  impacto: number;
  saldoApos: number;
  contaId: string;
  contaNome: string;
  contaCor: string;
  status: string;
}
