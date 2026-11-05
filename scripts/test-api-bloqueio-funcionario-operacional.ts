import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import {
  HOMOLOG_URL,
  HOMOLOG_SERVICE_KEY,
  validarAmbienteHomologacao,
} from './guard-homologacao';

// Trava estrita de segurança: garante 100% que executa em homologação
validarAmbienteHomologacao(HOMOLOG_URL, 'Teste Bloqueio API Funcionário Operacional');

process.env.VITE_SUPABASE_URL = HOMOLOG_URL;
process.env.HOMOLOG_URL = HOMOLOG_URL;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = HOMOLOG_SERVICE_KEY;
process.env.HOMOLOG_SUPABASE_ANON_KEY = HOMOLOG_SERVICE_KEY;

async function main() {
  console.log('================================================================================');
  console.log('TESTE DIRETO VIA API SUPABASE: BLOQUEIO DE FUNCIONÁRIO OPERACIONAL DO FINANCEIRO');
  console.log('Ambiente:', HOMOLOG_URL);
  console.log('================================================================================\n');

  const adminClient = createClient(HOMOLOG_URL, HOMOLOG_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const timestamp = Date.now();
  const testSuffix = timestamp.toString().slice(-6);

  let passed = 0;
  let failed = 0;

  function assert(cond: boolean, desc: string, detail?: string) {
    if (cond) {
      console.log(`  ✓ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${desc}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // 1. SETUP DE USUÁRIOS E PERMISSÕES EM HOMOLOGAÇÃO
  // ---------------------------------------------------------------------------
  console.log('--- 1. Criando Usuário Operacional com Acesso ao Financeiro e Configurações ---');
  
  // A. Titular da Clínica
  const titularEmail = `titular-${testSuffix}@clinica-teste.com`;
  const titularPassword = `Titular#2026_${testSuffix}`;
  const { data: userTitular, error: errTit } = await adminClient.auth.admin.createUser({
    email: titularEmail,
    password: titularPassword,
    email_confirm: true,
  });
  if (errTit) throw errTit;
  const titularId = userTitular.user.id;

  // Vincula role admin para o titular
  await adminClient.from('user_roles').insert({
    user_id: titularId,
    role: 'admin',
    clinica_id: titularId,
  });

  // B. Funcionário Operacional do Financeiro
  // Possui configuracoes: true e financeiro: true, mas NÃO possui permissão de exclusão administrativa
  const operadorEmail = `financeiro.operacional-${testSuffix}@clinica-teste.com`;
  const operadorPassword = `Operador#2026_${testSuffix}`;
  const { data: userOperador, error: errOp } = await adminClient.auth.admin.createUser({
    email: operadorEmail,
    password: operadorPassword,
    email_confirm: true,
  });
  if (errOp) throw errOp;
  const operadorId = userOperador.user.id;

  // Vincula equipe para o operador com configuracoes: true e financeiro: true
  // mas role operacional ('recepcao' / 'financeiro_operacional') e admin: false
  await adminClient.from('equipe').insert({
    clinica_id: titularId,
    usuario_id: operadorId,
    nome: `Operador Financeiro ${testSuffix}`,
    email: operadorEmail,
    permissoes: {
      financeiro: true,
      configuracoes: true,
      agenda: true,
      pacientes: true,
      admin: false,
      role: 'financeiro_operacional',
      exclusao_financeira: false,
      admin_financeiro: false,
    },
  });

  // Garante que o operador NÃO possui role 'admin' em user_roles
  await adminClient.from('user_roles').insert({
    user_id: operadorId,
    role: 'recepcao',
    clinica_id: titularId,
  });

  console.log(`  Titular da Clínica: ${titularEmail} (${titularId})`);
  console.log(`  Funcionário Operacional: ${operadorEmail} (${operadorId})`);
  console.log('  Permissões do Operador: financeiro=true, configuracoes=true, admin=false, exclusao_financeira=false');

  // C. Autentica o Operador para obter JWT de sessão real
  const operadorClient = createClient(HOMOLOG_URL, HOMOLOG_SERVICE_KEY, {
    auth: { persistSession: false },
  });
  const { data: authOp, error: errAuthOp } = await operadorClient.auth.signInWithPassword({
    email: operadorEmail,
    password: operadorPassword,
  });
  if (errAuthOp) throw errAuthOp;
  const operadorToken = authOp.session.access_token;

  // Cria cliente autenticado como o OPERADOR usando o JWT oficial
  const clientAutenticadoOperador = createClient(HOMOLOG_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY || HOMOLOG_SERVICE_KEY, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${operadorToken}`,
      },
    },
  });

  // D. Autentica o Titular para obter JWT de sessão real
  const { data: authTit, error: errAuthTit } = await adminClient.auth.signInWithPassword({
    email: titularEmail,
    password: titularPassword,
  });
  if (errAuthTit) throw errAuthTit;
  const titularToken = authTit.session.access_token;

  const clientAutenticadoTitular = createClient(HOMOLOG_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY || HOMOLOG_SERVICE_KEY, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${titularToken}`,
      },
    },
  });

  // E. Cria Paciente e Orçamento de Teste
  const pacienteId = crypto.randomUUID();
  await adminClient.from('pacientes').insert({
    id: pacienteId,
    nome: `Paciente Teste ${testSuffix}`,
    cpf: `555.${testSuffix.slice(0, 3)}.${testSuffix.slice(3, 6)}-00`,
  });

  const orcamentoId = crypto.randomUUID();
  await adminClient.from('orcamentos').insert({
    id: orcamentoId,
    user_id: titularId,
    paciente_id: pacienteId,
    total: 2500.0,
    valor_total: 2500.0,
    desconto: 0,
    status: 'enviado',
    identificador: `ORC-TEST-${testSuffix}`,
    itens: [{ id: '1', nome: 'Procedimento Teste', quantidade: 1, valor: 2500.0 }],
  });

  // ---------------------------------------------------------------------------
  // 2. TESTE 1: TENTATIVA DE DELETE FÍSICO PELO OPERADOR (DEVE SER BLOQUEADO)
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. TESTE 1: Operador tentando DELETE físico direto via API ---');
  const { data: delResult, error: delError } = await clientAutenticadoOperador
    .from('orcamentos')
    .delete()
    .eq('id', orcamentoId)
    .select('id');

  const bloqueouDelete = !delResult || delResult.length === 0;
  assert(
    bloqueouDelete,
    'RLS orcamentos_delete_admin BLOQUEOU exclusão física para funcionário operacional (0 linhas afetadas)',
    delError?.message
  );

  // Confirma que o orçamento permanece no banco
  const { data: orcCheck1 } = await adminClient.from('orcamentos').select('id').eq('id', orcamentoId).single();
  assert(Boolean(orcCheck1), 'Orçamento permanece 100% INTACTO no banco de dados');

  // ---------------------------------------------------------------------------
  // 3. TESTE 2: TENTATIVA DE CANCELAMENTO PELO OPERADOR (DEVE SER BLOQUEADO)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. TESTE 2: Operador tentando UPDATE status = cancelado via API ---');
  const { data: updCancel, error: errCancel } = await clientAutenticadoOperador
    .from('orcamentos')
    .update({ status: 'cancelado' })
    .eq('id', orcamentoId)
    .select('id');

  const bloqueouCancel = Boolean(errCancel) || !updCancel || updCancel.length === 0;
  const erroEsperadoCancel = errCancel?.message?.includes('Apenas administradores') || errCancel?.code === '42501';
  assert(
    bloqueouCancel,
    'Trigger trg_proteger_colunas_orcamentos_equipe BLOQUEOU cancelamento por funcionário operacional',
    `Código: ${errCancel?.code} | Mensagem: ${errCancel?.message}`
  );
  if (erroEsperadoCancel) {
    console.log(`    Mensagem da trava de segurança do backend: "${errCancel?.message}"`);
  }

  // ---------------------------------------------------------------------------
  // 4. TESTE 3: TENTATIVA DE CONCILIAÇÃO/ALTERAÇÃO DE PACIENTE PELO OPERADOR
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. TESTE 3: Operador tentando alterar paciente_id (conciliação) via API ---');
  const outroPacienteId = crypto.randomUUID();
  const { data: updPac, error: errPac } = await clientAutenticadoOperador
    .from('orcamentos')
    .update({ paciente_id: outroPacienteId })
    .eq('id', orcamentoId)
    .select('id');

  const bloqueouConciliacao = Boolean(errPac) || !updPac || updPac.length === 0;
  const erroEsperadoPac = errPac?.message?.includes('Apenas administradores') || errPac?.code === '42501';
  assert(
    bloqueouConciliacao,
    'Trigger BLOQUEOU alteração de paciente_id (conciliação) por funcionário operacional',
    `Código: ${errPac?.code} | Mensagem: ${errPac?.message}`
  );
  if (erroEsperadoPac) {
    console.log(`    Mensagem da trava de segurança do backend: "${errPac?.message}"`);
  }

  // ---------------------------------------------------------------------------
  // 5. TESTE 4: OPERAÇÃO EXECUTADA PELO TITULAR DA CLÍNICA (DEVE SER PERMITIDA)
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. TESTE 4: Titular legítimo da clínica executando cancelamento/exclusão ---');
  
  // A. Cancelamento pelo Titular
  const { data: titCancel, error: errTitCancel } = await clientAutenticadoTitular
    .from('orcamentos')
    .update({ status: 'cancelado' })
    .eq('id', orcamentoId)
    .select('id, status');

  assert(
    !errTitCancel && titCancel && titCancel.length > 0 && titCancel[0].status === 'cancelado',
    'Titular da clínica autorizado com sucesso a cancelar orçamento (Reconhecimento legítimo preservado)',
    errTitCancel?.message
  );

  // B. Exclusão física pelo Titular
  const { data: titDel, error: errTitDel } = await clientAutenticadoTitular
    .from('orcamentos')
    .delete()
    .eq('id', orcamentoId)
    .select('id');

  assert(
    !errTitDel && titDel && titDel.length > 0,
    'Titular da clínica autorizado com sucesso a excluir registro (Exclusão física confirmada)',
    errTitDel?.message
  );

  const { data: checkDeleted } = await adminClient.from('orcamentos').select('id').eq('id', orcamentoId).maybeSingle();
  assert(checkDeleted === null, 'Registro foi removido do banco pelo titular autorizado');

  // ---------------------------------------------------------------------------
  // LIMPEZA FINAL DOS DADOS DE TESTE EM HOMOLOGAÇÃO
  // ---------------------------------------------------------------------------
  console.log('\n--- LIMPEZA: Removendo registros do teste de autorização em homologação ---');
  await adminClient.from('pacientes').delete().eq('id', pacienteId);
  await adminClient.from('equipe').delete().eq('usuario_id', operadorId);
  await adminClient.from('user_roles').delete().in('user_id', [titularId, operadorId]);
  await adminClient.auth.admin.deleteUser(operadorId);
  await adminClient.auth.admin.deleteUser(titularId);
  console.log('  ✓ Dados e credenciais de teste removidos de homologação.');

  console.log('\n================================================================================');
  console.log(`RESULTADO FINAL: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('================================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Erro fatal durante o teste direto da API:', err);
  process.exit(1);
});
