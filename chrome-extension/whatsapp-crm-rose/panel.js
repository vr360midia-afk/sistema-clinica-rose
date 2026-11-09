// ==============================================================================
// Clínica Rosângela — Extensão WhatsApp Web CRM & Agenda (V2.0)
// Painel Lateral (SidePanel) Oficial
// ==============================================================================

const CONFIG = {
  // Ambiente padrão: 'homolog' durante desenvolvimento e homologação; 'production' para produção.
  DEFAULT_ENV: 'homolog',
  environments: {
    homolog: {
      url: 'https://fsroaymkuopapwlnknhl.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzcm9heW1rdW9wYXB3bG5rbmhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MDA0NzMsImV4cCI6MjEwNzA3NjQ3M30.QV06zSi8oKTBz2s4x6oyHCWf_i0o8Gdu-obiE7SBOWA',
      name: 'Homologação'
    },
    production: {
      url: 'https://skonxcdojbkbfnfemayz.supabase.co',
      anonKey: 'sb_publishable_aldVR3R-4sj0Fs-l1-mFSA_9gPUF9YZ',
      name: 'Produção Oficial'
    }
  }
};

// Estado global da extensão
const state = {
  env: CONFIG.DEFAULT_ENV,
  session: null,        // { access_token, refresh_token, expires_at, user }
  clinicaId: null,     // UUID da clínica (equipe.clinica_id ou user.id)
  permissions: {
    pacientes: true,
    agenda: true,
    crm: true
  },
  currentPhone: '',
  currentLead: null,
  currentPatient: null,
  dentists: [],
  activeTab: 'tab-overview'
};

// Obtenção da configuração ativa (com suporte a override de ambiente para testes)
async function getActiveConfig() {
  try {
    const stored = await storageGet(['app_env_override']);
    const envKey = stored?.app_env_override || state.env || CONFIG.DEFAULT_ENV;
    return CONFIG.environments[envKey] || CONFIG.environments.homolog;
  } catch {
    return CONFIG.environments.homolog;
  }
}

// ==============================================================================
// 1. UTILITÁRIOS DE STORAGE (Sessão Segura)
// ==============================================================================

function storageGet(keys) {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
      chrome.storage.session.get(keys, (res) => {
        if (!chrome.runtime.lastError && res && Object.keys(res).length > 0) {
          return resolve(res);
        }
        // Fallback para local
        chrome.storage.local.get(keys, resolve);
      });
    } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(keys, resolve);
    } else {
      // Fallback para sessionStorage do navegador
      const res = {};
      const keyArr = Array.isArray(keys) ? keys : [keys];
      for (const k of keyArr) {
        try {
          const val = sessionStorage.getItem(k) || localStorage.getItem(k);
          if (val) res[k] = JSON.parse(val);
        } catch {}
      }
      resolve(res);
    }
  });
}

function storageSet(items) {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
      chrome.storage.session.set(items, () => {
        // Salva cópia de backup do token em local para sobrevivência a fechamento de aba
        if (chrome.storage.local) {
          chrome.storage.local.set(items, resolve);
        } else {
          resolve();
        }
      });
    } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(items, resolve);
    } else {
      for (const [k, v] of Object.entries(items)) {
        try {
          sessionStorage.setItem(k, JSON.stringify(v));
          localStorage.setItem(k, JSON.stringify(v));
        } catch {}
      }
      resolve();
    }
  });
}

function storageRemove(keys) {
  return new Promise((resolve) => {
    const keyArr = Array.isArray(keys) ? keys : [keys];
    if (typeof chrome !== 'undefined' && chrome.storage) {
      if (chrome.storage.session) chrome.storage.session.remove(keyArr);
      if (chrome.storage.local) chrome.storage.local.remove(keyArr, resolve);
      else resolve();
    } else {
      for (const k of keyArr) {
        sessionStorage.removeItem(k);
        localStorage.removeItem(k);
      }
      resolve();
    }
  });
}

// ==============================================================================
// 2. CLIENTE REST E AUTENTICAÇÃO SUPABASE
// ==============================================================================

async function authFetch(endpoint, options = {}) {
  const cfg = await getActiveConfig();
  const url = `${cfg.url}${endpoint}`;
  const headers = new Headers(options.headers || {});

  headers.set('apikey', cfg.anonKey);
  headers.set('Content-Type', 'application/json');

  if (state.session?.access_token) {
    headers.set('Authorization', `Bearer ${state.session.access_token}`);
  }

  let response = await fetch(url, { ...options, headers });

  // Se o token estiver expirado (401), tenta renovar silenciosamente
  if (response.status === 401 && state.session?.refresh_token) {
    console.warn('[CRM Extension] Token expirado (401). Renovando sessão...');
    const refreshed = await refreshToken();
    if (refreshed) {
      headers.set('Authorization', `Bearer ${state.session.access_token}`);
      response = await fetch(url, { ...options, headers });
    } else {
      await logout();
      throw new Error('Sessão expirada. Por favor, faça login novamente.');
    }
  }

  return response;
}

async function login(email, password) {
  const cfg = await getActiveConfig();
  const url = `${cfg.url}/auth/v1/token?grant_type=password`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': cfg.anonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: email.trim(), password })
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data.error_description || data.msg || data.message || 'Falha ao autenticar no sistema.';
    throw new Error(msg);
  }

  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in * 1000),
    user: data.user
  };

  state.session = session;
  await storageSet({ rose_crm_session: session });

  await resolveUserPermissions();
  return session;
}

async function refreshToken() {
  if (!state.session?.refresh_token) return false;
  try {
    const cfg = await getActiveConfig();
    const url = `${cfg.url}/auth/v1/token?grant_type=refresh_token`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': cfg.anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refresh_token: state.session.refresh_token })
    });

    if (!res.ok) return false;

    const data = await res.json();
    state.session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in * 1000),
      user: data.user || state.session.user
    };

    await storageSet({ rose_crm_session: state.session });
    return true;
  } catch (err) {
    console.error('[CRM Extension] Falha ao renovar token:', err);
    return false;
  }
}

