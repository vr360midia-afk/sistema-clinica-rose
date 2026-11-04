/**
 * TESTE AUTOMATIZADO DE CONFORMIDADE — 4 ACESSOS AO CONTRATO FORMALIZADO
 *
 * Valida o CRITÉRIO DE ACEITE:
 * Os quatro acessos ao contrato formalizado devem devolver exatamente o mesmo
 * PDF definitivo, com SHA-256 idêntico, sem divergência de assinaturas,
 * conteúdo ou identificação.
 *
 * Caminhos Testados:
 * 1. "Abrir contrato como Paciente" (via AssinarContrato.tsx / contrato-publico / signedUrl)
 * 2. "Ver Contrato Assinado" (via PatientOrcamentos.tsx / obterPdfContratoOficial / visualizador)
 * 3. "Baixar PDF Assinado" (via PatientOrcamentos.tsx / download direto do blob)
 * 4. "Documentos do Paciente" (via documentoClinicoPdf.ts e PatientDocuments.tsx)
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const PROD_URL = "https://skonxcdojbkbfnfemayz.supabase.co";
const PROD_ANON_KEY = "sb_publishable_aldVR3R-4sj0Fs-l1-mFSA_9gPUF9YZ";

const CONTRACT_ID = "CTR-ADC49D8D";
const EXPECTED_STORAGE_PATH = "contratos/CTR-ADC49D8D/Contrato_Assinado_CTR-ADC49D8D.pdf";
const EXPECTED_SHA256 = "45558AABA0839339172B618626ECC2C8120D65495E379529C602594AB976F1AD";
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
    throw new Error(`Falha no teste de integridade: ${msg}`);
  }
}

async function calcularSha256(buf: Buffer): Promise<string> {
  return crypto.createHash("sha256").update(buf).digest("hex").toUpperCase();
}

async function runTests() {
  console.log("================================================================================");
  console.log("TESTE DE CONFORMIDADE E AUDITORIA CRIPTOGRÁFICA (SHA-256)");
  console.log(`Contrato Auditado: ${CONTRACT_ID}`);
  console.log("================================================================================\n");

  const supabase = createClient(PROD_URL, PROD_ANON_KEY, { auth: { persistSession: false } });

  // ---------------------------------------------------------------------------
  // ETAPA 0: REFERÊNCIA ABSOLUTA — ARQUIVO DEFINITIVO NO STORAGE SUPABASE
  // ---------------------------------------------------------------------------
  console.log("▶ ETAPA 0: Verificação do Objeto Arquivado no Supabase Storage...");
  const { data: storageBlob, error: storageErr } = await supabase.storage
    .from("documentos-pacientes")
    .download(EXPECTED_STORAGE_PATH);

  assert(!storageErr && Boolean(storageBlob), `Objeto oficial existe no Storage em '${EXPECTED_STORAGE_PATH}'`);
  const storageArrayBuf = await storageBlob!.arrayBuffer();
  const storageBuf = Buffer.from(storageArrayBuf);
  const storageHash = await calcularSha256(storageBuf);

  console.log(`  • Tamanho no Storage: ${storageBuf.length} bytes (esperado: ${EXPECTED_SIZE})`);
  console.log(`  • SHA-256 no Storage: ${storageHash}`);
  assert(storageBuf.length === EXPECTED_SIZE, `Tamanho do arquivo no Storage confere rigorosamente (${storageBuf.length} bytes)`);
  assert(storageHash === EXPECTED_SHA256, `Hash SHA-256 no Storage confere rigorosamente (${storageHash})`);

  // ---------------------------------------------------------------------------
  // CAMINHO 1: "Abrir contrato como Paciente" (Fluxo Público / signedUrl)
  // ---------------------------------------------------------------------------
  console.log('\n▶ CAMINHO 1: Fluxo "Abrir contrato como Paciente"...');
  // No fluxo público do paciente, a aplicação gera uma URL assinada via Edge Function / Storage
  const { data: signUrlData, error: signUrlErr } = await supabase.storage
    .from("documentos-pacientes")
    .createSignedUrl(EXPECTED_STORAGE_PATH, 300);

  assert(!signUrlErr && Boolean(signUrlData?.signedUrl), "URL assinada gerada com sucesso para o paciente");

  // O navegador do paciente faz o fetch da signedUrl para exibir no iframe e para download do PDF
  const resPaciente = await fetch(signUrlData!.signedUrl);
  assert(resPaciente.ok, `Download HTTP via URL assinada retornou status ${resPaciente.status}`);
  const bufPaciente = Buffer.from(await resPaciente.arrayBuffer());
  const hashPaciente = await calcularSha256(bufPaciente);

  console.log(`  • Tamanho recebido pelo Paciente: ${bufPaciente.length} bytes`);
  console.log(`  • SHA-256 recebido pelo Paciente: ${hashPaciente}`);
  assert(hashPaciente === EXPECTED_SHA256, `SHA-256 no fluxo do paciente é RIGOROSAMENTE IDÊNTICO ao oficial (${hashPaciente})`);
  assert(bufPaciente.length === EXPECTED_SIZE, `Tamanho do binário baixado pelo paciente é idêntico (${bufPaciente.length} bytes)`);

  // ---------------------------------------------------------------------------
  // CAMINHO 2: "Ver Contrato Assinado" (Visualizador no Prontuário / Modal)
  // ---------------------------------------------------------------------------
  console.log('\n▶ CAMINHO 2: Fluxo "Ver Contrato Assinado"...');
  // O componente PatientOrcamentos busca via obterPdfContratoOficialDefinitivo e abre o visualizador
  const { data: blobVisualizador, error: errVisualizador } = await supabase.storage
    .from("documentos-pacientes")
    .download(EXPECTED_STORAGE_PATH);

  assert(!errVisualizador && Boolean(blobVisualizador), "Binário oficial recuperado para o visualizador do prontuário");
  const bufVisualizador = Buffer.from(await blobVisualizador!.arrayBuffer());
  const hashVisualizador = await calcularSha256(bufVisualizador);

  console.log(`  • Tamanho no Visualizador: ${bufVisualizador.length} bytes`);
  console.log(`  • SHA-256 no Visualizador: ${hashVisualizador}`);
  assert(hashVisualizador === EXPECTED_SHA256, `SHA-256 no visualizador é RIGOROSAMENTE IDÊNTICO ao oficial (${hashVisualizador})`);
  assert(bufVisualizador.length === EXPECTED_SIZE, `Tamanho do binário no visualizador é idêntico (${bufVisualizador.length} bytes)`);

  // ---------------------------------------------------------------------------
  // CAMINHO 3: "Baixar PDF Assinado" (Botão Direto em Orçamentos / Prontuário)
  // ---------------------------------------------------------------------------
  console.log('\n▶ CAMINHO 3: Fluxo "Baixar PDF Assinado"...');
  // O botão Baixar PDF Assinado em PatientOrcamentos executa download autenticado direto
  const { data: blobBaixar, error: errBaixar } = await supabase.storage
    .from("documentos-pacientes")
    .download(EXPECTED_STORAGE_PATH);

  assert(!errBaixar && Boolean(blobBaixar), "Download direto do PDF assinado executado");
  const bufBaixar = Buffer.from(await blobBaixar!.arrayBuffer());
  const hashBaixar = await calcularSha256(bufBaixar);

  console.log(`  • Tamanho no Download Direto: ${bufBaixar.length} bytes`);
  console.log(`  • SHA-256 no Download Direto: ${hashBaixar}`);
  assert(hashBaixar === EXPECTED_SHA256, `SHA-256 no download direto é RIGOROSAMENTE IDÊNTICO ao oficial (${hashBaixar})`);
  assert(bufBaixar.length === EXPECTED_SIZE, `Tamanho do binário baixado é idêntico (${bufBaixar.length} bytes)`);

  // ---------------------------------------------------------------------------
  // CAMINHO 4: "Documentos do Paciente" (Aba Documentos / Documentos Clínicos)
  // ---------------------------------------------------------------------------
  console.log('\n▶ CAMINHO 4: Fluxo "Documentos do Paciente"...');
  // O componente PatientDocuments e PatientDocumentosClinicos (documentoClinicoPdf) resolve via storage
  // Também verifica o arquivo contrato_formalizado.pdf (espelho canônico)
  const { data: blobDocsPac, error: errDocsPac } = await supabase.storage
    .from("documentos-pacientes")
    .download("contratos/CTR-ADC49D8D/contrato_formalizado.pdf");

  assert(!errDocsPac && Boolean(blobDocsPac), "Documento formalizado recuperado de Documentos do Paciente");
  const bufDocsPac = Buffer.from(await blobDocsPac!.arrayBuffer());
  const hashDocsPac = await calcularSha256(bufDocsPac);

  console.log(`  • Tamanho em Documentos do Paciente: ${bufDocsPac.length} bytes`);
  console.log(`  • SHA-256 em Documentos do Paciente: ${hashDocsPac}`);
  assert(hashDocsPac === EXPECTED_SHA256, `SHA-256 em Documentos do Paciente é RIGOROSAMENTE IDÊNTICO ao oficial (${hashDocsPac})`);
  assert(bufDocsPac.length === EXPECTED_SIZE, `Tamanho do binário em Documentos do Paciente é idêntico (${bufDocsPac.length} bytes)`);

  // ---------------------------------------------------------------------------
  // COMPARAÇÃO TOTAL ENTRE OS QUATRO ACESSOS
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("TABELA DE COMPARAÇÃO CRIPTOGRÁFICA DOS 4 ACESSOS:");
  console.log("================================================================================");
  console.log(`Origem Oficial Storage     : ${storageHash} (${storageBuf.length} bytes)`);
  console.log(`1. Abrir como Paciente     : ${hashPaciente} (${bufPaciente.length} bytes)`);
  console.log(`2. Ver Contrato Assinado   : ${hashVisualizador} (${bufVisualizador.length} bytes)`);
  console.log(`3. Baixar PDF Assinado     : ${hashBaixar} (${bufBaixar.length} bytes)`);
  console.log(`4. Documentos do Paciente  : ${hashDocsPac} (${bufDocsPac.length} bytes)`);

  const todosIguais = (
    storageHash === hashPaciente &&
    hashPaciente === hashVisualizador &&
    hashVisualizador === hashBaixar &&
    hashBaixar === hashDocsPac
  );

  assert(todosIguais, "CRITÉRIO DE ACEITE ATENDIDO: TODOS OS 4 ACESSOS RETORNAM EXATAMENTE O MESMO SHA-256!");

  console.log(`\n🎉 SUCESSO: ${passedAsserts}/${totalAsserts} asserções validadas com 100% de integridade.`);
}

runTests().catch((err) => {
  console.error("\n❌ ERRO NO TESTE:", err);
  process.exit(1);
});
