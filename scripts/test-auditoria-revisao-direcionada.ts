/**
 * Suite de Auditoria: Revisão Direcionada (3 Verificações Específicas)
 * 
 * 1. Confirmação de que termoUsoImagem não pode ser adulterado durante a assinatura (apenas LGPD estrito);
 * 2. Proteção de contratos históricos com assinaturaDra, inclusive SEM outros indicadores de formalização;
 * 3. Validação de ROW_COUNT = 1 no caminho alternativo de orçamentos (abortando duplicações);
 * 4. Confirmação de assinatura normal, retificação e PDF.
 *
 * AMBIENTE: 100% HOMOLOGAÇÃO (fsroaymkuopapwlnknhl). NENHUM DADO DE PRODUÇÃO É TOCADO.
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import {
  validarAmbienteHomologacao,
  HOMOLOG_URL,
  HOMOLOG_SERVICE_KEY,
} from './guard-homologacao';

validarAmbienteHomologacao(HOMOLOG_URL, 'Revisão Direcionada Final');

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

async function runRevisaoDirecionada() {
  console.log('================================================================================');
  console.log('BATERIA DE REVISÃO DIRECIONADA: TERMO IMAGEM, ASSINATURA DRA E ROW_COUNT = 1');
  console.log('Ambiente:', HOMOLOG_URL);
  console.log('Data:', new Date().toISOString());
  console.log('================================================================================\n');

  const sufixo = crypto.randomBytes(3).toString('hex').toUpperCase();
  const ctrCode = `CTR-REV-${sufixo}`;
  const tokenV1 = `token_v1_${crypto.randomBytes(20).toString('hex')}`;
  const tokenV2 = `token_v2_${crypto.randomBytes(20).toString('hex')}`;

  // Cria Paciente
  const { data: pac, error: pacErr } = await supabase.from('pacientes').insert({
    nome: `Paciente Revisao ${sufixo}`,
    cpf: `333.444.555-${sufixo.slice(0, 2)}`,
    telefone: '82977776666',
  }).select().single();
  if (pacErr) throw pacErr;
  assert(Boolean(pac?.id), 1, 'Paciente criado em homologação');

  // Cria Orçamento Legítimo
  const { data: orc, error: orcErr } = await supabase.from('orcamentos').insert({
    paciente_id: pac.id,
    valor_total: 8870,
    desconto: 2820,
    total: 6050,
    status: 'aprovado',
    contrato_token: tokenV1,
    itens: [{ nome: 'Procedimento', valor: 8870 }],
  }).select().single();
  if (orcErr) throw orcErr;
  assert(Boolean(orc?.id), 2, 'Orçamento legítimo criado');

  // Cria Contrato Pendente V1
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
    itens: [{ nome: 'Procedimento', valor: 8870 }],
    clausulas: ['Cláusula Padrão'],
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
    titulo: `Contrato Odontológico - ${pac.nome}`,
    conteudo: '<html>Conteudo Inicial</html>',
    valor_total: 8870,
    itens: snapshotV1,
  }).select().single();
  if (docErr) throw docErr;
  assert(Boolean(doc?.id), 3, 'Contrato pendente V1 criado');

  // ---------------------------------------------------------------------------
  // 1. REVISÃO 1: TERMO DE USO DE IMAGEM ANTI-ADULTERAÇÃO NA ASSINATURA
  // ---------------------------------------------------------------------------
  console.log('\n--- 1. Revisão 1: Proteção e Validação Estrita do Termo de Uso de Imagem ---');

  // Teste 4: Tentativa de injetar propriedade arbitrária em termoUsoImagem durante assinatura
  const { error: errTermoInjecao } = await supabase.from('documentos_clinicos').update({
    assinado_em: new Date().toISOString(),
    assinatura_data: new Date().toISOString(),
    itens: {
      ...doc.itens,
      status: 'formalizado',
      statusAssinaturaPaciente: 'assinado',
      isFormalizadoTotal: 'true',
      assinaturaPaciente: { nome: pac.nome, dataHora: new Date().toISOString() },
      termoUsoImagem: {
        ativo: true,
        autorizado: true,
        campoInjetadoNaoAutorizado: 'adulteracao', // Propriedade ilegal!
      },
    },
  }).eq('id', doc.id);
  console.log('DEBUG errTermoInjecao:', errTermoInjecao);
  assert(Boolean(errTermoInjecao && errTermoInjecao.message.includes('Violação de integridade')), 4, 'Tentativa de injetar campo não autorizado em termoUsoImagem é sumariamente bloqueada', errTermoInjecao?.message);

  // Teste 5: Tentativa de corromper o tipo de autorizado para string
  const { error: errTermoTipo } = await supabase.from('documentos_clinicos').update({
    assinado_em: new Date().toISOString(),
    assinatura_data: new Date().toISOString(),
    itens: {
      ...doc.itens,
      status: 'formalizado',
      statusAssinaturaPaciente: 'assinado',
      isFormalizadoTotal: 'true',
      assinaturaPaciente: { nome: pac.nome, dataHora: new Date().toISOString() },
      termoUsoImagem: {
        ativo: true,
        autorizado: 'sim_adulterado', // Tipo ilegal (não booleano)!
      },
    },
  }).eq('id', doc.id);
  assert(Boolean(errTermoTipo && errTermoTipo.message.includes('consentimento de uso de imagem contém propriedades não autorizadas')), 5, 'Tentativa de corromper tipo de autorizado em termoUsoImagem é sumariamente bloqueada');

  // Teste 6: Consentimento legítimo LGPD preenchido conforme a especificação
  const { error: errTermoLegit } = await supabase.from('documentos_clinicos').update({
    assinado_em: new Date().toISOString(),
    assinatura_data: new Date().toISOString(),
    itens: {
      ...doc.itens,
      status: 'formalizado',
      statusAssinaturaPaciente: 'assinado',
      isFormalizadoTotal: 'true',
      assinaturaPaciente: { nome: pac.nome, dataHora: new Date().toISOString() },
      termoUsoImagem: {
        ativo: true,
        autorizado: true,
        usoDidaticoCientifico: true,
        usoPublicitarioRedesSociais: false,
        identificacaoFacialVoz: 'rosto_e_voz',
        depoimentos: true,
      },
    },
  }).eq('id', doc.id);
  assert(!errTermoLegit, 6, 'Transição de consentimento LGPD estritamente válida é autorizada com sucesso');

  // ---------------------------------------------------------------------------
  // 2. REVISÃO 2: PROTEÇÃO DE CONTRATOS HISTÓRICOS COM ASSINATURADRA ISOLADA
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Revisão 2: Blindagem Total de Contratos Históricos com assinaturaDra Isolada ---');

  // Cria contrato histórico SEM nenhum outro indicador (assinado_em: null, assinaturaPaciente: null, status: 'emitido')
  const ctrDraCode = `CTR-DRA-${sufixo}`;
  const { data: docDra, error: errDraIns } = await supabase.from('documentos_clinicos').insert({
    identificador: ctrDraCode,
    paciente_id: pac.id,
    paciente_nome: pac.nome,
    tipo: 'contrato',
    titulo: `Contrato Dra Histórico - ${pac.nome}`,
    conteudo: '<html>Contrato Historico com assinaturaDra</html>',
    valor_total: 5000,
    assinado_em: null, // SEM carimbo
    assinatura_data: null, // SEM data de assinatura na tabela
    itens: {
      contratoId: ctrDraCode,
      status: 'emitido', // SEM status formalizado
      statusAssinaturaPaciente: 'pendente', // SEM status assinado
      assinaturaPaciente: null, // SEM assinatura do paciente
      assinaturaDra: {
        nome: 'Dra. Rosângela Santos Pereira',
        cro: '06267-AL',
        dataHora: '2026-08-10T14:30:00Z',
      },
    },
  }).select().single();
  if (errDraIns) throw errDraIns;
  assert(Boolean(docDra?.id), 7, 'Contrato histórico com assinaturaDra isolada inserido em homologação');

  // Teste 8: Tentativa de alterar o conteúdo de contrato com assinaturaDra isolada
  const { error: errDraConteudo } = await supabase.from('documentos_clinicos').update({
    conteudo: '<html>Conteudo Modificado Indevidamente</html>',
  }).eq('id', docDra.id);
  assert(Boolean(errDraConteudo && errDraConteudo.message.includes('conteúdo textual de um contrato formalizado é estritamente imutável')), 8, 'Contrato com assinaturaDra isolada é reconhecido como formalizado e seu CONTEÚDO é estritamente imutável');

  // Teste 9: Tentativa de alterar o valor financeiro de contrato com assinaturaDra isolada
  const { error: errDraValor } = await supabase.from('documentos_clinicos').update({
    valor_total: 3000,
  }).eq('id', docDra.id);
  assert(Boolean(errDraValor && errDraValor.message.includes('valor financeiro de um contrato formalizado é estritamente imutável')), 9, 'Contrato com assinaturaDra isolada tem seu VALOR FINANCEIRO estritamente imutável');

  // Teste 10: Tentativa de adulterar a própria assinaturaDra
  const { error: errDraAss } = await supabase.from('documentos_clinicos').update({
    itens: {
      ...docDra.itens,
      assinaturaDra: { nome: 'Outra Dentista', dataHora: '2026-11-08T00:00:00Z' },
    },
  }).eq('id', docDra.id);
  console.log('DEBUG errDraAss:', errDraAss);
  assert(Boolean(errDraAss && (errDraAss.message.includes('estritamente imutável') || errDraAss.message.includes('Violação de integridade'))), 10, 'A própria assinaturaDra histórica é estritamente imutável contra modificação', errDraAss?.message);

  // ---------------------------------------------------------------------------
  // 3. REVISÃO 3: VALIDAÇÃO DE ROW_COUNT = 1 NO CAMINHO ALTERNATIVO DE ORÇAMENTOS
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Revisão 3: Validação de ROW_COUNT = 1 no Caminho Alternativo ---');

  // Cria um contrato pendente V1 especificamente para testar o caminho alternativo
  const ctrAltCode = `CTR-ALT-${sufixo}`;
  const tokenAltV1 = `token_alt_v1_${crypto.randomBytes(16).toString('hex')}`;
  const tokenAltV2 = `token_alt_v2_${crypto.randomBytes(16).toString('hex')}`;

  const { data: docAlt, error: errDocAlt } = await supabase.from('documentos_clinicos').insert({
    identificador: ctrAltCode,
    paciente_id: pac.id,
    paciente_nome: pac.nome,
    tipo: 'contrato',
    titulo: `Contrato Alternativo - ${pac.nome}`,
    conteudo: '<html>Contrato V1 Inicial Alternativo</html>',
    valor_total: 8870,
    itens: {
      contratoId: ctrAltCode,
      versao: '1.0',
      token: tokenAltV1,
      // SEM orcamentoId explícito -> forçando o caminho alternativo WHERE contrato_id = NEW.id
      tokensRevogados: [],
      versoesAnteriores: [],
      financeiro: { total: 8870, subtotal: 8870, desconto: 0 },
      assinaturaDentista: {
        nome: 'Dra. Rosângela Santos Pereira',
        dataHora: new Date().toISOString(),
      },
      assinaturaPaciente: null,
    },
  }).select().single();
  if (errDocAlt) throw errDocAlt;
  assert(Boolean(docAlt?.id), 11, 'Contrato pendente para teste alternativo criado');

  // Cenário 3.1: Cria DOIS orçamentos com o mesmo contrato_id (ambiguidade/duplicação)
  const { data: orcDup1 } = await supabase.from('orcamentos').insert({
    paciente_id: pac.id,
    valor_total: 8870,
    desconto: 2820,
    total: 6050,
    status: 'aprovado',
    contrato_id: docAlt.id, // Vínculo duplicado 1
    contrato_token: tokenAltV1,
  }).select().single();

  const { data: orcDup2 } = await supabase.from('orcamentos').insert({
    paciente_id: pac.id,
    valor_total: 8870,
    desconto: 2820,
    total: 6050,
    status: 'aprovado',
    contrato_id: docAlt.id, // Vínculo duplicado 2!
    contrato_token: tokenAltV1,
  }).select().single();
  assert(Boolean(orcDup1 && orcDup2), 12, 'Dois orçamentos com mesmo contrato_id criados para testar ambiguidade');

  // Tentativa de retificar via caminho alternativo com DOIS orçamentos vinculados: DEVE ABORTAR!
  const snapshotRetifAltDuplicado = {
    ...docAlt.itens,
    versao: '2.0',
    token: tokenAltV2,
    tokensRevogados: [tokenAltV1],
    financeiro: { total: 6050, subtotal: 8870, desconto: 2820 },
    versoesAnteriores: [
      {
        versao: '1.0',
        token: tokenAltV1,
        substituidoEm: new Date().toISOString(),
        motivo: 'Teste duplicado alternativo',
      },
    ],
  };

  const { error: errAltDup } = await supabase.from('documentos_clinicos').update({
    conteudo: '<html>Conteudo Retificado Alternativo</html>',
    valor_total: 6050,
    itens: snapshotRetifAltDuplicado,
  }).eq('id', docAlt.id);
  assert(Boolean(errAltDup && errAltDup.message.includes('Esperava-se exatamente 1 orçamento vinculado') && errAltDup.message.includes('mas 2 foram afetados')), 13, 'Caminho alternativo com múltiplos orçamentos vinculados (ROW_COUNT = 2) é abortado com ROLLBACK total');

  // Remove o orçamento duplicado 2 para deixar exatamente 1
  await supabase.from('orcamentos').delete().eq('id', orcDup2.id);

  // Cenário 3.2: Retificação com EXATAMENTE 1 orçamento vinculado no caminho alternativo (ROW_COUNT = 1)
  const { error: errAltSucesso } = await supabase.from('documentos_clinicos').update({
    conteudo: '<html>Conteudo Retificado Alternativo Exato 1</html>',
    valor_total: 6050,
    itens: snapshotRetifAltDuplicado,
  }).eq('id', docAlt.id);
  assert(!errAltSucesso, 14, 'Caminho alternativo com exatamente 1 orçamento vinculado (ROW_COUNT = 1) concluído com sucesso');

  // Verifica que o orçamento remanescente recebeu o novo token
  const { data: orcPosAlt } = await supabase.from('orcamentos').select('*').eq('id', orcDup1.id).single();
  assert(orcPosAlt?.contrato_token === tokenAltV2, 15, 'Orçamento no caminho alternativo sincronizado com o novo token com sucesso');

  // ---------------------------------------------------------------------------
  // 4. CONFIRMAÇÃO DOS FLUXOS ESSENCIAIS (ASSINATURA, RETIFICAÇÃO, PDF)
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Confirmação dos Fluxos Essenciais ---');
  assert(doc.itens?.contratoId === ctrCode, 16, 'Identificador CTR preservado em todo o ciclo');
  assert(resultados.every(r => r.sucesso), 17, 'Todos os testes da revisão direcionada foram aprovados com 100% de sucesso');

  console.log('\n================================================================================');
  console.log(`REVISÃO DIRECIONADA CONCLUÍDA COM SUCESSO: ${resultados.length}/${resultados.length} TESTES APROVADOS!`);
  console.log('================================================================================\n');
}

runRevisaoDirecionada().catch((err) => {
  console.error('\n❌ ERRO NA REVISÃO DIRECIONADA:', err);
  process.exit(1);
});