async function logout() {
  try {
    if (state.session?.access_token) {
      const cfg = await getActiveConfig();
      await fetch(`${cfg.url}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          'apikey': cfg.anonKey,
          'Authorization': `Bearer ${state.session.access_token}`
        }
      }).catch(() => {});
    }
  } finally {
    state.session = null;
    state.clinicaId = null;
    state.currentLead = null;
    state.currentPatient = null;
    await storageRemove(['rose_crm_session']);
    renderUI();
  }
}

// Resolução de Multi-tenancy e Permissões via tabela 'equipe'
async function resolveUserPermissions() {
  if (!state.session?.user) return;
  const userId = state.session.user.id;

  try {
    const res = await authFetch(`/rest/v1/equipe?usuario_id=eq.${userId}&select=*`);
    if (res.ok) {
      const records = await res.json();
      if (records && records.length > 0) {
        const eq = records[0];
        state.clinicaId = eq.clinica_id || userId;
        state.permissions = eq.permissoes || { pacientes: true, agenda: true, crm: true };
      } else {
        // Usuário é o titular da clínica / admin principal
        state.clinicaId = userId;
        state.permissions = { pacientes: true, agenda: true, crm: true };
      }
    } else {
      state.clinicaId = userId;
      state.permissions = { pacientes: true, agenda: true, crm: true };
    }
  } catch (e) {
    console.warn('[CRM Extension] Falha ao consultar equipe:', e);
    state.clinicaId = userId;
    state.permissions = { pacientes: true, agenda: true, crm: true };
  }
}

// ==============================================================================
// 3. UTILITÁRIOS DE TELEFONE E FORMATAÇÃO
// ==============================================================================

function normalizePhone(raw) {
  if (!raw) return '';
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';

  // Remove zero à esquerda do DDD caso exista (ex: 082 -> 82)
  if (digits.startsWith('0') && digits.length >= 11) {
    digits = digits.substring(1);
  }

  // Se não tem DDI 55 e tem DDD + número (10 ou 11 dígitos)
  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits;
  }

  return '+' + digits;
}

function formatPhoneDisplay(phone) {
  if (!phone) return '-';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 13) {
    // +55 (82) 99999-9999
    return `+${clean.slice(0,2)} (${clean.slice(2,4)}) ${clean.slice(4,9)}-${clean.slice(9)}`;
  }
  if (clean.length === 12) {
    // +55 (82) 9999-9999
    return `+${clean.slice(0,2)} (${clean.slice(2,4)}) ${clean.slice(4,8)}-${clean.slice(8)}`;
  }
  return phone;
}

function parseMetaAds(observacoes) {
  if (!observacoes) return null;
  const match = observacoes.match(/\[NOVOS_LEADS_META\]:\s*(\{.*\})/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

// ==============================================================================
// 4. CONSULTA UNIFICADA AO CRM E PACIENTES (TELEFONE OU NOME)
// ==============================================================================

let searchSequence = 0;

function clearContactState() {
  state.currentPatient = null;
  state.currentLead = null;
  state.currentPhone = '';

  const card = document.getElementById('contact-card');
  if (card) card.hidden = true;

  const phoneDisplay = document.getElementById('input-search-phone');
  if (phoneDisplay) phoneDisplay.value = '';

  const formName = document.getElementById('patient-name');
  if (formName) formName.value = '';

  const formEmail = document.getElementById('patient-email');
  if (formEmail) formEmail.value = '';

  const formNotes = document.getElementById('patient-notes');
  if (formNotes) formNotes.value = '';

  renderAppointmentsList([]);
  renderFollowUpTimeline();
}

async function searchContact(queryInput, prefilledName = '') {
  const query = (queryInput || '').trim();
  if (!query) {
    showAppAlert('Informe um número de telefone ou nome do contato.', 'error');
    return;
  }

  // Se a busca contiver letras e não for puramente dígitos de telefone, busca por nome
  const hasLetters = /[a-zA-ZÀ-ÿ]/.test(query);
  const digits = query.replace(/\D/g, '');
  if (hasLetters && digits.length < 8) {
    return searchContactByName(query);
  }

  const normalized = normalizePhone(query);
  if (!normalized) {
    showAppAlert('Informe um telefone válido (ex: 82 99999-9999 ou +5582999999999) ou pesquise pelo nome.', 'error');
    return;
  }

  const currentSeq = ++searchSequence;
  state.currentPhone = normalized;
  const phoneDisplay = document.getElementById('input-search-phone');
  if (phoneDisplay) phoneDisplay.value = formatPhoneDisplay(normalized);

  showAppAlert('Buscando telefone no CRM...', 'info');

  try {
    const rawDigits = normalized.replace(/\D/g, '');
    const last8 = rawDigits.slice(-8);
    const last4 = rawDigits.slice(-4);
    const mid4 = rawDigits.slice(-8, -4);
    const formattedSuffix = `${mid4}-${last4}`;

    // 1. Busca em crm_leads (por telefone exato, dígitos contínuos ou formato hifenizado)
    const leadQuery = `/rest/v1/crm_leads?or=(telefone.eq.${encodeURIComponent(normalized)},phone.eq.${encodeURIComponent(normalized)},telefone.ilike.*${last8}*,telefone.ilike.*${formattedSuffix}*,phone.ilike.*${formattedSuffix}*)&order=data_criacao.desc&limit=1`;
    const leadRes = await authFetch(leadQuery);
    if (currentSeq !== searchSequence) return;
    const leads = leadRes.ok ? await leadRes.json() : [];
    state.currentLead = leads.length > 0 ? leads[0] : null;

    // 2. Busca em pacientes (por telefone exato, dígitos contínuos ou formato hifenizado)
    const pacQuery = `/rest/v1/pacientes?or=(telefone.eq.${encodeURIComponent(normalized)},telefone.ilike.*${last8}*,telefone.ilike.*${formattedSuffix}*)&order=criado_em.desc&limit=1`;
    const pacRes = await authFetch(pacQuery);
    if (currentSeq !== searchSequence) return;
    const pacs = pacRes.ok ? await pacRes.json() : [];
    state.currentPatient = pacs.length > 0 ? pacs[0] : null;

    // Se não encontrou paciente/lead mas foi fornecido um nome vindo da conversa ativa
    if (!state.currentPatient && !state.currentLead && prefilledName) {
      const formName = document.getElementById('patient-name');
      if (formName) formName.value = prefilledName;
    }

    renderContactCard();
    hideAppAlert();

    // Carrega consultas caso o paciente exista
    if (state.currentPatient?.id) {
      await loadPatientAppointments(state.currentPatient.id);
    } else {
      renderAppointmentsList([]);
    }

    renderFollowUpTimeline();
  } catch (err) {
    if (currentSeq !== searchSequence) return;
    console.error('[CRM Extension] Erro ao buscar contato:', err);
    showAppAlert('Erro ao consultar contato: ' + err.message, 'error');
  }
}

async function searchContactByName(nameInput) {
  const name = (nameInput || '').trim();
  if (!name || name.length < 2) {
    showAppAlert('Informe um nome com pelo menos 2 caracteres.', 'error');
    return;
  }

  const currentSeq = ++searchSequence;
  showAppAlert(`Buscando "${name}" no CRM...`, 'info');

  try {
    // 1. Busca em pacientes por nome
    const pacQuery = `/rest/v1/pacientes?nome=ilike.*${encodeURIComponent(name)}*&order=criado_em.desc&limit=1`;
    const pacRes = await authFetch(pacQuery);
    if (currentSeq !== searchSequence) return;
    const pacs = pacRes.ok ? await pacRes.json() : [];
    state.currentPatient = pacs.length > 0 ? pacs[0] : null;

    // 2. Busca em crm_leads por nome
    const leadQuery = `/rest/v1/crm_leads?or=(nome.ilike.*${encodeURIComponent(name)}*,name.ilike.*${encodeURIComponent(name)}*)&order=data_criacao.desc&limit=1`;
    const leadRes = await authFetch(leadQuery);
    if (currentSeq !== searchSequence) return;
    const leads = leadRes.ok ? await leadRes.json() : [];
    state.currentLead = leads.length > 0 ? leads[0] : null;

    // Se encontrou contato no banco, aproveita o telefone cadastrado
    const savedPhone = state.currentPatient?.telefone || state.currentLead?.telefone || state.currentLead?.phone || '';
    if (savedPhone) {
      state.currentPhone = normalizePhone(savedPhone) || savedPhone;
      const phoneDisplay = document.getElementById('input-search-phone');
      if (phoneDisplay) phoneDisplay.value = formatPhoneDisplay(state.currentPhone);
    } else {
      state.currentPhone = '';
    }

    // Se é novo contato, preenche o campo de nome no formulário
    if (!state.currentPatient && !state.currentLead) {
      const formName = document.getElementById('patient-name');
      if (formName) formName.value = name;
    }

    renderContactCard();
    hideAppAlert();

    if (state.currentPatient?.id) {
      await loadPatientAppointments(state.currentPatient.id);
    } else {
      renderAppointmentsList([]);
    }

    renderFollowUpTimeline();
  } catch (err) {
    if (currentSeq !== searchSequence) return;
    console.error('[CRM Extension] Erro ao buscar por nome:', err);
    showAppAlert('Erro ao consultar contato por nome: ' + err.message, 'error');
  }
}

async function handleContactChanged(contact) {
  if (!contact) return;
  const rawName = (contact.name || '').trim();
  const rawPhone = (contact.phone || '').trim();

  // Se ambos vazios, a conversa foi fechada
  if (!rawName && !rawPhone) {
    clearContactState();
    return;
  }

  // Preenche campo de busca e de nome
  const phoneDisplay = document.getElementById('input-search-phone');
  if (phoneDisplay) {
    phoneDisplay.value = rawPhone ? formatPhoneDisplay(rawPhone) : rawName;
  }

  const formName = document.getElementById('patient-name');
  if (rawName && formName) {
    formName.value = rawName;
  }

  // Se o telefone foi detectado diretamente
  if (rawPhone) {
    await searchContact(rawPhone, rawName);
  } else if (rawName) {
    // Contato salvo com nome no WhatsApp
    await searchContactByName(rawName);
  }
}

function renderContactCard() {
  const card = document.getElementById('contact-card');
  const nameEl = document.getElementById('contact-name-display');
  const phoneEl = document.getElementById('contact-phone-display');
  const stageBadge = document.getElementById('contact-stage-badge');
  const metaDisplay = document.getElementById('contact-meta-display');
  const originTag = document.getElementById('contact-origin-tag');
  const campaignTag = document.getElementById('contact-campaign-tag');

  // Campos do formulário
  const formName = document.getElementById('patient-name');
  const formEmail = document.getElementById('patient-email');
  const formStage = document.getElementById('lead-stage-select');
  const formNotes = document.getElementById('patient-notes');
  const lostReasonGroup = document.getElementById('lost-reason-group');

  if (!state.currentLead && !state.currentPatient) {
    // Contato não cadastrado
    card.hidden = false;
    const pendingName = formName?.value?.trim() || 'Novo Contato (Não cadastrado)';
    nameEl.textContent = pendingName;
    nameEl.style.color = pendingName !== 'Novo Contato (Não cadastrado)' ? '#0f172a' : 'var(--text-muted)';
    phoneEl.textContent = state.currentPhone ? formatPhoneDisplay(state.currentPhone) : 'Telefone não detectado';
    stageBadge.className = 'badge badge-pendente';
    stageBadge.textContent = 'Não cadastrado';
    metaDisplay.hidden = true;

    // Inicializa formulário
    if (formEmail) formEmail.value = '';
    if (formStage) formStage.value = 'Pendente';
    if (formNotes) formNotes.value = '';
    if (lostReasonGroup) lostReasonGroup.hidden = true;
    return;
  }

  card.hidden = false;
  const name = state.currentPatient?.nome || state.currentLead?.nome || state.currentLead?.name || 'Sem nome';
  const stage = state.currentLead?.status || state.currentLead?.stage || 'Pendente';

  nameEl.textContent = name;
  nameEl.style.color = '#0f172a';
  phoneEl.textContent = formatPhoneDisplay(state.currentPhone);

  // Badge de estágio
  const stageClassMap = {
    'Pendente': 'badge-pendente',
    'Interessado': 'badge-interessado',
    'Começou mas não deu andamento': 'badge-andamento',
    'Agendado': 'badge-agendado',
    'Convertido': 'badge-convertido',
    'Perdido': 'badge-perdido'
  };
  stageBadge.className = `badge ${stageClassMap[stage] || 'badge-pendente'}`;
  stageBadge.textContent = stage;

  // Metadados do Meta Ads
  const meta = parseMetaAds(state.currentLead?.observacoes);
  if (meta || state.currentLead?.origem || state.currentLead?.campanha) {
    metaDisplay.hidden = false;
    const origem = state.currentLead?.origem || 'WhatsApp';
    const campanha = meta?.campanha || state.currentLead?.campanha || '';
    const criativo = meta?.criativo || '';

    let tagText = `Origem: ${origem}`;
    if (campanha) tagText += ` • ${campanha}`;
    originTag.textContent = tagText;

    if (criativo) {
      campaignTag.textContent = `Criativo: ${criativo}`;
      campaignTag.hidden = false;
    } else {
      campaignTag.hidden = true;
    }
  } else {
    metaDisplay.hidden = true;
  }

  // Preenche formulário de Visão Geral
  if (formName) formName.value = name !== 'Sem nome' ? name : '';
  if (formEmail) formEmail.value = state.currentPatient?.email || state.currentLead?.email || '';
  if (formStage) formStage.value = stageClassMap[stage] ? stage : 'Pendente';

  // Observações (limpa bloco interno [NOVOS_LEADS_META] para edição amigável pelo usuário)
  if (formNotes) {
    const rawObs = state.currentLead?.observacoes || state.currentPatient?.observacoes || '';
    const cleanObs = rawObs.replace(/\[NOVOS_LEADS_META\]:\s*\{.*?\}/gs, '').trim();
    formNotes.value = cleanObs;
  }

  if (lostReasonGroup) {
    lostReasonGroup.hidden = (stage !== 'Perdido');
  }
}

// ==============================================================================
// 5. CADASTRO / ATUALIZAÇÃO NO CRM & PACIENTES
// ==============================================================================

async function savePatientAndLead() {
  const nameInput = document.getElementById('patient-name');
  const emailInput = document.getElementById('patient-email');
  const stageSelect = document.getElementById('lead-stage-select');
  const notesInput = document.getElementById('patient-notes');
  const lostReasonInput = document.getElementById('lost-reason-input');

  const name = nameInput?.value?.trim();
  const email = emailInput?.value?.trim() || null;
  const stage = stageSelect?.value || 'Pendente';
  let notes = notesInput?.value?.trim() || '';
  const lostReason = lostReasonInput?.value?.trim();

  if (!name) {
    showAppAlert('O nome do paciente é obrigatório.', 'error');
    return;
  }

  if (stage === 'Perdido' && !lostReason) {
    showAppAlert('Para marcar como Perdido, selecione o motivo da perda.', 'error');
    return;
  }

  if (stage === 'Perdido' && lostReason) {
    notes = `${notes}\n[MOTIVO_PERDA]: ${lostReason}`.trim();
  }

  // Preserva metadados anteriores do Meta Ads em observacoes
  const previousMetaMatch = state.currentLead?.observacoes?.match(/\[NOVOS_LEADS_META\]:\s*\{.*?\}/s);
  if (previousMetaMatch) {
    notes = `${notes}\n${previousMetaMatch[0]}`.trim();
  }

  showAppAlert('Salvando dados no CRM...', 'info');

  try {
    const clinicaId = state.clinicaId || state.session.user.id;

    // Se o telefone ainda não estiver definido no estado, tenta obter do campo de busca
    if (!state.currentPhone) {
      const searchVal = document.getElementById('input-search-phone')?.value?.trim();
      if (searchVal) {
        const norm = normalizePhone(searchVal);
        if (norm) state.currentPhone = norm;
      }
    }

    // 1. Salva ou atualiza Paciente
    if (state.currentPatient?.id) {
      await authFetch(`/rest/v1/pacientes?id=eq.${state.currentPatient.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nome: name,
          email: email,
          atualizado_em: new Date().toISOString()
        })
      });
      state.currentPatient.nome = name;
      state.currentPatient.email = email;
    } else {
      const pacRes = await authFetch('/rest/v1/pacientes', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          user_id: clinicaId,
          nome: name,
          telefone: state.currentPhone,
          email: email,
          status: 'Ativo'
        })
      });
      if (pacRes.ok) {
        const createdPac = await pacRes.json();
        state.currentPatient = createdPac?.[0] || createdPac;
      }
    }

    // 2. Salva ou atualiza Lead no CRM
    if (state.currentLead?.id) {
      await authFetch(`/rest/v1/crm_leads?id=eq.${state.currentLead.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nome: name,
          email: email,
          status: stage,
          observacoes: notes,
          data_atualizacao: new Date().toISOString()
        })
      });
      state.currentLead.nome = name;
      state.currentLead.email = email;
      state.currentLead.status = stage;
      state.currentLead.observacoes = notes;
    } else {
      const leadRes = await authFetch('/rest/v1/crm_leads', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          nome: name,
          telefone: state.currentPhone,
          email: email,
          status: stage,
          origem: 'WhatsApp',
          observacoes: notes,
          data_criacao: new Date().toISOString(),
          data_atualizacao: new Date().toISOString()
        })
      });
      if (leadRes.ok) {
        const createdLead = await leadRes.json();
        state.currentLead = createdLead?.[0] || createdLead;
      }
    }

    renderContactCard();
    showAppAlert('Dados salvos com sucesso no CRM!', 'success');
  } catch (err) {
    console.error('[CRM Extension] Erro ao salvar paciente/lead:', err);
    showAppAlert('Falha ao salvar no CRM: ' + err.message, 'error');
  }
}

// ==============================================================================
// 6. AGENDAMENTO SEGURO E VERIFICAÇÃO DE HORÁRIOS LIVRES
// ==============================================================================

async function loadDentists() {
  const dentistSelect = document.getElementById('schedule-dentist');
  if (!dentistSelect) return;

  try {
    const res = await authFetch('/rest/v1/dentistas?ativo=eq.true&order=nome.asc');
    if (res.ok) {
      state.dentists = await res.json();
      dentistSelect.innerHTML = '<option value="">Selecione o profissional...</option>';
      for (const d of state.dentists) {
        const opt = document.createElement('option');
        opt.value = d.nome;
        opt.textContent = `${d.nome} (${d.especialidade || 'Geral'})`;
        dentistSelect.appendChild(opt);
      }
      if (state.dentists.length === 1) {
        dentistSelect.value = state.dentists[0].nome;
      }
    }
  } catch (e) {
    console.warn('[CRM Extension] Erro ao carregar dentistas:', e);
    dentistSelect.innerHTML = '<option value="Dra. Rosângela Santos Pereira">Dra. Rosângela Santos Pereira</option>';
  }
}

async function checkAvailableSlots() {
  const dentist = document.getElementById('schedule-dentist')?.value;
  const date = document.getElementById('schedule-date')?.value;
  const duration = parseInt(document.getElementById('schedule-duration')?.value || '60', 10);
  const timeSelect = document.getElementById('schedule-time');
  const confirmBtn = document.getElementById('btn-confirm-schedule');

  if (!dentist) {
    showAppAlert('Selecione o profissional responsável.', 'error');
    return;
  }
  if (!date) {
    showAppAlert('Selecione a data desejada para a consulta.', 'error');
    return;
  }

  showAppAlert('Verificando agenda e bloqueios...', 'info');
  timeSelect.disabled = true;
  confirmBtn.disabled = true;
  timeSelect.innerHTML = '<option value="">Carregando horários...</option>';

  try {
    // 1. Consultas existentes no dia para este dentista
    const consultRes = await authFetch(`/rest/v1/consultas?data=eq.${date}&dentista=eq.${encodeURIComponent(dentist)}&status=not.in.(cancelado,remarcado)&select=hora,duracao`);
    const existingConsultas = consultRes.ok ? await consultRes.json() : [];

    // 2. Bloqueios de agenda ativos para o dia
    const blockRes = await authFetch(`/rest/v1/bloqueios_agenda?data_inicio=lte.${date}&data_fim=gte.${date}&select=titulo,dentista,hora_inicio,hora_fim,dia_inteiro`);
    const existingBlocks = blockRes.ok ? await blockRes.json() : [];

    // Filtra bloqueios aplicáveis (geral ou específico do dentista)
    const applicableBlocks = existingBlocks.filter(b => !b.dentista || b.dentista === '' || b.dentista === dentist);

    const fullDayBlock = applicableBlocks.find(b => b.dia_inteiro);
    if (fullDayBlock) {
      timeSelect.innerHTML = `<option value="">Bloqueado: ${fullDayBlock.titulo}</option>`;
      showAppAlert(`Agenda do dia bloqueada: ${fullDayBlock.titulo}`, 'error');
      return;
    }

    // Helper: converte HH:MM em minutos
    const toMinutes = (timeStr) => {
      if (!timeStr) return 0;
      const [h, m] = timeStr.split(':').map(Number);
      return (h * 60) + m;
    };

    // Gera lista de intervalos de ocupação [startMin, endMin]
    const busyIntervals = [];

    for (const c of existingConsultas) {
      const cStart = toMinutes(c.hora);
      const cEnd = cStart + (c.duracao || 60);
      busyIntervals.push({ start: cStart, end: cEnd, label: 'Consulta agendada' });
    }

    for (const b of applicableBlocks) {
      if (b.hora_inicio && b.hora_fim) {
        busyIntervals.push({
          start: toMinutes(b.hora_inicio),
          end: toMinutes(b.hora_fim),
          label: b.titulo || 'Bloqueio de agenda'
        });
      }
    }

    // Gera horários comerciais padrão: 08:00 às 18:00 com step de 30 min
    const candidateSlots = [];
    const stepMin = 30;
    const startHourMin = 8 * 60;   // 08:00
    const endHourMin = 18 * 60;    // 18:00 (último atendimento termina até 18:00)

    for (let slotStart = startHourMin; slotStart + duration <= endHourMin; slotStart += stepMin) {
      const slotEnd = slotStart + duration;

      // Pausa de almoço padrão: 12:00 às 13:00 (exceto se for slot rápido antes de 12:00)
      const isLunchConflict = (slotStart < (13 * 60) && (12 * 60) < slotEnd);
      if (isLunchConflict) continue;

      // Verifica colisão com ocupações
      const hasConflict = busyIntervals.some(busy => slotStart < busy.end && busy.start < slotEnd);

      if (!hasConflict) {
        const h = String(Math.floor(slotStart / 60)).padStart(2, '0');
        const m = String(slotStart % 60).padStart(2, '0');
        candidateSlots.push(`${h}:${m}`);
      }
    }

    if (candidateSlots.length === 0) {
      timeSelect.innerHTML = '<option value="">Nenhum horário livre nesta data</option>';
      showAppAlert('Não há horários disponíveis para o profissional na data selecionada.', 'error');
    } else {
      timeSelect.innerHTML = '<option value="">Selecione o horário...</option>';
      for (const slot of candidateSlots) {
        const opt = document.createElement('option');
        opt.value = slot;
        opt.textContent = `${slot} hrs (Livre)`;
        timeSelect.appendChild(opt);
      }
      timeSelect.disabled = false;
      confirmBtn.disabled = false;
      showAppAlert(`${candidateSlots.length} horários livres encontrados!`, 'success');
    }
  } catch (err) {
    console.error('[CRM Extension] Erro ao consultar slots:', err);
    showAppAlert('Falha ao verificar horários: ' + err.message, 'error');
  }
}

async function confirmSchedule() {
  const dentist = document.getElementById('schedule-dentist')?.value;
  const date = document.getElementById('schedule-date')?.value;
  const time = document.getElementById('schedule-time')?.value;
  const duration = parseInt(document.getElementById('schedule-duration')?.value || '60', 10);
  const procedure = document.getElementById('schedule-procedure')?.value?.trim() || 'Avaliação Odontológica';
  const notes = document.getElementById('schedule-notes')?.value?.trim() || null;

  if (!dentist || !date || !time) {
    showAppAlert('Preencha profissional, data e horário antes de confirmar.', 'error');
    return;
  }

  // Validação de permissões
  if (state.permissions.agenda === false) {
    showAppAlert('Você não possui permissão para gerenciar agendamentos na agenda.', 'error');
    return;
  }

  // Trava anti-duplo clique e idempotência
  if (state.isScheduling) return;
  state.isScheduling = true;

  const btnConfirm = document.getElementById('btn-confirm-schedule');
  const originalBtnText = btnConfirm ? btnConfirm.textContent : 'Confirmar Agendamento';
  if (btnConfirm) {
    btnConfirm.disabled = true;
    btnConfirm.textContent = 'Gravando e Confirmando no Banco...';
  }

  try {
    // Se o paciente ainda não estiver salvo na tabela de pacientes, salva automaticamente antes
    if (!state.currentPatient?.id) {
      showAppAlert('Criando registro do paciente antes do agendamento...', 'info');
      await savePatientAndLead();
      if (!state.currentPatient?.id) {
        throw new Error('Não foi possível identificar ou cadastrar o paciente para este agendamento.');
      }
    }

    showAppAlert('Processando agendamento transacional atômico no PostgreSQL...', 'info');

    // 1. Chamada à RPC com trava atômica no PostgreSQL anti-concorrência
    const res = await authFetch('/rest/v1/rpc/agendar_consulta_extensao', {
      method: 'POST',
      body: JSON.stringify({
        p_paciente_id: state.currentPatient.id,
        p_data: date,
        p_hora: time,
        p_duracao: duration,
        p_dentista: dentist,
        p_procedimento: procedure,
        p_observacoes: notes,
        p_lead_id: state.currentLead?.id || null
      })
    });

    const result = await res.json().catch(() => ({}));

    if (!res.ok || !result?.sucesso || !result?.consulta_id) {
      const errMsg = result.message || result.details || result.hint || 'Conflito de agenda ou erro detectado pelo banco de dados.';
      throw new Error(errMsg);
    }

    // 2. AUDITORIA OBRIGATÓRIA DE PERSISTÊNCIA: Consulta diretamente o banco pelo ID gerado
    showAppAlert('Auditando confirmação de persistência no PostgreSQL...', 'info');
    const verifyRes = await authFetch(`/rest/v1/consultas?id=eq.${result.consulta_id}&select=id,paciente_id,paciente_nome,data,hora,duracao,dentista,status,user_id`);
    if (!verifyRes.ok) {
      throw new Error('O agendamento foi processado, mas a verificação de auditoria falhou ao consultar o banco.');
    }

    const rows = await verifyRes.json();
    const persisted = rows?.[0];

    if (!persisted || persisted.id !== result.consulta_id) {
      throw new Error('Falha crítica de persistência: O registro da consulta não foi localizado no banco após a execução.');
    }

    if (persisted.paciente_id !== state.currentPatient.id) {
      throw new Error('Inconsistência de integridade: A consulta foi vinculada a um identificador de paciente divergente.');
    }

    // 3. Formatação da data brasileira (DD/MM/AAAA)
    const [ano, mes, dia] = date.split('-');
    const brDate = `${dia}/${mes}/${ano}`;

    // 4. Somente após confirmação inequívoca de persistência, atualiza status do lead no CRM
    if (state.currentLead) {
      state.currentLead.status = 'Agendado';
    }
    renderContactCard();

    showAppAlert(`✅ Consulta #${result.consulta_id.slice(0, 8)} confirmada com sucesso para ${brDate} às ${time}!`, 'success');

    // 5. Atualiza lista de consultas e renderiza atalho para a Agenda do CRM
    await loadPatientAppointments(state.currentPatient.id);
    renderAgendaDirectLink(date, brDate, time, dentist);
    switchTab('tab-appointments');
  } catch (err) {
    console.error('[CRM Extension] Erro no agendamento seguro:', err);
    showAppAlert(`❌ Falha no agendamento: ${err.message}`, 'error');
  } finally {
    state.isScheduling = false;
    if (btnConfirm) {
      btnConfirm.disabled = false;
      btnConfirm.textContent = originalBtnText;
    }
  }
}

