import { differenceInYears, isValid, parseISO } from 'date-fns';

export function calcularIdade(
  dataNascimento: Date | string | undefined | null
): number | undefined {
  if (!dataNascimento) return undefined;

  const data = dataNascimento instanceof Date ? dataNascimento : parseISO(dataNascimento);
  if (!isValid(data)) return undefined;

  return differenceInYears(new Date(), data);
}

export function dataParaInputDate(
  value: Date | string | undefined | null
): string {
  if (!value) return '';
  const data = value instanceof Date ? value : parseISO(value);
  if (!isValid(data)) return '';

  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function formatarDataNascimento(
  value: Date | string | undefined | null
): string {
  if (!value) return '';
  const data = value instanceof Date ? value : parseISO(value);
  if (!isValid(data)) return '';

  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

export function parseDataNascimento(valor: string): Date | undefined {
  if (!valor || !valor.trim()) return undefined;
  const v = valor.trim();

  // ISO: yyyy-mm-dd ou yyyy/mm/dd
  const isoMatch = v.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (isoMatch) {
    const ano = parseInt(isoMatch[1], 10);
    const mes = parseInt(isoMatch[2], 10) - 1;
    const dia = parseInt(isoMatch[3], 10);
    const data = new Date(ano, mes, dia);
    if (data.getFullYear() === ano && data.getMonth() === mes && data.getDate() === dia) {
      return data;
    }
  }

  // Brasileiro: dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy (ano com 2 ou 4 dígitos)
  const brMatch = v.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4}|\d{2})$/);
  if (brMatch) {
    let ano = parseInt(brMatch[3], 10);
    if (ano < 100) {
      ano += ano < 30 ? 2000 : 1900;
    }
    const mes = parseInt(brMatch[2], 10) - 1;
    const dia = parseInt(brMatch[1], 10);
    const data = new Date(ano, mes, dia);
    if (data.getFullYear() === ano && data.getMonth() === mes && data.getDate() === dia) {
      return data;
    }
  }

  // Só dígitos: ddmmyyyy
  const digitos = v.replace(/\D/g, '');
  if (digitos.length === 8) {
    const dia = parseInt(digitos.substring(0, 2), 10);
    const mes = parseInt(digitos.substring(2, 4), 10) - 1;
    const ano = parseInt(digitos.substring(4, 8), 10);
    const data = new Date(ano, mes, dia);
    if (data.getFullYear() === ano && data.getMonth() === mes && data.getDate() === dia) {
      return data;
    }
  }

  return undefined;
}
