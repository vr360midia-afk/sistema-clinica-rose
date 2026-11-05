import { supabase } from '@/integrations/supabase/client';
import type { Orcamento } from '@/hooks/useOrcamentos';
import type { Transacao } from '@/types/shared';
import { formatMoney } from './exportCsv';
import { ehTransacaoPaga, ehTransacaoPendente } from './financeiroCalculos';
import { registrarAuditoria } from '@/hooks/useAuditLog';

export interface ElegibilidadeExclusaoFinanceira {
  orcamentoId: string;
  pacienteId?: string | null;
  pacienteNome: string;
  titulo: string;
  valorTotal: number;
  totalPago: number;
  totalPendente: number;
  qtdTransacoes: number;
  temPagamentosPagos: boolean;
  temContratoAssinado: boolean;
  contratoId?: string | null;
  contratoStatus?: string | null;
  isRegistroFicticio: boolean;
  acaoPermitida: 'exclusao_administrativa' | 'cancelamento_financeiro' | 'bloqueado';
  tituloAcao: string;
  motivoSeguranca: string;
  podeExcluirDireto: boolean;
  podeCancelarFinanceiro: boolean;
}

/**
 * Detecta se o registro possui indicativos claros de ambiente de teste ou homologação
 */
export function isRegistroFicticioTeste(orcamento: Partial<Orcamento>): boolean {
  const texto = `${orcamento.pacienteNome || ''} ${orcamento.titulo || ''} ${orcamento.observacoes || ''}`.toLowerCase();
  return (
    texto.includes('fictício') ||
    texto.includes('ficticia') ||
    texto.includes('ficticio') ||
    texto.includes('teste') ||
    texto.includes('homolog') ||
    texto.includes('mock') ||
    texto.includes('juliana mendes') ||
    texto.includes('carlos eduardo de albuquerque')
  );
}

/**
 * Analisa um card de orçamento e suas transações vinculadas, determinando
 * com rigor as regras de elegibilidade para exclusão ou arquivamento.
 */
export function analisarElegibilidadeFinanceira(
  orcamento: Orcamento,
  transacoes: Transacao[] = []
): ElegibilidadeExclusaoFinanceira {
  const transVinculadas = (transacoes || []).filter((t) => t.orcamentoId === orcamento.id);

  const totalPago = transVinculadas
    .filter((t) => ehTransacaoPaga(t))
    .reduce((s, t) => s + Number(t.valor || 0), 0);

  const totalPendente = transVinculadas
    .filter((t) => ehTransacaoPendente(t))
    .reduce((s, t) => s + Number(t.valor || 0), 0);

  const temPagamentosPagos = totalPago > 0.009;

  // Verifica contrato formalizado
  const snap = (orcamento as any).assinatura_paciente || (orcamento as any).assinaturaPaciente || {};
  const contratoId = orcamento.contratoId || snap.contratoId || null;
  const contratoStatus = orcamento.contratoStatus || snap.contratoStatus || snap.statusContrato || null;

  const temContratoAssinado = Boolean(
    contratoId &&
    (contratoStatus === 'assinado' ||
      contratoStatus === 'formalizado' ||
      contratoStatus === 'assinaturas_realizadas' ||
      contratoStatus === 'aguardando_assinatura_dentista' ||
      contratoStatus === 'aguardando_assinatura_paciente' ||
      snap.assinaturaPaciente ||
      snap.assinaturaDentista ||
      snap.assinaturaPacienteStatus === 'concluida' ||
      snap.assinaturaDraStatus === 'concluida')
  );

  const isFicticio = isRegistroFicticioTeste(orcamento);

  let acaoPermitida: 'exclusao_administrativa' | 'cancelamento_financeiro' | 'bloqueado' = 'exclusao_administrativa';
  let tituloAcao = 'Exclusão Administrativa';
  let motivoSeguranca = 'Registro sem pagamentos ou contratos formais. Elegível para remoção com trilha de auditoria.';
  let podeExcluirDireto = true;
  let podeCancelarFinanceiro = true;

  if (temPagamentosPagos) {
    acaoPermitida = 'cancelamento_financeiro';
    tituloAcao = 'Cancelamento Financeiro (Caixa Preservado)';
    motivoSeguranca = `Possui ${formatMoney(totalPago)} recebidos no Caixa. Movimentações quitadas e comprovantes NÃO serão apagados. Apenas o saldo em aberto será cancelado.`;
    podeExcluirDireto = false;
  } else if (temContratoAssinado) {
    acaoPermitida = 'cancelamento_financeiro';
    tituloAcao = 'Cancelamento/Arquivamento Financeiro';
    motivoSeguranca = `Possui Contrato Digital (${contratoId}) registrado. O contrato, as assinaturas e o PDF jurídico permanecerão 100% INTACTOS. O lançamento será apenas retirado da visão operacional.`;
    podeExcluirDireto = false;
  } else if (isFicticio) {
    acaoPermitida = 'exclusao_administrativa';
    tituloAcao = 'Limpeza de Registro de Teste';
    motivoSeguranca = 'Identificado como registro fictício gerado em testes/homologação. Aprovado para remoção administrativa limpa.';
    podeExcluirDireto = true;
  }

  return {
    orcamentoId: orcamento.id,
    pacienteId: orcamento.pacienteId,
    pacienteNome: orcamento.pacienteNome || 'Paciente não informado',
    titulo: orcamento.titulo || 'Plano de Tratamento',
    valorTotal: Number(orcamento.total || 0),
    totalPago,
    totalPendente,
    qtdTransacoes: transVinculadas.length,
    temPagamentosPagos,
    temContratoAssinado,
    contratoId,
    contratoStatus,
    isRegistroFicticio: isFicticio,
    acaoPermitida,
    tituloAcao,
    motivoSeguranca,
    podeExcluirDireto,
    podeCancelarFinanceiro,
  };
}

