import { gerarHtmlContrato, ContratoSnapshot } from '../src/utils/contratoEngine';
import { formatMoney } from '../src/utils/exportCsv';

// Base snapshot mock
const mockClinica = {
  nome: 'Duracenski Odontologia',
  cnpj: '69.890.045/0001-85',
  cro: '06267-AL',
  croResponsavel: '06267-AL',
  dentistaResponsavel: 'Dra. Rosângela Santos Pereira',
  endereco: 'Rua do Sol, 100, Maceió - AL',
  telefone: '(82) 99999-9999',
  email: 'duracenskiodontologia@gmail.com',
  chavePix: '69890045000185',
  tipoChavePix: 'CNPJ',
  cidade: 'Maceió',
};

const mockPaciente = {
  nome: 'Dieg duracenski',
  cpf: '032.663.962-43',
  telefone: '(82) 98888-8888',
  endereco: 'Av Fernandes Lima, 500, Maceió - AL',
};

// TESTE 1: Snapshot equivalente ao CTR-59529E0E (valorTotal: 900 em vez de total: 900, orcamento sem numeroIdentificador)
console.log('--- TESTE 1: Caso CTR-59529E0E (valorTotal e sem numeroIdentificador) ---');
const snap1: ContratoSnapshot = {
  contratoId: 'CTR-59529E0E',
  orcamentoId: '59529e0e-a2d2-45ca-b98c-0b2b205b2d6e',
  pacienteId: 'bbc5fb2a-2388-485c-80f9-cfab3d352a03',
  versao: '1.0',
  status: 'formalizado',
  emitidoEm: '2026-11-05T19:27:23.811Z',
  paciente: mockPaciente,
  clinica: mockClinica,
  orcamento: {
    id: '59529e0e-a2d2-45ca-b98c-0b2b205b2d6e',
    titulo: 'Exodontia Siso Inferior',
    itens: [
      {
        id: '1',
        nome: 'Exodontia Siso Inferior',
        denteOuRegiao: '38',
        quantidade: 1,
        valorUnitario: 1000,
        valorTotal: 1000,
      },
    ],
    total: 900,
    subtotal: 1000,
    desconto: 100,
  } as any,
  financeiro: {
    valorTotal: 900, // Notem: propriedade sob nome valorTotal
    subtotal: 1000,
    desconto: 100,
    formaPagamento: 'Opção 1: À Vista no PIX (10% de Desconto): R$ 900,00',
    quantidadeParcelas: 1,
    valorParcela: 900,
    entrada: 0,
    parcelas: [],
  } as any,
};

const html1 = gerarHtmlContrato(snap1);

const hasZeroMoney1 = html1.includes(formatMoney(0));
const hasUndefined1 = html1.includes('undefined');
const hasOrcRef1 = html1.includes('#ORC-59529E0E');
const hasVal900_Clausula2 = html1.includes(formatMoney(900));
const hasTabelaParcela1 = html1.includes('Pagamento Único') && html1.includes(formatMoney(900));

console.log('Teste 1 - Contém R$ 0,00 indevido?:', hasZeroMoney1, '(Esperado: false)');
console.log('Teste 1 - Contém #undefined?:', hasUndefined1, '(Esperado: false)');
console.log('Teste 1 - Contém #ORC-59529E0E?:', hasOrcRef1, '(Esperado: true)');
console.log('Teste 1 - Cláusula 2ª contém R$ 900,00?:', hasVal900_Clausula2, '(Esperado: true)');
console.log('Teste 1 - Cronograma possui linha de Pagamento Único via PIX?:', hasTabelaParcela1, '(Esperado: true)');

if (hasZeroMoney1 || hasUndefined1 || !hasOrcRef1 || !hasVal900_Clausula2 || !hasTabelaParcela1) {
  throw new Error('Falha no Teste 1!');
}