function renderAgendaDirectLink(dateStr, brDate, timeStr, dentistStr) {
  const container = document.getElementById('agenda-link-container');
  if (!container) return;
  container.innerHTML = `
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px; margin-top: 10px;">
      <div style="font-weight: 600; color: #166534; font-size: 12px; margin-bottom: 4px;">
        ✅ Agendamento Confirmado no Banco de Dados
      </div>
      <div style="font-size: 11.5px; color: #15803d; line-height: 1.4;">
        <strong>Data:</strong> ${brDate} às ${timeStr} • <strong>Profissional:</strong> ${dentistStr}
      </div>
      <p style="font-size: 11px; color: #475569; margin: 6px 0 8px 0;">
        📌 <strong>Dica da Agenda:</strong> Para visualizar este agendamento no sistema principal da clínica, navegue até a data <strong>${brDate}</strong> no calendário.
      </p>
      <a href="https://app.lentesemresinamaceio.com.br/agenda?data=${dateStr}" target="_blank" class="btn btn-secondary btn-sm" style="display: block; text-align: center; text-decoration: none; padding: 6px 10px; font-weight: 600; background: #ffffff; border: 1px solid #16a34a; color: #15803d;">
        📅 Abrir na Agenda do CRM (${brDate}) ↗
      </a>
    </div>
  `;
}

