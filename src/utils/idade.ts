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
