const METADATA_PREFIX = '[NOVOS_LEADS_META]:';

function normalizarTelefone(rawTel) {
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

const FOLLOW_UPS_INICIAIS = [
  { id: 'fu_3h', etapa: '3h', label: '1º Contato (3 horas)', prazoHoras: 3, concluido: false },
  { id: 'fu_15h', etapa: '15h', label: '2º Contato (15 horas)', prazoHoras: 15, concluido: false },
  { id: 'fu_24h', etapa: '24h', label: '3º Contato (24 horas)', prazoHoras: 24, concluido: false },
  { id: 'fu_3d', etapa: '3d', label: '4º Contato (3º dia)', prazoHoras: 72, concluido: false },
  { id: 'fu_4d', etapa: '4d', label: '5º Contato (4º dia)', prazoHoras: 96, concluido: false },
  { id: 'fu_6d', etapa: '6d', label: '6º Contato (6º dia)', prazoHoras: 144, concluido: false },
  { id: 'fu_8d', etapa: '8d', label: '7º Contato (8º dia)', prazoHoras: 192, concluido: false },
  { id: 'fu_15d', etapa: '15d', label: '8º Contato (15º dia)', prazoHoras: 360, concluido: false },
  { id: 'fu_30d', etapa: '30d', label: '9º Contato (30º dia)', prazoHoras: 720, concluido: false },
];

function parseDbLeadParaNovoLead(raw) {
  let meta = {};
  let obsTexto = raw.observacoes || '';

  if (obsTexto && obsTexto.includes(METADATA_PREFIX)) {
    const partes = obsTexto.split(METADATA_PREFIX);
    obsTexto = partes[0].trim();
    try {
      meta = JSON.parse(partes[1]);
    } catch {
      meta = {};
    }
  }

  return {
    id: raw.id || 'lead_simulado_' + Date.now(),
    nome: raw.nome || 'Lead sem nome',
    telefone: normalizarTelefone(raw.telefone),
    email: raw.email || meta.email || null,
    origem: raw.origem || 'Meta Lead Ads',
    campanha: raw.campanha || meta.campanha || null,
    status: raw.status || meta.status || 'Pendente',
    prioridade: raw.prioridade || meta.prioridade || 'media',
    respostas: raw.respostas || meta.respostas || [],
    revisado: raw.revisado ?? meta.revisado ?? false,
    revisado_em: raw.revisado_em || meta.revisado_em || null,
    revisado_por: raw.revisado_por || meta.revisado_por || null,
    data_criacao: raw.data_criacao || new Date().toISOString(),
    observacoes: obsTexto,
    alertas_agendamento: raw.alertas_agendamento || meta.alertas_agendamento || {
      h72: true,
      h48: true,
      h24: true,
      h3: true,
    },
    follow_ups: raw.follow_ups || meta.follow_ups || FOLLOW_UPS_INICIAIS,
    meta_lead_id: raw.meta_lead_id || meta.meta_lead_id || null,
    form_id: raw.form_id || meta.form_id || null,
  };
}

const novosLeadsService = {
  async salvarLead(payload) {
    const metaPayload = {
      respostas: payload.respostas || [],
      prioridade: payload.prioridade || 'media',
      revisado: false,
      revisado_em: null,
      revisado_por: null,
      status: payload.status || 'Pendente',
      meta_lead_id: payload.meta_lead_id || null,
      form_id: payload.form_id || null,
      alertas_agendamento: { h72: true, h48: true, h24: true, h3: true },
      follow_ups: FOLLOW_UPS_INICIAIS,
    };

    const obsTexto = `${payload.observacoes || ''}\n\n${METADATA_PREFIX}${JSON.stringify(metaPayload)}`;

    const dbRow = {
      id: 'lead_test_' + Date.now(),
      nome: payload.nome,
      telefone: normalizarTelefone(payload.telefone),
      email: payload.email,
      origem: payload.origem,
      campanha: payload.campanha,
      status: payload.status || 'Pendente',
      observacoes: obsTexto,
      data_criacao: new Date().toISOString()
    };

    return parseDbLeadParaNovoLead(dbRow);
  }
};

module.exports = {
  novosLeadsService,
  parseDbLeadParaNovoLead,
  normalizarTelefone
};