/**
 * Move registro para a lixeira administrativa com snapshot JSON (tolerante a esquema)
 */
async function moverParaLixeira(entidade: string, entidadeId: string, titulo: string, dados: any, usuarioEmail?: string | null, customClient?: any) {
  try {
    const client = customClient || supabase;
    const { data: sessionData } = await client.auth.getSession();
    const userId = sessionData?.session?.user?.id || dados?.user_id;
    if (!userId) return;

    await (client as any).from('lixeira').insert({
      user_id: userId,
      entidade,
      entidade_id: entidadeId,
      titulo,
      dados,
      excluido_por: usuarioEmail || sessionData?.session?.user?.email || null,
    });
  } catch (err) {
    console.warn('[Lixeira] Registro não persistido na tabela lixeira:', err);
  }
}

/**
 * Sincroniza cancelamento/remoção no localStorage caso o navegador esteja operando com cache local
 */
function sincronizarLocalStorageTransacoes(removerIds: string[], cancelarIds: string[]) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const key = 'dental-system-transacoes';
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const lista: any[] = JSON.parse(raw);
    const toRemove = new Set(removerIds);
    const toCancel = new Set(cancelarIds);

    const filtrada = lista
      .filter((t) => !toRemove.has(t.id))
      .map((t) => (toCancel.has(t.id) ? { ...t, status: 'cancelado' } : t));

    localStorage.setItem(key, JSON.stringify(filtrada));
  } catch (err) {
    console.warn('[LocalStorage] Falha ao sincronizar transações locais:', err);
  }
}

export interface ResultadoExclusaoFinanceira {
  ok: boolean;
  tipo: 'excluido' | 'cancelado';
  mensagem: string;
  error?: string;
}

/**
 * Executa a exclusão ou cancelamento de um orçamento financeiro e suas parcelas
 * com estrito cumprimento das regras de segurança e auditoria.
 *
 * NUNCA executa exclusões em cascata em:
 * - Pacientes
 * - Prontuários
 * - Documentos clínicos / Contratos / PDFs
 * - Transações com status 'pago' (histórico de caixa)
 */
