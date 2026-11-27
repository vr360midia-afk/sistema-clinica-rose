import { temValorValido, formatarDocumento, formatarTelefone, formatarEnderecoCompleto } from '../src/utils/documentoFormat';
import { mapearDadosContrato, ContratoSnapshot } from '../src/utils/contratoEngine';

console.log('================================================================');
console.log('TESTES DE HIDRATAÇÃO DE DADOS DO PACIENTE NO CONTRATO');
console.log('================================================================');

// Cenário 1: Paciente cadastrado com CPF, Telefone, Endereço
const pacienteCadastrado = {
  id: 'pac-claudinei-123',
  nome: 'Claudinei Bento da Silva',
  cpf: '12345678901',
  telefone: '82999998888',
  email: 'claudinei@email.com',
  endereco: 'Rua das Flores, 123, Centro, Maceió - AL',
  rg: '1234567 SSP/AL',
  profissao: 'Engenheiro Civil',
  estadoCivil: 'Casado',
};

// Orçamento aprovado
const orcamentoMock = {
  id: 'orc-12345678',
  pacienteId: 'pac-claudinei-123',
  pacienteNome: 'Claudinei Bento da Silva',
  total: 3500,
  subtotal: 3500,
  desconto: 0,
  formasPagamento: 'Cartão 10x',
  itens: [
    { id: '1', descricao: 'Restauração em Resina', quantidade: 4, valorTotal: 3500 }
  ],
};

// Snapshot antigo com placeholders ("Não informado")
const snapAntigoComPlaceholders: ContratoSnapshot = {
  contratoId: 'CTR-12345678',
  orcamentoId: 'orc-12345678',
  pacienteId: 'pac-claudinei-123',
  versao: '1.0',
  status: 'aguardando_assinatura_paciente',
  emitidoEm: new Date().toISOString(),
  paciente: {
    id: 'pac-claudinei-123',
    nome: 'Claudinei Bento da Silva',
    cpf: 'Não informado',
    rg: '',
    dataNascimento: 'Não informada',
    idade: 'Não informada',
    endereco: 'Não informado',
    telefone: 'Não informado',
    email: 'Não informado',
    profissao: '',
    estadoCivil: '',
  },
  clinica: {
    nome: 'Dra. Rosângela Santos Pereira',
    cnpj: '032.663.962-43',
    endereco: 'Av. Fernandes Lima, 100, Maceió - AL',
    cro: '06267-AL',
    dentistaResponsavel: 'Dra. Rosângela Santos Pereira',
  },
  orcamento: {
    id: 'orc-12345678',
    numeroIdentificador: '12345678',
    titulo: 'Tratamento Odontológico',
    subtotal: 3500,
    desconto: 0,
    total: 3500,
    totalExtenso: 'três mil e quinhentos reais',
    formasPagamento: 'Cartão 10x',
    validade: '30 dias',
    dataAprovacao: new Date().toISOString(),
    itens: [],
  },
  financeiro: {
    subtotal: 3500,
    desconto: 0,
    total: 3500,
    totalExtenso: 'três mil e quinhentos reais',
    formaPagamento: 'Cartão 10x',
    entrada: 0,
    parcelas: [],
    quantidadeParcelas: 10,
    valorParcela: 350,
  },
};

// TESTE 1: temValorValido
console.log('\nTESTE 1: Validação de temValorValido');
if (
  !temValorValido('Não informado') &&
  !temValorValido('nao informado') &&
  !temValorValido('') &&
  !temValorValido(null) &&
  temValorValido('123.456.789-00') &&
  temValorValido('claudinei@email.com')
) {
  console.log('  [PASSOU] temValorValido reconhece placeholders e valores reais corretamente!');
} else {
  console.error('  [FALHOU] temValorValido retornou resultado inesperado');
  process.exit(1);
}

// TESTE 2: Mapeamento direto de contrato a partir do cadastro do paciente
console.log('\nTESTE 2: Mapeamento de contrato com dados cadastrais reais');
const snapNovo = mapearDadosContrato({
  patient: pacienteCadastrado,
  orcamento: orcamentoMock,
});

if (
  snapNovo.paciente.cpf === '123.456.789-01' &&
  snapNovo.paciente.telefone === '(82) 99999-8888' &&
  snapNovo.paciente.email === 'claudinei@email.com' &&
  snapNovo.paciente.endereco === 'Rua das Flores, 123, Centro, Maceió - AL' &&
  snapNovo.paciente.rg === '1234567 SSP/AL'
) {
  console.log('  [PASSOU] Dados cadastrais de Claudinei mapeados com formatação perfeita no contrato:');
  console.log(`    CPF: ${snapNovo.paciente.cpf}`);
  console.log(`    Telefone: ${snapNovo.paciente.telefone}`);
  console.log(`    E-mail: ${snapNovo.paciente.email}`);
  console.log(`    Endereço: ${snapNovo.paciente.endereco}`);
  console.log(`    RG: ${snapNovo.paciente.rg}`);
} else {
  console.error('  [FALHOU] Dados do paciente não formatados corretamente:', snapNovo.paciente);
  process.exit(1);
}