// ==============================================================================
// 7. CONSULTAS E HISTÓRICO
// ==============================================================================

async function loadPatientAppointments(pacienteId) {
  try {
    const res = await authFetch(`/rest/v1/consultas?paciente_id=eq.${pacienteId}&order=data.desc,hora.desc`);
    if (res.ok) {
      const consultas = await res.json();
      renderAppointmentsList(consultas);
    }
  } catch (e) {
    console.warn('[CRM Extension] Erro ao carregar consultas:', e);
  }
}

function renderAppointmentsList(consultas) {
  const container = document.getElementById('appointments-list');
  if (!container) return;

  if (!consultas || consultas.length === 0) {
    container.innerHTML = '<p style="font-size: 11.5px; color: var(--text-muted); margin: 8px 0;">Nenhuma consulta registrada para este paciente.</p>';
    return;
  }

  container.innerHTML = '';
  for (const c of consultas) {
    const item = document.createElement('div');
    item.style.padding = '8px 10px';
    item.style.borderRadius = '6px';
    item.style.background = '#f8fafc';
    item.style.border = '1px solid #e2e8f0';

    const [yyyy, mm, dd] = (c.data || '').split('-');
    const dateFormatted = yyyy && mm && dd ? `${dd}/${mm}/${yyyy}` : c.data;

    item.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <span style="font-weight: 600; font-size: 12px; color: #0f172a;">📅 ${dateFormatted} às ${c.hora}</span>
        <span class="badge ${c.status === 'cancelado' ? 'badge-perdido' : 'badge-agendado'}" style="font-size: 10px; padding: 2px 6px;">
          ${c.status || 'agendado'}
        </span>
      </div>
      <div style="font-size: 11px; color: #475569;">👨‍⚕️ ${c.dentista || 'Profissional da Clínica'}</div>
      <div style="font-size: 11px; color: #64748b;">📋 ${c.procedimento || 'Avaliação'} (${c.duracao || 60} min)</div>
      ${c.observacoes ? `<div style="font-size: 10.5px; color: #94a3b8; margin-top: 4px; font-style: italic;">Obs: ${c.observacoes}</div>` : ''}
    `;
    container.appendChild(item);
  }
}

// ==============================================================================
// 8. FOLLOW-UP E LINHA DO TEMPO
// ==============================================================================

function renderFollowUpTimeline() {
  const timeline = document.getElementById('followup-timeline');
  if (!timeline) return;

  const currentStage = state.currentLead?.status || 'Pendente';

  const steps = [
    { title: 'D+0: Primeiro Contato', desc: 'Identificar queixa principal e interesse em lentes/estética.', activeStages: ['Pendente', 'Interessado', 'Começou mas não deu andamento', 'Agendado', 'Convertido'] },
    { title: 'D+1: Confirmação de Interesse', desc: 'Enviar fotos de casos clínicos ou tirar dúvidas de valores.', activeStages: ['Interessado', 'Começou mas não deu andamento', 'Agendado', 'Convertido'] },
    { title: 'D+3: Proposta e Agendamento', desc: 'Ofertar horário exclusivo para avaliação presencial.', activeStages: ['Começou mas não deu andamento', 'Agendado', 'Convertido'] },
    { title: 'D+7: Reativação ou Encerramento', desc: 'Retomar contato com condição especial antes de arquivar.', activeStages: ['Agendado', 'Convertido'] }
  ];

  timeline.innerHTML = '';
  steps.forEach((step, idx) => {
    const isDone = step.activeStages.includes(currentStage);
    const item = document.createElement('div');
    item.className = `timeline-item ${isDone ? 'done' : ''}`;
    item.innerHTML = `
      <div class="timeline-title">${step.title}</div>
      <div class="timeline-desc">${step.desc}</div>
    `;
    timeline.appendChild(item);
  });
}

async function registerContactNote() {
  const noteInput = document.getElementById('quick-contact-notes');
  const noteText = noteInput?.value?.trim();
  if (!noteText) {
    showAppAlert('Digite um resumo do atendimento antes de salvar.', 'error');
    return;
  }

  if (!state.currentLead?.id) {
    showAppAlert('Salve o contato como lead no CRM antes de adicionar histórico de follow-up.', 'error');
    return;
  }

  showAppAlert('Registrando contato no histórico...', 'info');

  try {
    const nowStr = new Date().toLocaleString('pt-BR');
    const userEmail = state.session?.user?.email || 'atendente';
    const appendText = `\n[ATENDIMENTO WHATSAPP ${nowStr} (${userEmail})]: ${noteText}`;

    const currentObs = state.currentLead.observacoes || '';
    const updatedObs = currentObs + appendText;

    await authFetch(`/rest/v1/crm_leads?id=eq.${state.currentLead.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        observacoes: updatedObs,
        data_atualizacao: new Date().toISOString()
      })
    });

    state.currentLead.observacoes = updatedObs;
    if (noteInput) noteInput.value = '';
    showAppAlert('Atendimento registrado com sucesso no histórico do CRM!', 'success');
  } catch (err) {
    console.error('[CRM Extension] Erro ao registrar contato:', err);
    showAppAlert('Falha ao registrar histórico: ' + err.message, 'error');
  }
}

