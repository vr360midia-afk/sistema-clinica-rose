import { useMemo } from 'react';
import { useDentalSystem } from '@/context/DentalSystemContext';

export interface ManutencaoLente {
  pacienteId: string;
  pacienteNome: string;
  telefone?: string;
  ultimaData: Date;
  proximaManutencao: Date;
  diasRestantes: number;
  vencida: boolean;
}

const MESES_MANUTENCAO = 6;

const isLenteResina = (texto?: string) => {
  if (!texto) return false;
  const t = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const temLente = t.includes('lente') || t.includes('faceta');
  const temResina = t.includes('resina');
  return temLente && temResina;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const diffDias = (a: Date, b: Date) =>
  Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);

const addMonths = (d: Date, m: number) => {
  const nd = new Date(d);
  nd.setMonth(nd.getMonth() + m);
  return nd;
};

/**
 * Detecta pacientes com lentes/facetas em resina e calcula a manutenção
 * recomendada a cada 6 meses a partir do último procedimento registrado.
 */
export const useManutencaoLentes = (janelaDias = 30) => {
  const { pacientes, consultas, prontuarios } = useDentalSystem();

  const manutencoes = useMemo<ManutencaoLente[]>(() => {
    const hoje = new Date();
    const ultimaPorPaciente = new Map<string, Date>();

    const registrar = (pacienteId?: string, data?: any) => {
      if (!pacienteId || !data) return;
      const d = new Date(data);
      if (isNaN(d.getTime())) return;
      const atual = ultimaPorPaciente.get(pacienteId);
      if (!atual || d > atual) ultimaPorPaciente.set(pacienteId, d);
    };

    (consultas as any[]).forEach((c) => {
      if (isLenteResina(c.procedimento) || isLenteResina(c.observacoes)) {
        registrar(c.pacienteId, c.data);
      }
    });

    (prontuarios as any[]).forEach((p) => {
      const textos = [
        p.tratamento,
        p.planoTratamento,
        p.diagnostico,
        p.observacoes,
        ...(Array.isArray(p.procedimentosRealizados)
          ? p.procedimentosRealizados.map((x: any) => (typeof x === 'string' ? x : x?.nome))
          : []),
        ...(Array.isArray(p.procedimentos)
          ? p.procedimentos.map((x: any) => (typeof x === 'string' ? x : x?.nome))
          : []),
      ];
      if (textos.some(isLenteResina)) registrar(p.pacienteId, p.data || p.criadoEm);
    });

    const lista: ManutencaoLente[] = [];
    ultimaPorPaciente.forEach((ultimaData, pacienteId) => {
      const paciente = (pacientes as any[]).find((p) => p.id === pacienteId);
      if (!paciente || paciente.status === 'Arquivado') return;

      // Avança de 6 em 6 meses até a próxima manutenção futura ou a vencida mais recente
      let proxima = addMonths(ultimaData, MESES_MANUTENCAO);
      while (diffDias(proxima, hoje) < -MESES_MANUTENCAO * 30) {
        proxima = addMonths(proxima, MESES_MANUTENCAO);
      }

      const diasRestantes = diffDias(proxima, hoje);
      lista.push({
        pacienteId,
        pacienteNome: paciente.nome,
        telefone: paciente.telefone,
        ultimaData,
        proximaManutencao: proxima,
        diasRestantes,
        vencida: diasRestantes < 0,
      });
    });

    return lista.sort((a, b) => a.diasRestantes - b.diasRestantes);
  }, [pacientes, consultas, prontuarios]);

  const pendentes = useMemo(
    () => manutencoes.filter((m) => m.diasRestantes <= janelaDias),
    [manutencoes, janelaDias]
  );

  return { manutencoes, pendentes };
};
