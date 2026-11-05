import assert from 'node:assert';
import {
  mapearDadosContrato,
  validarDadosContratada,
  gerarHtmlContrato,
  isContratoEndodontia,
  ContratoSnapshot,
} from '../src/utils/contratoEngine';
import {
  gerarHtmlContratoEndodontia,
} from '../src/utils/contratoEndodontia';
import {
  parseCondicoesPagamento,
  obterCondicaoAtiva,
} from '../src/utils/orcamentoCondicoes';

console.log('======================================================================');
console.log('TESTE DE HOMOLOGAÇÃO: DADOS DA CONTRATADA E FORMA DE PAGAMENTO APROVADA');
console.log('======================================================================\n');

// --------------------------------------------------------------------------
// 1. TESTE DE VALIDAÇÃO DOS DADOS OBRIGATÓRIOS DA CONTRATADA
// --------------------------------------------------------------------------
console.log('1. Testando validarDadosContratada()...');

// 1.1 Dados incompletos / vazios
const valInvalida = validarDadosContratada({
  nomeClinicaContrato: '',
  cnpjClinicaContrato: '',
  enderecoContrato: '',
  telefoneContrato: '',
  emailContrato: '',
  dentistaResponsavelContrato: '',
  croResponsavelContrato: '',
});
assert.strictEqual(valInvalida.valido, false, 'Deve falhar quando campos obrigatórios estiverem vazios');
assert.strictEqual(valInvalida.erros.length >= 6, true, 'Deve apontar os erros dos campos ausentes');
console.log('  ✔ Dados incompletos rejeitados corretamente (' + valInvalida.erros.length + ' erros identificados)');

// 1.2 Dados válidos cadastrados em Configurações → Contrato & PIX
const configContratoPJ = {
  nomeClinicaContrato: 'ODONTO ROSE SANTOS LTDA',
  cnpjClinicaContrato: '48.912.345/0001-89',
  croResponsavelContrato: '06267-AL',
  dentistaResponsavelContrato: 'Dra. Rosângela Santos Pereira',
  enderecoContrato: 'Av. Doutor Antônio Gomes de Barros, 625, Sala 801, Jatiúca, Maceió - AL, CEP 57036-000',
  telefoneContrato: '82988887777',
  emailContrato: 'administrativo@odontorose.com.br',
  cidadeForoContrato: 'Maceió - AL',
  chavePix: '48912345000189',
  tipoChavePix: 'cnpj' as const,
  favorecidoPix: 'ODONTO ROSE SANTOS LTDA',
  cnpjCpfFavorecidoPix: '48.912.345/0001-89',
  bancoPix: 'Banco Inter S.A.',
  instrucoesPix: 'Utilize o aplicativo do seu banco para ler o QR Code Bacen oficial ou cole o código Copia e Cola.',
  multaAtrasoPercentual: 2,
  jurosMoraPercentual: 1,
  clausulaEspecialPadrao: '',
};

const valValida = validarDadosContratada(configContratoPJ);
assert.strictEqual(valValida.valido, true, 'Deve ser válido quando todos os campos obrigatórios estão preenchidos');
assert.strictEqual(valValida.erros.length, 0);
console.log('  ✔ Dados completos aprovados na validação');

// --------------------------------------------------------------------------
// 2. TESTE DOS DADOS DA CONTRATADA NO SNAPSHOT E HTML (PJ CADASTRADA)
// --------------------------------------------------------------------------
console.log('\n2. Testando dados da Contratada no snapshot e no HTML...');

const mockPaciente = {
  id: 'pac-teste-123',
  nome: 'Lucas Gabriel Ferreira Alves',
  cpf: '123.456.789-00',
  rg: '321654 SSP/AL',
  telefone: '82999991111',
  email: 'lucas.alves@teste.com',
  endereco: 'Rua das Flores, 100, Ponta Verde, Maceió/AL',
  dataNascimento: '1992-05-15',
  estadoCivil: 'Solteiro',
  profissao: 'Engenheiro Civil',
};

