/**
 * Utilitário de Classificação Estruturada de Procedimentos Clínicos e Filtro Financeiro.
 * 
 * Regra de Segurança:
 * 1. Não confunde taxas financeiras (maquininha, juros, descontos) com procedimentos clínicos.
 * 2. Classifica em 3 categorias:
 *    - 'clinico': Procedimentos clínicos odontológicos confirmados (ex: resinas, lentes, canais, implantes, etc.).
 *    - 'financeiro': Taxas bancárias, maquininha de cartão, parcelamentos, juros e descontos comerciais.
 *    - 'ambiguo': Itens não estritamente odontológicos ou com nomes genéricos (ex: "Sessão extra", "Kit clareador", "Retorno técnico"),
 *                 que requerem CONFIRMAÇÃO MANUAL do profissional antes da importação.
 * 3. Não descarta procedimentos legítimos apenas pelo nome ou preço.
 */

export type TipoClassificacaoItem = 'clinico' | 'financeiro' | 'ambiguo';

export interface ItemOrcamentoAnalise {
  index: number;
  nome: string;
  quantidade: number;
  valor: number;
  procedimento_id?: string;
  dente_regiao?: string;
  tipoClassificacao: TipoClassificacaoItem;
  ehClinico: boolean;
  necessitaConfirmacaoManual: boolean;
  motivoClassificacao: string;
  categoriaSugerida: string;
}

// Termos estritamente financeiros e administrativos que nunca constituem atos clínicos
const REGEX_FINANCEIRO_ESTRITO = /^(taxa|juros|acréscimo|acrescimo|desconto|maquininha|máquina|maquina|maquineta|parcelamento|cartão|cartao|ajuste\s+financeiro|tarifa|estorno|repasse|iof|comissão|comissao|honorários\s+advoc|taxa\s+adm)/i;

// Menção a taxas de cartão em qualquer posição do texto
const REGEX_TAXA_CARTAO_QUALQUER_POSICAO = /taxa.*(maquina|máquina|cartão|cartao|pagamento|parcelamento|crédito|credito|débito|debito|maquineta)/i;

// Vocabulário clínico odontológico abrangente
const REGEX_TERMOS_CLINICOS_CONFIRMADOS = /(resina|lente|facet|clareament|plastia|gengiv|carie|cárie|restaura|canal|endo|extrac|extraç|protes|prótese|implante|profilax|limpeza|raspagem|radiograf|raio\s*x|tomograf|cirurg|orto|aparelho|molde|mockup|coroa|pinos|bichectom|botox|preench|harmoniz|oclusal|alinhador|placa|bruxismo|exodontia|periodont|curativo|enxerto|sutura|recobrimento|reembasamento|provisório|provisorio|facetamento)/i;

// Termos anatômicos dentários que atestam natureza clínica mesmo que o nome seja genérico
const REGEX_ANATOMIA_DENTAL = /(dente|dentes|arcada|superior|inferior|elemento|incisivo|canino|pré-molar|pre-molar|molar|molares|hemiarco|quadrante|mesial|distal|vestibular|palatina|lingual)/i;

/**
 * Classifica estruturadamente um item do orçamento.
 */
