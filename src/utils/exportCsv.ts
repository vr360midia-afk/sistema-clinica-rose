/** Utilitários para exportação de relatórios em CSV (compatível com Excel pt-BR) */

const escapeCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const str = value instanceof Date ? value.toLocaleDateString('pt-BR') : String(value);
  return `"${str.replace(/"/g, '""')}"`;
};

export const downloadCSV = (filename: string, headers: string[], rows: unknown[][]) => {
  const content = [headers, ...rows].map((row) => row.map(escapeCell).join(';')).join('\r\n');
  // BOM garante acentuação correta no Excel
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const formatMoney = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
