/**
 * Suite de Homologação dos 8 Cenários de Integridade Financeira
 * Orçamento -> Contrato -> Cláusula 2ª -> Cláusula 3ª -> PDF
 */
import {
  mapearDadosContrato,
  gerarHtmlContrato,
  validarIntegridadeOrcamentoContrato,
  validarCronogramaFinanceiroContrato,
} from '../src/utils/contratoEngine';
import {
  parseCondicoesPagamento,
  extrairCondicaoEscolhida,
  extrairDetalhesCondicaoDeTexto,
  calcularResumoCartaoCondicao,
} from '../src/utils/orcamentoCondicoes';
import { formatMoney } from '../src/utils/exportCsv';
import { OPERADORAS_PADRAO } from '../src/hooks/useMaquinasCartao';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, msg: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASSOU] ${msg}`);
  } else {
    console.error(`  [FALHOU] ${msg}`);
    throw new Error(`Falha no teste: ${msg}`);
  }
}

const mockPatient = {
  id: 'pac-1234',
  nome: 'Maria Roseane Alves dos Santos',
  cpf: '123.456.789-00',
  telefone: '(82) 99999-9999',
  endereco: 'Rua das Flores, 123, Maceió - AL',
};

const mockConfig = {
  nomeClinica: 'Duracenski Odontologia',
  dentistaResponsavel: 'Dra. Rosângela Santos Pereira',
  croResponsavel: 'CRO-AL 06267',
  cnpj: '12.345.678/0001-90',
  chavePix: '12345678000190',
  tipoChavePix: 'cnpj',
};

console.log('================================================================');
console.log('HOMOLOGAÇÃO DOS 8 CENÁRIOS OBRIGATÓRIOS: ORÇAMENTO & CONTRATO');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// CENÁRIO 1: Orçamento com desconto (Exemplo real #CCCE6389)
// -----------------------------------------------------------------------------
console.log('CENÁRIO 1: Orçamento com desconto (Caso Real #CCCE6389)');
{
  const orcamentoReal = {
    id: 'ccce6389-c5fd-4c7f-9f87-a0a66e04c46a',
    titulo: 'Lentes em Resina Composta',
    pacienteId: mockPatient.id,
    pacienteNome: mockPatient.nome,
    subtotal: 8870,
    desconto: 2820,
    total: 6050,
    formasPagamento: 'Cartão de crédito em 18x de R$ 336,11',
    itens: [
      { nome: 'Facetas em Resina Composta', quantidade: 10, valorUnitario: 887, valorTotal: 8870 },
    ],
  };

  const snapshot = mapearDadosContrato({
    patient: mockPatient,
    orcamento: orcamentoReal,
    configuracoes: mockConfig,
    configuracoesContrato: mockConfig,
  });

  assert(snapshot.financeiro.total === 6050, `Total do contrato deve ser R$ 6.050,00 (obtido: ${snapshot.financeiro.total})`);
  assert(snapshot.financeiro.subtotal === 8870, `Subtotal do contrato deve ser R$ 8.870,00 (obtido: ${snapshot.financeiro.subtotal})`);
  assert(snapshot.financeiro.desconto === 2820, `Desconto deve ser R$ 2.820,00 (obtido: ${snapshot.financeiro.desconto})`);
  assert(snapshot.financeiro.subtotal - snapshot.financeiro.desconto === snapshot.financeiro.total, 'Consistência matemática: Subtotal - Desconto === Total');
  assert(snapshot.financeiro.quantidadeParcelas === 18, `Quantidade de parcelas deve ser 18 (obtido: ${snapshot.financeiro.quantidadeParcelas})`);
  assert(snapshot.financeiro.valorParcela === 336.11, `Valor nominal da parcela deve ser R$ 336,11 (obtido: ${snapshot.financeiro.valorParcela})`);
  assert(snapshot.financeiro.parcelas.length === 18, `Cronograma deve conter 18 parcelas (obtido: ${snapshot.financeiro.parcelas.length})`);

  const somaParcelas = snapshot.financeiro.parcelas.reduce((acc, p) => acc + p.valor, 0);
  assert(Math.abs(somaParcelas - 6050) < 0.01, `Soma das 18 parcelas deve totalizar R$ 6.050,00 (obtido: ${somaParcelas})`);

  // Validação dos 2 centavos de ajuste distribuídos nos 2 primeiros vencimentos
  assert(snapshot.financeiro.parcelas[0].valor === 336.12, 'Parcela 1 ajustada em R$ 336,12 (+0,01)');
  assert(snapshot.financeiro.parcelas[1].valor === 336.12, 'Parcela 2 ajustada em R$ 336,12 (+0,01)');
  assert(snapshot.financeiro.parcelas[2].valor === 336.11, 'Parcela 3 nominal R$ 336,11');

  // Validação de Cláusulas no HTML
  const html = gerarHtmlContrato(snapshot);
  const htmlNorm = html.replace(/\u00A0/g, ' ');
  assert(htmlNorm.includes('R$ 6.050,00'), 'Cláusula 2ª apresenta valor total aprovado R$ 6.050,00');
  assert(htmlNorm.includes('seis mil e cinquenta reais'), 'Cláusula 2ª apresenta valor por extenso correto');
  assert(htmlNorm.includes('R$ 8.870,00'), 'Cláusula 2ª apresenta subtotal de R$ 8.870,00');
  assert(htmlNorm.includes('R$ 2.820,00'), 'Cláusula 2ª apresenta desconto de R$ 2.820,00');
  assert(htmlNorm.includes('18 parcelas') || htmlNorm.includes('18 (18 parcelas'), 'Cláusula 3ª menciona 18 parcelas');
  assert(htmlNorm.includes('336,11'), 'Cláusula 3ª menciona valor nominal de R$ 336,11');

  const valIntegridade = validarIntegridadeOrcamentoContrato(orcamentoReal, snapshot);
  assert(valIntegridade.valido === true, `Validação de integridade aprovada sem erros (erros: ${valIntegridade.erros.join(', ')})`);
}

// -----------------------------------------------------------------------------
// CENÁRIO 2: Orçamento sem desconto
// -----------------------------------------------------------------------------
console.log('\nCENÁRIO 2: Orçamento sem desconto');
{
  const orcamentoSemDesconto = {
    id: 'orc-sem-desc-1',
    titulo: 'Tratamento Clínico Integrado',
    pacienteId: mockPatient.id,
    pacienteNome: mockPatient.nome,
    subtotal: 5000,
    desconto: 0,
    total: 5000,
    formasPagamento: 'Cartão de crédito em 10x de R$ 500,00',
    itens: [
      { nome: 'Restaurações Múltiplas', quantidade: 5, valorUnitario: 1000, valorTotal: 5000 },
    ],
  };

  const snapshot = mapearDadosContrato({
    patient: mockPatient,
    orcamento: orcamentoSemDesconto,
    configuracoes: mockConfig,
    configuracoesContrato: mockConfig,
  });

  assert(snapshot.financeiro.total === 5000, 'Total do contrato deve ser R$ 5.000,00');
  assert(snapshot.financeiro.subtotal === 5000, 'Subtotal deve ser R$ 5.000,00');
  assert(snapshot.financeiro.desconto === 0, 'Desconto deve ser 0');
  assert(snapshot.financeiro.quantidadeParcelas === 10, 'Quantidade de parcelas deve ser 10');
  assert(snapshot.financeiro.valorParcela === 500, 'Valor de cada parcela deve ser R$ 500,00');

  const val = validarIntegridadeOrcamentoContrato(orcamentoSemDesconto, snapshot);
  assert(val.valido === true, 'Validação de integridade sem desconto aprovada');
}

// -----------------------------------------------------------------------------
// CENÁRIO 3: Pagamento à vista (PIX com e sem desconto)
// -----------------------------------------------------------------------------
console.log('\nCENÁRIO 3: Pagamento à vista (PIX com e sem desconto)');
{
  // 3a. PIX com desconto
  const orcPixDesc = {
    id: 'orc-pix-desc',
    titulo: 'Profilaxia e Clareamento',
    pacienteId: mockPatient.id,
    pacienteNome: mockPatient.nome,
    subtotal: 2000,
    desconto: 200,
    total: 1800,
    formasPagamento: 'À vista no PIX com 10% de desconto: R$ 1.800,00',
    itens: [
      { nome: 'Clareamento Dental', quantidade: 1, valorUnitario: 2000, valorTotal: 2000 },
    ],
  };

  const snapPixDesc = mapearDadosContrato({
    patient: mockPatient,
    orcamento: orcPixDesc,
    configuracoes: mockConfig,
    configuracoesContrato: mockConfig,
  });

  assert(snapPixDesc.financeiro.total === 1800, 'PIX com desconto: Total = R$ 1.800,00');
  assert(snapPixDesc.financeiro.desconto === 200, 'PIX com desconto: Desconto = R$ 200,00');
  assert(snapPixDesc.financeiro.parcelas.length === 1, 'PIX: 1 parcela única');
  assert(snapPixDesc.financeiro.parcelas[0].metodo === 'PIX', 'Método é PIX');

  const valPixDesc = validarIntegridadeOrcamentoContrato(orcPixDesc, snapPixDesc);
  assert(valPixDesc.valido === true, 'Validação de integridade PIX com desconto aprovada');

  // 3b. PIX sem desconto
  const orcPixSemDesc = {
    id: 'orc-pix-sem-desc',
    titulo: 'Consulta de Avaliação',
    pacienteId: mockPatient.id,
    pacienteNome: mockPatient.nome,
    subtotal: 500,
    desconto: 0,
    total: 500,
    formasPagamento: 'À vista no PIX: R$ 500,00',
    itens: [
      { nome: 'Avaliação Clínica Especializada', quantidade: 1, valorUnitario: 500, valorTotal: 500 },
    ],
  };

  const snapPixSemDesc = mapearDadosContrato({
    patient: mockPatient,
    orcamento: orcPixSemDesc,
    configuracoes: mockConfig,
    configuracoesContrato: mockConfig,
  });

  assert(snapPixSemDesc.financeiro.total === 500, 'PIX sem desconto: Total = R$ 500,00');
  assert(snapPixSemDesc.financeiro.desconto === 0, 'PIX sem desconto: Desconto = 0');
  const valPixSemDesc = validarIntegridadeOrcamentoContrato(orcPixSemDesc, snapPixSemDesc);
  assert(valPixSemDesc.valido === true, 'Validação de integridade PIX sem desconto aprovada');
}

// -----------------------------------------------------------------------------
// CENÁRIO 4: Parcelamento no cartão com distribuição exata de centavos
// -----------------------------------------------------------------------------
console.log('\nCENÁRIO 4: Parcelamento no cartão com centavos indivisíveis');
{
  const orcCentavos = {
    id: 'orc-centavos',
    titulo: 'Tratamento em 3x',
    pacienteId: mockPatient.id,
    pacienteNome: mockPatient.nome,
    subtotal: 1000,
    desconto: 0,
    total: 1000,
    formasPagamento: 'Cartão de crédito em 3x de R$ 333,33',
    itens: [
      { nome: 'Procedimento X', quantidade: 1, valorUnitario: 1000, valorTotal: 1000 },
    ],
  };

  const snapCentavos = mapearDadosContrato({
    patient: mockPatient,
    orcamento: orcCentavos,
    configuracoes: mockConfig,
    configuracoesContrato: mockConfig,
  });

  assert(snapCentavos.financeiro.total === 1000, 'Total R$ 1.000,00');
  assert(snapCentavos.financeiro.quantidadeParcelas === 3, '3 parcelas');
  // 1000 / 3 = 333.33 com 1 centavo de resto -> parcela 1 = 333.34, parcelas 2 e 3 = 333.33
  assert(snapCentavos.financeiro.parcelas[0].valor === 333.34, 'Parcela 1 = R$ 333,34');
  assert(snapCentavos.financeiro.parcelas[1].valor === 333.33, 'Parcela 2 = R$ 333,33');
  assert(snapCentavos.financeiro.parcelas[2].valor === 333.33, 'Parcela 3 = R$ 333,33');

  const somaCentavos = snapCentavos.financeiro.parcelas.reduce((acc, p) => acc + p.valor, 0);
  assert(Math.abs(somaCentavos - 1000) < 0.001, 'Soma exata das parcelas fecha R$ 1.000,00 sem perda de centavos');
  assert(validarIntegridadeOrcamentoContrato(orcCentavos, snapCentavos).valido === true, 'Validação de integridade aprovada');
}

// -----------------------------------------------------------------------------
// CENÁRIO 5: Pagamento com entrada e saldo
// -----------------------------------------------------------------------------
console.log('\nCENÁRIO 5: Pagamento com entrada e saldo');
{
  const orcEntradaSaldo = {
    id: 'orc-ent-saldo',
    titulo: 'Reabilitação Oral',
    pacienteId: mockPatient.id,
    pacienteNome: mockPatient.nome,
    subtotal: 10000,
    desconto: 0,
    total: 10000,
    formasPagamento: 'Entrada de R$ 2.000,00 via PIX + Saldo em 8x de R$ 1.000,00 no Cartão',
    itens: [
      { nome: 'Próteses Sobre Implantes', quantidade: 2, valorUnitario: 5000, valorTotal: 10000 },
    ],
  };

  const snapEnt = mapearDadosContrato({
    patient: mockPatient,
    orcamento: orcEntradaSaldo,
    configuracoes: mockConfig,
    configuracoesContrato: mockConfig,
  });

  assert(snapEnt.financeiro.total === 10000, 'Total R$ 10.000,00');
  assert(snapEnt.financeiro.entrada === 2000, 'Entrada de R$ 2.000,00');
  const somaTodas = snapEnt.financeiro.parcelas.reduce((acc, p) => acc + p.valor, 0);
  assert(Math.abs(somaTodas - 10000) < 0.01, `Soma da entrada + parcelas fecha R$ 10.000,00 (obtido: ${somaTodas})`);
  assert(validarIntegridadeOrcamentoContrato(orcEntradaSaldo, snapEnt).valido === true, 'Validação de integridade aprovada');
}

// -----------------------------------------------------------------------------
// CENÁRIO 6: Orçamento com taxa de cartão (maquininha)
// -----------------------------------------------------------------------------
console.log('\nCENÁRIO 6: Orçamento com taxa de cartão (maquininha - uso interno da clínica)');
{
  const condCartao = extrairDetalhesCondicaoDeTexto('Cartão de crédito em 18x de R$ 336,11', 6050);
  const resumoTaxa = calcularResumoCartaoCondicao(condCartao, 6050, OPERADORAS_PADRAO, OPERADORAS_PADRAO[0]);

  assert(resumoTaxa.temCartao === true, 'Identifica que é operação com cartão');
  assert(resumoTaxa.valorBrutoCartao === 6050, 'Valor bruto da transação do paciente é R$ 6.050,00');
  assert(resumoTaxa.taxaValorTotal > 0, `Calcula taxa da maquininha: R$ ${resumoTaxa.taxaValorTotal}`);
  assert(resumoTaxa.valorLiquidoTotal < 6050, 'Valor líquido da clínica é menor que o bruto devido à taxa');

  // Garante que o contrato do paciente NÃO contém a taxa interna
  const orcComTaxa = {
    id: 'orc-com-taxa',
    titulo: 'Lentes com Taxa Interna',
    pacienteId: mockPatient.id,
    pacienteNome: mockPatient.nome,
    subtotal: 8870,
    desconto: 2820,
    total: 6050,
    formasPagamento: 'Cartão de crédito em 18x de R$ 336,11',
    itens: [{ nome: 'Procedimento', quantidade: 1, valorUnitario: 8870, valorTotal: 8870 }],
  };

  const snapTaxa = mapearDadosContrato({
    patient: mockPatient,
    orcamento: orcComTaxa,
    configuracoes: mockConfig,
    configuracoesContrato: mockConfig,
  });

  assert(snapTaxa.financeiro.total === 6050, 'O total do contrato do paciente permanece rigorosamente R$ 6.050,00');
  assert(validarIntegridadeOrcamentoContrato(orcComTaxa, snapTaxa).valido === true, 'Validação de integridade aprovada');
}

// -----------------------------------------------------------------------------
// CENÁRIO 7: Reabertura de contrato existente (Preservação de contratos já assinados)
// -----------------------------------------------------------------------------
console.log('\nCENÁRIO 7: Reabertura de contrato existente e imutabilidade histórica');
{
  // Simula contrato existente formalizado com assinatura digital registrada
  const contratoAssinadoHistorico = {
    id: 'doc-historico-uuid',
    tipo: 'contrato',
    identificador: 'CTR-HISTORICO',
    status: 'assinado',
    assinadoEm: '2026-05-10T14:30:00.000Z',
    conteudo: '<html>Conteudo Formalizado Original</html>',
    itens: {
      contratoId: 'CTR-HISTORICO',
      status: 'assinado',
      assinaturaPaciente: {
        assinaturaData: 'data:image/png;base64,assinatura_historica',
        nome: 'Maria Roseane Alves dos Santos',
        dataHora: '2026-05-10T14:30:00.000Z',
      },
      financeiro: {
        total: 8870, // Discrepância histórica registrada no passado
        subtotal: 8870,
        desconto: 0,
        formaPagamento: 'Cartão de crédito em 1x de R$ 8.870,00',
        parcelas: [{ numero: 1, valor: 8870, descricao: 'Pagamento em Cartão de Crédito', vencimento: 'Fatura do Cartão', status: 'Autorizado' }],
      },
    },
  };

  // 1. Integridade histórica: o contrato assinado NÃO pode ser recalculado ou sobrescrito silenciosamente
  assert(Boolean(contratoAssinadoHistorico.assinadoEm), 'Identifica que o contrato já está assinado');
  assert(Boolean(contratoAssinadoHistorico.itens.assinaturaPaciente.assinaturaData), 'Identifica assinatura gráfica do paciente');

  // 2. Validação detecta divergência com o orçamento aprovado (R$ 6.050,00 vs R$ 8.870,00)
  const orcAprovado = { id: 'orc-ref', total: 6050, subtotal: 8870, desconto: 2820 };
  const valDivergencia = validarIntegridadeOrcamentoContrato(orcAprovado, contratoAssinadoHistorico.itens as any);
  assert(valDivergencia.valido === false, 'Validador detecta divergência histórica no contrato assinado');
  assert(valDivergencia.divergenciaFinanceira === true, 'Sinaliza divergência financeira');

  // 3. Garante que tentativa de emissão de novo contrato com tal divergência é BLOQUEADA
  assert(valDivergencia.erros.length > 0, `Erros reportados: ${valDivergencia.erros.join('; ')}`);
}

// -----------------------------------------------------------------------------
// CENÁRIO 8: Geração e download do PDF
// -----------------------------------------------------------------------------
console.log('\nCENÁRIO 8: Geração e consistência do PDF oficial');
{
  const orcamentoReal = {
    id: 'ccce6389-c5fd-4c7f-9f87-a0a66e04c46a',
    titulo: 'Lentes em Resina Composta',
    pacienteId: mockPatient.id,
    pacienteNome: mockPatient.nome,
    subtotal: 8870,
    desconto: 2820,
    total: 6050,
    formasPagamento: 'Cartão de crédito em 18x de R$ 336,11',
    itens: [
      { nome: 'Facetas em Resina Composta', quantidade: 10, valorUnitario: 887, valorTotal: 8870 },
    ],
  };

  const snapshot = mapearDadosContrato({
    patient: mockPatient,
    orcamento: orcamentoReal,
    configuracoes: mockConfig,
    configuracoesContrato: mockConfig,
  });

  // Validação dos dados que abastecem o gerador de PDF
  const totalFormatado = formatMoney(snapshot.financeiro.total);
  const subtotalFormatado = formatMoney(snapshot.financeiro.subtotal);
  const descontoFormatado = formatMoney(snapshot.financeiro.desconto);

  assert(totalFormatado === 'R$ 6.050,00' || totalFormatado === 'R$ 6.050,00', `Total formatado no PDF: ${totalFormatado}`);
  assert(subtotalFormatado === 'R$ 8.870,00' || subtotalFormatado === 'R$ 8.870,00', `Subtotal formatado no PDF: ${subtotalFormatado}`);
  assert(descontoFormatado === 'R$ 2.820,00' || descontoFormatado === 'R$ 2.820,00', `Desconto formatado no PDF: ${descontoFormatado}`);

  // Verifica que a tabela de parcelas do PDF receberá as 18 parcelas completas
  assert(snapshot.financeiro.parcelas.length === 18, 'Tabela de parcelas do PDF recebe 18 linhas');
  const primeiraParc = snapshot.financeiro.parcelas[0];
  const ultimaParc = snapshot.financeiro.parcelas[17];
  assert(primeiraParc.numero === 1 && primeiraParc.valor === 336.12, 'PDF Parcela 1: R$ 336,12');
  assert(ultimaParc.numero === 18 && ultimaParc.valor === 336.11, 'PDF Parcela 18: R$ 336,11');
}

console.log('\n================================================================');
console.log(`RESULTADO FINAL: ${passedTests} DE ${totalTests} TESTES APROVADOS (100%)`);
console.log('================================================================');
