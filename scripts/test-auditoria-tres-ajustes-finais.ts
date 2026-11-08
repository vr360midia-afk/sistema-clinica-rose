/**
 * Suite de Auditoria Estrita: Três Ajustes Finais, Fluxos de PDF e Compatibilidade Histórica
 *
 * Validações específicas requeridas:
 * 1. Comparação integral dos dados contratuais na assinatura do paciente (bloqueio de qualquer adulteração simultânea);
 * 2. Whitelist de colunas da tabela documentos_clinicos e propriedades JSONB em atualizações administrativas;
 * 3. Validação de linhas afetadas (ROW_COUNT) no UPDATE de orcamentos (abortando transação se orçamento não for encontrado);
 * 4. Validação do fluxo normal de assinatura e anexação de PDF;
 * 5. Compatibilidade com formatos históricos de assinatura e campos JSON nulos.
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

validarAmbienteHomologacao(HOMOLOG_URL, 'Auditoria dos Três Ajustes Finais');

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

async function runAuditoriaTresAjustesFinais() {
  console.log('================================================================================');
  console.log('BATERIA DE AUDITORIA: TRÊS AJUSTES FINAIS, FLUXO DE PDF E COMPATIBILIDADE HISTÓRICA');
  console.log('Ambiente:', HOMOLOG_URL);
  console.log('Data:', new Date().toISOString());
  console.log('================================================================================\n');

  const sufixo = crypto.randomBytes(3).toString('hex').toUpperCase();
  const ctrCode = `CTR-AJUSTES-${sufixo}`;
  const tokenV1 = `token_v1_${crypto.randomBytes(20).toString('hex')}`;
  const tokenV2 = `token_v2_${crypto.randomBytes(20).toString('hex')}`;

  // Cria Paciente
  const { data: pac, error: pacErr } = await supabase.from('pacientes').insert({
    nome: `Paciente Auditoria Ajustes ${sufixo}`,
    cpf: `222.333.444-${sufixo.slice(0, 2)}`,
    telefone: '82988887777',
  }).select().single();
  if (pacErr) throw pacErr;
  assert(Boolean(pac?.id), 1, 'Paciente de homologação criado');

  // Cria Orçamento Legítimo
  const { data: orc, error: orcErr } = await supabase.from('orcamentos').insert({
    paciente_id: pac.id,
    valor_total: 8870,
    desconto: 2820,
    total: 6050,
    status: 'aprovado',
    contrato_token: tokenV1,
    itens: [{ nome: 'Tratamento Estético', valor: 8870 }],
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
    itens: [{ nome: 'Tratamento Estético', valor: 8870 }],
    clausulas: ['Cláusula 1ª: Objeto', 'Cláusula 2ª: Do Preço', 'Cláusula 3ª: Condições'],
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
    conteudo: '<html>Contrato V1 Inicial</html>',
    valor_total: 8870,
    itens: snapshotV1,
  }).select().single();
  if (docErr) throw docErr;
  assert(Boolean(doc?.id), 3, 'Contrato pendente V1 criado');

  // ---------------------------------------------------------------------------
  // AJUSTE 1: COMPARAÇÃO INTEGRAL DOS DADOS NA TRANSIÇÃO DE ASSINATURA DO PACIENTE
  // ---------------------------------------------------------------------------
  console.log('\n--- 1. Auditoria do Ajuste 1: Comparação Integral na Assinatura do Paciente ---');

  // Teste 4: Tentativa de assinar pelo paciente MAS alterando lista de procedimentos
  const { error: errSignItens } = await supabase.from('documentos_clinicos').update({
    assinado_em: new Date().toISOString(),
    assinatura_data: new Date().toISOString(),
    itens: {
      ...doc.itens,
      status: 'formalizado',
      statusAssinaturaPaciente: 'assinado',
      isFormalizadoTotal: 'true',
      assinaturaPaciente: { nome: pac.nome, dataHora: new Date().toISOString() },
      itens: [{ nome: 'Procedimento Adulterado Durante Assinatura', valor: 8870 }], // Adulteração!
    },
  }).eq('id', doc.id);
  console.log('DEBUG errSignItens:', errSignItens);
  assert(Boolean(errSignItens && errSignItens.message.includes('Comparação integral falhou')), 4, 'Tentativa de adulterar PROCEDIMENTOS durante assinatura do paciente é bloqueada', errSignItens?.message);

  // Teste 5: Tentativa de assinar pelo paciente MAS alterando cláusulas
  const { error: errSignClaus } = await supabase.from('documentos_clinicos').update({
    assinado_em: new Date().toISOString(),
    assinatura_data: new Date().toISOString(),
    itens: {
      ...doc.itens,
      status: 'formalizado',
      statusAssinaturaPaciente: 'assinado',
      isFormalizadoTotal: 'true',
      assinaturaPaciente: { nome: pac.nome, dataHora: new Date().toISOString() },
      clausulas: ['Cláusula Maliciosa Adicionada'], // Adulteração!
    },
  }).eq('id', doc.id);
  assert(Boolean(errSignClaus && errSignClaus.message.includes('Comparação integral falhou')), 5, 'Tentativa de adulterar CLÁUSULAS durante assinatura do paciente é bloqueada');

  // Teste 6: Tentativa de assinar pelo paciente MAS alterando termos financeiros
  const { error: errSignFinanceiro } = await supabase.from('documentos_clinicos').update({
    assinado_em: new Date().toISOString(),
    assinatura_data: new Date().toISOString(),
    itens: {
      ...doc.itens,
      status: 'formalizado',
      statusAssinaturaPaciente: 'assinado',
      isFormalizadoTotal: 'true',
      assinaturaPaciente: { nome: pac.nome, dataHora: new Date().toISOString() },
      financeiro: { total: 3000, subtotal: 8870, desconto: 5870 }, // Adulteração financeira!
    },
  }).eq('id', doc.id);
  console.log('DEBUG errSignFinanceiro:', errSignFinanceiro);
  assert(Boolean(errSignFinanceiro && (errSignFinanceiro.message.includes('Comparação integral falhou') || errSignFinanceiro.message.includes('Violação'))), 6, 'Tentativa de adulterar FINANCEIRO durante assinatura do paciente é bloqueada', errSignFinanceiro?.message);

  // Teste 7: Tentativa de assinar pelo paciente MAS alterando coluna da tabela (ex: titulo)
  const { error: errSignCol } = await supabase.from('documentos_clinicos').update({
    assinado_em: new Date().toISOString(),
    assinatura_data: new Date().toISOString(),
    titulo: 'Título Adulterado Durante Formalização',
    itens: {
      ...doc.itens,
      status: 'formalizado',
      statusAssinaturaPaciente: 'assinado',
      isFormalizadoTotal: 'true',
      assinaturaPaciente: { nome: pac.nome, dataHora: new Date().toISOString() },
    },
  }).eq('id', doc.id);
  assert(Boolean(errSignCol && errSignCol.message.includes('Colunas cadastrais e estruturais não podem ser alteradas')), 7, 'Tentativa de alterar COLUNA DA TABELA durante assinatura do paciente é bloqueada');

  // ---------------------------------------------------------------------------
  // AJUSTE 2: LISTA BRANCA DE COLUNAS EM ATUALIZAÇÕES ADMINISTRATIVAS
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Auditoria do Ajuste 2: Whitelist Estrita de Colunas em Metadados Administrativos ---');

  // Teste 8: Atualização administrativa legítima (Apenas itens.pdfUrl e atualizado_em)
  const { error: errAdminLegit } = await supabase.from('documentos_clinicos').update({
    itens: {
      ...doc.itens,
      pdfUrl: 'https://storage.supabase.co/contratos/rascunho_valido.pdf',
      pdfPath: `contratos/${ctrCode}/rascunho.pdf`,
      pdfGeradoEm: new Date().toISOString(),
      dadosAuditoria: { log: 'geracao_pdf_pendente' },
    },
    atualizado_em: new Date().toISOString(),
  }).eq('id', doc.id);
  assert(!errAdminLegit, 8, 'Atualização administrativa legítima (PDF/Auditoria + atualizado_em) é permitida');

  // Teste 9: Tentativa de atualizar metadados administrativos MAS alterando paciente_nome na tabela
  const { error: errAdminNome } = await supabase.from('documentos_clinicos').update({
    paciente_nome: 'Nome Adulterado Administrativamente',
    itens: {
      ...doc.itens,
      pdfUrl: 'https://storage.supabase.co/contratos/outro.pdf',
    },
  }).eq('id', doc.id);
  console.log('DEBUG errAdminNome:', errAdminNome);
  assert(Boolean(errAdminNome && errAdminNome.message.includes('Violação de integridade')), 9, 'Tentativa de alterar PACIENTE_NOME em update administrativo é bloqueada', errAdminNome?.message);

  // Teste 10: Tentativa de atualizar metadados administrativos MAS alterando valor_total na tabela
  const { error: errAdminValor } = await supabase.from('documentos_clinicos').update({
    valor_total: 5000,
    itens: {
      ...doc.itens,
      pdfUrl: 'https://storage.supabase.co/contratos/outro.pdf',
    },
  }).eq('id', doc.id);
  assert(Boolean(errAdminValor && errAdminValor.message.includes('Modificação não autorizada')), 10, 'Tentativa de alterar VALOR_TOTAL em update administrativo é bloqueada');

  // Teste 11: Tentativa de atualizar metadados administrativos MAS alterando titulo na tabela
  const { error: errAdminTitulo } = await supabase.from('documentos_clinicos').update({
    titulo: 'Titulo Adulterado Administrativamente',
    itens: {
      ...doc.itens,
      pdfUrl: 'https://storage.supabase.co/contratos/outro.pdf',
    },
  }).eq('id', doc.id);
  assert(Boolean(errAdminTitulo && errAdminTitulo.message.includes('Modificação não autorizada')), 11, 'Tentativa de alterar TITULO em update administrativo é bloqueada');

  // ---------------------------------------------------------------------------
  // AJUSTE 3: VALIDAÇÃO DE LINHAS AFETADAS (ROW_COUNT) NA SINCRONIZAÇÃO COM ORÇAMENTO
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Auditoria do Ajuste 3: ROW_COUNT e Aborto Transacional por Inconsistência de Orçamento ---');

  // Teste 12: Tentativa de retificar contrato apontando para orcamentoId INEXISTENTE
  const idOrcamentoFantasma = crypto.randomUUID();
  const snapshotRetifOrcInexistente = {
    ...doc.itens,
    orcamentoId: idOrcamentoFantasma, // Não existe no banco!
    versao: '2.0',
    token: `token_fake_${crypto.randomBytes(16).toString('hex')}`,
    tokensRevogados: [tokenV1],
    financeiro: { total: 6050, subtotal: 8870, desconto: 2820 },
    versoesAnteriores: [
      {
        versao: '1.0',
        token: tokenV1,
        substituidoEm: new Date().toISOString(),
        motivo: 'Teste orcamento fantasma',
      },
    ],
  };

  const { error: errOrcFantasma } = await supabase.from('documentos_clinicos').update({
    conteudo: '<html>Conteudo Retificado com Orcamento Fantasma</html>',
    valor_total: 6050,
    itens: snapshotRetifOrcInexistente,
  }).eq('id', doc.id);

  assert(Boolean(errOrcFantasma && errOrcFantasma.message.includes('Violação de integridade referencial')), 12, 'Retificação com orçamento inexistente é abortada com ROLLBACK total', errOrcFantasma?.message);

  // Teste 13: Comprova que após o aborto, o contrato PERMANECEU intacto na Versão 1.0
  const { data: docAposAborto } = await supabase.from('documentos_clinicos').select('*').eq('id', doc.id).single();
  assert(docAposAborto?.itens?.versao === '1.0', 13, 'Após ROLLBACK, a versão do contrato permaneceu 1.0 (zero corrupção de estado)');
  assert(docAposAborto?.itens?.token === tokenV1, 14, 'Após ROLLBACK, o token permaneceu o original V1');

  // Teste 15: Retificação com orçamento LEGÍTIMO e existente (ROW_COUNT = 1)
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

  const { error: errRetifLegit } = await supabase.from('documentos_clinicos').update({
    conteudo: '<html>Conteudo Versao 2.0 Retificada Total R$ 6.050,00</html>',
    valor_total: 6050,
    itens: snapshotV2Legitimo,
  }).eq('id', doc.id);
  assert(!errRetifLegit, 15, 'Retificação com orçamento legítimo concluída com sucesso (ROW_COUNT = 1)');

  // ---------------------------------------------------------------------------
  // 4. FLUXO NORMAL DE ASSINATURA E GERAÇÃO DE PDF
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Fluxo Normal de Assinatura e Anexação de PDF ---');

  // Teste 16: Assinatura legítima do paciente no contrato retificado (Comparação Integral bem-sucedida)
  const agoraIso = new Date().toISOString();
  const snapshotFormalizado = {
    ...snapshotV2Legitimo,
    status: 'formalizado',
    statusAssinaturaPaciente: 'assinado',
    isFormalizadoTotal: 'true',
    assinaturaPaciente: {
      nome: pac.nome,
      dataHora: agoraIso,
      ip: '177.200.10.5',
      metodo: 'assinatura_eletronica_publica',
    },
    pdfUrl: `https://storage.supabase.co/contratos/${ctrCode}/Contrato_Assinado_${ctrCode}.pdf`,
    pdfPath: `contratos/${ctrCode}/Contrato_Assinado_${ctrCode}.pdf`,
    pdfGeradoEm: agoraIso,
  };

  const { error: errFormalizacao } = await supabase.from('documentos_clinicos').update({
    assinado_em: agoraIso,
    assinatura_data: agoraIso,
    itens: snapshotFormalizado,
  }).eq('id', doc.id);
  assert(!errFormalizacao, 16, 'Assinatura e formalização do paciente com metadados de PDF processadas com sucesso');

  // Teste 17: Download e visualização do PDF preservados (Metadados íntegros)
  const { data: docFinal } = await supabase.from('documentos_clinicos').select('*').eq('id', doc.id).single();
  assert(docFinal?.itens?.pdfUrl?.includes('Contrato_Assinado'), 17, 'Metadados de PDF gravados e acessíveis para visualização');
  assert(docFinal?.itens?.status === 'formalizado', 18, 'Status formalizado ativo no documento final');

  // ---------------------------------------------------------------------------
  // 5. COMPATIBILIDADE COM FORMATOS HISTÓRICOS DE ASSINATURA E JSON NULL
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Compatibilidade com Formatos Históricos e Campos JSON Nulos ---');

  // Teste 19: Formato Histórico 1 — Contrato formalizado com assinado_em NULL mas com assinaturaPaciente válida
  const ctrHist1 = `CTR-HIST1-${sufixo}`;
  const { data: docHist1, error: errH1 } = await supabase.from('documentos_clinicos').insert({
    identificador: ctrHist1,
    paciente_id: pac.id,
    paciente_nome: pac.nome,
    tipo: 'contrato',
    titulo: `Contrato Histórico 1 - ${pac.nome}`,
    conteudo: '<html>Contrato Historico 1</html>',
    valor_total: 4000,
    assinado_em: null, // assinado_em nulo na coluna!
    itens: {
      contratoId: ctrHist1,
      status: 'assinado', // status assinado!
      assinaturaPaciente: { dataHora: '2026-10-15T12:00:00Z', nome: 'Paciente Historico' },
      assinaturaDentista: { dataHora: '2026-10-15T11:00:00Z', nome: 'Dra. Rosangela' },
    },
  }).select().single();
  if (errH1) throw errH1;

  // Tentativa de modificar o contrato histórico 1: DEVE SER BLOQUEADA!
  const { error: errModH1 } = await supabase.from('documentos_clinicos').update({
    conteudo: '<html>Tentativa de Adulterar Historico 1</html>',
  }).eq('id', docHist1.id);
  assert(Boolean(errModH1 && errModH1.message.includes('conteúdo textual de um contrato formalizado é estritamente imutável')), 19, 'Contrato histórico com assinado_em nulo e assinaturaPaciente em objeto é reconhecido e 100% blindado');

  // Teste 20: Formato Histórico 2 — Contrato com assinaturaPaciente: null (literal JSON null)
  // Deve ser reconhecido como PENDENTE de assinatura do paciente (não formalizado)
  const ctrHist2 = `CTR-HIST2-${sufixo}`;
  const { data: docHist2, error: errH2 } = await supabase.from('documentos_clinicos').insert({
    identificador: ctrHist2,
    paciente_id: pac.id,
    paciente_nome: pac.nome,
    tipo: 'contrato',
    titulo: `Contrato Histórico 2 - ${pac.nome}`,
    conteudo: '<html>Contrato Historico 2</html>',
    valor_total: 5000,
    assinado_em: null,
    itens: {
      contratoId: ctrHist2,
      status: 'emitido',
      assinaturaPaciente: null, // Literal JSON null
      assinaturaDentista: { dataHora: '2026-10-20T10:00:00Z', nome: 'Dra. Rosangela' },
    },
  }).select().single();
  if (errH2) throw errH2;

  // Paciente assina pela primeira vez: DEVE SER PERMITIDO!
  const { error: errSignH2 } = await supabase.from('documentos_clinicos').update({
    assinado_em: new Date().toISOString(),
    itens: {
      ...docHist2.itens,
      status: 'formalizado',
      statusAssinaturaPaciente: 'assinado',
      assinaturaPaciente: { dataHora: new Date().toISOString(), nome: 'Paciente Assinando Agora' },
    },
  }).eq('id', docHist2.id);
  assert(!errSignH2, 20, 'Contrato com assinaturaPaciente como JSON null literal é tratado como pendente e permite assinatura legítima');

  // Teste 21: Formato Histórico 3 — Contrato com chave legada assinaturaDra
  const ctrHist3 = `CTR-HIST3-${sufixo}`;
  const { data: docHist3, error: errH3 } = await supabase.from('documentos_clinicos').insert({
    identificador: ctrHist3,
    paciente_id: pac.id,
    paciente_nome: pac.nome,
    tipo: 'contrato',
    titulo: `Contrato Histórico 3 - ${pac.nome}`,
    conteudo: '<html>Contrato Historico 3 Dra Legada</html>',
    valor_total: 3500,
    assinado_em: '2026-09-01T10:00:00Z',
    itens: {
      contratoId: ctrHist3,
      status: 'formalizado',
      assinaturaDra: { dataHora: '2026-09-01T09:00:00Z', nome: 'Dra. Rosangela' },
      assinaturaPaciente: { dataHora: '2026-09-01T10:00:00Z', nome: 'Paciente Legado' },
    },
  }).select().single();
  if (errH3) throw errH3;

  const { error: errModH3 } = await supabase.from('documentos_clinicos').update({
    valor_total: 1000,
  }).eq('id', docHist3.id);
  assert(Boolean(errModH3 && errModH3.message.includes('valor financeiro de um contrato formalizado é estritamente imutável')), 21, 'Contrato histórico com assinaturaDra legada é 100% blindado contra alterações');

  console.log('\n================================================================================');
  console.log(`AUDITORIA DOS TRÊS AJUSTES CONCLUÍDA: ${resultados.length}/${resultados.length} TESTES APROVADOS (100%)!`);
  console.log('================================================================================\n');
}

runAuditoriaTresAjustesFinais().catch((err) => {
  console.error('\n❌ ERRO NA AUDITORIA DOS TRÊS AJUSTES FINAIS:', err);
  process.exit(1);
});
