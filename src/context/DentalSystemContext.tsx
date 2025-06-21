
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabaseService } from '@/services/supabaseService';
import { useAuth } from '@/context/AuthContext';
import { Paciente, Consulta, Transacao, Prontuario, Anamnese, DocumentoPaciente } from '@/types/shared';
import { toast } from 'sonner';

// Interface para Produto
interface Produto {
  id: string;
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
  addProduto: (produto: Omit<Produto, 'id'>) => Promise<void>;
  updateProduto: (id: string, updates: Partial<Produto>) => Promise<void>;
  deleteProduto: (id: string) => Promise<void>;
  
  // Utility methods
  refreshData: () => Promise<void>;
  clearAllData: () => Promise<void>;
  clearPacientes: () => Promise<void>;
  clearTransacoes: () => Promise<void>;
  migrateFromLocalStorage: () => Promise<void>;
}

const DentalSystemContext = createContext<DentalSystemContextType | undefined>(undefined);

export const DentalSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [prontuarios, setProntuarios] = useState<Prontuario[]>([]);
  const [anamneses, setAnamneses] = useState<Anamnese[]>([]);
  const [documentos,amentosumentos] = useState<DocumentoPaciente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!user) {
      // Se não há usuário, limpar dados
      setPacientes([]);
      setConsultas([]);
      setTransacoes([]);
      setProntuarios([]);
      setAnamneses([]);
      setDocumentos([]);
      setProdutos([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('Carregando dados do Supabase para usuário:', user.id);
      
      const [pacientesData, consultasData, transacoesData, prontuariosData, anamnesesData, documentosData, produtosData] = await Promise.all([
        supabaseService.getPacientes(),
        supabaseService.getConsultas(),
        supabaseService.getTransacoes(),
        supabaseService.getProntuarios(),
        supabaseService.getAnamneses(),
        supabaseService.getDocumentos(),
        supabaseService.getProdutos()
      ]);
      
      setPacientes(pacientesData);
      setConsultas(consultasData);
      setTransacoes(transacoesData);
      setProntuarios(prontuariosData);
      setAnamneses(anamnesesData);
      setDocumentos(documentosData);
      setProdutos(produtosData);

      console.log('Dados carregados do Supabase:', {
        pacientes: pacientesData.length,
        consultas: consultasData.length,
        transacoes: transacoesData.length,
        prontuarios: prontuariosData.length,
        anamneses: anamnesesData.length,
        documentos: documentosData.length,
        produtos: produtosData.length
      });
    } catch (error) {
      console.error('Erro ao carregar dados do Supabase:', error);
      toast.error('Erro ao carregar dados do sistema');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      loadData();
    }
  }, [user, authLoading]);

  // Patient methods
  const addPaciente = async (pacienteData: Omit<Paciente, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    try {
      const newPaciente = await supabaseService.savePaciente(pacienteData);
      setPacientes(prev => [newPaciente, ...prev]);
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
      const updatedPaciente = await supabaseService.updatePaciente(id, updates);
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
      await supabaseService.deletePaciente(id);
      setPacientes(prev => prev.filter(p => p.id !== id));
      toast.success(`Paciente ${paciente?.nome} excluído com sucesso`);
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
      const newConsulta = await supabaseService.saveConsulta(consultaData);
      setConsultas(prev => [newConsulta, ...prev]);
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
      const updatedConsulta = await supabaseService.updateConsulta(id, updates);
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
      await supabaseService.deleteConsulta(id);
      setConsultas(prev => prev.filter(c => c.id !== id));
      toast.success('Consulta cancelada com sucesso');
    } catch (error) {
      console.error('Erro ao cancelar consulta:', error);
      toast.error('Erro ao cancelar consulta');
      throw error;
    }
  };

  // Transaction methods
  const addTransacao = async (transacaoData: Omit<Transacao, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    try {
      const newTransacao = await supabaseService.saveTransacao(transacaoData);
      setTransacoes(prev => [newTransacao, ...prev]);
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
      const updatedTransacao = await supabaseService.updateTransacao(id, updates);
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
      await supabaseService.deleteTransacao(id);
      setTransacoes(prev => prev.filter(t => t.id !== id));
      toast.success('Transação excluída com sucesso');
    } catch (error) {
      console.error('Erro ao excluir transação:', error);
      toast.error('Erro ao excluir transação');
      throw error;
    }
  };

  // Medical record methods
  const addProntuario = async (prontuarioData: Omit<Prontuario, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    try {
      const newProntuario = await supabaseService.saveProntuario(prontuarioData);
      setProntuarios(prev => [newProntuario, ...prev]);
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
      const updatedProntuario = await supabaseService.updateProntuario(id, updates);
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
      await supabaseService.deleteProntuario(id);
      setProntuarios(prev => prev.filter(p => p.id !== id));
      toast.success('Prontuário excluído com sucesso');
    } catch (error) {
      console.error('Erro ao excluir prontuário:', error);
      toast.error('Erro ao excluir prontuário');
      throw error;
    }
  };

  // Anamnesis methods
  const addAnamnese = async (anamneseData: Omit<Anamnese, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    try {
      const newAnamnese = await supabaseService.saveAnamnese({
        ...anamneseData,
        statusAssinatura: 'pendente'
      });
      setAnamneses(prev => [newAnamnese, ...prev]);
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
      const updatedAnamnese = await supabaseService.updateAnamnese(id, updates);
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
      await supabaseService.deleteAnamnese(id);
      setAnamneses(prev => prev.filter(a => a.id !== id));
      toast.success('Anamnese excluída com sucesso');
    } catch (error) {
      console.error('Erro ao excluir anamnese:', error);
      toast.error('Erro ao excluir anamnese');
      throw error;
    }
  };

  const clearAnamneses = async () => {
    try {
      await supabaseService.clearAnamneses();
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
        updates.statusAssinatura = anamnese.assinaturaPaciente ? 'completo' : 'pendente';
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
      const newDocumento = await supabaseService.saveDocumento(documentoData);
      setDocumentos(prev => [newDocumento, ...prev]);
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
      const updatedDocumento = await supabaseService.updateDocumento(id, updates);
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
      await supabaseService.deleteDocumento(id);
      setDocumentos(prev => prev.filter(d => d.id !== id));
      toast.success('Documento excluído com sucesso');
    } catch (error) {
      console.error('Erro ao excluir documento:', error);
      toast.error('Erro ao excluir documento');
      throw error;
    }
  };

  // Product methods  
  const addProduto = async (produtoData: Omit<Produto, 'id'>) => {
    try {
      const newProduto = await supabaseService.saveProduto(produtoData);
      setProdutos(prev => [newProduto, ...prev]);
      toast.success('Produto adicionado com sucesso');
    } catch (error) {
      console.error('Erro ao adicionar produto:', error);
      toast.error('Erro ao adicionar produto');
      throw error;
    }
  };

  const updateProduto = async (id: string, updates: Partial<Produto>) => {
    try {
      const updatedProduto = await supabaseService.updateProduto(id, updates);
      if (updatedProduto) {
        setProdutos(prev => prev.map(p => p.id === id ? updatedProduto : p));
        toast.success('Produto atualizado com sucesso');
      }
    } catch (error) {
      console.error('Erro ao atualizar produto:', error);
      toast.error('Erro ao atualizar produto');
      throw error;
    }
  };

  const deleteProduto = async (id: string) => {
    try {
      await supabaseService.deleteProduto(id);
      setProdutos(prev => prev.filter(p => p.id !== id));
      toast.success('Produto excluído com sucesso');
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
      toast.error('Erro ao excluir produto');
      throw error;
    }
  };

  // Utility methods
  const refreshData = async () => {
    await loadData();
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
      setProdutos([]);
      toast.success('Todos os dados foram limpos');
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
      toast.success('Dados de pacientes limpos');
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
      toast.success('Dados financeiros limpos');
    } catch (error) {
      console.error('Erro ao limpar transações:', error);
      toast.error('Erro ao limpar transações');
      throw error;
    }
  };

  const migrateFromLocalStorage = async () => {
    try {
      await supabaseService.migrateFromLocalStorage();
      await refreshData(); // Recarregar dados após migração
    } catch (error) {
      console.error('Erro na migração:', error);
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
    loading: loading || authLoading,
    
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
    clearTransacoes,
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