// ==============================================================================
// 9. NAVEGAÇÃO DE INTERFACE E ALERTAS
// ==============================================================================

function switchTab(tabId) {
  state.activeTab = tabId;
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  tabContents.forEach(content => {
    content.hidden = (content.id !== tabId);
  });

  if (tabId === 'tab-schedule') {
    // Configura data padrão como amanhã
    const dateInput = document.getElementById('schedule-date');
    if (dateInput && !dateInput.value) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      // Se for domingo, pula para segunda
      if (tomorrow.getDay() === 0) tomorrow.setDate(tomorrow.getDate() + 1);
      dateInput.value = tomorrow.toISOString().slice(0, 10);
    }
  }
}

function showLoginAlert(msg, type = 'error') {
  const alertEl = document.getElementById('login-alert');
  if (!alertEl) return;
  alertEl.textContent = msg;
  alertEl.className = `alert alert-${type}`;
  alertEl.hidden = false;
}

function hideLoginAlert() {
  const alertEl = document.getElementById('login-alert');
  if (alertEl) alertEl.hidden = true;
}

function showAppAlert(msg, type = 'info') {
  const alertEl = document.getElementById('app-alert');
  if (!alertEl) return;
  alertEl.textContent = msg;
  alertEl.className = `alert alert-${type}`;
  alertEl.hidden = false;

  if (type === 'success') {
    setTimeout(hideAppAlert, 4000);
  }
}

