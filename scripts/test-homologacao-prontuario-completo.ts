import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { gerarContratoDoOrcamentoAprovado } from "../src/utils/orcamentoEngine";
import { carregarConfiguracoesContratoSync } from "../src/hooks/useConfiguracoesContrato";
import { gerarHtmlContrato } from "../src/utils/contratoEngine";

const HOMOLOG_URL = "https://fsroaymkuopapwlnknhl.supabase.co";
const HOMOLOG_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzcm9heW1rdW9wYXB3bG5rbmhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTUwMDQ3MywiZXhwIjoyMTA3MDc2NDczfQ.p74EmozEkxHV8-etstzxKeeOXpWKdP1ZSlpjwkuwc6I";
const HOMOLOG_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzcm9heW1rdW9wYXB3bG5rbmhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MDA0NzMsImV4cCI6MjEwNzA3NjQ3M30.QV06zSi8oKTBz2s4x6oyHCWf_i0o8Gdu-obiE7SBOWA";

const supabase = createClient(HOMOLOG_URL, HOMOLOG_SERVICE_KEY, {
  auth: { persistSession: false },
});

async function run() {
  console.log("================================================================================");
  console.log("TESTE DE HOMOLOGAÇÃO: NOVO CONTRATO FICTÍCIO PASSANDO PELO FLUXO DO PRONTUÁRIO");
  console.log("Ambiente Remoto: https://fsroaymkuopapwlnknhl.supabase.co (NÃO MOCK)");
  console.log("================================================================================\n");

  const configContrato = carregarConfiguracoesContratoSync();
  console.log("1. Configurações Carregadas:");
  console.log(`   - Contratada: ${configContrato.nomeClinicaContrato}`);
  console.log(`   - CNPJ: ${configContrato.cnpjClinicaContrato}`);
  console.log(`   - Responsável Técnica: ${configContrato.dentistaResponsavelContrato}`);
  console.log(`   - CRO: ${configContrato.croResponsavelContrato}`);
  console.log(`   - Banco PIX: ${configContrato.bancoPix}`);
  console.log(`   - Chave PIX: ${configContrato.chavePix} (${configContrato.tipoChavePix})`);

  // 2. Garantir autorização da profissional no banco remoto
  const rubricaPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  await supabase.from("autorizacoes_assinatura_profissional").upsert({
    id: "8ba3742d-abe1-4a5a-9456-9d6f16c41eea",
    profissional_nome: "Dra. Rosângela Santos Pereira",
    profissional_cro: "06267-AL",
    profissional_documento: "032.740.424-80",
    autorizacao_expressa: "Autorizo expressamente a formalização bilateral digital de contratos odontológicos emitidos pela clínica.",
    modelos_autorizados: ["geral", "endodontia", "lentes_resina"],
    condicoes_abrangidas: { todas: true },
    assinatura_grafica: rubricaPng,
    ativo: true,
    autorizado_em: new Date().toISOString(),
  });

  // 3. Cadastrar paciente fictício
  const { data: pac, error: pacErr } = await supabase.from("pacientes").insert({
    nome: "Juliana Mendes Fictícia",
    cpf: "345.678.901-22",
    rg: "123456 SSP/AL",
    telefone: "(82) 98765-4321",
    email: "juliana.mendes@email.com",
    endereco: "Av. Sandoval Arroxelas, 120, Ponta Verde, Maceió - AL, CEP 57035-230",
  }).select().single();

  if (pacErr || !pac) throw new Error("Erro ao criar paciente: " + JSON.stringify(pacErr));
  console.log(`\n2. Paciente Fictício Criado: ${pac.nome} (CPF: ${pac.cpf})`);

  // 4. Orçamento aprovado com condição de pagamento PIX + parcelamento
  const orcamentoMock = {
    id: "orc-prontuario-" + Date.now().toString().slice(-6),
    pacienteId: pac.id,
    pacienteNome: pac.nome,
    titulo: "Plano de Tratamento Estético Integrado",
    itens: [
      { id: "1", nome: "Faceta em Resina Composta (Elemento 11)", quantidade: 1, valor: 1200, valorUnitario: 1200, valorTotal: 1200, denteOuRegiao: "Dente 11" },
      { id: "2", nome: "Faceta em Resina Composta (Elemento 21)", quantidade: 1, valor: 1200, valorUnitario: 1200, valorTotal: 1200, denteOuRegiao: "Dente 21" },
      { id: "3", nome: "Clareamento Dental Combinado (Consultório + Caseiro)", quantidade: 1, valor: 1100, valorUnitario: 1100, valorTotal: 1100 },
    ],
    subtotal: 3500.00,
    desconto: 500.00,
    total: 3000.00,
    formasPagamento: "Entrada de R$ 1.000,00 via PIX + 2x de R$ 1.000,00 via PIX (vencimentos 10/12/2026 e 10/01/2027)",
    status: "aprovado",
    condicoes: [{
      id: "c-pix-parc",
      tipo: "entrada_saldo",
      titulo: "Entrada de R$ 1.000,00 via PIX + Saldo em 2x PIX",
      descricao: "Entrada de R$ 1.000,00 via PIX + 2x de R$ 1.000,00 via PIX (vencimentos 10/12/2026 e 10/01/2027)",
      valorEntrada: 1000.00,
      metodoEntrada: "pix",
      saldoParcelas: 2,
      saldoValorParcela: 1000.00,
      saldoMetodo: "pix_parcelado",
      diaVencimento: 10,
      dataEntrada: "2026-11-05",
      dataPrimeiroVencimento: "2026-12-10",
      situacaoEntrada: "A vencer",
      situacaoSaldo: "A vencer",
      selecionada: true,
    }],
    condicaoEscolhida: {
      tipo: "entrada_saldo",
      titulo: "Entrada de R$ 1.000,00 via PIX + Saldo em 2x PIX",
      descricao: "Entrada de R$ 1.000,00 via PIX + 2x de R$ 1.000,00 via PIX (vencimentos 10/12/2026 e 10/01/2027)",
      valorEntrada: 1000.00,
      metodoEntrada: "pix",
      saldoParcelas: 2,
      saldoValorParcela: 1000.00,
      saldoMetodo: "pix_parcelado",
      diaVencimento: 10,
      dataEntrada: "2026-11-05",
      dataPrimeiroVencimento: "2026-12-10",
      situacaoEntrada: "A vencer",
      situacaoSaldo: "A vencer",
      selecionada: true,
    },
  };

  // 5. Geração formal pelo prontuário (gerarContratoDoOrcamentoAprovado)
  console.log("\n3. Executando gerarContratoDoOrcamentoAprovado (Fluxo do Prontuário)...");
  const resContrato = await gerarContratoDoOrcamentoAprovado({
    orcamento: orcamentoMock as any,
    patient: pac,
    configuracoes: {},
    configContrato: configContrato,
    modeloId: "geral",
  });

  const snap = resContrato?.snapshot;
  if (!snap) throw new Error("Snapshot do contrato não foi gerado");

  console.log("   - Contrato Identificador:", snap.contratoId);
  console.log("   - Contratada Snapshot:", snap.clinica.nome);
  console.log("   - CNPJ Snapshot:", snap.clinica.cnpj);
  console.log("   - Responsável Técnica Snapshot:", snap.clinica.dentistaResponsavel);
  console.log("   - Forma Pagamento Snapshot:", snap.financeiro.formaPagamento);
  console.log("   - Parcelas Mapeadas:", snap.financeiro.parcelas.length);

  // 6. Validar a Prévia HTML gerada
  const htmlPrevia = gerarHtmlContrato(snap);
  const temSantosHtml = htmlPrevia.includes("Santos & Duracenski Odontologia LTDA");
  const temPjHtml = htmlPrevia.includes("pessoa jurídica de direito privado");
  const temPfAntigaHtml = htmlPrevia.includes("cirurgiã(o)-dentista inscrita(o) no CPF/MF");
  console.log("\n4. Verificação da Prévia HTML:");
  console.log(`   - Contratada PJ 'Santos & Duracenski Odontologia LTDA' presente: ${temSantosHtml ? "SIM ✓" : "NÃO ✗"}`);
  console.log(`   - Qualificação como Pessoa Jurídica: ${temPjHtml ? "SIM ✓" : "NÃO ✗"}`);
  console.log(`   - Qualificação como PF antiga presente: ${temPfAntigaHtml ? "SIM (ERRO)" : "NÃO (CORRETO) ✓"}`);

  // 7. Persistir o documento no banco de homologação usando chave service_role
  const contratoId = snap.contratoId;
  const token = snap.token || `token_${Date.now()}`;
  snap.token = token;

  const { data: docRow, error: docErr } = await supabase.from("documentos_clinicos").insert({
    identificador: contratoId,
    paciente_id: pac.id,
    paciente_nome: pac.nome,
    tipo: "contrato",
    titulo: `Contrato Odontológico - ${pac.nome} (${contratoId})`,
    conteudo: "Contrato de prestação de serviços odontológicos formalizado em homologação hospedada.",
    valor_total: snap.financeiro.total,
    itens: snap,
    dentista: snap.clinica.dentistaResponsavel,
  }).select().single();

  if (docErr || !docRow) throw new Error("Erro ao persistir documento em homologação: " + JSON.stringify(docErr));
  console.log(`\n5. Documento Clínico Persistido no Supabase Remoto: ID ${docRow.id}`);

  // 8. Chamar a Edge Function remota para formalizar bilateralmente e gerar o PDF definitivo
  console.log("\n6. Chamando Edge Function remota 'contrato-publico' (action: sign)...");
  const edgeRes = await fetch(`${HOMOLOG_URL}/functions/v1/contrato-publico`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${HOMOLOG_ANON_KEY}`,
    },
    body: JSON.stringify({
      action: "sign",
      id: contratoId,
      token: token,
      signature: rubricaPng,
      signerName: pac.nome,
      signerInfo: {
        cpf: pac.cpf,
        email: pac.email,
        ip: "189.120.44.10",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0",
      },
    }),
  });

  const edgeJson = await edgeRes.json();
  console.log("   - Edge Function Status:", edgeRes.status);
  console.log("   - Edge Function Retorno:", edgeJson);

  if (!edgeJson.ok && !edgeJson.storagePath) {
    throw new Error("Edge function não formalizou o contrato: " + JSON.stringify(edgeJson));
  }

  // 9. Baixar o PDF DEFINITIVO gerado pelo servidor e arquivado no Storage
  const canonicalStoragePath = `contratos/${contratoId}/Contrato_Assinado_${contratoId}.pdf`;
  console.log(`\n7. Baixando PDF DEFINITIVO do Storage: ${canonicalStoragePath}...`);
  const { data: pdfBlob, error: pdfErr } = await supabase.storage.from("documentos-pacientes").download(canonicalStoragePath);
  if (pdfErr || !pdfBlob) throw new Error("Erro ao baixar PDF do Storage: " + JSON.stringify(pdfErr));

  const pdfBuf = Buffer.from(await pdfBlob.arrayBuffer());
  console.log(`   - PDF Definitivo baixado com sucesso: ${pdfBuf.length} bytes`);

  // Salvar no diretório de artefatos
  const artifactDir = "C:\\Users\\Jhonatha\\.gemini\\antigravity\\brain\\4923da1a-4a97-47ad-b222-c804420cf9c3";
  const pdfOutPath = path.join(artifactDir, `contrato-homolog-prontuario-${contratoId}.pdf`);
  fs.writeFileSync(pdfOutPath, pdfBuf);
  console.log(`   - Arquivo salvo em: ${pdfOutPath}`);

  // 10. Inspecionar o texto bruto do PDF gerado pelo servidor
  const pdfText = pdfBuf.toString("latin1");
  const hasSantosPdf = pdfText.includes("SANTOS & DURACENSKI ODONTOLOGIA LTDA") || pdfText.includes("Santos & Duracenski");
  const hasCnpjPdf = pdfText.includes("12.345.678/0001-90") || pdfText.includes("12345678000190");
  const hasDraPdf = pdfText.includes("Dra. Rosângela Santos Pereira") || pdfText.includes("Rosângela Santos");
  const hasPjPdf = pdfText.includes("pessoa jurídica de direito privado") || pdfText.includes("jurídica");
  const hasACombinar = pdfText.includes("A combinar") || pdfText.includes("A definir");
  const hasNuPagamentos = pdfText.includes("Nu Pagamentos") || pdfText.includes("Nu Pagamentos S.A.");

  console.log("\n================================================================================");
  console.log("RESULTADO DA AUDITORIA DO PDF DEFINITIVO GERADO NO SERVIDOR:");
  console.log("================================================================================");
  console.log(`✓ Razão Social Santos & Duracenski no PDF: ${hasSantosPdf ? "PRESENTE (CORRETO)" : "AUSENTE (FALHA)"}`);
  console.log(`✓ CNPJ 12.345.678/0001-90 no PDF: ${hasCnpjPdf ? "PRESENTE (CORRETO)" : "AUSENTE (FALHA)"}`);
  console.log(`✓ Dra. Rosângela Santos Pereira como Resp. Técnica: ${hasDraPdf ? "PRESENTE (CORRETO)" : "AUSENTE (FALHA)"}`);
  console.log(`✓ Qualificação Pessoa Jurídica no PDF: ${hasPjPdf ? "PRESENTE (CORRETO)" : "AUSENTE (FALHA)"}`);
  console.log(`✓ Banco Nu Pagamentos no PDF: ${hasNuPagamentos ? "PRESENTE (CORRETO)" : "AUSENTE (FALHA)"}`);
  console.log(`✓ Ausência total de 'A combinar' / 'A definir': ${!hasACombinar ? "CONFIRMADO (CORRETO)" : "DIVERGENTE (FALHA)"}`);
  console.log("================================================================================\n");
}

run().catch(console.error);
