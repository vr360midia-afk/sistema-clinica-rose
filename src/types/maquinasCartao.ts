export interface TaxasParcelas {
  debito: number; // Taxa de débito em %
  creditoAVista: number; // 1x no crédito em %
  parcelado: Record<number, number>; // 2x a 18x em %
  taxaFixaTransacao?: number; // Custo fixo em R$ por transação (se houver, padrão 0)
}

export interface OperadoraCartao {
  id: string; // 'pagbank' | 'infinitepay' | string
  nome: string; // 'PagBank' | 'InfinitePay'
  ativa: boolean;
  padrao?: boolean;
  cor?: string; // Cor identificadora (hex ou classe)
  taxas: TaxasParcelas;
  observacoes?: string;
}

export interface ConfiguracoesMaquinasCartao {
  operadoraPadraoId: string;
  lancarTaxaComoDespesa: boolean; // Se true, gera lançamento automático de despesa no Financeiro
  categoriaDespesaPadrao: string; // Ex: 'Taxas de Cartão'
  operadoras: OperadoraCartao[];
}

export interface ResultadoCalculoTaxaCartao {
  operadoraId: string;
  operadoraNome: string;
  valorBruto: number;
  parcelas: number;
  taxaPercentual: number;
  taxaValor: number;
  valorLiquido: number;
  valorParcelaBruto: number;
  valorParcelaLiquido: number;
}
