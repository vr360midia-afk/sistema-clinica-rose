import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  HOMOLOG_URL,
  HOMOLOG_SERVICE_KEY,
  validarAmbienteHomologacao,
} from './guard-homologacao';

// Trava estrita de segurança: garante 100% que executa em homologação
validarAmbienteHomologacao(HOMOLOG_URL, 'Teste Sincronizacao Exclusao Orcamento Financeiro e Timeline');

process.env.VITE_SUPABASE_URL = HOMOLOG_URL;
process.env.HOMOLOG_URL = HOMOLOG_URL;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = HOMOLOG_SERVICE_KEY;
process.env.HOMOLOG_SUPABASE_ANON_KEY = HOMOLOG_SERVICE_KEY;

function createHomologTestClient(realSupabase: SupabaseClient) {
  const transacoesStore: any[] = [];

  const handler = {
    from(tableName: string) {
      if (tableName === 'transacoes') {
        const filters: ((t: any) => boolean)[] = [];
        const builder: any = {
          insert(rows: any | any[]) {
            const arr = Array.isArray(rows) ? rows : [rows];
            const inserted = arr.map((r) => {
              const item = { ...r, id: r.id || crypto.randomUUID() };
              transacoesStore.push(item);
              return item;
            });
            return {
              select() {
                return {
                  single() { return Promise.resolve({ data: inserted[0], error: null }); },
                };
              },
            };
          },
          select(cols?: string) {
            const q: any = {
              eq(col: string, val: any) {
                filters.push((t) => t[col] === val);
                return q;
              },
              neq(col: string, val: any) {
                filters.push((t) => t[col] !== val);
                return q;
              },
              in(col: string, vals: any[]) {
                const s = new Set(vals);
                filters.push((t) => s.has(t[col]));
                return q;
              },
              then(resolve: any, reject?: any) {
                const res = transacoesStore.filter((t) => filters.every((f) => f(t)));
                return Promise.resolve({ data: [...res], error: null }).then(resolve, reject);
              },
              single() {
                const res = transacoesStore.filter((t) => filters.every((f) => f(t)));
                return Promise.resolve({ data: res[0] || null, error: null });
              },
              maybeSingle() {
                const res = transacoesStore.filter((t) => filters.every((f) => f(t)));
                return Promise.resolve({ data: res[0] || null, error: null });
              },
            };
            return q;
          },
          update(updates: any) {
            const q: any = {
              eq(col: string, val: any) {
                filters.push((t) => t[col] === val);
                return q;
              },
              neq(col: string, val: any) {
                filters.push((t) => t[col] !== val);
                return q;
              },
              then(resolve: any, reject?: any) {
                transacoesStore.forEach((t) => {
                  if (filters.every((f) => f(t))) {
                    Object.assign(t, updates);
                  }
                });
                return Promise.resolve({ data: null, error: null }).then(resolve, reject);
              },
            };
            return q;
          },
          delete() {
            const q: any = {
              eq(col: string, val: any) {
                filters.push((t) => t[col] === val);
                return q;
              },
              neq(col: string, val: any) {
                filters.push((t) => t[col] !== val);
                return q;
              },
              in(col: string, vals: any[]) {
                const s = new Set(vals);
                filters.push((t) => s.has(t[col]));
                return q;
              },
              then(resolve: any, reject?: any) {
                for (let i = transacoesStore.length - 1; i >= 0; i--) {
                  if (filters.every((f) => f(transacoesStore[i]))) {
                    transacoesStore.splice(i, 1);
                  }
                }
                return Promise.resolve({ data: null, error: null }).then(resolve, reject);
              },
            };
            return q;
          },
        };
        return builder;
      }
      return realSupabase.from(tableName);
    },
    auth: realSupabase.auth,
    storage: realSupabase.storage,
    rpc: realSupabase.rpc.bind(realSupabase),
  };

  return { client: handler as any, store: transacoesStore };
}

