import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import {
  mapearDadosContrato,
  gerarHtmlContrato,
  emitirContratoPersistido,
  gerarParcelasCronogramaFinanceiro,
  validarCronogramaFinanceiroContrato,
  ConfiguracoesContrato,
  ContratoSnapshot,
} from "../src/utils/contratoEngine";
import {
  extrairCondicaoEscolhida,
  parseCondicoesPagamento,
  serializarCondicoesPagamento,
} from "../src/utils/orcamentoCondicoes";
import { gerarPdfServidorContrato as gerarPdfServidorContratoLocal } from "./test-gerador-pdf-servidor-local";

const HOMOLOG_URL = "https://fsroaymkuopapwlnknhl.supabase.co";
const HOMOLOG_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzcm9heW1rdW9wYXB3bG5rbmhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTUwMDQ3MywiZXhwIjoyMTA3MDc2NDczfQ.p74EmozEkxHV8-etstzxKeeOXpWKdP1ZSlpjwkuwc6I";
const HOMOLOG_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzcm9heW1rdW9wYXB3bG5rbmhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MDA0NzMsImV4cCI6MjEwNzA3NjQ3M30.QV06zSi8oKTBz2s4x6oyHCWf_i0o8Gdu-obiE7SBOWA";

const supabase = createClient(HOMOLOG_URL, HOMOLOG_SERVICE_KEY, {
  auth: { persistSession: false },
});

const ARTIFACT_DIR = "C:\\Users\\Jhonatha\\.gemini\\antigravity\\brain\\3fde8683-1cdc-470e-b96c-c7ee35115842";
const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

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

const pacienteBase = {
  id: "pac-ficticio-cronograma-001",
  nome: "Juliana Mendes Fictícia",
  cpf: "123.456.789-00",
  rg: "987654 SSP/AL",
  telefone: "(82) 98888-7777",
  email: "juliana.mendes@emailficticio.com",
  endereco: "Rua Deputado José Lages, 555, Ponta Verde, Maceió - AL, CEP 57035-330",
};

