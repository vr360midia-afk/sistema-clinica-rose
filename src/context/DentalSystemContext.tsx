import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabaseService } from '@/services/supabaseService';
import { toast } from 'sonner';
import { Paciente, Consulta, Transacao, Prontuario, Anamnese, DocumentoPaciente } from '@/types/shared';

interface DentalSystemContextType {
  // Estado
  pacientes: Paciente[];
  consultas: Consulta[];
  transacoes: Transacao[];
  prontuarios: Prontuario[];
  anamneses: Anamnese[];
  documentos: DocumentoPaciente[];
  loading: boolean;

  // Ações
  addPaciente: (paciente: Omit<Paciente, 'id' | 'criadoEm' | 'atualizadoEm'>) => Promise<Paciente>;
  updatePaciente: (id: string, updates: Partial<Paciente>) => Promise<void>;
  deletePaciente: (id: string) => Promise<void>;
  arquivarPaciente: (id: string, motivo: string) => Promise<void>;
  archivePaciente: (id: string, motivo: string) => Promise<void>;
  reactivatePaciente: (id: string) => Promise<void>;

  addConsulta: (consulta: Omit<Consulta, 'id' | 'criadoEm' | 'atualizadoEm'>) => Promise<void>;
  updateConsulta: (id: string, updates: Partial<Consulta>) => Promise<void>;
  deleteConsulta: (id: string) => Promise<void>;

  addTransacao: (transacao: Omit<Transacao, 'id' | 'criadoEm' | 'atualizadoEm'>) => Promise<void>;
  updateTransacao: (id: string, updates: Partial<Transacao>) => Promise<void>;
  deleteTransacao: (id: string) => Promise<void>;

  addProntuario: (prontuario: Omit<Prontuario, 'id' | 'criadoEm' | 'atualizadoEm'>) => Promise<void>;
  updateProntuario: (id: string, updates: Partial<Prontuario>) => Promise<void>;
  deleteProntuario: (id: string) => Promise<void>;

  addAnamnese: (anamnese: Omit<Anamnese, 'id' | 'criadoEm' | 'atualizadoEm'>) => Promise<Anamnese>;
  updateAnamnese: (id: string, updates: Partial<Anamnese>) => Promise<void>;
  deleteAnamnese: (id: string) => Promise<void>;
  generateSignatureLink: (anamneseId: string) => string;
  signAnamnese: (id: string, signatureData: any, signerType: 'paciente' | 'dentista') => Promise<void>;

  addDocumento: (documento: Omit<DocumentoPaciente, 'id' | 'criadoEm' | 'atualizadoEm'>) => Promise<void>;
  updateDocumento: (id: string, updates: Partial<DocumentoPaciente>) => Promise<void>;
  deleteDocumento: (id: string) => Promise<void>;

  // Utilidades
  getPacienteById: (id: string) => Paciente | undefined;
  clearAllData: () => Promise<void>;
  clearPacientes: () => Promise<void>;
  clearTransacoes: () => Promise<void>;
  clearAnamneses: () => Promise<void>;
  migrateFromLocalStorage: () => Promise<void>;
}

const DentalSystemContext = createContext<DentalSystemContextType | undefined>(undefined);

