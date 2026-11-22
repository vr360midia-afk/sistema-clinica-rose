import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { ContaBancaria, ResumoSaldoConta, TipoContaBancaria } from '@/types/contaBancaria';
import { MetodoPagamento, TipoTransacao, Transacao } from '@/types/shared';

const STORAGE_KEY_PREFIX = 'sistema_clinica_contas_bancarias_';
const EVENT_NAME = 'sistema_clinica_contas_bancarias_updated';

export const CONTAS_BANCARIAS_PADRAO: ContaBancaria[] = [
  {
    id: 'inter',
    nome: 'Banco Inter',
    banco: 'Banco Inter (077)',
    tipo: 'corrente',
    cor: '#FF7A00',
    ativa: true,
    padraoPara: ['pix'],
    descricao: 'Conta digital principal para recebimento de PIX dos pacientes',
  },
  {
    id: 'nubank',
    nome: 'Nubank',
    banco: 'Nu Pagamentos (260)',
    tipo: 'pagamento',
    cor: '#8A05BE',
    ativa: true,
    padraoPara: [],
    descricao: 'Conta Nubank da clínica para transferências e PIX secundário',
  },
  {
    id: 'infinitepay',
    nome: 'Conta InfinitePay',
    banco: 'InfinitePay / CloudWalk',
    tipo: 'pagamento',
    cor: '#00D084',
    ativa: true,
    padraoPara: ['cartao'],
    descricao: 'Conta de liquidação e recebimento de cartões da maquininha InfinitePay',
  },
  {
    id: 'pagbank',
    nome: 'Conta PagBank',
    banco: 'PagSeguro / PagBank',
    tipo: 'pagamento',
    cor: '#00A868',
    ativa: true,
    padraoPara: [],
    descricao: 'Conta de liquidação e recebimento de cartões da maquininha PagBank',
  },
  {
    id: 'caixa_fisico',
    nome: 'Caixa Físico (Consultório)',
    banco: 'Caixa do Consultório',
    tipo: 'caixa',
    cor: '#10B981',
    ativa: true,
    padraoPara: ['dinheiro'],
    descricao: 'Gaveta física da recepção da clínica para pagamentos em espécie',
  },
  {
    id: 'itau',
    nome: 'Itaú Unibanco',
    banco: 'Banco Itaú (341)',
    tipo: 'corrente',
    cor: '#EC7000',
    ativa: true,
    padraoPara: ['despesa'],
    descricao: 'Conta bancária tradicional para pagamento de fornecedores e contas fixas',
  },
];

export const getContasStorageKey = (clinicaId?: string | null): string => {
  return `${STORAGE_KEY_PREFIX}${clinicaId || 'padrao'}`;
};

