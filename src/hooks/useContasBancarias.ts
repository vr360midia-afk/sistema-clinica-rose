import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import {
  ContaBancaria,
  ResumoSaldoConta,
  TipoContaBancaria,
  SaldoProgressivoInfo,
  MovimentacaoExtratoConta,
} from '@/types/contaBancaria';
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
    saldoInicial: 0,
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
    saldoInicial: 0,
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
    saldoInicial: 0,
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
    saldoInicial: 0,
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
    saldoInicial: 0,
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
    saldoInicial: 0,
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

  /**
   * Resolve o ID da conta de uma transação (explícita ou por dedução inteligente)
   */
  const obterContaIdParaTransacao = useCallback(
    (t: Transacao): string => {
      if (t.contaBancaria) return t.contaBancaria;
      if (t.tipo === 'despesa') return contaPadraoDespesa.id;
      if (t.metodoPagamento === 'pix' || t.metodoPagamento === 'pix_parcelado') return contaPadraoPix.id;
      if (t.metodoPagamento === 'cartao') return contaPadraoCartao.id;
      if (t.metodoPagamento === 'dinheiro') return contaPadraoDinheiro.id;
      return contaPadraoPix.id;
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
        saldoInicial: nova.saldoInicial || 0,
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
        const contaId = obterContaIdParaTransacao(t);

        let entry = mapResumo.get(contaId);
        if (!entry) {
          const contaFallback: ContaBancaria = {
            id: contaId,
            nome: t.contaBancariaNome || contaId,
            banco: t.contaBancariaNome || 'Outro Banco',
            tipo: 'corrente',
            cor: '#64748B',
            ativa: true,
            saldoInicial: 0,
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
    [contas, obterContaIdParaTransacao]
  );

  /**
   * Calcula o Saldo Progressivo (Running Balance) de cada transação paga no tempo.
   * Conforme cada receita entra (+), soma no saldo da conta.
   * Conforme cada despesa é quitada (-), desconta do saldo da conta.
   * Retorna um Map com transacao.id -> { saldoAnterior, impacto, saldoApos }
   */
  const calcularSaldoProgressivoTransacoes = useCallback(
    (transacoes: Transacao[]): Map<string, SaldoProgressivoInfo> => {
      const mapa = new Map<string, SaldoProgressivoInfo>();

      // Saldos correntes por conta bancária, iniciando pelo saldoInicial configurado
      const saldosCorrentes = new Map<string, number>();
      contas.forEach((c) => {
        saldosCorrentes.set(c.id, c.saldoInicial || 0);
      });

      // Ordena cronologicamente do passado para o presente (mais antigas primeiro)
      const ordenadas = [...transacoes].sort((a, b) => {
        const timeA = new Date(a.data).getTime();
        const timeB = new Date(b.data).getTime();
        if (timeA !== timeB) return timeA - timeB;
        const criadoA = a.criadoEm ? new Date(a.criadoEm).getTime() : 0;
        const criadoB = b.criadoEm ? new Date(b.criadoEm).getTime() : 0;
        return criadoA - criadoB;
      });

      for (const t of ordenadas) {
        const cId = obterContaIdParaTransacao(t);
        const saldoAtual = saldosCorrentes.get(cId) ?? 0;

        if (t.status === 'pago') {
          let impacto = 0;
          if (t.tipo === 'receita') {
            const valReal = t.valorLiquido !== undefined && t.valorLiquido !== null ? Number(t.valorLiquido) : Number(t.valor) || 0;
            impacto = valReal;
          } else if (t.tipo === 'despesa') {
            impacto = -(Number(t.valor) || 0);
          }

          const novoSaldo = Number((saldoAtual + impacto).toFixed(2));
          saldosCorrentes.set(cId, novoSaldo);

          mapa.set(t.id, {
            saldoAnterior: saldoAtual,
            impacto,
            saldoApos: novoSaldo,
            isPendente: false,
          });
        } else {
          mapa.set(t.id, {
            saldoAnterior: saldoAtual,
            impacto: 0,
            saldoApos: saldoAtual,
            isPendente: true,
          });
        }
      }

      return mapa;
    },
    [contas, obterContaIdParaTransacao]
  );

  /**
   * Gera o extrato detalhado de uma conta bancária com cada entrada somando e saída descontando
   */
  const gerarExtratoConta = useCallback(
    (contaId: string, transacoes: Transacao[]): MovimentacaoExtratoConta[] => {
      const mapaProgressivo = calcularSaldoProgressivoTransacoes(transacoes);
      const conta = getContaById(contaId) || contas[0];

      return transacoes
        .filter((t) => obterContaIdParaTransacao(t) === contaId)
        .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
        .map((t) => {
          const info = mapaProgressivo.get(t.id);
          const isReceita = t.tipo === 'receita';
          const valNum = isReceita && t.valorLiquido !== undefined && t.valorLiquido !== null ? Number(t.valorLiquido) : Number(t.valor) || 0;

          return {
            transacaoId: t.id,
            data: new Date(t.data),
            descricao: t.descricao || (isReceita ? 'Receita' : 'Despesa'),
            pacienteNome: t.pacienteNome,
            metodoPagamento: t.metodoPagamento,
            tipo: t.tipo,
            valor: valNum,
            impacto: info?.impacto ?? (isReceita ? valNum : -valNum),
            saldoApos: info?.saldoApos ?? 0,
            contaId,
            contaNome: conta?.nome || contaId,
            contaCor: conta?.cor || '#3b82f6',
            status: t.status,
          };
        });
    },
    [calcularSaldoProgressivoTransacoes, getContaById, contas, obterContaIdParaTransacao]
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
    obterContaIdParaTransacao,
    adicionarConta,
    atualizarConta,
    removerConta,
    definirPadrao,
    restaurarPadroes,
    calcularSaldosContas,
    calcularSaldoProgressivoTransacoes,
    gerarExtratoConta,
  };
};
