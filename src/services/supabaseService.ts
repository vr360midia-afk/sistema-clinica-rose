
import { supabase } from '@/integrations/supabase/client';
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
  user_id?: string;
  criado_em?: Date;
  atualizado_em?: Date;
}

class SupabaseService {
  private async getCurrentUserId(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');
    return user.id;
  }

  // Transformar dados do Supabase para o formato esperado pelo app
  private transformSupabaseToLocal = (data: any): any => {
    if (!data) return data;
    
    return {
      ...data,
      criadoEm: new Date(data.criado_em),
      atualizadoEm: new Date(data.atualizado_em),
      data: data.data ? new Date(data.data) : undefined,
      dataArquivamento: data.data_arquivamento ? new Date(data.data_arquivamento) : undefined,
      dataExpiracaoLink: data.data_expiracao_link ? new Date(data.data_expiracao_link) : undefined,
      ultimaConsulta: data.ultima_consulta ? new Date(data.ultima_consulta) : undefined,
      proximaConsulta: data.proxima_consulta ? new Date(data.proxima_consulta) : undefined,
      vencimento: data.vencimento ? new Date(data.vencimento) : undefined,
      // Transformar campos com underscores
      origemLead: data.origem_lead,
      historicoMedico: data.historico_medico,
      estadoCivil: data.estado_civil,
      motivoArquivamento: data.motivo_arquivamento,
      pacienteId: data.paciente_id,
      consultaId: data.consulta_id,
      metodoPagamento: data.metodo_pagamento,
      queixaPrincipal: data.queixa_principal,
      historiaDoenca: data.historia_doenca,
      exameClinico: data.exame_clinico,
      planoTratamento: data.plano_tratamento,
      procedimentosRealizados: data.procedimentos_realizados || [],
      historiaAtual: data.historia_atual,
      historiaFamiliar: data.historia_familiar,
      historiaMedica: data.historia_medica,
      habitosViciosPositivos: data.habitos_vicios_positivos,
      habitosViciosNegativos: data.habitos_vicios_negativos,
      exameExtraBucal: data.exame_extra_bucal,
      exameIntraBucal: data.exame_intra_bucal,
      assinaturaPaciente: data.assinatura_paciente,
      assinaturaDoutor: data.assinatura_doutor,
      linkAssinatura: data.link_assinatura,
      tokenAssinatura: data.token_assinatura,
      statusAssinatura: data.status_assinatura,
      dataExpiracaoLink: data.data_expiracao_link ? new Date(data.data_expiracao_link) : undefined
    };
  };

  // Transformar dados do app para o formato do Supabase
  private transformLocalToSupabase = (data: any): any => {
    const userId = data.user_id;
    delete data.user_id;
    
    return {
      ...data,
      user_id: userId,
      criado_em: data.criadoEm,
      atualizado_em: data.atualizadoEm,
      origem_lead: data.origemLead,
      historico_medico: data.historicoMedico,
      estado_civil: data.estadoCivil,
      data_arquivamento: data.dataArquivamento,
      motivo_arquivamento: data.motivoArquivamento,
      ultima_consulta: data.ultimaConsulta,
      proxima_consulta: data.proximaConsulta,
      paciente_id: data.pacienteId,
      consulta_id: data.consultaId,
      metodo_pagamento: data.metodoPagamento,
      queixa_principal: data.queixaPrincipal,
      historia_doenca: data.historiaDoenca,
      exame_clinico: data.exameClinico,
      plano_tratamento: data.planoTratamento,
      procedimentos_realizados: data.procedimentosRealizados,
      historia_atual: data.historiaAtual,
      historia_familiar: data.historiaFamiliar,
      historia_medica: data.historiaMedica,
      habitos_vicios_positivos: data.habitosViciosPositivos,
      habitos_vicios_negativos: data.habitosViciosNegativos,
      exame_extra_bucal: data.exameExtraBucal,
      exame_intra_bucal: data.exameIntraBucal,
      assinatura_paciente: data.assinaturaPaciente,
      assinatura_doutor: data.assinaturaDoutor,
      link_assinatura: data.linkAssinatura,
      token_assinatura: data.tokenAssinatura,
      status_assinatura: data.statusAssinatura,
      data_expiracao_link: data.dataExpiracaoLink
    };
  };

  // PACIENTES
  async getPacientes(): Promise<Paciente[]> {
    const userId = await this.getCurrentUserId();
    const { data, error } = await supabase
      .from('pacientes')
      .select('*')
      .eq('user_id', userId)
      .order('criado_em', { ascending: false });

    if (error) throw error;
    return data?.map(this.transformSupabaseToLocal) || [];
  }

