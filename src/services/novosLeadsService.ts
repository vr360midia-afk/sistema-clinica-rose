import { supabase } from '@/integrations/supabase/client';
import {
  NovoLead,
  StatusNovoLead,
  PrioridadeNovoLead,
  gerarFollowUpsIniciais,
  FollowUpItem,
  AlertasAgendamento,
  RespostaFormulario,
} from '@/types/novosLeads';

const METADATA_PREFIX = '[NOVOS_LEADS_META]:';

// Helper de normalização de telefone (E.164 ou padrão brasileiro)
export function normalizarTelefone(rawTel?: string | null): string {
  if (!rawTel) return '';
  const digits = rawTel.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('55')) {
    const sem55 = digits.slice(2);
    if (sem55.length === 10) {
      const ddd = sem55.slice(0, 2);
      const num = sem55.slice(2);
      return `+55${ddd}9${num}`;
    }
    return `+${digits}`;
  }

  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const num = digits.slice(2);
    return `+55${ddd}9${num}`;
  }

  if (digits.length === 11) {
    return `+55${digits}`;
  }

  return `+${digits}`;
}

export function formatarTelefoneExibicao(tel?: string | null): string {
  if (!tel) return 'Sem telefone';
  const digits = tel.replace(/\D/g, '');
  if (digits.length === 11) {
    const ddd = digits.slice(0, 2);
    const parte1 = digits.slice(2, 7);
    const parte2 = digits.slice(7);
    return `(${ddd}) ${parte1}-${parte2}`;
  }
  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    const parte1 = digits.slice(4, 9);
    const parte2 = digits.slice(9);
    return `(${ddd}) ${parte1}-${parte2}`;
  }
  return tel;
}

// Mapeia status do banco para o padrão oficial dos Novos Leads
export function mapearStatusParaNovoLead(st?: string | null): StatusNovoLead {
  if (!st) return 'Pendente';
  const s = st.toLowerCase().trim();

  if (s === 'pendente' || s === 'novo_lead' || s === 'novo') return 'Pendente';
  if (s === 'interessado' || s === 'primeiro_contato' || s === '1_contato') return 'Interessado';
  if (s === 'agendado' || s === 'consulta_agendada' || s === 'agendada') return 'Agendado';
  if (
    s === 'comecou mas nao deu andamento' ||
    s === 'comecou_mas_nao_deu_andamento' ||
    s === 'comecou_parou' ||
    s === 'followup_1' ||
    s === 'followup_2' ||
    s.startsWith('fu_')
  ) {
    return 'Começou mas não deu andamento';
  }
  if (s === 'convertido' || s === 'ganho' || s === 'paciente_cadastrado') return 'Convertido';
  if (s === 'perdido' || s === 'desistiu' || s === 'arquivado') return 'Perdido';

  return 'Pendente';
}

