import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

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

const supabase = createClient(homologEnv.HOMOLOG_URL, homologEnv.HOMOLOG_SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('=== SEMEANDO DADOS FICTÍCIOS NO AMBIENTE DE HOMOLOGAÇÃO ===');

  // 1. Obtém IDs dos usuários existentes ou cria usuários de teste
  const { data: users } = await supabase.auth.admin.listUsers();
  const adminUser = users?.users?.find(u => u.email?.includes('admin-rls') || u.email?.includes('drarosesantos')) || users?.users?.[0];
  const recepcaoUser = users?.users?.find(u => u.email?.includes('recepcao-rls')) || users?.users?.[1];

  console.log('Admin User ID:', adminUser?.id);
  console.log('Recepção User ID:', recepcaoUser?.id);

  const clinicaId = adminUser?.id || 'a52be922-e2cb-43a0-a11a-eab7b8b0c30f';

  // Cria / garante membro de equipe da recepção com permissões completas
  if (recepcaoUser) {
    const { data: existingEquipe } = await supabase.from('equipe').select('id').eq('usuario_id', recepcaoUser.id).limit(1);
    if (!existingEquipe || existingEquipe.length === 0) {
      await supabase.from('equipe').insert({
        clinica_id: clinicaId,
        usuario_id: recepcaoUser.id,
        nome: 'Atendente Recepção (Homologação)',
        email: recepcaoUser.email || 'recepcao@clinicarose-teste.com',
        permissoes: { pacientes: true, agenda: true, crm: true, financeiro: false, prontuarios: true }
      });
    }
  }

  // 2. Cria Dentista Ativo
  const { data: dentista } = await supabase.from('dentistas').upsert({
    user_id: clinicaId,
    nome: 'Dra. Rosângela Santos Pereira',
    cro: 'CRO-AL 1234',
    especialidade: 'Estética Dental e Lentes em Resina',
    telefone: '+5582993641813',
    email: 'drarosangela@clinicarose.com.br',
    ativo: true
  }).select().single();
  console.log('Dentista criado:', dentista?.nome);

  // 3. Cria Bloqueio de Teste (para amanhã às 10:00 - 11:30)
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const amanhaStr = amanha.toISOString().slice(0, 10);

  await supabase.from('bloqueios_agenda').upsert({
    user_id: clinicaId,
    titulo: 'Reunião Clínica / Manutenção',
    dentista: 'Dra. Rosângela Santos Pereira',
    data_inicio: amanhaStr,
    data_fim: amanhaStr,
    hora_inicio: '10:00',
    hora_fim: '11:30',
    dia_inteiro: false,
    observacoes: 'Horário bloqueado de teste'
  });
  console.log('Bloqueio criado para:', amanhaStr, '10:00 - 11:30');

  // 4. Cria Paciente de Teste
  let pacienteId: string | undefined;
  const { data: pacs } = await supabase.from('pacientes').select('id, nome').eq('telefone', '+5582991112233').limit(1);
  if (pacs && pacs.length > 0) {
    pacienteId = pacs[0].id;
  } else {
    const { data: pNovo } = await supabase.from('pacientes').insert({
      user_id: clinicaId,
      nome: 'Mariana Silva Teste',
      telefone: '+5582991112233',
      email: 'mariana.teste@exemplo.com',
      status: 'Ativo'
    }).select().single();
    pacienteId = pNovo?.id;
  }
  console.log('Paciente pronto:', pacienteId);

  // 5. Cria Consulta pré-existente de teste (para amanhã às 14:00 - 15:00)
  await supabase.from('consultas').delete().eq('data', amanhaStr).eq('hora', '14:00').eq('dentista', 'Dra. Rosângela Santos Pereira');
  await supabase.from('consultas').insert({
    user_id: clinicaId,
    paciente_id: pacienteId,
    paciente_nome: 'Mariana Silva Teste',
    data: amanhaStr,
    hora: '14:00',
    duracao: 60,
    dentista: 'Dra. Rosângela Santos Pereira',
    procedimento: 'Avaliação Odontológica',
    status: 'agendado'
  });
  console.log('Consulta existente criada para:', amanhaStr, '14:00 - 15:00');

  // 6. Cria Leads de teste no CRM
  await supabase.from('crm_leads').upsert([
    {
      nome: 'Mariana Silva Teste',
      telefone: '+5582991112233',
      phone: '+5582991112233',
      email: 'mariana.teste@exemplo.com',
      status: 'Pendente',
      origem: 'Meta Lead Ads',
      campanha: 'Campanha Lentes Resina Nov 2026',
      observacoes: 'Cliente interessada em lentes superiores.\n[NOVOS_LEADS_META]:{"criativo":"Vídeo Depoimento Sorriso Transformado","campanha":"Campanha Lentes Resina Nov 2026","isNew":true}'
    },
    {
      nome: 'Carlos Eduardo Teste',
      telefone: '+5582998887766',
      phone: '+5582998887766',
      email: 'carlos.teste@exemplo.com',
      status: 'Interessado',
      origem: 'WhatsApp',
      campanha: null,
      observacoes: 'Contato via WhatsApp pedindo informações de valores de clareamento.'
    }
  ]);
  console.log('Leads de teste criados em crm_leads!');
}

main().catch(console.error);
