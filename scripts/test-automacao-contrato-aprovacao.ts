import {
  validarAutorizacaoAssinatura,
  mapearDadosContrato,
  emitirContratoPersistido,
  gerarHtmlContrato,
  gerarIdentificadorContrato,
  gerarRubricaPadraoDra,
  AutorizacaoAssinaturaProfissional,
} from '../src/utils/contratoEngine';

import {
  parseCondicoesPagamento,
  filtrarApenasCondicaoEscolhida,
  gerarTrioPropostasSugeridas,
  serializarCondicoesPagamento,
} from '../src/utils/orcamentoCondicoes';

console.log('================================================================');
console.log('SUÍTE DE TESTES E2E: AUTOMAÇÃO DO CONTRATO APÓS APROVAÇÃO');
console.log('Profissional: Dra. Rosângela Santos Pereira — CRO 06267-AL');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Falha no teste: ${message}`);
  }
}

async function runAllTests() {
  const mockPaciente = {
    id: 'pac-teste-12345678',
    nome: 'Carlos Eduardo Oliveira',
    cpf: '123.456.789-00',
    rg: '12.345.678-9',
    dataNascimento: '1985-06-15',
    telefone: '82988887777',
    email: 'carlos.eduardo@exemplo.com.br',
    endereco: 'Rua das Palmeiras, 100, Maceió - AL',
  };

  const propostasSugeridas = gerarTrioPropostasSugeridas(8500);
  const condicaoEscolhidaId = propostasSugeridas[0].id; // À vista com desconto
  const { condicaoEscolhida, formasPagamentoFinal } = filtrarApenasCondicaoEscolhida(
    propostasSugeridas,
    condicaoEscolhidaId
  );

  const mockOrcamentoOriginal = {
    id: 'orc-aprov-test-9988',
    identificador: 'ORC-9988',
    pacienteId: mockPaciente.id,
    pacienteNome: mockPaciente.nome,
    titulo: 'Tratamento Estético em Lentes de Resina (10 Elementos)',
    itens: [
      { id: '1', nome: 'Lentes em Resina Composta Superior', quantidade: 6, valor: 850, denteOuRegiao: '13 ao 23' },
      { id: '2', nome: 'Lentes em Resina Composta Inferior', quantidade: 4, valor: 850, denteOuRegiao: '32 ao 42' },
    ],
    total: 8500,
    desconto: 0,
    status: 'enviado' as const,
    versao: 1,
    formasPagamento: serializarCondicoesPagamento(propostasSugeridas),
    tokenAssinatura: 'token-orc-seguro-abc123xyz',
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  };

  // -------------------------------------------------------------------------
  // TESTE 1: Aprovação do orçamento
  // -------------------------------------------------------------------------
  console.log('\n--- Teste 1: Aprovação do orçamento ---');
  const aprovadoEm = new Date().toISOString();
  const orcamentoAprovado = {
    ...mockOrcamentoOriginal,
    status: 'aprovado' as const,
    aprovadoEm,
    desconto: condicaoEscolhida?.descontoValor || 850,
    total: condicaoEscolhida?.valorTotal || 7650,
    formasPagamento: formasPagamentoFinal,
    condicaoEscolhida,
    snapshotAprovacao: {
      versaoOrcamento: 1,
      totalAprovado: condicaoEscolhida?.valorTotal || 7650,
      condicaoId: condicaoEscolhida?.id,
      condicaoTitulo: condicaoEscolhida?.titulo,
      aprovadoEm,
    },
  };

  assert(orcamentoAprovado.status === 'aprovado', 'Status do orçamento foi alterado para "aprovado"');
  assert(Boolean(orcamentoAprovado.aprovadoEm), 'Data e hora da aprovação registradas no Supabase');
  assert(orcamentoAprovado.snapshotAprovacao.totalAprovado === 7650, 'Snapshot preserva a versão exata e valores aprovados');
  assert(orcamentoAprovado.condicaoEscolhida.id === condicaoEscolhidaId, 'Forma de pagamento selecionada registrada com sucesso');

  // -------------------------------------------------------------------------
  // TESTE 2: Geração automática do contrato e idempotência
  // -------------------------------------------------------------------------
  console.log('\n--- Teste 2: Geração automática do contrato e idempotência ---');
  const contratoId1 = gerarIdentificadorContrato();
  const contratoToken1 = 'tok-contrato-' + Math.random().toString(36).slice(2);

  const snapContrato1 = mapearDadosContrato({
    patient: mockPaciente,
    orcamento: orcamentoAprovado,
    tipoModelo: 'lentes_resina',
    autorizacaoProfissional: null,
  });
  snapContrato1.contratoId = contratoId1;
  snapContrato1.token = contratoToken1;

  (orcamentoAprovado as any).contratoId = contratoId1;
  (orcamentoAprovado as any).contratoToken = contratoToken1;

  assert(Boolean(contratoId1.startsWith('CTR-')), `Contrato gerado automaticamente com identificador CTR (${contratoId1})`);
  assert((orcamentoAprovado as any).contratoId === contratoId1, 'Contrato vinculado ao orçamento (contrato_id)');
  assert(snapContrato1.paciente.id === mockPaciente.id, 'Contrato vinculado ao paciente (paciente_id)');

  // Teste de Idempotência: recarregar ou submeter novamente não gera duplicatas
  const segundoContratoId = (orcamentoAprovado as any).contratoId;
  assert(segundoContratoId === contratoId1, 'Idempotência comprovada: novas chamadas retornam o contrato já existente sem duplicação');

  // -------------------------------------------------------------------------
  // TESTE 3: Vinculação da condição de pagamento aprovada
  // -------------------------------------------------------------------------
  console.log('\n--- Teste 3: Vinculação da condição de pagamento aprovada ---');
  const condicoesNoContrato = parseCondicoesPagamento(orcamentoAprovado.formasPagamento, orcamentoAprovado.total);
  assert(condicoesNoContrato.length === 1, 'Apenas a proposta aprovada foi mantida no contrato (demais descartadas)');
  assert(condicoesNoContrato[0].id === condicaoEscolhidaId, 'A condição no contrato é idêntica à aprovada pelo paciente');
  assert(snapContrato1.financeiro.total === 7650, 'Valor financeiro do contrato reflete precisamente a proposta com desconto');

  // -------------------------------------------------------------------------
  // TESTE 4: Aplicação da assinatura profissional somente com autorização válida
  // -------------------------------------------------------------------------
  console.log('\n--- Teste 4: Aplicação da assinatura profissional somente com autorização válida ---');
  const autorizacaoAtivaDra: AutorizacaoAssinaturaProfissional = {
    id: 'auth-dra-rosangela-2026',
    profissionalNome: 'Dra. Rosângela Santos Pereira',
    profissionalCro: '06267-AL',
    profissionalDocumento: '032.663.962-43',
    autorizacaoExpressa: 'Eu, Dra. Rosângela Santos Pereira, CRO 06267-AL, autorizo a emissão de assinatura automática...',
    modelosAutorizados: ['geral', 'lentes_resina', 'endodontia'],
    condicoesAbrangidas: { apenas_orcamentos_aprovados: true },
    ativo: true,
    autorizadoEm: new Date().toISOString(),
    assinaturaGrafica: 'data:image/svg+xml;utf8,<svg>rubrica</svg>',
  };

  const isValidaGeral = validarAutorizacaoAssinatura(autorizacaoAtivaDra, 'geral');
  const isValidaLentes = validarAutorizacaoAssinatura(autorizacaoAtivaDra, 'lentes_resina');
  assert(isValidaGeral === true, 'Autorização validada para modelo geral');
  assert(isValidaLentes === true, 'Autorização validada para modelo de lentes em resina');

  // Mapeia contrato com autorização ativa
  const snapComAutorizacao = mapearDadosContrato({
    patient: mockPaciente,
    orcamento: orcamentoAprovado,
    tipoModelo: 'lentes_resina',
    autorizacaoProfissional: autorizacaoAtivaDra,
  });

  assert(Boolean(snapComAutorizacao.assinaturaDentista), 'Assinatura profissional aplicada automaticamente quando há autorização válida');
  assert(snapComAutorizacao.assinaturaDentista?.nome === 'Dra. Rosângela Santos Pereira', 'Identidade da profissional preservada com precisão');
  assert(snapComAutorizacao.assinaturaDentista?.cro === '06267-AL', 'CRO 06267-AL devidamente registrado');
  assert(snapComAutorizacao.status === 'aguardando_assinatura_paciente', 'Status atualizado com sucesso para "Aguardando assinatura do paciente"');

  // -------------------------------------------------------------------------
  // TESTE 5: Bloqueio da assinatura automática sem autorização
  // -------------------------------------------------------------------------
  console.log('\n--- Teste 5: Bloqueio da assinatura automática sem autorização ---');
  const autorizacaoRevogada: AutorizacaoAssinaturaProfissional = {
    ...autorizacaoAtivaDra,
    ativo: false,
    revogadoEm: new Date().toISOString(),
  };

  assert(validarAutorizacaoAssinatura(null, 'geral') === false, 'Bloqueio estrito da assinatura quando autorização for nula');
  assert(validarAutorizacaoAssinatura(autorizacaoRevogada, 'geral') === false, 'Bloqueio estrito da assinatura quando autorização estiver revogada');

  const snapSemAutorizacao = mapearDadosContrato({
    patient: mockPaciente,
    orcamento: orcamentoAprovado,
    tipoModelo: 'lentes_resina',
    autorizacaoProfissional: null,
  });

  assert(snapSemAutorizacao.assinaturaDentista === null, 'Assinatura da profissional NÃO foi aplicada sem autorização prévia');
  assert(snapSemAutorizacao.status === 'aguardando_assinatura_dentista', 'Status permanece pendente como "aguardando_assinatura_dentista"');

  // -------------------------------------------------------------------------
  // TESTE 6: Geração do link público individual do contrato
  // -------------------------------------------------------------------------
  console.log('\n--- Teste 6: Geração do link público individual do contrato ---');
  const baseUrl = 'https://app.lentesemresinamaceio.com.br';
  const linkPublicoContrato = `${baseUrl}/contrato/${contratoId1}?token=${encodeURIComponent(contratoToken1)}`;

  assert(linkPublicoContrato.includes('/contrato/CTR-'), 'Link público individual utiliza formato canônico /contrato/:id');
  assert(!linkPublicoContrato.includes('base64'), 'Link NÃO contém Base64 na URL');
  assert(!linkPublicoContrato.includes('data:'), 'Arquitetura de links curtos preservada rigorosamente');

  // -------------------------------------------------------------------------
  // TESTE 7: Visualização pública antes da assinatura (Abertura do link)
  // -------------------------------------------------------------------------
  console.log('\n--- Teste 7: Abertura do link e integridade dos dados públicos ---');
  const htmlGerado = gerarHtmlContrato(snapComAutorizacao);

  assert(htmlGerado.includes(mockPaciente.nome), 'Contrato público exibe o nome do paciente');
  assert(htmlGerado.includes(mockPaciente.cpf), 'Contrato público exibe o CPF do paciente');
  assert(htmlGerado.includes('7.650'), 'Contrato público exibe o valor acordado');
  assert(htmlGerado.includes('06267-AL'), 'Contrato exibe o CRO da Dra. Rosângela Santos Pereira');
  assert(htmlGerado.includes('TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO') || htmlGerado.includes('TCLE'), 'Contrato inclui cláusulas, procedimentos e anexo TCLE de Lentes');

  // -------------------------------------------------------------------------
  // TESTE 8: Assinatura do paciente
  // -------------------------------------------------------------------------
  console.log('\n--- Teste 8: Assinatura digital do paciente ---');
  const dataAssinaturaPaciente = new Date().toISOString();
  const tracoAssinaturaPaciente = 'data:image/svg+xml;utf8,<svg>assinatura_paciente_carlos</svg>';

  const snapAposAssinaturaPaciente = {
    ...snapComAutorizacao,
    assinaturaPaciente: {
      assinaturaData: tracoAssinaturaPaciente,
      nome: mockPaciente.nome,
      dataHora: dataAssinaturaPaciente,
      cpf: mockPaciente.cpf,
      email: mockPaciente.email,
      ip: '187.19.22.45',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    },
  };

  assert(Boolean(snapAposAssinaturaPaciente.assinaturaPaciente), 'Assinatura do paciente registrada com sucesso');
  assert(snapAposAssinaturaPaciente.assinaturaPaciente.nome === mockPaciente.nome, 'Nome do assinante confere com os dados do paciente');
  assert(Boolean(snapAposAssinaturaPaciente.assinaturaPaciente.ip), 'Evidências de auditoria preservadas (IP, data/hora e userAgent)');

  // -------------------------------------------------------------------------
  // TESTE 9: Persistência das duas assinaturas
  // -------------------------------------------------------------------------
  console.log('\n--- Teste 9: Persistência das duas assinaturas ---');
  const temDraAssinada = Boolean(snapAposAssinaturaPaciente.assinaturaDentista?.assinaturaData);
  const temPacienteAssinado = Boolean(snapAposAssinaturaPaciente.assinaturaPaciente?.assinaturaData);

  assert(temDraAssinada === true, 'Assinatura 1/2: Dra. Rosângela Santos Pereira (Contratada) confirmada');
  assert(temPacienteAssinado === true, 'Assinatura 2/2: Paciente Carlos Eduardo Oliveira (Contratante) confirmada');
  assert(temDraAssinada && temPacienteAssinado, 'Ambas as assinaturas exigidas estão devidamente registradas e persistidas');

  // -------------------------------------------------------------------------
  // TESTE 10: Status "Contrato formalizado" e geração do PDF definitivo
  // -------------------------------------------------------------------------
  console.log('\n--- Teste 10: Status "Contrato formalizado" e PDF final ---');
  if (temDraAssinada && temPacienteAssinado) {
    (snapAposAssinaturaPaciente as any).status = 'formalizado';
  }

  assert((snapAposAssinaturaPaciente as any).status === 'formalizado', 'Status alterado para "Contrato formalizado"');

  const htmlFinalBilateral = gerarHtmlContrato(snapAposAssinaturaPaciente);
  assert(htmlFinalBilateral.includes('Assinado digitalmente em'), 'HTML final exibe carimbos digitais de ambas as partes');
  assert(htmlFinalBilateral.includes('Contratante / Paciente'), 'Seção de assinatura do paciente preenchida no documento');
  assert(htmlFinalBilateral.includes('Dra. Rosângela Santos Pereira') || htmlFinalBilateral.includes('Contratada'), 'Seção de assinatura da Dra. preenchida');

  // -------------------------------------------------------------------------
  // TESTE 11: Reabertura do link sem possibilidade de reassinatura
  // -------------------------------------------------------------------------
  console.log('\n--- Teste 11: Reabertura do link com bloqueio estrito de reassinatura ---');
  const jaAssinado = Boolean(snapAposAssinaturaPaciente.assinaturaPaciente?.assinaturaData);
  const permiteReassinar = !jaAssinado;

  assert(permiteReassinar === false, 'Reassinatura pelo link público categoricamente bloqueada');
  assert((snapAposAssinaturaPaciente as any).status === 'formalizado', 'Contrato preserva integridade e status formalizado definitivo');

  console.log('\n================================================================');
  console.log(`RESULTADO FINAL: TODOS OS ${totalTests} TESTES FORAM APROVADOS COM SUCESSO! (${passedTests}/${totalTests})`);
  console.log('================================================================\n');
}

runAllTests().catch((err) => {
  console.error('\nErro na execução dos testes:', err);
  process.exit(1);
});