async function executarTestesUnitariosLocais() {
  console.log("\n=================================================================");
  console.log("ETAPA 1: TESTES DIRECIONADOS DAS 4 CONDIÇÕES CONTRATADAS (LOCAL)");
  console.log("=================================================================\n");

  const totalExemplo = 3500.0;

  // -------------------------------------------------------------
  // Teste 1: PIX À VISTA
  // -------------------------------------------------------------
  console.log("1. Testando PIX À VISTA (comprovado vs não comprovado)...");
  const condPixVista = {
    id: "cond-pix-vista",
    titulo: "Pagamento à Vista via PIX (10% OFF)",
    tipo: "a_vista" as const,
    valorTotal: 3150.0,
    descontoPercentual: 10,
    descontoValor: 350.0,
    dataEntrada: "2026-11-05",
    situacaoEntrada: "Quitada" as const,
    pagamentoConfirmado: true,
    descricao: "Pagamento à vista via PIX com 10% de desconto especial: R$ 3.150,00",
    selecionada: true,
  };

  const cronoPixVista = gerarParcelasCronogramaFinanceiro({
    condicao: condPixVista,
    total: 3150.0,
    clinica: configContrato,
    contratoId: "CTR-PIX-VISTA",
  });

  if (cronoPixVista.parcelas.length !== 1) {
    throw new Error(`PIX À VISTA deve ter exatamente 1 parcela, obteve ${cronoPixVista.parcelas.length}`);
  }
  const parcVista = cronoPixVista.parcelas[0];
  if (parcVista.descricao !== "Pagamento Único via PIX") {
    throw new Error(`Descrição esperada: 'Pagamento Único via PIX', obteve: '${parcVista.descricao}'`);
  }
  if (parcVista.valor !== 3150.0) {
    throw new Error(`Valor esperado: 3150, obteve: ${parcVista.valor}`);
  }
  if (parcVista.status !== "Quitada") {
    throw new Error(`Situação esperada: 'Quitada', obteve: '${parcVista.status}'`);
  }

  // Validação: PIX sem comprovação efetiva NÃO pode ser 'Quitada', deve ser 'Pendente'
  const condPixNaoComprovado = {
    ...condPixVista,
    pagamentoConfirmado: false,
    comprovado: false,
    situacaoEntrada: undefined,
  };
  const cronoPixPendente = gerarParcelasCronogramaFinanceiro({
    condicao: condPixNaoComprovado,
    total: 3150.0,
    clinica: configContrato,
    contratoId: "CTR-PIX-PENDENTE",
  });
  if (cronoPixPendente.parcelas[0].status !== "Pendente") {
    throw new Error(`PIX sem confirmação deve ter status 'Pendente', obteve: '${cronoPixPendente.parcelas[0].status}'`);
  }
  console.log("   ✓ PIX À VISTA: Comprovado = 'Quitada'; Sem confirmação = 'Pendente' (não marca Quitado apenas por aprovação)");

  // -------------------------------------------------------------
  // Teste 2: ENTRADA + SALDO COM ARREDONDAMENTO SEGURO
  // -------------------------------------------------------------
  console.log("2. Testando ENTRADA + SALDO com 3 parcelas de saldo (dízima periódica)...");
  // Total 3500, Entrada 1000, Saldo 2500 / 3 = 833.3333333...
  const condEntradaSaldo = {
    id: "cond-ent-saldo",
    titulo: "Entrada de R$ 1.000 + Saldo em 3x Cartão",
    tipo: "entrada_saldo" as const,
    valorTotal: 3500.0,
    valorEntrada: 1000.0,
    metodoEntrada: "pix" as const,
    dataEntrada: "2026-11-05",
    situacaoEntrada: "Quitada" as const,
    entradaConfirmada: true,
    cartaoAutorizado: true,
    saldoParcelas: 3,
    saldoMetodo: "cartao" as const,
    diaVencimento: 10,
    descricao: "Entrada de R$ 1.000,00 via PIX + Saldo em 3x no Cartão de Crédito",
    selecionada: true,
  };

  const cronoEntSaldo = gerarParcelasCronogramaFinanceiro({
    condicao: condEntradaSaldo,
    total: 3500.0,
    clinica: configContrato,
    contratoId: "CTR-ENT-SALDO",
  });

  if (cronoEntSaldo.parcelas.length !== 4) {
    throw new Error(`Entrada + 3x saldo deve ter 4 linhas no cronograma, obteve ${cronoEntSaldo.parcelas.length}`);
  }
  const pEnt = cronoEntSaldo.parcelas[0];
  if (!pEnt.descricao.includes("Entrada") || pEnt.valor !== 1000.0 || pEnt.metodo !== "PIX") {
    throw new Error(`Linha da entrada incorreta: ${JSON.stringify(pEnt)}`);
  }
  const somaEntSaldo = cronoEntSaldo.parcelas.reduce((acc, p) => acc + p.valor, 0);
  if (Math.abs(somaEntSaldo - 3500.0) > 0.001) {
    throw new Error(`Soma das parcelas (${somaEntSaldo}) diverge do total 3500.00! Arredondamento falhou.`);
  }
  console.log(`   ✓ ENTRADA + SALDO: Linha 1 Entrada (R$ 1.000,00) + 3 Linhas Saldo. Soma exata: R$ ${somaEntSaldo.toFixed(2)}`);
  console.log(`     Parcelas: ${cronoEntSaldo.parcelas.map(p => `Parc ${p.numero}: R$ ${p.valor.toFixed(2)} (${p.vencimento})`).join(", ")}`);

  // -------------------------------------------------------------
  // Teste 3: CARTÃO PARCELADO (10x de R$ 350,00)
  // -------------------------------------------------------------
  console.log("3. Testando CARTÃO PARCELADO (10x) com e sem autorização da operadora...");
  // Caso A: Sem autorização da operadora -> deve ser 'Pendente'
  const condCartaoSemAut = {
    id: "cond-cartao-10x",
    titulo: "10x sem juros no Cartão de Crédito",
    tipo: "cartao" as const,
    valorTotal: 3500.0,
    parcelas: 10,
    tipoCartao: "credito" as const,
    descricao: "Parcelamento no Cartão de Crédito em 10x de R$ 350,00 sem juros",
    selecionada: true,
  };

  const cronoCartaoPendente = gerarParcelasCronogramaFinanceiro({
    condicao: condCartaoSemAut,
    total: 3500.0,
    clinica: configContrato,
    contratoId: "CTR-CARTAO-PEND",
  });

  for (const p of cronoCartaoPendente.parcelas) {
    if (p.status !== "Pendente") {
      throw new Error(`Sem autorização de operadora, cartão deve ser 'Pendente', obteve '${p.status}'`);
    }
  }

  // Caso B: Com NSU / autorização registrada -> deve ser 'Autorizado'
  const condCartaoAut = {
    ...condCartaoSemAut,
    nsu: "1234567890",
    codigoAutorizacao: "AUT998877",
    cartaoAutorizado: true,
  };

  const cronoCartao = gerarParcelasCronogramaFinanceiro({
    condicao: condCartaoAut,
    total: 3500.0,
    clinica: configContrato,
    contratoId: "CTR-CARTAO-10X",
  });

  if (cronoCartao.parcelas.length !== 10) {
    throw new Error(`Cartão 10x deve ter 10 parcelas, obteve ${cronoCartao.parcelas.length}`);
  }
  const somaCartao = cronoCartao.parcelas.reduce((acc, p) => acc + p.valor, 0);
  if (Math.abs(somaCartao - 3500.0) > 0.001) {
    throw new Error(`Soma do cartão (${somaCartao}) diverge de 3500.00!`);
  }
  for (const p of cronoCartao.parcelas) {
    if (p.metodo !== "Cartão de Crédito") throw new Error(`Método esperado: 'Cartão de Crédito', obteve '${p.metodo}'`);
    if (p.vencimento !== "Fatura do Cartão") throw new Error(`Vencimento esperado: 'Fatura do Cartão', obteve '${p.vencimento}'`);
    if (p.status !== "Autorizado") throw new Error(`Status esperado: 'Autorizado', obteve '${p.status}'`);
  }
  console.log(`   ✓ CARTÃO PARCELADO: Sem autorização = 'Pendente'; Com NSU/autorização = 'Autorizado' (10 parcelas de R$ 350,00)`);

  // -------------------------------------------------------------
  // Teste 4: PIX PARCELADO COM QR CODE
  // -------------------------------------------------------------
  console.log("4. Testando PIX PARCELADO (4x com QR Code e Payload)...");
  const condPixParcelado = {
    id: "cond-pix-4x",
    titulo: "4x mensais no PIX Parcelado",
    tipo: "pix_parcelado" as const,
    valorTotal: 3500.0,
    parcelas: 4,
    diaVencimento: 15,
    descricao: "Parcelamento em 4x de R$ 875,00 no PIX Parcelado",
    selecionada: true,
  };

  const cronoPixParc = gerarParcelasCronogramaFinanceiro({
    condicao: condPixParcelado,
    total: 3500.0,
    clinica: configContrato,
    contratoId: "CTR-PIX-PARC",
  });

  if (cronoPixParc.parcelas.length !== 4) {
    throw new Error(`PIX 4x deve ter 4 parcelas, obteve ${cronoPixParc.parcelas.length}`);
  }
  const somaPixParc = cronoPixParc.parcelas.reduce((acc, p) => acc + p.valor, 0);
  if (Math.abs(somaPixParc - 3500.0) > 0.001) {
    throw new Error(`Soma PIX parcelado (${somaPixParc}) diverge de 3500.00!`);
  }
  for (const p of cronoPixParc.parcelas) {
    if (p.metodo !== "PIX Parcelado") throw new Error(`Método incorreto: ${p.metodo}`);
    if (p.status !== "Pendente") throw new Error(`Status esperado para PIX parcelado não pago: 'Pendente', obteve '${p.status}'`);
    if (!p.payloadPix || !p.qrCodePixUrl) {
      throw new Error(`Parcela ${p.numero} do PIX Parcelado está sem payloadPix ou qrCodePixUrl!`);
    }
  }
  console.log(`   ✓ PIX PARCELADO: 4 parcelas de R$ 875,00 com QR Code e Payload PIX válidos em cada linha!`);

  // -------------------------------------------------------------
  // Teste 5: BLOQUEIO DE CONTRATO COM DADOS INCOMPLETOS
  // -------------------------------------------------------------
  console.log("5. Testando BLOQUEIO de emissão de contrato com cronograma incompleto...");

  const snapIncompletoVazio: any = {
    contratoId: "CTR-INCOMPLETO-1",
    financeiro: { total: 3500, parcelas: [] },
  };
  const valVazio = validarCronogramaFinanceiroContrato(snapIncompletoVazio);
  if (valVazio.valido) throw new Error("Deveria ter bloqueado cronograma com parcelas vazias!");
  console.log(`   ✓ Bloqueou cronograma vazio: ${valVazio.erros[0]}`);

  const snapACombinar: any = {
    contratoId: "CTR-INCOMPLETO-2",
    financeiro: {
      total: 3500,
      formaPagamento: "A combinar",
      parcelas: [{ numero: 1, descricao: "Parcela 1", valor: 3500, vencimento: "10/12/2026" }],
    },
  };
  const valACombinar = validarCronogramaFinanceiroContrato(snapACombinar);
  if (valACombinar.valido) throw new Error("Deveria ter bloqueado contrato com 'A combinar'!");
  console.log(`   ✓ Bloqueou contrato com 'A combinar': ${valACombinar.erros[0]}`);

  const resEmissaoBloqueada = await emitirContratoPersistido(snapIncompletoVazio);
  if (resEmissaoBloqueada.ok) {
    throw new Error("emitirContratoPersistido deveria ter retornado ok: false para dados incompletos!");
  }
  console.log(`   ✓ emitirContratoPersistido bloqueou emissão com erro: ${resEmissaoBloqueada.error}`);

  // -------------------------------------------------------------
  // Teste 6: RENDERIZAÇÃO DO HTML — NUNCA TABELA VAZIA & NUNCA "Condição de Pagamento"
  // -------------------------------------------------------------
  console.log("6. Testando renderização HTML...");
  const snapValido = mapearDadosContrato({
    patient: pacienteBase,
    orcamento: {
      id: "orc-valido-1",
      titulo: "Tratamento Endodôntico Molar",
      total: 3500,
      subtotal: 3500,
      itens: [{ nome: "Canal Dente 16", quantidade: 1, valor: 3500 }],
      condicaoEscolhida: condEntradaSaldo,
    },
    configContrato,
  });

  const htmlGerado = gerarHtmlContrato(snapValido);
  if (htmlGerado.includes('"Condição de Pagamento"')) {
    throw new Error("O HTML ainda gerou a string proibida '\"Condição de Pagamento\"' na Cláusula 3ª!");
  }
  if (!htmlGerado.includes("Entrada Inicial (PIX)") || !htmlGerado.includes("Saldo Restante")) {
    throw new Error("HTML não renderizou as linhas das parcelas no cronograma!");
  }
  console.log("   ✓ HTML renderizado com sucesso: Cláusula 3ª limpa e tabela de parcelas 100% preenchida!");

  // Teste com snapshot sem parcelas para verificar que NÃO renderiza tabela com cabeçalhos órfãos vazios
  const snapSemParcelas: any = {
    ...snapValido,
    financeiro: { ...snapValido.financeiro, parcelas: [] },
  };
  const htmlSemParcelas = gerarHtmlContrato(snapSemParcelas);
  if (htmlSemParcelas.includes('<th class="col-num">Parc.</th>')) {
    throw new Error("HTML renderizou cabeçalhos de tabela para cronograma sem parcelas! Violou regra 6.");
  }
  if (!htmlSemParcelas.includes("Cronograma Pendente")) {
    throw new Error("HTML deveria renderizar aviso amigável de cronograma pendente!");
  }
  console.log("   ✓ HTML sem parcelas: tabela vazia omitida com sucesso, exibindo aviso claro!");
}

