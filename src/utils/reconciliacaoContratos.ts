import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ReconciliacaoResultado {
  sucesso: boolean;
  orcamentosAtualizados: number;
  documentosArquivados: number;
  detalhes: string[];
}

/**
 * Rotina oficial de reconciliação de contratos e orçamentos assinados.
 * Varre o banco de dados Supabase e garante:
 * 1. Orçamentos com contratos assinados recebem o status 'assinaturas_realizadas'
 * 2. Documentos do paciente recebem a entrada correspondente com o PDF oficial
 * 3. Idempotente: não gera duplicidades e preserva evidências
 */
export async function reconciliarContratosEOrcamentos(pacienteId?: string): Promise<ReconciliacaoResultado> {
  const detalhes: string[] = [];
  let orcamentosAtualizados = 0;
  let documentosArquivados = 0;

  try {
    const nowIso = new Date().toISOString();

    // 1. Busca todos os contratos clínicos do paciente (ou globais se não informado)
    let queryDocs = supabase
      .from('documentos_clinicos')
      .select('*')
      .eq('tipo', 'contrato');

    if (pacienteId) {
      queryDocs = queryDocs.or(`paciente_id.eq.${pacienteId},itens->>pacienteId.eq.${pacienteId}`);
    }

    const { data: contratos, error: errContratos } = await queryDocs;
    if (errContratos) {
      console.warn('[reconciliarContratos] Erro ao buscar contratos:', errContratos);
      return { sucesso: false, orcamentosAtualizados, documentosArquivados, detalhes: [errContratos.message] };
    }

    // 2. Busca orçamentos
    let queryOrcs = supabase.from('orcamentos').select('*');
    if (pacienteId) {
      queryOrcs = queryOrcs.eq('paciente_id', pacienteId);
    }
    const { data: orcamentos } = await queryOrcs;

    for (const doc of (contratos || [])) {
      const snap = (typeof doc.itens === 'object' && doc.itens) ? doc.itens : {};
      
      const temAssinaturaPaciente = Boolean(
        doc.assinado_em ||
        snap.assinaturaPaciente?.assinaturaData ||
        snap.status === 'assinado' ||
        snap.status === 'formalizado' ||
        doc.status === 'formalizado'
      );

      const temAssinaturaDentista = Boolean(
        snap.assinaturaDentista?.assinaturaData ||
        snap.statusAssinaturaDentista === 'assinado' ||
        doc.conteudo?.includes('Assinado pelo profissional')
      );

      // Se ambas as assinaturas estão presentes, formaliza
      if (temAssinaturaPaciente && temAssinaturaDentista) {
        const identificador = snap.contratoId || doc.id;
        const targetPacId = doc.paciente_id || snap.pacienteId;
        const orcId = snap.orcamentoId || doc.orcamento_id;
        const formalizadoEm = doc.assinado_em || snap.assinaturaPaciente?.dataHora || doc.criado_em || nowIso;
        const canonicalPath = doc.pdf_path || snap.pdfPath || `contratos/${identificador}/Contrato_Assinado_${identificador}.pdf`;

        // A. Garante status em documentos_clinicos
        if (doc.status !== 'formalizado') {
          await supabase
            .from('documentos_clinicos')
            .update({
              status: 'formalizado',
              assinado_em: doc.assinado_em || formalizadoEm,
              itens: { ...snap, status: 'formalizado', isFormalizadoTotal: true },
              atualizado_em: nowIso,
            })
            .eq('id', doc.id);
        }

        // B. Reconcilia o Orçamento associado
        let orcMatch = (orcamentos || []).find((o) => 
          (orcId && o.id === orcId) ||
          (targetPacId && o.paciente_id === targetPacId && (o.status === 'aprovado' || o.contrato_id === identificador || o.assinatura_paciente?.contratoId === identificador))
        );

        if (orcMatch) {
          const currentSnap = (orcMatch.assinatura_paciente || {}) as Record<string, any>;
          const jaReconciliado = currentSnap.contratoStatus === 'assinaturas_realizadas';

          if (!jaReconciliado) {
            const updatedSnap = {
              ...currentSnap,
              contratoId: identificador,
              contratoStatus: 'assinaturas_realizadas',
              statusContrato: 'assinaturas_realizadas',
              contratoFormalizadoEm: currentSnap.contratoFormalizadoEm || formalizadoEm,
              assinaturaDraStatus: 'concluida',
              assinaturaPacienteStatus: 'concluida',
              pdfPath: canonicalPath,
            };

            const { error: updOrcErr } = await supabase
              .from('orcamentos')
              .update({
                contrato_id: identificador,
                assinatura_paciente: updatedSnap,
                data_assinatura: currentSnap.data_assinatura || formalizadoEm,
                atualizado_em: nowIso,
              })
              .eq('id', orcMatch.id);

            if (!updOrcErr) {
              orcamentosAtualizados++;
              detalhes.push(`Orçamento ${orcMatch.id} atualizado para 'assinaturas_realizadas'`);
            }
          }
        }

        // C. Reconcilia Documentos do Paciente (documentos_paciente)
        if (targetPacId) {
          try {
            const { data: existingDp } = await supabase
              .from('documentos_paciente')
              .select('id')
              .eq('paciente_id', targetPacId)
              .or(`url.eq.${canonicalPath},nome.ilike.%${identificador}%`)
              .maybeSingle();

            if (!existingDp) {
              const isUuid = (val: any): boolean => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
              let docPacUserId = isUuid(doc.user_id) ? doc.user_id : (isUuid(orcMatch?.user_id) ? orcMatch.user_id : null);
              if (!docPacUserId && targetPacId) {
                const { data: pRow } = await supabase.from('pacientes').select('user_id').eq('id', targetPacId).maybeSingle();
                if (isUuid(pRow?.user_id)) docPacUserId = pRow.user_id;
              }
              if (!docPacUserId) {
                const { data: s } = await supabase.auth.getSession();
                if (isUuid(s?.session?.user?.id)) docPacUserId = s.session.user.id;
              }

              if (docPacUserId) {
                const { error: insDpErr } = await supabase
                  .from('documentos_paciente')
                  .insert({
                    user_id: docPacUserId,
                    paciente_id: targetPacId,
                    nome: `Contrato Odontológico Assinado - ${identificador}`,
                    tipo: 'contrato',
                    url: canonicalPath,
                    tamanho: 50000,
                    criado_em: formalizadoEm,
                    atualizado_em: nowIso,
                  });

                if (!insDpErr) {
                  documentosArquivados++;
                  detalhes.push(`Documento do paciente arquivado: ${identificador}`);
                }
              }
            }
          } catch (dpErr) {
            console.warn('[reconciliarContratos] Erro ao arquivar em documentos_paciente:', dpErr);
          }
        }
      }
    }

    // 4. Mecanismo de reprocessamento autônomo da fila_arquivamento_pdf no servidor
    try {
      const { data: qData, error: qErr } = await supabase.functions.invoke('contrato-publico', {
        body: { action: 'processar_fila_pdf' },
      });
      if (!qErr && qData?.ok && qData.total > 0) {
        detalhes.push(`Fila de arquivamento reprocessada: ${qData.total} tarefa(s) executada(s) com sucesso`);
      }
    } catch (qEx) {
      console.warn('[reconciliarContratos] Aviso ao reprocessar fila_arquivamento_pdf:', qEx);
    }

    return {
      sucesso: true,
      orcamentosAtualizados,
      documentosArquivados,
      detalhes,
    };
  } catch (err: any) {
    console.error('[reconciliarContratos] Falha geral:', err);
    return {
      sucesso: false,
      orcamentosAtualizados,
      documentosArquivados,
      detalhes: [err?.message || 'Erro desconhecido na reconciliação'],
    };
  }
}

/**
 * Aciona o reprocessamento explícito da fila de arquivamento de PDF no servidor.
 * Protegido com o token de autenticação do usuário logado ou token específico do contrato.
 */
export async function processarFilaArquivamentoPdf(
  contratoId?: string,
  tokenContrato?: string
): Promise<{ ok: boolean; total?: number; error?: string }> {
  try {
    const payload: Record<string, any> = { action: 'processar_fila_pdf' };
    if (contratoId) payload.contratoId = contratoId;
    if (tokenContrato) payload.token = tokenContrato;

    const { data, error } = await supabase.functions.invoke('contrato-publico', {
      body: payload,
    });

    if (error) throw error;
    return { ok: Boolean(data?.ok), total: data?.total || 0 };
  } catch (err: any) {
    console.warn('[processarFilaArquivamentoPdf] Erro:', err);
    return { ok: false, error: err?.message || 'Falha ao acionar processamento da fila' };
  }
}