// Converte um registro bruto do Supabase crm_leads em objeto tipado NovoLead
export function parseDbLeadParaNovoLead(raw: any): NovoLead {
  let meta: any = {};
  let obsTexto = raw.observacoes || '';

  // Se o campo observações contém o bloco de metadados serializado
  if (obsTexto && obsTexto.includes(METADATA_PREFIX)) {
    const partes = obsTexto.split(METADATA_PREFIX);
    obsTexto = partes[0].trim();
    try {
      meta = JSON.parse(partes[1]);
    } catch {
      meta = {};
    }
  }

  // Respostas de formulário
  let respostas: RespostaFormulario[] = [];
  if (Array.isArray(raw.respostas) && raw.respostas.length > 0) {
    respostas = raw.respostas;
  } else if (Array.isArray(meta.respostas) && meta.respostas.length > 0) {
    respostas = meta.respostas;
  }

  // Prioridade
  const prioridade: PrioridadeNovoLead =
    raw.prioridade || meta.prioridade || 'media';

  // Revisado
  const revisado: boolean =
    typeof raw.revisado === 'boolean'
      ? raw.revisado
      : typeof meta.revisado === 'boolean'
      ? meta.revisado
      : false;

  // Status mapeado
  const status: StatusNovoLead = mapearStatusParaNovoLead(
    raw.status || raw.stage || meta.status
  );

  // Follow-ups
  let follow_ups: FollowUpItem[] = [];
  if (Array.isArray(raw.follow_ups) && raw.follow_ups.length > 0) {
    follow_ups = raw.follow_ups;
  } else if (Array.isArray(meta.follow_ups) && meta.follow_ups.length > 0) {
    follow_ups = meta.follow_ups;
  } else {
    follow_ups = gerarFollowUpsIniciais();
  }

  // Alertas de agendamento padrão
  const alertas_agendamento: AlertasAgendamento =
    raw.alertas_agendamento ||
    meta.alertas_agendamento || {
      h72: true,
      h48: true,
      h24: true,
      h3: true,
    };

  return {
    id: raw.id,
    nome: raw.nome || raw.name || 'Lead sem nome',
    telefone: raw.telefone || raw.phone || '',
    email: raw.email || meta.email || null,
    origem: raw.origem || raw.origin || 'Meta Lead Ads',
    campanha: raw.campanha || meta.campanha || null,
    status,
    prioridade,
    respostas,
    revisado,
    revisado_em: raw.revisado_em || meta.revisado_em || null,
    revisado_por: raw.revisado_por || meta.revisado_por || null,
    data_criacao: raw.data_criacao || raw.created_at || new Date().toISOString(),
    data_atualizacao: raw.data_atualizacao || raw.updated_at || null,
    observacoes: obsTexto,
    valor_estimado: raw.valor_estimado ? Number(raw.valor_estimado) : null,
    valor_venda: raw.valor_venda ? Number(raw.valor_venda) : meta.valor_venda ? Number(meta.valor_venda) : null,
    motivo_perda: raw.motivo_perda || meta.motivo_perda || null,
    arquivado: raw.arquivado ?? meta.arquivado ?? (status === 'Perdido'),
    agendado_para: raw.agendado_para || meta.agendado_para || null,
    alertas_agendamento,
    follow_ups,
    meta_lead_id: raw.meta_lead_id || meta.meta_lead_id || null,
    form_id: raw.form_id || meta.form_id || null,
    ad_id: raw.ad_id || meta.ad_id || null,
    paciente_id: raw.paciente_id || meta.paciente_id || null,
  };
}

// Serializa metadados para persistência resiliente em crm_leads
export function serializarObservacoesComMeta(
  observacoesTexto: string = '',
  meta: Record<string, any>
): string {
  const limpo = (observacoesTexto || '').split(METADATA_PREFIX)[0].trim();
  return `${limpo ? limpo + '\n\n' : ''}${METADATA_PREFIX}${JSON.stringify(meta)}`;
}