// TESTE 2: Snapshot PIX à vista com desconto e cronograma gerado
console.log('\n--- TESTE 2: PIX à vista com desconto (R$ 810,00) ---');
const snap2: ContratoSnapshot = {
  contratoId: 'CTR-469FA845',
  orcamentoId: '469fa845-614f-4f80-bac7-a2ae4fe0f5f9',
  pacienteId: 'bbc5fb2a-2388-485c-80f9-cfab3d352a03',
  versao: '1.0',
  status: 'formalizado',
  emitidoEm: '2026-11-05T09:59:32.000Z',
  paciente: mockPaciente,
  clinica: mockClinica,
  orcamento: {
    id: '469fa845-614f-4f80-bac7-a2ae4fe0f5f9',
    numeroIdentificador: 'ORC-469FA845',
    titulo: 'Exodontia Siso Superior',
    itens: [
      {
        id: '1',
        nome: 'Exodontia Siso Superior',
        denteOuRegiao: '18',
        quantidade: 1,
        valorUnitario: 900,
        valorTotal: 900,
      },
    ],
    total: 810,
    subtotal: 900,
    desconto: 90,
  } as any,
  financeiro: {
    total: 810,
    subtotal: 900,
    desconto: 90,
    formaPagamento: 'Opção 1: À Vista no PIX (10% de Desconto): R$ 810,00',
    quantidadeParcelas: 1,
    valorParcela: 810,
    entrada: 0,
    parcelas: [
      {
        numero: 1,
        descricao: 'Pagamento Único via PIX',
        vencimento: '05/11/2026',
        valor: 810,
        metodo: 'PIX',
        status: 'Pendente',
      },
    ],
  } as any,
};

const html2 = gerarHtmlContrato(snap2);
const has810 = html2.includes(formatMoney(810));
const hasPendente2 = html2.includes('Pendente');
const hasUndefined2 = html2.includes('undefined');

console.log('Teste 2 - Contém R$ 810,00 na Cláusula 2ª e Cronograma?:', has810, '(Esperado: true)');
console.log('Teste 2 - Situação da parcela é Pendente (não quitada sem baixa)?:', hasPendente2, '(Esperado: true)');
console.log('Teste 2 - Contém undefined?:', hasUndefined2, '(Esperado: false)');

if (!has810 || !hasPendente2 || hasUndefined2) {
  throw new Error('Falha no Teste 2!');
}

// TESTE 3: Contrato sem desconto (valor integral R$ 2.400,00)
console.log('\n--- TESTE 3: Contrato sem desconto (R$ 2.400,00) ---');
const snap3: ContratoSnapshot = {
  contratoId: 'CTR-A1B2C3D4',
  orcamentoId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  pacienteId: 'bbc5fb2a-2388-485c-80f9-cfab3d352a03',
  versao: '1.0',
  status: 'emitido',
  emitidoEm: '2026-11-05T10:00:00.000Z',
  paciente: mockPaciente,
  clinica: mockClinica,
  orcamento: {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    numeroIdentificador: 'ORC-A1B2C3D4',
    titulo: 'Restaurações Estéticas',
    itens: [
      {
        id: '1',
        nome: 'Restauração em Resina',
        quantidade: 4,
        valorUnitario: 600,
        valorTotal: 2400,
      },
    ],
    total: 2400,
    subtotal: 2400,
    desconto: 0,
  } as any,
  financeiro: {
    total: 2400,
    subtotal: 2400,
    desconto: 0,
    formaPagamento: 'Cartão de Crédito em 4x',
    quantidadeParcelas: 4,
    valorParcela: 600,
    entrada: 0,
    parcelas: [
      { numero: 1, descricao: 'Parcela 1 de 4 (Cartão de Crédito)', vencimento: 'Fatura do Cartão', valor: 600, metodo: 'Cartão de Crédito', status: 'Autorizado' },
      { numero: 2, descricao: 'Parcela 2 de 4 (Cartão de Crédito)', vencimento: 'Fatura do Cartão', valor: 600, metodo: 'Cartão de Crédito', status: 'Autorizado' },
      { numero: 3, descricao: 'Parcela 3 de 4 (Cartão de Crédito)', vencimento: 'Fatura do Cartão', valor: 600, metodo: 'Cartão de Crédito', status: 'Autorizado' },
      { numero: 4, descricao: 'Parcela 4 de 4 (Cartão de Crédito)', vencimento: 'Fatura do Cartão', valor: 600, metodo: 'Cartão de Crédito', status: 'Autorizado' },
    ],
  } as any,
};

const html3 = gerarHtmlContrato(snap3);
const has2400 = html3.includes(formatMoney(2400));
const hasDescontoZero = !html3.includes('Desconto Concedido:');

console.log('Teste 3 - Total R$ 2.400,00 presente?:', has2400, '(Esperado: true)');
console.log('Teste 3 - Bloco de Desconto omitido quando zero?:', hasDescontoZero, '(Esperado: true)');