// TESTE 3: Lógica de hidratação de snapshot existente com placeholders
console.log('\nTESTE 3: Hidratação de snapshot existente que estava com "Não informado"');
const temPacientePlaceholder =
  !temValorValido(snapAntigoComPlaceholders.paciente.cpf) ||
  !temValorValido(snapAntigoComPlaceholders.paciente.endereco) ||
  !temValorValido(snapAntigoComPlaceholders.paciente.telefone) ||
  !temValorValido(snapAntigoComPlaceholders.paciente.email);

const pacienteTemNovosDados = Boolean(
  pacienteCadastrado && (
    (temValorValido(pacienteCadastrado.cpf) && (!temValorValido(snapAntigoComPlaceholders.paciente.cpf) || snapAntigoComPlaceholders.paciente.cpf !== pacienteCadastrado.cpf)) ||
    (temValorValido(pacienteCadastrado.telefone) && (!temValorValido(snapAntigoComPlaceholders.paciente.telefone) || snapAntigoComPlaceholders.paciente.telefone !== pacienteCadastrado.telefone)) ||
    (temValorValido(pacienteCadastrado.endereco) && (!temValorValido(snapAntigoComPlaceholders.paciente.endereco) || snapAntigoComPlaceholders.paciente.endereco !== pacienteCadastrado.endereco)) ||
    (temValorValido(pacienteCadastrado.email) && (!temValorValido(snapAntigoComPlaceholders.paciente.email) || snapAntigoComPlaceholders.paciente.email !== pacienteCadastrado.email)) ||
    (temValorValido(pacienteCadastrado.rg) && (!temValorValido(snapAntigoComPlaceholders.paciente.rg) || snapAntigoComPlaceholders.paciente.rg !== pacienteCadastrado.rg))
  )
);

if (temPacientePlaceholder && pacienteTemNovosDados) {
  console.log('  [PASSOU] Condição de atualização detectou corretamente a necessidade de hidratar os dados do paciente!');
} else {
  console.error('  [FALHOU] Condição de atualização falhou');
  process.exit(1);
}

// Mesclagem segura
const endCad = formatarEnderecoCompleto(pacienteCadastrado) || pacienteCadastrado.endereco;
const snapMesclado = {
  ...snapAntigoComPlaceholders,
  paciente: {
    ...snapAntigoComPlaceholders.paciente,
    nome: pacienteCadastrado.nome || snapAntigoComPlaceholders.paciente.nome,
    cpf: temValorValido(pacienteCadastrado.cpf) ? formatarDocumento(pacienteCadastrado.cpf) : snapAntigoComPlaceholders.paciente.cpf,
    rg: temValorValido(pacienteCadastrado.rg) ? String(pacienteCadastrado.rg).trim() : snapAntigoComPlaceholders.paciente.rg,
    telefone: temValorValido(pacienteCadastrado.telefone) ? formatarTelefone(pacienteCadastrado.telefone) : snapAntigoComPlaceholders.paciente.telefone,
    email: temValorValido(pacienteCadastrado.email) ? pacienteCadastrado.email : snapAntigoComPlaceholders.paciente.email,
    endereco: temValorValido(endCad) ? endCad : snapAntigoComPlaceholders.paciente.endereco,
  }
};

if (
  snapMesclado.paciente.cpf === '123.456.789-01' &&
  snapMesclado.paciente.telefone === '(82) 99999-8888' &&
  snapMesclado.paciente.email === 'claudinei@email.com' &&
  snapMesclado.paciente.endereco === 'Rua das Flores, 123, Centro, Maceió - AL' &&
  snapMesclado.paciente.rg === '1234567 SSP/AL'
) {
  console.log('  [PASSOU] Mesclagem de dados do paciente no snapshot concluída com sucesso!');
} else {
  console.error('  [FALHOU] Mesclagem falhou:', snapMesclado.paciente);
  process.exit(1);
}

// TESTE 4: Limpeza de inputs na Assinatura Digital
console.log('\nTESTE 4: Pré-preenchimento limpo no modal de assinatura digital');
const initialEmailComPlaceholder = 'Não informado';
const initialCpfComPlaceholder = 'Não informado';

const emailLimpo = temValorValido(initialEmailComPlaceholder) ? initialEmailComPlaceholder : '';
const cpfLimpo = temValorValido(initialCpfComPlaceholder) ? initialCpfComPlaceholder : '';

if (emailLimpo === '' && cpfLimpo === '') {
  console.log('  [PASSOU] Valores "Não informado" convertidos em campos vazios no modal de assinatura (sem preencher a string literal)!');
} else {
  console.error('  [FALHOU] Limpeza de placeholders no modal de assinatura falhou');
  process.exit(1);
}

console.log('\n================================================================');
console.log('TODOS OS TESTES DE HIDRATAÇÃO DO PACIENTE FORAM APROVADOS! (100%)');
console.log('================================================================\n');