function hideAppAlert() {
  const alertEl = document.getElementById('app-alert');
  if (alertEl) alertEl.hidden = true;
}

function renderUI() {
  const loginSection = document.getElementById('login-section');
  const appSection = document.getElementById('app-section');
  const userBar = document.getElementById('user-bar');
  const userEmailLabel = document.getElementById('user-email-label');

  if (state.session?.user) {
    if (loginSection) loginSection.hidden = true;
    if (appSection) appSection.hidden = false;
    if (userBar) userBar.hidden = false;
    if (userEmailLabel) userEmailLabel.textContent = state.session.user.email || 'Usuário';

    loadDentists();
  } else {
    if (loginSection) loginSection.hidden = false;
    if (appSection) appSection.hidden = true;
    if (userBar) userBar.hidden = true;
  }
}

// ==============================================================================
// 10. INICIALIZAÇÃO E EVENT LISTENERS
// ==============================================================================

async function init() {
  // 1. Tenta recuperar sessão existente no chrome.storage
  const stored = await storageGet(['rose_crm_session']);
  if (stored?.rose_crm_session?.access_token) {
    state.session = stored.rose_crm_session;
    // Se estiver prestes a expirar, renova
    if (Date.now() > (state.session.expires_at - 60000)) {
      await refreshToken();
    }
    await resolveUserPermissions();
  }

  renderUI();

  // 2. Event Listeners do Formulário de Login
  const formLogin = document.getElementById('form-login');
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideLoginAlert();
      const email = document.getElementById('login-email')?.value;
      const pass = document.getElementById('login-password')?.value;
      const btn = document.getElementById('btn-login');

      if (!email || !pass) {
        showLoginAlert('Preencha seu e-mail e senha.');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Autenticando...';

      try {
        await login(email, pass);
        renderUI();
      } catch (err) {
        showLoginAlert(err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Entrar no Sistema';
      }
    });
  }

  // 3. Botão Logout
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await logout();
    });
  }

  // 4. Busca manual de telefone ou nome
  const btnSearch = document.getElementById('btn-search-contact');
  const inputPhone = document.getElementById('input-search-phone');
  if (btnSearch && inputPhone) {
    btnSearch.addEventListener('click', () => {
      searchContact(inputPhone.value);
    });
    inputPhone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        searchContact(inputPhone.value);
      }
    });
  }

  // 4.1 Botão de sincronização forçada com o WhatsApp Web
  const btnSync = document.getElementById('btn-sync-whatsapp');
  if (btnSync) {
    btnSync.addEventListener('click', () => {
      showAppAlert('Sincronizando com a conversa ativa do WhatsApp...', 'info');
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs?.[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_VISIBLE_CONTACT' }, (res) => {
              if (chrome.runtime.lastError || !res) {
                showAppAlert('Certifique-se de que a aba do WhatsApp Web está ativa.', 'error');
                return;
              }
              handleContactChanged(res);
            });
          }
        });
      } catch (err) {
        showAppAlert('Erro ao comunicar com o WhatsApp: ' + err.message, 'error');
      }
    });
  }

  // 5. Troca de abas
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // 6. Mudança de estágio comercial no formulário
  const stageSelect = document.getElementById('lead-stage-select');
  const lostReasonGroup = document.getElementById('lost-reason-group');
  if (stageSelect && lostReasonGroup) {
    stageSelect.addEventListener('change', () => {
      lostReasonGroup.hidden = (stageSelect.value !== 'Perdido');
    });
  }

  // 7. Botão Salvar Dados Cadastrais / CRM
  const btnSavePatient = document.getElementById('btn-save-patient');
  if (btnSavePatient) {
    btnSavePatient.addEventListener('click', savePatientAndLead);
  }

  // 8. Botão Verificar Horários Livres
  const btnCheckSlots = document.getElementById('btn-check-availability');
  if (btnCheckSlots) {
    btnCheckSlots.addEventListener('click', checkAvailableSlots);
  }

  // 9. Botão Confirmar Agendamento
  const btnConfirmSchedule = document.getElementById('btn-confirm-schedule');
  if (btnConfirmSchedule) {
    btnConfirmSchedule.addEventListener('click', confirmSchedule);
  }

  // 10. Botão Registrar Atendimento de Follow-up
  const btnRegisterContact = document.getElementById('btn-register-contact');
  if (btnRegisterContact) {
    btnRegisterContact.addEventListener('click', registerContactNote);
  }

  // 11. Escuta alterações de contato enviadas pelo content script do WhatsApp Web
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message?.type === 'CONTACT_CHANGED' && message.contact) {
        handleContactChanged(message.contact);
      }
    });

    // Solicita contato ativo inicial se já estiver numa conversa aberta
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs?.[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_VISIBLE_CONTACT' }, (res) => {
            if (chrome.runtime.lastError || !res) return;
            handleContactChanged(res);
          });
        }
      });
    } catch {}
  }
}

// Inicia a aplicação quando o DOM estiver carregado
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