export const carregarContasBancariasSync = (clinicaId?: string | null): ContaBancaria[] => {
  try {
    const key = getContasStorageKey(clinicaId);
    const salvo = localStorage.getItem(key) || localStorage.getItem(STORAGE_KEY_PREFIX + 'padrao');
    if (salvo) {
      const parsed: ContaBancaria[] = JSON.parse(salvo);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Erro ao ler contas bancárias do localStorage:', err);
  }
  return CONTAS_BANCARIAS_PADRAO;
};

export const useContasBancarias = () => {
  const { clinicaId } = useAuth();
  const [contas, setContas] = useState<ContaBancaria[]>(() => carregarContasBancariasSync(clinicaId));

  const recarregar = useCallback(() => {
    setContas(carregarContasBancariasSync(clinicaId));
  }, [clinicaId]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  // Listener para sincronização multi-abas e entre componentes
  useEffect(() => {
    const handleUpdate = () => recarregar();
    window.addEventListener(EVENT_NAME, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [recarregar]);

  const salvarContas = useCallback(
    (novasContas: ContaBancaria[]) => {
      try {
        const key = getContasStorageKey(clinicaId);
        localStorage.setItem(key, JSON.stringify(novasContas));
        localStorage.setItem(STORAGE_KEY_PREFIX + 'padrao', JSON.stringify(novasContas));
        setContas(novasContas);
        window.dispatchEvent(new CustomEvent(EVENT_NAME));
        return true;
      } catch (err) {
        console.error('Erro ao salvar contas bancárias:', err);
        toast.error('Erro ao salvar configurações de contas bancárias');
        return false;
      }
    },
    [clinicaId]
  );

  const contasAtivas = useMemo(() => {
    return contas.filter((c) => c.ativa !== false);
  }, [contas]);

  const contaPadraoPix = useMemo(() => {
    return (
      contasAtivas.find((c) => c.padraoPara?.includes('pix')) ||
      contasAtivas.find((c) => c.id === 'inter') ||
      contasAtivas[0] ||
      CONTAS_BANCARIAS_PADRAO[0]
    );
  }, [contasAtivas]);

  const contaPadraoCartao = useMemo(() => {
    return (
      contasAtivas.find((c) => c.padraoPara?.includes('cartao')) ||
      contasAtivas.find((c) => c.id === 'infinitepay') ||
      contasAtivas[0] ||
      CONTAS_BANCARIAS_PADRAO[2]
    );
  }, [contasAtivas]);

  const contaPadraoDinheiro = useMemo(() => {
    return (
      contasAtivas.find((c) => c.padraoPara?.includes('dinheiro')) ||
      contasAtivas.find((c) => c.id === 'caixa_fisico') ||
      contasAtivas[0] ||
      CONTAS_BANCARIAS_PADRAO[4]
    );
  }, [contasAtivas]);

  const contaPadraoDespesa = useMemo(() => {
    return (
      contasAtivas.find((c) => c.padraoPara?.includes('despesa')) ||
      contasAtivas.find((c) => c.id === 'itau') ||
      contasAtivas.find((c) => c.id === 'inter') ||
      contasAtivas[0] ||
      CONTAS_BANCARIAS_PADRAO[5]
    );
  }, [contasAtivas]);

  const getContaById = useCallback(
    (id?: string): ContaBancaria | undefined => {
      if (!id) return undefined;
      return contas.find((c) => c.id.toLowerCase() === id.toLowerCase());
    },
    [contas]
  );

  const obterContaSugeridaParaMetodo = useCallback(
    (metodo: MetodoPagamento, tipo: TipoTransacao): ContaBancaria => {
      if (tipo === 'despesa') {
        return contaPadraoDespesa;
      }
      if (metodo === 'pix' || metodo === 'pix_parcelado') {
        return contaPadraoPix;
      }
      if (metodo === 'cartao') {
        return contaPadraoCartao;
      }
      if (metodo === 'dinheiro') {
        return contaPadraoDinheiro;
      }
      return contaPadraoPix;
    },
    [contaPadraoDespesa, contaPadraoPix, contaPadraoCartao, contaPadraoDinheiro]
  );

  const adicionarConta = useCallback(
    (nova: Omit<ContaBancaria, 'id'>) => {
      const id =
        nova.nome
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '_')
          .slice(0, 20) +
        '_' +
        Date.now().toString(36).slice(-4);

      const novaContaCompleta: ContaBancaria = {
        ...nova,
        id,
        ativa: nova.ativa ?? true,
        cor: nova.cor || '#3B82F6',
        padraoPara: nova.padraoPara || [],
      };

      const listaAtualizada = [...contas, novaContaCompleta];
      if (salvarContas(listaAtualizada)) {
        toast.success(`Conta "${novaContaCompleta.nome}" adicionada com sucesso!`);
        return novaContaCompleta;
      }
      return null;
    },
    [contas, salvarContas]
  );

  const atualizarConta = useCallback(
    (id: string, updates: Partial<ContaBancaria>) => {
      const index = contas.findIndex((c) => c.id === id);
      if (index === -1) return false;

      const listaAtualizada = [...contas];
      listaAtualizada[index] = { ...listaAtualizada[index], ...updates };

      if (salvarContas(listaAtualizada)) {
        toast.success('Conta bancária atualizada com sucesso!');
        return true;
      }
      return false;
    },
    [contas, salvarContas]
  );

  const removerConta = useCallback(
    (id: string) => {
      const listaAtualizada = contas.filter((c) => c.id !== id);
      if (salvarContas(listaAtualizada)) {
        toast.success('Conta bancária removida com sucesso!');
        return true;
      }
      return false;
    },
    [contas, salvarContas]
  );

  const definirPadrao = useCallback(
    (id: string, tipo: 'pix' | 'cartao' | 'dinheiro' | 'despesa') => {
      const listaAtualizada = contas.map((c) => {
        const padroes = new Set(c.padraoPara || []);
        if (c.id === id) {
          padroes.add(tipo);
        } else {
          padroes.delete(tipo);
        }
        return {
          ...c,
          padraoPara: Array.from(padroes),
        };
      });

      if (salvarContas(listaAtualizada)) {
        const contaNome = contas.find((c) => c.id === id)?.nome || 'Conta';
        const tipoLabel =
          tipo === 'pix'
            ? 'PIX'
            : tipo === 'cartao'
            ? 'Cartão'
            : tipo === 'dinheiro'
            ? 'Dinheiro'
            : 'Despesas';
        toast.success(`"${contaNome}" definida como padrão para ${tipoLabel}!`);
        return true;
      }
      return false;
    },
    [contas, salvarContas]
  );

  const restaurarPadroes = useCallback(() => {
    if (salvarContas(CONTAS_BANCARIAS_PADRAO)) {
      toast.success('Contas bancárias restauradas para os padrões originais!');
      return true;
    }
    return false;
  }, [salvarContas]);

  /**
   * Calcula o saldo e movimentações agrupados por conta bancária
   */
  const calcularSaldosContas = useCallback(
    (transacoes: Transacao[]): ResumoSaldoConta[] => {
      const mapResumo = new Map<string, ResumoSaldoConta>();

      // Inicializa com todas as contas conhecidas
      contas.forEach((conta) => {
        mapResumo.set(conta.id, {
          conta,
          totalEntradas: 0,
          totalSaidas: 0,
          saldoAtual: conta.saldoInicial || 0,
          totalPendente: 0,
          quantidadeTransacoes: 0,
        });
      });

      transacoes.forEach((t) => {
        // Tenta resolver a conta: explícita ou deduzida por método/tipo
        let contaId = t.contaBancaria;
        if (!contaId) {
          if (t.tipo === 'despesa') contaId = contaPadraoDespesa.id;
          else if (t.metodoPagamento === 'pix' || t.metodoPagamento === 'pix_parcelado') contaId = contaPadraoPix.id;
          else if (t.metodoPagamento === 'cartao') contaId = contaPadraoCartao.id;
          else if (t.metodoPagamento === 'dinheiro') contaId = contaPadraoDinheiro.id;
          else contaId = contaPadraoPix.id;
        }

        let entry = mapResumo.get(contaId);
        if (!entry) {
          // Conta não encontrada na lista (ex: cadastrada e depois removida)
          const contaFallback: ContaBancaria = {
            id: contaId,
            nome: t.contaBancariaNome || contaId,
            banco: t.contaBancariaNome || 'Outro Banco',
            tipo: 'corrente',
            cor: '#64748B',
            ativa: true,
          };
          entry = {
            conta: contaFallback,
            totalEntradas: 0,
            totalSaidas: 0,
            saldoAtual: 0,
            totalPendente: 0,
            quantidadeTransacoes: 0,
          };
          mapResumo.set(contaId, entry);
        }

        const isPago = t.status === 'pago';
        const valor = Number(t.valor) || 0;

        entry.quantidadeTransacoes += 1;

        if (isPago) {
          if (t.tipo === 'receita') {
            // Se tiver valor líquido (descontada a taxa de cartão), usa no saldo
            const valReal = t.valorLiquido !== undefined && t.valorLiquido !== null ? Number(t.valorLiquido) : valor;
            entry.totalEntradas += valReal;
            entry.saldoAtual += valReal;
          } else if (t.tipo === 'despesa') {
            entry.totalSaidas += valor;
            entry.saldoAtual -= valor;
          }
        } else if (t.status === 'pendente') {
          if (t.tipo === 'receita') {
            entry.totalPendente += valor;
          }
        }
      });

      return Array.from(mapResumo.values());
    },
    [contas, contaPadraoDespesa, contaPadraoPix, contaPadraoCartao, contaPadraoDinheiro]
  );

  return {
    contas,
    contasAtivas,
    contaPadraoPix,
    contaPadraoCartao,
    contaPadraoDinheiro,
    contaPadraoDespesa,
    getContaById,
    obterContaSugeridaParaMetodo,
    adicionarConta,
    atualizarConta,
    removerConta,
    definirPadrao,
    restaurarPadroes,
    calcularSaldosContas,
  };
};
