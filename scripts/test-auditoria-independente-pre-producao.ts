import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Parser do .env.homolog
const rawEnv = fs.readFileSync('.env.homolog', 'utf-8');
const homologEnv: Record<string, string> = {};
for (const line of rawEnv.split('\n')) {
  const clean = line.trim();
  if (!clean || clean.startsWith('#')) continue;
  const eq = clean.indexOf('=');
  if (eq !== -1) homologEnv[clean.substring(0, eq).trim()] = clean.substring(eq + 1).trim();
}

const SUPABASE_URL = homologEnv.HOMOLOG_URL;
const ANON_KEY = homologEnv.HOMOLOG_SUPABASE_ANON_KEY;
const SERVICE_KEY = homologEnv.HOMOLOG_SUPABASE_SERVICE_ROLE_KEY;

const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY);
const PASS = 'PasswordSeguro123!';

async function runAudit() {
  console.log('================================================================');
  console.log('🛡️  AUDITORIA INDEPENDENTE PRÉ-PRODUÇÃO — EXTENSÃO WHATSAPP V2');
  console.log(`Ambiente Homologação: ${SUPABASE_URL}`);
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond: boolean, title: string, details?: any) {
    if (cond) {
      console.log(`✅ [AUDITORIA-PASS] ${title}`);
      passed++;
    } else {
      console.error(`❌ [AUDITORIA-FAIL] ${title}`);
      if (details) console.error('   Detalhes:', details);
      failed++;
    }
  }

  // 1. Localiza usuários de teste
  const { data: usersData } = await serviceClient.auth.admin.listUsers();
  const recepcaoUser = usersData?.users?.find(u => u.email?.includes('recepcao-rls'));
  const adminUser = usersData?.users?.find(u => u.email?.includes('admin-rls'));
  const outraClinicaUser = usersData?.users?.find(u => u.email?.includes('outraclinica-rls'));

  if (!recepcaoUser || !adminUser || !outraClinicaUser) {
    throw new Error('Usuários de homologação não localizados para a auditoria.');
  }

  console.log(`Clínica Principal (Admin): ${adminUser.email} (${adminUser.id})`);
  console.log(`Atendente Recepção: ${recepcaoUser.email} (${recepcaoUser.id})`);
  console.log(`Outra Clínica (Tenant B): ${outraClinicaUser.email} (${outraClinicaUser.id})\n`);

  // Garante membros de equipe
  await serviceClient.from('equipe').delete().eq('usuario_id', recepcaoUser.id);
  await serviceClient.from('equipe').insert({
    clinica_id: adminUser.id,
    usuario_id: recepcaoUser.id,
    nome: 'Atendente Recepção',
    email: recepcaoUser.email,
    permissoes: { pacientes: true, agenda: true, crm: true, financeiro: false }
  });

  // Autentica Recepção (Clínica A)
  const recepcaoAuth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: recepcaoUser.email, password: PASS })
  }).then(r => r.json());

  const clientRecepcao = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${recepcaoAuth.access_token}` } }
  });

  // Autentica Outra Clínica (Clínica B)
  const outraAuth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: outraClinicaUser.email, password: PASS })
  }).then(r => r.json());

  const clientOutraClinica = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${outraAuth.access_token}` } }
  });

  // ===========================================================================
  // AUDITORIA 1: Validação de Parâmetros e Proteção Cross-Tenant (SQL)
  // ===========================================================================
  console.log('--- 1. AUDITORIA DA FUNÇÃO SQL E PROTEÇÃO CROSS-TENANT ---');

  // Cria paciente pertencente exclusivamente à Clínica B (outraClinicaUser)
  const { data: pacClinicaB } = await serviceClient.from('pacientes').insert({
    user_id: outraClinicaUser.id,
    nome: 'Paciente Exclusivo Clinica B',
    telefone: '+5582987654321',
    status: 'Ativo'
  }).select().single();

  // Cria paciente pertencente à Clínica A (adminUser)
  const { data: pacClinicaA } = await serviceClient.from('pacientes').insert({
    user_id: adminUser.id,
    nome: 'Paciente Exclusivo Clinica A',
    telefone: '+5582991114455',
    status: 'Ativo'
  }).select().single();

  const dataAmanha = new Date();
  dataAmanha.setDate(dataAmanha.getDate() + 1);
  const dataAmanhaStr = dataAmanha.toISOString().slice(0, 10);
  const dentistaOficial = 'Dra. Rosângela Santos Pereira';

  // 1.1 Tentativa de agendar paciente de OUTRA clínica via extensão
  const rpcCrossTenant = await clientRecepcao.rpc('agendar_consulta_extensao', {
    p_paciente_id: pacClinicaB.id,
    p_data: dataAmanhaStr,
    p_hora: '08:30',
    p_duracao: 60,
    p_dentista: dentistaOficial,
    p_procedimento: 'Tentativa Invasão Cross-Tenant'
  });

  assert(
    !!rpcCrossTenant.error && rpcCrossTenant.error.message.includes('não pertence à clínica autorizada'),
    'Bloqueio estrito de acesso cross-tenant: Usuário não consegue agendar paciente de outra clínica',
    rpcCrossTenant.error?.message
  );

  // 1.2 Validação de horário inválido no servidor
  const rpcBadTime = await clientRecepcao.rpc('agendar_consulta_extensao', {
    p_paciente_id: pacClinicaA.id,
    p_data: dataAmanhaStr,
    p_hora: '25:99', // Horário impossível
    p_duracao: 60,
    p_dentista: dentistaOficial,
    p_procedimento: 'Teste horário inválido'
  });
  assert(
    !!rpcBadTime.error && rpcBadTime.error.message.includes('Horário inválido'),
    'Servidor valida formato e intervalo estrito de horário (HH:MI entre 00:00 e 23:59)',
    rpcBadTime.error?.message
  );

  // 1.3 Validação de duração absurda no servidor
  const rpcBadDuration = await clientRecepcao.rpc('agendar_consulta_extensao', {
    p_paciente_id: pacClinicaA.id,
    p_data: dataAmanhaStr,
    p_hora: '08:30',
    p_duracao: -30, // Duração negativa
    p_dentista: dentistaOficial,
    p_procedimento: 'Teste duração negativa'
  });
  assert(
    !!rpcBadDuration.error && rpcBadDuration.error.message.includes('Duração inválida'),
    'Servidor rejeita duração negativa ou fora dos limites seguros (15 a 480 min)',
    rpcBadDuration.error?.message
  );

  // ===========================================================================
  // AUDITORIA 2: Proteção do Sistema Principal vs. Extensão (Trigger de Conflito)
  // ===========================================================================
  console.log('\n--- 2. CONCORRÊNCIA E PREVENÇÃO DE BYPASS PELO SISTEMA PRINCIPAL ---');

  // Limpa agendamentos de teste (escolhe 12:30, horário fora do bloqueio das 10:00-11:30)
  const horaConflito = '12:30';
  await serviceClient.from('consultas').delete().eq('data', dataAmanhaStr).eq('hora', horaConflito).eq('dentista', dentistaOficial);

  // 2.1 Agendamento efetuado pela Extensão às 12:30
  const agendamentoExtensao = await clientRecepcao.rpc('agendar_consulta_extensao', {
    p_paciente_id: pacClinicaA.id,
    p_data: dataAmanhaStr,
    p_hora: horaConflito,
    p_duracao: 60,
    p_dentista: dentistaOficial,
    p_procedimento: 'Avaliação Extensão WhatsApp'
  });
  assert(!agendamentoExtensao.error && agendamentoExtensao.data?.sucesso === true, 'Extensão agenda consulta com sucesso às 12:30', agendamentoExtensao.error);

  // 2.2 Tentativa de agendamento simultâneo/posterior pelo SISTEMA PRINCIPAL (Direct INSERT) no mesmo horário
  const insertSistemaPrincipal = await clientRecepcao.from('consultas').insert({
    user_id: adminUser.id,
    paciente_id: pacClinicaA.id,
    paciente_nome: 'Paciente Tentando Mesma Hora',
    data: dataAmanhaStr,
    hora: horaConflito,
    duracao: 60,
    dentista: dentistaOficial,
    procedimento: 'Tentativa via Sistema Principal',
    status: 'agendado'
  });

  assert(
    !!insertSistemaPrincipal.error && insertSistemaPrincipal.error.message.includes('Conflito de horário'),
    'Sistema principal NÃO CONSEGUE contornar proteção contra conflitos (Trigger PostgreSQL impede direct INSERT duplicado)',
    insertSistemaPrincipal.error?.message
  );

  // 2.3 Tentativa de inserção direta pelo Sistema Principal em horário BLOQUEADO (10:00 - 11:30)
  const insertBloqueado = await clientRecepcao.from('consultas').insert({
    user_id: adminUser.id,
    paciente_id: pacClinicaA.id,
    paciente_nome: 'Paciente Tentando Horário Bloqueado',
    data: dataAmanhaStr,
    hora: '10:30', // Dentro do bloqueio de reunião 10:00 - 11:30
    duracao: 30,
    dentista: dentistaOficial,
    procedimento: 'Tentativa em Bloqueio',
    status: 'agendado'
  });

  assert(
    !!insertBloqueado.error && insertBloqueado.error.message.includes('Horário bloqueado na agenda'),
    'Sistema principal respeita bloqueios de agenda mesmo em inserções diretas via API',
    insertBloqueado.error?.message
  );

  // ===========================================================================
  // AUDITORIA 3: Auditoria do CRM e Preservação de Metadados
  // ===========================================================================
  console.log('\n--- 3. AUDITORIA DO CRM, CAMPANHAS E METADADOS DO META ADS ---');
  const telMeta = '+5582993335577';
  await serviceClient.from('crm_leads').delete().eq('telefone', telMeta);

  // Inserção com metadados ricos do Meta Ads
  const metaAdsPayload = {
    campanha: 'Campanha Sorriso Perfeito Black Nov',
    criativo: 'Anúncio Feed Vídeo Antes e Depois Dra Rose',
    isNew: true,
    origem: 'Meta Ads'
  };

  const { data: leadCriado } = await clientRecepcao.from('crm_leads').insert({
    nome: 'Paula Fernandes Meta',
    telefone: telMeta,
    email: 'paula.meta@teste.com',
    status: 'Pendente',
    origem: 'Meta Lead Ads',
    campanha: metaAdsPayload.campanha,
    observacoes: `Interessada em facetas de resina.\n[NOVOS_LEADS_META]:${JSON.stringify(metaAdsPayload)}`
  }).select().single();

  assert(!!leadCriado && leadCriado.id, 'Lead com metadados do Meta Ads cadastrado com sucesso');

  // Simula atualização do lead pela extensão (mudança de status + anotação de follow-up)
  const followupNota = '\n[FOLLOW-UP 09/11 10:30]: Cliente confirmou interesse para a próxima semana.';
  const obsAtualizada = leadCriado.observacoes + followupNota;

  const { error: updErr } = await clientRecepcao.from('crm_leads').update({
    status: 'Interessado',
    observacoes: obsAtualizada,
    data_atualizacao: new Date().toISOString()
  }).eq('id', leadCriado.id);

  const { data: leadVerificado } = await clientRecepcao.from('crm_leads').select('*').eq('id', leadCriado.id).single();

  const metaAindaPresente = leadVerificado?.observacoes?.includes('[NOVOS_LEADS_META]:{"campanha":"Campanha Sorriso Perfeito Black Nov"');
  const followupPresente = leadVerificado?.observacoes?.includes('Cliente confirmou interesse');

  assert(!updErr && metaAindaPresente === true && followupPresente === true, 'Metadados do Meta Ads e histórico de follow-up preservados intactos após atualização');

  // ===========================================================================
  // AUDITORIA 4: Segurança do Código-Fonte da Extensão
  // ===========================================================================
  console.log('\n--- 4. AUDITORIA DE SEGURANÇA NO CÓDIGO-FONTE DA EXTENSÃO ---');
  const extensionDir = 'chrome-extension/whatsapp-crm-rose';
  const extFiles = ['manifest.json', 'background.js', 'contact.js', 'panel.html', 'panel.css', 'panel.js'];

  let hasHardcodedPassword = false;
  let hasServiceRoleKey = false;

  for (const f of extFiles) {
    const fullPath = `${extensionDir}/${f}`;
    const code = fs.readFileSync(fullPath, 'utf-8');
    if (code.includes('service_role') || code.includes('HOMOLOG_SUPABASE_SERVICE_ROLE_KEY')) {
      hasServiceRoleKey = true;
      console.error(`Alerta: service_role referenciada em ${f}`);
    }
    if (code.includes('PasswordSeguro123!') || code.includes('secret_password')) {
      hasHardcodedPassword = true;
      console.error(`Alerta: Senha embutida em ${f}`);
    }
  }

  assert(!hasHardcodedPassword, 'Nenhuma senha ou credencial de teste embutida nos arquivos da extensão');
  assert(!hasServiceRoleKey, 'Nenhuma chave mestra (service_role) presente no código da extensão');

  // ===========================================================================
  // AUDITORIA 5: Teste Real Ponta a Ponta de Fluxo Integrado
  // ===========================================================================
  console.log('\n--- 5. TESTE INTEGRADO COMPLETO: EXTENSÃO <-> CRM <-> AGENDA ---');

  // Simula todo o ciclo do WhatsApp Web:
  // 1. Número capturado no WhatsApp: +55 82 99444-8899
  const telFluxo = '+5582994448899';
  await serviceClient.from('crm_leads').delete().eq('telefone', telFluxo);
  await serviceClient.from('pacientes').delete().eq('telefone', telFluxo);
  await serviceClient.from('consultas').delete().eq('data', dataAmanhaStr).eq('hora', '15:00').eq('dentista', dentistaOficial);

  // 2. Extensão cadastra paciente
  const { data: pacFluxo } = await clientRecepcao.from('pacientes').insert({
    user_id: adminUser.id,
    nome: 'Flávia Mendonça Teste Real',
    telefone: telFluxo,
    email: 'flavia.mendonca@teste.com',
    status: 'Ativo'
  }).select().single();

  // 3. Extensão cria lead no CRM
  const { data: leadFluxo } = await clientRecepcao.from('crm_leads').insert({
    nome: 'Flávia Mendonça Teste Real',
    telefone: telFluxo,
    email: 'flavia.mendonca@teste.com',
    status: 'Interessado',
    origem: 'WhatsApp',
    observacoes: 'Captado diretamente na conversa do WhatsApp Web.'
  }).select().single();

  assert(!!pacFluxo && !!leadFluxo, 'Etapa 1: Paciente e Lead criados com sucesso pela extensão');

  // 4. Extensão agenda avaliação para amanhã às 15:00
  const agendamentoFluxo = await clientRecepcao.rpc('agendar_consulta_extensao', {
    p_paciente_id: pacFluxo.id,
    p_data: dataAmanhaStr,
    p_hora: '15:00',
    p_duracao: 60,
    p_dentista: dentistaOficial,
    p_procedimento: 'Avaliação Odontológica Completa',
    p_observacoes: 'Agendado após triagem no WhatsApp',
    p_lead_id: leadFluxo.id
  });

  assert(!agendamentoFluxo.error && agendamentoFluxo.data?.sucesso === true, 'Etapa 2: Agendamento atômico confirmado');

  // 5. Confirma se aparece na agenda do sistema principal
  const { data: consultaNaAgenda } = await clientRecepcao.from('consultas')
    .select('*')
    .eq('id', agendamentoFluxo.data?.consulta_id)
    .single();

  assert(
    !!consultaNaAgenda && consultaNaAgenda.paciente_nome === 'Flávia Mendonça Teste Real' && consultaNaAgenda.hora === '15:00',
    'Etapa 3: Consulta sincronizada e visível imediatamente na agenda do sistema principal'
  );

  // 6. Confirma se o lead mudou para 'Agendado'
  const { data: leadAposAgendamento } = await clientRecepcao.from('crm_leads').select('*').eq('id', leadFluxo.id).single();
  assert(
    leadAposAgendamento?.status === 'Agendado' && leadAposAgendamento?.observacoes?.includes('[Agendamento Extensão]'),
    'Etapa 4: Lead atualizado automaticamente para "Agendado" com log de auditoria'
  );

  // 7. Confirma que não existem duplicatas
  const { data: totalPacs } = await clientRecepcao.from('pacientes').select('id').eq('telefone', telFluxo);
  const { data: totalLeads } = await clientRecepcao.from('crm_leads').select('id').eq('telefone', telFluxo);
  const { data: totalConsultas } = await clientRecepcao.from('consultas').select('id').eq('data', dataAmanhaStr).eq('hora', '15:00').eq('dentista', dentistaOficial);

  assert(
    totalPacs?.length === 1 && totalLeads?.length === 1 && totalConsultas?.length === 1,
    'Etapa 5: Unicidade estrita confirmada — zero duplicidades de paciente, lead ou consulta',
    { totalPacs: totalPacs?.length, totalLeads: totalLeads?.length, totalConsultas: totalConsultas?.length }
  );

  console.log('\n================================================================');
  console.log(`🛡️  RESULTADO DA AUDITORIA: ${passed} APROVADOS | ${failed} FALHAS`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runAudit().catch(err => {
  console.error('Erro na auditoria:', err);
  process.exit(1);
});
