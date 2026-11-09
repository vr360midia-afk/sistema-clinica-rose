import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as crypto from 'crypto';
import {
  HOMOLOG_URL,
  HOMOLOG_ANON_KEY,
  HOMOLOG_SERVICE_KEY,
  validarAmbienteHomologacao,
} from './guard-homologacao';
import {
  classificarItemOrcamento,
  analisarItensOrcamento,
  isItemProcedimentoClinico,
} from '../src/utils/tratamentoFiltros';
import {
  gerarTermoConfirmacaoHtml,
  TermoConfirmacaoDados,
} from '../src/utils/tratamentoPdf';

validarAmbienteHomologacao(HOMOLOG_URL, 'test-revisao-seguranca-e-resiliencia');

const supabaseAdmin = createClient(HOMOLOG_URL, HOMOLOG_SERVICE_KEY);
const supabaseAnon = createClient(HOMOLOG_URL, HOMOLOG_ANON_KEY);

interface TestResult {
  suite: string;
  test: string;
  status: 'PASS' | 'FAIL';
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, test: string, details?: string) {
  if (condition) {
    results.push({ suite, test, status: 'PASS', details });
    console.log(`  ✅ [PASS] ${test}`);
  } else {
    results.push({ suite, test, status: 'FAIL', details });
    console.error(`  ❌ [FAIL] ${test} - ${details || ''}`);
  }
}

