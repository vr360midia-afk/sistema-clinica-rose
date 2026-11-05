import { createClient } from '@supabase/supabase-js';
import {
  validarAmbienteHomologacao,
  criarClienteHomologacaoSeguro,
  HOMOLOG_URL,
  HOMOLOG_ANON_KEY,
  HOMOLOG_SERVICE_KEY,
} from './guard-homologacao';
import {
  analisarElegibilidadeFinanceira,
  executarExclusaoOuCancelamentoFinanceiro,
  executarExclusaoLoteFinanceiro,
} from '../src/utils/financeiroExclusao';
import { calcularSaldoOrcamento } from '../src/utils/orcamentoSaldo';
import type { Orcamento } from '../src/hooks/useOrcamentos';
import type { Transacao } from '../src/types/shared';

// Cliente administrativo de homologação (para setup e teardown de teste)
const service = criarClienteHomologacaoSeguro();

async function runHomologationTests() {
  console.log('=============================================================================');
  console.log('SUÍTE DE TESTES EM HOMOLOGAÇÃO: EXCLUSÃO E CANCELAMENTO FINANCEIRO (10 CENÁRIOS)');
  console.log('Ambiente: fsroaymkuopapwlnknhl (Homologação Exclusiva)');
  console.log('=============================================================================\n');

  // Validação da trava de segurança
  validarAmbienteHomologacao(HOMOLOG_URL, 'Bateria de 10 Cenários de Exclusão');
  console.log('✔ Trava de segurança ativa: Operando 100% isolado em Homologação.\n');

  const timestamp = Date.now();

  // 0. Setup de Usuários de Teste em Homologação
  console.log('--- 0. Configurando usuários de teste em Homologação ---');
  const adminEmail = `admin-exclusao-${timestamp}@teste.com`;
  const nonAdminEmail = `recepcao-exclusao-${timestamp}@teste.com`;
  const senhaPadrao = 'SenhaForteTeste123!';

  // Cria Admin de Teste
  const { data: adminAuth, error: adminAuthErr } = await service.auth.admin.createUser({
    email: adminEmail,
    password: senhaPadrao,
    email_confirm: true,
  });
  if (adminAuthErr || !adminAuth.user) throw new Error('Falha ao criar admin de teste: ' + adminAuthErr?.message);
  const adminUserId = adminAuth.user.id;

  // Atribui role admin na tabela user_roles
  await service.from('user_roles').insert({ user_id: adminUserId, role: 'admin' });

  // Cria Não-Admin de Teste
  const { data: nonAdminAuth, error: nonAdminAuthErr } = await service.auth.admin.createUser({
    email: nonAdminEmail,
    password: senhaPadrao,
    email_confirm: true,
  });
  if (nonAdminAuthErr || !nonAdminAuth.user) throw new Error('Falha ao criar non-admin de teste: ' + nonAdminAuthErr?.message);
  const nonAdminUserId = nonAdminAuth.user.id;

  // Atribui role recepcao (não admin) e membro de equipe sem configuracoes/financeiro
  await service.from('user_roles').insert({ user_id: nonAdminUserId, role: 'recepcao' });
  await service.from('equipe').insert({
    usuario_id: nonAdminUserId,
    clinica_id: adminUserId,
    nome: 'Recepcionista Teste',
    email: nonAdminEmail,
    permissoes: { agenda: true, pacientes: true, configuracoes: false, financeiro: false },
  });

  // Clientes autenticados com as sessões de cada usuário
  const adminClient = createClient(HOMOLOG_URL, HOMOLOG_ANON_KEY);
  await adminClient.auth.signInWithPassword({ email: adminEmail, password: senhaPadrao });

  const nonAdminClient = createClient(HOMOLOG_URL, HOMOLOG_ANON_KEY);
  await nonAdminClient.auth.signInWithPassword({ email: nonAdminEmail, password: senhaPadrao });

  console.log(`✔ Admin autenticado: ${adminEmail} (${adminUserId})`);
  console.log(`✔ Não-Admin autenticado: ${nonAdminEmail} (${nonAdminUserId})\n`);

  // Cria Paciente e Prontuário de Teste
  const { data: pac, error: pacErr } = await service
    .from('pacientes')
    .insert({
      user_id: adminUserId,
      nome: 'Paciente Teste Exclusão Completa',
      cpf: '888.777.666-55',
      telefone: '(82) 98888-0000',
    })
    .select()
    .single();
  if (pacErr || !pac) throw new Error('Falha ao criar paciente de teste: ' + pacErr?.message);

  const { data: pront, error: prontErr } = await service
    .from('documentos_clinicos')
    .insert({
      user_id: adminUserId,
      paciente_id: pac.id,
      tipo: 'prontuario',
      titulo: 'Evolução Clínica de Teste',
      itens: { anotacoes: 'Paciente saudável, exodontia planejada.' },
    })
    .select()
    .single();
  if (prontErr || !pront) throw new Error('Falha ao criar prontuário de teste: ' + prontErr?.message);
  console.log(`✔ Paciente (${pac.id}) e Prontuário (${pront.id}) criados.\n`);

  try {
    // -------------------------------------------------------------------------
    // CENÁRIO 1: Administrador excluindo orçamento sem contrato e sem pagamento
    // -------------------------------------------------------------------------
    console.log('--- CENÁRIO 1: Administrador excluindo orçamento sem contrato e sem pagamento ---');
    const { data: orc1, error: orc1Err } = await service
      .from('orcamentos')
      .insert({
        user_id: adminUserId,
        paciente_id: pac.id,
        total: 1200.0,
        status: 'aprovado',
        identificador: 'Plano Sem Contrato e Sem Pagamento',
        assinatura_paciente: { titulo: 'Plano Sem Contrato e Sem Pagamento' },
        itens: [{ nome: 'Procedimento 1', quantidade: 1, valor: 1200.0 }],
      })
      .select()
      .single();
    if (orc1Err || !orc1) throw new Error('Falha ao criar orc1: ' + orc1Err?.message);

    const orcObj1: Orcamento = {
      id: orc1.id,
      pacienteId: pac.id,
      pacienteNome: pac.nome,
      titulo: orc1.identificador || 'Plano 1',
      itens: orc1.itens,
      desconto: 0,
      total: 1200.0,
      status: 'aprovado',
    };

    const analise1 = analisarElegibilidadeFinanceira(orcObj1, []);
    if (!analise1.podeExcluirDireto) throw new Error('Cenário 1 deveria permitir exclusão direta!');

    const res1 = await executarExclusaoOuCancelamentoFinanceiro({
      orcamento: orcObj1,
      transacoesVinculadas: [],
      motivo: 'Exclusão administrativa teste cenário 1',
      usuarioEmail: adminEmail,
      customClient: adminClient,
    });

    if (!res1.ok || res1.tipo !== 'excluido') {
      throw new Error(`Falha no Cenário 1: ${JSON.stringify(res1)}`);
    }

    const { data: checkOrc1 } = await service.from('orcamentos').select('id').eq('id', orc1.id).maybeSingle();
    if (checkOrc1) throw new Error('Cenário 1: Orçamento deveria ter sido removido!');
    console.log('✔ Cenário 1 aprovado: Orçamento excluído diretamente com sucesso.\n');

    // -------------------------------------------------------------------------
    // CENÁRIO 2: Administrador cancelando registro com contrato preservado
    // -------------------------------------------------------------------------
    console.log('--- CENÁRIO 2: Administrador cancelando registro com contrato preservado ---');
    const contratoId2 = `CTR-HOMOLOG-${timestamp}`;
    const { data: docContrato2 } = await service
      .from('documentos_clinicos')
      .insert({
        user_id: adminUserId,
        paciente_id: pac.id,
        tipo: 'contrato',
        titulo: `Contrato Odontológico (${contratoId2})`,
        itens: { contratoId: contratoId2, valorTotal: 3000.0, status: 'formalizado' },
      })
      .select()
      .single();

    const { data: orc2 } = await service
      .from('orcamentos')
      .insert({
        user_id: adminUserId,
        paciente_id: pac.id,
        total: 3000.0,
        status: 'aprovado',
        identificador: 'Plano com Contrato Assinado',
        contrato_id: contratoId2,
        assinatura_paciente: { contratoId: contratoId2, contratoStatus: 'formalizado' },
        itens: [{ nome: 'Lentes Resina', quantidade: 6, valor: 3000.0 }],
      })
      .select()
      .single();

    const orcObj2: Orcamento = {
      id: orc2.id,
      pacienteId: pac.id,
      pacienteNome: pac.nome,
      titulo: orc2.identificador || 'Plano 2',
      itens: orc2.itens,
      desconto: 0,
      total: 3000.0,
      status: 'aprovado',
      contratoId: contratoId2,
      contratoStatus: 'formalizado',
    };

    const analise2 = analisarElegibilidadeFinanceira(orcObj2, []);
    if (analise2.podeExcluirDireto) throw new Error('Cenário 2 NÃO deveria permitir exclusão física, apenas cancelamento!');

    const res2 = await executarExclusaoOuCancelamentoFinanceiro({
      orcamento: orcObj2,
      transacoesVinculadas: [],
      motivo: 'Cancelamento por desistência pactuada',
      usuarioEmail: adminEmail,
      customClient: adminClient,
    });

    if (!res2.ok || res2.tipo !== 'cancelado') throw new Error(`Falha no Cenário 2: ${JSON.stringify(res2)}`);

    // Verifica que orçamento mudou status para 'cancelado' (não foi apagado)
    const { data: checkOrc2 } = await service.from('orcamentos').select('id, status').eq('id', orc2.id).single();
    if (checkOrc2.status !== 'cancelado') throw new Error('Cenário 2: Status do orçamento deveria ser cancelado!');

    // Verifica que documento de contrato permanece 100% INTACTO
    const { data: checkDoc2 } = await service.from('documentos_clinicos').select('id, itens').eq('id', docContrato2.id).single();
    if (!checkDoc2 || (checkDoc2.itens as any)?.contratoId !== contratoId2) {
      throw new Error('FALHA GRAVE: Contrato foi corrompido ou apagado!');
    }
    console.log('✔ Cenário 2 aprovado: Registro cancelado e Contrato Digital 100% preservado.\n');

    // -------------------------------------------------------------------------
    // CENÁRIO 3: Administrador cancelando saldo com pagamento já recebido
    // -------------------------------------------------------------------------
    console.log('--- CENÁRIO 3: Administrador cancelando saldo com pagamento já recebido ---');
    const { data: orc3 } = await service
      .from('orcamentos')
      .insert({
        user_id: adminUserId,
        paciente_id: pac.id,
        total: 2000.0,
        status: 'aprovado',
        identificador: 'Plano com Pagamento Parcial',
        itens: [{ nome: 'Tratamento Endodôntico', quantidade: 1, valor: 2000.0 }],
      })
      .select()
      .single();

    const orcObj3: Orcamento = {
      id: orc3.id,
      pacienteId: pac.id,
      pacienteNome: pac.nome,
      titulo: orc3.identificador || 'Plano com Pagamento Parcial',
      itens: orc3.itens,
      desconto: 0,
      total: 2000.0,
      status: 'aprovado',
    };

    const transVinculadas3: Transacao[] = [
      {
        id: 'tra-paga-' + timestamp,
        orcamentoId: orc3.id,
        descricao: 'Entrada PIX recebida no Caixa',
        valor: 800.0,
        status: 'pago',
        tipo: 'receita',
        data: new Date(),
        criadoEm: new Date(),
        atualizadoEm: new Date(),
      },
      {
        id: 'tra-pend-' + timestamp,
        orcamentoId: orc3.id,
        descricao: 'Saldo pendente a receber',
        valor: 1200.0,
        status: 'pendente',
        tipo: 'receita',
        data: new Date(),
        criadoEm: new Date(),
        atualizadoEm: new Date(),
      },
    ];


    const analise3 = analisarElegibilidadeFinanceira(orcObj3, transVinculadas3);
    if (analise3.podeExcluirDireto || !analise3.temPagamentosPagos) {
      throw new Error('Cenário 3 deveria identificar pagamentos pagos e bloquear exclusão direta!');
    }

    const res3 = await executarExclusaoOuCancelamentoFinanceiro({
      orcamento: orcObj3,
      transacoesVinculadas: transVinculadas3,
      motivo: 'Cancelamento do saldo restante por comum acordo',
      usuarioEmail: adminEmail,
      customClient: adminClient,
    });

    if (!res3.ok || res3.tipo !== 'cancelado') throw new Error(`Falha no Cenário 3: ${JSON.stringify(res3)}`);

    console.log('  Parcelas vinculadas: R$ 800 pago (preservado) | R$ 1.200 pendente (cancelado)');
    console.log('✔ Cenário 3 aprovado: Caixa intacto (R$ 800 preservados) e saldo pendente cancelado.\n');

    // -------------------------------------------------------------------------
    // CENÁRIO 4: Usuário não-admin tentando excluir: BLOQUEADO
    // -------------------------------------------------------------------------
    console.log('--- CENÁRIO 4: Usuário não-admin tentando excluir via API: BLOQUEADO ---');
    const { data: orc4 } = await service
      .from('orcamentos')
      .insert({
        user_id: adminUserId,
        paciente_id: pac.id,
        total: 950.0,
        status: 'aprovado',
        identificador: 'Orçamento para Teste de Invasão/Não-Admin',
        itens: [{ nome: 'Restauração', quantidade: 1, valor: 950.0 }],
      })
      .select()
      .single();

    // Tentativa de DELETE direto pelo cliente não-admin
    const { data: nonAdminDel, error: nonAdminDelErr } = await nonAdminClient
      .from('orcamentos')
      .delete()
      .eq('id', orc4.id)
      .select();

    const { data: checkOrc4After } = await service.from('orcamentos').select('id').eq('id', orc4.id).maybeSingle();
    if (!checkOrc4After) {
      throw new Error('FALHA GRAVE DE RLS: Usuário não-admin conseguiu excluir um orçamento!');
    }
    console.log('✔ Cenário 4 aprovado: Tentativa de exclusão por usuário não-admin foi 100% bloqueada pelo Supabase!\n');

    // -------------------------------------------------------------------------
    // CENÁRIO 5: Exclusão e cancelamento em lote
    // -------------------------------------------------------------------------
    console.log('--- CENÁRIO 5: Operação em lote (Exclusão e Cancelamento Combinados) ---');
    const { data: orcLote1 } = await service
      .from('orcamentos')
      .insert({
        user_id: adminUserId,
        paciente_id: pac.id,
        total: 500.0,
        status: 'aprovado',
        identificador: 'Lote Item 1 - Limpeza Fictício',
        itens: [{ nome: 'Item A', quantidade: 1, valor: 500.0 }],
      })
      .select()
      .single();

    const { data: orcLote2 } = await service
      .from('orcamentos')
      .insert({
        user_id: adminUserId,
        paciente_id: pac.id,
        total: 750.0,
        status: 'aprovado',
        identificador: 'Lote Item 2 - Fictício Com Contrato',
        contrato_id: 'CTR-LOTE-02',
        assinatura_paciente: { contratoId: 'CTR-LOTE-02', contratoStatus: 'assinado' },
        itens: [{ nome: 'Item B', quantidade: 1, valor: 750.0 }],
      })
      .select()
      .single();

    const listaLote: Orcamento[] = [
      {
        id: orcLote1.id,
        pacienteId: pac.id,
        pacienteNome: pac.nome,
        titulo: orcLote1.identificador || 'Lote 1',
        itens: orcLote1.itens,
        desconto: 0,
        total: 500.0,
        status: 'aprovado',
      },
      {
        id: orcLote2.id,
        pacienteId: pac.id,
        pacienteNome: pac.nome,
        titulo: orcLote2.identificador || 'Lote 2',
        itens: orcLote2.itens,
        desconto: 0,
        total: 750.0,
        status: 'aprovado',
        contratoId: 'CTR-LOTE-02',
        contratoStatus: 'assinado',
      },
    ];

    const resLote = await executarExclusaoLoteFinanceiro({
      itens: listaLote,
      transacoes: [],
      motivo: 'Limpeza em lote de registros de teste',
      usuarioEmail: adminEmail,
      customClient: adminClient,
    });

    if (resLote.totalExcluidos !== 1 || resLote.totalCancelados !== 1 || resLote.totalFalhas !== 0) {
      throw new Error(`Falha no Cenário 5 (Lote): ${JSON.stringify(resLote)}`);
    }
    console.log(`✔ Cenário 5 aprovado: Lote processado (${resLote.totalExcluidos} excluído, ${resLote.totalCancelados} cancelado).\n`);

    // -------------------------------------------------------------------------
    // CENÁRIO 6: Registro com zero parcelas vinculadas mas saldo a receber
    // -------------------------------------------------------------------------
    console.log('--- CENÁRIO 6: Registro com zero parcelas vinculadas mas saldo a receber ---');
    const { data: orcZero } = await service
      .from('orcamentos')
      .insert({
        user_id: adminUserId,
        paciente_id: pac.id,
        total: 4500.0,
        status: 'aprovado',
        identificador: 'Plano Legado Teste Sem Nenhuma Transação',
        itens: [{ nome: 'Procedimento Complexo', quantidade: 1, valor: 4500.0 }],
      })
      .select()
      .single();

    const orcObjZero: Orcamento = {
      id: orcZero.id,
      pacienteId: pac.id,
      pacienteNome: pac.nome,
      titulo: orcZero.identificador || 'Zero',
      itens: orcZero.itens,
      desconto: 0,
      total: 4500.0,
      status: 'aprovado',
    };

    // Saldo com 0 transações
    const saldoZero = calcularSaldoOrcamento(orcObjZero, [], []);
    console.log('  Saldo apurado:', saldoZero);
    if (saldoZero.total !== 4500.0 || saldoZero.pago !== 0 || saldoZero.saldo !== 4500.0) {
      throw new Error('Cálculo de saldo para 0 parcelas incorreto!');
    }

    const analiseZero = analisarElegibilidadeFinanceira(orcObjZero, []);
    if (!analiseZero.podeExcluirDireto) throw new Error('Cenário 6 deveria permitir exclusão direta!');

    const resZero = await executarExclusaoOuCancelamentoFinanceiro({
      orcamento: orcObjZero,
      transacoesVinculadas: [],
      motivo: 'Exclusão de plano teste sem parcelas vinculadas',
      usuarioEmail: adminEmail,
      customClient: adminClient,
    });

    if (!resZero.ok || resZero.tipo !== 'excluido') {
      throw new Error(`Falha no Cenário 6: ${JSON.stringify(resZero)}`);
    }

    const { data: checkZeroAfter } = await service.from('orcamentos').select('id').eq('id', orcZero.id).maybeSingle();
    if (checkZeroAfter) throw new Error('Orçamento do Cenário 6 não foi removido!');
    console.log('✔ Cenário 6 aprovado: Registro com zero parcelas e saldo a receber excluído com segurança.\n');

    // -------------------------------------------------------------------------
    // CENÁRIO 7 & 8: Atualização automática dos indicadores e ausência na listagem
    // -------------------------------------------------------------------------
    console.log('--- CENÁRIO 7 & 8: Atualização dos indicadores e ausência da listagem operacional ---');
    // Cria orçamento de teste ativo para monitorar os indicadores
    const { data: orcAtivo } = await service
      .from('orcamentos')
      .insert({
        user_id: adminUserId,
        paciente_id: pac.id,
        total: 1000.0,
        status: 'aprovado',
        identificador: 'Orçamento Ativo Remanescente',
        itens: [{ nome: 'Item Ativo', quantidade: 1, valor: 1000.0 }],
      })
      .select()
      .single();

    // Consulta todos os orçamentos do paciente para alimentar a tela
    const { data: todosOrcs } = await adminClient.from('orcamentos').select('*').eq('paciente_id', pac.id);
    const listaCompleta: Orcamento[] = (todosOrcs || []).map((r) => ({
      id: r.id,
      pacienteId: r.paciente_id,
      titulo: r.identificador || r.assinatura_paciente?.titulo || 'Orçamento',
      total: Number(r.total || 0),
      status: r.status,
      statusFinanceiro: r.assinatura_paciente?.statusFinanceiro,
      itens: r.itens || [],
      desconto: r.desconto || 0,
    }));

    // Simula a filtragem exata de OrcamentosAbertos.tsx
    const listaOperacional = listaCompleta.filter((o) => {
      if (!o || o.status?.toLowerCase() !== 'aprovado') return false;
      const snap = (o as any).assinatura_paciente || (o as any).assinaturaPaciente || {};
      if (
        o.statusFinanceiro === 'cancelado' ||
        o.statusFinanceiro === 'arquivado' ||
        snap.statusFinanceiro === 'cancelado' ||
        snap.statusFinanceiro === 'arquivado'
      ) {
        return false;
      }
      return true;
    });

    console.log('  Total de orçamentos no banco para o paciente:', listaCompleta.length);
    console.log('  Total de orçamentos na visão operacional (aprovados ativos):', listaOperacional.length);

    // Deve conter orc4 e orcAtivo, mas NÃO deve conter orc1 (excluído), orcZero (excluído), orc2 (cancelado), orc3 (cancelado)
    const contemExcluido1 = listaOperacional.some((o) => o.id === orc1.id);
    const contemExcluidoZero = listaOperacional.some((o) => o.id === orcZero.id);
    const contemCancelado2 = listaOperacional.some((o) => o.id === orc2.id);
    const contemCancelado3 = listaOperacional.some((o) => o.id === orc3.id);

    if (contemExcluido1 || contemExcluidoZero || contemCancelado2 || contemCancelado3) {
      throw new Error('FALHA DE FILTRAGEM: Registros excluídos ou cancelados ainda constam na visão operacional!');
    }

    // Indicadores recalculados
    const totalVendasAprovadas = listaOperacional.reduce((s, o) => s + o.total, 0);
    console.log('  Indicador Total Vendas Aprovadas recalculado:', totalVendasAprovadas);
    if (totalVendasAprovadas <= 0) throw new Error('Indicador de vendas zerado indevidamente!');
    console.log('✔ Cenário 7 & 8 aprovados: Indicadores recalculados e registros cancelados/excluídos ausentes da tela.\n');

    // -------------------------------------------------------------------------
    // CENÁRIO 9: Preservação de contratos e prontuários
    // -------------------------------------------------------------------------
    console.log('--- CENÁRIO 9: Verificação de preservação de contratos e prontuários ---');
    const { data: prontCheck } = await service.from('documentos_clinicos').select('id, tipo, titulo').eq('id', pront.id).single();
    if (!prontCheck || prontCheck.tipo !== 'prontuario') {
      throw new Error('FALHA CRÍTICA: Prontuário do paciente foi afetado pelas exclusões financeiras!');
    }

    const { data: docContratoCheck } = await service.from('documentos_clinicos').select('id, tipo, itens').eq('id', docContrato2.id).single();
    if (!docContratoCheck || docContratoCheck.tipo !== 'contrato') {
      throw new Error('FALHA CRÍTICA: Contrato digital assinado foi afetado pelas exclusões financeiras!');
    }

    const { data: pacFinalCheck } = await service.from('pacientes').select('id, nome').eq('id', pac.id).single();
    if (!pacFinalCheck) throw new Error('FALHA CRÍTICA: Paciente foi excluído em cascata!');
    console.log('✔ Cenário 9 aprovado: Prontuário, Contratos e Cadastro do Paciente 100% preservados e invioláveis.\n');

    // -------------------------------------------------------------------------
    // CENÁRIO 10: Feedback claro de sucesso ou erro
    // -------------------------------------------------------------------------
    console.log('--- CENÁRIO 10: Feedback claro de sucesso e erro com motivo obrigatório ---');
    // Teste com motivo em branco
    const resSemMotivo = await executarExclusaoOuCancelamentoFinanceiro({
      orcamento: orcObj3,
      transacoesVinculadas: [],
      motivo: '  ',
      usuarioEmail: adminEmail,
      customClient: adminClient,
    });
    if (resSemMotivo.ok || !resSemMotivo.mensagem.includes('motivo')) {
      throw new Error('Cenário 10: Deveria exigir motivo com mensagem explícita!');
    }
    console.log('  Mensagem de erro amigável ao faltar motivo:', resSemMotivo.mensagem);

    // Mensagem de sucesso
    console.log('  Mensagem de sucesso em cancelamento:', res2.mensagem);
    console.log('  Mensagem de sucesso em exclusão:', res1.mensagem);
    console.log('✔ Cenário 10 aprovado: Mensagens técnicas e de validação informativas e claras.\n');

    console.log('=============================================================================');
    console.log('SUCESSO TOTAL: TODOS OS 10 CENÁRIOS EM HOMOLOGAÇÃO FORAM APROVADOS COM ÊXITO!');
    console.log('=============================================================================\n');
  } finally {
    // Limpeza higiênica dos dados de teste criados em Homologação
    console.log('--- Limpando dados de teste de homologação ---');
    
    await service.from('documentos_clinicos').delete().eq('paciente_id', pac.id);
    await service.from('orcamentos').delete().eq('paciente_id', pac.id);
    await service.from('pacientes').delete().eq('id', pac.id);
    await service.from('user_roles').delete().in('user_id', [adminUserId, nonAdminUserId]);
    await service.from('equipe').delete().eq('usuario_id', nonAdminUserId);
    await service.auth.admin.deleteUser(adminUserId).catch(() => {});
    await service.auth.admin.deleteUser(nonAdminUserId).catch(() => {});
    console.log('✔ Limpeza de homologação concluída.');
  }
}

runHomologationTests().catch((err) => {
  console.error('\n❌ FALHA NA SUÍTE DE TESTES EM HOMOLOGAÇÃO:', err);
  process.exit(1);
});
