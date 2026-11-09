import * as fs from 'fs';
import { execSync } from 'child_process';
import * as path from 'path';

async function main() {
  console.log('=== GERANDO PACOTE PRÉ-PRODUÇÃO DA EXTENSÃO (NÃO DISTRIBUIR) ===');

  const srcDir = 'chrome-extension/whatsapp-crm-rose';
  const stageDir = 'packages/stage-extensao-prod';
  const outDir = 'packages';
  const zipPath = path.join(outDir, 'Extensao_Clinica_Rosangela_PRODUCAO_V2.zip');

  fs.mkdirSync(outDir, { recursive: true });
  if (fs.existsSync(stageDir)) {
    fs.rmSync(stageDir, { recursive: true, force: true });
  }

  // Copia arquivos para o staging
  fs.cpSync(srcDir, stageDir, { recursive: true });

  // Ajusta DEFAULT_ENV para 'production' em panel.js
  const panelPath = path.join(stageDir, 'panel.js');
  let panelCode = fs.readFileSync(panelPath, 'utf-8');
  panelCode = panelCode.replace("DEFAULT_ENV: 'homolog'", "DEFAULT_ENV: 'production'");
  fs.writeFileSync(panelPath, panelCode);

  // Validação: confirma que o bundle de produção aponta para сконxcd...
  if (!panelCode.includes("DEFAULT_ENV: 'production'")) {
    throw new Error('Falha ao alternar DEFAULT_ENV para production.');
  }

  // Comprime o pacote
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  const cmd = `powershell -Command "Compress-Archive -Path '${stageDir}/*' -DestinationPath '${zipPath}' -Force"`;
  execSync(cmd);

  // Limpa staging
  fs.rmSync(stageDir, { recursive: true, force: true });

  const stats = fs.statSync(zipPath);
  console.log(`✅ Pacote de produção gerado com sucesso: ${zipPath} (${stats.size} bytes)`);
  console.log('⚠️  AVISO DE SEGURANÇA: Este pacote NÃO DEVE ser distribuído até a autorização formal de deploy.');
}

main().catch(console.error);
