import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** Converte um telefone brasileiro em formato E.164 sem símbolos (ex.: 5511999998888) */
export const normalizePhone = (phone?: string | null): string | null => {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) digits = digits.replace(/^0+/, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (digits.length < 12) return null;
  return digits;
};

interface ConsultaWhatsAppInfo {
  dentistaNome?: string;
  pacienteNome?: string;
  data: Date | string;
  hora?: string;
  duracao?: number;
  procedimento?: string;
  observacoes?: string;
}

export const buildConsultaMessage = (info: ConsultaWhatsAppInfo): string => {
  const dataObj = info.data instanceof Date ? info.data : new Date(info.data);
  const dataFmt = isNaN(dataObj.getTime())
    ? String(info.data)
    : format(dataObj, "EEEE, dd/MM/yyyy", { locale: ptBR });

  const linhas = [
    '*Nova consulta agendada*',
    info.dentistaNome ? `Dentista: ${info.dentistaNome}` : null,
    info.pacienteNome ? `Paciente: ${info.pacienteNome}` : null,
    `Data: ${dataFmt}`,
    info.hora ? `Horário: ${info.hora}${info.duracao ? ` (${info.duracao} min)` : ''}` : null,
    info.procedimento ? `Procedimento: ${info.procedimento}` : null,
    info.observacoes ? `Observações: ${info.observacoes}` : null,
  ].filter(Boolean);

  return linhas.join('\n');
};

/** Abre o WhatsApp (app ou web) com a mensagem pronta para o número informado */
export const openWhatsApp = (phone: string | null | undefined, message: string): boolean => {
  const number = normalizePhone(phone);
  if (!number) return false;
  const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
};
