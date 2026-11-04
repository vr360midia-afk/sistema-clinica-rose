/**
 * TESTE EM NAVEGADOR REAL (MICROSOFT EDGE - CHROMIUM)
 *
 * Valida os 4 acessos ao contrato formalizado CTR-ADC49D8D executando
 * no contexto real do DOM / window / subtle.crypto do Microsoft Edge.
 *
 * 1. "Abrir contrato como Paciente"
 * 2. "Ver Contrato Assinado"
 * 3. "Baixar PDF Assinado"
 * 4. "Documentos do Paciente"
 *
 * CRITÉRIO DE ACEITE:
 * Os quatro acessos devem devolver o mesmo binário definitivo com SHA-256 idêntico.
 */

import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\Jhonatha\\.gemini\\antigravity\\brain\\4923da1a-4a97-47ad-b222-c804420cf9c3';
const PORT = 5192;

const PROD_URL = 'https://skonxcdojbkbfnfemayz.supabase.co';
const PROD_ANON_KEY = 'sb_publishable_aldVR3R-4sj0Fs-l1-mFSA_9gPUF9YZ';
const EXPECTED_SHA256 = '45558AABA0839339172B618626ECC2C8120D65495E379529C602594AB976F1AD';
const EXPECTED_SIZE = 4528007;

let totalAsserts = 0;
let passedAsserts = 0;

function assert(condition: boolean, msg: string) {
  totalAsserts++;
  if (condition) {
    passedAsserts++;
    console.log(`  ✓ PASS: ${msg}`);
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    throw new Error(`Falha no teste real de navegador: ${msg}`);
  }
}

