/**
 * Utilitário de classificação e filtragem inteligente de procedimentos clínicos.
 * Garante que itens financeiros (taxas de cartão/maquininha, descontos, juros) 
 * não sejam importados como procedimentos clínicos de tratamento.
 */

export interface ItemOrcamentoAnalise {
  nome: string;
  quantidade?: number;
  valor?: number;
  procedimento_id?: string;
  ehClinico: boolean;
  motivoDescarte?: string;
  categoriaSugerida?: string;
}

const REGEX_FINANCEIRO_ESTRITO = /^(taxa|juros|acréscimo|acrescimo|desconto|maquininha|máquina|maquina|parcelamento|cartão|cartao|ajuste\s+financeiro|tarifa|estorno|repasse|iof)/i;

const REGEX_TERMOS_CLINICOS_CONFIRMADOS = /(resina|lente|facet|clareament|plastia|gengiv|carie|cárie|restaura|canal|endo|extrac|extraç|protes|prótese|implante|profilax|limpeza|raspagem|radiograf|raio\s*x|tomograf|cirurg|orto|aparelho|molde|mockup|coroa|pinos|bichectom|botox|preench|harmoniz)/i;

/**
 * Avalia se um item de orçamento é estritamente um procedimento clínico odontológico.
 */
export function isItemProcedimentoClinico(item: { nome?: string; valor?: number; quantidade?: number }): boolean {
  if (!item || !item.nome) return false;
  const nomeLimpo = item.nome.trim();

  // 1. Valores zerados ou negativos nunca são procedimentos clínicos executáveis
  if (typeof item.valor === 'number' && item.valor <= 0) {
    return false;
  }

  // 2. Se começa com termos financeiros conhecidos, descarta imediatamente
  if (REGEX_FINANCEIRO_ESTRITO.test(nomeLimpo)) {
    return false;
  }

  // 3. Verifica termos clínicos típicos da odontologia
  if (REGEX_TERMOS_CLINICOS_CONFIRMADOS.test(nomeLimpo)) {
    return true;
  }

  // 4. Se não contiver termos financeiros evidentes e tiver valor positivo, considera clínico
  // Mas verifica se não contém menção explícita a taxa de maquininha em qualquer posição
  if (/taxa.*(maquina|máquina|cartão|cartao|pagamento)/i.test(nomeLimpo)) {
    return false;
  }

  return true;
}

/**
 * Analisa uma lista de itens de orçamento para apresentação transparente ao usuário.
 */
export function analisarItensOrcamento(itens: Array<{ nome: string; valor?: number; quantidade?: number; procedimento_id?: string }>): ItemOrcamentoAnalise[] {
  if (!Array.isArray(itens)) return [];

  return itens.map(item => {
    const clinico = isItemProcedimentoClinico(item);
    let motivo: string | undefined;

    if (!clinico) {
      if (typeof item.valor === 'number' && item.valor <= 0) {
        motivo = 'Valor zerado ou desconto aplicado';
      } else if (REGEX_FINANCEIRO_ESTRITO.test(item.nome) || /taxa.*(maquina|cartao)/i.test(item.nome)) {
        motivo = 'Taxa financeira ou ajuste de pagamento';
      } else {
        motivo = 'Item não classificado como procedimento odontológico';
      }
    }

    return {
      nome: item.nome,
      quantidade: item.quantidade || 1,
      valor: item.valor || 0,
      procedimento_id: item.procedimento_id,
      ehClinico: clinico,
      motivoDescarte: motivo,
      categoriaSugerida: clinico ? 'Procedimento Clínico' : 'Ajuste Financeiro',
    };
  });
}

