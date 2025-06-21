
import React, { createContext, useContext, useEffect, useState } from 'react';
import { localStorageService } from '@/services/localStorage';
import { Paciente, Consulta, Transacao, Prontuario } from '@/types/shared';
import { toast } from 'sonner';

interface DentalSystemContextType {
  // Data
  pacientes: Paciente[];
  consultas: Consulta[];
  transacoes: Transacao[];
  prontuarios: Prontuario[];
  loading: boolean;
  
  // Patient methods
  addPaciente: (paciente: Omit<Paciente, 'id' | 'criadoEm' | 'atualizadoEm'>) => Promise<Paciente>;
  updatePaciente: (id: string, updates: Partial<Paciente>) => Promise<void>;
  deletePaciente: (id: string) => Promise<void>;
  archivePaciente: (id: string, motivo?: string) => Promise<void>;
  reactivatePaciente: (id: string) => Promise<void>;
  
  // Consultation methods
  addConsulta: (consulta: Omit<Consulta, 'id' | 'criadoEm' | 'atualizadoEm'>) => Promise<Consulta>;
  updateConsulta: (id: string, updates: Partial<Consulta>) => Promise<void>;
  deleteConsulta: (id: string) => Promise<void>;
  
  // Transaction methods
  addTransacao: (transacao: Omit<Transacao, 'id' | 'criadoEm' | 'atualizadoEm'>) => Promise<Transacao>;
  updateTransacao: (id: string, updates: Partial<Transacao>) => Promise<void>;
  deleteTransacao: (id: string) => Promise<void>;
  
  // Medical record methods
  addProntuario: (prontuario: Omit<Prontuario, 'id' | 'criadoEm' | 'atualizadoEm'>) => Promise<Prontuario>;
  updateProntuario: (id: string, updates: Partial<Prontuario>) => Promise<void>;
  deleteProntuario: (id: string) => Promise<void>;
  
  // Utility methods
  refreshData: () => Promise<void>;
}

const DentalSystemContext = createContext<DentalSystemContextType | undefined>(undefined);