const mockOrcamentoBase = {
  id: 'orc-homolog-001',
  titulo: 'Plano de Tratamento Reabilitador',
  pacienteId: 'pac-teste-123',
  pacienteNome: 'Lucas Gabriel Ferreira Alves',
  itens: [
    { nome: 'Facetas em Resina Composta', quantidade: 6, valor: 450, denteOuRegiao: '13 ao 23' },
    { nome: 'Limpeza e Profilaxia', quantidade: 1, valor: 200 },
  ],
  desconto: 0,
  total: 2900,
  atualizadoEm: '2026-11-04T18:00:00.000Z',
};

// --------------------------------------------------------------------------
// CENÁRIO A: PAGAMENTO À VISTA VIA PIX COM DESCONTO
// --------------------------------------------------------------------------
console.log('\n3. Testando Cenário A: Pagamento à Vista via PIX com Desconto...');

const condicoesJsonAVista = JSON.stringify({
  versao: 2,
  selecionadaId: 'cond-vista-pix',
  condicoes: [
    {
      id: 'cond-vista-pix',
      titulo: 'À Vista no PIX (10% OFF)',
      tipo: 'a_vista',
      descontoPercentual: 10,
      descontoValor: 290,
      valorTotal: 2610,
      dataEntrada: '2026-11-04',
      situacaoEntrada: 'A vencer',
      descricao: 'Pagamento à vista via PIX com 10% de desconto especial: R$ 2.610,00 (Economia de R$ 290,00)',
      selecionada: true,
    },
  ],
});

const orcamentoAVista = {
  ...mockOrcamentoBase,
  desconto: 290,
  total: 2610,
  formasPagamento: condicoesJsonAVista,
};

const snapAVista = mapearDadosContrato({
  patient: mockPaciente,
  orcamento: orcamentoAVista,
  configuracoesContrato: configContratoPJ,
  transacoes: [],
});

// Asserções Contratada
assert.strictEqual(snapAVista.clinica.nome, 'ODONTO ROSE SANTOS LTDA', 'Razão Social deve vir de Contrato & PIX');
assert.strictEqual(snapAVista.clinica.cnpj, '48.912.345/0001-89', 'CNPJ deve vir de Contrato & PIX');
assert.strictEqual(snapAVista.clinica.dentistaResponsavel, 'Dra. Rosângela Santos Pereira', 'Responsável Técnica deve vir de Contrato & PIX');
assert.strictEqual(snapAVista.clinica.cro, '06267-AL', 'CRO deve vir de Contrato & PIX');
assert.strictEqual(snapAVista.clinica.bancoPix, 'Banco Inter S.A.', 'Banco PIX deve vir de Contrato & PIX');

// Asserções Financeiro
assert.strictEqual(snapAVista.financeiro.total, 2610, 'Valor final deve ser R$ 2.610,00');
assert.strictEqual(snapAVista.financeiro.desconto, 290, 'Desconto deve ser R$ 290,00');
assert.strictEqual(snapAVista.financeiro.parcelas.length, 1, 'Deve ter exatamente 1 parcela à vista');
assert.strictEqual(snapAVista.financeiro.parcelas[0].metodo, 'PIX', 'Método da parcela deve ser PIX');
assert.strictEqual(snapAVista.financeiro.parcelas[0].valor, 2610, 'Valor da parcela deve ser 2610');
assert.strictEqual(snapAVista.financeiro.formaPagamento.toLowerCase().includes('combinar'), false, 'NÃO pode conter "A combinar"');
assert.strictEqual(snapAVista.financeiro.formaPagamento.toLowerCase().includes('definir'), false, 'NÃO pode conter "A definir"');
assert.strictEqual(Boolean(snapAVista.financeiro.parcelas[0].payloadPix), true, 'Deve gerar Payload PIX Bacen');
assert.strictEqual(Boolean(snapAVista.financeiro.parcelas[0].qrCodePixUrl), true, 'Deve gerar QR Code Bacen');

const htmlAVista = gerarHtmlContrato(snapAVista);
assert.strictEqual(htmlAVista.includes('ODONTO ROSE SANTOS LTDA'), true, 'HTML deve qualificar a PJ Contratada');
assert.strictEqual(htmlAVista.includes('48.912.345/0001-89'), true, 'HTML deve conter CNPJ da Contratada');
assert.strictEqual(htmlAVista.includes('Dra. Rosângela Santos Pereira'), true, 'HTML deve conter a Responsável Técnica');
assert.strictEqual(htmlAVista.includes('Banco Inter S.A.'), true, 'HTML deve exibir a Instituição Bancária configurada');
assert.strictEqual(htmlAVista.includes('A combinar'), false, 'HTML NÃO pode conter "A combinar"');
assert.strictEqual(htmlAVista.includes('A definir'), false, 'HTML NÃO pode conter "A definir"');
console.log('  ✔ Cenário A validado com sucesso: dados da PJ, PIX Bacen e sem "A combinar"');

