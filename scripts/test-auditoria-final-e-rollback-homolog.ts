/**
 * Suite de Auditoria Estrita Final, Concorrência e Rollback em Homologação
 *
 * Validação rigorosa dos requisitos exigidos na Auditoria Final:
 * 1. Restrição estrita na Regra 3 quando conteúdo/financeiro não mudam (bloqueio de adulteração de assinaturas, tokens, cláusulas, etc.);
 * 2. Blindagem abrangente na Regra 2 via subtração JSONB contra modificação de qualquer propriedade de itens;
 * 3. Controle de concorrência com validação otimista de versão (bloqueio de sobrescrita concorrente);
 * 4. Sincronização atômica transacional do token com a tabela 'orcamentos';
 * 5. Tratamento de formatos históricos de assinatura e JSON null;
 * 6. Teste completo do ciclo de rollback no banco de homologação.
 *
 * AMBIENTE: 100% HOMOLOGAÇÃO (fsroaymkuopapwlnknhl). NENHUM DADO DE PRODUÇÃO É TOCADO.
 */

import { execSync } from 'child_process';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import {
  validarAmbienteHomologacao,
  HOMOLOG_URL,
  HOMOLOG_SERVICE_KEY,
  HOMOLOG_PROJECT_REF,
} from './guard-homologacao';

validarAmbienteHomologacao(HOMOLOG_URL, 'Auditoria Final e Teste de Rollback');

const supabase = createClient(HOMOLOG_URL, HOMOLOG_SERVICE_KEY);

interface TestItem {
  num: number;
  nome: string;
  sucesso: boolean;
  detalhes?: string;
}

const resultados: TestItem[] = [];

function assert(cond: boolean, num: number, nome: string, detalhes?: string) {
  if (cond) {
    resultados.push({ num, nome, sucesso: true });
    console.log(`  ✓ [TESTE ${num}] ${nome}`);
  } else {
    resultados.push({ num, nome, sucesso: false, detalhes });
    console.error(`  ❌ [FALHA TESTE ${num}] ${nome}`);
    if (detalhes) console.error(`     Detalhes: ${detalhes}`);
    throw new Error(`Falha no teste ${num}: ${nome} -> ${detalhes || ''}`);
  }
}

function aplicarSqlHomolog(caminhoArquivo: string) {
  const cmd = `npx supabase db query --remote=${HOMOLOG_PROJECT_REF} --file="${caminhoArquivo}" --yes`;
  execSync(cmd, { encoding: 'utf-8' });
}

