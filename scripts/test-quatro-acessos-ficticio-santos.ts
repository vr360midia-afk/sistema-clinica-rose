import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const HOMOLOG_URL = "https://fsroaymkuopapwlnknhl.supabase.co";
const HOMOLOG_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzcm9heW1rdW9wYXB3bG5rbmhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTUwMDQ3MywiZXhwIjoyMTA3MDc2NDczfQ.p74EmozEkxHV8-etstzxKeeOXpWKdP1ZSlpjwkuwc6I";
const HOMOLOG_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzcm9heW1rdW9wYXB3bG5rbmhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MDA0NzMsImV4cCI6MjEwNzA3NjQ3M30.QV06zSi8oKTBz2s4x6oyHCWf_i0o8Gdu-obiE7SBOWA";

const supabase = createClient(HOMOLOG_URL, HOMOLOG_SERVICE_KEY, {
  auth: { persistSession: false },
});

const contratoId = "CTR-SANTOS-134659";
const token = "token_santos_1793848134659";

function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex").toUpperCase();
}

async function main() {
  console.log(`=== AUDITORIA CRIPTOGRÁFICA DOS 4 ACESSOS PARA O CONTRATO FICTÍCIO: ${contratoId} ===\n`);

  const canonicalPath = `contratos/${contratoId}/Contrato_Assinado_${contratoId}.pdf`;

  // 0. Storage Direto
  const { data: storageBlob, error: stErr } = await supabase.storage.from("documentos-pacientes").download(canonicalPath);
  if (stErr || !storageBlob) throw new Error("Erro download storage: " + JSON.stringify(stErr));
  const storageBuf = Buffer.from(await storageBlob.arrayBuffer());
  const hashStorage = sha256(storageBuf);
  console.log(`[0] Storage Oficial: ${hashStorage} (${storageBuf.length} bytes)`);

  // 1. Abrir como Paciente (via Edge Function get_pdf_signed_url / get)
  const edgeRes = await fetch(`${HOMOLOG_URL}/functions/v1/contrato-publico`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${HOMOLOG_ANON_KEY}` },
    body: JSON.stringify({ action: "get_pdf_signed_url", id: contratoId, token }),
  });
  const edgeData = await edgeRes.json();
  const urlPac = edgeData.signedUrl;
  const pacHttp = await fetch(urlPac);
  const pacBuf = Buffer.from(await pacHttp.arrayBuffer());
  const hashPac = sha256(pacBuf);
  console.log(`[1] Abrir como Paciente: ${hashPac} (${pacBuf.length} bytes)`);

  // 2. Ver Contrato Assinado (via Storage createSignedUrl do prontuário)
  const { data: s2Data } = await supabase.storage.from("documentos-pacientes").createSignedUrl(canonicalPath, 300);
  const s2Http = await fetch(s2Data!.signedUrl);
  const s2Buf = Buffer.from(await s2Http.arrayBuffer());
  const hashVer = sha256(s2Buf);
  console.log(`[2] Ver Contrato Assinado: ${hashVer} (${s2Buf.length} bytes)`);

  // 3. Baixar PDF Assinado
  const { data: s3Blob } = await supabase.storage.from("documentos-pacientes").download(canonicalPath);
  const s3Buf = Buffer.from(await s3Blob!.arrayBuffer());
  const hashBaixar = sha256(s3Buf);
  console.log(`[3] Baixar PDF Assinado: ${hashBaixar} (${s3Buf.length} bytes)`);

  // 4. Documentos do Paciente
  const { data: dpRow } = await supabase.from("documentos_paciente").select("*").ilike("url", `%${contratoId}%`).single();
  const { data: s4Blob } = await supabase.storage.from("documentos-pacientes").download(dpRow.url);
  const s4Buf = Buffer.from(await s4Blob!.arrayBuffer());
  const hashDocPac = sha256(s4Buf);
  console.log(`[4] Documentos do Paciente: ${hashDocPac} (${s4Buf.length} bytes)`);

  console.log("\n--- RESULTADO DA IDENTIDADE SHA-256 ---");
  const identical = (hashStorage === hashPac) && (hashPac === hashVer) && (hashVer === hashBaixar) && (hashBaixar === hashDocPac);
  console.log(`Todos os 4 acessos retornam o mesmo SHA-256: ${identical ? "SIM (100% IDÊNTICO)" : "NÃO (DIVERGENTE)"}`);
}

main().catch(console.error);

