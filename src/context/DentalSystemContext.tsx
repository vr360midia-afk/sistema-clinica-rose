import React, { createContext, useContext, useEffect, useState } from 'react';
import { localStorageService } from '@/services/localStorage';
import { Paciente, Consulta, Transacao, Prontuario, Anamnese, DocumentoPaciente } from '@/types/shared';
import { toast } from 'sonner';

// Adicionar interface para Produto
interface Produto {
  id: number;
  nome: string;
  categoria: string;
  quantidade: number;
  minimo: number;
  preco: number;
}

interface DentalSystemContextType {
  // Data
  pacientes: Paciente[];
  consultas: Consulta[];
  transacoes: Transacao[];
  prontuarios: Prontuario[];
  anamneses: Anamnese[];
  documentos: DocumentoPaciente[];
  produtos: Produto[];
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
  
  // Anamnesis methods
  addAnamnese: (anamnese: Omit<Anamnese, 'id' | 'criadoEm' | 'atualizadoEm'>) => Promise<Anamnese>;
  updateAnamnese: (id: string, updates: Partial<Anamnese>) => Promise<void>;
  deleteAnamnese: (id: string) => Promise<void>;
  clearAnamneses: () => Promise<void>;
  generateSignatureLink: (anamneseId: string) => string;
  signAnamnese: (anamneseId: string, signatureData: any, signerType: 'paciente' | 'dentista') => Promise<void>;
  
  // Document methods
  addDocumento: (documento: Omit<DocumentoPaciente, 'id' | 'criadoEm' | 'atualizadoEm'>) => Promise<DocumentoPaciente>;
  updateDocumento: (id: string, updates: Partial<DocumentoPaciente>) => Promise<void>;
  deleteDocumento: (id: string) => Promise<void>;
  
  // Product methods
  addProduto: (produto: Omit<Produto, 'id'>) => void;
  updateProduto: (id: number, updates: Partial<Produto>) => void;
  deleteProduto: (id: number) => void;
  
  // Utility methods
  refreshData: () => Promise<void>;
  clearAllData: () => Promise<void>;
  clearPacientes: () => Promise<void>;
  clearTransacoes: () => Promise<void>;
}

const DentalSystemContext = createContext<DentalSystemContextType | undefined>(undefined);