  async savePaciente(paciente: Omit<Paciente, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<Paciente> {
    const userId = await this.getCurrentUserId();
    const pacienteData = this.transformLocalToSupabase({
      ...paciente,
      user_id: userId
    });

    const { data, error } = await supabase
      .from('pacientes')
      .insert([pacienteData])
      .select()
      .single();

    if (error) throw error;
    return this.transformSupabaseToLocal(data);
  }

  async updatePaciente(id: string, updates: Partial<Paciente>): Promise<Paciente | null> {
    const userId = await this.getCurrentUserId();
    const updateData = this.transformLocalToSupabase(updates);

    const { data, error } = await supabase
      .from('pacientes')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data ? this.transformSupabaseToLocal(data) : null;
  }

  async deletePaciente(id: string): Promise<boolean> {
    const userId = await this.getCurrentUserId();
    const { error } = await supabase
      .from('pacientes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  // CONSULTAS
  async getConsultas(): Promise<Consulta[]> {
    const userId = await this.getCurrentUserId();
    const { data, error } = await supabase
      .from('consultas')
      .select('*')
      .eq('user_id', userId)
      .order('data', { ascending: false });

    if (error) throw error;
    return data?.map(this.transformSupabaseToLocal) || [];
  }

  async saveConsulta(consulta: Omit<Consulta, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<Consulta> {
    const userId = await this.getCurrentUserId();
    const consultaData = this.transformLocalToSupabase({
      ...consulta,
      user_id: userId
    });

    const { data, error } = await supabase
      .from('consultas')
      .insert([consultaData])
      .select()
      .single();

    if (error) throw error;
    return this.transformSupabaseToLocal(data);
  }

  async updateConsulta(id: string, updates: Partial<Consulta>): Promise<Consulta | null> {
    const userId = await this.getCurrentUserId();
    const updateData = this.transformLocalToSupabase(updates);

    const { data, error } = await supabase
      .from('consultas')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data ? this.transformSupabaseToLocal(data) : null;
  }

  async deleteConsulta(id: string): Promise<boolean> {
    const userId = await this.getCurrentUserId();
    const { error } = await supabase
      .from('consultas')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  // TRANSAÇÕES
  async getTransacoes(): Promise<Transacao[]> {
    const userId = await this.getCurrentUserId();
    const { data, error } = await supabase
      .from('transacoes')
      .select('*')
      .eq('user_id', userId)
      .order('data', { ascending: false });

    if (error) throw error;
    return data?.map(this.transformSupabaseToLocal) || [];
  }

  async saveTransacao(transacao: Omit<Transacao, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<Transacao> {
    const userId = await this.getCurrentUserId();
    const transacaoData = this.transformLocalToSupabase({
      ...transacao,
      user_id: userId
    });

    const { data, error } = await supabase
      .from('transacoes')
      .insert([transacaoData])
      .select()
      .single();

    if (error) throw error;
    return this.transformSupabaseToLocal(data);
  }

  async updateTransacao(id: string, updates: Partial<Transacao>): Promise<Transacao | null> {
    const userId = await this.getCurrentUserId();
    const updateData = this.transformLocalToSupabase(updates);

    const { data, error } = await supabase
      .from('transacoes')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data ? this.transformSupabaseToLocal(data) : null;
  }

  async deleteTransacao(id: string): Promise<boolean> {
    const userId = await this.getCurrentUserId();
    const { error } = await supabase
      .from('transacoes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  // PRONTUÁRIOS
  async getProntuarios(): Promise<Prontuario[]> {
    const userId = await this.getCurrentUserId();
    const { data, error } = await supabase
      .from('prontuarios')
      .select('*')
      .eq('user_id', userId)
      .order('data', { ascending: false });

    if (error) throw error;
    return data?.map(this.transformSupabaseToLocal) || [];
  }

  async saveProntuario(prontuario: Omit<Prontuario, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<Prontuario> {
    const userId = await this.getCurrentUserId();
    const prontuarioData = this.transformLocalToSupabase({
      ...prontuario,
      user_id: userId
    });

    const { data, error } = await supabase
      .from('prontuarios')
      .insert([prontuarioData])
      .select()
      .single();

    if (error) throw error;
    return this.transformSupabaseToLocal(data);
  }

  async updateProntuario(id: string, updates: Partial<Prontuario>): Promise<Prontuario | null> {
    const userId = await this.getCurrentUserId();
    const updateData = this.transformLocalToSupabase(updates);

    const { data, error } = await supabase
      .from('prontuarios')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data ? this.transformSupabaseToLocal(data) : null;
  }

  async deleteProntuario(id: string): Promise<boolean> {
    const userId = await this.getCurrentUserId();
    const { error } = await supabase
      .from('prontuarios')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  // ANAMNESES
  async getAnamneses(): Promise<Anamnese[]> {
    const userId = await this.getCurrentUserId();
    const { data, error } = await supabase
      .from('anamneses')
      .select('*')
      .eq('user_id', userId)
      .order('data', { ascending: false });

    if (error) throw error;
    return data?.map(this.transformSupabaseToLocal) || [];
  }

  async saveAnamnese(anamnese: Omit<Anamnese, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<Anamnese> {
    const userId = await this.getCurrentUserId();
    const anamneseData = this.transformLocalToSupabase({
      ...anamnese,
      user_id: userId
    });

    const { data, error } = await supabase
      .from('anamneses')
      .insert([anamneseData])
      .select()
      .single();

    if (error) throw error;
    return this.transformSupabaseToLocal(data);
  }

  async updateAnamnese(id: string, updates: Partial<Anamnese>): Promise<Anamnese | null> {
    const userId = await this.getCurrentUserId();
    const updateData = this.transformLocalToSupabase(updates);

    const { data, error } = await supabase
      .from('anamneses')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data ? this.transformSupabaseToLocal(data) : null;
  }

  async deleteAnamnese(id: string): Promise<boolean> {
    const userId = await this.getCurrentUserId();
    const { error } = await supabase
      .from('anamneses')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  async clearAnamneses(): Promise<void> {
    const userId = await this.getCurrentUserId();
    const { error } = await supabase
      .from('anamneses')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
  }

  // DOCUMENTOS
  async getDocumentos(): Promise<DocumentoPaciente[]> {
    const userId = await this.getCurrentUserId();
    const { data, error } = await supabase
      .from('documentos_paciente')
      .select('*')
      .eq('user_id', userId)
      .order('criado_em', { ascending: false });

    if (error) throw error;
    return data?.map(this.transformSupabaseToLocal) || [];
  }

  async saveDocumento(documento: Omit<DocumentoPaciente, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<DocumentoPaciente> {
    const userId = await this.getCurrentUserId();
    const documentoData = this.transformLocalToSupabase({
      ...documento,
      user_id: userId
    });

    const { data, error } = await supabase
      .from('documentos_paciente')
      .insert([documentoData])
      .select()
      .single();

    if (error) throw error;
    return this.transformSupabaseToLocal(data);
  }

  async updateDocumento(id: string, updates: Partial<DocumentoPaciente>): Promise<DocumentoPaciente | null> {
    const userId = await this.getCurrentUserId();
    const updateData = this.transformLocalToSupabase(updates);

    const { data, error } = await supabase
      .from('documentos_paciente')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data ? this.transformSupabaseToLocal(data) : null;
  }

  async deleteDocumento(id: string): Promise<boolean> {
    const userId = await this.getCurrentUserId();
    const { error } = await supabase
      .from('documentos_paciente')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  // PRODUTOS
  async getProdutos(): Promise<Produto[]> {
    const userId = await this.getCurrentUserId();
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .eq('user_id', userId)
      .order('nome');

    if (error) throw error;
    return data?.map(this.transformSupabaseToLocal) || [];
  }

  async saveProduto(produto: Omit<Produto, 'id'>): Promise<Produto> {
    const userId = await this.getCurrentUserId();
    const produtoData = {
      ...produto,
      user_id: userId
    };

    const { data, error } = await supabase
      .from('produtos')
      .insert([produtoData])
      .select()
      .single();

    if (error) throw error;
    return this.transformSupabaseToLocal(data);
  }

  async updateProduto(id: string, updates: Partial<Produto>): Promise<Produto | null> {
    const userId = await this.getCurrentUserId();
    
    const { data, error } = await supabase
      .from('produtos')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data ? this.transformSupabaseToLocal(data) : null;
  }

  async deleteProduto(id: string): Promise<boolean> {
    const userId = await this.getCurrentUserId();
    const { error } = await supabase
      .from('produtos')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  // Métodos utilitários
  async clearAllData(): Promise<void> {
    const userId = await this.getCurrentUserId();
    
    // Deletar dados em ordem para respeitar foreign keys
    await supabase.from('documentos_paciente').delete().eq('user_id', userId);
    await supabase.from('anamneses').delete().eq('user_id', userId);
    await supabase.from('prontuarios').delete().eq('user_id', userId);
    await supabase.from('transacoes').delete().eq('user_id', userId);
    await supabase.from('consultas').delete().eq('user_id', userId);
    await supabase.from('pacientes').delete().eq('user_id', userId);
    await supabase.from('produtos').delete().eq('user_id', userId);
  }

  async clearPacientes(): Promise<void> {
    const userId = await this.getCurrentUserId();
    
    // Deletar dados relacionados primeiro
    await supabase.from('documentos_paciente').delete().eq('user_id', userId);
    await supabase.from('anamneses').delete().eq('user_id', userId);
    await supabase.from('prontuarios').delete().eq('user_id', userId);
    await supabase.from('transacoes').delete().eq('user_id', userId);
    await supabase.from('consultas').delete().eq('user_id', userId);
    await supabase.from('pacientes').delete().eq('user_id', userId);
  }

  async clearTransacoes(): Promise<void> {
    const userId = await this.getCurrentUserId();
    const { error } = await supabase
      .from('transacoes')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
  }

  // Migração de dados do localStorage
  async migrateFromLocalStorage(): Promise<void> {
    try {
      console.log('Iniciando migração dos dados do localStorage para Supabase...');
      
      // Importar dados do localStorage
      const { localStorageService } = await import('@/services/localStorage');
      
      // Obter dados existentes
      const localPacientes = localStorageService.getPacientes();
      const localConsultas = localStorageService.getConsultas();
      const localTransacoes = localStorageService.getTransacoes();
      const localProntuarios = localStorageService.getProntuarios();
      const localAnamneses = localStorageService.getAnamneses();
      const localDocumentos = localStorageService.getDocumentos();
      
      console.log('Dados encontrados no localStorage:', {
        pacientes: localPacientes.length,
        consultas: localConsultas.length,
        transacoes: localTransacoes.length,
        prontuarios: localProntuarios.length,
        anamneses: localAnamneses.length,
        documentos: localDocumentos.length
      });

      if (localPacientes.length === 0) {
        console.log('Nenhum dado encontrado no localStorage para migrar');
        return;
      }

      const userId = await this.getCurrentUserId();
      
      // Migrar pacientes
      if (localPacientes.length > 0) {
        for (const paciente of localPacientes) {
          const { id, criadoEm, atualizadoEm, ...pacienteData } = paciente;
          await this.savePaciente(pacienteData);
        }
        console.log(`${localPacientes.length} pacientes migrados`);
      }

      // Migrar consultas
      if (localConsultas.length > 0) {
        for (const consulta of localConsultas) {
          const { id, criadoEm, atualizadoEm, ...consultaData } = consulta;
          await this.saveConsulta(consultaData);
        }
        console.log(`${localConsultas.length} consultas migradas`);
      }

      // Migrar transações  
      if (localTransacoes.length > 0) {
        for (const transacao of localTransacoes) {
          const { id, criadoEm, atualizadoEm, ...transacaoData } = transacao;
          await this.saveTransacao(transacaoData);
        }
        console.log(`${localTransacoes.length} transações migradas`);
      }

      // Migrar prontuários
      if (localProntuarios.length > 0) {
        for (const prontuario of localProntuarios) {
          const { id, criadoEm, atualizadoEm, ...prontuarioData } = prontuario;
          await this.saveProntuario(prontuarioData);
        }
        console.log(`${localProntuarios.length} prontuários migrados`);
      }

      // Migrar anamneses
      if (localAnamneses.length > 0) {
        for (const anamnese of localAnamneses) {
          const { id, criadoEm, atualizadoEm, ...anamneseData } = anamnese;
          await this.saveAnamnese(anamneseData);
        }
        console.log(`${localAnamneses.length} anamneses migradas`);
      }

      // Migrar documentos
      if (localDocumentos.length > 0) {
        for (const documento of localDocumentos) {
          const { id, criadoEm, atualizadoEm, ...documentoData } = documento;
          await this.saveDocumento(documentoData);
        }
        console.log(`${localDocumentos.length} documentos migrados`);
      }

      toast.success('Migração concluída com sucesso!');
      console.log('Migração dos dados concluída com sucesso');
      
    } catch (error) {
      console.error('Erro durante a migração:', error);
      toast.error('Erro durante a migração dos dados');
      throw error;
    }
  }
}

export const supabaseService = new SupabaseService();
