import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

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

async function run() {
  console.log('=== TESTE DE ATUALIZAÇÃO SEM CONFLITO E TESTE ANTI-DEADLOCK ===\n');

  let passed = 0;
  let failed = 0;
  function assert(c: boolean, msg: string, d?: any) {
    if (c) {
      console.log(`✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${msg}`);
      if (d) console.error('   Detalhes:', d);
      failed++;
    }
  }

  const { data: usersData } = await serviceClient.auth.admin.listUsers();
  const recepcaoUser = usersData?.users?.find(u => u.email?.includes('recepcao-rls'));
  const adminUser = usersData?.users?.find(u => u.email?.includes('admin-rls'));

  const recepcaoAuth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: recepcaoUser?.email, password: PASS })
  }).then(r => r.json());

  const clientRecepcao = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${recepcaoAuth.access_token}` } }
  });

  const testDate = '2026-11-20';
  const dentista = 'Dra. Rosângela Santos Pereira';

  // Limpa agendamentos anteriores do dia de teste
  await serviceClient.from('consultas').delete().eq('data', testDate);
  await serviceClient.from('bloqueios_agenda').delete().eq('data_inicio', testDate);

  // Cria bloqueio de teste das 14:00 às 16:00
  await serviceClient.from('bloqueios_agenda').insert({
    user_id: adminUser.id,
    titulo: 'Bloqueio Manutenção de Equipamentos',
    dentista: dentista,
    data_inicio: testDate,
    data_fim: testDate,
    hora_inicio: '14:00',
    hora_fim: '16:00',
    dia_inteiro: false
  });

  // Cria ou localiza paciente válido da clínica do admin
  let pac = (await serviceClient.from('pacientes').select('id, nome').eq('user_id', adminUser.id).limit(1))[0];
  if (!pac) {
    const { data: novoP } = await serviceClient.from('pacientes').insert({
      user_id: adminUser.id,
      nome: 'Paciente Valido Clinica Admin',
      telefone: '+5582991118822',
      status: 'Ativo'
    }).select().single();
    pac = novoP;
  }
  const { data: c1, error: errC1 } = await clientRecepcao.from('consultas').insert({
    user_id: adminUser.id,
    paciente_id: pac.id,
    paciente_nome: pac.nome,
    data: testDate,
    hora: '09:00',
    duracao: 60,
    dentista: dentista,
    procedimento: 'Avaliação Inicial',
    status: 'agendado',
    observacoes: 'Nota original'
  }).select().single();

  assert(!errC1 && !!c1, 'Consulta inicial criada com sucesso às 09:00');

  // TESTE 1: Atualização de campos não relacionados a horário (observações, status, valor)
  const { error: errUpdateObs } = await clientRecepcao.from('consultas').update({
    observacoes: 'Nova observação clínica adicionada pelo doutor.',
    status: 'confirmado',
    valor: 450.00
  }).eq('id', c1.id);

  assert(!errUpdateObs, 'Trigger permite atualização instantânea de observações, status e valor sem reexecutar trava');

  // TESTE 2: Cancelamento de consulta libera o horário
  const { error: errCancel } = await clientRecepcao.from('consultas').update({
    status: 'cancelado'
  }).eq('id', c1.id);

  assert(!errCancel, 'Consulta cancelada com sucesso');

  // Novo agendamento exatamente no mesmo horário das 09:00 (que agora está cancelado)
  const { data: c2, error: errC2 } = await clientRecepcao.from('consultas').insert({
    user_id: adminUser.id,
    paciente_id: pac.id,
    paciente_nome: 'Segundo Paciente',
    data: testDate,
    hora: '09:00',
    duracao: 60,
    dentista: dentista,
    procedimento: 'Novo Atendimento',
    status: 'agendado'
  }).select().single();

  assert(!errC2 && !!c2, 'Horário de consulta cancelada foi reutilizado com sucesso sem colisão');

  // TESTE 3: Remarcação para horário com bloqueio é barrada
  const { error: errRescheduleBlock } = await clientRecepcao.from('consultas').update({
    hora: '14:30' // Horário dentro do bloqueio 14:00-16:00
  }).eq('id', c2.id);

  assert(
    !!errRescheduleBlock && errRescheduleBlock.message.includes('Horário bloqueado na agenda'),
    'Remarcação para horário bloqueado é estritamente impedida pelo trigger',
    errRescheduleBlock?.message
  );

  // TESTE 4: Teste de ausência de deadlocks com chamadas concorrentes rápidas
  console.log('\n--- Teste de estresse concorrente anti-deadlock ---');
  let deadlockCount = 0;
  let successCount = 0;
  let conflictCount = 0;

  const promises = [];
  for (let i = 0; i < 6; i++) {
    promises.push(
      clientRecepcao.rpc('agendar_consulta_extensao', {
        p_paciente_id: pac.id,
        p_data: testDate,
        p_hora: '11:00',
        p_duracao: 60,
        p_dentista: dentista,
        p_procedimento: `Concorrente ${i}`,
        p_lead_id: null
      }).then(res => {
        if (!res.error && res.data?.sucesso) successCount++;
        else if (res.error?.message?.includes('Conflito')) conflictCount++;
        else if (res.error?.code === '40P01' || res.error?.message?.includes('deadlock')) deadlockCount++;
        else console.warn('Erro concorrente inesperado:', res.error);
      })
    );
  }

  await Promise.all(promises);

  assert(successCount === 1, 'Exatamente 1 das 6 requisições concorrentes foi agendada', { successCount });
  assert(conflictCount === 5, 'As outras 5 requisições foram rejeitadas por conflito limpo', { conflictCount });
  assert(deadlockCount === 0, 'Zero deadlocks detectados (40P01 = 0)', { deadlockCount });

  console.log(`\nResultado: ${passed} PASSOU | ${failed} FALHOU`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