export async function executarExclusaoOuCancelamentoFinanceiro({
  orcamento,
  transacoesVinculadas = [],
  motivo,
  usuarioEmail,
  forcarCancelamentoSePossivel = false,
  customClient,
}: {
  orcamento: Orcamento;
  transacoesVinculadas?: Transacao[];
  motivo: string;
  usuarioEmail?: string | null;
  forcarCancelamentoSePossivel?: boolean;
  customClient?: any;
}): Promise<ResultadoExclusaoFinanceira> {
  const client = customClient || supabase;
  if (!motivo || motivo.trim().length < 3) {
    return {
      ok: false,
      tipo: 'cancelado',
      mensagem: 'O motivo da exclusão ou cancelamento é obrigatório (mínimo 3 caracteres).',
      error: 'Motivo obrigatório',
    };
  }

  const analise = analisarElegibilidadeFinanceira(orcamento, transacoesVinculadas);

  // Se tem pagamentos ou contrato, ou se o usuário optou por cancelamento: CANCELAMENTO/ARQUIVAMENTO FINANCEIRO
  if (!analise.podeExcluirDireto || forcarCancelamentoSePossivel) {
    try {
      const canceladasIds: string[] = [];

      // 1. Cancela parcelas pendentes vinculadas (NUNCA toca nas pagas!)
      for (const t of transacoesVinculadas) {
        if (ehTransacaoPaga(t)) {
          // Histórico de caixa permanece estritamente intocado
          continue;
        }
        canceladasIds.push(t.id);
        try {
          await client
            .from('transacoes')
            .update({
              status: 'cancelado',
              atualizado_em: new Date().toISOString(),
            })
            .eq('id', t.id);
        } catch (_) {}

        await registrarAuditoria({
          acao: 'cancelamento_parcela',
          entidade: 'transacao',
          entidadeId: t.id,
          descricao: `Parcela cancelada (${t.descricao}): ${motivo}`,
          dados: { orcamentoId: orcamento.id, valor: t.valor },
        });
      }

      sincronizarLocalStorageTransacoes([], canceladasIds);

      // 2. Atualiza o status do orçamento para 'cancelado' mantendo histórico
      const snapExistente = (orcamento as any).assinatura_paciente || (orcamento as any).assinaturaPaciente || {};
      const snapAtualizado = {
        ...snapExistente,
        statusFinanceiro: 'cancelado',
        canceladoEm: new Date().toISOString(),
        canceladoPor: usuarioEmail || 'administrador',
        motivoCancelamentoFinanceiro: motivo,
      };

      const { error: orcErr } = await client
        .from('orcamentos')
        .update({
          status: 'cancelado',
          assinatura_paciente: snapAtualizado,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', orcamento.id);

      if (orcErr) {
        throw new Error(`Falha ao cancelar orçamento: ${orcErr.message}`);
      }

      // 3. Registra auditoria da operação
      await registrarAuditoria({
        acao: 'cancelamento_financeiro',
        entidade: 'orcamento',
        entidadeId: orcamento.id,
        descricao: `Lançamento financeiro cancelado: ${orcamento.titulo} (${formatMoney(orcamento.total)}) — Motivo: ${motivo}`,
        dados: {
          pacienteId: orcamento.pacienteId,
          pacienteNome: orcamento.pacienteNome,
          total: orcamento.total,
          pagoPreservado: analise.totalPago,
          pendenteCancelado: analise.totalPendente,
          contratoPreservadoId: analise.contratoId,
        },
      });

      return {
        ok: true,
        tipo: 'cancelado',
        mensagem: analise.temContratoAssinado
          ? `Lançamento cancelado e arquivado com sucesso. O Contrato (${analise.contratoId}) e o histórico de caixa foram 100% preservados.`
          : 'Lançamento financeiro cancelado com sucesso. Histórico do caixa mantido intacto.',
      };
    } catch (err: any) {
      console.error('Erro ao executar cancelamento financeiro:', err);
      return { ok: false, tipo: 'cancelado', mensagem: err.message, error: err.message };
    }
  }

  // EXCLUSÃO ADMINISTRATIVA DIRETA (Para registros sem pagamentos e sem contratos)
  try {
    const removidasIds: string[] = [];

    // 1. Move transações pendentes vinculadas para a lixeira e remove da tabela
    for (const t of transacoesVinculadas) {
      removidasIds.push(t.id);
      await moverParaLixeira('transacoes', t.id, t.descricao, t, usuarioEmail, client);
      try {
        await client.from('transacoes').delete().eq('id', t.id);
      } catch (_) {}
    }

    sincronizarLocalStorageTransacoes(removidasIds, []);

    // 2. Move orçamento para a lixeira
    await moverParaLixeira(
      'orcamentos',
      orcamento.id,
      orcamento.titulo || `Orçamento ${orcamento.id}`,
      orcamento,
      usuarioEmail,
      client
    );

    // 3. Remove orçamento da tabela orcamentos
    const { error: delErr } = await client.from('orcamentos').delete().eq('id', orcamento.id);
    if (delErr) {
      throw new Error(`Falha ao remover orçamento: ${delErr.message}`);
    }

    // 4. Registra auditoria rigorosa
    await registrarAuditoria({
      acao: 'exclusao_financeira_administrativa',
      entidade: 'orcamento',
      entidadeId: orcamento.id,
      descricao: `Orçamento/Lançamento excluído: ${orcamento.titulo} (${formatMoney(orcamento.total)}) — Motivo: ${motivo}`,
      dados: {
        pacienteId: orcamento.pacienteId,
        pacienteNome: orcamento.pacienteNome,
        total: orcamento.total,
        isFicticio: analise.isRegistroFicticio,
        parcelasRemovidas: transacoesVinculadas.length,
      },
    });

    return {
      ok: true,
      tipo: 'excluido',
      mensagem: 'Lançamento financeiro removido administrativamente com sucesso.',
    };
  } catch (err: any) {
    console.error('Erro ao executar exclusão administrativa:', err);
    return { ok: false, tipo: 'excluido', mensagem: err.message, error: err.message };
  }
}

/**
 * Executa exclusão e cancelamento em lote com análise consolidada prévia
 */
export async function executarExclusaoLoteFinanceiro({
  itens,
  transacoes = [],
  motivo,
  usuarioEmail,
  customClient,
}: {
  itens: Orcamento[];
  transacoes?: Transacao[];
  motivo: string;
  usuarioEmail?: string | null;
  customClient?: any;
}): Promise<{
  totalProcessados: number;
  totalExcluidos: number;
  totalCancelados: number;
  totalFalhas: number;
  detalhes: { id: string; titulo: string; tipo: string; mensagem: string }[];
}> {
  let totalExcluidos = 0;
  let totalCancelados = 0;
  let totalFalhas = 0;
  const detalhes: { id: string; titulo: string; tipo: string; mensagem: string }[] = [];

  for (const orc of itens) {
    const transVinculadas = (transacoes || []).filter((t) => t.orcamentoId === orc.id);
    const res = await executarExclusaoOuCancelamentoFinanceiro({
      orcamento: orc,
      transacoesVinculadas: transVinculadas,
      motivo,
      usuarioEmail,
      customClient,
    });

    if (res.ok) {
      if (res.tipo === 'excluido') totalExcluidos++;
      else totalCancelados++;
      detalhes.push({ id: orc.id, titulo: orc.titulo, tipo: res.tipo, mensagem: res.mensagem });
    } else {
      totalFalhas++;
      detalhes.push({ id: orc.id, titulo: orc.titulo, tipo: 'falha', mensagem: res.mensagem });
    }
  }

  // Registra auditoria consolidada do lote
  await registrarAuditoria({
    acao: 'exclusao_lote_financeiro',
    entidade: 'orcamentos_lote',
    descricao: `Operação em lote concluída: ${totalExcluidos} excluídos, ${totalCancelados} cancelados, ${totalFalhas} falhas — Motivo: ${motivo}`,
    dados: { totalProcessados: itens.length, totalExcluidos, totalCancelados, totalFalhas },
  });

  return {
    totalProcessados: itens.length,
    totalExcluidos,
    totalCancelados,
    totalFalhas,
    detalhes,
  };
}


export interface ValidacaoEdicaoFinanceira {
  podeEditarValores: boolean;
  podeEditarTermos: boolean;
  temContratoEmitidoOuAssinado: boolean;
  motivoBloqueio?: string;
}

/**
 * Valida com rigor se um registro financeiro/orçamento pode ter seus valores ou termos editados.
 * Bloqueia estritamente a alteração de contratos já emitidos ou assinados para preservar segurança jurídica.
 */
export function validarPodeEditarRegistro(orcamento: Orcamento): ValidacaoEdicaoFinanceira {
  const snap = (orcamento as any).assinatura_paciente || (orcamento as any).assinaturaPaciente || {};
  const contratoId = orcamento.contratoId || snap.contratoId || null;
  const contratoStatus = orcamento.contratoStatus || snap.contratoStatus || snap.statusContrato || null;
  const temAssinatura = Boolean(
    snap.assinaturaPaciente ||
    snap.assinaturaDentista ||
    orcamento.assinaturaPacienteStatus === 'assinado' ||
    orcamento.assinaturaDraStatus === 'assinado' ||
    contratoStatus === 'formalizado' ||
    contratoStatus === 'assinado'
  );

  if (contratoId || temAssinatura) {
    return {
      podeEditarValores: false,
      podeEditarTermos: false,
      temContratoEmitidoOuAssinado: true,
      motivoBloqueio: 'Este orçamento possui contrato jurídico emitido ou assinado. Termos e valores contratuais não podem ser alterados retroativamente.',
    };
  }

  return {
    podeEditarValores: true,
    podeEditarTermos: true,
    temContratoEmitidoOuAssinado: false,
  };
}

/**
 * Executa edição permitida de um registro financeiro com auditoria rigorosa
 */
export async function executarEdicaoRegistroFinanceiro({
  orcamento,
  dadosAtualizados,
  motivo,
  usuarioEmail,
  customClient,
}: {
  orcamento: Orcamento;
  dadosAtualizados: {
    titulo?: string;
    observacoes?: string;
    total?: number;
    formasPagamento?: string;
  };
  motivo: string;
  usuarioEmail?: string | null;
  customClient?: any;
}): Promise<{ ok: boolean; mensagem: string }> {
  const validacao = validarPodeEditarRegistro(orcamento);
  if (!validacao.podeEditarValores && (dadosAtualizados.total !== undefined && dadosAtualizados.total !== orcamento.total)) {
    return {
      ok: false,
      mensagem: validacao.motivoBloqueio || 'Edição de valores contratuais bloqueada.',
    };
  }

  const client = customClient || supabase;
  try {
    const payload: any = {
      atualizado_em: new Date().toISOString(),
    };
    if (dadosAtualizados.titulo) payload.titulo = dadosAtualizados.titulo;
    if (dadosAtualizados.observacoes !== undefined) payload.observacoes = dadosAtualizados.observacoes;
    if (validacao.podeEditarValores && dadosAtualizados.total !== undefined) payload.total = dadosAtualizados.total;
    if (validacao.podeEditarTermos && dadosAtualizados.formasPagamento !== undefined) payload.formas_pagamento = dadosAtualizados.formasPagamento;

    const { error } = await client.from('orcamentos').update(payload).eq('id', orcamento.id);
    if (error) throw error;

    await registrarAuditoria({
      acao: 'edicao_financeira_administrativa',
      entidade: 'orcamento',
      entidadeId: orcamento.id,
      descricao: `Lançamento financeiro editado (${dadosAtualizados.titulo || orcamento.titulo}) — Motivo: ${motivo}`,
      dados: { anterior: { titulo: orcamento.titulo, total: orcamento.total, observacoes: orcamento.observacoes }, novo: dadosAtualizados, usuarioEmail },
    });

    return { ok: true, mensagem: 'Lançamento financeiro atualizado com sucesso.' };
  } catch (err: any) {
    return { ok: false, mensagem: err.message || 'Falha ao atualizar orçamento' };
  }
}
