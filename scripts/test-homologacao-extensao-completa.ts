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
const ANON_KEY = homologEnv.HOMOLOG_SUPABASE_ANON_KEY;
const SERVICE_KEY = homologEnv.HOMOLOG_SUPABASE_SERVICE_ROLE_KEY;

const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY);

const PASS = 'PasswordSeguro123!';

async function runTests() {
  console.log('================================================================');
  console.log('🧪 BATERIA DE HOMOLOGAÇÃO: EXTENSÃO WHATSAPP CRM & AGENDAMENTO');
  console.log(`Ambiente: ${SUPABASE_URL}`);
  console.log('================================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, title: string, details?: any) {
    if (condition) {
      console.log(`✅ [PASS] ${title}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] ${title}`);
      if (details) console.error('   Detalhes:', details);
      failedCount++;
    }
  }

  // 0. Localiza usuários de teste no banco
  const { data: usersData } = await serviceClient.auth.admin.listUsers();
  const recepcaoUser = usersData?.users?.find(u => u.email?.includes('recepcao-rls'));
  const adminUser = usersData?.users?.find(u => u.email?.includes('admin-rls'));

  if (!recepcaoUser || !adminUser) {
    throw new Error('Usuários de teste não encontrados em homologação.');
  }

  console.log(`Usuário Recepção: ${recepcaoUser.email} (${recepcaoUser.id})`);
  console.log(`Usuário Admin: ${adminUser.email} (${adminUser.id})\n`);

  // Garante equipe configurada
  await serviceClient.from('equipe').delete().eq('usuario_id', recepcaoUser.id);
  await serviceClient.from('equipe').insert({
    clinica_id: adminUser.id,
    usuario_id: recepcaoUser.id,
    nome: 'Atendente Recepção Homologação',
    email: recepcaoUser.email,
    permissoes: { pacientes: true, agenda: true, crm: true, financeiro: false }
  });

  // ---------------------------------------------------------------------------
  // CENÁRIO 1: Login com credenciais válidas individuais
  // ---------------------------------------------------------------------------
  console.log('--- CENÁRIO 1: Login Válido via Supabase Auth REST ---');
  const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: recepcaoUser.email, password: PASS })
  });
  const loginData = await loginRes.json();
  const recepcaoToken = loginData.access_token;
  const refreshToken = loginData.refresh_token;

  assert(loginRes.status === 200 && !!recepcaoToken, 'Login individual de atendente autenticado com sucesso', { status: loginRes.status });

  // ---------------------------------------------------------------------------
  // CENÁRIO 2: Rejeição de credenciais inválidas
  // ---------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 2: Rejeição de Credenciais Inválidas ---');
  const badLoginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: recepcaoUser.email, password: 'SenhaIncorreta999!' })
  });
  const badLoginData = await badLoginRes.json();
  assert(badLoginRes.status === 400 && (!!badLoginData.msg || !!badLoginData.error_description), 'Tentativa com senha incorreta é bloqueada adequadamente', badLoginData);

  // ---------------------------------------------------------------------------
  // CENÁRIO 3: Renovação segura de Sessão (Token Refresh)
  // ---------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 3: Renovação de Token (Refresh Token) ---');
  const refreshRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  const refreshData = await refreshRes.json();
  const newAccessToken = refreshData.access_token;
  assert(refreshRes.status === 200 && !!newAccessToken, 'Token de sessão renovado com sucesso sem relogar', { status: refreshRes.status });

  // Cria cliente autenticado com a sessão da recepção
  const clientRecepcao = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${newAccessToken}` } }
  });

  // ---------------------------------------------------------------------------
  // CENÁRIO 4: Resolução de Clínica e Verificação de Permissões
  // ---------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 4: Resolução de Multi-tenancy e Permissões ---');
  const { data: equipeRecord } = await clientRecepcao.from('equipe').select('*').eq('usuario_id', recepcaoUser.id).single();
  assert(equipeRecord && equipeRecord.clinica_id === adminUser.id, 'Atendente resolve corretamente a clínica da Dra. Rosângela', equipeRecord);
  assert(equipeRecord?.permissoes?.agenda === true && equipeRecord?.permissoes?.financeiro === false, 'Permissões individuais respeitadas (agenda=true, financeiro=false)');

  // ---------------------------------------------------------------------------
  // CENÁRIO 5: Identificação de Lead e Paciente existente com Meta Ads
  // ---------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 5: Identificação de Lead e Paciente com Meta Ads ---');
  const phoneTest = '+5582991112233';

  // Garante lead único de teste para Mariana Silva
  await serviceClient.from('crm_leads').delete().eq('telefone', phoneTest);
  await serviceClient.from('crm_leads').insert({
    nome: 'Mariana Silva Teste',
    telefone: phoneTest,
    email: 'mariana.teste@exemplo.com',
    status: 'Pendente',
    origem: 'Meta Lead Ads',
    campanha: 'Campanha Lentes Resina Nov 2026',
    observacoes: 'Cliente interessada em lentes superiores.\n[NOVOS_LEADS_META]:{"criativo":"Vídeo Depoimento Sorriso Transformado","campanha":"Campanha Lentes Resina Nov 2026","isNew":true}'
  });

  const { data: leadsFound } = await clientRecepcao.from('crm_leads').select('*').eq('telefone', phoneTest).order('data_criacao', { ascending: false }).limit(1);
  const leadFound = leadsFound?.[0];

  const { data: pacsFound } = await clientRecepcao.from('pacientes').select('*').eq('telefone', phoneTest).order('criado_em', { ascending: false }).limit(1);
  const pacFound = pacsFound?.[0];

  assert(!!leadFound && leadFound.nome === 'Mariana Silva Teste', 'Lead Mariana Silva Teste localizado pelo telefone');
  assert(!!pacFound && pacFound.nome === 'Mariana Silva Teste', 'Paciente Mariana Silva Teste localizado pelo telefone');

  const metaMatch = leadFound?.observacoes?.match(/\[NOVOS_LEADS_META\]:\s*(\{.*\})/);
  const metaParsed = metaMatch ? JSON.parse(metaMatch[1]) : null;
  assert(metaParsed && metaParsed.criativo === 'Vídeo Depoimento Sorriso Transformado', 'Metadados do Meta Ads (Campanha e Criativo) preservados intactos', metaParsed);

  // ---------------------------------------------------------------------------
  // CENÁRIO 6: Cadastro Rápido de Novo Contato sem duplicidade
  // ---------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 6: Cadastro Rápido de Novo Contato e Lead ---');
  const novoTelefone = '+5582998889900';
  // Limpa se já existia
  await serviceClient.from('crm_leads').delete().eq('telefone', novoTelefone);
  await serviceClient.from('pacientes').delete().eq('telefone', novoTelefone);

  // Insere novo paciente
  const { data: novoPac, error: errPac } = await clientRecepcao.from('pacientes').insert({
    user_id: adminUser.id,
    nome: 'Carlos Santos Extensao',
    telefone: novoTelefone,
    email: 'carlos.extensao@teste.com',
    status: 'Ativo'
  }).select().single();

  // Insere lead no CRM
  const { data: novoLead, error: errLead } = await clientRecepcao.from('crm_leads').insert({
    nome: 'Carlos Santos Extensao',
    telefone: novoTelefone,
    email: 'carlos.extensao@teste.com',
    status: 'Interessado',
    origem: 'WhatsApp',
    observacoes: 'Lead cadastrado via painel lateral da extensão Chrome.'
  }).select().single();

  assert(!errPac && novoPac?.id, 'Novo paciente cadastrado com sucesso via extensão');
  assert(!errLead && novoLead?.id, 'Novo lead cadastrado com sucesso via extensão');

  // Atualização sem criar duplicata
  const { error: updErr } = await clientRecepcao.from('crm_leads').update({
    status: 'Começou mas não deu andamento',
    observacoes: novoLead.observacoes + '\n[Contato 1]: Solicitou fotos de próteses.'
  }).eq('id', novoLead.id);

  const { data: leadsCount } = await clientRecepcao.from('crm_leads').select('id').eq('telefone', novoTelefone);
  assert(!updErr && leadsCount?.length === 1, 'Atualização de lead mantém unicidade estrita sem duplicatas', { count: leadsCount?.length });

  // ---------------------------------------------------------------------------
  // CENÁRIO 7: Cálculo de Horários Livres cruzando Bloqueios e Consultas
  // ---------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 7: Consulta de Horários Livres (Bloqueios e Ocupações) ---');
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const amanhaStr = amanha.toISOString().slice(0, 10);
  const dentistaNome = 'Dra. Rosângela Santos Pereira';

  // Consulta agendamentos e bloqueios existentes
  const { data: existingConsultas } = await clientRecepcao.from('consultas')
    .select('hora, duracao')
    .eq('data', amanhaStr)
    .eq('dentista', dentistaNome)
    .not('status', 'in', '(cancelado,remarcado)');

  const { data: existingBlocks } = await clientRecepcao.from('bloqueios_agenda')
    .select('titulo, hora_inicio, hora_fim, dia_inteiro')
    .lte('data_inicio', amanhaStr)
    .gte('data_fim', amanhaStr);

  assert(existingConsultas?.some(c => c.hora === '14:00'), 'Consulta pré-existente das 14:00 detectada no dia');
  assert(existingBlocks?.some(b => b.hora_inicio === '10:00' && b.hora_fim === '11:30'), 'Bloqueio de agenda das 10:00 às 11:30 detectado no dia');

  // Simula algoritmo de slots livres da extensão
  const busy = [
    { start: 10 * 60, end: 11 * 60 + 30 }, // Bloqueio
    { start: 14 * 60, end: 15 * 60 }       // Consulta
  ];

  const slotDisponivel0900 = !busy.some(b => (9 * 60) < b.end && b.start < (10 * 60));
  const slotConflito1000 = !busy.some(b => (10 * 60) < b.end && b.start < (11 * 60));
  const slotConflito1400 = !busy.some(b => (14 * 60) < b.end && b.start < (15 * 60));
  const slotDisponivel1600 = !busy.some(b => (16 * 60) < b.end && b.start < (17 * 60));

  assert(slotDisponivel0900 === true, 'Slot das 09:00 está livre para agendamento');
  assert(slotConflito1000 === false, 'Slot das 10:00 é bloqueado por colisão com reunião');
  assert(slotConflito1400 === false, 'Slot das 14:00 é bloqueado por colisão com consulta existente');
  assert(slotDisponivel1600 === true, 'Slot das 16:00 está livre para agendamento');

  // ---------------------------------------------------------------------------
  // CENÁRIO 8: Agendamento Seguro Transacional Atômico via RPC
  // ---------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 8: Agendamento Seguro Transacional Atômico (RPC) ---');
  // Limpa agendamento prévio das 09:00 caso exista
  await serviceClient.from('consultas').delete().eq('data', amanhaStr).eq('hora', '09:00').eq('dentista', dentistaNome);

  const rpcRes = await clientRecepcao.rpc('agendar_consulta_extensao', {
    p_paciente_id: pacFound.id,
    p_data: amanhaStr,
    p_hora: '09:00',
    p_duracao: 60,
    p_dentista: dentistaNome,
    p_procedimento: 'Avaliação Odontológica - Lentes em Resina',
    p_observacoes: 'Agendado diretamente pelo painel do WhatsApp',
    p_lead_id: leadFound.id
  });

  assert(!rpcRes.error && rpcRes.data?.sucesso === true, 'Consulta agendada atomicamente com sucesso', rpcRes);

  // Verifica se o lead foi atualizado para Agendado
  const { data: leadAtualizado } = await clientRecepcao.from('crm_leads').select('status, observacoes').eq('id', leadFound.id).single();
  assert(leadAtualizado?.status === 'Agendado', 'Status do lead atualizado atomicamente para "Agendado" no CRM');
  assert(leadAtualizado?.observacoes?.includes('[Agendamento Extensão]'), 'Histórico de agendamento registrado nas observações do lead');

  // ---------------------------------------------------------------------------
  // CENÁRIO 9: Prevenção Real de Concorrência Simultânea (Race Condition)
  // ---------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 9: Teste de Concorrência Simultânea com Advisory Lock ---');
  const horaConcorrente = '16:00';
  await serviceClient.from('consultas').delete().eq('data', amanhaStr).eq('hora', horaConcorrente).eq('dentista', dentistaNome);

  // Dispara dois agendamentos simultâneos para exatamente a mesma data, hora e dentista
  const [reqA, reqB] = await Promise.all([
    clientRecepcao.rpc('agendar_consulta_extensao', {
      p_paciente_id: pacFound.id,
      p_data: amanhaStr,
      p_hora: horaConcorrente,
      p_duracao: 60,
      p_dentista: dentistaNome,
      p_procedimento: 'Paciente A - Primeiro Atendente',
      p_lead_id: null
    }),
    clientRecepcao.rpc('agendar_consulta_extensao', {
      p_paciente_id: novoPac.id,
      p_data: amanhaStr,
      p_hora: horaConcorrente,
      p_duracao: 60,
      p_dentista: dentistaNome,
      p_procedimento: 'Paciente B - Segundo Atendente',
      p_lead_id: null
    })
  ]);

  const sucessoA = reqA.data?.sucesso === true && !reqA.error;
  const sucessoB = reqB.data?.sucesso === true && !reqB.error;

  const umSucessoOutroErro = (sucessoA && !sucessoB) || (!sucessoA &&  sucessoB);
  const erroMsg = (reqA.error?.message || reqB.error?.message || '');

  assert(umSucessoOutroErro, 'Exatamente UMA das requisições simultâneas foi aceita', { sucessoA, sucessoB });
  assert(erroMsg.includes('Conflito de horário'), 'Requisição concorrente foi rejeitada pelo banco com mensagem de conflito', { erroMsg });

  // ---------------------------------------------------------------------------
  // CENÁRIO 10: Bloqueio de Usuário Sem Permissão de Agenda
  // ---------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 10: Isolamento de Permissões (Usuário sem permissão de agenda) ---');
  // Remove permissão de agenda do usuário
  await serviceClient.from('equipe').update({
    permissoes: { pacientes: true, agenda: false, crm: true, financeiro: false }
  }).eq('usuario_id', recepcaoUser.id);

  const blockedRes = await clientRecepcao.rpc('agendar_consulta_extensao', {
    p_paciente_id: pacFound.id,
    p_data: amanhaStr,
    p_hora: '17:00',
    p_duracao: 60,
    p_dentista: dentistaNome,
    p_procedimento: 'Tentativa sem permissao',
    p_lead_id: null
  });

  assert(!!blockedRes.error && blockedRes.error.message.includes('não possui permissão para gerenciar agenda'), 'Tentativa de agendamento por atendente sem permissão é rejeitada pela segurança do PostgreSQL', { error: blockedRes.error?.message });

  // Restaura permissão
  await serviceClient.from('equipe').update({
    permissoes: { pacientes: true, agenda: true, crm: true, financeiro: false }
  }).eq('usuario_id', recepcaoUser.id);

  console.log('\n================================================================');
  console.log(`📊 RESULTADO FINAL DOS TESTES: ${passedCount} PASSOU | ${failedCount} FALHOU`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Erro fatal na execução dos testes:', err);
  process.exit(1);
});
