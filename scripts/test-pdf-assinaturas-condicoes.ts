/**
 * Testes Unitários e de Integração:
 * Validação de Documentos, PDFs, Condições de Pagamento e Assinaturas
 */

import {
  gerarTrioPropostasSugeridas,
  parseCondicoesPagamento,
  serializarCondicoesPagamento,
  calcularDescricaoCondicao,
  obterCondicaoAtiva,
} from '../src/utils/orcamentoCondicoes';

import {
  construirHtmlOrcamento,
} from '../src/utils/orcamentoPdf';

let falhas = 0;
let sucessos = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FALHA: ${msg}`);
    falhas++;
  } else {
    console.log(`✅ SUCESSO: ${msg}`);
    sucessos++;
  }
}

async function runTests() {
  console.log('\n--- 1. TESTE DE CÁLCULO DE VALORES EM NOVOS ORÇAMENTOS (R$ 1.000,00) ---');
  const total = 1000;
  const trio = gerarTrioPropostasSugeridas(total);
  
  assert(trio.length === 3, 'Deve gerar exatamente 3 opções sugeridas');
  
  // Opção 1: À Vista PIX com 10%
  const optPix = trio[0];
  assert(optPix.tipo === 'a_vista', 'Opção 1 deve ser a_vista');
  assert(optPix.descontoPercentual === 10, 'Opção 1 deve ter 10% de desconto');
  assert(optPix.descontoValor === 100, `Opção 1 desconto deve ser R$ 100,00 (obtido: ${optPix.descontoValor})`);
  assert(optPix.valorTotal === 900, `Opção 1 total com desconto deve ser R$ 900,00 (obtido: ${optPix.valorTotal})`);
  assert(!optPix.descricao.includes('R$ 0,00'), 'Opção 1 não deve conter R$ 0,00 na descrição');

  // Opção 2: Entrada 50% + Saldo 30 dias
  const optEntrada = trio[1];
  assert(optEntrada.tipo === 'entrada_saldo', 'Opção 2 deve ser entrada_saldo');
  assert(optEntrada.valorEntrada === 500, `Opção 2 entrada deve ser R$ 500,00 (obtido: ${optEntrada.valorEntrada})`);
  assert(optEntrada.saldoValorParcela === 500, `Opção 2 saldo deve ser R$ 500,00 (obtido: ${optEntrada.saldoValorParcela})`);
  assert(!optEntrada.descricao.includes('R$ 0,00'), 'Opção 2 não deve conter R$ 0,00 na descrição');

  // Opção 3: Parcelado em Cartão (para R$ 1.000 -> 6x)
  const optCartao = trio[2];
  assert(optCartao.tipo === 'cartao', 'Opção 3 deve ser cartao');
  assert(optCartao.parcelas === 6, `Opção 3 deve ter 6 parcelas para R$ 1.000 (obtido: ${optCartao.parcelas})`);
  assert(optCartao.valorParcela === 166.67, `Opção 3 parcela deve ser R$ 166,67 (obtido: ${optCartao.valorParcela})`);
  assert(!optCartao.descricao.includes('R$ 0,00'), 'Opção 3 não deve conter R$ 0,00 na descrição');

  console.log('\n--- 2. TESTE DE SANEAMENTO DE ORÇAMENTOS SALVOS COM TOTAL=0 ---');
  // Simula um JSON salvo anteriormente com total=0 mas aberto com totalBase=1000
  const trioZerado = gerarTrioPropostasSugeridas(0);
  const jsonZerado = serializarCondicoesPagamento(trioZerado);
  const parsedRecuperado = parseCondicoesPagamento(jsonZerado, 1000);

  assert(parsedRecuperado[0].valorTotal === 900, `Recuperado Opção 1 deve ser R$ 900,00 (obtido: ${parsedRecuperado[0].valorTotal})`);
  assert(parsedRecuperado[0].descontoValor === 100, `Recuperado Opção 1 desconto deve ser R$ 100,00 (obtido: ${parsedRecuperado[0].descontoValor})`);
  assert(parsedRecuperado[1].valorEntrada === 500, `Recuperado Opção 2 entrada deve ser R$ 500,00 (obtido: ${parsedRecuperado[1].valorEntrada})`);
  assert(!parsedRecuperado[0].descricao.includes('R$ 0,00'), 'Descrição recuperada não deve ter R$ 0,00');

  console.log('\n--- 3. TESTE DE PRESERVAÇÃO DE VALORES HISTÓRICOS APROVADOS ---');
  // Se a condição histórica foi aprovada com um valor customizado, ela NUNCA deve ser alterada retroativamente
  const condHistorica = [{
    id: 'historico_1',
    titulo: 'Condição Especial Antiga',
    tipo: 'a_vista',
    valorTotal: 850,
    descontoPercentual: 15,
    descontoValor: 150,
    descricao: 'Pagamento à vista acordado em 850',
    selecionada: true,
  }];
  const jsonHistorico = JSON.stringify({ versao: 2, selecionadaId: 'historico_1', condicoes: condHistorica });
  const parsedHistorico = parseCondicoesPagamento(jsonHistorico, 1200);

  assert(parsedHistorico[0].valorTotal === 850, 'Valor de orçamento aprovado histórico deve ser estritamente preservado (R$ 850,00)');
  assert(parsedHistorico[0].descontoValor === 150, 'Desconto histórico deve ser estritamente preservado (R$ 150,00)');
  assert(parsedHistorico[0].selecionada === true, 'Condição histórica deve continuar marcada como selecionada');

  console.log('\n--- 4. TESTE DE HTML/PDF DE ORÇAMENTO NÃO APROVADO (TODAS AS OPÇÕES) ---');
  const htmlPendente = construirHtmlOrcamento({
    titulo: 'Plano de Tratamento Estético',
    pacienteNome: 'Paciente Demonstração',
    pacienteCpf: '111.222.333-44',
    dentistaNome: 'Dra. Rosângela Santos',
    dentistaCro: 'CRO/AL 1234',
    itens: [{ id: '1', dente: '11', regiao: '', descricao: 'Faceta em Resina', valor: 1000 }],
    desconto: 0,
    total: 1000,
    observacoes: '',
    formasPagamento: jsonZerado, // JSON com 3 opções
    status: 'rascunho',
  }, {});

  assert(htmlPendente.includes('Opção 1: À Vista no PIX'), 'Orçamento pendente deve exibir Opção 1');
  assert(htmlPendente.includes('Opção 2: Entrada 50%'), 'Orçamento pendente deve exibir Opção 2');
  assert(htmlPendente.includes('Opção 3: Parcelado'), 'Orçamento pendente deve exibir Opção 3');
  assert(!htmlPendente.includes('Registro Oficial de Aprovação Eletrônica'), 'Orçamento pendente não deve conter quadro de aprovação eletrônica');

  console.log('\n--- 5. TESTE DE HTML/PDF DE ORÇAMENTO APROVADO (EXCLUSIVAMENTE OPÇÃO ESCOLHIDA) ---');
  const condicaoAprovada = trio[0]; // PIX 10%
  const htmlAprovado = construirHtmlOrcamento({
    titulo: 'Plano de Tratamento Estético',
    pacienteNome: 'Paciente Demonstração',
    pacienteCpf: '111.222.333-44',
    dentistaNome: 'Dra. Rosângela Santos',
    dentistaCro: 'CRO/AL 1234',
    itens: [{ id: '1', dente: '11', regiao: '', descricao: 'Faceta em Resina', valor: 1000 }],
    desconto: 0,
    total: 1000,
    observacoes: '',
    formasPagamento: jsonZerado,
    status: 'aprovado',
    condicaoEscolhida: condicaoAprovada,
    aprovadoEm: '2026-11-04T12:00:00.000Z',
    contratoId: 'CTR-2026-11-9999',
    snapshotAprovacao: {
      pacienteNome: 'Paciente Demonstração',
      ip: '201.86.12.34',
      condicaoEscolhida: condicaoAprovada,
    },
  }, {});

  assert(htmlAprovado.includes('ORÇAMENTO APROVADO'), 'Orçamento aprovado deve exibir selo de aprovação');
  assert(htmlAprovado.includes('Opção Escolhida pelo Paciente'), 'Deve exibir selo de Opção Escolhida pelo Paciente');
  assert(htmlAprovado.includes('Opção 1: À Vista no PIX'), 'Deve exibir a Opção 1 aprovada');
  assert(!htmlAprovado.includes('Opção 2: Entrada 50%'), 'NÃO deve exibir a Opção 2 rejeitada');
  assert(!htmlAprovado.includes('Opção 3: Parcelado'), 'NÃO deve exibir a Opção 3 rejeitada');
  assert(htmlAprovado.includes('Registro Oficial de Aprovação Eletrônica'), 'Deve conter o quadro de Registro Oficial de Aprovação Eletrônica');
  assert(htmlAprovado.includes('#CTR-2026-11-9999'), 'Deve conter o vínculo do contrato #CTR-2026-11-9999');
  assert(htmlAprovado.includes('201.86.12.34'), 'Deve exibir o IP real auditado');
  assert(!htmlAprovado.includes('Assinatura do Paciente (sem linhas vazias)'), 'Não deve exibir campos em branco desnecessários');

  console.log('\n--- 6. TESTE DE ORDENAÇÃO DE VERSÕES DE CONTRATO (V2 > V1 / FORMALIZADO FIRST) ---');
  const contratos = [
    { id: 'ctr-v1-rascunho', titulo: 'Contrato v1', status: 'rascunho', itens: { versao: 1 }, criadoEm: '2026-11-01' },
    { id: 'ctr-v2-formalizado', titulo: 'Contrato v2', status: 'formalizado', assinadoEm: '2026-11-03', itens: { versao: 2, status: 'formalizado' }, criadoEm: '2026-11-02' },
    { id: 'ctr-v1-formalizado', titulo: 'Contrato v1 formalizado', status: 'formalizado', assinadoEm: '2026-11-02', itens: { versao: 1, status: 'formalizado' }, criadoEm: '2026-11-01' },
  ];

  contratos.sort((a, b) => {
    const aSnap = (a.itens || {}) as any;
    const bSnap = (b.itens || {}) as any;
    const aFormalizado = Boolean(a.assinadoEm || aSnap.status === 'formalizado' || a.status === 'formalizado');
    const bFormalizado = Boolean(b.assinadoEm || bSnap.status === 'formalizado' || b.status === 'formalizado');
    if (aFormalizado !== bFormalizado) return aFormalizado ? -1 : 1;

    const aVersao = Number(aSnap.versao || 1);
    const bVersao = Number(bSnap.versao || 1);
    if (aVersao !== bVersao) return bVersao - aVersao;

    const aTime = new Date(a.assinadoEm || a.criadoEm || 0).getTime();
    const bTime = new Date(b.assinadoEm || b.criadoEm || 0).getTime();
    return bTime - aTime;
  });

  assert(contratos[0].id === 'ctr-v2-formalizado', `O contrato prioritário vigente deve ser o V2 formalizado (obtido: ${contratos[0].id})`);

  console.log('\n=======================================');
  console.log(`RESULTADO FINAL: ${sucessos} SUCESSOS, ${falhas} FALHAS`);
  console.log('=======================================\n');

  if (falhas > 0) process.exit(1);
}

runTests();