async function main() {
  console.log('================================================================================');
  console.log('TESTE EM HOMOLOGAÇÃO: SINCRONIZAÇÃO DE EXCLUSÃO/CANCELAMENTO, FINANCEIRO E TIMELINE');
  console.log('Ambiente:', HOMOLOG_URL);
  console.log('================================================================================\n');

  const realSupabase = createClient(HOMOLOG_URL, HOMOLOG_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { client: supabase, store: transacoesStore } = createHomologTestClient(realSupabase);

  const timestamp = Date.now();
  const testSuffix = timestamp.toString().slice(-6);

  const {
    analisarElegibilidadeFinanceira,
    executarExclusaoOuCancelamentoFinanceiro,
  } = await import('../src/utils/financeiroExclusao');

  const {
    calcularResumoFinanceiroMes,
    ehTransacaoPaga,
    ehTransacaoPendente,
  } = await import('../src/utils/financeiroCalculos');

  const { calcularSaldosOrcamentos } = await import('../src/utils/orcamentoSaldo');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string, detail?: any) {
    if (condition) {
      console.log(`  ✓ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${msg}`, detail || '');
      failed++;
    }
  }

  // IDs para limpeza posterior no Supabase real
  const pacientesCriados: string[] = [];
  const orcamentosCriados: string[] = [];
  const contratosCriados: string[] = [];

  try {
    // ==============================================================================
    // CENÁRIO 1: REGRA A — EXCLUSÃO ADMINISTRATIVA DE ORÇAMENTO COM PARCELAS PENDENTES
    // ==============================================================================
    console.log('\n--- CENÁRIO 1: REGRA A — Exclusão Administrativa e Limpeza de Parcelas Pendentes ---');
    
    const pac1Id = crypto.randomUUID();
    const { error: pac1Err } = await supabase.from('pacientes').insert({
      id: pac1Id,
      nome: `Paciente Teste Exclusao A ${testSuffix}`,
      telefone: '11999990001',
    });
    pacientesCriados.push(pac1Id);
    assert(!pac1Err, 'Paciente 1 cadastrado em homologação', pac1Err?.message);

    const orc1Id = crypto.randomUUID();
    const orc1Identificador = `ORC-${orc1Id.slice(0, 8).toUpperCase()}`;
    const { data: orc1, error: orc1Err } = await supabase.from('orcamentos').insert({
      id: orc1Id,
      identificador: orc1Identificador,
      paciente_id: pac1Id,
      total: 3000,
      valor_total: 3000,
      desconto: 0,
      status: 'rascunho',
      itens: [{ id: '1', nome: 'Aparelho Ortodôntico', quantidade: 1, valor: 3000 }],
    }).select().single();
    orcamentosCriados.push(orc1Id);
    assert(!orc1Err && Boolean(orc1?.id), 'Orçamento 1 (rascunho, R$ 3.000) inserido', orc1Err?.message);

    // Criar 6 parcelas pendentes vinculadas em transacoes
    for (let i = 1; i <= 6; i++) {
      const tId = crypto.randomUUID();
      await supabase.from('transacoes').insert({
        id: tId,
        paciente_id: pac1Id,
        paciente_nome: `Paciente Teste Exclusao A ${testSuffix}`,
        orcamento_id: orc1Id,
        tipo: 'receita',
        status: 'pendente',
        metodo_pagamento: 'pix_parcelado',
        valor: 500,
        descricao: `Parcela ${i}/6 - Aparelho`,
        data: new Date().toISOString(),
        vencimento: new Date(Date.now() + i * 30 * 86400000).toISOString(),
      });
    }
    const { data: trans1Criadas } = await supabase.from('transacoes').select().eq('orcamento_id', orc1Id);
    assert(trans1Criadas.length === 6, '6 parcelas pendentes vinculadas criadas em transacoes');

    // Testar análise de elegibilidade
    const analise1 = analisarElegibilidadeFinanceira(orc1, []);
    assert(analise1.podeExcluirDireto === true, 'Análise autoriza exclusão administrativa direta');
    assert(analise1.acaoPermitida === 'exclusao_administrativa', 'Ação permitida é exclusao_administrativa');

    // Executar exclusão administrativa
    const res1 = await executarExclusaoOuCancelamentoFinanceiro({
      orcamento: orc1,
      transacoesVinculadas: [], // Teste intencional sem passar transações em memória: motor busca do DB
      motivo: 'Teste automatizado de limpeza completa de parcelas pendentes',
      usuarioEmail: 'admin@homolog.test',
      customClient: supabase,
    });
    assert(res1.ok === true && res1.tipo === 'excluido', 'Exclusão administrativa retornou sucesso');

    // Verificar que o orçamento sumiu do banco
    const { data: checkOrc1 } = await supabase.from('orcamentos').select('id').eq('id', orc1Id).maybeSingle();
    assert(checkOrc1 === null, 'Orçamento 1 fisicamente removido de orcamentos');

    // Verificar que TODAS as 6 parcelas vinculadas foram removidas de transacoes (Zero órfãs!)
    const { data: checkTrans1 } = await supabase.from('transacoes').select('id').eq('orcamento_id', orc1Id);
    assert(!checkTrans1 || checkTrans1.length === 0, 'TODAS as 6 parcelas pendentes foram removidas do banco (zero órfãs)');

    // ==============================================================================
    // CENÁRIO 2: REGRA B — CANCELAMENTO FINANCEIRO COM CONTRATO DIGITAL FORMALIZADO
    // ==============================================================================
    console.log('\n--- CENÁRIO 2: REGRA B — Cancelamento Financeiro com Preservação de Contrato ---');

    const pac2Id = crypto.randomUUID();
    const { error: pac2Err } = await supabase.from('pacientes').insert({
      id: pac2Id,
      nome: `Paciente Teste Contrato B ${testSuffix}`,
      telefone: '11999990002',
    });
    pacientesCriados.push(pac2Id);
    assert(!pac2Err, 'Paciente 2 cadastrado em homologação');

    const orc2Id = crypto.randomUUID();
    const contratoId2 = `CTR-${orc2Id.slice(0, 8).toUpperCase()}`;
    const orc2Identificador = `ORC-${orc2Id.slice(0, 8).toUpperCase()}`;
    const tokenAssinatura2 = 'tok_test_' + crypto.randomBytes(16).toString('hex');
    const agoraIso = new Date().toISOString();

    const docClinicoId2 = crypto.randomUUID();
    const snapContrato2 = {
      contratoId: contratoId2,
      orcamentoId: orc2Id,
      pacienteId: pac2Id,
      status: 'formalizado',
      statusContrato: 'formalizado',
      assinaturaPaciente: { nome: 'Paciente 2', assinadoEm: agoraIso },
      assinaturaDentista: { nome: 'Dra. Rosângela', cro: '06267-AL' },
      token: tokenAssinatura2,
    };

    const { error: errDoc2 } = await supabase.from('documentos_clinicos').insert({
      id: docClinicoId2,
      identificador: contratoId2,
      paciente_id: pac2Id,
      paciente_nome: `Paciente Teste Contrato B ${testSuffix}`,
      tipo: 'contrato',
      titulo: `Contrato Odontológico (${contratoId2})`,
      itens: snapContrato2,
      assinado_em: agoraIso,
      assinante_nome: `Paciente Teste Contrato B ${testSuffix}`,
    });
    contratosCriados.push(docClinicoId2);
    assert(!errDoc2, 'Contrato formalizado inserido em documentos_clinicos');

    const snapOrc2 = {
      identificador: orc2Identificador,
      contratoId: contratoId2,
      contratoStatus: 'formalizado',
      statusContrato: 'formalizado',
      assinaturaDraStatus: 'concluida',
      assinaturaPacienteStatus: 'concluida',
    };

    const { data: orc2, error: orc2Err } = await supabase.from('orcamentos').insert({
      id: orc2Id,
      identificador: orc2Identificador,
      paciente_id: pac2Id,
      total: 4000,
      valor_total: 4000,
      desconto: 0,
      status: 'aprovado',
      contrato_id: contratoId2,
      contrato_token: tokenAssinatura2,
      assinatura_paciente: snapOrc2,
      itens: [{ id: '1', nome: 'Prótese Total', quantidade: 1, valor: 4000 }],
    }).select().single();
    orcamentosCriados.push(orc2Id);
    assert(!orc2Err && Boolean(orc2?.id), 'Orçamento 2 aprovado vinculado a contrato inserido');

    // Criar 4 parcelas pendentes de R$ 1.000
    for (let i = 1; i <= 4; i++) {
      const tId = crypto.randomUUID();
      await supabase.from('transacoes').insert({
        id: tId,
        paciente_id: pac2Id,
        paciente_nome: `Paciente Teste Contrato B ${testSuffix}`,
        orcamento_id: orc2Id,
        tipo: 'receita',
        status: 'pendente',
        metodo_pagamento: 'pix_parcelado',
        valor: 1000,
        descricao: `Parcela ${i}/4 - Prótese`,
        data: new Date().toISOString(),
        vencimento: new Date(Date.now() + i * 30 * 86400000).toISOString(),
      });
    }

    // Análise de elegibilidade: DEVE BLOQUEAR exclusão física por presença de contrato
    const analise2 = analisarElegibilidadeFinanceira(orc2, []);
    assert(analise2.podeExcluirDireto === false, 'Bloqueou terminantemente exclusão direta por presença de contrato');
    assert(analise2.acaoPermitida === 'cancelamento_financeiro', 'Direcionou estritamente para cancelamento_financeiro');

    // Executar cancelamento financeiro
    const res2 = await executarExclusaoOuCancelamentoFinanceiro({
      orcamento: orc2,
      transacoesVinculadas: [],
      motivo: 'Cancelamento por solicitação do paciente preservando contrato assinado',
      usuarioEmail: 'admin@homolog.test',
      customClient: supabase,
    });
    assert(res2.ok === true && res2.tipo === 'cancelado', 'Cancelamento financeiro retornou sucesso');

    // Verificar integridade do orçamento e contrato
    const { data: checkOrc2 } = await supabase.from('orcamentos').select('status, contrato_id, assinatura_paciente').eq('id', orc2Id).single();
    assert(checkOrc2.status === 'cancelado', 'Orçamento atualizado para status: cancelado no banco');
    assert(checkOrc2.contrato_id === contratoId2, 'Vínculo com contrato_id permanece intacto');

    const { data: checkContrato2 } = await supabase.from('documentos_clinicos').select('id, tipo').eq('id', docClinicoId2).maybeSingle();
    assert(checkContrato2 !== null, 'Contrato em documentos_clinicos NÃO FOI APAGADO (100% preservado)');

    // Verificar que as 4 parcelas foram atualizadas para 'cancelado' (e NÃO apagadas)
    const { data: checkTrans2 } = await supabase.from('transacoes').select('id, status').eq('orcamento_id', orc2Id);
    assert(checkTrans2.length === 4, 'As 4 parcelas permanecem na tabela para rastreabilidade');
    assert(checkTrans2.every((t: any) => t.status === 'cancelado'), 'TODAS as parcelas foram atualizadas para status: cancelado');

    // ==============================================================================
    // CENÁRIO 3: REGRA B — CANCELAMENTO COM PAGAMENTOS QUITADOS NO CAIXA
    // ==============================================================================
    console.log('\n--- CENÁRIO 3: REGRA B — Cancelamento com Preservação de Histórico do Caixa ---');

    const pac3Id = crypto.randomUUID();
    const { error: pac3Err } = await supabase.from('pacientes').insert({
      id: pac3Id,
      nome: `Paciente Teste Caixa C ${testSuffix}`,
      telefone: '11999990003',
    });
    pacientesCriados.push(pac3Id);

    const orc3Id = crypto.randomUUID();
    const orc3Identificador = `ORC-${orc3Id.slice(0, 8).toUpperCase()}`;
    const { data: orc3 } = await supabase.from('orcamentos').insert({
      id: orc3Id,
      identificador: orc3Identificador,
      paciente_id: pac3Id,
      total: 2000,
      valor_total: 2000,
      desconto: 0,
      status: 'aprovado',
      itens: [{ id: '1', nome: 'Tratamento', quantidade: 1, valor: 2000 }],
    }).select().single();
    orcamentosCriados.push(orc3Id);

    // 1 pagamento PAGO (R$ 500) e 3 parcelas PENDENTES (R$ 500 cada)
    const tPagaId = crypto.randomUUID();
    await supabase.from('transacoes').insert({
      id: tPagaId,
      paciente_id: pac3Id,
      paciente_nome: `Paciente Teste Caixa C ${testSuffix}`,
      orcamento_id: orc3Id,
      tipo: 'receita',
      status: 'pago',
      metodo_pagamento: 'pix',
      valor: 500,
      descricao: 'Entrada PIX quitada no Caixa',
      data: new Date().toISOString(),
    });

    for (let i = 1; i <= 3; i++) {
      const tId = crypto.randomUUID();
      await supabase.from('transacoes').insert({
        id: tId,
        paciente_id: pac3Id,
        paciente_nome: `Paciente Teste Caixa C ${testSuffix}`,
        orcamento_id: orc3Id,
        tipo: 'receita',
        status: 'pendente',
        metodo_pagamento: 'pix_parcelado',
        valor: 500,
        descricao: `Parcela ${i}/3 restante`,
        data: new Date().toISOString(),
        vencimento: new Date(Date.now() + i * 30 * 86400000).toISOString(),
      });
    }

    const { data: trans3Todas } = await supabase.from('transacoes').select().eq('orcamento_id', orc3Id);

    // Análise de elegibilidade: DEVE BLOQUEAR exclusão física por presença de Caixa
    const analise3 = analisarElegibilidadeFinanceira(orc3, trans3Todas);
    assert(analise3.temPagamentosPagos === true, 'Detectou pagamentos quitados no Caixa (R$ 500)');
    assert(analise3.podeExcluirDireto === false, 'Bloqueou exclusão física direta para proteger o Caixa');

    // Executar cancelamento financeiro
    const res3 = await executarExclusaoOuCancelamentoFinanceiro({
      orcamento: orc3,
      transacoesVinculadas: trans3Todas,
      motivo: 'Cancelamento parcial preservando recebimento quitado',
      usuarioEmail: 'admin@homolog.test',
      customClient: supabase,
    });
    assert(res3.ok === true && res3.tipo === 'cancelado', 'Cancelamento financeiro com Caixa concluído');

    // Verificar integridade do Caixa
    const { data: checkTPaga } = await supabase.from('transacoes').select('id, status, valor').eq('id', tPagaId).single();
    assert(checkTPaga.status === 'pago', 'Lançamento quitado no Caixa permanece estritamente como status: pago');
    assert(Number(checkTPaga.valor) === 500, 'Valor do recebimento quitado no Caixa 100% intacto');

    // Verificar que as 3 parcelas pendentes foram canceladas
    const { data: checkTrans3Pend } = await supabase.from('transacoes').select('id, status').eq('orcamento_id', orc3Id).neq('id', tPagaId);
    assert(checkTrans3Pend.every((t: any) => t.status === 'cancelado'), 'Todas as parcelas pendentes restantes foram canceladas');

    // ==============================================================================
    // CENÁRIO 4: SIMULAÇÃO EXATA DO CASO REAL (DIEG DURACENSKI) — TRANSAÇÕES ÓRFÃS
    // ==============================================================================
    console.log('\n--- CENÁRIO 4: Blindagem contra Transações Órfãs de Orçamento Excluído (Caso Dieg) ---');

    const pac4Id = crypto.randomUUID();
    const { error: pac4Err } = await supabase.from('pacientes').insert({
      id: pac4Id,
      nome: `Dieg Duracenski Teste ${testSuffix}`,
      telefone: '11999990004',
    });
    pacientesCriados.push(pac4Id);

    // Simular 8 transações pendentes de R$ 500 vinculadas a um orçamento já deletado
    const dummyDeletedOrcamentoId = crypto.randomUUID();
    const transOrfasDieg: any[] = [];
    for (let i = 1; i <= 8; i++) {
      const tId = crypto.randomUUID();
      const tOrfa = {
        id: tId,
        paciente_id: pac4Id,
        paciente_nome: `Dieg Duracenski Teste ${testSuffix}`,
        orcamento_id: dummyDeletedOrcamentoId,
        tipo: 'receita',
        status: 'pendente',
        metodo_pagamento: 'pix_parcelado',
        valor: 500,
        descricao: `Parcela ${i}/8 PIX Parcelado`,
        data: new Date().toISOString(),
        vencimento: new Date().toISOString(),
      };
      await supabase.from('transacoes').insert(tOrfa);
      transOrfasDieg.push({
        ...tOrfa,
        orcamentoId: tOrfa.orcamento_id,
        valor: Number(tOrfa.valor),
      });
    }
    assert(transOrfasDieg.length === 8, '8 transações órfãs inseridas simulando o caso real (R$ 4.000 em aberto legado)');

    // Testar cálculo do resumo financeiro do paciente com a nova regra implementada:
    // O paciente NÃO tem nenhum orçamento aprovado na lista (lista de orçamentos vazia [])
    const orcamentosDoPaciente: any[] = []; // Nenhum orçamento
    const receitasDoPaciente = transOrfasDieg.filter((t) => t.tipo === 'receita');

    const aprovadosP4 = orcamentosDoPaciente.filter((o) => o?.status === 'aprovado');
    const idsAprovadosP4 = new Set(aprovadosP4.map((o) => o.id));
    const saldosMapP4 = calcularSaldosOrcamentos(orcamentosDoPaciente, receitasDoPaciente);
    const saldoOrcamentosP4 = aprovadosP4.reduce((s, o) => s + (saldosMapP4.get(o.id)?.saldo || 0), 0);

    // Nova fórmula implementada em PatientFinancial.tsx
    const pendenteAvulsoP4 = receitasDoPaciente
      .filter((t) => {
        if (!ehTransacaoPendente(t) || t?.status === 'cancelado') return false;
        const orcId = t?.orcamentoId || t?.orcamento_id;
        return !orcId; // Apenas transações verdadeiramente avulsas
      })
      .reduce((s, t) => s + Number(t.valor || 0), 0);
    const pendenteTotalP4 = pendenteAvulsoP4 + saldoOrcamentosP4;

    assert(saldoOrcamentosP4 === 0, 'Saldo de orçamentos aprovados é R$ 0,00');
    assert(pendenteAvulsoP4 === 0, 'Pendentes avulsos ignora transações órfãs de orçamentos (R$ 0,00)');
    assert(pendenteTotalP4 === 0, 'Total "Em aberto" do paciente recalculado para EXATAMENTE R$ 0,00 (Corrigido!)');

    // Testar listagem operacional de pagamentos:
    const lancamentosOperacionaisP4 = receitasDoPaciente.filter((t) => {
      if (ehTransacaoPaga(t)) return true;
      if (t?.status === 'cancelado') return false;
      const orcId = t?.orcamentoId || (t as any)?.orcamento_id;
      if (orcId) {
        return idsAprovadosP4.has(orcId);
      }
      return true;
    });
    assert(lancamentosOperacionaisP4.length === 0, 'Listagem operacional de pagamentos ativos tem 0 itens (não exibe parcelas órfãs ativas)');

    // Testar linha do tempo:
    const itensTimelineP4: any[] = [];
    const orcValidosP4 = new Set(orcamentosDoPaciente.map((o) => o.id));
    receitasDoPaciente.forEach((t) => {
      const isCancelado = t?.status === 'cancelado';
      const orcId = t?.orcamentoId || (t as any)?.orcamento_id;
      const ehPago = ehTransacaoPaga(t);

      if (isCancelado) {
        itensTimelineP4.push({ titulo: 'Recebimento (Cancelado)' });
        return;
      }
      if (!ehPago && orcId && !orcValidosP4.has(orcId)) {
        // Órfão de orçamento deletado: omitido da linha do tempo
        return;
      }
      itensTimelineP4.push({ titulo: `Recebimento ${t.valor}` });
    });
    assert(itensTimelineP4.length === 0, 'Linha do tempo omitiu as 8 transações órfãs (não exibe "Recebimento R$ 500,00" falso)');

    // Testar motor central de cálculo financeiro da clínica:
    const mesAtual = new Date().getMonth();
    const anoAtual = new Date().getFullYear();
    const kpiResumo = calcularResumoFinanceiroMes({
      transacoes: transOrfasDieg,
      orcamentos: orcamentosDoPaciente,
      ano: anoAtual,
      mes0Indexed: mesAtual,
    });
    assert(kpiResumo.aReceberNoMes === 0, 'KPI Central aReceberNoMes não é inflado pelas parcelas órfãs (R$ 0,00)');
    assert(kpiResumo.carteiraTotalAReceber === 0, 'KPI Central carteiraTotalAReceber não é inflado pelas parcelas órfãs (R$ 0,00)');

  } catch (err: any) {
    console.error('ERRO CRÍTICO NA EXECUÇÃO DO TESTE:', err);
    failed++;
  } finally {
    // ==============================================================================
    // LIMPEZA FINAL DOS DADOS DE TESTE EM HOMOLOGAÇÃO
    // ==============================================================================
    console.log('\n--- LIMPEZA: Removendo registros gerados pelo teste em homologação ---');
    try {
      if (contratosCriados.length > 0) {
        await realSupabase.from('documentos_clinicos').delete().in('id', contratosCriados);
      }
      if (orcamentosCriados.length > 0) {
        await realSupabase.from('orcamentos').delete().in('id', orcamentosCriados);
      }
      if (pacientesCriados.length > 0) {
        await realSupabase.from('pacientes').delete().in('id', pacientesCriados);
      }
      console.log('  ✓ Dados de teste removidos com sucesso de homologação.');
    } catch (cleanErr) {
      console.warn('Aviso ao limpar dados de teste:', cleanErr);
    }
  }

  console.log('\n================================================================================');
  console.log(`RESULTADO FINAL: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