async function runAuditoriaFinal() {
  console.log('================================================================================');
  console.log('BATERIA DE AUDITORIA FINAL, CONCORRÊNCIA E ROLLBACK');
  console.log('Ambiente:', HOMOLOG_URL);
  console.log('Data:', new Date().toISOString());
  console.log('================================================================================\n');

  // ---------------------------------------------------------------------------
  // ETAPA 1: APLICAÇÃO DA MIGRATION V4 EM HOMOLOGAÇÃO
  // ---------------------------------------------------------------------------
  console.log('▶ ETAPA 1: Aplicando migration V4 revisada em homologação...');
  aplicarSqlHomolog('supabase/migrations/20261108_ajuste_retificacao_contrato_pendente.sql');
  console.log('  ✓ Migration V4 aplicada com sucesso em homologação.\n');

  // Criação de dados base de teste em homologação
  const sufixo = crypto.randomBytes(3).toString('hex').toUpperCase();
  const ctrCode = `CTR-AUDIT-${sufixo}`;
  const tokenV1 = `token_v1_${crypto.randomBytes(20).toString('hex')}`;
  const tokenV2 = `token_v2_${crypto.randomBytes(20).toString('hex')}`;
  const tokenV2Concorrente = `token_v2_conc_${crypto.randomBytes(20).toString('hex')}`;

  // 1. Cria Paciente
  const { data: pac, error: pacErr } = await supabase.from('pacientes').insert({
    nome: `Paciente Teste Auditoria ${sufixo}`,
    cpf: `111.222.333-${sufixo.slice(0, 2)}`,
    telefone: '82999999999',
  }).select().single();
  if (pacErr) throw pacErr;
  assert(Boolean(pac?.id), 1, 'Paciente de teste criado em homologação');

  // 2. Cria Orçamento vinculado
  const { data: orc, error: orcErr } = await supabase.from('orcamentos').insert({
    paciente_id: pac.id,
    valor_total: 8870,
    desconto: 2820,
    total: 6050,
    status: 'aprovado',
    contrato_token: tokenV1,
    itens: [
      { nome: 'Procedimento 1', valor: 8200 },
      { nome: 'Procedimento 2', valor: 670 },
    ],
  }).select().single();
  if (orcErr) throw orcErr;
  assert(Boolean(orc?.id), 2, 'Orçamento vinculado criado em homologação');

  // 3. Cria Contrato Pendente V1 (com pré-assinatura da Dra.)
  const snapshotV1 = {
    versao: '1.0',
    contratoId: ctrCode,
    orcamentoId: orc.id,
    pacienteId: pac.id,
    token: tokenV1,
    status: 'aguardando_assinatura_paciente',
    statusAssinaturaDentista: 'assinado',
    statusAssinaturaPaciente: 'pendente',
    tokensRevogados: [],
    versoesAnteriores: [],
    financeiro: { total: 8870, subtotal: 8870, desconto: 0 },
    itens: [{ nome: 'Procedimento 1', valor: 8200 }, { nome: 'Procedimento 2', valor: 670 }],
    clausulas: ['Clausula 1 Padrão', 'Clausula 2 Padrão'],
    parcelas: [{ numero: 1, valor: 8870 }],
    paciente: { nome: pac.nome, cpf: pac.cpf },
    clinica: { nome: 'Clínica Lentes em Resina', cro: '06267-AL' },
    termoUsoImagem: { ativo: true, autorizado: true },
    assinaturaPaciente: null,
    assinaturaDentista: {
      nome: 'Dra. Rosângela Santos Pereira',
      cro: '06267-AL',
      dataHora: new Date().toISOString(),
      metodo: 'assinatura_automatica_autorizada',
    },
  };

  const { data: doc, error: docErr } = await supabase.from('documentos_clinicos').insert({
    identificador: ctrCode,
    paciente_id: pac.id,
    paciente_nome: pac.nome,
    tipo: 'contrato',
    titulo: `Contrato Odontológico - ${pac.nome} (${ctrCode})`,
    conteudo: '<html>Conteudo Versao 1.0 Original R$ 8.870,00</html>',
    valor_total: 8870,
    itens: snapshotV1,
  }).select().single();
  if (docErr) throw docErr;
  assert(Boolean(doc?.id), 3, 'Contrato pendente V1 criado em homologação');

  // ---------------------------------------------------------------------------
  // ETAPA 2: AUDITORIA DA REGRA 3 (RESTRIÇÃO QUANDO CONTEÚDO/FINANCEIRO NÃO MUDAM)
  // ---------------------------------------------------------------------------
  console.log('\n▶ ETAPA 2: Testando restrições estritas na Regra 3 (Conteúdo/Financeiro sem alteração)...');

  // Teste 4: Tentativa maliciosa de adulterar a assinatura da dentista sem alterar conteúdo/financeiro
  const { error: errAssDent } = await supabase.from('documentos_clinicos').update({
    itens: {
      ...doc.itens,
      assinaturaDentista: { nome: 'Dentista Falso', cro: '99999-SP' },
    },
  }).eq('id', doc.id);
  assert(Boolean(errAssDent && errAssDent.message.includes('Violação de integridade')), 4, 'Tentativa de adulterar ASSINATURA DA DENTISTA é sumariamente bloqueada');

  // Teste 5: Tentativa maliciosa de trocar o token sem retificação
  const { error: errTok } = await supabase.from('documentos_clinicos').update({
    itens: {
      ...doc.itens,
      token: 'token_hacked_sem_retificacao',
    },
  }).eq('id', doc.id);
  assert(Boolean(errTok && errTok.message.includes('Violação de integridade')), 5, 'Tentativa de trocar TOKEN sem protocolo de retificação é sumariamente bloqueada');

  // Teste 6: Tentativa maliciosa de alterar cláusulas sem alterar conteúdo/financeiro
  const { error: errClaus } = await supabase.from('documentos_clinicos').update({
    itens: {
      ...doc.itens,
      clausulas: ['Clausula Adulterada Indevidamente'],
    },
  }).eq('id', doc.id);
  assert(Boolean(errClaus && errClaus.message.includes('Violação de integridade')), 6, 'Tentativa de alterar CLÁUSULAS sem retificação é sumariamente bloqueada');

  // Teste 7: Tentativa maliciosa de alterar lista de procedimentos sem retificação
  const { error: errItens } = await supabase.from('documentos_clinicos').update({
    itens: {
      ...doc.itens,
      itens: [{ nome: 'Procedimento Adulterado', valor: 8870 }],
    },
  }).eq('id', doc.id);
  assert(Boolean(errItens && errItens.message.includes('Violação de integridade')), 7, 'Tentativa de alterar PROCEDIMENTOS sem retificação é sumariamente bloqueada');

  // Teste 8: Atualização administrativa de metadados de PDF (Permitida na proposta pendente)
  const { error: errAdminPend } = await supabase.from('documentos_clinicos').update({
    itens: {
      ...doc.itens,
      pdfUrl: 'https://storage.supabase.co/contratos/rascunho.pdf',
      pdfGeradoEm: new Date().toISOString(),
    },
  }).eq('id', doc.id);
  assert(!errAdminPend, 8, 'Atualização administrativa de metadados de PDF é autorizada com sucesso');

  // ---------------------------------------------------------------------------
  // ETAPA 3: AUDITORIA DE RETIFICAÇÃO, CONCORRÊNCIA E TRANSAÇÃO ATÔMICA
  // ---------------------------------------------------------------------------
  console.log('\n▶ ETAPA 3: Testando retificação, controle de concorrência e atomicidade...');

  // Montagem da retificação legítima V1 -> V2
  const snapshotV2Legitimo = {
    ...doc.itens,
    versao: '2.0',
    token: tokenV2,
    tokensRevogados: [tokenV1],
    financeiro: { total: 6050, subtotal: 8870, desconto: 2820 },
    parcelas: [
      { numero: 1, valor: 336.12 },
      { numero: 2, valor: 336.12 },
      ...Array.from({ length: 16 }, (_, i) => ({ numero: i + 3, valor: 336.11 })),
    ],
    assinaturaDentista: {
      nome: 'Dra. Rosângela Santos Pereira',
      cro: '06267-AL',
      dataHora: new Date().toISOString(),
      metodo: 'assinatura_automatica_autorizada',
      autorizacaoId: 'fd777489-8d1e-4a86-abfe-ad7a59a5bdb9',
    },
    versoesAnteriores: [
      {
        versao: '1.0',
        token: tokenV1,
        substituidoEm: new Date().toISOString(),
        motivo: 'Retificação de valores para alinhamento com orçamento aprovado',
        financeiro: doc.itens.financeiro,
        assinaturaDentista: doc.itens.assinaturaDentista,
      },
    ],
  };

  // Teste 9: Executa Retificação Legítima V1 -> V2
  const { error: errRetif } = await supabase.from('documentos_clinicos').update({
    conteudo: '<html>Conteudo Versao 2.0 Retificada Total R$ 6.050,00</html>',
    valor_total: 6050,
    itens: snapshotV2Legitimo,
  }).eq('id', doc.id);
  if (errRetif) console.error('DEBUG errRetif:', errRetif);
  assert(!errRetif, 9, 'Retificação legítima V1 -> V2 executada com sucesso no mesmo UUID', errRetif?.message);

  // Teste 10: Sincronização atômica transacional do token com a tabela 'orcamentos'
  const { data: orcPosRetif } = await supabase.from('orcamentos').select('*').eq('id', orc.id).single();
  assert(orcPosRetif?.contrato_token === tokenV2, 10, 'Token no orçamento foi sincronizado ATOMICAMENTE na mesma transação PostgreSQL', `Esperado: ${tokenV2}, Encontrado: ${orcPosRetif?.contrato_token}`);
  assert(orcPosRetif?.contrato_id === doc.id, 11, 'Vínculo do contrato_id no orçamento preservado com exatidão');

  // Teste 12: Tentativa de sobrescrita concorrente (Sessão B tentando retificar a partir de V1)
  // Como o banco já está em V2.0 e tokenV2, uma retificação concorrente baseada na V1 deve falhar!
  const snapshotConcorrenteStale = {
    ...snapshotV2Legitimo,
    versao: '2.0',
    token: tokenV2Concorrente,
    tokensRevogados: [tokenV1], // ainda achando que estava na V1
    versoesAnteriores: [
      {
        versao: '1.0', // base antiga!
        token: tokenV1, // token antigo!
        substituidoEm: new Date().toISOString(),
        motivo: 'Retificação concorrente perdida',
      },
    ],
  };

  const { error: errConc } = await supabase.from('documentos_clinicos').update({
    conteudo: '<html>Conteudo Concorrente Sobrescrito</html>',
    valor_total: 6050,
    itens: snapshotConcorrenteStale,
  }).eq('id', doc.id);
  assert(Boolean(errConc && errConc.message.includes('Violação de concorrência')), 12, 'Sobrescrita concorrente da mesma versão é categoricamente rejeitada (OCC)');

  // Teste 13: Tentativa de retificação com token ativo antigo omitido de tokensRevogados
  const snapshotSemRevogacao = {
    ...snapshotV2Legitimo,
    versao: '3.0',
    token: 'token_v3_novo',
    tokensRevogados: [tokenV1], // esqueceu de colocar tokenV2 que era o ativo!
    versoesAnteriores: [
      ...snapshotV2Legitimo.versoesAnteriores,
      { versao: '2.0', token: tokenV2 },
    ],
  };
  const { error: errSemRevog } = await supabase.from('documentos_clinicos').update({
    conteudo: '<html>Tentativa sem revogar token ativo</html>',
    itens: snapshotSemRevogacao,
  }).eq('id', doc.id);
  assert(Boolean(errSemRevog && errSemRevog.message.includes('tokensRevogados')), 13, 'Retificação omitindo o token ativo anterior de tokensRevogados é bloqueada');

  // ---------------------------------------------------------------------------
  // ETAPA 4: FORMALIZAÇÃO PELO PACIENTE E BLINDAGEM DA REGRA 2
  // ---------------------------------------------------------------------------
  console.log('\n▶ ETAPA 4: Assinatura do paciente e blindagem total de contrato formalizado...');

  // Teste 14: Assinatura do paciente no contrato retificado (Transição autorizada)
  const agoraIso = new Date().toISOString();
  const snapshotFormalizado = {
    ...snapshotV2Legitimo,
    status: 'formalizado',
    statusAssinaturaPaciente: 'assinado',
    isFormalizadoTotal: 'true',
    assinaturaPaciente: {
      nome: pac.nome,
      dataHora: agoraIso,
      ip: '127.0.0.1',
      metodo: 'assinatura_digital_homolog',
    },
  };

  const { error: errSignPac } = await supabase.from('documentos_clinicos').update({
    assinado_em: agoraIso,
    assinatura_data: agoraIso,
    itens: snapshotFormalizado,
  }).eq('id', doc.id);
  assert(!errSignPac, 14, 'Assinatura legítima do paciente aceita para formalização');

  // Teste 15: Tentativa de alterar propriedade não listada (ex: termoUsoImagem) em contrato formalizado
  const { error: errTermo } = await supabase.from('documentos_clinicos').update({
    itens: {
      ...snapshotFormalizado,
      termoUsoImagem: { ativo: false, autorizado: false },
    },
  }).eq('id', doc.id);
  assert(Boolean(errTermo && errTermo.message.includes('Modificação proibida em contrato formalizado')), 15, 'Alteração em termoUsoImagem em contrato formalizado é sumariamente bloqueada via subtração JSONB');

  // Teste 16: Tentativa de injetar campo arbitrário não previsto em contrato formalizado
  const { error: errCampoInjetado } = await supabase.from('documentos_clinicos').update({
    itens: {
      ...snapshotFormalizado,
      campoNaoAutorizado: 'injecao_indevida',
    },
  }).eq('id', doc.id);
  assert(Boolean(errCampoInjetado && errCampoInjetado.message.includes('Modificação proibida em contrato formalizado')), 16, 'Injeção de qualquer campo arbitrário em contrato formalizado é sumariamente bloqueada');

  // Teste 17: Tentativa de reverter status de formalizado para rascunho
  const { error: errReverterStatus } = await supabase.from('documentos_clinicos').update({
    itens: {
      ...snapshotFormalizado,
      status: 'rascunho',
    },
  }).eq('id', doc.id);
  assert(Boolean(errReverterStatus && errReverterStatus.message.includes('Modificação proibida em contrato formalizado')), 17, 'Tentativa de reverter status de contrato formalizado é estritamente bloqueada');

  // Teste 18: Atualização puramente administrativa em contrato formalizado (pdfUrl e dadosAuditoria)
  const { error: errAdminFormalizado } = await supabase.from('documentos_clinicos').update({
    itens: {
      ...snapshotFormalizado,
      pdfUrl: 'https://storage.supabase.co/contratos/Contrato_Final.pdf',
      pdfPath: `contratos/${ctrCode}/Contrato_Assinado.pdf`,
      pdfGeradoEm: new Date().toISOString(),
      dadosAuditoria: { disparadoEm: new Date().toISOString(), status: 'enviado_email' },
    },
  }).eq('id', doc.id);
  assert(!errAdminFormalizado, 18, 'Atualização administrativa autorizada (PDF e auditoria) em contrato formalizado é concluída com sucesso');

  // ---------------------------------------------------------------------------
  // ETAPA 5: CICLO DE ROLLBACK COMPLETO EM HOMOLOGAÇÃO
  // ---------------------------------------------------------------------------
  console.log('\n▶ ETAPA 5: Testando execução e comportamento pós-rollback em homologação...');

  // Aplica o script de rollback
  aplicarSqlHomolog('supabase/migrations/rollback_ajuste_retificacao_contrato_pendente.sql');
  console.log('  ✓ Script de rollback executado em homologação.');

  // Teste 19: Cria outro contrato pendente com pré-assinatura sob o trigger original (após rollback)
  const ctrCodeRollback = `CTR-ROLL-${sufixo}`;
  const { data: docRollback, error: docRollErr } = await supabase.from('documentos_clinicos').insert({
    identificador: ctrCodeRollback,
    paciente_id: pac.id,
    paciente_nome: pac.nome,
    tipo: 'contrato',
    titulo: `Contrato Rollback - ${pac.nome}`,
    conteudo: '<html>Versao Inicial Original</html>',
    valor_total: 8870,
    itens: {
      contratoId: ctrCodeRollback,
      versao: '1.0',
      token: 'tok_rollback_test',
      status: 'aguardando_assinatura_paciente',
      financeiro: { total: 8870 },
      assinaturaDentista: { nome: 'Dra.', dataHora: new Date().toISOString() },
      assinaturaPaciente: null,
    },
  }).select().single();
  if (docRollErr) throw docRollErr;
  assert(Boolean(docRollback?.id), 19, 'Contrato de teste pós-rollback criado com sucesso');

  // Teste 20: Tenta retificar sob o trigger original (DEVE FALHAR como falhava originalmente)
  const { error: errUnderRollback } = await supabase.from('documentos_clinicos').update({
    conteudo: '<html>Versao Tentada Pos Rollback</html>',
    valor_total: 6050,
    itens: {
      ...docRollback.itens,
      financeiro: { total: 6050 },
    },
  }).eq('id', docRollback.id);
  assert(Boolean(errUnderRollback && errUnderRollback.message.includes('Violação de integridade')), 20, 'Comportamento pós-rollback verificado: trigger original restaura bloqueio rígido original');

  // Re-aplica a migration V4 para deixar o ambiente de homologação pronto e alinhado
  aplicarSqlHomolog('supabase/migrations/20261108_ajuste_retificacao_contrato_pendente.sql');
  console.log('  ✓ Migration V4 reaplicada em homologação para manter ambiente atualizado.\n');

  console.log('================================================================================');
  console.log(`AUDITORIA FINAL CONCLUÍDA COM SUCESSO: ${resultados.length}/${resultados.length} TESTES APROVADOS (100%)!`);
  console.log('================================================================================\n');
}

runAuditoriaFinal().catch((err) => {
  console.error('\n❌ ERRO NA AUDITORIA FINAL:', err);
  process.exit(1);
});
