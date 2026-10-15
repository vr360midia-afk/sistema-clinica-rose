import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import {
  ConfiguracoesMaquinasCartao,
  OperadoraCartao,
  ResultadoCalculoTaxaCartao,
} from '@/types/maquinasCartao';

const STORAGE_KEY_PREFIX = 'sistema_clinica_maquinas_cartao_';

export const getStorageKey = (clinicaId?: string | null): string => {
  return `${STORAGE_KEY_PREFIX}${clinicaId || 'padrao'}`;
};

export const OPERADORAS_PADRAO: OperadoraCartao[] = [
  {
    id: 'infinitepay',
    nome: 'InfinitePay',
    ativa: true,
    padrao: true,
    cor: '#00D084',
    taxas: {
      debito: 1.38,
      creditoAVista: 3.15,
      parcelado: {
        2: 5.39,
        3: 6.44,
        4: 7.48,
        5: 8.52,
        6: 9.55,
        7: 10.57,
        8: 11.59,
        9: 12.60,
        10: 13.60,
        11: 14.59,
        12: 15.58,
        18: 18.90,
      },
      taxaFixaTransacao: 0,
    },
    observacoes: 'Recebimento no dia útil seguinte / na hora conforme plano InfinitePay.',
  },
  {
    id: 'pagbank',
    nome: 'PagBank',
    ativa: true,
    padrao: false,
    cor: '#00A868',
    taxas: {
      debito: 1.99,
      creditoAVista: 3.19,
      parcelado: {
        2: 5.49,
        3: 6.79,
        4: 7.99,
        5: 9.29,
        6: 10.49,
        7: 11.79,
        8: 12.99,
        9: 14.19,
        10: 15.39,
        11: 16.59,
        12: 17.89,
        18: 22.49,
      },
      taxaFixaTransacao: 0,
    },
    observacoes: 'Taxas padrão PagBank / PagSeguro com recebimento na hora ou 30 dias.',
  },
];

export const getDefaultConfigMaquinas = (): ConfiguracoesMaquinasCartao => {
  return {
    operadoraPadraoId: 'infinitepay',
    lancarTaxaComoDespesa: true,
    categoriaDespesaPadrao: 'Taxas de Cartão',
    operadoras: OPERADORAS_PADRAO,
  };
};

export const carregarConfiguracoesMaquinasSync = (
  clinicaId?: string | null
): ConfiguracoesMaquinasCartao => {
  const padrao = getDefaultConfigMaquinas();
  try {
    const key = getStorageKey(clinicaId);
    const salvo =
      localStorage.getItem(key) ||
      localStorage.getItem(STORAGE_KEY_PREFIX + 'padrao');
    if (salvo) {
      const parsed = JSON.parse(salvo);
      // Garante mesclagem com operadoras novas se houver
      const operadorasSalvas: OperadoraCartao[] = Array.isArray(parsed.operadoras)
        ? parsed.operadoras
        : [];

      // Garante que pelo menos PagBank e InfinitePay existam
      const operadorasFinais = [...operadorasSalvas];
      for (const opPadrao of OPERADORAS_PADRAO) {
        if (!operadorasFinais.some((o) => o.id === opPadrao.id)) {
          operadorasFinais.push(opPadrao);
        }
      }

      return {
        ...padrao,
        ...parsed,
        operadoras: operadorasFinais,
      };
    }
  } catch (err) {
    console.error('Erro ao ler configuracoes de maquinas do localStorage:', err);
  }
  return padrao;
};

/**
 * Calcula a taxa de cartão e o valor líquido baseado na operadora, parcelas e valor bruto.
 */