if (!has2400 || !hasDescontoZero) {
  throw new Error('Falha no Teste 3!');
}

// TESTE 4: Entrada + PIX Parcelado
console.log('\n--- TESTE 4: Entrada + PIX Parcelado ---');
const snap4: ContratoSnapshot = {
  contratoId: 'CTR-ENTRADA-PIX',
  orcamentoId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  pacienteId: 'bbc5fb2a-2388-485c-80f9-cfab3d352a03',
  versao: '1.0',
  status: 'emitido',
  emitidoEm: '2026-11-05T11:00:00.000Z',
  paciente: mockPaciente,
  clinica: mockClinica,
  orcamento: {
    id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    numeroIdentificador: 'ORC-ENTRADA-PIX',
    titulo: 'Tratamento Multidisciplinar',
    itens: [
      { id: '1', nome: 'Laminados', quantidade: 2, valorUnitario: 1500, valorTotal: 3000 },
    ],
    total: 3000,
    subtotal: 3000,
    desconto: 0,
  } as any,
  financeiro: {
    total: 3000,
    subtotal: 3000,
    desconto: 0,
    formaPagamento: 'Entrada: R$ 1.000,00 via PIX + 2x de R$ 1.000,00 no PIX Parcelado',
    entrada: 1000,
    quantidadeParcelas: 2,
    valorParcela: 1000,
    parcelas: [
      { numero: 1, descricao: 'Entrada Inicial (PIX)', vencimento: '05/11/2026', valor: 1000, metodo: 'PIX', status: 'Pendente' },
      { numero: 2, descricao: 'Parcela 1 de 2 (PIX Parcelado)', vencimento: '05/12/2026', valor: 1000, metodo: 'PIX Parcelado', status: 'Pendente' },
      { numero: 3, descricao: 'Parcela 2 de 2 (PIX Parcelado)', vencimento: '05/01/2027', valor: 1000, metodo: 'PIX Parcelado', status: 'Pendente' },
    ],
  } as any,
};

const html4 = gerarHtmlContrato(snap4);
const hasEntradaTxt = html4.includes(formatMoney(1000));
const hasSaldoRestante = html4.includes(formatMoney(2000));
const has3Linhas = (html4.match(/<tr class="evitar-corte"/g) || []).length >= 4; // 1 item + 3 parcelas

console.log('Teste 4 - Texto de Entrada inicial R$ 1.000,00 presente?:', hasEntradaTxt, '(Esperado: true)');
console.log('Teste 4 - Texto de Saldo remanescente R$ 2.000,00 presente?:', hasSaldoRestante, '(Esperado: true)');
console.log('Teste 4 - Cronograma completo renderizado?:', has3Linhas, '(Esperado: true)');

if (!hasEntradaTxt || !hasSaldoRestante || !has3Linhas) {
  throw new Error('Falha no Teste 4!');
}

// TESTE 5: Snapshot inválido sem valor (bloqueio rigoroso de fallback silencioso)
console.log('\n--- TESTE 5: Snapshot inválido sem valor (Bloqueio sem fallback silencioso) ---');
const snapInvalido: ContratoSnapshot = {
  contratoId: 'CTR-INVALIDO',
  orcamentoId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
  pacienteId: 'bbc5fb2a-2388-485c-80f9-cfab3d352a03',
  versao: '1.0',
  status: 'emitido',
  emitidoEm: '2026-11-05T12:00:00.000Z',
  paciente: mockPaciente,
  clinica: mockClinica,
  orcamento: {
    id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    titulo: 'Sem valor',
    itens: [],
  } as any,
  financeiro: {
    formaPagamento: 'PIX',
    parcelas: [],
  } as any,
};

let disparouErro = false;
try {
  gerarHtmlContrato(snapInvalido);
} catch (err: any) {
  disparouErro = true;
  console.log('Teste 5 - Erro disparado corretamente ao encontrar valor ausente:', err.message);
}

console.log('Teste 5 - Disparou erro sem fallback silencioso para R$ 0,00?:', disparouErro, '(Esperado: true)');
if (!disparouErro) {
  throw new Error('Falha no Teste 5: o sistema não pode aceitar snapshots sem valor nem preencher R$ 0,00 silenciosamente!');
}

console.log('\n=============================================');
console.log('TODOS OS 5 TESTES DE ENGINE DE CONTRATO PASSARAM!');
console.log('=============================================');
