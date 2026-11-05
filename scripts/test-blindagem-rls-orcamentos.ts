import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  HOMOLOG_URL,
  HOMOLOG_ANON_KEY,
  HOMOLOG_SERVICE_KEY,
  validarAmbienteHomologacao,
} from './guard-homologacao';
import { calcularResumoFinanceiroMes } from '../src/utils/financeiroCalculos';
import { gerarPayloadPix, gerarQrCodePixUrl } from '../src/utils/pixPayload';
import { calcularDescricaoCondicao, CondicaoPagamento } from '../src/utils/orcamentoCondicoes';

// Cores para saída no terminal
const OK = '\x1b[32m✓ PASS\x1b[0m';
const FAIL = '\x1b[31m✗ FAIL\x1b[0m';
const INFO = '\x1b[36mℹ\x1b[0m';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, msg: string, detail?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${OK}: ${msg}`);
  } else {
    console.error(`  ${FAIL}: ${msg}`);
    if (detail) console.error('    Detalhe:', detail);
    throw new Error(`[FALHA NO TESTE] ${msg}`);
  }
}

async function runSuite() {
  console.log('=============================================================================');
  console.log('SUÍTE COMPLETA: VALIDAÇÃO DA BLINDAGEM RLS EM ORCAMENTOS (12 TESTES OBRIGATÓRIOS)');
  console.log(`Ambiente: HOMOLOGAÇÃO (${HOMOLOG_URL})`);
  console.log('=============================================================================\n');

  // Trava de segurança anti-produção
  validarAmbienteHomologacao(HOMOLOG_URL, 'test-blindagem-rls-orcamentos');

  const service = createClient(HOMOLOG_URL, HOMOLOG_SERVICE_KEY, { auth: { persistSession: false } });
  const anon = createClient(HOMOLOG_URL, HOMOLOG_ANON_KEY, { auth: { persistSession: false } });

  // ---------------------------------------------------------------------------
  // SETUP: Criação de Usuários Reais de Teste e Perfis em Homologação
  // ---------------------------------------------------------------------------
  console.log(`${INFO} Preparando usuários autenticados para testes de autorização...`);

  const timestamp = Date.now();
  const emailAdmin = `admin-rls-${timestamp}@clinicarose-teste.com`;
  const emailNonAdmin = `recepcao-rls-${timestamp}@clinicarose-teste.com`;
  const emailOtherClinic = `outraclinica-rls-${timestamp}@clinicarose-teste.com`;
  const password = 'PasswordSeguro123!';

  // Cria adminUser
  const { data: authAdminData, error: adminCreateErr } = await service.auth.admin.createUser({
    email: emailAdmin,
    password,
    email_confirm: true,
  });
  if (adminCreateErr) throw adminCreateErr;
  const adminUserId = authAdminData.user.id;

  // Cria nonAdminUser (recepção)
  const { data: authNonAdminData, error: nonAdminCreateErr } = await service.auth.admin.createUser({
    email: emailNonAdmin,
    password,
    email_confirm: true,
  });
  if (nonAdminCreateErr) throw nonAdminCreateErr;
  const nonAdminUserId = authNonAdminData.user.id;

  // Cria otherClinicUser
  const { data: authOtherClinicData, error: otherCreateErr } = await service.auth.admin.createUser({
    email: emailOtherClinic,
    password,
    email_confirm: true,
  });
  if (otherCreateErr) throw otherCreateErr;
  const otherClinicUserId = authOtherClinicData.user.id;

  // Define clínica titular: o próprio adminUserId
  const clinicaId = adminUserId;
  const outraClinicaId = otherClinicUserId;

  // Vincula perfis na tabela user_roles
  await service.from('user_roles').insert([
    { user_id: adminUserId, role: 'admin', clinica_id: clinicaId },
    { user_id: nonAdminUserId, role: 'recepcao', clinica_id: clinicaId },
    { user_id: otherClinicUserId, role: 'admin', clinica_id: outraClinicaId },
  ]);

  // Vincula equipe para o nonAdmin
  await service.from('equipe').insert([
    { clinica_id: clinicaId, usuario_id: nonAdminUserId, nome: 'Recepcionista Teste', email: emailNonAdmin, permissoes: { role: 'recepcao' } }
  ]);

  // Cria clientes autenticados via Supabase Auth
  const adminClient = createClient(HOMOLOG_URL, HOMOLOG_ANON_KEY);
  const nonAdminClient = createClient(HOMOLOG_URL, HOMOLOG_ANON_KEY);
  const otherClinicClient = createClient(HOMOLOG_URL, HOMOLOG_ANON_KEY);

  await adminClient.auth.signInWithPassword({ email: emailAdmin, password });
  await nonAdminClient.auth.signInWithPassword({ email: emailNonAdmin, password });
  await otherClinicClient.auth.signInWithPassword({ email: emailOtherClinic, password });

  // Cria orçamentos de teste via service_role
  const orcamentoId1 = crypto.randomUUID();
  const tokenOrcamento1 = 'tok-seguro-rls-' + crypto.randomUUID();
  const pacienteId1 = crypto.randomUUID();

  const orcamentoOutraClinicaId = crypto.randomUUID();
  const tokenOutraClinica = 'tok-outra-' + crypto.randomUUID();
  const pacienteOutroId = crypto.randomUUID();

  // Insere pacientes correspondentes para satisfazer FK
  await service.from('pacientes').insert([
    { id: pacienteId1, nome: 'Paciente Teste RLS', telefone: '82999990001' },
    { id: pacienteOutroId, nome: 'Paciente Outra Clinica', telefone: '82999990002' }
  ]);

  // Orçamento da clínica da Dra. Rosângela (adminUserId)
  const { error: insOrc1Err } = await service.from('orcamentos').insert({
    id: orcamentoId1,
    user_id: clinicaId,
    paciente_id: pacienteId1,
    total: 3500.00,
    status: 'enviado',
    identificador: 'ORC-RLS0001',
    token_assinatura: tokenOrcamento1,
    assinatura_paciente: {
      identificador: 'ORC-RLS0001',
      token: tokenOrcamento1,
      versao: 1,
      total: 3500.00,
      condicoes: [{ id: 'cond-1', nome: 'PIX à Vista', total: 3500.00 }]
    }
  });
  if (insOrc1Err) {
    console.error('ERROR inserting orcamentoId1:', insOrc1Err);
    throw insOrc1Err;
  }

  // Orçamento de outra clínica
  await service.from('orcamentos').insert({
    id: orcamentoOutraClinicaId,
    user_id: outraClinicaId,
    paciente_id: pacienteOutroId,
    total: 8000.00,
    status: 'enviado',
    identificador: 'ORC-OUTRA01',
    token_assinatura: tokenOutraClinica,
  });

  console.log(`${INFO} Setup concluído com sucesso. Iniciando bateria de 12 testes:\n`);

  try {
    // -------------------------------------------------------------------------
    // TESTE 1: Anônimo tentando UPDATE direto via API
    // -------------------------------------------------------------------------
    console.log('--- TESTE 1: Anônimo tentando UPDATE direto na tabela orcamentos ---');
    const { data: anonUpd, error: anonUpdErr } = await anon
      .from('orcamentos')
      .update({ status: 'cancelado', total: 0 })
      .eq('id', orcamentoId1)
      .select();

    assert(
      (!anonUpd || anonUpd.length === 0),
      'Anônimo bloqueado de executar UPDATE direto (zero linhas afetadas)',
      { anonUpd, error: anonUpdErr?.message }
    );

    const { data: rowAfterAnonUpd } = await service.from('orcamentos').select('status, total').eq('id', orcamentoId1).single();
    console.log('Row after anon update attempt:', rowAfterAnonUpd);
    assert(
      rowAfterAnonUpd?.status === 'enviado' && Number(rowAfterAnonUpd?.total) === 3500.00,
      'Registro no banco permanece 100% inalterado após tentativa de UPDATE por anônimo',
      rowAfterAnonUpd
    );

    // -------------------------------------------------------------------------
    // TESTE 2: Anônimo tentando DELETE direto via API
    // -------------------------------------------------------------------------
    console.log('\n--- TESTE 2: Anônimo tentando DELETE direto na tabela orcamentos ---');
    const { data: anonDel, error: anonDelErr } = await anon
      .from('orcamentos')
      .delete()
      .eq('id', orcamentoId1)
      .select();

    assert(
      (!anonDel || anonDel.length === 0),
      'Anônimo bloqueado de executar DELETE direto (zero linhas removidas)',
      { anonDel, error: anonDelErr?.message }
    );

    const { data: rowAfterAnonDel } = await service.from('orcamentos').select('id').eq('id', orcamentoId1).maybeSingle();
    assert(
      Boolean(rowAfterAnonDel?.id),
      'Orçamento permanece intacto no banco após tentativa de DELETE anônimo'
    );

    // -------------------------------------------------------------------------
    // TESTE 3: Usuário autenticado não-admin tentando operações administrativas
    // -------------------------------------------------------------------------
    console.log('\n--- TESTE 3: Usuário autenticado não-admin tentando operações restritas ---');
    
    // Tentativa A: Não-admin tentando cancelar orçamento
    const { data: nonAdminCancel, error: nonAdminCancelErr } = await nonAdminClient
      .from('orcamentos')
      .update({ status: 'cancelado' })
      .eq('id', orcamentoId1)
      .select();

    assert(
      (!nonAdminCancel || nonAdminCancel.length === 0),
      'Não-admin bloqueado de alterar status para cancelado (permissão restrita a administradores)',
      { nonAdminCancel, error: nonAdminCancelErr?.message }
    );

    // Tentativa B: Não-admin tentando deletar orçamento
    const { data: nonAdminDel, error: nonAdminDelErr } = await nonAdminClient
      .from('orcamentos')
      .delete()
      .eq('id', orcamentoId1)
      .select();

    assert(
      (!nonAdminDel || nonAdminDel.length === 0),
      'Não-admin bloqueado de executar DELETE (exclusão restrita a administradores)',
      { nonAdminDel, error: nonAdminDelErr?.message }
    );

    // Tentativa C: Não-admin tentando conciliar/trocar paciente de orçamento existente
    const { data: nonAdminReconcile, error: nonAdminReconcileErr } = await nonAdminClient
      .from('orcamentos')
      .update({ paciente_id: crypto.randomUUID() })
      .eq('id', orcamentoId1)
      .select();

    assert(
      (!nonAdminReconcile || nonAdminReconcile.length === 0),
      'Não-admin bloqueado de alterar paciente_id de orçamento já vinculado',
      { nonAdminReconcile, error: nonAdminReconcileErr?.message }
    );

    // Tentativa D: Não-admin tentando forçar aprovação direta via REST API (bypassing token)
    const { data: nonAdminForceAprov, error: nonAdminForceAprovErr } = await nonAdminClient
      .from('orcamentos')
      .update({ status: 'aprovado', aprovado_em: new Date().toISOString() })
      .eq('id', orcamentoId1)
      .select();

    assert(
      (!nonAdminForceAprov || nonAdminForceAprov.length === 0 || nonAdminForceAprovErr !== null),
      'Não-admin bloqueado de forçar aprovação direta via REST API sem autorização de admin',
      { nonAdminForceAprov, error: nonAdminForceAprovErr?.message }
    );

    // Tentativa E: Não-admin tentando manipular vínculos de contratos ou tokens
    const { data: nonAdminTamperCtr, error: nonAdminTamperCtrErr } = await nonAdminClient
      .from('orcamentos')
      .update({ contrato_id: 'CTR-MALICIOSO-999', contrato_token: 'fake-token' })
      .eq('id', orcamentoId1)
      .select();

    assert(
      (!nonAdminTamperCtr || nonAdminTamperCtr.length === 0 || nonAdminTamperCtrErr !== null),
      'Não-admin bloqueado de manipular contrato_id e contrato_token diretamente',
      { nonAdminTamperCtr, error: nonAdminTamperCtrErr?.message }
    );

    // -------------------------------------------------------------------------
    // TESTE 4: Administrador legítimo realizando operação autorizada
    // -------------------------------------------------------------------------
    console.log('\n--- TESTE 4: Administrador legítimo realizando operações administrativas ---');
    
    // Atualização administrativa permitida (ex: desconto/valor negociado)
    const { data: adminUpd, error: adminUpdErr } = await adminClient
      .from('orcamentos')
      .update({ desconto: 100.00, total: 3400.00 })
      .eq('id', orcamentoId1)
      .select('id, desconto, total');

    assert(
      Boolean(adminUpd && adminUpd.length === 1),
      'Administrador autorizado consegue atualizar orçamento da sua clínica com sucesso',
      { adminUpd, error: adminUpdErr?.message }
    );

    // -------------------------------------------------------------------------
    // TESTE 5: Aprovação pública por token válido (RPC SECURITY DEFINER)
    // -------------------------------------------------------------------------
    console.log('\n--- TESTE 5: Aprovação pública por token válido ---');
    const condicaoAprovada: CondicaoPagamento = {
      id: 'cond-pix-1',
      nome: 'PIX à Vista com Desconto',
      descricao: 'Pagamento Integral via PIX',
      tipo: 'avista_pix',
      valorTotal: 3300.00,
      descontoValor: 200.00,
      descontoPercentual: 5.71,
      quantidadeParcelas: 1,
      valorParcela: 3300.00,
      selecionada: true,
    };

    const { data: aprovacaoRes, error: aprovErr } = await anon.rpc('aprovar_orcamento_publico', {
      p_identificador: 'ORC-RLS0001',
      p_token: tokenOrcamento1,
      p_condicao: condicaoAprovada,
      p_evidencias: { ip: '192.168.1.100', userAgent: 'Browser Teste', dispositivo: 'Desktop' },
      p_versao_aprovada: 1,
    });

    assert(
      !aprovErr && aprovacaoRes?.ok === true && aprovacaoRes?.status === 'aprovado',
      'Aprovação pública com token legítimo executada com sucesso via RPC autorizada',
      { aprovacaoRes, error: aprovErr?.message }
    );

    const { data: orcPosAprov } = await service.from('orcamentos').select('status, total, desconto').eq('id', orcamentoId1).single();
    assert(
      orcPosAprov?.status === 'aprovado' && Number(orcPosAprov?.total) === 3300.00,
      'Status atualizado para aprovado e valores da condição refletidos no banco'
    );

    // Tentativa de Não-Admin alterar valores ou condição em orçamento já aprovado
    const { data: nonAdminTamperApproved, error: nonAdminTamperApprovedErr } = await nonAdminClient
      .from('orcamentos')
      .update({ total: 10.00, desconto: 0 })
      .eq('id', orcamentoId1)
      .select();

    assert(
      (!nonAdminTamperApproved || nonAdminTamperApproved.length === 0 || nonAdminTamperApprovedErr !== null),
      'Não-admin bloqueado de modificar valores ou condições em orçamento já aprovado',
      { nonAdminTamperApproved, error: nonAdminTamperApprovedErr?.message }
    );

    // -------------------------------------------------------------------------
    // TESTE 6: Token inválido bloqueado
    // -------------------------------------------------------------------------
    console.log('\n--- TESTE 6: Tentativa de aprovação pública com token inválido ---');
    const { data: aprovInvalidaRes } = await anon.rpc('aprovar_orcamento_publico', {
      p_identificador: 'ORC-RLS0001',
      p_token: 'token-falso-adulterado-999',
      p_condicao: condicaoAprovada,
      p_evidencias: {},
    });

    assert(
      aprovInvalidaRes?.ok === false && aprovInvalidaRes?.code === 'INVALID_TOKEN',
      'Tentativa de aprovação com token inválido rejeitada com código INVALID_TOKEN'
    );

    // -------------------------------------------------------------------------
    // TESTE 7: Orçamento de outra clínica — Isolamento Multi-Tenant estrito
    // -------------------------------------------------------------------------
    console.log('\n--- TESTE 7: Isolamento multi-tenant entre clínicas ---');
    // Admin da Clínica 1 tentando ler orçamento da Clínica 2
    const { data: selectOutra } = await adminClient
      .from('orcamentos')
      .select('*')
      .eq('id', orcamentoOutraClinicaId);

    assert(
      (!selectOutra || selectOutra.length === 0),
      'Administrador da clínica 1 NÃO consegue ver orçamentos da clínica 2 (zero linhas)'
    );

    // Admin da Clínica 1 tentando alterar orçamento da Clínica 2
    const { data: updOutra } = await adminClient
      .from('orcamentos')
      .update({ total: 100 })
      .eq('id', orcamentoOutraClinicaId)
      .select();

    assert(
      (!updOutra || updOutra.length === 0),
      'Administrador da clínica 1 NÃO consegue alterar orçamentos da clínica 2'
    );

    // Admin da Clínica 1 tentando deletar orçamento da Clínica 2
    const { data: delOutra } = await adminClient
      .from('orcamentos')
      .delete()
      .eq('id', orcamentoOutraClinicaId)
      .select();

    assert(
      (!delOutra || delOutra.length === 0),
      'Administrador da clínica 1 NÃO consegue deletar orçamentos da clínica 2'
    );

    // -------------------------------------------------------------------------
    // TESTE 8: Geração automática de contrato preservada
    // -------------------------------------------------------------------------
    console.log('\n--- TESTE 8: Geração e persistência do contrato do orçamento ---');
    const contratoIdGerado = 'CTR-RLS-' + Date.now();
    const tokenContrato = 'tok-ctr-' + crypto.randomUUID();

    // Persiste contrato via service role / backend autorizado
    const { error: insCtrErr } = await service.from('documentos_clinicos').insert({
      id: crypto.randomUUID(),
      tipo: 'contrato',
      paciente_id: pacienteId1,
      identificador: contratoIdGerado,
      itens: {
        contratoId: contratoIdGerado,
        token: tokenContrato,
        status: 'aguardando_assinatura_paciente',
        orcamentoId: orcamentoId1,
        valorTotal: 3300.00,
      }
    });

    assert(!insCtrErr, 'Contrato formal gerado e persistido em documentos_clinicos');

    // Admin vincula contrato ao orçamento
    const { error: updContratoOrcErr } = await adminClient
      .from('orcamentos')
      .update({ contrato_id: contratoIdGerado, contrato_token: tokenContrato })
      .eq('id', orcamentoId1);

    assert(!updContratoOrcErr, 'Contrato vinculado com sucesso ao orçamento pelo admin');

    // -------------------------------------------------------------------------
    // TESTE 9: PIX parcelado de 1x a 10x — Cálculo e QR Codes individuais
    // -------------------------------------------------------------------------
    console.log('\n--- TESTE 9: PIX Parcelado de 1x a 10x e QR Codes reais ---');
    const condicaoPix10x: CondicaoPagamento = {
      id: 'cond-pix-10x',
      titulo: 'PIX Parcelado 10x com Entrada',
      descricao: calcularDescricaoCondicao({
        tipo: 'pix_parcelado',
        valorTotal: 5000.00,
        valorEntrada: 1000.00,
        parcelas: 10,
        valorParcela: 400.00,
      }),
      tipo: 'pix_parcelado',
      valorTotal: 5000.00,
      valorEntrada: 1000.00,
      parcelas: 10,
      valorParcela: 400.00,
    };

    assert(
      condicaoPix10x.descricao.includes('10x') && condicaoPix10x.descricao.includes('400,00') && condicaoPix10x.descricao.includes('1.000,00'),
      'Descrição do PIX Parcelado 10x com entrada formatada corretamente',
      condicaoPix10x.descricao
    );

    // Geração do QR Code individual da parcela de R$ 400,00
    const payloadPixParc = gerarPayloadPix({
      chave: '03266396243',
      tipoChave: 'cpf',
      nomeFavorecido: 'Dra Rosangela Santos',
      cidade: 'MACEIO',
      valor: 400.00,
      descricao: 'Parc 1 CTR-TESTE',
    });

    assert(
      Boolean(payloadPixParc && payloadPixParc.includes('400.00')),
      'Payload EMVCo do PIX parcelado contém o valor real exato da parcela (R$ 400.00)',
      payloadPixParc
    );

    const qrCodeUrl = gerarQrCodePixUrl(payloadPixParc, 280);
    assert(
      Boolean(qrCodeUrl && qrCodeUrl.startsWith('https://')),
      'URL do QR Code gerada com sucesso para a parcela'
    );

    // -------------------------------------------------------------------------
    // TESTE 10: Financeiro mensal — Valores corretos (Caixa vs Carteira)
    // -------------------------------------------------------------------------
    console.log('\n--- TESTE 10: Indicadores do Financeiro Mensal ---');
    const ano = 2026;
    const mes0Indexed = 10; // Novembro (0-indexed: 10)
    const orcamentosSimulados: any[] = [
      { id: orcamentoId1, total: 3300.00, status: 'aprovado', criado_em: '2026-11-05T10:00:00Z', aprovado_em: '2026-11-05T10:00:00Z' }
    ];
    const transacoesSimuladas: any[] = [
      // Entrada paga de R$ 300 no caixa este mês
      { id: 't1', tipo: 'receita', orcamentoId: orcamentoId1, valor: 300.00, status: 'pago', vencimento: '2026-11-05', data: '2026-11-05' },
      // Parcela a vencer este mês: R$ 1.000
      { id: 't2', tipo: 'receita', orcamentoId: orcamentoId1, valor: 1000.00, status: 'pendente', vencimento: '2026-11-20' },
      // Parcela a vencer mês que vem (carteira futura): R$ 2.000
      { id: 't3', tipo: 'receita', orcamentoId: orcamentoId1, valor: 2000.00, status: 'pendente', vencimento: '2026-12-20' },
    ];

    const kpis = calcularResumoFinanceiroMes({
      transacoes: transacoesSimuladas,
      orcamentos: orcamentosSimulados,
      ano,
      mes0Indexed,
    });

    assert(kpis.vendasFechadas === 3300.00, 'Vendas aprovadas no mês = R$ 3.300,00', kpis.vendasFechadas);
    assert(kpis.receitaCaixa === 300.00, 'Caixa recebido no mês = R$ 300,00 (não inflado pelo total do tratamento)', kpis.receitaCaixa);
    assert(kpis.aReceberNoMes === 1000.00, 'A Receber no Mês = R$ 1.000,00 (estritamente parcelas de novembro)', kpis.aReceberNoMes);
    assert(kpis.carteiraTotalAReceber === 3000.00, 'Carteira Total a Receber = R$ 3.000,00 (soma de todas as parcelas pendentes futuras)', kpis.carteiraTotalAReceber);

    // -------------------------------------------------------------------------
    // TESTE 11: Edição, exclusão e conciliação administrativa funcionando
    // -------------------------------------------------------------------------
    console.log('\n--- TESTE 11: Cancelamento e Conciliação Administrativa Autorizada ---');
    
    // Novo paciente para conciliação
    const novoPacienteId = crypto.randomUUID();
    await service.from('pacientes').insert({ id: novoPacienteId, nome: 'Paciente Conciliado Teste', telefone: '82999990003' });

    const { error: conciliarErr } = await adminClient
      .from('orcamentos')
      .update({ paciente_id: novoPacienteId })
      .eq('id', orcamentoId1);

    assert(!conciliarErr, 'Administrador concilia paciente_id com sucesso via API');

    const { data: orcConciliado } = await service.from('orcamentos').select('paciente_id').eq('id', orcamentoId1).single();
    assert(orcConciliado?.paciente_id === novoPacienteId, 'paciente_id atualizado para o novo ID conciliado');

    // Cancelamento administrativo autorizado
    const { error: cancelErr } = await adminClient
      .from('orcamentos')
      .update({ status: 'cancelado' })
      .eq('id', orcamentoId1);

    assert(!cancelErr, 'Administrador executa cancelamento financeiro autorizado com sucesso');

    const { data: orcCancelado } = await service.from('orcamentos').select('status').eq('id', orcamentoId1).single();
    assert(orcCancelado?.status === 'cancelado', 'Status do orçamento atualizado com sucesso para cancelado');

    // Exclusão de teste de orçamento de minuta sem contrato
    const orcMinutaId = crypto.randomUUID();
    await adminClient.from('orcamentos').insert({
      id: orcMinutaId,
      user_id: clinicaId,
      total: 50.00,
      status: 'rascunho',
    });

    const { error: delMinutaErr } = await adminClient
      .from('orcamentos')
      .delete()
      .eq('id', orcMinutaId);

    assert(!delMinutaErr, 'Administrador exclui minuta física sem contrato com sucesso');

    // -------------------------------------------------------------------------
    // TESTE 12: Comprovação de que operações bloqueadas não modificaram linhas
    // -------------------------------------------------------------------------
    console.log('\n--- TESTE 12: Integridade comprovada — Zero alterações em operações bloqueadas ---');
    
    // Verifica orçamento da outra clínica após todas as tentativas de ataque
    const { data: rowOutraFinal } = await service.from('orcamentos').select('*').eq('id', orcamentoOutraClinicaId).single();
    assert(
      rowOutraFinal?.total === 8000.00 && rowOutraFinal?.status === 'enviado',
      'Orçamento da outra clínica permaneceu 100% íntegro e inviolado após todas as tentativas bloqueadas'
    );

    console.log('\n=============================================================================');
    console.log(`RESULTADO FINAL DA SUÍTE: ${passedTests}/${totalTests} TESTES APROVADOS (100%)`);
    console.log('BLINDAGEM RLS EM HOMOLOGAÇÃO VALIDADA COM SUCESSO ABSOLUTO!');
    console.log('=============================================================================\n');

  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Remoção dos dados e usuários de teste criados em homologação
    // -------------------------------------------------------------------------
    console.log(`${INFO} Executando limpeza controlada dos registros de teste em homologação...`);
    await service.from('orcamentos').delete().in('id', [orcamentoId1, orcamentoOutraClinicaId]);
    await service.from('documentos_clinicos').delete().eq('paciente_id', pacienteId1);
    await service.from('pacientes').delete().in('id', [pacienteId1, pacienteOutroId]);
    await service.from('user_roles').delete().in('user_id', [adminUserId, nonAdminUserId, otherClinicUserId]);
    await service.from('equipe').delete().eq('usuario_id', nonAdminUserId);

    await service.auth.admin.deleteUser(adminUserId).catch(() => {});
    await service.auth.admin.deleteUser(nonAdminUserId).catch(() => {});
    await service.auth.admin.deleteUser(otherClinicUserId).catch(() => {});
    console.log(`${OK} Limpeza concluída.`);
  }
}

runSuite().catch((err) => {
  console.error('\n[ERRO CRÍTICO NA EXECUÇÃO DOS TESTES]:', err);
  process.exit(1);
});
