import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';

async function main() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const artifactDir = 'C:\\Users\\Jhonatha\\.gemini\\antigravity\\brain\\4923da1a-4a97-47ad-b222-c804420cf9c3';
  const htmlFile = path.join(artifactDir, 'pdf-viewer.html');

  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 2600 });
  await page.goto(`file:///${htmlFile.replace(/\\/g, '/')}`, { waitUntil: 'load' });
  await page.waitForFunction('window.pagesRendered === true', { timeout: 30000 });

  const canvas1 = await page.$('#page-1');
  if (canvas1) {
    const box1 = await canvas1.boundingBox();
    if (box1) {
      // 1. Cabeçalho + Qualificação Contratada PJ Santos & Duracenski
      await page.screenshot({
        path: path.join(artifactDir, 'evidencia-pdf-servidor-contratada-pj.png'),
        clip: {
          x: box1.x,
          y: box1.y,
          width: box1.width,
          height: 480,
        },
      });

      // 2. Cronograma Financeiro + Quadro PIX com QR Code
      await page.screenshot({
        path: path.join(artifactDir, 'evidencia-pdf-servidor-financeiro-pix-qrcode.png'),
        clip: {
          x: box1.x,
          y: box1.y + 490,
          width: box1.width,
          height: 580,
        },
      });
    }
  }

  const canvas2 = await page.$('#page-2');
  if (canvas2) {
    const box2 = await canvas2.boundingBox();
    if (box2) {
      // 3. Seção de Assinaturas Eletrônicas Bilaterais
      await page.screenshot({
        path: path.join(artifactDir, 'evidencia-pdf-servidor-assinaturas-bilaterais.png'),
        clip: {
          x: box2.x,
          y: box2.y + 180,
          width: box2.width,
          height: 480,
        },
      });
    }
  }

  await browser.close();
  console.log('Seções capturadas com sucesso!');
}

main().catch(console.error);

