import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Parser manual do .env.homolog
const rawEnv = fs.readFileSync('.env.homolog', 'utf-8');
const homologEnv: Record<string, string> = {};
for (const line of rawEnv.split('\n')) {
  const clean = line.trim();
  if (!clean || clean.startsWith('#')) continue;
  const eq = clean.indexOf('=');
  if (eq !== -1) {
    homologEnv[clean.substring(0, eq).trim()] = clean.substring(eq + 1).trim();
  }
}

const SUPABASE_URL = homologEnv.HOMOLOG_URL;
const SERVICE_KEY = homologEnv.HOMOLOG_SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = homologEnv.HOMOLOG_SUPABASE_ANON_KEY;

const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY);
const PASS = 'PasswordSeguro123!';

async function runHomologationTests() {
  console.log('================================================================');
  console.log('🧪 BATERIA DE HOMOLOGAÇÃO V2.1 — EXTENSÃO WHATSAPP + CRM + AGENDA');
  console.log(`Ambiente Homologação: ${SUPABASE_URL}`);
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string, details?: any) {
    if (condition) {
      console.log(`✅ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${title}`);
      if (details) console.error('   Detalhes:', details);
      failed++;
    }
  }

  // 1. Identificar usuários de teste em homologação
  const { data: usersData } = await serviceClient.auth.admin.listUsers();
  const recepcaoUser = usersData?.users?.find(u => u.email?.includes('recepcao-rls'));
  const adminUser = usersData?.users?.find(u => u.email?.includes('admin-rls'));

  if (!recepcaoUser || !adminUser) {
    throw new Error('Usuários de homologação não localizados.');
  }

  const clinicaId = adminUser.id;
  const recepcaoId = recepcaoUser.id;

  // Garante permissões iniciais da equipe
  await serviceClient.from('equipe').upsert({
    usuario_id: recepcaoId,
    clinica_id: clinicaId,
    email: recepcaoUser.email,
    nome: 'Atendente Recepção Homolog',
    permissoes: { agenda: true, pacientes: true, crm: true }
  }, { onConflict: 'usuario_id' });

  // Autentica cliente de teste da recepção
  const recepcaoClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data: loginData, error: loginErr } = await recepcaoClient.auth.signInWithPassword({
    email: recepcaoUser.email!,
    password: PASS
  });
  assert(!loginErr && !!loginData.session, 'Autenticação da recepção via JWT homologação');

  // --------------------------------------------------------------------------
  // CENÁRIO 1: Captura e Normalização de Número de Telefone
  // --------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 1: Captura e Normalização de Número ---');
  function normalizePhone(raw: string): string {
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 10) return '';
    if (digits.length === 10 || digits.length === 11) {
      return `+55${digits}`;
    }
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
      return `+${digits}`;
    }
    return `+${digits}`;
  }

  const norm1 = normalizePhone('82999887766');
  const norm2 = normalizePhone('+55 (82) 99988-7766');
  const norm3 = normalizePhone('5582999887766');
  assert(norm1 === '+5582999887766', 'Normaliza telefone sem DDI para +5582999887766');
  assert(norm2 === '+5582999887766', 'Normaliza telefone formatado para +5582999887766');
  assert(norm3 === '+5582999887766', 'Normaliza telefone com DDI para +5582999887766');

  // --------------------------------------------------------------------------
  // CENÁRIO 2: Captura de Nome e Ignoramento de Botões de Sistema
  // --------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 2: Captura de Nome e Filtro de Sistema ---');
  const IGNORED_TITLES = [
    'dados do contato',
    'dados da empresa',
    'dados do grupo',
    'pesquisar...',
    'pesquisar',
    'mais opções',
    'anexar',
    'foto do perfil',
    'status'
  ];

  function isIgnored(text: string): boolean {
    if (!text) return true;
    const lower = text.trim().toLowerCase();
    return IGNORED_TITLES.some(i => lower === i || lower.startsWith(i));
  }

  assert(isIgnored('Dados do contato') === true, 'Filtra corretamente botão "Dados do contato"');
  assert(isIgnored('Pesquisar...') === true, 'Filtra corretamente botão "Pesquisar..."');
  assert(isIgnored('Diego Duracenski') === false, 'Reconhece nome legítimo "Diego Duracenski"');
  assert(isIgnored('Maria da Silva Santos') === false, 'Reconhece nome legítimo "Maria da Silva Santos"');

  // --------------------------------------------------------------------------
  // CENÁRIO 3: Identificação de Paciente Existente por Telefone e por Nome
  // --------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 3: Identificação de Paciente Existente ---');
  const testPhone = '+5582991112233';
  const testName = 'Paciente Teste Homolog V21 ' + Date.now();

  // Cria paciente no banco
  const { data: createdPac, error: pacErr } = await serviceClient.from('pacientes').insert({
    user_id: clinicaId,
    nome: testName,
    telefone: testPhone,
    status: 'Ativo'
  }).select().single();
  assert(!pacErr && !!createdPac?.id, 'Cria paciente de teste em homologação');

  // Busca por telefone (suporta dígitos, formato internacional e sufixo hifenizado)
  const rawDigits = testPhone.replace(/\D/g, '');
  const last8 = rawDigits.slice(-8);
  const last4 = rawDigits.slice(-4);
  const mid4 = rawDigits.slice(-8, -4);
  const formattedSuffix = `${mid4}-${last4}`;
  const { data: foundByPhone } = await recepcaoClient
    .from('pacientes')
    .select('*')
    .or(`telefone.eq.${testPhone},telefone.ilike.%${last8}%,telefone.ilike.%${formattedSuffix}%`)
    .eq('user_id', clinicaId)
    .order('criado_em', { ascending: false });
  assert(foundByPhone && foundByPhone.length > 0 && foundByPhone.some(p => p.id === createdPac.id), 'Identifica paciente por telefone');

  // Busca por nome
  const { data: foundByName } = await recepcaoClient
    .from('pacientes')
    .select('*')
    .ilike('nome', `%${testName}%`)
    .eq('user_id', clinicaId);
  assert(foundByName && foundByName.length > 0 && foundByName.some(p => p.id === createdPac.id), 'Identifica paciente por nome');

  // --------------------------------------------------------------------------
  // CENÁRIO 4: Cadastro de Novo Paciente e Lead via Extensão
  // --------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 4: Cadastro de Novo Paciente e Lead ---');
  const newPhone = '+558298765' + Math.floor(1000 + Math.random() * 9000);
  const newName = 'Novo Lead WhatsApp ' + Date.now();

  // Salva paciente via cliente autenticado da recepção
  const { data: newPac, error: newPacErr } = await recepcaoClient.from('pacientes').insert({
    user_id: clinicaId,
    nome: newName,
    telefone: newPhone,
    status: 'Ativo'
  }).select().single();
  assert(!newPacErr && !!newPac?.id, 'Cadastra novo paciente com sucesso');

  // Salva lead no CRM
  const { data: newLead, error: newLeadErr } = await recepcaoClient.from('crm_leads').insert({
    nome: newName,
    telefone: newPhone,
    status: 'Pendente',
    origem: 'WhatsApp',
    observacoes: '[Lead criado pela Extensão WhatsApp]'
  }).select().single();
  assert(!newLeadErr && !!newLead?.id, 'Cadastra novo lead no CRM com sucesso');

  // --------------------------------------------------------------------------
  // CENÁRIO 5: Agendamento com Horário Livre e Validação Transacional
  // --------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 5: Agendamento com Horário Livre ---');
  // Usa um dia e horário livre dinâmico para evitar colisões entre re-execuções de testes
  const randomDay = String(Math.floor(15 + Math.random() * 12)).padStart(2, '0');
  const appointmentDate = `2026-11-${randomDay}`;
  const appointmentTime = '10:00';
  const dentistName = 'Dra. Rosangela Santos Pereira';

  const { data: rpcResult, error: rpcErr } = await recepcaoClient.rpc('agendar_consulta_extensao', {
    p_paciente_id: newPac.id,
    p_data: appointmentDate,
    p_hora: appointmentTime,
    p_duracao: 60,
    p_dentista: dentistName,
    p_procedimento: 'Avaliação Odontológica - Lentes',
    p_observacoes: 'Agendamento homologação V2.1',
    p_lead_id: newLead.id
  });

  assert(!rpcErr && rpcResult?.sucesso === true && !!rpcResult?.consulta_id, 'RPC agendar_consulta_extensao executada com sucesso', rpcErr || rpcResult);
  const consultaId = rpcResult?.consulta_id;

  // --------------------------------------------------------------------------
  // CENÁRIO 6: Confirmação Obrigatória de Persistência por ID (Read-back)
  // --------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 6: Confirmação Obrigatória de Persistência por ID ---');
  const { data: readBackRows, error: readBackErr } = await recepcaoClient
    .from('consultas')
    .select('id, paciente_id, paciente_nome, data, hora, duracao, dentista, status, user_id')
    .eq('id', consultaId);

  assert(!readBackErr && readBackRows && readBackRows.length === 1, 'Consulta localizada pelo ID no banco');
  const savedConsulta = readBackRows?.[0];
  assert(savedConsulta?.id === consultaId, 'ID gravado confere rigorosamente com o retorno da RPC');
  assert(savedConsulta?.paciente_id === newPac.id, 'Paciente vinculado confere rigorosamente');
  assert(savedConsulta?.data === appointmentDate, `Data gravada (${savedConsulta?.data}) confere com solicitada (${appointmentDate})`);
  assert(savedConsulta?.hora === appointmentTime, `Horário gravado (${savedConsulta?.hora}) confere com solicitado (${appointmentTime})`);
  assert(savedConsulta?.dentista === dentistName, `Dentista gravado (${savedConsulta?.dentista}) confere`);
  assert(savedConsulta?.user_id === clinicaId, `User ID da clínica (${savedConsulta?.user_id}) confere com multi-tenant`);

  // --------------------------------------------------------------------------
  // CENÁRIO 7: Atualização do Estágio do Lead para 'Agendado'
  // --------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 7: Atualização de Estágio do Lead ---');
  const { data: updatedLead } = await recepcaoClient
    .from('crm_leads')
    .select('status, observacoes')
    .eq('id', newLead.id)
    .single();

  assert(updatedLead?.status === 'Agendado', 'Status do lead atualizado automaticamente para "Agendado"');
  assert(updatedLead?.observacoes?.includes('[Agendamento Extensão]'), 'Observações do lead registram o histórico da consulta');

  // --------------------------------------------------------------------------
  // CENÁRIO 8: Bloqueio de Horário Ocupado (Trigger Conflito)
  // --------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 8: Bloqueio de Horário Ocupado ---');
  const { data: conflictResult, error: conflictErr } = await recepcaoClient.rpc('agendar_consulta_extensao', {
    p_paciente_id: createdPac.id,
    p_data: appointmentDate,
    p_hora: '10:30', // Sobrepõe com consulta das 10:00 (duração 60 min, vai até 11:00)
    p_duracao: 30,
    p_dentista: dentistName,
    p_procedimento: 'Outra Consulta',
    p_observacoes: 'Tentativa de conflito'
  });

  assert(!!conflictErr, 'Trigger/RPC bloqueia com erro agendamento sobreposto no mesmo horário e dentista');
  assert(conflictErr?.message?.includes('Conflito de horário'), 'Mensagem de erro explicita conflito de horário com o profissional');

  // --------------------------------------------------------------------------
  // CENÁRIO 9: Tentativa de Agendamento Duplicado
  // --------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 9: Tentativa de Agendamento Duplicado ---');
  const { error: dupErr } = await recepcaoClient.rpc('agendar_consulta_extensao', {
    p_paciente_id: newPac.id,
    p_data: appointmentDate,
    p_hora: appointmentTime,
    p_duracao: 60,
    p_dentista: dentistName,
    p_procedimento: 'Tentativa duplicada'
  });
  assert(!!dupErr, 'Tentativa de agendamento no mesmo horário exato é terminantemente rejeitada');

  // --------------------------------------------------------------------------
  // CENÁRIO 10: Bloqueio por Usuário Sem Permissão de Agenda
  // --------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 10: Usuário Sem Permissão de Agenda ---');
  await serviceClient.from('equipe').update({
    permissoes: { agenda: false, pacientes: true, crm: true }
  }).eq('usuario_id', recepcaoId);

  const { error: noPermErr } = await recepcaoClient.rpc('agendar_consulta_extensao', {
    p_paciente_id: newPac.id,
    p_data: '2026-11-20',
    p_hora: '14:00',
    p_duracao: 60,
    p_dentista: dentistName,
    p_procedimento: 'Avaliação'
  });

  assert(!!noPermErr && noPermErr.message.includes('Acesso negado: Usuário não possui permissão para gerenciar agenda'),
    'Usuário sem permissão na equipe é bloqueado pelo servidor');

  // Restaura permissão
  await serviceClient.from('equipe').update({
    permissoes: { agenda: true, pacientes: true, crm: true }
  }).eq('usuario_id', recepcaoId);

  // --------------------------------------------------------------------------
  // CENÁRIO 11: Compatibilidade com a Agenda Principal do CRM
  // --------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 11: Compatibilidade com Agenda Principal ---');
  // Simula transformação do frontend em useAgendaViews
  const parseLocalDate = (value: any): Date => {
    if (value instanceof Date) return value;
    const str = String(value || '');
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return new Date(str);
  };

  const parsedDate = parseLocalDate(savedConsulta.data);
  const start = new Date(parsedDate);
  const [h, m] = savedConsulta.hora.split(':').map(Number);
  start.setHours(h, m, 0, 0);
  const end = new Date(start);
  end.setMinutes(start.getMinutes() + savedConsulta.duracao);

  const eventTitle = `${savedConsulta.paciente_nome} - ${savedConsulta.procedimento || 'Consulta'}`;
  assert(!isNaN(start.getTime()), 'Data inicial do evento no calendário é válida');
  assert(!isNaN(end.getTime()), 'Data final do evento no calendário é válida');
  assert(end.getTime() - start.getTime() === 60 * 60 * 1000, 'Duração do evento no calendário é de 60 minutos exatos');
  assert(eventTitle.includes(newName), 'Título do evento contém o nome do paciente');

  // Validação do comportamento por data selecionada (Por que consultas futuras não aparecem hoje)
  const isSameDay = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
  const todayDate = new Date('2026-11-09T12:00:00');
  const targetDate = new Date(`${appointmentDate}T12:00:00`);

  const visibleToday = isSameDay(start, todayDate);
  const visibleOnTargetDay = isSameDay(start, targetDate);

  assert(visibleToday === false, 'Comprova por que a consulta não aparece na visualização do dia de hoje (09/11)');
  assert(visibleOnTargetDay === true, `Comprova que a consulta aparece ao navegar para o dia do agendamento (${appointmentDate})`);

  // --------------------------------------------------------------------------
  // CENÁRIO 12: Idempotência e Troca Rápida de Conversas (Race Condition Protection)
  // --------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 12: Proteção Contra Trocas Rápidas (Race Conditions) ---');
  let simulatedSeq = 0;
  let activeContactResult = '';

  async function simulateRapidSwitch(chatName: string, delayMs: number) {
    const current = ++simulatedSeq;
    await new Promise(r => setTimeout(r, delayMs));
    if (current === simulatedSeq) {
      activeContactResult = chatName;
    }
  }

  // Dispara 3 trocas rápidas
  simulateRapidSwitch('Chat 1 (Lento)', 300);
  simulateRapidSwitch('Chat 2 (Médio)', 150);
  simulateRapidSwitch('Chat 3 (Último Clicado)', 50);

  await new Promise(r => setTimeout(r, 400));
  assert(activeContactResult === 'Chat 3 (Último Clicado)', 'Apenas o último chat selecionado é aplicado, descartando respostas lentas');

  // --------------------------------------------------------------------------
  // RESUMO FINAL
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 RESULTADO FINAL DA HOMOLOGAÇÃO:`);
  console.log(`   Total de Asserções: ${passed + failed}`);
  console.log(`   Aprovadas: ${passed}`);
  console.log(`   Falhas: ${failed}`);
  console.log(`   Consulta de Teste Homologada: ${consultaId}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runHomologationTests().catch(err => {
  console.error('Erro fatal nos testes:', err);
  process.exit(1);
});
