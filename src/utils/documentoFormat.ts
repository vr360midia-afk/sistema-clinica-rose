/**
 * Utilitários para detecção e formatação inteligente de CPF e CNPJ
 */

/**
 * Identifica se um documento é CPF (11 dígitos ou menos) ou CNPJ (14 dígitos).
 */
export const identificarTipoDocumento = (doc?: string | null): 'cpf' | 'cnpj' => {
  if (!doc) return 'cnpj';
  const limpo = String(doc).replace(/\D/g, '');
  if (limpo.length > 0 && limpo.length <= 11) return 'cpf';
  return 'cnpj';
};

/**
 * Retorna o rótulo adequado para exibição ('CPF', 'CPF/MF' ou 'CNPJ').
 */
export const obterRotuloDocumento = (doc?: string | null, incluirMF: boolean = false): string => {
  const tipo = identificarTipoDocumento(doc);
  if (tipo === 'cpf') {
    return incluirMF ? 'CPF/MF' : 'CPF';
  }
  return 'CNPJ';
};

/**
 * Formata um CPF ou CNPJ de acordo com a quantidade de dígitos numéricos.
 */
export const formatarDocumento = (value?: string | null): string => {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};