export const DentalSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  // Estados
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [prontuarios, setProntuarios] = useState<Prontuario[]>([]);
  const [anamneses, setAnamneses] = useState<Anamnese[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoPaciente[]>([]);
  const [loading, setLoading] = useState(true);

  // Carregar dados quando usuário estiver autenticado
  useEffect(() => {
    if (user) {
      loadAllData();
    } else {
      // Limpar dados quando usuário não estiver autenticado
      setPacientes([]);
      setConsultas([]);
      setTransacoes([]);
      setProntuarios([]);
      setAnamneses([]);
      setDocumentos([]);
      setLoading(false);
    }
  }, [user]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [
        pacientesData,
        consultasData,
        transacoesData,
        prontuariosData,
        anamnesesData,
        documentosData
      ] = await Promise.all([
        supabaseService.getPacientes(),
        supabaseService.getConsultas(),
        supabaseService.getTransacoes(),
        supabaseService.getProntuarios(),
        supabaseService.getAnamneses(),
        supabaseService.getDocumentos()
      ]);

      setPacientes(pacientesData);
      setConsultas(consultasData);
      setTransacoes(transacoesData);
      setProntuarios(prontuariosData);
      setAnamneses(anamnesesData);
      setDocumentos(documentosData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados do Supabase');
    } finally {
      setLoading(false);
    }
  };

  // Funções para Pacientes
  const addPaciente = async (pacienteData: Omit<Paciente, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<Paciente> => {
    try {
      console.log('addPaciente chamado com:', pacienteData);
      
      // Filtrar apenas os campos que existem na tabela pacientes
      const cleanPacienteData = {
        nome: pacienteData.nome,
        email: pacienteData.email,
        telefone: pacienteData.telefone,
        idade: pacienteData.idade || 0,
        convenio: pacienteData.convenio,
        origemLead: pacienteData.origemLead,
        status: pacienteData.status || 'Ativo',
        // Campos opcionais que podem ser undefined
        ...(pacienteData.foto && { foto: pacienteData.foto }),
        ...(pacienteData.ultimaConsulta && { ultimaConsulta: pacienteData.ultimaConsulta }),
        ...(pacienteData.proximaConsulta && { proximaConsulta: pacienteData.proximaConsulta }),
        ...(pacienteData.historicoMedico && { historicoMedico: pacienteData.historicoMedico }),
        ...(pacienteData.alergias && { alergias: pacienteData.alergias }),
        ...(pacienteData.medicamentos && { medicamentos: pacienteData.medicamentos }),
        ...(pacienteData.observacoes && { observacoes: pacienteData.observacoes }),
        ...(pacienteData.endereco && { endereco: pacienteData.endereco }),
        ...(pacienteData.cpf && { cpf: pacienteData.cpf }),
        ...(pacienteData.rg && { rg: pacienteData.rg }),
        ...(pacienteData.profissao && { profissao: pacienteData.profissao }),
        ...(pacienteData.estadoCivil && { estadoCivil: pacienteData.estadoCivil }),
        ...(pacienteData.dataArquivamento && { dataArquivamento: pacienteData.dataArquivamento }),
        ...(pacienteData.motivoArquivamento && { motivoArquivamento: pacienteData.motivoArquivamento })
      };
      
      console.log('Dados limpos para salvar:', cleanPacienteData);
      const novoPaciente = await supabaseService.savePaciente(cleanPacienteData);
      console.log('Paciente salvo no Supabase:', novoPaciente);
      
      setPacientes(prev => [novoPaciente, ...prev]);
      toast.success('Paciente adicionado com sucesso!');
      return novoPaciente;
    } catch (error) {
      console.error('Erro ao adicionar paciente:', error);
      toast.error('Erro ao adicionar paciente');
      throw error;
    }
  };

  const updatePaciente = async (id: string, updates: Partial<Paciente>) => {
    try {
      const pacienteAtualizado = await supabaseService.updatePaciente(id, updates);
      if (pacienteAtualizado) {
        setPacientes(prev => prev.map(p => p.id === id ? pacienteAtualizado : p));
        toast.success('Paciente atualizado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao atualizar paciente:', error);
      toast.error('Erro ao atualizar paciente');
      throw error;
    }
  };

  const deletePaciente = async (id: string) => {
    try {
      await supabaseService.deletePaciente(id);
      setPacientes(prev => prev.filter(p => p.id !== id));
      
      // Remover dados relacionados
      setConsultas(prev => prev.filter(c => c.pacienteId !== id));
      setTransacoes(prev => prev.filter(t => t.pacienteId !== id));
      setProntuarios(prev => prev.filter(p => p.pacienteId !== id));
      setAnamneses(prev => prev.filter(a => a.pacienteId !== id));
      setDocumentos(prev => prev.filter(d => d.pacienteId !== id));
      
      toast.success('Paciente removido com sucesso!');
    } catch (error) {
      console.error('Erro ao remover paciente:', error);
      toast.error('Erro ao remover paciente');
      throw error;
    }
  };

  const arquivarPaciente = async (id: string, motivo: string) => {
    try {
      const updates = {
        status: 'Arquivado' as const,
        dataArquivamento: new Date(),
        motivoArquivamento: motivo
      };
      await updatePaciente(id, updates);
    } catch (error) {
      console.error('Erro ao arquivar paciente:', error);
      throw error;
    }
  };

  const archivePaciente = async (id: string, motivo: string) => {
    await arquivarPaciente(id, motivo);
  };

  const reactivatePaciente = async (id: string) => {
    try {
      const updates = {
        status: 'Ativo' as const,
        dataArquivamento: undefined,
        motivoArquivamento: undefined
      };
      await updatePaciente(id, updates);
    } catch (error) {
      console.error('Erro ao reativar paciente:', error);
      throw error;
    }
  };

  // Funções para Consultas
  const addConsulta = async (consultaData: Omit<Consulta, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    try {
      const novaConsulta = await supabaseService.saveConsulta(consultaData);
      setConsultas(prev => [novaConsulta, ...prev]);
      toast.success('Consulta agendada com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar consulta:', error);
      toast.error('Erro ao agendar consulta');
      throw error;
    }
  };

  const updateConsulta = async (id: string, updates: Partial<Consulta>) => {
    try {
      const consultaAtualizada = await supabaseService.updateConsulta(id, updates);
      if (consultaAtualizada) {
        setConsultas(prev => prev.map(c => c.id === id ? consultaAtualizada : c));
        toast.success('Consulta atualizada com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao atualizar consulta:', error);
      toast.error('Erro ao atualizar consulta');
      throw error;
    }
  };

  const deleteConsulta = async (id: string) => {
    try {
      await supabaseService.deleteConsulta(id);
      setConsultas(prev => prev.filter(c => c.id !== id));
      toast.success('Consulta removida com sucesso!');
    } catch (error) {
      console.error('Erro ao remover consulta:', error);
      toast.error('Erro ao remover consulta');
      throw error;
    }
  };

  // Funções para Transações
  const addTransacao = async (transacaoData: Omit<Transacao, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    try {
      const novaTransacao = await supabaseService.saveTransacao(transacaoData);
      setTransacoes(prev => [novaTransacao, ...prev]);
      toast.success('Transação adicionada com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar transação:', error);
      toast.error('Erro ao adicionar transação');
      throw error;
    }
  };

  const updateTransacao = async (id: string, updates: Partial<Transacao>) => {
    try {
      const transacaoAtualizada = await supabaseService.updateTransacao(id, updates);
      if (transacaoAtualizada) {
        setTransacoes(prev => prev.map(t => t.id === id ? transacaoAtualizada : t));
        toast.success('Transação atualizada com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao atualizar transação:', error);
      toast.error('Erro ao atualizar transação');
      throw error;
    }
  };

  const deleteTransacao = async (id: string) => {
    try {
      await supabaseService.deleteTransacao(id);
      setTransacoes(prev => prev.filter(t => t.id !== id));
      toast.success('Transação removida com sucesso!');
    } catch (error) {
      console.error('Erro ao remover transação:', error);
      toast.error('Erro ao remover transação');
      throw error;
    }
  };

  // Funções para Prontuários
  const addProntuario = async (prontuarioData: Omit<Prontuario, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    try {
      const novoProntuario = await supabaseService.saveProntuario(prontuarioData);
      setProntuarios(prev => [novoProntuario, ...prev]);
      toast.success('Prontuário adicionado com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar prontuário:', error);
      toast.error('Erro ao adicionar prontuário');
      throw error;
    }
  };

  const updateProntuario = async (id: string, updates: Partial<Prontuario>) => {
    try {
      const prontuarioAtualizado = await supabaseService.updateProntuario(id, updates);
      if (prontuarioAtualizado) {
        setProntuarios(prev => prev.map(p => p.id === id ? prontuarioAtualizado : p));
        toast.success('Prontuário atualizado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao atualizar prontuário:', error);
      toast.error('Erro ao atualizar prontuário');
      throw error;
    }
  };

  const deleteProntuario = async (id: string) => {
    try {
      await supabaseService.deleteProntuario(id);
      setProntuarios(prev => prev.filter(p => p.id !== id));
      toast.success('Prontuário removido com sucesso!');
    } catch (error) {
      console.error('Erro ao remover prontuário:', error);
      toast.error('Erro ao remover prontuário');
      throw error;
    }
  };

  // Funções para Anamneses
  const addAnamnese = async (anamneseData: Omit<Anamnese, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<Anamnese> => {
    try {
      const novaAnamnese = await supabaseService.saveAnamnese(anamneseData);
      setAnamneses(prev => [novaAnamnese, ...prev]);
      toast.success('Anamnese adicionada com sucesso!');
      return novaAnamnese;
    } catch (error) {
      console.error('Erro ao adicionar anamnese:', error);
      toast.error('Erro ao adicionar anamnese');
      throw error;
    }
  };

  const updateAnamnese = async (id: string, updates: Partial<Anamnese>) => {
    try {
      const anamneseAtualizada = await supabaseService.updateAnamnese(id, updates);
      if (anamneseAtualizada) {
        setAnamneses(prev => prev.map(a => a.id === id ? anamneseAtualizada : a));
        toast.success('Anamnese atualizada com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao atualizar anamnese:', error);
      toast.error('Erro ao atualizar anamnese');
      throw error;
    }
  };

  const deleteAnamnese = async (id: string) => {
    try {
      await supabaseService.deleteAnamnese(id);
      setAnamneses(prev => prev.filter(a => a.id !== id));
      toast.success('Anamnese removida com sucesso!');
    } catch (error) {
      console.error('Erro ao remover anamnese:', error);
      toast.error('Erro ao remover anamnese');
      throw error;
    }
  };

  const generateSignatureLink = (anamneseId: string): string => {
    const anamnese = anamneses.find(a => a.id === anamneseId);
    if (!anamnese) return '';
    
    const token = Math.random().toString(36).substring(2, 15);
    const expiracaoLink = new Date();
    expiracaoLink.setDate(expiracaoLink.getDate() + 7); // 7 dias para expirar
    
    // Atualizar anamnese com token
    updateAnamnese(anamneseId, {
      tokenAssinatura: token,
      dataExpiracaoLink: expiracaoLink,
      linkAssinatura: `${window.location.origin}/assinar-anamnese/${anamneseId}?token=${token}`
    });
    
    return `${window.location.origin}/assinar-anamnese/${anamneseId}?token=${token}`;
  };

  const signAnamnese = async (id: string, signatureData: any, signerType: 'paciente' | 'dentista') => {
    try {
      const updates: Partial<Anamnese> = {};
      
      if (signerType === 'paciente') {
        updates.assinaturaPaciente = signatureData;
      } else {
        updates.assinaturaDoutor = signatureData;
      }

      // Verificar se ambas as assinaturas estão presentes
      const anamnese = anamneses.find(a => a.id === id);
      if (anamnese) {
        const temAssinaturaPaciente = signerType === 'paciente' || anamnese.assinaturaPaciente;
        const temAssinaturaDentista = signerType === 'dentista' || anamnese.assinaturaDoutor;
        
        if (temAssinaturaPaciente && temAssinaturaDentista) {
          updates.statusAssinatura = 'completo';
        } else {
          updates.statusAssinatura = 'paciente_assinado';
        }
      }

      await updateAnamnese(id, updates);
      toast.success(`Assinatura do ${signerType} registrada com sucesso!`);
    } catch (error) {
      console.error('Erro ao registrar assinatura:', error);
      toast.error('Erro ao registrar assinatura');
      throw error;
    }
  };

  // Funções para Documentos
  const addDocumento = async (documentoData: Omit<DocumentoPaciente, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    try {
      const novoDocumento = await supabaseService.saveDocumento(documentoData);
      setDocumentos(prev => [novoDocumento, ...prev]);
      toast.success('Documento adicionado com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar documento:', error);
      toast.error('Erro ao adicionar documento');
      throw error;
    }
  };

  const updateDocumento = async (id: string, updates: Partial<DocumentoPaciente>) => {
    try {
      const documentoAtualizado = await supabaseService.updateDocumento(id, updates);
      if (documentoAtualizado) {
        setDocumentos(prev => prev.map(d => d.id === id ? documentoAtualizado : d));
        toast.success('Documento atualizado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao atualizar documento:', error);
      toast.error('Erro ao atualizar documento');
      throw error;
    }
  };

  const deleteDocumento = async (id: string) => {
    try {
      await supabaseService.deleteDocumento(id);
      setDocumentos(prev => prev.filter(d => d.id !== id));
      toast.success('Documento removido com sucesso!');
    } catch (error) {
      console.error('Erro ao remover documento:', error);
      toast.error('Erro ao remover documento');
      throw error;
    }
  };

  // Utilidades
  const getPacienteById = (id: string): Paciente | undefined => {
    return pacientes.find(p => p.id === id);
  };

  const clearAllData = async () => {
    try {
      await supabaseService.clearAllData();
      setPacientes([]);
      setConsultas([]);
      setTransacoes([]);
      setProntuarios([]);
      setAnamneses([]);
      setDocumentos([]);
      toast.success('Todos os dados foram removidos!');
    } catch (error) {
      console.error('Erro ao limpar dados:', error);
      toast.error('Erro ao limpar dados');
      throw error;
    }
  };

  const clearPacientes = async () => {
    try {
      await supabaseService.clearPacientes();
      setPacientes([]);
      setConsultas([]);
      setTransacoes([]);
      setProntuarios([]);
      setAnamneses([]);
      setDocumentos([]);
      toast.success('Todos os pacientes foram removidos!');
    } catch (error) {
      console.error('Erro ao limpar pacientes:', error);
      toast.error('Erro ao limpar pacientes');
      throw error;
    }
  };

  const clearTransacoes = async () => {
    try {
      await supabaseService.clearTransacoes();
      setTransacoes([]);
      toast.success('Todas as transações foram removidas!');
    } catch (error) {
      console.error('Erro ao limpar transações:', error);
      toast.error('Erro ao limpar transações');
      throw error;
    }
  };

  const clearAnamneses = async () => {
    try {
      await supabaseService.clearAnamneses();
      setAnamneses([]);
      toast.success('Todas as anamneses foram removidas!');
    } catch (error) {
      console.error('Erro ao limpar anamneses:', error);
      toast.error('Erro ao limpar anamneses');
      throw error;
    }
  };

  const migrateFromLocalStorage = async () => {
    try {
      await supabaseService.migrateFromLocalStorage();
      // Recarregar dados após migração
      await loadAllData();
      toast.success('Migração concluída com sucesso!');
    } catch (error) {
      console.error('Erro na migração:', error);
      toast.error('Erro durante a migração');
      throw error;
    }
  };

  const value: DentalSystemContextType = {
    // Estado
    pacientes,
    consultas,
    transacoes,
    prontuarios,
    anamneses,
    documentos,
    loading,

    // Ações
    addPaciente,
    updatePaciente,
    deletePaciente,
    arquivarPaciente,
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

    addAnamnese,
    updateAnamnese,
    deleteAnamnese,
    generateSignatureLink,
    signAnamnese,

    addDocumento,
    updateDocumento,
    deleteDocumento,

    // Utilidades
    getPacienteById,
    clearAllData,
    clearPacientes,
    clearTransacoes,
    clearAnamneses,
    migrateFromLocalStorage
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
