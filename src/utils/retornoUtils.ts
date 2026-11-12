/**
 * Utilitários para classificação e gerenciamento de retornos clínicos.
 */

export interface ConsultaLike {
  id?: string;
  data?: Date | string;
  hora?: string;
  procedimento?: string | null;
  observacoes?: string | null;
  tipo?: string | null;
  isRetorno?: boolean | null;
  status?: string | null;
  dentista?: string | null;
}

/**
 * Determina se uma consulta é classificada como retorno clínico.
 *
 * Um agendamento é considerado retorno se:
 * 1. Possuir a flag explícita isRetorno = true ou tipo === 'retorno';
 * 2. O procedimento contiver a palavra 'retorno' (ex: 'Consulta de Retorno', 'Retorno Clínico', 'Retorno Ortodôntico');
 * 3. O procedimento for um procedimento pós-tratamento específico de retorno (ex: 'Revisão Pós-Operatório', 'Retirada de Pontos');
 * 4. As observações contiverem a marcação '[Retorno' (ex: '[Retorno agendado]', '[Retorno - Ref: ...]').
 *
 * Consultas normais (ex: 'Limpeza', 'Clareamento', 'Restauração', 'Avaliação') NUNCA são consideradas retorno.
 */
export const isConsultaRetorno = (consulta?: ConsultaLike | null): boolean => {
  if (!consulta) return false;
  if (consulta.isRetorno === true) return true;
  if (consulta.tipo === 'retorno') return true;

  const proc = (consulta.procedimento || '').trim().toLowerCase();
  const obs = (consulta.observacoes || '').trim().toLowerCase();

  // Procedimentos que são explicitamente retornos
  if (proc.includes('retorno')) return true;
  if (proc.includes('revisão pós') || proc.includes('revisao pos')) return true;
  if (proc.includes('retirada de pontos')) return true;

  // Tag explícita nas observações gravada pelo sistema
  if (obs.includes('[retorno') || obs.startsWith('retorno:')) return true;

  return false;
};

/**
 * Extrai a referência da consulta de origem a partir das observações do retorno, se houver.
 * Ex: "[Retorno - Ref: Clareamento de 10/11/2026] Paciente bem" -> "Clareamento de 10/11/2026"
 */
export const extrairOrigemRetorno = (observacoes?: string | null): string | null => {
  if (!observacoes) return null;
  const match = observacoes.match(/\[Retorno\s*-\s*(?:Ref|Origem):\s*([^\]]+)\]/i);
  return match ? match[1].trim() : null;
};

/**
 * Monta a string de observações padronizada para um agendamento de retorno.
 */
export const montarObservacoesRetorno = (params: {
  observacoes?: string;
  consultaOrigem?: ConsultaLike | null;
}): string => {
  const { observacoes = '', consultaOrigem } = params;
  const obsLivre = observacoes.replace(/\[Retorno[^\]]*\]/gi, '').trim();

  if (consultaOrigem) {
    const dataStr = consultaOrigem.data
      ? new Date(consultaOrigem.data).toLocaleDateString('pt-BR')
      : '';
    const procStr = consultaOrigem.procedimento || 'Consulta';
    const refStr = dataStr ? `${procStr} de ${dataStr}` : procStr;
    const tag = `[Retorno - Ref: ${refStr}]`;
    return obsLivre ? `${tag} ${obsLivre}` : tag;
  }

  const tag = '[Retorno agendado]';
  return obsLivre ? `[Retorno] ${obsLivre}` : tag;
};