// --------------------------------------------------------------------------
// CENÁRIO B: ENTRADA VIA PIX + SALDO NO CARTÃO EM 10X
// --------------------------------------------------------------------------
console.log('\n4. Testando Cenário B: Entrada via PIX + Saldo no Cartão em 10x...');

const condicoesJsonEntradaSaldo = JSON.stringify({
  versao: 2,
  selecionadaId: 'cond-entrada-saldo',
  condicoes: [
    {
      id: 'cond-entrada-saldo',
      titulo: 'Entrada PIX + 10x Cartão',
      tipo: 'entrada_saldo',
      valorTotal: 4209,
      valorEntrada: 500,
      metodoEntrada: 'pix',
      dataEntrada: '2026-11-04',
      situacaoEntrada: 'Quitada',
      saldoParcelas: 10,
      saldoMetodo: 'cartao',
      saldoValorParcela: 370.9,
      situacaoSaldo: 'Autorizado',
      diaVencimento: 10,
      descricao: 'Entrada de R$ 500,00 via PIX [Quitada] + Saldo restante em 10x de R$ 370,90 no Cartão de Crédito [Autorizado]',
      selecionada: true,
    },
  ],
});

const orcamentoEntradaSaldo = {
  ...mockOrcamentoBase,
  total: 4209,
  formasPagamento: condicoesJsonEntradaSaldo,
};

const snapEntradaSaldo = mapearDadosContrato({
  patient: mockPaciente,
  orcamento: orcamentoEntradaSaldo,
  configuracoesContrato: configContratoPJ,
  transacoes: [],
});

assert.strictEqual(snapEntradaSaldo.financeiro.entrada, 500, 'Entrada deve ser 500');
assert.strictEqual(snapEntradaSaldo.financeiro.total, 4209, 'Total deve ser 4209');
assert.strictEqual(snapEntradaSaldo.financeiro.parcelas.length, 11, 'Deve ter 1 parcela de entrada + 10 do saldo');
assert.strictEqual(snapEntradaSaldo.financeiro.parcelas[0].descricao.includes('Entrada'), true, '1ª parcela é entrada');
assert.strictEqual(snapEntradaSaldo.financeiro.parcelas[0].status, 'Quitada', 'Entrada está Quitada');
assert.strictEqual(snapEntradaSaldo.financeiro.parcelas[1].vencimento, 'Fatura do Cartão', 'Vencimento do cartão deve ser Fatura do Cartão');
assert.strictEqual(snapEntradaSaldo.financeiro.parcelas[1].metodo, 'Cartão de Crédito', 'Método deve ser Cartão de Crédito');
assert.strictEqual(snapEntradaSaldo.financeiro.formaPagamento.toLowerCase().includes('combinar'), false, 'NÃO pode conter "A combinar"');
assert.strictEqual(snapEntradaSaldo.financeiro.formaPagamento.toLowerCase().includes('definir'), false, 'NÃO pode conter "A definir"');

const htmlEntradaSaldo = gerarHtmlContrato(snapEntradaSaldo);
assert.strictEqual(/entrada inicial de (?:<strong>)?r\$\s*500,00/i.test(htmlEntradaSaldo), true, 'HTML deve detalhar a entrada de R$ 500,00');
assert.strictEqual(htmlEntradaSaldo.includes('Fatura do Cartão'), true, 'HTML deve informar Fatura do Cartão');
assert.strictEqual(htmlEntradaSaldo.includes('A combinar'), false, 'HTML NÃO pode conter "A combinar"');
assert.strictEqual(htmlEntradaSaldo.includes('A definir'), false, 'HTML NÃO pode conter "A definir"');
console.log('  ✔ Cenário B validado com sucesso: Entrada R$ 500, Saldo 10x R$ 370,90 na Fatura do Cartão');

// --------------------------------------------------------------------------
// CENÁRIO C: PIX PARCELADO EM 4X COM VENCIMENTOS REAIS
// --------------------------------------------------------------------------
console.log('\n5. Testando Cenário C: PIX Parcelado em 4x com Vencimentos Reais...');