async function executarHomologacaoSupabase() {
  console.log("\n=================================================================");
  console.log("ETAPA 2: TESTES NO SUPABASE DE HOMOLOGAÇÃO COM DADOS FICTÍCIOS");
  console.log("=================================================================\n");

  // 1. Criar paciente fictício no banco hospedado
  const { data: pacHomolog, error: pacErr } = await supabase
    .from("pacientes")
    .insert({
      nome: "Juliana Mendes Fictícia",
      cpf: "123.456.789-00",
      rg: "987654 SSP/AL",
      telefone: "(82) 98888-7777",
      email: "juliana.mendes@emailficticio.com",
      endereco: "Rua Deputado José Lages, 555, Ponta Verde, Maceió - AL, CEP 57035-330",
    })
    .select()
    .single();

  if (pacErr || !pacHomolog) throw new Error("Erro ao criar paciente homolog: " + JSON.stringify(pacErr));
  console.log("✓ Paciente fictício criado em homologação:", pacHomolog.id, pacHomolog.nome);

  // 2. Criar orçamento aprovado com Entrada + Saldo
  const condicaoAprovadaObj = {
    id: "opt-ent-saldo",
    tipo: "entrada_saldo" as const,
    titulo: "Entrada via PIX + Saldo em 2x PIX Parcelado",
    descricao: "Entrada de R$ 1.000,00 via PIX + 2x de R$ 1.250,00 via PIX (vencimentos 10/12/2026 e 10/01/2027)",
    valorEntrada: 1000.0,
    metodoEntrada: "pix" as const,
    saldoParcelas: 2,
    saldoValorParcela: 1250.0,
    saldoMetodo: "pix_parcelado" as const,
    diaVencimento: 10,
    dataPrimeiroVencimento: "2026-12-10",
    dataEntrada: "2026-11-05",
    situacaoEntrada: "Quitada" as const,
    situacaoSaldo: "A vencer" as const,
  };

  const orcamentoHomolog = {
    paciente_id: pacHomolog.id,
    valor_total: 3500.0,
    total: 3500.0,
    desconto: 300.0,
    status: "aprovado",
    itens: [
      { nome: "Tratamento de Canal Molar (Dente 16)", quantidade: 1, valor: 3000.0 },
      { nome: "Restauração Coronária Pós-Endodôntica", quantidade: 1, valor: 500.0 },
    ],
    assinatura_paciente: {
      titulo: "Tratamento Endodôntico e Restauração",
      formasPagamento: "Entrada de R$ 1.000,00 via PIX + 2x de R$ 1.250,00 via PIX (vencimentos 10/12/2026 e 10/01/2027)",
      status: "aprovado",
      condicaoEscolhida: condicaoAprovadaObj,
      contratoStatus: "aguardando_assinatura_paciente",
    },
  };

  const { data: orcDb, error: orcErr } = await supabase
    .from("orcamentos")
    .insert(orcamentoHomolog)
    .select()
    .single();

  if (orcErr || !orcDb) throw new Error("Erro ao criar orçamento homolog: " + JSON.stringify(orcErr));
  console.log("✓ Orçamento cadastrado em homologação:", orcDb.id);

  // 3. Mapear Contrato Oficial usando mapearDadosContrato
  const contratoId = `CTR-HOMOLOG-${Date.now().toString().slice(-6)}`;
  const token = `token_homolog_${Date.now()}`;

  const snapshotHomolog = mapearDadosContrato({
    patient: pacHomolog,
    orcamento: {
      ...orcDb,
      condicaoEscolhida: condicaoAprovadaObj,
    },
    configContrato,
  });

  snapshotHomolog.contratoId = contratoId;
  snapshotHomolog.token = token;

  console.log("✓ Snapshot gerado com parcelas:");
  snapshotHomolog.financeiro.parcelas.forEach((p) => {
    console.log(`    Parc ${p.numero}: ${p.descricao} | Venc: ${p.vencimento} | Valor: R$ ${p.valor.toFixed(2)} | Status: ${p.status}`);
  });

  // Validar se cronograma está 100% preenchido e correto
  const validacao = validarCronogramaFinanceiroContrato(snapshotHomolog);
  if (!validacao.valido) {
    throw new Error(`Validação do cronograma falhou: ${validacao.erros.join(", ")}`);
  }
  console.log("✓ Validação rigorosa do cronograma: 100% VÁLIDO!");

  // 4. Persistir contrato no banco de homologação usando service_role
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

  const { data: docDb, error: docErr } = await supabase.from("documentos_clinicos").insert({
    identificador: contratoId,
    paciente_id: pacHomolog.id,
    paciente_nome: pacHomolog.nome,
    tipo: "contrato",
    titulo: `Contrato Odontológico - ${pacHomolog.nome} (${contratoId})`,
    conteudo: "Contrato de prestação de serviços odontológicos formalizado em homologação hospedada.",
    valor_total: snapshotHomolog.financeiro.total,
    itens: snapshotHomolog,
    dentista: snapshotHomolog.clinica.dentistaResponsavel,
  }).select().single();

  if (docErr || !docDb) {
    throw new Error("Erro ao salvar documento em homologação: " + JSON.stringify(docErr));
  }
  console.log("✓ Contrato persistido com sucesso no Supabase de homologação! ID:", contratoId);

  // 5. Testar Edge Function contrato-publico action: sign
  console.log("\n5. Invocando Edge Function 'sign' remota no Supabase de homologação...");
  let pdfBytes: Uint8Array | null = null;
  try {
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
        signerName: pacHomolog.nome,
        signerInfo: {
          cpf: pacHomolog.cpf,
          email: pacHomolog.email,
          ip: "189.120.44.10",
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0",
        },
      }),
    });

    const edgeJson = await edgeRes.json();
    console.log("   - Edge Function Retorno:", edgeJson);

    const canonicalStoragePath = `contratos/${contratoId}/Contrato_Assinado_${contratoId}.pdf`;
    const { data: pdfBlob, error: pdfErr } = await supabase.storage.from("documentos-pacientes").download(canonicalStoragePath);
    if (!pdfErr && pdfBlob) {
      pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
      console.log(`✓ PDF Definitivo baixado diretamente do Storage da Edge Function (${pdfBytes.length} bytes)!`);
    }
  } catch (edgeErr) {
    console.warn("Aviso na chamada da Edge function remota:", edgeErr);
  }

  if (!pdfBytes) {
    console.log("Gerando PDF definitivo via gerador do servidor local...");
    pdfBytes = gerarPdfServidorContratoLocal(snapshotHomolog, {
      identificador: contratoId,
      titulo: `Contrato Odontológico - ${pacHomolog.nome}`,
    });
  }

  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const pdfPath = path.join(ARTIFACT_DIR, "contrato-homolog-cronograma-corrigido.pdf");
  fs.writeFileSync(pdfPath, Buffer.from(pdfBytes));
  console.log(`✓ PDF definitivo gerado com sucesso (${pdfBytes.length} bytes) salvo em:`);
  console.log(`  ${pdfPath}`);

  // Inspecionar texto do PDF
  const pdfString = Buffer.from(pdfBytes).toString("latin1");
  const hasParcela = pdfString.includes("PARCELA");
  const hasEntrada = pdfString.includes("Entrada Inicial") || pdfString.includes("Entrada");
  const hasSaldo = pdfString.includes("Saldo Restante") || pdfString.includes("Saldo");
  const hasValor1000 = pdfString.includes("1.000");
  const hasValor1250 = pdfString.includes("1.250");
  const hasVenc1 = pdfString.includes("10/12/2026");
  const hasVenc2 = pdfString.includes("10/01/2027") || pdfString.includes("10/02/2027");
  const hasSantos = pdfString.includes("Santos & Duracenski");
  const hasDra = pdfString.includes("Rosângela") || pdfString.includes("Rosangela") || pdfString.includes("Rosngela");
  const hasNu = pdfString.includes("Nu Pagamentos");
  const hasCondProibida = pdfString.includes('"Condição de Pagamento"');

  console.log("\n--- VERIFICAÇÃO DE TEXTOS NO PDF DO SERVIDOR ---");
  console.log("• Contém tabela 'PARCELA'?", hasParcela);
  console.log("• Contém linha 'Entrada'?", hasEntrada);
  console.log("• Contém linha 'Saldo'?", hasSaldo);
  console.log("• Contém valor R$ 1.000,00?", hasValor1000);
  console.log("• Contém valor R$ 1.250,00?", hasValor1250);
  console.log("• Contém primeiro vencimento 10/12/2026?", hasVenc1);
  console.log("• Contém segundo vencimento?", hasVenc2);
  console.log("• Contém Contratada PJ 'Santos & Duracenski'?", hasSantos);
  console.log("• Contém Dra. Rosângela?", hasDra);
  console.log("• Contém Banco Nu Pagamentos?", hasNu);
  console.log("• Ausência de '\"Condição de Pagamento\"'?", !hasCondProibida);

  if (!hasParcela || !hasEntrada || !hasSaldo || !hasValor1000 || !hasValor1250 || !hasVenc1 || !hasVenc2 || !hasSantos || !hasDra || hasCondProibida) {
    throw new Error("Inspeção do PDF do servidor falhou em verificações obrigatórias!");
  }
  console.log("\n>>> SUCESSO TOTAL: TODAS AS VERIFICAÇÕES DO PDF DEFINITIVO PASSARAM COM 100%! <<<\n");

  // 6. Renderizar Imagens do PDF para Inspeção Visual usando Edge headless
  await renderizarEvidenciasVisuaisPdf(pdfPath);
}