export const DentalSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [prontuarios, setProntuarios] = useState<Prontuario[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pacientesData, consultasData, transacoesData, prontuariosData] = await Promise.all([
        Promise.resolve(localStorageService.getPacientes()),
        Promise.resolve(localStorageService.getConsultas()),
        Promise.resolve(localStorageService.getTransacoes()),
        Promise.resolve(localStorageService.getProntuarios())
      ]);
      
      setPacientes(pacientesData);
      setConsultas(consultasData);
      setTransacoes(transacoesData);
      setProntuarios(prontuariosData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados do sistema');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Patient methods
  const addPaciente = async (pacienteData: Omit<Paciente, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    try {
      const newPaciente = localStorageService.savePaciente(pacienteData);
      setPacientes(prev => [...prev, newPaciente]);
      toast.success(`Paciente ${newPaciente.nome} adicionado com sucesso`);
      return newPaciente;
    } catch (error) {
      console.error('Erro ao adicionar paciente:', error);
      toast.error('Erro ao adicionar paciente');
      throw error;
    }
  };

  const updatePaciente = async (id: string, updates: Partial<Paciente>) => {
    try {
      const updatedPaciente = localStorageService.updatePaciente(id, updates);
      if (updatedPaciente) {
        setPacientes(prev => prev.map(p => p.id === id ? updatedPaciente : p));
        toast.success(`Paciente ${updatedPaciente.nome} atualizado com sucesso`);
      }
    } catch (error) {
      console.error('Erro ao atualizar paciente:', error);
      toast.error('Erro ao atualizar paciente');
      throw error;
    }
  };

  const deletePaciente = async (id: string) => {
    try {
      const paciente = pacientes.find(p => p.id === id);
      const success = localStorageService.deletePaciente(id);
      if (success) {
        setPacientes(prev => prev.filter(p => p.id !== id));
        toast.success(`Paciente ${paciente?.nome} excluído com sucesso`);
      }
    } catch (error) {
      console.error('Erro ao excluir paciente:', error);
      toast.error('Erro ao excluir paciente');
      throw error;
    }
  };

  const archivePaciente = async (id: string, motivo?: string) => {
    try {
      const paciente = pacientes.find(p => p.id === id);
      await updatePaciente(id, { 
        status: 'Arquivado',
        dataArquivamento: new Date(),
        motivoArquivamento: motivo
      });
      toast.success(`Paciente ${paciente?.nome} arquivado com sucesso`);
    } catch (error) {
      console.error('Erro ao arquivar paciente:', error);
      toast.error('Erro ao arquivar paciente');
      throw error;
    }
  };

  const reactivatePaciente = async (id: string) => {
    try {
      const paciente = pacientes.find(p => p.id === id);
      await updatePaciente(id, { 
        status: 'Ativo',
        dataArquivamento: undefined,
        motivoArquivamento: undefined
      });
      toast.success(`Paciente ${paciente?.nome} reativado com sucesso`);
    } catch (error) {
      console.error('Erro ao reativar paciente:', error);
      toast.error('Erro ao reativar paciente');
      throw error;
    }
  };

  // Consultation methods
  const addConsulta = async (consultaData: Omit<Consulta, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    try {
      const newConsulta = localStorageService.saveConsulta(consultaData);
      setConsultas(prev => [...prev, newConsulta]);
      toast.success('Consulta agendada com sucesso');
      return newConsulta;
    } catch (error) {
      console.error('Erro ao adicionar consulta:', error);
      toast.error('Erro ao agendar consulta');
      throw error;
    }
  };

  const updateConsulta = async (id: string, updates: Partial<Consulta>) => {
    try {
      const updatedConsulta = localStorageService.updateConsulta(id, updates);
      if (updatedConsulta) {
        setConsultas(prev => prev.map(c => c.id === id ? updatedConsulta : c));
        toast.success('Consulta atualizada com sucesso');
      }
    } catch (error) {
      console.error('Erro ao atualizar consulta:', error);
      toast.error('Erro ao atualizar consulta');
      throw error;
    }
  };

  const deleteConsulta = async (id: string) => {
    try {
      const success = localStorageService.deleteConsulta(id);
      if (success) {
        setConsultas(prev => prev.filter(c => c.id !== id));
        toast.success('Consulta cancelada com sucesso');
      }
    } catch (error) {
      console.error('Erro ao cancelar consulta:', error);
      toast.error('Erro ao cancelar consulta');
      throw error;
    }
  };

  // Transaction methods
  const addTransacao = async (transacaoData: Omit<Transacao, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    try {
      const newTransacao = localStorageService.saveTransacao(transacaoData);
      setTransacoes(prev => [...prev, newTransacao]);
      toast.success('Transação registrada com sucesso');
      return newTransacao;
    } catch (error) {
      console.error('Erro ao adicionar transação:', error);
      toast.error('Erro ao registrar transação');
      throw error;
    }
  };

  const updateTransacao = async (id: string, updates: Partial<Transacao>) => {
    try {
      const updatedTransacao = localStorageService.updateTransacao(id, updates);
      if (updatedTransacao) {
        setTransacoes(prev => prev.map(t => t.id === id ? updatedTransacao : t));
        toast.success('Transação atualizada com sucesso');
      }
    } catch (error) {
      console.error('Erro ao atualizar transação:', error);
      toast.error('Erro ao atualizar transação');
      throw error;
    }
  };

  const deleteTransacao = async (id: string) => {
    try {
      const success = localStorageService.deleteTransacao(id);
      if (success) {
        setTransacoes(prev => prev.filter(t => t.id !== id));
        toast.success('Transação excluída com sucesso');
      }
    } catch (error) {
      console.error('Erro ao excluir transação:', error);
      toast.error('Erro ao excluir transação');
      throw error;
    }
  };

  // Medical record methods
  const addProntuario = async (prontuarioData: Omit<Prontuario, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    try {
      const newProntuario = localStorageService.saveProntuario(prontuarioData);
      setProntuarios(prev => [...prev, newProntuario]);
      toast.success('Prontuário salvo com sucesso');
      return newProntuario;
    } catch (error) {
      console.error('Erro ao adicionar prontuário:', error);
      toast.error('Erro ao salvar prontuário');
      throw error;
    }
  };

  const updateProntuario = async (id: string, updates: Partial<Prontuario>) => {
    try {
      const updatedProntuario = localStorageService.updateProntuario(id, updates);
      if (updatedProntuario) {
        setProntuarios(prev => prev.map(p => p.id === id ? updatedProntuario : p));
        toast.success('Prontuário atualizado com sucesso');
      }
    } catch (error) {
      console.error('Erro ao atualizar prontuário:', error);
      toast.error('Erro ao atualizar prontuário');
      throw error;
    }
  };

  const deleteProntuario = async (id: string) => {
    try {
      const success = localStorageService.deleteProntuario(id);
      if (success) {
        setProntuarios(prev => prev.filter(p => p.id !== id));
        toast.success('Prontuário excluído com sucesso');
      }
    } catch (error) {
      console.error('Erro ao excluir prontuário:', error);
      toast.error('Erro ao excluir prontuário');
      throw error;
    }
  };

  const refreshData = async () => {
    await loadData();
  };

  const value: DentalSystemContextType = {
    // Data
    pacientes,
    consultas,
    transacoes,
    prontuarios,
    loading,
    
    // Methods
    addPaciente,
    updatePaciente,
    deletePaciente,
    archivePaciente,
    reactivatePaciente,
    addConsulta,
    updateConsulta,
    deleteConsulta,
    addTransacao,
    updateTransacao,
    deleteTransacao,
    addProntuario,
    updateProntuario,
    deleteProntuario,
    refreshData
  };

  return (
    <DentalSystemContext.Provider value={value}>
      {children}
    </DentalSystemContext.Provider>
  );
};

export const useDentalSystem = () => {
  const context = useContext(DentalSystemContext);
  if (context === undefined) {
    throw new Error('useDentalSystem must be used within a DentalSystemProvider');
  }
  return context;
};
