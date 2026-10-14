/**
 * Utilitários de cálculo e formatação de horários e duração de consultas
 */

/** Converte "HH:mm" para o total de minutos desde 00:00 */
export const timeToMinutes = (timeStr?: string | null): number => {
  if (!timeStr) return 0;
  const partes = timeStr.trim().split(':');
  const h = Number(partes[0]) || 0;
  const m = Number(partes[1]) || 0;
  return h * 60 + m;
};

/** Converte total de minutos desde 00:00 para formato "HH:mm" */
export const minutesToTime = (totalMinutes: number): string => {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** Calcula o horário de término com base na hora de início e duração em minutos */
export const calcularHoraFim = (horaInicio?: string | null, duracaoMinutos?: number | null): string => {
  const inicio = horaInicio ? horaInicio.substring(0, 5) : '09:00';
  const dur = duracaoMinutos && duracaoMinutos > 0 ? duracaoMinutos : 60;
  return minutesToTime(timeToMinutes(inicio) + dur);
};

/** Calcula a duração em minutos entre horário de início e horário de término */
export const calcularDuracaoMinutos = (horaInicio?: string | null, horaFim?: string | null): number => {
  if (!horaInicio || !horaFim) return 60;
  const inicioMin = timeToMinutes(horaInicio);
  let fimMin = timeToMinutes(horaFim);
  if (fimMin <= inicioMin) {
    fimMin += 1440; // ultrapassou meia-noite
  }
  const diff = fimMin - inicioMin;
  return Math.max(5, diff);
};

/** Formata a duração de forma amigável (ex: "1h 15min", "45 min", "2h") */
export const formatarDuracaoAmigavel = (minutos?: number | null): string => {
  const total = minutos && minutos > 0 ? minutos : 60;
  const h = Math.floor(total / 60);
  const m = total % 60;

  if (h > 0 && m > 0) {
    return `${h}h ${m}min (${total} min)`;
  }
  if (h > 0) {
    return `${h}h (${total} min)`;
  }
  return `${m} min`;
};

/** Formata o intervalo completo (ex: "09:00 às 10:00 (60 min)") */
export const formatarIntervaloHorario = (
  horaInicio?: string | null,
  duracaoOuHoraFim?: number | string | null
): string => {
  const inicio = horaInicio ? horaInicio.substring(0, 5) : '09:00';
  let fim = '10:00';
  let dur = 60;

  if (typeof duracaoOuHoraFim === 'number') {
    dur = duracaoOuHoraFim;
    fim = calcularHoraFim(inicio, dur);
  } else if (typeof duracaoOuHoraFim === 'string') {
    fim = duracaoOuHoraFim.substring(0, 5);
    dur = calcularDuracaoMinutos(inicio, fim);
  }

  return `${inicio} às ${fim} (${formatarDuracaoAmigavel(dur)})`;
};