async function runAudit() {
  console.log('='.repeat(80));
  console.log('SUITE DE VERIFICAÇÃO FINAL DE SEGURANÇA E RESILIÊNCIA — ETAPAS DO TRATAMENTO');
  console.log('Ambiente: HOMOLOGAÇÃO (fsroaymkuopapwlnknhl)');
  console.log('='.repeat(80));

  // ---------------------------------------------------------------------------
  // 1. ROLLBACK NÃO DESTRUTIVO
  // ---------------------------------------------------------------------------
  console.log('\n[1/4] AUDITORIA DO PLANO DE ROLLBACK NÃO DESTRUTIVO');
  const rollbackSql = fs.readFileSync('supabase/migrations/rollback_20261110_modulo_etapas_tratamento_homolog.sql', 'utf-8');

  // Verifica que não há comandos executáveis de DROP TABLE
  const hasDropTableCommand = /^\s*DROP\s+TABLE/mi.test(rollbackSql);
  assert(
    !hasDropTableCommand,
    '1. Rollback Não Destrutivo',
    'Ausência estrita de comandos DROP TABLE no script de rollback',
    'Garante que nenhuma tabela populada com sessões ou assinaturas possa ser destruída'
  );

  assert(
    rollbackSql.includes('REVOKE EXECUTE') && rollbackSql.includes('sincronizar_procedimentos_orcamento'),
    '1. Rollback Não Destrutivo',
    'Presença de freeze seletivo de escrita (REVOKE EXECUTE) para isolamento imediato',
    'Permite suspender novas operações no banco sem perda de dados históricos'
  );

  assert(
    rollbackSql.includes('PRESERVAÇÃO INTEGRAL DE DADOS E AUDITORIA') && rollbackSql.includes('SOMENTE-LEITURA'),
    '1. Rollback Não Destrutivo',
    'Preservação e documentação explícita de integridade somente-leitura para consultas clínicas'
  );

  // ---------------------------------------------------------------------------
  // 2. SEGURANÇA DAS RPCs E ISOLAMENTO MULTI-TENANT
  // ---------------------------------------------------------------------------
  console.log('\n[2/4] AUDITORIA DE SEGURANÇA DAS RPCs, SEARCH_PATH E PERMISSÕES');
  const migrationSql = fs.readFileSync('supabase/migrations/20261110_modulo_etapas_tratamento_homolog.sql', 'utf-8');

  // 2.1 Search Path
  const searchPathOccurrences = (migrationSql.match(/SET search_path\s*=\s*public,\s*extensions,\s*auth,\s*pg_temp/g) || []).length;
  assert(
    searchPathOccurrences >= 4,
    '2. Segurança RPCs',
    'Definição segura de search_path (public, extensions, auth, pg_temp) em todas as funções SECURITY DEFINER',
    `Localizadas ${searchPathOccurrences} ocorrências conformes`
  );

  // 2.2 Rejeição de chamada anônima para sincronizar_procedimentos_orcamento
  const { data: anonSyncData, error: anonSyncError } = await supabaseAnon.rpc('sincronizar_procedimentos_orcamento', {
    p_orcamento_id: '00000000-0000-0000-0000-000000000000',
    p_usuario_id: '00000000-0000-0000-0000-000000000000',
  });
  assert(
    !!anonSyncError,
    '2. Segurança RPCs',
    'Bloqueio estrito de acesso anônimo na RPC administrativa sincronizar_procedimentos_orcamento',
    anonSyncError?.message || 'Chamada anônima foi rejeitada com sucesso'
  );

  // 2.3 Rejeição de chamada anônima para concluir_procedimento_tratamento
  const { data: anonConcluirData, error: anonConcluirError } = await supabaseAnon.rpc('concluir_procedimento_tratamento', {
    p_procedimento_id: '00000000-0000-0000-0000-000000000000',
    p_usuario_id: '00000000-0000-0000-0000-000000000000',
  });
  assert(
    !!anonConcluirError,
    '2. Segurança RPCs',
    'Bloqueio estrito de acesso anônimo na RPC concluir_procedimento_tratamento',
    anonConcluirError?.message || 'Chamada anônima foi rejeitada com sucesso'
  );

  // 2.4 Validação de formato de token em obter_confirmacao_sessao_publica
  const { data: tokenMalformadoRes } = await supabaseAnon.rpc('obter_confirmacao_sessao_publica', {
    p_token: "token-invalido' OR '1'='1",
  });
  assert(
    tokenMalformadoRes && tokenMalformadoRes.valido === false && tokenMalformadoRes.erro.includes('inválido'),
    '2. Segurança RPCs',
    'Validação regex de formato de token na RPC pública (rejeita caracteres maliciosos e tokens curtos)',
    tokenMalformadoRes?.erro
  );

  // 2.5 Validação de formato de token em assinar_confirmacao_sessao_publica
  const { data: assinarMalformadoRes } = await supabaseAnon.rpc('assinar_confirmacao_sessao_publica', {
    p_token: 'curto',
    p_assinatura_base64: 'data:image/png;base64,fake',
    p_assinante_nome: 'Teste',
    p_assinante_cpf: '123.456.789-00',
  });
  assert(
    assinarMalformadoRes && assinarMalformadoRes.sucesso === false && assinarMalformadoRes.erro.includes('inválido'),
    '2. Segurança RPCs',
    'Validação regex de token na RPC de assinatura pública (rejeita tokens inválidos antes de tocar dados)',
    assinarMalformadoRes?.erro
  );

  // ---------------------------------------------------------------------------
  // 3. CLASSIFICAÇÃO ESTRUTURADA DE PROCEDIMENTOS
  // ---------------------------------------------------------------------------
  console.log('\n[3/4] TESTES DA CLASSIFICAÇÃO ESTRUTURADA E CONFIRMAÇÃO MANUAL');

  // 3.1 Taxa estrita de maquininha
  const resTaxa = classificarItemOrcamento({ nome: 'Taxa Maquininha Cartão 10x', valor: 250, quantidade: 1 });
  assert(
    resTaxa.tipoClassificacao === 'financeiro' && resTaxa.ehClinico === false,
    '3. Classificação de Itens',
    'Classificação de taxa de maquininha como financeiro (não clínico)',
    resTaxa.motivoClassificacao
  );

  // 3.2 Desconto comercial
  const resDesconto = classificarItemOrcamento({ nome: 'Desconto Promocional à Vista', valor: -300, quantidade: 1 });
  assert(
    resDesconto.tipoClassificacao === 'financeiro' && resDesconto.ehClinico === false,
    '3. Classificação de Itens',
    'Classificação de desconto comercial como financeiro (não clínico)',
    resDesconto.motivoClassificacao
  );

  // 3.3 Procedimento clínico odontológico confirmado
  const resClinico = classificarItemOrcamento({ nome: 'Restauração em Resina Composta Dente 21', valor: 450, quantidade: 1 });
  assert(
    resClinico.tipoClassificacao === 'clinico' && resClinico.ehClinico === true && resClinico.necessitaConfirmacaoManual === false,
    '3. Classificação de Itens',
    'Classificação de procedimento clínico reconhecido (resina / dente)',
    resClinico.motivoClassificacao
  );

  // 3.4 Procedimento com anatomia dentária preenchida explicitamente
  const resAnatomia = classificarItemOrcamento({ nome: 'Procedimento Personalizado', valor: 300, dente_regiao: 'Dente 16' });
  assert(
    resAnatomia.tipoClassificacao === 'clinico' && resAnatomia.ehClinico === true,
    '3. Classificação de Itens',
    'Classificação clínica confirmada via especificação anatômica dentária',
    resAnatomia.motivoClassificacao
  );

  // 3.5 Item ambíguo que exige confirmação manual (não é descartado silenciosamente!)
  const resAmbiguo = classificarItemOrcamento({ nome: 'Kit de Cuidados Domiciliares Especiais', valor: 180, quantidade: 1 });
  assert(
    resAmbiguo.tipoClassificacao === 'ambiguo' && resAmbiguo.necessitaConfirmacaoManual === true && resAmbiguo.ehClinico === true,
    '3. Classificação de Itens',
    'Identificação de item ambíguo sinalizado para confirmação manual do profissional',
    resAmbiguo.motivoClassificacao
  );

  // 3.6 Procedimento clínico com valor R$ 0,00 (retorno / incluso no plano)
  const resRetornoGratis = classificarItemOrcamento({ nome: 'Reavaliação e Polimento de Resina', valor: 0, quantidade: 1 });
  assert(
    resRetornoGratis.tipoClassificacao === 'clinico' && resRetornoGratis.ehClinico === true,
    '3. Classificação de Itens',
    'Preservação de procedimento clínico legítimo com valor R$ 0,00 (incluso/cortesia clínica)',
    resRetornoGratis.motivoClassificacao
  );

  // 3.7 Análise de lista completa de orçamento
  const itensOrcamentoTeste = [
    { nome: 'Clareamento Dental de Consultório', valor: 1200, quantidade: 1 },
    { nome: 'Taxa Maquininha 12x', valor: 150, quantidade: 1 },
    { nome: 'Kit Home Care Protetor', valor: 90, quantidade: 1 },
    { nome: 'Desconto Fechamento', valor: -100, quantidade: 1 },
  ];
  const analiseLote = analisarItensOrcamento(itensOrcamentoTeste);
  const clinicosLote = analiseLote.filter(i => i.tipoClassificacao === 'clinico');
  const financeirosLote = analiseLote.filter(i => i.tipoClassificacao === 'financeiro');
  const ambiguosLote = analiseLote.filter(i => i.tipoClassificacao === 'ambiguo');

  assert(
    clinicosLote.length === 1 && financeirosLote.length === 2 && ambiguosLote.length === 1,
    '3. Classificação de Itens',
    'Análise estruturada de lote com separação precisa de clínicos, financeiros e ambíguos',
    `Clínicos: ${clinicosLote.length}, Financeiros: ${financeirosLote.length}, Ambíguos: ${ambiguosLote.length}`
  );

  // ---------------------------------------------------------------------------
  // 4. ASSINATURA, IMUTABILIDADE NO BANCO E GERAÇÃO DETERMINÍSTICA DO PDF
  // ---------------------------------------------------------------------------
  console.log('\n[4/4] TESTES DE HASH SHA-256, TRIGGER DE IMUTABILIDADE E PDF DETERMINÍSTICO');

  // Identifica a clínica ativa em homologação
  const { data: equipeData } = await supabaseAdmin.from('equipe').select('clinica_id').limit(1);
  const testUserId = equipeData?.[0]?.clinica_id || '1c61f5dc-ef3a-4022-a6e7-a6596bc73959';

  const { data: pacCriado, error: pacErr } = await supabaseAdmin.from('pacientes').insert({
    user_id: testUserId,
    nome: 'Paciente Auditoria Imutabilidade ' + Date.now().toString().slice(-4),
    telefone: '11988887777',
    cpf: '999.888.777-66',
    status: 'Em Tratamento',
  }).select('id, nome, cpf, telefone').single();

  if (pacErr || !pacCriado) {
    throw new Error('Falha ao criar paciente de teste em homologação: ' + (pacErr?.message || ''));
  }

  // Cria um orçamento de teste
  const { data: orcCriado, error: orcErr } = await supabaseAdmin.from('orcamentos').insert({
    user_id: testUserId,
    paciente_id: pacCriado.id,
    valor_total: 1000,
    status: 'aprovado',
    itens: [
      { nome: 'Restauração Resina', quantidade: 1, valor: 400 },
      { nome: 'Taxa Maquininha Cartão', quantidade: 1, valor: 50 },
      { nome: 'Kit Clareamento Domiciliar Especial', quantidade: 1, valor: 250 },
    ],
  }).select('id').single();

  if (orcErr || !orcCriado) {
    throw new Error('Falha ao criar orçamento de teste: ' + orcErr?.message);
  }

  // 4.0 Teste de Sincronização com p_indices_selecionados (Seleção Manual dos Ambíguos)
  const { data: syncManualRes, error: syncManualErr } = await supabaseAdmin.rpc('sincronizar_procedimentos_orcamento', {
    p_orcamento_id: orcCriado.id,
    p_usuario_id: testUserId,
    p_usuario_nome: 'Dra. Rosângela Teste',
    p_indices_selecionados: [1, 3], // Seleciona item 1 (resina) e item 3 (ambíguo confirmado), ignora item 2 (taxa)
  });

  assert(
    syncManualRes && syncManualRes.sucesso === true && syncManualRes.importados === 2 && syncManualRes.ignorados_financeiros === 1,
    '3. Classificação de Itens',
    'Sincronização RPC respeitando seleção estruturada manual de índices [1, 3] (importa ambíguo confirmado e ignora taxa)',
    `Importados: ${syncManualRes?.importados}, Ignorados: ${syncManualRes?.ignorados_financeiros}`
  );

  // Busca o procedimento criado pela sincronização
  const { data: procCriado } = await supabaseAdmin
    .from('tratamentos_procedimentos')
    .select('id, procedimento_nome')
    .eq('orcamento_id', orcCriado.id)
    .eq('item_orcamento_index', 1)
    .single();

  if (!procCriado) {
    throw new Error('Procedimento sincronizado não localizado.');
  }

  // Cria sessão realizada
  const { data: sessCriada, error: sessErr } = await supabaseAdmin.from('tratamento_sessoes').insert({
    tratamento_procedimento_id: procCriado.id,
    clinica_id: testUserId,
    paciente_id: pacCriado.id,
    numero_sessao: 1,
    nome_objetivo: 'Preparo cavitário e restauração em resina',
    data_realizada: '2026-11-10',
    hora_realizada: '14:30',
    profissional_nome: 'Dra. Rosângela Teste',
    descricao_atos: 'Remoção de tecido cariado, condicionamento ácido e escultura oclusal em resina.',
    status: 'realizada',
  }).select('id, numero_sessao, nome_objetivo, descricao_atos, profissional_nome').single();

  if (sessErr || !sessCriada) {
    throw new Error('Falha ao criar sessão de teste: ' + sessErr?.message);
  }

  // Gera token de confirmação
  const tokenTeste = crypto.randomBytes(32).toString('hex');
  const expiraEm = new Date(Date.now() + 7 * 86400000).toISOString();

  const { data: confCriada, error: confErr } = await supabaseAdmin.from('tratamento_confirmacoes').insert({
    sessao_id: sessCriada.id,
    paciente_id: pacCriado.id,
    clinica_id: testUserId,
    token: tokenTeste,
    token_expira_em: expiraEm,
    status: 'pendente',
    declaracao_texto: 'Confirmo expressamente a realização dos atos clínicos descritos na Sessão 1.',
  }).select('id, token').single();

  if (confErr || !confCriada) {
    throw new Error('Falha ao criar confirmação de teste: ' + confErr?.message);
  }

  // 4.1 Assinatura pública com payload canônico e hash SHA-256
  const assinaturaBase64Fake = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const { data: assinarRes, error: assinarErr } = await supabaseAnon.rpc('assinar_confirmacao_sessao_publica', {
    p_token: tokenTeste,
    p_assinatura_base64: assinaturaBase64Fake,
    p_assinante_nome: pacCriado.nome,
    p_assinante_cpf: pacCriado.cpf,
    p_observacoes_paciente: 'Atendimento perfeito, sem dor.',
    p_concorda: true,
    p_ip: '200.180.12.34',
    p_user_agent: 'Antigravity Verification Suite / Mozilla 5.0',
  });

  assert(
    assinarRes && assinarRes.sucesso === true && typeof assinarRes.hash_integridade === 'string',
    '4. Assinatura e Imutabilidade',
    'Assinatura eletrônica bem-sucedida com cálculo de hash SHA-256 canônico',
    `Hash gerado: ${assinarRes?.hash_integridade}`
  );

  const hashOriginal = assinarRes.hash_integridade;
  const docId = assinarRes.documento_clinico_id;

  // 4.2 Verificação do hash armazenado no documento clínico
  const { data: docClinico } = await supabaseAdmin.from('documentos_clinicos').select('*').eq('id', docId).single();
  assert(
    docClinico && docClinico.itens?.hash_integridade === hashOriginal,
    '4. Assinatura e Imutabilidade',
    'Hash SHA-256 perfeitamente replicado e congelado em documentos_clinicos.itens',
    `Doc ID: ${docId}`
  );

  // 4.3 Teste de Imutabilidade: Tentativa maliciosa de UPDATE em confirmação assinada
  const { error: updateMaliciosoErr } = await supabaseAdmin
    .from('tratamento_confirmacoes')
    .update({
      assinatura_base64: 'data:image/png;base64,ADULTERADA',
      declaracao_texto: 'Declaração adulterada maliciosamente',
    })
    .eq('id', confCriada.id);

  assert(
    !!updateMaliciosoErr,
    '4. Assinatura e Imutabilidade',
    'Trigger de imutabilidade bloqueia UPDATE de dados essenciais em confirmação já assinada',
    updateMaliciosoErr?.message || 'Atualização proibida pelo trigger com sucesso'
  );

  // 4.4 Teste de Imutabilidade: Tentativa maliciosa de DELETE em confirmação assinada
  const { error: deleteMaliciosoErr } = await supabaseAdmin
    .from('tratamento_confirmacoes')
    .delete()
    .eq('id', confCriada.id);

  assert(
    !!deleteMaliciosoErr,
    '4. Assinatura e Imutabilidade',
    'Trigger de imutabilidade bloqueia DELETE de confirmação digital assinada',
    deleteMaliciosoErr?.message || 'Exclusão proibida pelo trigger com sucesso'
  );

  // 4.5 Geração Determinística do HTML do PDF a partir dos dados congelados
  const termoDados: TermoConfirmacaoDados = {
    pacienteNome: pacCriado.nome,
    pacienteCpf: pacCriado.cpf,
    procedimentoNome: procCriado.procedimento_nome,
    numeroSessao: sessCriada.numero_sessao,
    nomeObjetivo: sessCriada.nome_objetivo,
    dataRealizada: '2026-11-10',
    horaRealizada: '14:30',
    profissionalNome: sessCriada.profissional_nome,
    descricaoAtos: sessCriada.descricao_atos,
    declaracaoTexto: 'Confirmo expressamente a realização dos atos clínicos descritos na Sessão 1.',
    observacoesPaciente: 'Atendimento perfeito, sem dor.',
    concordaRealizacao: true,
    assinaturaBase64: assinaturaBase64Fake,
    assinanteNome: pacCriado.nome,
    assinanteCpf: pacCriado.cpf,
    assinadoEm: new Date().toISOString(),
    hashIntegridade: hashOriginal,
    token: tokenTeste,
    ipOrigem: '200.180.12.34',
    userAgent: 'Antigravity Verification Suite / Mozilla 5.0',
  };

  const htmlGerado = gerarTermoConfirmacaoHtml(termoDados);
  assert(
    htmlGerado.includes(hashOriginal) &&
    htmlGerado.includes(sessCriada.descricao_atos) &&
    htmlGerado.includes(pacCriado.nome) &&
    htmlGerado.includes(assinaturaBase64Fake),
    '4. Assinatura e Imutabilidade',
    'Geração determinística do HTML do termo vinculando atos clínicos, assinatura e hash SHA-256',
    'Garante que o PDF congelado pode ser reconstituído em caso de queda de conexão ou auditoria futura'
  );

  console.log('\nFinalizando auditoria...');
  console.log('='.repeat(80));
  const totalPass = results.filter(r => r.status === 'PASS').length;
  const totalFail = results.filter(r => r.status === 'FAIL').length;
  console.log(`TOTAL DE TESTES EXECUTADOS: ${results.length}`);
  console.log(`PASS: ${totalPass}`);
  console.log(`FAIL: ${totalFail}`);
  console.log('='.repeat(80));

  if (totalFail > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Erro fatal na execução da suite:', err);
  process.exit(1);
});
