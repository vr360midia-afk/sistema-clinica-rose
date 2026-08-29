import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { format, isSameDay } from 'date-fns';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { calcularIdade } from '@/utils/idade';

type ViewType = 'day' | 'week' | 'month';

export const useAgendaViews = (selectedDate: Date) => {
  const { consultas, pacientes, updateConsulta, deleteConsulta } = useDentalSystem();
  const [view, setView] = useState<ViewType>('week'); // Mudança aqui: padrão é 'week'

  // Transformar consultas para o formato esperado pelos componentes
  const transformedConsultas = useMemo(() => {
    return consultas.map(consulta => {
      const paciente = pacientes.find(p => p.id === consulta.pacienteId);
      const idade = paciente ? (calcularIdade(paciente.dataNascimento) ?? paciente.idade ?? 0) : 0;
      return {
        id: consulta.id,
        pacienteId: consulta.pacienteId,
        data: new Date(consulta.data),
        hora: consulta.hora,
        duracao: consulta.duracao,
        procedimento: consulta.procedimento,
        status: consulta.status,
        confirmacaoStatus: consulta.confirmacaoStatus || 'pendente',
        dentista: consulta.dentista,
        observacoes: consulta.observacoes,
        valor: consulta.valor,
        patient: paciente?.nome || 'Paciente não encontrado',
        patientData: paciente ? {
          phone: paciente.telefone || '',
          age: idade,
          insurance: paciente.convenio || '',
          lastVisit: paciente.ultimaConsulta ? new Date(paciente.ultimaConsulta).toLocaleDateString('pt-BR') : '',
          allergies: paciente.alergias || ''
        } : undefined
      };
    });
  }, [consultas, pacientes]);

  // Filtrar consultas do dia selecionado para a visualização diária
  const appointmentsForSelectedDate = useMemo(() => {
    const selectedDateConsultas = transformedConsultas.filter(consulta => 
      isSameDay(consulta.data, selectedDate)
    );

    return selectedDateConsultas.map(consulta => ({
      id: consulta.id,
      patient: consulta.patient,
      time: consulta.hora,
      duration: `${consulta.duracao}min`,
      procedure: consulta.procedimento,
      status: consulta.status,
      confirmacaoStatus: consulta.confirmacaoStatus,
      dentist: consulta.dentista,
      date: consulta.data,
      patientData: consulta.patientData
    }));
  }, [transformedConsultas, selectedDate]);

  const handleStatusChange = async (appointmentId: string, newStatus: any) => {
    try {
      await updateConsulta(appointmentId, { status: newStatus });
      const labels: Record<string, string> = {
        confirmado: 'Consulta confirmada',
        realizado: 'Consulta marcada como realizada',
        cancelado: 'Consulta cancelada',
        remarcado: 'Consulta marcada para remarcar',
        faltou: 'Paciente faltou',
      };
      toast.success(labels[newStatus] || 'Status atualizado');
    } catch (error) {
      console.error('Erro ao atualizar status da consulta:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const handleConfirmacaoChange = async (appointmentId: string, novo: 'pendente' | 'confirmado' | 'recusado') => {
    try {
      await updateConsulta(appointmentId, {
        confirmacaoStatus: novo,
        confirmadoEm: novo === 'pendente' ? undefined : new Date(),
        ...(novo === 'confirmado' ? { status: 'confirmado' as const } : {}),
        ...(novo === 'recusado' ? { status: 'cancelado' as const } : {}),
      });
    } catch (error) {
      console.error('Erro ao atualizar confirmação da consulta:', error);
    }
  };

  const handleDeleteAppointment = async (appointmentId: string) => {
    try {
      await deleteConsulta(appointmentId);
    } catch (error) {
      console.error('Erro ao excluir consulta:', error);
    }
  };

  return {
    view,
    setView,
    transformedConsultas,
    appointmentsForSelectedDate,
    handleStatusChange,
    handleConfirmacaoChange,
    handleDeleteAppointment
  };
};