export function classificarItemOrcamento(
  item: { nome?: string; valor?: number; quantidade?: number; procedimento_id?: string; dente_regiao?: string },
  index: number = 0
): ItemOrcamentoAnalise {
  const nomeLimpo = (item?.nome || '').trim();
  const valor = typeof item?.valor === 'number' ? item.valor : 0;
  const quantidade = typeof item?.quantidade === 'number' && item.quantidade > 0 ? item.quantidade : 1;
  const denteRegiao = (item?.dente_regiao || '').trim();

  // 1. Caso claramente financeiro: valores negativos, descontos ou início com taxas financeiras
  if (valor < 0 || nomeLimpo.toLowerCase().startsWith('desconto')) {
    return {
      index,
      nome: nomeLimpo,
      quantidade,
      valor,
      procedimento_id: item?.procedimento_id,
      dente_regiao: denteRegiao,
      tipoClassificacao: 'financeiro',
      ehClinico: false,
      necessitaConfirmacaoManual: false,
      motivoClassificacao: 'Desconto comercial ou dedução financeira',
      categoriaSugerida: 'Ajuste Financeiro',
    };
  }

  if (REGEX_FINANCEIRO_ESTRITO.test(nomeLimpo) || REGEX_TAXA_CARTAO_QUALQUER_POSICAO.test(nomeLimpo)) {
    return {
      index,
      nome: nomeLimpo,
      quantidade,
      valor,
      procedimento_id: item?.procedimento_id,
      dente_regiao: denteRegiao,
      tipoClassificacao: 'financeiro',
      ehClinico: false,
      necessitaConfirmacaoManual: false,
      motivoClassificacao: 'Taxa de maquininha / meio de pagamento / encargo financeiro',
      categoriaSugerida: 'Taxa Financeira',
    };
  }

  // 2. Caso clínico confirmado por anatomia dental preenchida
  if (denteRegiao.length > 0 || REGEX_ANATOMIA_DENTAL.test(nomeLimpo)) {
    return {
      index,
      nome: nomeLimpo,
      quantidade,
      valor,
      procedimento_id: item?.procedimento_id,
      dente_regiao: denteRegiao,
      tipoClassificacao: 'clinico',
      ehClinico: true,
      necessitaConfirmacaoManual: false,
      motivoClassificacao: 'Procedimento clínico com especificação anatômica dentária',
      categoriaSugerida: 'Procedimento Clínico',
    };
  }

  // 3. Caso clínico confirmado por vocabulário odontológico
  if (REGEX_TERMOS_CLINICOS_CONFIRMADOS.test(nomeLimpo)) {
    return {
      index,
      nome: nomeLimpo,
      quantidade,
      valor,
      procedimento_id: item?.procedimento_id,
      dente_regiao: denteRegiao,
      tipoClassificacao: 'clinico',
      ehClinico: true,
      necessitaConfirmacaoManual: false,
      motivoClassificacao: 'Procedimento clínico odontológico reconhecido',
      categoriaSugerida: 'Procedimento Clínico',
    };
  }

  // 4. Caso ambíguo: itens com valor positivo que não contêm termos odontológicos clássicos nem termos financeiros óbvios
  // (ex: "Kit Home Care", "Sessão Especial de Acompanhamento", "Material Importado", "Retorno Clínico")
  // Não exclui automaticamente! Sinaliza para confirmação manual.
  return {
    index,
    nome: nomeLimpo,
    quantidade,
    valor,
    procedimento_id: item?.procedimento_id,
    dente_regiao: denteRegiao,
    tipoClassificacao: 'ambiguo',
    ehClinico: true, // Permitido mediante confirmação
    necessitaConfirmacaoManual: true,
    motivoClassificacao: 'Item de natureza mista ou genérica — requer confirmação do profissional',
    categoriaSugerida: 'Confirmação Manual',
  };
}

/**
 * Função de retrocompatibilidade para validação booleana direta.
 */
export function isItemProcedimentoClinico(item: { nome?: string; valor?: number; quantidade?: number; dente_regiao?: string }): boolean {
  const analise = classificarItemOrcamento(item);
  return analise.tipoClassificacao === 'clinico' || analise.tipoClassificacao === 'ambiguo';
}

/**
 * Analisa a lista completa de itens do orçamento retornando a classificação estruturada.
 */
export function analisarItensOrcamento(
  itens: Array<{ nome: string; valor?: number; quantidade?: number; procedimento_id?: string; dente_regiao?: string }>
): ItemOrcamentoAnalise[] {
  if (!Array.isArray(itens)) return [];
  return itens.map((item, idx) => classificarItemOrcamento(item, idx + 1));
}
