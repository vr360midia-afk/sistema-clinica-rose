import { identificarTipoDocumento } from '../src/utils/documentoFormat';
import { mapearDadosContrato, gerarHtmlContrato } from '../src/utils/contratoEngine';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FALHOU: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSOU: ${msg}`);
  }
}

console.log('--- TESTE: IDENTIFICAR TIPO DE DOCUMENTO ---');
assert(identificarTipoDocumento('') === 'cpf', 'Doc vazio deve ser CPF');
assert(identificarTipoDocumento(null) === 'cpf', 'Doc null deve ser CPF');
assert(identificarTipoDocumento(undefined) === 'cpf', 'Doc undefined deve ser CPF');
assert(identificarTipoDocumento('Não informado') === 'cpf', 'Doc "Não informado" deve ser CPF');
assert(identificarTipoDocumento('12345678901') === 'cpf', 'Doc 11 dígitos deve ser CPF');
assert(identificarTipoDocumento('69890045000185') === 'cnpj', 'Doc 14 dígitos deve ser CNPJ');

console.log('\n--- TESTE: DADOS PADRÃO DA CLÍNICA NO CONTRATO ---');
const dummyPaciente = {
  id: 'pac-1',
  nome: 'Claudinei Bento da Silva',
  cpf: '',
  endereco: '',
};

const dummyOrcamento = {
  id: 'orc-claudinei',
  titulo: 'Plano de Tratamento',
  total: 8000,
  subtotal: 8000,
  desconto: 0,
  formasPagamento: 'Entrada: R$ 4.000,00 via PIX + Saldo: R$ 4.000,00 em 4x de R$ 1.000,00 no Boleto',
  itens: [
    { nome: 'Lentes em Resina Superior e Inferior', quantidade: 1, valorTotal: 8000 }
  ]
};

const snap = mapearDadosContrato({
  patient: dummyPaciente,
  orcamento: dummyOrcamento,
  configuracoes: {},
  configContrato: {},
});

assert(snap.clinica.nome === 'Duracenski Odontologia', `Nome da clínica deve ser Duracenski Odontologia (obtido: ${snap.clinica.nome})`);
assert(snap.clinica.cnpj === '69.890.045/0001-85', `CNPJ da clínica deve ser 69.890.045/0001-85 (obtido: ${snap.clinica.cnpj})`);
assert(snap.clinica.cro === 'CRO-AL 06267', `CRO da clínica deve ser CRO-AL 06267 (obtido: ${snap.clinica.cro})`);
assert(snap.clinica.dentistaResponsavel === 'Dra. Rosângela Santos Pereira', `Dentista deve ser Dra. Rosângela (obtido: ${snap.clinica.dentistaResponsavel})`);
assert(snap.clinica.endereco.includes('JTR - Edifício Espanha'), `Endereço deve conter JTR (obtido: ${snap.clinica.endereco})`);
assert(snap.clinica.telefone === '(82) 99740-0221', `Telefone deve ser (82) 99740-0221 (obtido: ${snap.clinica.telefone})`);
assert(snap.clinica.email === 'contato@duracenskiodontologia.com.br', `Email deve ser contato@duracenskiodontologia.com.br (obtido: ${snap.clinica.email})`);

console.log('\n--- TESTE: HTML GERADO DO CONTRATO ---');
const html = gerarHtmlContrato(snap);

assert(html.includes('Duracenski Odontologia'), 'HTML deve conter "Duracenski Odontologia"');
assert(html.includes('69.890.045/0001-85'), 'HTML deve conter "69.890.045/0001-85"');
assert(html.includes('CRO-AL 06267'), 'HTML deve conter "CRO-AL 06267"');
assert(html.includes('Dra. Rosângela Santos Pereira'), 'HTML deve conter "Dra. Rosângela Santos Pereira"');
assert(html.includes('JTR - Edifício Espanha'), 'HTML deve conter endereço da clínica');
assert(html.includes('(82) 99740-0221'), 'HTML deve conter telefone da clínica');
assert(html.includes('contato@duracenskiodontologia.com.br'), 'HTML deve conter e-mail da clínica');

assert(!html.includes('inscrito(a) no CNPJ sob o nº Não informado'), 'HTML NÃO deve ter "inscrito no CNPJ sob o nº Não informado" para o paciente');
assert(html.includes('inscrito(a) no CPF/MF sob o nº <strong>Não informado</strong>'), 'HTML deve conter "inscrito(a) no CPF/MF sob o nº Não informado"');

console.log('\n--- TESTE: CURA DE SNAPSHOT ANTIGO COM PLACEHOLDERS ---');
const snapAntigo = {
  ...snap,
  clinica: {
    ...snap.clinica,
    nome: 'Clínica Odontológica',
    cnpj: 'Não informado',
    endereco: 'Endereço da clínica',
    telefone: 'Não informado',
    email: 'Não informado',
  }
};

const htmlCurado = gerarHtmlContrato(snapAntigo);
assert(htmlCurado.includes('Duracenski Odontologia'), 'HTML curado deve conter "Duracenski Odontologia"');
assert(htmlCurado.includes('69.890.045/0001-85'), 'HTML curado deve conter "69.890.045/0001-85"');
assert(!htmlCurado.includes('Endereço da clínica'), 'HTML curado NÃO deve conter "Endereço da clínica"');

console.log('\n=============================================');
console.log('TODOS OS TESTES DE VALIDAÇÃO PASSARAM COM SUCESSO!');
console.log('=============================================');