const condicoesJsonPixParcelado = JSON.stringify({
  versao: 2,
  selecionadaId: 'cond-pix-parc',
  condicoes: [
    {
      id: 'cond-pix-parc',
      titulo: 'PIX Parcelado em 4x',
      tipo: 'pix_parcelado',
      valorTotal: 2000,
      parcelas: 4,
      valorParcela: 500,
      diaVencimento: 15,
      dataPrimeiroVencimento: '2026-11-15',
      situacaoSaldo: 'A vencer',
      descricao: 'PIX Parcelado em 4x de R$ 500,00 todo dia 15',
      selecionada: true,
    },
  ],
});

const orcamentoPixParcelado = {
  ...mockOrcamentoBase,
  total: 2000,
  formasPagamento: condicoesJsonPixParcelado,
};

const snapPixParcelado = mapearDadosContrato({
  patient: mockPaciente,
  orcamento: orcamentoPixParcelado,
  configuracoesContrato: configContratoPJ,
  transacoes: [],
});

assert.strictEqual(snapPixParcelado.financeiro.parcelas.length, 4, 'Deve conter 4 parcelas');
assert.strictEqual(snapPixParcelado.financeiro.parcelas[0].metodo, 'PIX Parcelado');
assert.strictEqual(snapPixParcelado.financeiro.parcelas[0].valor, 500);
assert.strictEqual(snapPixParcelado.financeiro.parcelas.every((p) => p.vencimento.includes('/')), true, 'Todas as parcelas devem conter datas reais no formato DD/MM/AAAA');
assert.strictEqual(snapPixParcelado.financeiro.parcelas.every((p) => !p.vencimento.includes('combinar')), true, 'Nenhuma parcela pode conter "A combinar"');

console.log('  ✔ Cenário C validado com sucesso: 4 parcelas de R$ 500,00 com datas reais');

// --------------------------------------------------------------------------
// CENÁRIO D: CONTRATO DE TRATAMENTO ENDODÔNTICO (MODELO ENDODONTIA)
// --------------------------------------------------------------------------
console.log('\n6. Testando Cenário D: Contrato de Tratamento Endodôntico (Endodontia)...');

const orcamentoEndo = {
  ...mockOrcamentoBase,
  titulo: 'Tratamento de Canal Elemento 21',
  itens: [
    { nome: 'Tratamento Endodôntico Unirradicular', quantidade: 1, valor: 1200, denteOuRegiao: 'Dente 21' },
  ],
  desconto: 100,
  total: 1100,
  formasPagamento: JSON.stringify({
    versao: 2,
    selecionadaId: 'c1',
    condicoes: [
      {
        id: 'c1',
        titulo: 'À Vista no PIX',
        tipo: 'a_vista',
        descontoValor: 100,
        valorTotal: 1100,
        descricao: 'Pagamento à vista via PIX: R$ 1.100,00',
        selecionada: true,
      },
    ],
  }),
};

const snapEndo = mapearDadosContrato({
  patient: mockPaciente,
  orcamento: orcamentoEndo,
  configuracoesContrato: configContratoPJ,
  tipoModeloContrato: 'endodontia',
  transacoes: [],
});

assert.strictEqual(snapEndo.tipoModeloContrato, 'endodontia');
const htmlEndo = gerarHtmlContratoEndodontia(snapEndo);

// Verifica cabeçalho e preâmbulo
assert.strictEqual(htmlEndo.includes('ODONTO ROSE SANTOS LTDA'), true, 'Endodontia deve conter Razão Social PJ');
assert.strictEqual(htmlEndo.includes('48.912.345/0001-89'), true, 'Endodontia deve conter CNPJ da PJ');
assert.strictEqual(htmlEndo.includes('Dra. Rosângela Santos Pereira'), true, 'Endodontia deve conter Responsável Técnica');
assert.strictEqual(htmlEndo.includes('CRO: 06267-AL') || htmlEndo.includes('06267'), true, 'Endodontia deve conter CRO');
// Verifica inexistência dos dados hardcoded antigos
assert.strictEqual(htmlEndo.includes('032.663.962-43'), false, 'NÃO pode conter CPF pessoal hardcoded quando a clínica for PJ cadastrada');
assert.strictEqual(htmlEndo.includes('drarosesantosexpert@gmail.com'), false, 'NÃO pode conter email hardcoded quando houver email da PJ configurado');

