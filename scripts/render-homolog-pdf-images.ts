import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';

async function main() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const artifactDir = 'C:\\Users\\Jhonatha\\.gemini\\antigravity\\brain\\4923da1a-4a97-47ad-b222-c804420cf9c3';
  const pdfPath = path.join(artifactDir, 'contrato-homolog-prontuario-CTR-ORC-PRON.pdf');
  const pdfBase64 = fs.readFileSync(pdfPath).toString('base64');

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    body { margin: 0; background: #1e293b; display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 20px; }
    canvas { box-shadow: 0 10px 25px rgba(0,0,0,0.5); background: white; border-radius: 4px; }
  </style>
</head>
<body>
  <div id="container"></div>
  <script>
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdfData = atob("${pdfBase64}");
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    loadingTask.promise.then(async (pdf) => {
      const container = document.getElementById('container');
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const scale = 2.0;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.id = 'page-' + pageNum;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        container.appendChild(canvas);
        const context = canvas.getContext('2d');
        await page.render({ canvasContext: context, viewport }).promise;
      }
      window.pagesRendered = true;
    });
  </script>
</body>
</html>`;

  const htmlViewerPath = path.join(artifactDir, 'viewer-homolog-prontuario.html');
  fs.writeFileSync(htmlViewerPath, htmlContent);

  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 3200 });
  await page.goto(`file:///${htmlViewerPath.replace(/\\/g, '/')}`, { waitUntil: 'load' });
  await page.waitForFunction('window.pagesRendered === true', { timeout: 30000 });

  // Capturar Página 1 inteira
  const canvas1 = await page.$('#page-1');
  if (canvas1) {
    await canvas1.screenshot({
      path: path.join(artifactDir, 'evidencia-homolog-prontuario-pagina-1.png'),
    });
    console.log('✓ Página 1 salva em: evidencia-homolog-prontuario-pagina-1.png');

    // Zoom no preâmbulo da Contratada PJ
    const box1 = await canvas1.boundingBox();
    if (box1) {
      await page.screenshot({
        path: path.join(artifactDir, 'evidencia-homolog-prontuario-contratada-pj.png'),
        clip: {
          x: box1.x,
          y: box1.y,
          width: box1.width,
          height: 480,
        },
      });
      console.log('✓ Zoom Contratada PJ salvo em: evidencia-homolog-prontuario-contratada-pj.png');
    }
  }

  // Capturar Página 2 (seção de pagamento, tabela de parcelas, QR Code PIX e assinaturas)
  const canvas2 = await page.$('#page-2');
  if (canvas2) {
    await canvas2.screenshot({
      path: path.join(artifactDir, 'evidencia-homolog-prontuario-pagina-2.png'),
    });
    console.log('✓ Página 2 salva em: evidencia-homolog-prontuario-pagina-2.png');

    const box2 = await canvas2.boundingBox();
    if (box2) {
      // Zoom no cronograma financeiro e PIX
      await page.screenshot({
        path: path.join(artifactDir, 'evidencia-homolog-prontuario-cronograma-pix.png'),
        clip: {
          x: box2.x,
          y: box2.y,
          width: box2.width,
          height: 700,
        },
      });
      console.log('✓ Zoom Cronograma Financeiro e PIX salvo!');
    }
  }

  await browser.close();
  console.log('Capturas concluídas com sucesso!');
}

main().catch(console.error);
