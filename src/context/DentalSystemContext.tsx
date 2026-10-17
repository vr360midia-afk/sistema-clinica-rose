import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabaseService } from '@/services/supabaseService';
import { toast } from 'sonner';
import { Paciente, Consulta, Transacao, Prontuario, Anamnese, DocumentoPaciente } from '@/types/shared';
import { calcularIdade } from '@/utils/idade';

import { DentalSystemContext, DentalSystemContextType, useDentalSystem } from './dental-system-context';

export { useDentalSystem };
export type { DentalSystemContextType };


export const DentalSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, signOut } = useAuth();
  
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
    if (user?.id) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);


  const loadAllData = async (silencioso = false) => {
    // Se já existirem dados na memória, atualiza em segundo plano SEM travar ou resetar as telas do usuário
    if (!silencioso && pacientes.length === 0) {
      setLoading(true);
    }

    // Tenta 2x cada recurso e nunca derruba o carregamento inteiro por uma falha isolada
    const load = async <T,>(nome: string, fn: () => Promise<T>, fallback: T): Promise<{ nome: string; ok: boolean; data: T }> => {
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        try {
          return { nome, ok: true, data: await fn() };
        } catch (error: any) {
          if (error.message?.toLowerCase().includes('jwt expired')) {
             console.warn(`[DentalSystemContext] Token expirado ao carregar ${nome}, mantendo dados anteriores.`);
             return { nome, ok: false, data: fallback };
          }
          console.error(`Erro ao carregar ${nome} (tentativa ${tentativa + 1}):`, error);
          if (tentativa === 0) await new Promise(r => setTimeout(r, 600));
        }
      }
      return { nome, ok: false, data: fallback };
    };

    const [pac, con, tra, pro, ana, doc] = await Promise.all([
      load('pacientes', () => supabaseService.getPacientes(), []),
      load('consultas', () => supabaseService.getConsultas(), []),
      load('transações', () => supabaseService.getTransacoes(), []),
      load('prontuários', () => supabaseService.getProntuarios(), []),
      load('anamneses', () => supabaseService.getAnamneses(), []),
      load('documentos', () => supabaseService.getDocumentos(), []),
    ]);

    setPacientes((pac.data || []).filter(Boolean));
    setConsultas((con.data || []).filter(Boolean));
    setTransacoes((tra.data || []).filter(Boolean));
    setProntuarios((pro.data || []).filter(Boolean));
    setAnamneses((ana.data || []).filter(Boolean));
    setDocumentos((doc.data || []).filter(Boolean));

    const falhas = [pac, con, tra, pro, ana, doc].filter(r => !r.ok).map(r => r.nome);
    if (falhas.length) {
      toast.error(`Não foi possível carregar: ${falhas.join(', ')}`);
    }

    setLoading(false);
  };

  // Funções para Pacientes
  const addPaciente = async (pacienteData: Omit<Paciente, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<Paciente> => {
    try {
      console.log('addPaciente chamado com:', pacienteData);
      
      // Filtrar apenas os campos que existem na tabela pacientes
      const cleanPacienteData = {
        nome: pacienteData.nome?.trim(),
        email: pacienteData.email?.trim() || null,
        telefone: pacienteData.telefone?.trim(),
        dataNascimento: pacienteData.dataNascimento,
        idade: pacienteData.idade ?? calcularIdade(pacienteData.dataNascimento) ?? 0,
        convenio: pacienteData.convenio || 'particular',
        origemLead: pacienteData.origemLead || null,
        status: pacienteData.status || 'Ativo',
        foto: pacienteData.foto || null,
        ultimaConsulta: pacienteData.ultimaConsulta || null,
        proximaConsulta: pacienteData.proximaConsulta || null,
        historicoMedico: pacienteData.historicoMedico?.trim() || null,
        alergias: pacienteData.alergias?.trim() || null,
        medicamentos: pacienteData.medicamentos?.trim() || null,
        observacoes: pacienteData.observacoes?.trim() || null,
        endereco: pacienteData.endereco?.trim() || null,
        cpf: pacienteData.cpf?.trim() || null,
        rg: pacienteData.rg?.trim() || null,
        profissao: pacienteData.profissao?.trim() || null,
        estadoCivil: pacienteData.estadoCivil || null,
        dataArquivamento: pacienteData.dataArquivamento || null,
        motivoArquivamento: pacienteData.motivoArquivamento || null
      };
      
      console.log('Dados limpos para salvar:', cleanPacienteData);
      const novoPaciente = await supabaseService.savePaciente(cleanPacienteData as any);
      console.log('Paciente salvo no Supabase:', novoPaciente);
      
      setPacientes(prev => [novoPaciente, ...prev]);
      return novoPaciente;
    } catch (error) {
      console.error('Erro ao adicionar paciente:', error);
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
      } else {
        setConsultas(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
      }
      toast.success('Consulta atualizada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao atualizar consulta:', error);
      toast.error('Erro ao atualizar consulta: ' + (error?.message || 'Tente novamente'));
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

  const generateSignatureLink = async (anamneseId: string, modo: 'preencher' | 'assinar' = 'preencher'): Promise<string> => {
    if (!anamneseId) return '';
    const anamnese = anamneses.find(a => a.id === anamneseId);
    
    const token = anamnese?.tokenAssinatura || Math.random().toString(36).substring(2, 15);
    const expiracaoLink = new Date();
    expiracaoLink.setDate(expiracaoLink.getDate() + 7); // 7 dias para expirar
    const fullLink = `${window.location.origin}/assinar-anamnese/${anamneseId}?token=${token}&modo=${modo}`;
    
    // Atualizar anamnese com token
    try {
      await updateAnamnese(anamneseId, {
        tokenAssinatura: token,
        dataExpiracaoLink: expiracaoLink,
        linkAssinatura: fullLink
      });
    } catch (e) {
      console.warn('Aviso ao sincronizar token de anamnese no banco:', e);
    }
    
    return fullLink;
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