export const DentalSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [prontuarios, setProntuarios] = useState<Prontuario[]>([]);
  const [anamneses, setAnamneses] = useState<Anamnese[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoPaciente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pacientesData, consultasData, transacoesData, prontuariosData, anamnesesData, documentosData] = await Promise.all([
        Promise.resolve(localStorageService.getPacientes()),
        Promise.resolve(localStorageService.getConsultas()),
        Promise.resolve(localStorageService.getTransacoes()),
        Promise.resolve(localStorageService.getProntuarios()),
        Promise.resolve(localStorageService.getAnamneses()),
        Promise.resolve(localStorageService.getDocumentos())
      ]);
      
      setPacientes(pacientesData);
      setConsultas(consultasData);
      setTransacoes(transacoesData);
      setProntuarios(prontuariosData);
      setAnamneses(anamnesesData);
      setDocumentos(documentosData);

      // Carregar produtos do localStorage
      const produtosData = JSON.parse(localStorage.getItem('dental-produtos') || '[]');
      setProdutos(produtosData);

      console.log('Dados carregados:', {
        pacientes: pacientesData.length,
        consultas: consultasData.length,
        transacoes: transacoesData.length,
        prontuarios: prontuariosData.length,
        anamneses: anamnesesData.length,
        documentos: documentosData.length,
        produtos: produtosData.length
      });
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

  // Anamnesis methods
  const addAnamnese = async (anamneseData: Omit<Anamnese, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    try {
      const newAnamnese = localStorageService.saveAnamnese({
        ...anamneseData,
        statusAssinatura: 'pendente'
      });
      setAnamneses(prev => [...prev, newAnamnese]);
      toast.success('Anamnese salva com sucesso');
      return newAnamnese;
    } catch (error) {
      console.error('Erro ao adicionar anamnese:', error);
      toast.error('Erro ao salvar anamnese');
      throw error;
    }
  };

  const updateAnamnese = async (id: string, updates: Partial<Anamnese>) => {
    try {
      const updatedAnamnese = localStorageService.updateAnamnese(id, updates);
      if (updatedAnamnese) {
        setAnamneses(prev => prev.map(a => a.id === id ? updatedAnamnese : a));
        toast.success('Anamnese atualizada com sucesso');
      }
    } catch (error) {
      console.error('Erro ao atualizar anamnese:', error);
      toast.error('Erro ao atualizar anamnese');
      throw error;
    }
  };

  const deleteAnamnese = async (id: string) => {
    try {
      const success = localStorageService.deleteAnamnese(id);
      if (success) {
        setAnamneses(prev => prev.filter(a => a.id !== id));
        toast.success('Anamnese excluída com sucesso');
      }
    } catch (error) {
      console.error('Erro ao excluir anamnese:', error);
      toast.error('Erro ao excluir anamnese');
      throw error;
    }
  };

  const clearAnamneses = async () => {
    try {
      localStorageService.clearAnamneses();
      setAnamneses([]);
      toast.success('Todas as anamneses foram zeradas');
    } catch (error) {
      console.error('Erro ao limpar anamneses:', error);
      toast.error('Erro ao limpar anamneses');
      throw error;
    }
  };

  const generateSignatureLink = (anamneseId: string): string => {
    const token = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const link = `${window.location.origin}/assinar-anamnese/${anamneseId}?token=${token}`;
    
    // Atualizar a anamnese com o token e data de expiração
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7); // 7 dias para expirar
    
    updateAnamnese(anamneseId, {
      tokenAssinatura: token,
      linkAssinatura: link,
      dataExpiracaoLink: expirationDate
    });
    
    return link;
  };

  const signAnamnese = async (anamneseId: string, signatureData: any, signerType: 'paciente' | 'dentista') => {
    try {
      const anamnese = anamneses.find(a => a.id === anamneseId);
      if (!anamnese) throw new Error('Anamnese não encontrada');

      const updates: Partial<Anamnese> = {};
      
      if (signerType === 'paciente') {
        updates.assinaturaPaciente = signatureData;
        updates.statusAssinatura = 'paciente_assinado';
      } else {
        updates.assinaturaDoutor = signatureData;
        updates.statusAssintura = anamnese.assinaturaPaciente ? 'completo' : 'pendente';
      }

      await updateAnamnese(anamneseId, updates);
      toast.success(`Assinatura do ${signerType} registrada com sucesso`);
    } catch (error) {
      toast.error('Erro ao registrar assinatura');
      throw error;
    }
  };

  // Document methods
  const addDocumento = async (documentoData: Omit<DocumentoPaciente, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    try {
      const newDocumento = localStorageService.saveDocumento(documentoData);
      setDocumentos(prev => [...prev, newDocumento]);
      toast.success('Documento salvo com sucesso');
      return newDocumento;
    } catch (error) {
      console.error('Erro ao adicionar documento:', error);
      toast.error('Erro ao salvar documento');
      throw error;
    }
  };

  const updateDocumento = async (id: string, updates: Partial<DocumentoPaciente>) => {
    try {
      const updatedDocumento = localStorageService.updateDocumento(id, updates);
      if (updatedDocumento) {
        setDocumentos(prev => prev.map(d => d.id === id ? updatedDocumento : d));
        toast.success('Documento atualizado com sucesso');
      }
    } catch (error) {
      console.error('Erro ao atualizar documento:', error);
      toast.error('Erro ao atualizar documento');
      throw error;
    }
  };

  const deleteDocumento = async (id: string) => {
    try {
      const success = localStorageService.deleteDocumento(id);
      if (success) {
        setDocumentos(prev => prev.filter(d => d.id !== id));
        toast.success('Documento excluído com sucesso');
      }
    } catch (error) {
      console.error('Erro ao excluir documento:', error);
      toast.error('Erro ao excluir documento');
      throw error;
    }
  };

  // Product methods
  const addProduto = (produtoData: Omit<Produto, 'id'>) => {
    const newProduto = {
      ...produtoData,
      id: Date.now()
    };
    const updatedProdutos = [...produtos, newProduto];
    setProdutos(updatedProdutos);
    localStorage.setItem('dental-produtos', JSON.stringify(updatedProdutos));
    toast.success('Produto adicionado com sucesso');
  };

  const updateProduto = (id: number, updates: Partial<Produto>) => {
    const updatedProdutos = produtos.map(p => p.id === id ? { ...p, ...updates } : p);
    setProdutos(updatedProdutos);
    localStorage.setItem('dental-produtos', JSON.stringify(updatedProdutos));
    toast.success('Produto atualizado com sucesso');
  };

  const deleteProduto = (id: number) => {
    const updatedProdutos = produtos.filter(p => p.id !== id);
    setProdutos(updatedProdutos);
    localStorage.setItem('dental-produtos', JSON.stringify(updatedProdutos));
    toast.success('Produto excluído com sucesso');
  };

  // Utility methods
  const refreshData = async () => {
    await loadData();
  };

  const clearAllData = async () => {
    try {
      localStorageService.clearAllData();
      setPacientes([]);
      setConsultas([]);
      setTransacoes([]);
      setProntuarios([]);
      setAnamneses([]);
      setDocumentos([]);
      toast.success('Todos os dados foram limpos');
    } catch (error) {
      console.error('Erro ao limpar dados:', error);
      toast.error('Erro ao limpar dados');
      throw error;
    }
  };

  const clearPacientes = async () => {
    try {
      localStorageService.clearPacientes();
      setPacientes([]);
      toast.success('Dados de pacientes limpos');
    } catch (error) {
      console.error('Erro ao limpar pacientes:', error);
      toast.error('Erro ao limpar pacientes');
      throw error;
    }
  };

  const clearTransacoes = async () => {
    try {
      localStorageService.clearTransacoes();
      setTransacoes([]);
      toast.success('Dados financeiros limpos');
    } catch (error) {
      console.error('Erro ao limpar transações:', error);
      toast.error('Erro ao limpar transações');
      throw error;
    }
  };

  const value: DentalSystemContextType = {
    // Data
    pacientes,
    consultas,
    transacoes,
    prontuarios,
    anamneses,
    documentos,
    produtos,
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
    addAnamnese,
    updateAnamnese,
    deleteAnamnese,
    clearAnamneses,
    generateSignatureLink,
    signAnamnese,
    addDocumento,
    updateDocumento,
    deleteDocumento,
    addProduto,
    updateProduto,
    deleteProduto,
    refreshData,
    clearAllData,
    clearPacientes,
    clearTransacoes
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