export const novosLeadsService = {
  // Buscar todos os leads da caixa de entrada
  async listarLeads(): Promise<NovoLead[]> {
    try {
      const { data, error } = await supabase
        .from('crm_leads')
        .select('*')
        .order('data_criacao', { ascending: false });

      if (error) {
        // Tenta ordenar por created_at se data_criacao não existir
        const fallback = await supabase
          .from('crm_leads')
          .select('*')
          .order('created_at', { ascending: false });
        if (fallback.error) throw fallback.error;
        return (fallback.data || []).map(parseDbLeadParaNovoLead);
      }

      return (data || []).map(parseDbLeadParaNovoLead);
    } catch (err) {
      console.error('[NovosLeadsService] Erro ao listar leads:', err);
      throw err;
    }
  },

  // Contagem de leads não revisados para o contador do menu
  async contarNaoRevisados(): Promise<number> {
    try {
      const leads = await this.listarLeads();
      return leads.filter((l) => !l.revisado && l.status !== 'Perdido' && !l.arquivado).length;
    } catch {
      return 0;
    }
  },

  // Criar ou atualizar lead garantindo sem duplicações por meta_lead_id e telefone
  async salvarLead(leadData: Partial<NovoLead>): Promise<NovoLead> {
    const telNormalizado = normalizarTelefone(leadData.telefone);

    // 1. Checa duplicação por meta_lead_id
    if (leadData.meta_lead_id) {
      const { data: existenteMeta } = await supabase
        .from('crm_leads')
        .select('*')
        .eq('meta_lead_id', leadData.meta_lead_id)
        .maybeSingle();

      if (existenteMeta) {
        console.log(`[NovosLeadsService] Lead com meta_lead_id ${leadData.meta_lead_id} já existe. Atualizando.`);
        return this.atualizarLead(existenteMeta.id, leadData);
      }
    }

    // 2. Checa lead existente pelo telefone (últimos 8 dígitos)
    if (telNormalizado && telNormalizado.length >= 8) {
      const sufixo = telNormalizado.replace(/\D/g, '').slice(-8);
      const { data: todos } = await supabase
        .from('crm_leads')
        .select('*')
        .limit(200);

      const existenteTel = (todos || []).find((l: any) => {
        const dig = (l.telefone || l.phone || '').replace(/\D/g, '');
        return dig.endsWith(sufixo);
      });

      if (existenteTel && !leadData.id) {
        // Se já existe um lead com esse telefone, preserva o status e apenas anexa os novos dados/respostas
        const leadConvertido = parseDbLeadParaNovoLead(existenteTel);
        const respostasCombinadas = [
          ...(leadConvertido.respostas || []),
          ...(leadData.respostas || []),
        ];

        return this.atualizarLead(existenteTel.id, {
          respostas: respostasCombinadas,
          campanha: leadData.campanha || leadConvertido.campanha,
          observacoes: leadData.observacoes
            ? `${leadConvertido.observacoes || ''}\n[Novo Formulário]: ${leadData.observacoes}`
            : leadConvertido.observacoes,
        });
      }
    }

    // Monta o payload para salvar
    const metaPayload = {
      respostas: leadData.respostas || [],
      prioridade: leadData.prioridade || 'media',
      revisado: leadData.revisado ?? false,
      revisado_em: leadData.revisado_em || null,
      revisado_por: leadData.revisado_por || null,
      valor_venda: leadData.valor_venda || null,
      motivo_perda: leadData.motivo_perda || null,
      arquivado: leadData.arquivado ?? false,
      agendado_para: leadData.agendado_para || null,
      alertas_agendamento: leadData.alertas_agendamento || {
        h72: true,
        h48: true,
        h24: true,
        h3: true,
      },
      follow_ups: leadData.follow_ups || gerarFollowUpsIniciais(),
      meta_lead_id: leadData.meta_lead_id || null,
      form_id: leadData.form_id || null,
      ad_id: leadData.ad_id || null,
      paciente_id: leadData.paciente_id || null,
    };

    const obsFinal = serializarObservacoesComMeta(
      leadData.observacoes || '',
      metaPayload
    );

    const dbRow: any = {
      nome: leadData.nome || 'Lead sem nome',
      telefone: telNormalizado || leadData.telefone || null,
      email: leadData.email || null,
      origem: leadData.origem || 'Meta Lead Ads',
      campanha: leadData.campanha || null,
      status: leadData.status || 'Pendente',
      valor_estimado: leadData.valor_estimado || null,
      observacoes: obsFinal,
    };

    // Tenta gravar com campos nativos caso existam
    try {
      const { data, error } = await supabase
        .from('crm_leads')
        .insert([
          {
            ...dbRow,
            respostas: metaPayload.respostas,
            prioridade: metaPayload.prioridade,
            revisado: metaPayload.revisado,
            meta_lead_id: metaPayload.meta_lead_id,
            form_id: metaPayload.form_id,
            ad_id: metaPayload.ad_id,
            valor_venda: metaPayload.valor_venda,
            motivo_perda: metaPayload.motivo_perda,
            agendado_para: metaPayload.agendado_para,
            alertas_agendamento: metaPayload.alertas_agendamento,
            follow_ups: metaPayload.follow_ups,
          },
        ])
        .select()
        .single();

      if (!error && data) {
        return parseDbLeadParaNovoLead(data);
      }
    } catch {
      // Fallback para inserir apenas campos padrão
    }

    const { data: fallbackData, error: errFallback } = await supabase
      .from('crm_leads')
      .insert([dbRow])
      .select()
      .single();

    if (errFallback) throw errFallback;
    return parseDbLeadParaNovoLead(fallbackData);
  },

  // Atualizar dados de um lead
  async atualizarLead(id: string, updates: Partial<NovoLead>): Promise<NovoLead> {
    // 1. Busca registro atual para mesclar metadados
    const { data: atual } = await supabase
      .from('crm_leads')
      .select('*')
      .eq('id', id)
      .single();

    const leadAtual = parseDbLeadParaNovoLead(atual || { id });

    const leadMesclado: NovoLead = {
      ...leadAtual,
      ...updates,
      id,
    };

    const metaPayload = {
      respostas: leadMesclado.respostas,
      prioridade: leadMesclado.prioridade,
      revisado: leadMesclado.revisado,
      revisado_em: leadMesclado.revisado_em,
      revisado_por: leadMesclado.revisado_por,
      valor_venda: leadMesclado.valor_venda,
      motivo_perda: leadMesclado.motivo_perda,
      arquivado: leadMesclado.arquivado,
      agendado_para: leadMesclado.agendado_para,
      alertas_agendamento: leadMesclado.alertas_agendamento,
      follow_ups: leadMesclado.follow_ups,
      meta_lead_id: leadMesclado.meta_lead_id,
      form_id: leadMesclado.form_id,
      ad_id: leadMesclado.ad_id,
      paciente_id: leadMesclado.paciente_id,
    };

    const obsFinal = serializarObservacoesComMeta(
      leadMesclado.observacoes || '',
      metaPayload
    );

    const dbRow: any = {
      nome: leadMesclado.nome,
      telefone: normalizarTelefone(leadMesclado.telefone) || leadMesclado.telefone,
      email: leadMesclado.email,
      origem: leadMesclado.origem,
      campanha: leadMesclado.campanha,
      status: leadMesclado.status,
      valor_estimado: leadMesclado.valor_estimado,
      observacoes: obsFinal,
    };

    // Tenta atualizar com campos nativos estendidos
    try {
      const { data, error } = await supabase
        .from('crm_leads')
        .update({
          ...dbRow,
          respostas: metaPayload.respostas,
          prioridade: metaPayload.prioridade,
          revisado: metaPayload.revisado,
          revisado_em: metaPayload.revisado_em,
          revisado_por: metaPayload.revisado_por,
          valor_venda: metaPayload.valor_venda,
          motivo_perda: metaPayload.motivo_perda,
          arquivado: metaPayload.arquivado,
          agendado_para: metaPayload.agendado_para,
          alertas_agendamento: metaPayload.alertas_agendamento,
          follow_ups: metaPayload.follow_ups,
        })
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        return parseDbLeadParaNovoLead(data);
      }
    } catch {
      // Fallback
    }

    const { data: fallbackData, error: errFallback } = await supabase
      .from('crm_leads')
      .update(dbRow)
      .eq('id', id)
      .select()
      .single();

    if (errFallback) throw errFallback;
    return parseDbLeadParaNovoLead(fallbackData);
  },

  // Marcar como revisado
  async marcarComoRevisado(id: string, usuarioNome: string = 'Equipe Clínica'): Promise<NovoLead> {
    return this.atualizarLead(id, {
      revisado: true,
      revisado_em: new Date().toISOString(),
      revisado_por: usuarioNome,
    });
  },

  // Atualizar status com regras específicas
  async mudarStatus(
    id: string,
    novoStatus: StatusNovoLead,
    dadosExtras?: {
      agendado_para?: string;
      alertas_agendamento?: AlertasAgendamento;
      valor_venda?: number;
      motivo_perda?: string;
    }
  ): Promise<NovoLead> {
    const updates: Partial<NovoLead> = {
      status: novoStatus,
    };

    if (novoStatus === 'Agendado' && dadosExtras?.agendado_para) {
      updates.agendado_para = dadosExtras.agendado_para;
      if (dadosExtras.alertas_agendamento) {
        updates.alertas_agendamento = dadosExtras.alertas_agendamento;
      }
    }

    if (novoStatus === 'Convertido' && dadosExtras?.valor_venda !== undefined) {
      updates.valor_venda = dadosExtras.valor_venda;
    }

    if (novoStatus === 'Perdido') {
      if (dadosExtras?.motivo_perda) {
        updates.motivo_perda = dadosExtras.motivo_perda;
      }
      updates.arquivado = true;
    }

    return this.atualizarLead(id, updates);
  },

  // Registrar contato na régua de follow-up
  async registrarFollowUp(
    leadId: string,
    etapa: FollowUpItem['etapa'],
    contato: {
      canal: FollowUpItem['canal'];
      observacao?: string;
      data_contato?: string;
    }
  ): Promise<NovoLead> {
    const { data: leadDb } = await supabase
      .from('crm_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    const lead = parseDbLeadParaNovoLead(leadDb);
    const agora = contato.data_contato || new Date().toISOString();

    const followUpsAtualizados = lead.follow_ups.map((item) => {
      if (item.etapa === etapa) {
        return {
          ...item,
          concluido: true,
          data_contato: agora,
          canal: contato.canal,
          observacao: contato.observacao || item.observacao,
        };
      }
      return item;
    });

    return this.atualizarLead(leadId, {
      follow_ups: followUpsAtualizados,
      // Se estava Pendente e foi feito contato, avança para Interessado
      status: lead.status === 'Pendente' ? 'Interessado' : lead.status,
    });
  },

  // Converter lead em Paciente sem duplicar prontuário
  async converterEmPaciente({
    lead,
    clinicaId,
    userId,
    dadosPaciente,
  }: {
    lead: NovoLead;
    clinicaId?: string | null;
    userId?: string | null;
    dadosPaciente: {
      nome: string;
      telefone: string;
      cpf?: string;
      email?: string;
      nascimento?: string;
      convenio?: string;
      observacoes?: string;
    };
  }): Promise<{ paciente: any; lead: NovoLead }> {
    const telLimpo = dadosPaciente.telefone.replace(/\D/g, '');

    // 1. Verifica se já existe paciente com este telefone (últimos 8 dígitos) ou CPF
    let query = supabase.from('pacientes').select('*');
    if (dadosPaciente.cpf) {
      const cpfLimpo = dadosPaciente.cpf.replace(/\D/g, '');
      const { data: comCpf } = await supabase
        .from('pacientes')
        .select('*')
        .eq('cpf', cpfLimpo)
        .maybeSingle();

      if (comCpf) {
        throw new Error(
          `Já existe um paciente cadastrado com este CPF (${comCpf.nome}, prontuário #${comCpf.id.slice(0, 6)}).`
        );
      }
    }

    if (telLimpo.length >= 8) {
      const sufixo = telLimpo.slice(-8);
      const { data: pacientes } = await supabase.from('pacientes').select('*').limit(300);
      const existente = (pacientes || []).find((p: any) => {
        const pTel = (p.telefone || '').replace(/\D/g, '');
        return pTel.endsWith(sufixo);
      });

      if (existente) {
        throw new Error(
          `Já existe um paciente cadastrado com este telefone (${existente.nome}). Você pode vincular este lead ao prontuário existente.`
        );
      }
    }

    // 2. Insere novo paciente
    const { data: novoPaciente, error: errPaciente } = await supabase
      .from('pacientes')
      .insert([
        {
          user_id: clinicaId || userId,
          nome: dadosPaciente.nome,
          telefone: dadosPaciente.telefone,
          cpf: dadosPaciente.cpf || null,
          email: dadosPaciente.email || null,
          data_nascimento: dadosPaciente.nascimento || null,
          convenio: dadosPaciente.convenio || 'Particular',
          status: 'ativo',
          origem_lead: lead.origem || 'Meta Lead Ads',
          observacoes:
            dadosPaciente.observacoes ||
            `Convertido via Módulo Novos Leads. Origem: ${lead.origem}. Campanha: ${lead.campanha || 'Meta Ads'}.`,
        },
      ])
      .select()
      .single();

    if (errPaciente || !novoPaciente) {
      throw errPaciente || new Error('Falha ao cadastrar novo paciente.');
    }

    // 3. Atualiza o lead com o vínculo do paciente, status Convertido e marca como revisado
    const leadAtualizado = await this.atualizarLead(lead.id, {
      status: 'Convertido',
      revisado: true,
      revisado_em: new Date().toISOString(),
      paciente_id: novoPaciente.id,
    });

    return {
      paciente: novoPaciente,
      lead: leadAtualizado,
    };
  },

  // Vincular a paciente já existente
  async vincularPacienteExistente(leadId: string, pacienteId: string): Promise<NovoLead> {
    return this.atualizarLead(leadId, {
      status: 'Convertido',
      revisado: true,
      revisado_em: new Date().toISOString(),
      paciente_id: pacienteId,
    });
  },
};