export const calcularTaxaCartao = (
  operadora: OperadoraCartao | null | undefined,
  parcelas: number,
  valorBruto: number,
  isDebito = false
): ResultadoCalculoTaxaCartao => {
  const qtdParcelas = Math.max(1, parcelas || 1);
  const nomeOperadora = operadora?.nome || 'Cartão';
  const opId = operadora?.id || 'manual';

  if (!operadora || valorBruto <= 0) {
    return {
      operadoraId: opId,
      operadoraNome: nomeOperadora,
      valorBruto,
      parcelas: qtdParcelas,
      taxaPercentual: 0,
      taxaValor: 0,
      valorLiquido: valorBruto,
      valorParcelaBruto: valorBruto / qtdParcelas,
      valorParcelaLiquido: valorBruto / qtdParcelas,
    };
  }

  let taxaPerc = 0;
  if (isDebito) {
    taxaPerc = Number(operadora.taxas?.debito || 0);
  } else if (qtdParcelas === 1) {
    taxaPerc = Number(operadora.taxas?.creditoAVista || 0);
  } else {
    const taxaConfigurada = operadora.taxas?.parcelado?.[qtdParcelas];
    if (taxaConfigurada !== undefined) {
      taxaPerc = Number(taxaConfigurada);
    } else {
      // Se não configurou a parcela específica, interpola ou usa taxa aproximada
      const chaves = Object.keys(operadora.taxas?.parcelado || {})
        .map(Number)
        .sort((a, b) => a - b);
      if (chaves.length > 0) {
        const maior = chaves[chaves.length - 1];
        taxaPerc = Number(operadora.taxas.parcelado[maior] || 0);
      }
    }
  }

  const taxaFixa = Number(operadora.taxas?.taxaFixaTransacao || 0);
  const taxaValor = Number(((valorBruto * (taxaPerc / 100)) + taxaFixa).toFixed(2));
  const valorLiquido = Math.max(0, Number((valorBruto - taxaValor).toFixed(2)));

  return {
    operadoraId: opId,
    operadoraNome: nomeOperadora,
    valorBruto,
    parcelas: qtdParcelas,
    taxaPercentual: taxaPerc,
    taxaValor,
    valorLiquido,
    valorParcelaBruto: Number((valorBruto / qtdParcelas).toFixed(2)),
    valorParcelaLiquido: Number((valorLiquido / qtdParcelas).toFixed(2)),
  };
};

/**
 * Identifica se um texto de orçamento ou descrição faz referência a PagBank, InfinitePay ou outra operadora.
 */
export const identificarOperadoraEmTexto = (
  texto: string,
  operadoras: OperadoraCartao[],
  operadoraPadraoId?: string
): OperadoraCartao | undefined => {
  const t = (texto || '').toLowerCase();
  if (t.includes('pagbank') || t.includes('pagseguro') || t.includes('pag bank')) {
    return operadoras.find((o) => o.id === 'pagbank');
  }
  if (
    t.includes('infinitepay') ||
    t.includes('infinity pay') ||
    t.includes('infinite pay') ||
    t.includes('infinity')
  ) {
    return operadoras.find((o) => o.id === 'infinitepay');
  }
  for (const op of operadoras) {
    if (t.includes(op.nome.toLowerCase())) {
      return op;
    }
  }
  return operadoras.find((o) => o.id === operadoraPadraoId) || operadoras[0];
};

/**
 * Extrai detalhes da transação de cartão (operadora, parcelas, débito/crédito) de uma string de forma segura.
 */
export const extrairDetalhesCartaoDeTexto = (
  texto: string,
  operadoras: OperadoraCartao[],
  operadoraPadraoId?: string
) => {
  const isDebito = /d[eé]bito/i.test(texto);
  const parcMatch = texto.match(/(\d+)\s*x/i);
  const parcelas = parcMatch ? parseInt(parcMatch[1], 10) : 1;
  const isCartao = /cart[aã]o|cr[eé]dito|d[eé]bito/i.test(texto);
  const operadora = identificarOperadoraEmTexto(texto, operadoras, operadoraPadraoId);

  return {
    isCartao,
    isDebito,
    parcelas,
    operadora,
  };
};

