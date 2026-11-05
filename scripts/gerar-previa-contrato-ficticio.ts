import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import {
  mapearDadosContrato,
  gerarHtmlContrato,
} from '../src/utils/contratoEngine';

async function main() {
  const artifactDir = 'C:\\Users\\Jhonatha\\.gemini\\antigravity\\brain\\4923da1a-4a97-47ad-b222-c804420cf9c3';
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  // 1. Dados cadastrados em Configurações → Contrato & PIX
  const configContrato = {
    nomeClinicaContrato: 'ODONTO ROSE SANTOS LTDA',
    cnpjClinicaContrato: '48.912.345/0001-89',
    croResponsavelContrato: '06267-AL',
    dentistaResponsavelContrato: 'Dra. Rosângela Santos Pereira',
    enderecoContrato: 'Av. Dr. Antônio Gomes de Barros, nº 625, Sala 801, Jatiúca, Maceió/AL, CEP 57036-000',
    telefoneContrato: '82988887777',
    emailContrato: 'administrativo@odontorose.com.br',
    cidadeForoContrato: 'Maceió - AL',
    chavePix: '48912345000189',
    tipoChavePix: 'cnpj' as const,
    favorecidoPix: 'ODONTO ROSE SANTOS LTDA',
    cnpjCpfFavorecidoPix: '48.912.345/0001-89',
    bancoPix: 'Banco Inter S.A.',
    instrucoesPix: 'O(A) CONTRATANTE poderá utilizar a câmera do smartphone ou app bancário para leitura do QR Code acima ou copiar o código PIX.',
    multaAtrasoPercentual: 2,
    jurosMoraPercentual: 1,
    clausulaEspecialPadrao: '',
  };

  // 2. Paciente Fictício
  const patientFicticio = {
    id: 'pac-ficticio-001',
    nome: 'Carlos Eduardo Silveira Guimarães',
    cpf: '123.456.789-00',
    rg: '321654 SSP/AL',
    telefone: '82998881234',
    email: 'carlos.eduardo@email.com',
    endereco: 'Rua Engenheiro Mário de Gusmão, 450, Apto 502, Ponta Verde, Maceió/AL, CEP 57035-000',
    dataNascimento: '1988-08-20',
    estadoCivil: 'Casado',
    profissao: 'Arquiteto',
  };

  // 3. Orçamento Aprovado com Condição Escolhida: Entrada via PIX + Saldo em 10x no Cartão
  const orcamentoFicticio = {
    id: 'orc-ficticio-4209',
    titulo: 'Reabilitação Oral Estética e Lentes em Resina',
    pacienteId: 'pac-ficticio-001',
    pacienteNome: 'Carlos Eduardo Silveira Guimarães',
    itens: [
      { nome: 'Facetas em Resina Composta Premium', quantidade: 8, valor: 450, denteOuRegiao: '14 ao 24' },
      { nome: 'Clareamento Dental de Consultório', quantidade: 1, valor: 609 },
    ],
    subtotal: 4209,
    desconto: 0,
    total: 4209,
    atualizadoEm: '2026-11-04T20:00:00.000Z',
    formasPagamento: JSON.stringify({
      versao: 2,
      selecionadaId: 'cond-entrada-cartao',
      condicoes: [
        {
          id: 'cond-entrada-cartao',
          titulo: 'Entrada PIX + Saldo 10x Cartão',
          tipo: 'entrada_saldo',
          valorTotal: 4209,
          valorEntrada: 500,
          metodoEntrada: 'pix',
          dataEntrada: '2026-11-04',
          situacaoEntrada: 'A vencer',
          saldoParcelas: 10,
          saldoMetodo: 'cartao',
          saldoValorParcela: 370.9,
          situacaoSaldo: 'Autorizado',
          diaVencimento: 10,
          descricao: 'Entrada de R$ 500,00 via PIX + Saldo restante em 10x de R$ 370,90 no Cartão de Crédito',
          selecionada: true,
        },
      ],
    }),
  };

  // 4. Mapeia Snapshot
  const snap = mapearDadosContrato({
    patient: patientFicticio,
    orcamento: orcamentoFicticio,
    configuracoesContrato: configContrato,
    transacoes: [],
  });

  // Simula assinatura digital da profissional autorizada
  snap.assinaturaDentista = {
    assinaturaData: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="220" height="60"><text x="10" y="38" font-family="Brush Script MT, cursive" font-size="28" fill="%230f172a">Dra. Rosângela Santos</text></svg>',
    nome: 'Dra. Rosângela Santos Pereira',
    cro: '06267-AL',
    dataHora: new Date().toISOString(),
  };

  const html = gerarHtmlContrato(snap);
  const htmlPath = path.join(artifactDir, 'previa-contrato-ficticio.html');
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('HTML salvo em:', htmlPath);

  // 5. Renderiza PDF e Imagem via Puppeteer Edge
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle0' });

  // PDF
  const pdfPath = path.join(artifactDir, 'previa-contrato-ficticio.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    margin: { top: '12mm', right: '14mm', bottom: '12mm', left: '14mm' },
    printBackground: true,
  });
  console.log('PDF salvo em:', pdfPath);

  // Screenshot Página 1 / Detalhamento da Contratada e Condições
  const imgPath = path.join(artifactDir, 'previa-contrato-ficticio-clausulas.png');
  await page.screenshot({ path: imgPath, fullPage: false });
  console.log('Imagem de prévia salva em:', imgPath);

  await browser.close();
  console.log('\n✔ Prévia gerada com absoluto sucesso!');
}

main().catch((e) => {
  console.error('Erro ao gerar prévia:', e);
  process.exit(1);
});
