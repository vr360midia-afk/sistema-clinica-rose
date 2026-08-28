import { useMemo } from 'react';
import { useDentalSystem } from '@/context/dental-system-context';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { useManutencaoLentes } from '@/hooks/useManutencaoLentes';

export type NotificacaoTipo = 'aniversario' | 'orcamento' | 'inadimplencia' | 'manutencao';

export interface Notificacao {
  id: string;
  tipo: NotificacaoTipo;
  titulo: string;
  descricao: string;
  link: string;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const diffDias = (a: Date, b: Date) => Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);

export const useNotificacoes = () => {
  const { pacientes, transacoes } = useDentalSystem();
  const { orcamentos } = useOrcamentos();
  const { pendentes: manutencoes } = useManutencaoLentes(30);

  const notificacoes = useMemo<Notificacao[]>(() => {
    const hoje = new Date();
    const lista: Notificacao[] = [];

    // Aniversários (hoje e próximos 7 dias)
    pacientes.forEach((p: any) => {
      if (!p.dataNascimento) return;
      const nasc = new Date(p.dataNascimento);
      if (isNaN(nasc.getTime())) return;
      let prox = new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate());
      if (diffDias(prox, hoje) < 0) prox = new Date(hoje.getFullYear() + 1, nasc.getMonth(), nasc.getDate());
      const dias = diffDias(prox, hoje);
      if (dias <= 7) {
        lista.push({
          id: `aniv-${p.id}`,
          tipo: 'aniversario',
          titulo: dias === 0 ? `${p.nome} faz aniversário hoje` : `${p.nome} faz aniversário em ${dias} dia(s)`,
          descricao: prox.toLocaleDateString('pt-BR'),
          link: '/pacientes',
        });
      }
    });

    // Orçamentos vencendo (validade em até 7 dias) ou já vencidos e não aprovados
    orcamentos.forEach((o) => {
      if (!o.validade || o.status === 'aprovado' || o.status === 'recusado') return;
      const validade = new Date(o.validade);
      if (isNaN(validade.getTime())) return;
      const dias = diffDias(validade, hoje);
      if (dias <= 7) {
        lista.push({
          id: `orc-${o.id}`,
          tipo: 'orcamento',
          titulo: dias < 0 ? `Orçamento vencido: ${o.titulo}` : `Orçamento vence em ${dias} dia(s)`,
          descricao: `${o.pacienteNome || 'Paciente'} — ${o.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
          link: '/pacientes',
        });
      }
    });

    // Inadimplentes (receitas pendentes vencidas)
    transacoes.forEach((t: any) => {
      if (t.tipo !== 'receita' || t.status === 'pago') return;
      const venc = t.vencimento ? new Date(t.vencimento) : t.data ? new Date(t.data) : null;
      if (!venc || isNaN(venc.getTime())) return;
      const dias = diffDias(hoje, venc);
      if (dias > 0) {
        lista.push({
          id: `inad-${t.id}`,
          tipo: 'inadimplencia',
          titulo: `Pagamento em atraso (${dias} dia(s))`,
          descricao: `${t.pacienteNome || t.descricao || 'Lançamento'} — ${Number(t.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
          link: '/financeiro',
        });
      }
    });

    return lista;
  }, [pacientes, transacoes, orcamentos]);

  return { notificacoes, total: notificacoes.length };
};
