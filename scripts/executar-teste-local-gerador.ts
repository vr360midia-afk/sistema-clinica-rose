import fs from 'node:fs';
import path from 'node:path';
import { gerarPdfServidorContrato } from './test-gerador-pdf-servidor-local';

const artifactDir = 'C:\\Users\\Jhonatha\\.gemini\\antigravity\\brain\\4923da1a-4a97-47ad-b222-c804420cf9c3';

// Carregar o snapshot do teste anterior
const docSnapshot = {
  contratoId: 'CTR-SANTOS-HOMOLOG',
  emitidoEm: '2026-11-05T03:00:00.000Z',
  versao: 1,
  tipoModeloContrato: 'endodontia',
  clinica: {
    nome: 'Santos & Duracenski Odontologia LTDA',
    cnpj: '12.345.678/0001-90',
    cro: 'CRO-AL 06267',
    dentistaResponsavel: 'Dra. Rosângela Santos Pereira',
    endereco: 'Av. Fernandes Lima, 1000, Sala 401, Farol, Maceió - AL, CEP 57055-000',
    telefone: '(82) 99999-8888',
    email: 'contato@santosduracenski.com.br',
    chavePix: '12345678000190',
    tipoChavePix: 'cnpj',
    favorecidoPix: 'Santos & Duracenski Odontologia LTDA',
    bancoPix: 'Nu Pagamentos S.A. (260)',
    instrucoesPix: 'Pague via QR Code ou Copia e Cola no app do seu banco',
  },
  paciente: {
    nome: 'Carlos Eduardo de Albuquerque',
    cpf: '123.456.789-00',
    rg: '987654 SSP/AL',
    telefone: '(82) 98888-7777',
    email: 'carlos.albuquerque@email.com',
    endereco: 'Rua Deputado José Lages, 555, Ponta Verde, Maceió - AL, CEP 57035-330',
  },
  procedimentos: [
    { nome: 'Tratamento Endodôntico Molar (Canal)', dente: 'Dente 16', valor: 3200.00 },
    { nome: 'Restauração Coronária Pós-Endodôntica em Resina', dente: 'Dente 16', valor: 600.00 },
  ],
  financeiro: {
    subtotal: 3800.00,
    desconto: 300.00,
    total: 3500.00,
    totalExtenso: 'três mil e quinhentos reais',
    formaPagamento: 'Entrada de R$ 1.000,00 via PIX + 2x de R$ 1.250,00 via PIX (vencimentos 10/12/2026 e 10/01/2027)',
    payloadPix: '00020126580014br.gov.bcb.pix01141234567800019052040000530398654073500.005802BR5925Santos Duracenski Odonto6006MACEIO62070503***6304E8A2',
    parcelas: [
      {
        numero: 1,
        descricao: 'Entrada Inicial (PIX)',
        vencimento: '05/11/2026',
        valor: 1000.00,
        metodo: 'PIX',
        status: 'Quitada',
        payloadPix: '00020126580014br.gov.bcb.pix01141234567800019052040000530398654071000.005802BR5925Santos Duracenski Odonto6006MACEIO62070503***6304ABCD',
      },
      {
        numero: 2,
        descricao: '1ª Parcela (PIX)',
        vencimento: '10/12/2026',
        valor: 1250.00,
        metodo: 'PIX',
        status: 'A vencer',
        payloadPix: '00020126580014br.gov.bcb.pix01141234567800019052040000530398654071250.005802BR5925Santos Duracenski Odonto6006MACEIO62070503***63041234',
      },
      {
        numero: 3,
        descricao: '2ª Parcela (PIX)',
        vencimento: '10/01/2027',
        valor: 1250.00,
        metodo: 'PIX',
        status: 'A vencer',
        payloadPix: '00020126580014br.gov.bcb.pix01141234567800019052040000530398654071250.005802BR5925Santos Duracenski Odonto6006MACEIO62070503***63045678',
      },
    ],
  },
  dadosEndodontia: { ativo: true },
  termoUsoImagem: { autorizado: true },
  assinaturaDentista: {
    nome: 'Dra. Rosângela Santos Pereira',
    cro: '06267-AL',
    dataHora: '2026-11-05T03:00:00.000Z',
    autorizacaoId: '8ba3742d-abe1-4a5a-9456-9d6f16c41eea',
    assinaturaData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  },
  assinaturaPaciente: {
    nome: 'Carlos Eduardo de Albuquerque',
    dataHora: '2026-11-05T03:05:00.000Z',
    ip: '152.248.7.10',
    documentHash: '8f4a152d554beb1502e178f2ba66ed35d6c2f62a4d1a0ad23f9917cb46644fc8',
    assinaturaData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==',
  },
};

const pdfBytes = gerarPdfServidorContrato(docSnapshot);
const dest = path.join(artifactDir, 'contrato-ficticio-novo-servidor.pdf');
fs.writeFileSync(dest, pdfBytes);
console.log('PDF gerado com sucesso:', dest, 'Tamanho:', pdfBytes.length);

const str = Buffer.from(pdfBytes).toString('latin1');
console.log('--- TESTES NO PDF LOCAL GERADO ---');
console.log("Contém 'Santos & Duracenski'?", str.includes('Santos & Duracenski'));
console.log("Contém '12.345.678/0001-90'?", str.includes('12.345.678/0001-90'));
console.log("Contém 'Rosângela'?", str.includes('Rosângela') || str.includes('Rosngela') || str.includes('Rosangela'));
console.log("Contém '3.500'?", str.includes('3.500,00'));
console.log("Contém '3.800' (original)?", str.includes('3.800,00'));
console.log("Contém '300' (desconto)?", str.includes('300,00'));
console.log("Contém 'Nu Pagamentos'?", str.includes('Nu Pagamentos'));
console.log("Contém 'PARCELA'?", str.includes('PARCELA'));
console.log("Contém '10/12/2026'?", str.includes('10/12/2026'));
console.log("Contém '10/01/2027'?", str.includes('10/01/2027'));
console.log("Contém 'A combinar'?", /a\s+combinar/i.test(str));
console.log("Contém 'A definir'?", /a\s+definir/i.test(str));

