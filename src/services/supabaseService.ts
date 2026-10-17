import { supabase } from '@/integrations/supabase/client';
import { Paciente, Consulta, Transacao, Prontuario, Anamnese, DocumentoPaciente } from '@/types/shared';
import { toast } from 'sonner';
import { localStorageService } from './localStorage';

// Interface para Produto
interface Produto {
  id: string;
  nome: string;
  categoria: string;
  quantidade: number;
  minimo: number;
  preco: number;
  user_id?: string;
  criado_em?: string;
  atualizado_em?: string;
}

export interface MembroEquipe {
  id: string;
  clinica_id: string;
  usuario_id: string;
  nome: string;
  email: string;
  permissoes: Record<string, boolean>;
  criado_em: string;
}

class SupabaseService {
  private parseLocalDate(value: unknown): Date | undefined {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    const text = String(value);
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (dateOnly) {
      return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    }
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private cachedClinicaId: string | null = null;
  private cachedSessionUserId: string | null = null;

  private async getCurrentUserId(): Promise<string> {
    let { data: { session } } = await supabase.auth.getSession();
    
    // Se a sessão expirou ou está a menos de 30 segundos de expirar, renova
    const now = Math.floor(Date.now() / 1000);
    if (session && session.expires_at && session.expires_at <= now + 30) {
      try {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed?.session) {
          session = refreshed.session;
        }
      } catch (err) {
        console.warn('[supabaseService] Erro ao renovar sessão:', err);
      }
    }

    const userId = session?.user?.id || (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('Usuário não autenticado');

    if (this.cachedSessionUserId === userId && this.cachedClinicaId) {
      return this.cachedClinicaId;
    }

    try {
      const { data, error } = await supabase.rpc('clinica_id');
      if (data && !error) {
        this.cachedSessionUserId = userId;
        this.cachedClinicaId = data as string;
        return data as string;
      }
    } catch (e) {
      console.warn('Erro ao buscar clinica_id via RPC', e);
    }
    
    return userId;
  }

  private async snapshotToLixeira(tabela: string, id: string, titulo?: string): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      const { data } = await (supabase as any)
        .from(tabela)
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle();
      if (!data) return;
      const { data: { session } } = await supabase.auth.getSession();
      await (supabase as any).from('lixeira').insert({
        user_id: userId,
        entidade: tabela,
        entidade_id: id,
        titulo: titulo || data.nome || data.paciente_nome || data.descricao || data.titulo || null,
        dados: data,
        excluido_por: session?.user?.email ?? null,
      });
    } catch (e) {
      console.error('Erro ao mover para a lixeira:', e);
    }
  }

  // Transformar dados do Supabase para o formato esperado pelo app
  private transformSupabaseToLocal = (data: any): any => {
    if (!data) return null;
    
    return {
      ...data,
      status: data.status || (data.tipo ? 'pendente' : 'Ativo'),
      criadoEm: new Date(data.criado_em || Date.now()),
      atualizadoEm: new Date(data.atualizado_em || data.criado_em || Date.now()),
      // Colunas DATE chegam como YYYY-MM-DD. InterpretÃ¡-las como UTC desloca
      // a consulta para o dia anterior em fusos como o de SÃ£o Paulo.
      data: this.parseLocalDate(data.data),
      dataNascimento: data.data_nascimento ? new Date(data.data_nascimento + 'T00:00:00') : undefined,
      dataArquivamento: data.data_arquivamento ? new Date(data.data_arquivamento + 'T00:00:00') : undefined,
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
      taxaCartaoPercentual: data.taxa_cartao_percentual,
      taxaCartaoValor: data.taxa_cartao_valor,
      valorParcela: data.valor_parcela,
      valorLiquido: data.valor_liquido,
      parceiroId: data.parceiro_id,
      parceiroNome: data.parceiro_nome,
      valorParceiro: data.valor_parceiro,
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
      arquivo: data.url ?? data.arquivo,
      analiseIa: data.analise_ia,
      analiseDados: data.analise_dados,
      analiseStatus: data.analise_status,
      confirmacaoStatus: data.confirmacao_status,
      confirmadoEm: data.confirmado_em ? new Date(data.confirmado_em) : undefined,
      odontograma: (() => {
        if (typeof data.odontograma === 'string') {
          try { return JSON.parse(data.odontograma); } catch (_) { return data.odontograma; }
        }
        return data.odontograma;
      })(),
      restauracoesPreexistentes: (() => {
        if (data.restauracoes_preexistentes) return data.restauracoes_preexistentes;
        if (typeof data.odontograma === 'string') {
          try {
            const parsed = JSON.parse(data.odontograma);
            return parsed?.restauracoesPreexistentes;
          } catch (_) { return undefined; }
        }
        return data.odontograma?.restauracoesPreexistentes;
      })(),
    };
  };

  // Colunas vÃ¡lidas por tabela (evita enviar campos inexistentes ao banco)
  private tableColumns: Record<string, string[]> = {
    pacientes: ['user_id','nome','email','telefone','idade','data_nascimento','endereco','cpf','rg','profissao','estado_civil','convenio','origem_lead','foto','historico_medico','alergias','medicamentos','observacoes','status','ultima_consulta','proxima_consulta','data_arquivamento','motivo_arquivamento','odontograma'],
    consultas: ['user_id','paciente_id','paciente_nome','data','hora','tipo','status','valor','observacoes','duracao','procedimento','dentista','confirmacao_status','confirmado_em'],
    transacoes: ['user_id','tipo','descricao','valor','categoria','data','paciente_id','paciente_nome','status','consulta_id','metodo_pagamento','vencimento','observacoes','taxa_cartao_percentual','taxa_cartao_valor','parcelas','valor_parcela','valor_liquido','parceiro_id','parceiro_nome','valor_parceiro','orcamento_id','comprovantes'],
    prontuarios: ['user_id','paciente_id','paciente_nome','data','queixa_principal','diagnostico','tratamento','observacoes','odontograma','imagens','assinatura','procedimentos','consulta_id','historia_doenca','exame_clinico','plano_tratamento','procedimentos_realizados','anexos'],
    anamneses: ['user_id', 'paciente_id', 'data', 'queixa_principal', 'historia_medica', 'alergias', 'medicamentos', 'exame_extra_bucal', 'exame_intra_bucal', 'status_assinatura', 'criado_em'],
    documentos_paciente: ['user_id','paciente_id','nome','tipo','url','tamanho','analise_ia','analise_dados','analise_status'],
    produtos: ['user_id','nome','categoria','quantidade','minimo','preco'],
  };

  // Colunas do tipo DATE (sem hora) â€” precisam de YYYY-MM-DD no fuso local
  private dateOnlyColumns: Record<string, string[]> = {
    pacientes: ['data_nascimento'],
    consultas: ['data'],
    transacoes: ['data'],
    prontuarios: ['data'],
  };

  private toLocalDateString(value: any): string | null {
    const d = value instanceof Date ? value : new Date(String(value));
    if (isNaN(d.getTime())) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // Transformar dados do app para o formato do Supabase
  private transformLocalToSupabase = (data: any, table?: string): any => {
    // Mapeamento camelCase -> snake_case
    const camelToSnake: Record<string, string> = {
      userId: 'user_id',
      criadoEm: 'criado_em',
      atualizadoEm: 'atualizado_em',
      origemLead: 'origem_lead',
      dataNascimento: 'data_nascimento',
      historicoMedico: 'historico_medico',
      estadoCivil: 'estado_civil',
      dataArquivamento: 'data_arquivamento',
      motivoArquivamento: 'motivo_arquivamento',
      ultimaConsulta: 'ultima_consulta',
      proximaConsulta: 'proxima_consulta',
      pacienteId: 'paciente_id',
      pacienteNome: 'paciente_nome',
      consultaId: 'consulta_id',
      metodoPagamento: 'metodo_pagamento',
      taxaCartaoPercentual: 'taxa_cartao_percentual',
      taxaCartaoValor: 'taxa_cartao_valor',
      valorParcela: 'valor_parcela',
      valorLiquido: 'valor_liquido',
      parceiroId: 'parceiro_id',
      parceiroNome: 'parceiro_nome',
      valorParceiro: 'valor_parceiro',
      orcamentoId: 'orcamento_id',
      comprovanteUrl: 'comprovantes',
      queixaPrincipal: 'queixa_principal',
      historiaDoenca: 'historia_doenca',
      exameClinico: 'exame_clinico',
      planoTratamento: 'plano_tratamento',
      procedimentosRealizados: 'procedimentos_realizados',
      historiaAtual: 'historia_atual',
      historiaFamiliar: 'historia_familiar',
      historiaMedica: 'historia_medica',
      habitosViciosPositivos: 'habitos_vicios_positivos',
      habitosViciosNegativos: 'habitos_vicios_negativos',
      exameExtraBucal: 'exame_extra_bucal',
      exameIntraBucal: 'exame_intra_bucal',
      assinaturaPaciente: 'assinatura_paciente',
      assinaturaDoutor: 'assinatura_doutor',
      linkAssinatura: 'link_assinatura',
      tokenAssinatura: 'token_assinatura',
      statusAssinatura: 'status_assinatura',
      dataExpiracaoLink: 'data_expiracao_link',
      dataAssinatura: 'data_assinatura',
      arquivo: 'url',
      analiseIa: 'analise_ia',
      analiseDados: 'analise_dados',
      analiseStatus: 'analise_status',
      confirmacaoStatus: 'confirmacao_status',
      confirmadoEm: 'confirmado_em',
    };

    // Campos do tipo Date que precisam virar ISO string
    const dateFields = new Set([
      'criadoEm', 'atualizadoEm', 'dataArquivamento', 'ultimaConsulta',
      'proximaConsulta', 'dataExpiracaoLink', 'dataAssinatura', 'data', 'vencimento', 'confirmadoEm'
    ]);

    const allowed = table ? this.tableColumns[table] : undefined;
    const dateOnly = table ? (this.dateOnlyColumns[table] || []) : [];

    const clonedData: any = { ...data };
    if (table === 'prontuarios' && clonedData.restauracoesPreexistentes) {
      let baseOdonto: any = {};
      if (typeof clonedData.odontograma === 'string') {
        try { baseOdonto = JSON.parse(clonedData.odontograma); } catch (_) {}
      } else if (typeof clonedData.odontograma === 'object' && clonedData.odontograma !== null) {
        baseOdonto = { ...clonedData.odontograma };
      }
      baseOdonto.restauracoesPreexistentes = clonedData.restauracoesPreexistentes;
      clonedData.odontograma = baseOdonto;
    }

    const result: any = {};
    for (const [key, value] of Object.entries(clonedData)) {
      if (value === undefined) continue;
      const newKey = camelToSnake[key] || key;
      if (allowed && !allowed.includes(newKey)) continue;

      let newValue: any = value;
      if (dateFields.has(key) || dateOnly.includes(newKey)) {
        if (value === null || (typeof value === 'string' && !value.trim())) {
          newValue = null;
        } else if (dateOnly.includes(newKey)) {
          newValue = this.toLocalDateString(value);
        } else {
          const d = value instanceof Date ? value : new Date(String(value));
          newValue = isNaN(d.getTime()) ? null : d.toISOString();
        }
      } else if (typeof value === 'string' && !value.trim()) {
        const requiredFields = ['nome', 'telefone'];
        if (!requiredFields.includes(newKey)) {
          newValue = null;
        }
      }
      result[newKey] = newValue;
    }
    return result;
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
    return (data || []).map(this.transformSupabaseToLocal).filter(Boolean);
  }

  async savePaciente(paciente: Omit<Paciente, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<Paciente> {
    const { data: { session } } = await supabase.auth.getSession();
    const sessionUserId = session?.user?.id || (await supabase.auth.getUser()).data.user?.id;
    if (!sessionUserId) throw new Error('Usuário não autenticado');

    const userId = await this.getCurrentUserId();
    const pacienteData = this.transformLocalToSupabase({ ...paciente, user_id: userId }, 'pacientes');

    let { data, error } = await supabase
      .from('pacientes')
      .insert([pacienteData])
      .select()
      .single();

    // Se falhou por violação de RLS (42501) e estávamos usando clinica_id diferente do sessionUserId,
    // tenta salvar com sessionUserId
    if (error && (error.code === '42501' || error.message?.includes('policy')) && userId !== sessionUserId) {
      console.warn('[supabaseService] RLS falhou com clinica_id, tentando com sessionUserId...', error);
      const retryData = { ...pacienteData, user_id: sessionUserId };
      const retry = await supabase
        .from('pacientes')
        .insert([retryData])
        .select()
        .single();
      if (!retry.error && retry.data) {
        data = retry.data;
        error = null;
      } else if (retry.error) {
        error = retry.error;
      }
    }

    if (error) {
      console.error('[supabaseService] Erro ao salvar paciente no Supabase:', error);
      throw error;
    }
    return this.transformSupabaseToLocal(data);
  }

  async updatePaciente(id: string, updates: Partial<Paciente>): Promise<Paciente | null> {
    const { data: { session } } = await supabase.auth.getSession();
    const sessionUserId = session?.user?.id || (await supabase.auth.getUser()).data.user?.id;
    if (!sessionUserId) throw new Error('Usuário não autenticado');

    const userId = await this.getCurrentUserId();
    const updateData = this.transformLocalToSupabase(updates, 'pacientes');

    let { data, error } = await supabase
      .from('pacientes')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (!data && userId !== sessionUserId) {
      const retry = await supabase
        .from('pacientes')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', sessionUserId)
        .select()
        .maybeSingle();
      if (retry.data) {
        data = retry.data;
        error = null;
      }
    }

    if (error) throw error;
    return data ? this.transformSupabaseToLocal(data) : null;
  }

  async deletePaciente(id: string): Promise<boolean> {
    const userId = await this.getCurrentUserId();
    await this.snapshotToLixeira('pacientes', id);
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
    return (data || []).map(this.transformSupabaseToLocal).filter(Boolean);
  }

  async saveConsulta(consulta: Omit<Consulta, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<Consulta> {
    const userId = await this.getCurrentUserId();
    const consultaData = this.transformLocalToSupabase({ ...consulta, user_id: userId }, 'consultas');

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
    const updateData = this.transformLocalToSupabase(updates, 'consultas');
    delete updateData.id;
    delete updateData.user_id;
    delete updateData.criado_em;
    updateData.atualizado_em = new Date().toISOString();

    const { data, error } = await supabase
      .from('consultas')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data ? this.transformSupabaseToLocal(data) : null;
  }

  async deleteConsulta(id: string): Promise<boolean> {
    const userId = await this.getCurrentUserId();
    await this.snapshotToLixeira('consultas', id);
    const { error } = await supabase
      .from('consultas')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  // TRANSAÃ‡Ã•ES
  async getTransacoes(): Promise<Transacao[]> {
    const userId = await this.getCurrentUserId();
    const { data, error } = await supabase
      .from('transacoes')
      .select('*')
      .eq('user_id', userId)
      .order('data', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.transformSupabaseToLocal).filter(Boolean);
  }

  async saveTransacao(transacao: Omit<Transacao, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<Transacao> {
    const userId = await this.getCurrentUserId();
    const transacaoData = this.transformLocalToSupabase({ ...transacao, user_id: userId }, 'transacoes');

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
    const updateData = this.transformLocalToSupabase(updates, 'transacoes');

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
    await this.snapshotToLixeira('transacoes', id);
    const { error } = await supabase
      .from('transacoes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  // PRONTUÃ�RIOS
  async getProntuarios(): Promise<Prontuario[]> {
    const userId = await this.getCurrentUserId();
    const { data, error } = await supabase
      .from('prontuarios')
      .select('*')
      .eq('user_id', userId)
      .order('data', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.transformSupabaseToLocal).filter(Boolean);
  }

  async saveProntuario(prontuario: Omit<Prontuario, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<Prontuario> {
    const userId = await this.getCurrentUserId();
    const prontuarioData = this.transformLocalToSupabase({ ...prontuario, user_id: userId }, 'prontuarios');

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
    const updateData = this.transformLocalToSupabase(updates, 'prontuarios');

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
    await this.snapshotToLixeira('prontuarios', id);
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
      .order('criado_em', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.transformSupabaseToLocal).filter(Boolean);
  }

  async saveAnamnese(anamnese: Omit<Anamnese, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<Anamnese> {
    const userId = await this.getCurrentUserId();
    const anamneseData = this.transformLocalToSupabase({ ...anamnese, user_id: userId }, 'anamneses');

    try {
      const { data, error } = await supabase
        .from('anamneses')
        .insert([anamneseData])
        .select()
        .single();

      if (error) throw error;
      const saved = this.transformSupabaseToLocal(data);
      localStorageService.saveAnamnese(saved);
      return saved;
    } catch (err) {
      console.warn('Aviso ao salvar anamnese no Supabase, usando persistência local como fallback:', err);
      return localStorageService.saveAnamnese(anamnese);
    }
  }

  async updateAnamnese(id: string, updates: Partial<Anamnese>): Promise<Anamnese | null> {
    const userId = await this.getCurrentUserId();
    const updateData = this.transformLocalToSupabase(updates, 'anamneses');

    localStorageService.updateAnamnese(id, updates);

    if (Object.keys(updateData).length > 0) {
      try {
        const { data, error } = await supabase
          .from('anamneses')
          .update(updateData)
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .maybeSingle();

        if (error) {
          console.warn('Aviso ao sincronizar atualização de anamnese no Supabase:', error);
        }
        if (data) return this.transformSupabaseToLocal(data);
      } catch (err) {
        console.warn('Erro ao atualizar anamnese no Supabase:', err);
      }
    }

    const locals = localStorageService.getAnamneses();
    return locals.find(a => a.id === id) || null;
  }

  async deleteAnamnese(id: string): Promise<boolean> {
    const userId = await this.getCurrentUserId();
    await this.snapshotToLixeira('anamneses', id);
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
    return (data || []).map(this.transformSupabaseToLocal).filter(Boolean);
  }

  async saveDocumento(documento: Omit<DocumentoPaciente, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<DocumentoPaciente> {
    const userId = await this.getCurrentUserId();
    const documentoData = this.transformLocalToSupabase({ ...documento, user_id: userId }, 'documentos_paciente');

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
    const updateData = this.transformLocalToSupabase(updates, 'documentos_paciente');

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
    await this.snapshotToLixeira('documentos_paciente', id);
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

  async saveProduto(produto: Omit<Produto, 'id' | 'criado_em' | 'atualizado_em'>): Promise<Produto> {
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

  async updateProduto(id: string, updates: Partial<Omit<Produto, 'id' | 'criado_em' | 'atualizado_em'>>): Promise<Produto | null> {
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
    await this.snapshotToLixeira('produtos', id);
    const { error } = await supabase
      .from('produtos')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  // EQUIPE
  async getEquipe(): Promise<MembroEquipe[]> {
    const userId = await this.getCurrentUserId();
    const { data, error } = await supabase
      .from('equipe')
      .select('*')
      .eq('clinica_id', userId)
      .order('criado_em', { ascending: false });

    if (error) throw error;
    return data as MembroEquipe[];
  }

  async addMembroEquipe(email: string, permissoes: Record<string, boolean>): Promise<MembroEquipe> {
    const userId = await this.getCurrentUserId();
    
    // Buscar o ID do usuÃ¡rio pelo email na tabela de perfis
    const { data: perfil, error: perfilError } = await supabase
      .from('perfis')
      .select('id, nome')
      .eq('email', email)
      .maybeSingle();
      
    if (perfilError) throw perfilError;
    if (!perfil) throw new Error('Usuário não encontrado. Peça para o funcionário criar uma conta primeiro usando este email.');

    const { data, error } = await supabase
      .from('equipe')
      .insert([{
        clinica_id: userId,
        usuario_id: perfil.id,
        email: email,
        nome: perfil.nome || email.split('@')[0],
        permissoes: permissoes
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new Error('Este usuário já faz parte da equipe.');
      throw error;
    }
    
    return data as MembroEquipe;
  }

  async updateMembroEquipe(id: string, permissoes: Record<string, boolean>): Promise<MembroEquipe> {
    const userId = await this.getCurrentUserId();
    
    const { data, error } = await supabase
      .from('equipe')
      .update({ permissoes })
      .eq('id', id)
      .eq('clinica_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data as MembroEquipe;
  }

  async deleteMembroEquipe(id: string): Promise<boolean> {
    const userId = await this.getCurrentUserId();
    
    const { error } = await supabase
      .from('equipe')
      .delete()
      .eq('id', id)
      .eq('clinica_id', userId);

    if (error) throw error;
    return true;
  }

  // MÃ©todos utilitÃ¡rios
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

  // MigraÃ§Ã£o de dados do localStorage
  async migrateFromLocalStorage(): Promise<void> {
    try {
      console.log('Iniciando migraÃ§Ã£o dos dados do localStorage para Supabase...');
      
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

      // Migrar transaÃ§Ãµes  
      if (localTransacoes.length > 0) {
        for (const transacao of localTransacoes) {
          const { id, criadoEm, atualizadoEm, ...transacaoData } = transacao;
          await this.saveTransacao(transacaoData);
        }
        console.log(`${localTransacoes.length} transaÃ§Ãµes migradas`);
      }

      // Migrar prontuÃ¡rios
      if (localProntuarios.length > 0) {
        for (const prontuario of localProntuarios) {
          const { id, criadoEm, atualizadoEm, ...prontuarioData } = prontuario;
          await this.saveProntuario(prontuarioData);
        }
        console.log(`${localProntuarios.length} prontuÃ¡rios migrados`);
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





