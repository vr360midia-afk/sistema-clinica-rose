import path from 'node:path';
import puppeteer from 'puppeteer-core';

async function captureSections() {
  const artifactDir = 'C:\\Users\\Jhonatha\\.gemini\\antigravity\\brain\\4923da1a-4a97-47ad-b222-c804420cf9c3';
  const htmlPath = path.join(artifactDir, 'previa-contrato-ficticio.html');

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 1400, deviceScaleFactor: 2 });
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

  // 1. Cabeçalho e Qualificação da Contratada PJ
  const preambuloEl = await page.$('.clausula-bloco');
  if (preambuloEl) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(artifactDir, 'previa-contratada-pj-qualificacao.png'),
      clip: { x: 0, y: 0, width: 1000, height: 600 },
    });
  }

  // 2. Seção Financeira e Quadro PIX Bacen + Cronograma
  const boxPix = await page.$('.box-pix');
  if (boxPix) {
    const box = await boxPix.boundingBox();
    if (box) {
      await page.screenshot({
        path: path.join(artifactDir, 'previa-pagamento-quadro-pix-bacen.png'),
        clip: {
          x: Math.max(0, box.x - 20),
          y: Math.max(0, box.y - 120),
          width: Math.min(1000, box.width + 40),
          height: 720,
        },
      });
    }
  }

  // 3. Tabela de Cronograma Financeiro
  const tabelaEl = await page.$('.tabela-dados');
  if (tabelaEl) {
    const tables = await page.$$('.tabela-dados');
    if (tables.length > 1) {
      const boxTabela = await tables[1].boundingBox();
      if (boxTabela) {
        await page.screenshot({
          path: path.join(artifactDir, 'previa-cronograma-tabela-parcelas.png'),
          clip: {
            x: Math.max(0, boxTabela.x - 20),
            y: Math.max(0, boxTabela.y - 50),
            width: Math.min(1000, boxTabela.width + 40),
            height: Math.min(700, boxTabela.height + 100),
          },
        });
      }
    }
  }

  await browser.close();
  console.log('Seções capturadas com sucesso!');
}

captureSections().catch((e) => {
  console.error(e);
  process.exit(1);
});
