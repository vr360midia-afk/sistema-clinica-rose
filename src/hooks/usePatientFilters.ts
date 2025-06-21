
import { useState, useMemo } from 'react';
import { Paciente } from '@/types/shared';

export const usePatientFilters = (pacientes: Paciente[]) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('active');

  const filteredPacientes = useMemo(() => {
    let filtered = pacientes;

    // Filter by status
    if (statusFilter === 'active') {
      filtered = filtered.filter(p => p.status === 'Ativo' || p.status === 'Inativo');
    } else if (statusFilter === 'archived') {
      filtered = filtered.filter(p => p.status === 'Arquivado');
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(paciente =>
        paciente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        paciente.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        paciente.telefone.includes(searchTerm)
      );
    }

    return filtered;
  }, [pacientes, searchTerm, statusFilter]);

  return {
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    filteredPacientes
  };
};
