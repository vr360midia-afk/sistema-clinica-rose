import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';

async function main() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const artifactDir = 'C:\\Users\\Jhonatha\\.gemini\\antigravity\\brain\\4923da1a-4a97-47ad-b222-c804420cf9c3';
  const pdfPath = path.join(artifactDir, 'contrato-ficticio-novo-servidor.pdf');

  const pdfBase64 = fs.readFileSync(pdfPath).toString('base64');

  const htmlContent = `<!DOCTYPE html>
  <html>
  <head>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
    <style>
      body { margin: 0; background: #333; display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 20px; }
      canvas { box-shadow: 0 4px 10px rgba(0,0,0,0.3); background: white; }
    </style>
  </head>
  <body>
    <div id="container"></div>
    <script>
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const pdfData = atob("${pdfBase64}");
      const uint8Array = new Uint8Array(pdfData.length);
      for (let i = 0; i < pdfData.length; i++) {
        uint8Array[i] = pdfData.charCodeAt(i);
      }

      window.pagesRendered = false;

      async function renderAll() {
        const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
        const pdf = await loadingTask.promise;
        const container = document.getElementById('container');
        
        for (let num = 1; num <= pdf.numPages; num++) {
          const page = await pdf.getPage(num);
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          canvas.id = 'page-' + num;
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          container.appendChild(canvas);

          const context = canvas.getContext('2d');
          await page.render({ canvasContext: context, viewport: viewport }).promise;
        }
        window.pagesRendered = true;
      }
      renderAll().catch(e => console.error(e));
    </script>
  </body>
  </html>`;

  const htmlFile = path.join(artifactDir, 'pdf-viewer.html');
  fs.writeFileSync(htmlFile, htmlContent, 'utf-8');

  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 2000 });
  await page.goto(`file:///${htmlFile.replace(/\\/g, '/')}`, { waitUntil: 'load' });

  await page.waitForFunction('window.pagesRendered === true', { timeout: 30000 });

  // Capturar cada página
  const canvasElements = await page.$$('canvas');
  console.log(`Encontradas ${canvasElements.length} páginas para captura.`);

  for (let i = 0; i < canvasElements.length; i++) {
    const shotPath = path.join(artifactDir, `evidencia-pdf-servidor-pagina-${i + 1}.png`);
    await canvasElements[i].screenshot({ path: shotPath });
    console.log(`Página ${i + 1} salva em ${shotPath}`);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
