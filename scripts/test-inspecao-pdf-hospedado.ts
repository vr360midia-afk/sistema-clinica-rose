import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { mapearDadosContrato, ConfiguracoesContrato } from "../src/utils/contratoEngine";

const HOMOLOG_URL = "https://fsroaymkuopapwlnknhl.supabase.co";
const HOMOLOG_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzcm9heW1rdW9wYXB3bG5rbmhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTUwMDQ3MywiZXhwIjoyMTA3MDc2NDczfQ.p74EmozEkxHV8-etstzxKeeOXpWKdP1ZSlpjwkuwc6I";
const HOMOLOG_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzcm9heW1rdW9wYXB3bG5rbmhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MDA0NzMsImV4cCI6MjEwNzA3NjQ3M30.QV06zSi8oKTBz2s4x6oyHCWf_i0o8Gdu-obiE7SBOWA";

const supabase = createClient(HOMOLOG_URL, HOMOLOG_SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("=== INICIANDO TESTE COM DADOS FICTÍCIOS NO SUPABASE HOSPEDADO ===");

  // 1. Configurações da Contratada (Configurações → Contrato & PIX)
  const configContrato: ConfiguracoesContrato = {
    nomeClinicaContrato: "Santos & Duracenski Odontologia LTDA",
    cnpjClinicaContrato: "12.345.678/0001-90",
    croResponsavelContrato: "CRO-AL 06267",
    dentistaResponsavelContrato: "Dra. Rosângela Santos Pereira",
    enderecoContrato: "Av. Fernandes Lima, 1000, Sala 401, Farol, Maceió - AL, CEP 57055-000",
    telefoneContrato: "(82) 99999-8888",
    emailContrato: "contato@santosduracenski.com.br",
    chavePix: "12345678000190",
    tipoChavePix: "cnpj",
    favorecidoPix: "Santos & Duracenski Odontologia LTDA",
    cnpjCpfFavorecidoPix: "12.345.678/0001-90",
    bancoPix: "Nu Pagamentos S.A. (260)",
    instrucoesPix: "Pague via QR Code ou Copia e Cola no app do seu banco",
  };

  // 2. Garantir Autorização Ativa da Dra. Rosângela no banco hospedado
  const rubricaDraPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const rubricaPacientePng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==";

  const authId = "8ba3742d-abe1-4a5a-9456-9d6f16c41eea";
  await supabase.from("autorizacoes_assinatura_profissional").upsert({
    id: authId,
    profissional_nome: "Dra. Rosângela Santos Pereira",
    profissional_cro: "06267-AL",
    profissional_documento: "032.740.424-80",
    autorizacao_expressa: "Autorizo expressamente a formalização bilateral digital de contratos odontológicos emitidos pela clínica.",
    modelos_autorizados: ["geral", "endodontia", "lentes_resina"],
    condicoes_abrangidas: { todas: true },
    assinatura_grafica: rubricaDraPng,
    ativo: true,
    autorizado_em: new Date().toISOString(),
  });

  // 3. Cadastrar Paciente Fictício
  const { data: pac, error: pacErr } = await supabase.from("pacientes").insert({
    nome: "Carlos Eduardo de Albuquerque",
    cpf: "123.456.789-00",
    rg: "987654 SSP/AL",
    telefone: "(82) 98888-7777",
    email: "carlos.albuquerque@email.com",
    endereco: "Rua Deputado José Lages, 555, Ponta Verde, Maceió - AL, CEP 57035-330",
  }).select().single();

  if (pacErr || !pac) throw new Error("Erro ao criar paciente: " + JSON.stringify(pacErr));
  console.log("Paciente criado:", pac.id, pac.nome);

  // 4. Cadastrar Orçamento com PIX com Desconto e Cronograma Detalhado
  const orcamentoObj = {
    id: "",
    numero: `ORC-${Date.now().toString().slice(-6)}`,
    pacienteId: pac.id,
    pacienteNome: pac.nome,
    titulo: "Tratamento Endodôntico Especializado (Molar)",
    descricao: "Tratamento de canal elemento 16 com instrumentação rotatória",
    subtotal: 3800.00,
    desconto: 300.00,
    total: 3500.00,
    formasPagamento: "Entrada de R$ 1.000,00 via PIX + 2x de R$ 1.250,00 via PIX (vencimentos 10/12/2026 e 10/01/2027)",
    itens: [
      {
        id: "item-1",
        nome: "Tratamento Endodôntico Molar (Canal)",
        quantidade: 1,
        valor: 3200.00,
        denteOuRegiao: "Dente 16",
      },
      {
        id: "item-2",
        nome: "Restauração Coronária Pós-Endodôntica em Resina",
        quantidade: 1,
        valor: 600.00,
        denteOuRegiao: "Dente 16",
      },
    ],
    status: "aprovado",
    condicaoEscolhida: {
      tipo: 'entrada_saldo',
      titulo: 'Entrada via PIX + Saldo em 2x PIX',
      descricao: 'Entrada de R$ 1.000,00 via PIX + 2x de R$ 1.250,00 via PIX (vencimentos 10/12/2026 e 10/01/2027)',
      valorEntrada: 1000.00,
      metodoEntrada: 'pix',
      saldoParcelas: 2,
      saldoValorParcela: 1250.00,
      saldoMetodo: 'pix_parcelado',
      diaVencimento: 10,
      dataPrimeiroVencimento: '2026-12-10',
      dataEntrada: '2026-11-05',
    },
    condicaoAprovada: {
      tipo: 'entrada_saldo',
      titulo: 'Entrada via PIX + Saldo em 2x PIX',
      descricao: 'Entrada de R$ 1.000,00 via PIX + 2x de R$ 1.250,00 via PIX (vencimentos 10/12/2026 e 10/01/2027)',
      valorEntrada: 1000.00,
      metodoEntrada: 'pix',
      saldoParcelas: 2,
      saldoValorParcela: 1250.00,
      saldoMetodo: 'pix_parcelado',
      diaVencimento: 10,
      dataPrimeiroVencimento: '2026-12-10',
      dataEntrada: '2026-11-05',
    },
  };

  const { data: orcDb, error: orcErr } = await supabase.from("orcamentos").insert({
    paciente_id: pac.id,
    valor_total: orcamentoObj.total,
    total: orcamentoObj.total,
    status: "aprovado",
    assinatura_paciente: {
      contratoStatus: "aguardando_assinatura_paciente",
      condicaoAprovada: orcamentoObj.condicaoAprovada,
    },
  }).select().single();

  if (orcErr || !orcDb) throw new Error("Erro ao criar orçamento: " + JSON.stringify(orcErr));
  console.log("Orçamento criado:", orcDb.id);
  orcamentoObj.id = orcDb.id;

  // 5. Gerar Snapshot usando mapearDadosContrato COM configuracoesContrato
  const snapshotContrato = mapearDadosContrato({
    patient: {
      id: pac.id,
      nome: pac.nome,
      cpf: pac.cpf,
      rg: pac.rg,
      telefone: pac.telefone,
      email: pac.email,
      endereco: pac.endereco,
    },
    orcamento: {
      ...orcamentoObj,
      id: orcDb.id,
    },
    configuracoes: {
      nomeClinica: configContrato.nomeClinicaContrato,
      cnpj: configContrato.cnpjClinicaContrato,
      endereco: configContrato.enderecoContrato,
      telefone: configContrato.telefoneContrato,
      email: configContrato.emailContrato,
      dentistaResponsavel: configContrato.dentistaResponsavelContrato,
      croResponsavel: configContrato.croResponsavelContrato,
    },
    configuracoesContrato: configContrato,
    tipoModeloContrato: 'endodontia',
    dadosEndodontia: {
      ativo: true,
      dentes: 'Dente 16',
      procedimentosAprovados: 'Tratamento Endodôntico Molar (Canal)',
    },
    assinaturaDentista: {
      nome: "Dra. Rosângela Santos Pereira",
      cro: "06267-AL",
      documento: "032.740.424-80",
      assinaturaData: rubricaDraPng,
      dataHora: new Date().toISOString(),
      tipo: "automatica_por_autorizacao",
      autorizacaoId: authId,
    },
  });

  const contratoId = `CTR-SANTOS-${Date.now().toString().slice(-6)}`;
  const token = `token_santos_${Date.now()}`;
  snapshotContrato.contratoId = contratoId;
  snapshotContrato.token = token;

  console.log("Contratada no snapshot:", snapshotContrato.clinica.nome, "CNPJ:", snapshotContrato.clinica.cnpj);
  console.log("Financeiro no snapshot:", snapshotContrato.financeiro.total, "Forma:", snapshotContrato.financeiro.formaPagamento);
  console.log("Parcelas no snapshot:", snapshotContrato.financeiro.parcelas.length);

  // 6. Inserir Contrato em documentos_clinicos
  const { data: docDb, error: docErr } = await supabase.from("documentos_clinicos").insert({
    identificador: contratoId,
    paciente_id: pac.id,
    paciente_nome: pac.nome,
    tipo: "contrato",
    titulo: `Contrato Odontológico - ${pac.nome} (${contratoId})`,
    conteudo: "Contrato de prestação de serviços odontológicos formalizado em homologação hospedada.",
    valor_total: snapshotContrato.financeiro.total,
    itens: snapshotContrato,
    dentista: snapshotContrato.clinica.dentistaResponsavel,
  }).select().single();

  if (docErr || !docDb) throw new Error("Erro ao criar contrato em documentos_clinicos: " + JSON.stringify(docErr));
  console.log("Documento clínico criado:", docDb.id);

  // 7. Chamar a Edge Function 'sign' para formalizar e disparar o arquivamento do PDF no servidor
  console.log("Invocando Edge Function 'sign' remota...");
  const edgeRes = await fetch(`${HOMOLOG_URL}/functions/v1/contrato-publico`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${HOMOLOG_ANON_KEY}`,
    },
    body: JSON.stringify({
      action: "sign",
      id: contratoId,
      token,
      signature: rubricaPacientePng,
      signerName: pac.nome,
      signerInfo: {
        cpf: pac.cpf,
        email: pac.email,
      },
    }),
  });

  const signData = await edgeRes.json();
  console.log("Resposta Edge Function sign:", edgeRes.status, signData);

  if (!signData.ok || !signData.pdfPath) {
    throw new Error("Falha no sign da Edge Function: " + JSON.stringify(signData));
  }

  // 8. Baixar o PDF oficial gerado pelo servidor e arquivado no Storage
  console.log("Baixando PDF oficial arquivado no Storage:", signData.pdfPath);
  const { data: pdfBlob, error: pdfDownloadErr } = await supabase.storage
    .from("documentos-pacientes")
    .download(signData.pdfPath);

  if (pdfDownloadErr || !pdfBlob) {
    throw new Error("Erro ao baixar PDF do Storage: " + JSON.stringify(pdfDownloadErr));
  }

  const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());
  const artifactDir = "C:\\Users\\Jhonatha\\.gemini\\antigravity\\brain\\4923da1a-4a97-47ad-b222-c804420cf9c3";
  const savedPdfPath = path.join(artifactDir, "contrato-ficticio-definitivo-storage.pdf");
  fs.writeFileSync(savedPdfPath, pdfBuffer);
  console.log(`PDF baixado com sucesso (${pdfBuffer.length} bytes) e salvo em ${savedPdfPath}`);

  // 9. Inspecionar conteúdo do PDF
  const pdfString = pdfBuffer.toString("latin1");
  console.log("\n--- VERIFICAÇÃO DE TEXTOS NO PDF GERADO PELO SERVIDOR ---");
  console.log("Contém 'Santos & Duracenski'?", pdfString.includes("Santos & Duracenski"));
  console.log("Contém '12.345.678/0001-90'?", pdfString.includes("12.345.678/0001-90"));
  console.log("Contém 'Rosângela'?", pdfString.includes("Rosângela") || pdfString.includes("Rosngela") || pdfString.includes("Rosangela"));
  console.log("Contém '3.500' ou '3500'?", pdfString.includes("3.500") || pdfString.includes("3500"));
  console.log("Contém 'A combinar'?", /a\s+combinar/i.test(pdfString));
  console.log("Contém 'A definir'?", /a\s+definir/i.test(pdfString));
  console.log("Contém 'Nu Pagamentos'?", pdfString.includes("Nu Pagamentos"));
  console.log("Contém '10/12/2026'?", pdfString.includes("10/12/2026"));
  console.log("Contém '10/01/2027'?", pdfString.includes("10/01/2027"));
}

main().catch((e) => {
  console.error("Erro fatal:", e);
  process.exit(1);
});
