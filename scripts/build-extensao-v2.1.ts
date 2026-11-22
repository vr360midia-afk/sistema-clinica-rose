import * as fs from 'fs';
import { execSync } from 'child_process';
import * as path from 'path';

async function main() {
  console.log('=== GERANDO PACOTE OFICIAL V2.1 DA EXTENSÃO (WHATSAPP CRM & AGENDA) ===');

  const srcDir = 'chrome-extension/whatsapp-crm-rose';
  const stageDir = 'packages/stage-extensao-prod-v2.1';
  const outDir = 'packages';
  const zipPath = path.join(outDir, 'Extensao_Clinica_Rosangela_PRODUCAO_V2.1.zip');
  const rootZip = 'Extensao_Clinica_Rosangela_PRODUCAO_V2.1.zip';
  const artifactDir = 'C:\\Users\\Jhonatha\\.gemini\\antigravity\\brain\\e4fa5fc2-ce17-428d-9cae-4375cfbddb7d';
  const artifactZip = path.join(artifactDir, 'Extensao_Clinica_Rosangela_PRODUCAO_V2.1.zip');

  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(artifactDir, { recursive: true });
  if (fs.existsSync(stageDir)) {
    fs.rmSync(stageDir, { recursive: true, force: true });
  }

  // Copia arquivos para o staging
  fs.cpSync(srcDir, stageDir, { recursive: true });

  // Garante DEFAULT_ENV para 'production' em panel.js
  const panelPath = path.join(stageDir, 'panel.js');
  let panelCode = fs.readFileSync(panelPath, 'utf-8');
  panelCode = panelCode.replace("DEFAULT_ENV: 'homolog'", "DEFAULT_ENV: 'production'");
  fs.writeFileSync(panelPath, panelCode);

  // Validação estrita: confirma que o bundle de produção aponta para skonxcd...
  if (!panelCode.includes("DEFAULT_ENV: 'production'")) {
    throw new Error('Falha ao alternar DEFAULT_ENV para production.');
  }

  // Comprime o pacote
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  const cmd = `powershell -Command "Compress-Archive -Path '${stageDir}/*' -DestinationPath '${zipPath}' -Force"`;
  execSync(cmd);

  // Copia para a raiz do projeto e para os artefatos
  fs.copyFileSync(zipPath, rootZip);
  fs.copyFileSync(zipPath, artifactZip);

  // Remove zip antigo e obsoleto da raiz para evitar confusão
  const oldRootZip = 'Extensao_Clinica_Rosangela_Login_V2.zip';
  if (fs.existsSync(oldRootZip)) {
    fs.unlinkSync(oldRootZip);
    console.log(`🗑️ Pacote legado ${oldRootZip} removido da raiz para evitar ambiguidade.`);
  }

  // Limpa staging
  fs.rmSync(stageDir, { recursive: true, force: true });

  const stats = fs.statSync(zipPath);
  console.log(`✅ Pacote V2.1 gerado com sucesso: ${zipPath} (${stats.size} bytes)`);
  console.log(`✅ Cópia para artefatos gerada em: ${artifactZip}`);
}

main().catch(console.error);