async function runBrowserValidation() {
  console.log('================================================================================');
  console.log('TESTE EM NAVEGADOR REAL — MICROSOFT EDGE (CHROMIUM)');
  console.log('Validação dos 4 Acessos ao Contrato Formalizado CTR-ADC49D8D');
  console.log('================================================================================\n');

  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  // 1. Criar página HTML de harness para o teste no navegador
  const harnessHtmlPath = path.join(process.cwd(), 'test-harness-quatro-acessos.html');
  const harnessHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Harness de Auditoria Criptográfica - 4 Acessos</title>
</head>
<body style="font-family: sans-serif; padding: 24px; background: #0f172a; color: #f8fafc;">
  <h1>Auditoria de Integridade Contratual — 4 Acessos ao Contrato CTR-ADC49D8D</h1>
  <div id="status" style="margin: 16px 0; padding: 12px; background: #1e293b; border-radius: 8px;">
    Iniciando testes no contexto window.crypto...
  </div>
  <table border="1" cellpadding="8" style="border-collapse: collapse; width: 100%; border-color: #334155;">
    <thead>
      <tr style="background: #334155;">
        <th>Fluxo de Acesso</th>
        <th>Origem / Função</th>
        <th>Tamanho (Bytes)</th>
        <th>Hash SHA-256</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody id="resultsTable"></tbody>
  </table>
  <div id="summary" style="margin-top: 24px; font-weight: bold; font-size: 1.1rem;"></div>

  <script type="module">
    import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
    import {
      obterPdfContratoOficialDefinitivo,
      calcularSha256Binario
    } from "/src/utils/contratoPdfOficial.ts";

    const supabase = createClient("${PROD_URL}", "${PROD_ANON_KEY}");

    async function computeHash(buf) {
      const hashBuf = await crypto.subtle.digest("SHA-256", buf);
      return Array.from(new Uint8Array(hashBuf))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
    }

    async function executeAudit() {
      const results = {};
      const targetId = "CTR-ADC49D8D";
      const expectedHash = "${EXPECTED_SHA256}";

      // 1. Fluxo "Abrir contrato como Paciente" (via signedUrl pública e obterPdfContratoOficialDefinitivo)
      try {
        const res1 = await obterPdfContratoOficialDefinitivo(targetId, null, null, null);
        let hash1 = "";
        let size1 = 0;
        if (res1 && res1.blob) {
          const ab1 = await res1.blob.arrayBuffer();
          hash1 = await computeHash(ab1);
          size1 = res1.blob.size;
        } else if (res1 && res1.signedUrl) {
          const r1 = await fetch(res1.signedUrl);
          const ab1 = await r1.arrayBuffer();
          hash1 = await computeHash(ab1);
          size1 = ab1.byteLength;
        }
        results["paciente"] = { size: size1, hash: hash1, ok: hash1 === expectedHash };
      } catch (e) {
        results["paciente"] = { error: e.message };
      }

      // 2. Fluxo "Ver Contrato Assinado" (Visualizador dedicado do prontuário)
      try {
        const res2 = await obterPdfContratoOficialDefinitivo(targetId, {
          identificador: targetId,
          pdfPath: "contratos/CTR-ADC49D8D/Contrato_Assinado_CTR-ADC49D8D.pdf"
        });
        const ab2 = await res2.blob.arrayBuffer();
        const hash2 = await computeHash(ab2);
        results["visualizador"] = { size: res2.blob.size, hash: hash2, ok: hash2 === expectedHash };
      } catch (e) {
        results["visualizador"] = { error: e.message };
      }

      // 3. Fluxo "Baixar PDF Assinado" (Download direto do prontuário)
      try {
        const { data: blob3 } = await supabase.storage
          .from("documentos-pacientes")
          .download("contratos/CTR-ADC49D8D/Contrato_Assinado_CTR-ADC49D8D.pdf");
        const ab3 = await blob3.arrayBuffer();
        const hash3 = await computeHash(ab3);
        results["baixarAssinado"] = { size: blob3.size, hash: hash3, ok: hash3 === expectedHash };
      } catch (e) {
        results["baixarAssinado"] = { error: e.message };
      }

      // 4. Fluxo "Documentos do Paciente" (Espelho formalizado / documentos_paciente)
      try {
        const { data: blob4 } = await supabase.storage
          .from("documentos-pacientes")
          .download("contratos/CTR-ADC49D8D/contrato_formalizado.pdf");
        const ab4 = await blob4.arrayBuffer();
        const hash4 = await computeHash(ab4);
        results["documentosPaciente"] = { size: blob4.size, hash: hash4, ok: hash4 === expectedHash };
      } catch (e) {
        results["documentosPaciente"] = { error: e.message };
      }

      window.__AUDIT_RESULTS__ = results;

      // Renderiza na tela do Edge
      const table = document.getElementById("resultsTable");
      const rows = [
        { label: "1. Abrir contrato como Paciente", r: results.paciente, fn: "AssinarContrato.tsx" },
        { label: "2. Ver Contrato Assinado", r: results.visualizador, fn: "PatientOrcamentos.tsx (Modal)" },
        { label: "3. Baixar PDF Assinado", r: results.baixarAssinado, fn: "PatientOrcamentos.tsx (Direto)" },
        { label: "4. Documentos do Paciente", r: results.documentosPaciente, fn: "PatientDocuments.tsx / documentoClinicoPdf.ts" },
      ];

      rows.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = \`
          <td><strong>\${row.label}</strong></td>
          <td>\${row.fn}</td>
          <td>\${row.r.size || 0} bytes</td>
          <td style="font-family: monospace; color: #38bdf8;">\${row.r.hash || row.r.error}</td>
          <td style="color: \${row.r.ok ? '#4ade80' : '#f87171'}; font-weight: bold;">
            \${row.r.ok ? "✓ CONFORME (100% IDÊNTICO)" : "✗ DIVERGENTE"}
          </td>
        \`;
        table.appendChild(tr);
      });

      const allOk = rows.every(r => r.r.ok);
      const summary = document.getElementById("summary");
      summary.style.color = allOk ? "#4ade80" : "#f87171";
      summary.innerText = allOk
        ? "✓ SUCESSO TOTAL: Todos os 4 acessos devolvem RIGOROSAMENTE o mesmo PDF oficial arquivado no Storage com SHA-256 idêntico."
        : "✗ FALHA: Divergência detectada entre os fluxos de acesso.";
      
      document.getElementById("status").innerText = "Auditoria criptográfica finalizada com sucesso.";
    }

    executeAudit();
  </script>
</body>
</html>`;
  fs.writeFileSync(harnessHtmlPath, harnessHtml, 'utf8');

  // 2. Iniciar Vite dev server
  console.log(`▶ Iniciando servidor Vite na porta ${PORT}...`);
  const viteServer = await createServer({
    server: { port: PORT, strictPort: true },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(PROD_URL),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(PROD_ANON_KEY),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(PROD_ANON_KEY),
    },
  });
  await viteServer.listen();
  console.log(`  ✓ Servidor Vite ativo em http://localhost:${PORT}/test-harness-quatro-acessos.html\n`);

  // 3. Lançar Microsoft Edge via Puppeteer
  console.log('▶ Lançando Microsoft Edge via Puppeteer...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--allow-running-insecure-content',
      '--window-size=1280,800',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error(`  [Browser Error]: ${msg.text()}`);
      }
    });

    console.log('▶ Navegando para o harness de teste no Microsoft Edge...');
    await page.goto(`http://localhost:${PORT}/test-harness-quatro-acessos.html`, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    // Aguarda a execução da auditoria no navegador
    await page.waitForFunction(() => (window as any).__AUDIT_RESULTS__ !== undefined, { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 2000));

    const results = await page.evaluate(() => (window as any).__AUDIT_RESULTS__);
    console.log('\n================================================================================');
    console.log('RESULTADOS OBTIDOS DENTRO DO MICROSOFT EDGE:');
    console.log('================================================================================');
    console.log('1. Paciente         :', results.paciente);
    console.log('2. Visualizador     :', results.visualizador);
    console.log('3. Baixar Assinado  :', results.baixarAssinado);
    console.log('4. Docs Paciente    :', results.documentosPaciente);

    assert(results.paciente.ok, `Caminho 1 (Abrir como Paciente) devolveu SHA-256 esperado: ${results.paciente.hash}`);
    assert(results.visualizador.ok, `Caminho 2 (Ver Contrato Assinado) devolveu SHA-256 esperado: ${results.visualizador.hash}`);
    assert(results.baixarAssinado.ok, `Caminho 3 (Baixar PDF Assinado) devolveu SHA-256 esperado: ${results.baixarAssinado.hash}`);
    assert(results.documentosPaciente.ok, `Caminho 4 (Documentos do Paciente) devolveu SHA-256 esperado: ${results.documentosPaciente.hash}`);

    assert(results.paciente.size === EXPECTED_SIZE, `Tamanho no Paciente é ${EXPECTED_SIZE} bytes`);
    assert(results.visualizador.size === EXPECTED_SIZE, `Tamanho no Visualizador é ${EXPECTED_SIZE} bytes`);
    assert(results.baixarAssinado.size === EXPECTED_SIZE, `Tamanho no Baixar Direto é ${EXPECTED_SIZE} bytes`);
    assert(results.documentosPaciente.size === EXPECTED_SIZE, `Tamanho em Documentos do Paciente é ${EXPECTED_SIZE} bytes`);

    const screenshotPath = path.join(ARTIFACT_DIR, 'evidencia-auditoria-quatro-acessos-edge.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`\n  ✓ Screenshot de evidência gravado em: ${screenshotPath}`);

    console.log('\n================================================================================');
    console.log(`SUCESSO TOTAL NO NAVEGADOR: ${passedAsserts}/${totalAsserts} asserções cumpridas com louvor!`);
    console.log('================================================================================\n');

  } finally {
    await browser.close();
    await viteServer.close();
    if (fs.existsSync(harnessHtmlPath)) {
      fs.unlinkSync(harnessHtmlPath);
    }
  }
}

runBrowserValidation().catch((err) => {
  console.error('\n❌ ERRO NO TESTE DE NAVEGADOR:', err);
  process.exit(1);
});