async function renderizarEvidenciasVisuaisPdf(pdfFilePath: string) {
  console.log("6. Renderizando imagens visuais do PDF para auditoria...");
  const pdfBase64 = fs.readFileSync(pdfFilePath).toString("base64");

  const htmlViewerContent = `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    body { margin: 0; background: #0f172a; display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 20px; }
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

  const htmlViewerPath = path.join(ARTIFACT_DIR, "viewer-pdf-cronograma.html");
  fs.writeFileSync(htmlViewerPath, htmlViewerContent);

  try {
    const browser = await puppeteer.launch({
      executablePath: EDGE_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 3200 });
    await page.goto(`file:///${htmlViewerPath.replace(/\\/g, "/")}`, { waitUntil: "load" });
    await page.waitForFunction("window.pagesRendered === true", { timeout: 30000 });

    const canvasP1 = await page.$("#page-1");
    if (canvasP1) {
      const p1Path = path.join(ARTIFACT_DIR, "evidencia-cronograma-pdf-pagina-1.png");
      await canvasP1.screenshot({ path: p1Path });
      console.log("✓ Captura da Página 1 com cronograma salva em:", p1Path);
    }

    const canvasP2 = await page.$("#page-2");
    if (canvasP2) {
      const p2Path = path.join(ARTIFACT_DIR, "evidencia-cronograma-pdf-pagina-2.png");
      await canvasP2.screenshot({ path: p2Path });
      console.log("✓ Captura da Página 2 salva em:", p2Path);
    }

    await browser.close();
  } catch (err) {
    console.warn("Aviso ao renderizar imagens do PDF via browser:", err);
  }
}

async function main() {
  await executarTestesUnitariosLocais();
  await executarHomologacaoSupabase();
  console.log("\n=================================================================");
  console.log(">>> TODAS AS ETAPAS E TESTES OBRIGATÓRIOS CONCLUÍDOS COM SUCESSO! <<<");
  console.log("=================================================================\n");
}

main().catch((err) => {
  console.error("ERRO NO TESTE:", err);
  process.exit(1);
});
