
import { useState, useMemo } from 'react';
import { format, isSameDay } from 'date-fns';
import { useDentalSystem } from '@/context/DentalSystemContext';

type ViewType = 'day' | 'week' | 'month';

export const useAgendaViews = (selectedDate: Date) => {
  const { consultas, pacientes, updateConsulta, deleteConsulta } = useDentalSystem();
  const [view, setView] = useState<ViewType>('day');

  // Transformar consultas para o formato esperado pelos componentes
  const transformedConsultas = useMemo(() => {
    return consultas.map(consulta => {
      const paciente = pacientes.find(p => p.id === consulta.pacienteId);
      return {
        id: consulta.id,
        pacienteId: consulta.pacienteId,
        data: new Date(consulta.data),
        hora: consulta.hora,
        duracao: consulta.duracao,
        procedimento: consulta.procedimento,
        status: consulta.status,
        dentista: consulta.dentista,
        patient: paciente?.nome || 'Paciente não encontrado',
        patientData: paciente ? {
          phone: paciente.telefone || '',
          age: paciente.idade || 0,
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
      dentist: consulta.dentista,
      patientData: consulta.patientData
    }));
  }, [transformedConsultas, selectedDate]);

  const handleStatusChange = async (appointmentId: string, newStatus: any) => {
    try {
      await updateConsulta(appointmentId, { status: newStatus });
    } catch (error) {
      console.error('Erro ao atualizar status da consulta:', error);
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
    handleDeleteAppointment
  };
};