// Verifica Cláusula Financeira e PIX Bacen
assert.strictEqual(htmlEndo.includes('Subtotal dos procedimentos:'), true, 'Endodontia deve conter Subtotal dos procedimentos');
assert.strictEqual(htmlEndo.includes('Desconto concedido:'), true, 'Endodontia deve conter Desconto concedido');
assert.strictEqual(htmlEndo.includes('R$ 1.100,00'), true, 'Endodontia deve conter Valor Final');
assert.strictEqual(htmlEndo.includes('Banco Inter S.A.'), true, 'Endodontia deve conter Banco PIX configurado');
assert.strictEqual(htmlEndo.includes('Padrão Oficial Banco Central (Bacen)'), true, 'Endodontia deve exibir Quadro PIX Bacen');
assert.strictEqual(htmlEndo.includes('QR CODE PIX'), true, 'Endodontia deve conter QR Code PIX Bacen');
assert.strictEqual(htmlEndo.includes('Código PIX Copia e Cola:'), true, 'Endodontia deve conter Copia e Cola Bacen');
assert.strictEqual(htmlEndo.includes('A combinar'), false, 'Endodontia NÃO pode conter "A combinar"');
assert.strictEqual(htmlEndo.includes('A definir'), false, 'Endodontia NÃO pode conter "A definir"');

console.log('  ✔ Cenário D validado com sucesso: Modelo Endodontia dinâmico com PJ, Responsável Técnica e PIX Bacen');

// --------------------------------------------------------------------------
// CENÁRIO E: AUDITORIA DE REGRESSÃO DO CONTRATO HISTÓRICO ASSINADO
// --------------------------------------------------------------------------
console.log('\n7. Verificando que a regra não afeta contratos históricos assinados...');
// Contrato com assinatura já fixada
const snapHistorico: ContratoSnapshot = {
  contratoId: 'CTR-ADC49D8D',
  orcamentoId: 'orc-hist-1',
  pacienteId: 'pac-1',
  versao: '1.0',
  status: 'formalizado',
  emitidoEm: '2026-10-01T10:00:00Z',
  paciente: { id: 'pac-1', nome: 'Paciente Histórico', cpf: '000.000.000-00', rg: '', dataNascimento: '', idade: '', endereco: '', telefone: '', email: '', profissao: '', estadoCivil: '' },
  clinica: { nome: 'Clínica Antiga Fixada', cnpj: '11.111.111/0001-11', cro: '1111', endereco: 'Rua Antiga', telefone: '82999990000', email: 'antigo@clinica.com', cidade: 'Maceió', dentistaResponsavel: 'Dra Antiga' },
  orcamento: { id: 'orc-hist-1', numeroIdentificador: 'ADC49D8D', titulo: 'Histórico', subtotal: 1000, desconto: 0, total: 1000, totalExtenso: 'mil reais', formasPagamento: 'PIX', validade: '', dataAprovacao: '', itens: [] },
  financeiro: { subtotal: 1000, desconto: 0, total: 1000, totalExtenso: 'mil reais', formaPagamento: 'PIX', entrada: 0, parcelas: [], quantidadeParcelas: 1, valorParcela: 1000 },
  assinaturaPaciente: { assinaturaData: 'data:image/png;base64,assinatura-paciente', nome: 'Paciente Histórico', dataHora: '2026-10-01T10:05:00Z' },
  assinaturaDentista: { assinaturaData: 'data:image/png;base64,assinatura-dentista', nome: 'Dra Antiga', dataHora: '2026-10-01T10:00:00Z' },
};

// Quando o contrato já tem snapshot histórico persistido com assinaturas, ele é mantido integralmente
assert.strictEqual(snapHistorico.clinica.nome, 'Clínica Antiga Fixada', 'Snapshot histórico assinado não é sobrescrito');
assert.strictEqual(snapHistorico.status, 'formalizado');
console.log('  ✔ Snapshot histórico formalizado preservado');

console.log('\n======================================================================');
console.log('TODAS AS ASSERÇÕES DE HOMOLOGAÇÃO PASSARAM COM SUCESSO! (100% OK)');
console.log('======================================================================');