export const useMaquinasCartao = () => {
  const { clinicaId } = useAuth();
  const [config, setConfig] = useState<ConfiguracoesMaquinasCartao>(() =>
    carregarConfiguracoesMaquinasSync(clinicaId)
  );
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    setLoading(true);
    const dados = carregarConfiguracoesMaquinasSync(clinicaId);
    setConfig(dados);
    setLoading(false);
  }, [clinicaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Sincronização entre abas e componentes
  useEffect(() => {
    const handleStorageChange = () => carregar();
    window.addEventListener('maquinas-cartao-config-updated', handleStorageChange);
    return () =>
      window.removeEventListener('maquinas-cartao-config-updated', handleStorageChange);
  }, [carregar]);

  const salvarConfig = async (
    novosDados: Partial<ConfiguracoesMaquinasCartao>
  ): Promise<boolean> => {
    try {
      setSalvando(true);
      const atualizados: ConfiguracoesMaquinasCartao = {
        ...config,
        ...novosDados,
      };

      const key = getStorageKey(clinicaId);
      localStorage.setItem(key, JSON.stringify(atualizados));
      localStorage.setItem(
        STORAGE_KEY_PREFIX + 'padrao',
        JSON.stringify(atualizados)
      );

      setConfig(atualizados);
      window.dispatchEvent(new Event('maquinas-cartao-config-updated'));
      toast.success('Taxas e configurações das máquinas salvas com sucesso!');
      return true;
    } catch (err: any) {
      console.error('Erro ao salvar taxas de máquinas de cartão:', err);
      toast.error('Erro ao salvar taxas de cartão');
      return false;
    } finally {
      setSalvando(false);
    }
  };

  const atualizarTaxasOperadora = async (
    operadoraId: string,
    novasTaxas: Partial<OperadoraCartao['taxas']>,
    dadosExtras?: Partial<OperadoraCartao>
  ): Promise<boolean> => {
    const novasOperadoras = config.operadoras.map((op) => {
      if (op.id !== operadoraId) return op;
      return {
        ...op,
        ...dadosExtras,
        taxas: {
          ...op.taxas,
          ...novasTaxas,
          parcelado: {
            ...op.taxas.parcelado,
            ...(novasTaxas.parcelado || {}),
          },
        },
      };
    });

    return salvarConfig({ operadoras: novasOperadoras });
  };

  const adicionarOperadora = async (novaOp: OperadoraCartao): Promise<boolean> => {
    if (config.operadoras.some((o) => o.id === novaOp.id)) {
      toast.error('Já existe uma operadora com esse identificador.');
      return false;
    }
    const novas = [...config.operadoras, novaOp];
    return salvarConfig({ operadoras: novas });
  };

  const removerOperadora = async (operadoraId: string): Promise<boolean> => {
    if (operadoraId === 'pagbank' || operadoraId === 'infinitepay') {
      toast.error('As operadoras PagBank e InfinitePay são padrão e não podem ser excluídas (você pode desativá-las).');
      return false;
    }
    const novas = config.operadoras.filter((o) => o.id !== operadoraId);
    return salvarConfig({ operadoras: novas });
  };

  const restaurarPadrao = async () => {
    const padrao = getDefaultConfigMaquinas();
    await salvarConfig(padrao);
    toast.info('Taxas redefinidas para os valores padrão de PagBank e InfinitePay.');
  };

  const operadorasAtivas = config.operadoras.filter((o) => o.ativa !== false);
  const operadoraPadrao =
    operadorasAtivas.find((o) => o.id === config.operadoraPadraoId) ||
    operadorasAtivas[0] ||
    config.operadoras[0];

  return {
    config,
    operadoras: config.operadoras,
    operadorasAtivas,
    operadoraPadrao,
    salvarConfig,
    atualizarTaxasOperadora,
    adicionarOperadora,
    removerOperadora,
    restaurarPadrao,
    calcularTaxa: (opId: string, parcelas: number, valor: number, isDebito?: boolean) => {
      const op = config.operadoras.find((o) => o.id === opId) || operadoraPadrao;
      return calcularTaxaCartao(op, parcelas, valor, isDebito);
    },
    loading,
    salvando,
  };
};

export default useMaquinasCartao;
