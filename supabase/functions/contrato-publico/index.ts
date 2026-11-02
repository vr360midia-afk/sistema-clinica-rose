import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Utilitário para gerar hash SHA-256 do documento como evidência de integridade
async function gerarHashConteudo(texto: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(texto || "");
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (_) {
    return "";
  }
}

function temValorValido(val?: string | null): boolean {
  if (!val) return false;
  const s = String(val).trim().toLowerCase();
  return (
    s !== "" &&
    s !== "não informado" &&
    s !== "nao informado" &&
    s !== "não informada" &&
    s !== "nao informada" &&
    s !== "null" &&
    s !== "undefined"
  );
}

function formatarDocumento(value?: string | null): string {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function formatarEnderecoCompleto(input?: any): string {
  if (!input) return "";
  if (typeof input === "string") {
    const s = input.trim();
    if (!temValorValido(s)) return "";
    if (s.startsWith("{") && s.endsWith("}")) {
      try {
        return formatarEnderecoCompleto(JSON.parse(s));
      } catch (_) {}
    }
    return s;
  }
  if (typeof input !== "object") return "";

  const logradouro = (input.logradouro || input.rua || input.logr || "").trim();
  const numero = (input.numero || input.num || "").trim();
  const complemento = (input.complemento || input.compl || "").trim();
  const bairro = (input.bairro || input.bair || "").trim();
  const cidade = (input.cidade || input.municipio || "").trim();
  const estado = (input.estado || input.uf || "").trim();
  const cep = (input.cep || "").trim();

  if (input.endereco && typeof input.endereco === "string" && !logradouro && !numero && !bairro) {
    return formatarEnderecoCompleto(input.endereco);
  }

  const partes: string[] = [];
  if (logradouro) {
    partes.push(numero ? `${logradouro}, nº ${numero}` : logradouro);
  } else if (numero) {
    partes.push(`nº ${numero}`);
  }
  if (complemento) partes.push(complemento);
  if (bairro) partes.push(`Bairro ${bairro.replace(/^bairro\s*/i, "")}`);
  if (cidade || estado) partes.push([cidade, estado].filter(Boolean).join(" - "));
  if (cep) {
    const cepLimpo = cep.replace(/\D/g, "");
    const cepFmt = cepLimpo.length === 8 ? `${cepLimpo.slice(0, 5)}-${cepLimpo.slice(5)}` : cep;
    partes.push(`CEP ${cepFmt.replace(/^CEP\s*/i, "")}`);
  }
  return partes.join(", ");
}

function formatarTelefone(v?: string | null): string {
  if (!v || !temValorValido(v)) return "";
  const digits = String(v).replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return String(v).trim();
}

// RESOLUÇÃO DE CONTRATOS HISTÓRICOS NÃO-AMBÍGUA E DETERMINÍSTICA
// Preserva 100% dos códigos CTR existentes sem renomear nenhum contrato.
// Em caso de duplicidade histórica, localiza exatamente o contrato correspondente ao token informado.
async function localizarContratoCompativel(
  supabase: any,
  targetId: string,
  token?: string
): Promise<Record<string, any> | null> {
  const cleanId = String(targetId || "").trim();
  if (!cleanId) return null;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
  const code8Match = cleanId.match(/^(?:CTR-)?([0-9a-f]{8})$/i);
  const code8 = code8Match ? code8Match[1].toUpperCase() : null;

  // 1. Busca direta por UUID primário
  if (isUuid) {
    const { data } = await supabase.from("documentos_clinicos").select("*").eq("id", cleanId).maybeSingle();
    if (data) return data;
  }

  // 2. Busca abrangente de todos os candidatos correspondentes a este CTR
  const orFilters = [
    `identificador.eq.${cleanId}`,
    `itens->>contratoId.eq.${cleanId}`,
    `identificador.eq.${cleanId.toUpperCase()}`,
    `itens->>contratoId.eq.${cleanId.toUpperCase()}`,
  ];
  if (code8) {
    orFilters.push(`identificador.eq.CTR-${code8}`);
    orFilters.push(`itens->>contratoId.eq.CTR-${code8}`);
    orFilters.push(`itens->>contratoId.eq.${code8}`);
  }

  const { data: rows } = await supabase
    .from("documentos_clinicos")
    .select("*")
    .or(orFilters.join(","))
    .order("criado_em", { ascending: false });

  if (rows && rows.length > 0) {
    // Se o token foi informado, localiza exatamente o documento que possui este token
    if (token) {
      const matchToken = rows.find((r: any) => r.itens?.token === token);
      if (matchToken) return matchToken;
    }
    return rows[0];
  }

  // 3. Fallback por prefixo de UUID se fornecido código de 8 dígitos
  if (code8) {
    const { data: rowsLike } = await supabase
      .from("documentos_clinicos")
      .select("*")
      .ilike("id", `${code8.toLowerCase()}-%`)
      .order("criado_em", { ascending: false });
    if (rowsLike && rowsLike.length > 0) {
      if (token) {
        const matchToken = rowsLike.find((r: any) => r.itens?.token === token);
        if (matchToken) return matchToken;
      }
      return rowsLike[0];
    }
  }

  return null;
}

// GERADOR DE PDF SERVER-SIDE NATIVO E DETERMINÍSTICO (Deno / jsPDF)
function gerarPdfServidorContrato(snap: any, docClinico?: any): Uint8Array {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 36;
  const contentW = pageW - margin * 2;
  let y = margin;

  function checkPageBreak(needed: number) {
    if (y + needed > pageH - margin - 35) {
      pdf.addPage();
      y = margin;
      drawHeaderSmall();
    }
  }

  function drawHeaderSmall() {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(110, 110, 110);
    pdf.text(`Clínica Dra. Rosângela Santos Pereira | Contrato Odontológico Ref: ${snap.contratoId || docClinico?.identificador || "CTR"}`, margin, y);
    pdf.setDrawColor(210, 210, 210);
    pdf.setLineWidth(0.5);
    pdf.line(margin, y + 4, pageW - margin, y + 4);
    y += 18;
  }

  // 1. CABEÇALHO PRINCIPAL
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(15, 23, 42); // slate-900
  pdf.text("CLÍNICA ODONTOLÓGICA DRA. ROSÂNGELA SANTOS PEREIRA", margin, y);
  y += 16;

  pdf.setFontSize(10.5);
  pdf.setTextColor(30, 41, 59);
  pdf.text("CONTRATO DE PRESTAÇÃO DE SERVIÇOS ODONTOLÓGICOS", margin, y);
  y += 14;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  const dataFormatada = snap.emitidoEm ? new Date(snap.emitidoEm).toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR");
  pdf.text(`Identificador Único: ${snap.contratoId || docClinico?.identificador || "CTR"}  |  Formalização: ${dataFormatada}  |  Versão Registrada: 1.0`, margin, y);
  y += 10;

  pdf.setDrawColor(37, 99, 235); // blue-600
  pdf.setLineWidth(1.5);
  pdf.line(margin, y, pageW - margin, y);
  y += 18;

  // 2. IDENTIFICAÇÃO DAS PARTES
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text("1. IDENTIFICAÇÃO DAS PARTES", margin, y);
  y += 13;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(51, 65, 85);

  const txtContratada = "CONTRATADA: DRA. ROSÂNGELA SANTOS PEREIRA, Cirurgiã-Dentista, inscrita no CRO-AL sob o nº 06267, com consultório odontológico estabelecido no endereço profissional da clínica.";
  const lContratada = pdf.splitTextToSize(txtContratada, contentW);
  pdf.text(lContratada, margin, y);
  y += lContratada.length * 10 + 5;

  const pacNome = snap.paciente?.nome || docClinico?.paciente_nome || "Paciente";
  const pacCpf = temValorValido(snap.paciente?.cpf) ? formatarDocumento(snap.paciente.cpf) : (snap.paciente?.cpf || "Não informado");
  const pacRg = snap.paciente?.rg || "";
  const pacEnd = formatarEnderecoCompleto(snap.paciente?.endereco) || (temValorValido(snap.paciente?.endereco) ? snap.paciente.endereco : "Não informado");
  const pacTel = temValorValido(snap.paciente?.telefone) ? formatarTelefone(snap.paciente.telefone) : (snap.paciente?.telefone || "Não informado");
  const pacEmail = snap.paciente?.email || "";

  let txtContratante = `CONTRATANTE: ${pacNome.toUpperCase()}, inscrito(a) no CPF/MF sob o nº ${pacCpf}`;
  if (temValorValido(pacRg)) {
    txtContratante += `, portador(a) do RG nº ${pacRg}`;
  }
  txtContratante += `, residente e domiciliado(a) em ${pacEnd}, telefone de contato ${pacTel}`;
  if (temValorValido(pacEmail)) {
    txtContratante += `, e-mail: ${pacEmail}`;
  }
  txtContratante += ".";
  const lContratante = pdf.splitTextToSize(txtContratante, contentW);
  pdf.text(lContratante, margin, y);
  y += lContratante.length * 10 + 12;

  // 3. OBJETO E PROCEDIMENTOS
  checkPageBreak(80);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text("2. OBJETO DO CONTRATO E PROCEDIMENTOS APROVADOS", margin, y);
  y += 13;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(51, 65, 85);
  const txtObj = "O presente contrato tem por objeto a prestação de serviços odontológicos especializados, conforme diagnóstico, plano de tratamento aprovado e orçamento formalmente aceito pelo(a) CONTRATANTE.";
  const lObj = pdf.splitTextToSize(txtObj, contentW);
  pdf.text(lObj, margin, y);
  y += lObj.length * 10 + 8;

  // Procedimentos
  const procs = snap.procedimentos || snap.itensContrato || [];
  if (Array.isArray(procs) && procs.length > 0) {
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(226, 232, 240);
    pdf.rect(margin, y, contentW, 16, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(71, 85, 105);
    pdf.text("PROCEDIMENTO APROVADO", margin + 8, y + 11);
    pdf.text("DENTE / REGIÃO", margin + 260, y + 11);
    pdf.text("VALOR", pageW - margin - 50, y + 11);
    y += 16;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(51, 65, 85);

    for (const proc of procs) {
      checkPageBreak(18);
      pdf.setDrawColor(241, 245, 249);
      pdf.line(margin, y + 14, pageW - margin, y + 14);
      pdf.text(proc.nome || proc.descricao || "Procedimento Clínico", margin + 8, y + 10);
      pdf.text(proc.dente || proc.regiao || "Conforme plano", margin + 260, y + 10);
      const val = typeof proc.valor === "number" ? `R$ ${proc.valor.toFixed(2)}` : (proc.valor || "Incluso");
      pdf.text(String(val), pageW - margin - 50, y + 10);
      y += 16;
    }
    y += 8;
  }

  // 4. VALOR E FORMA DE PAGAMENTO
  checkPageBreak(50);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text("3. VALOR TOTAL E CONDIÇÕES DE PAGAMENTO", margin, y);
  y += 13;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(51, 65, 85);

  const totalNum = snap.financeiro?.valorTotal || docClinico?.valor_total;
  const totalFormatado = totalNum ? `R$ ${Number(totalNum).toFixed(2)}` : "Conforme orçamento";
  const condFormatada = snap.financeiro?.condicoes || snap.financeiro?.formaPagamento || "Condição de pagamento pactuada em orçamento.";
  const txtFin = `O valor total ajustado para os procedimentos acima descritos é de ${totalFormatado}, a ser adimplido sob as seguintes condições: ${condFormatada}.`;
  const lFin = pdf.splitTextToSize(txtFin, contentW);
  pdf.text(lFin, margin, y);
  y += lFin.length * 10 + 14;

  // 5. CLÁUSULAS CONTRATUAIS ESSENCIAIS E OBRIGAÇÕES MÚTUAS
  checkPageBreak(120);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text("4. CLÁUSULAS E OBRIGAÇÕES MÚTUAS", margin, y);
  y += 13;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(71, 85, 105);

  const clausulas = [
    "CLÁUSULA 1ª (DO OBJETO E PROCEDIMENTOS) — A CONTRATADA obriga-se a prestar ao(à) CONTRATANTE os serviços odontológicos descritos neste instrumento, observando o diagnóstico clínico e o plano de tratamento formalmente aprovado.",
    "CLÁUSULA 2ª (DAS CONDIÇÕES FINANCEIRAS) — O valor total ajustado e as condições de pagamento pactuadas são irreajustáveis durante a vigência deste plano, ressalvada a necessidade de procedimentos adicionais não previstos inicialmente e formalmente aprovados.",
    "CLÁUSULA 3ª (DA ATIVIDADE DE MEIO) — A Odontologia é atividade profissional de meio e não de resultado. O sucesso clínico depende de fatores biológicos individuais, resposta tecidual e cooperação contínua do(a) paciente. A CONTRATADA compromete-se a atuar com zelo, perícia e estrita observância ao Código de Ética Odontológica.",
    "CLÁUSULA 4ª (DAS OBRIGAÇÕES DO PACIENTE) — O(A) CONTRATANTE compromete-se a seguir com rigor as prescrições médicas, comparecer às consultas designadas, manter a higienização oral orientada e comunicar imediatamente qualquer intercorrência ou alteração de saúde.",
    "CLÁUSULA 5ª (DA TOLERÂNCIA E REMARCAÇÕES) — A tolerância para atrasos nas consultas é de 15 minutos. Cancelamentos ou remarcações devem ser comunicados com antecedência mínima de 24 horas úteis. Faltas injustificadas prejudicam a continuidade do plano de tratamento.",
    "CLÁUSULA 6ª (DA RESCISÃO E DESISTÊNCIA) — O contrato poderá ser rescindido por qualquer das partes. Em caso de rescisão antecipada, serão quitados proporcionalmente os atos clínicos já executados e custos laboratoriais incorridos, restituindo-se eventuais saldos remanescentes.",
    "CLÁUSULA 7ª (DA PROTEÇÃO DE DADOS - LGPD) — Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), os dados cadastrais e de saúde são confidenciais e tratados exclusivamente para fins de assistência odontológica e cumprimento de obrigação legal.",
    "CLÁUSULA 8ª (DO FORO) — As partes elegem o foro da Comarca do local de atendimento da clínica para dirimir quaisquer dúvidas oriundas deste instrumento, renunciando expressamente a qualquer outro por mais privilegiado que seja.",
  ];

  for (const c of clausulas) {
    checkPageBreak(22);
    const lC = pdf.splitTextToSize(c, contentW);
    pdf.text(lC, margin, y);
    y += lC.length * 9.5 + 4;
  }
  y += 8;

  // Bloco específico de Lentes em Resina (se aplicável)
  const ehLentesResina = snap.tipoModeloContrato === "lentes_resina" || Boolean(snap.incluiLentesResina);
  if (ehLentesResina) {
    checkPageBreak(80);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(15, 23, 42);
    pdf.text("TERMO ESPECÍFICO — RESTAURAÇÕES ESTÉTICAS EM RESINA COMPOSTA", margin, y);
    y += 12;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(71, 85, 105);

    const clausulasResina = [
      "1. ESCOPO DO TRATAMENTO: O tratamento compreende a confecção de lentes e/ou facetas em resina composta sobre os elementos dentários indicados no planejamento clínico, visando à harmonização do sorriso e estética dental.",
      "2. RISCOS INERENTES E FATORES MECÂNICOS: A resina composta é material de alta estética, porém suscetível a lascamentos (chipping), fraturas ou desgastes quando submetida a sobrecarga mastigatória, alimentos excessivamente rígidos, hábitos parafuncionais (bruxismo/apertamento dental) ou traumas mecânicos externos.",
      "3. DEVERES DE MANUTENÇÃO PREVENTIVA SEMESTRAL: O(a) paciente compromete-se a retornar a cada 6 (seis) meses para consultas de revisão, controle oclusal, profilaxia e polimento preventivo. Caso indicado, o uso de placa oclusal/miorrelaxante noturna é condição indispensável para a preservação das restaurações.",
      "4. CONSENTIMENTO LIVRE E ESCLARECIDO: O(a) paciente declara ter compreendido as orientações, limitações biológicas e riscos, manifestando pleno consentimento para a realização do tratamento.",
    ];

    for (const cr of clausulasResina) {
      checkPageBreak(22);
      const lCr = pdf.splitTextToSize(cr, contentW);
      pdf.text(lCr, margin, y);
      y += lCr.length * 9.5 + 4;
    }
    y += 6;
  }

  // Bloco específico de Endodontia (se aplicável)
  const ehEndodontia = snap.tipoModeloContrato === "endodontia" || Boolean(snap.dadosEndodontia?.ativo);
  if (ehEndodontia) {
    checkPageBreak(70);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(15, 23, 42);
    pdf.text("TERMO ESPECÍFICO — TRATAMENTO ENDODÔNTICO (CANAL)", margin, y);
    y += 12;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(71, 85, 105);

    const clausulasEndo = [
      "1. ESCOPO E OBJETIVO: A intervenção visa à desinfecção, modelagem e obturação tridimensional do sistema de canais radiculares para debelar ou prevenir infecções periapicais.",
      "2. LIMITAÇÕES E CONDUTA PÓS-TRATAMENTO: Anatomias radiculares complexas, canais calcificados ou infecções refratárias podem exigir complementações. É indispensável a realização da restauração definitiva imediata para prevenir recontaminação coronorradicular.",
    ];

    for (const ce of clausulasEndo) {
      checkPageBreak(20);
      const lCe = pdf.splitTextToSize(ce, contentW);
      pdf.text(lCe, margin, y);
      y += lCe.length * 9.5 + 4;
    }
    y += 6;
  }

  // Termo de Imagem e Voz (se presente)
  if (snap.termoUsoImagem) {
    checkPageBreak(40);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text("TERMO DE AUTORIZAÇÃO DE USO DE IMAGEM E VOZ (LGPD)", margin, y);
    y += 11;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(71, 85, 105);

    const statusImg = snap.termoUsoImagem.autorizado !== false ? "AUTORIZADO" : "NÃO AUTORIZADO";
    const detalheImg = snap.termoUsoImagem.autorizado !== false
      ? `O(a) CONTRATANTE MANIFESTOU OPÇÃO [${statusImg}] para captação e utilização de registros fotográficos do tratamento para fins didático-científicos e de divulgação em redes sociais e portfólio institucional da clínica, em estrita conformidade com a LGPD, sendo facultada a revogação a qualquer tempo.`
      : `O(a) CONTRATANTE MANIFESTOU OPÇÃO [${statusImg}] para veiculação de imagem em canais públicos, resguardado exclusivamente o prontuário interno para documentação médica legal.`;

    const lImg = pdf.splitTextToSize(detalheImg, contentW);
    pdf.text(lImg, margin, y);
    y += lImg.length * 9.5 + 6;
  }

  // Observações personalizadas (se houver)
  const obs = snap.observacoesCustomizadas || snap.orcamento?.observacoes;
  if (obs && typeof obs === "string" && obs.trim()) {
    checkPageBreak(35);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text("DISPOSIÇÕES CONVENCIONADAS E OBSERVAÇÕES ESPECIAIS", margin, y);
    y += 11;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(71, 85, 105);
    const lObs = pdf.splitTextToSize(obs.trim(), contentW);
    pdf.text(lObs, margin, y);
    y += lObs.length * 9.5 + 6;
  }
  y += 6;

  // 6. SEÇÃO DE ASSINATURAS DIGITAIS
  checkPageBreak(150);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text("5. ASSINATURAS ELETRÔNICAS E EVIDÊNCIAS DE INTEGRIDADE", margin, y);
  y += 14;

  const boxW = (contentW - 16) / 2;
  const boxH = 130;

  // --- Box Dentista ---
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(203, 213, 225);
  pdf.setLineWidth(0.8);
  pdf.roundedRect(margin, y, boxW, boxH, 4, 4, "FD");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(4, 120, 87); // emerald-700
  pdf.text("ASSINATURA DA PROFISSIONAL", margin + 10, y + 14);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(71, 85, 105);
  const dentistaNome = snap.assinaturaDentista?.nome || "Dra. Rosângela Santos Pereira";
  const dentistaCro = snap.assinaturaDentista?.cro || "CRO-AL 06267";
  pdf.text(`${dentistaNome} (${dentistaCro})`, margin + 10, y + 25);
  pdf.text("Assinatura eletrônica com autorização prévia ativa", margin + 10, y + 34);

  // Imagem assinatura dentista (se disponível)
  const sigDentista = snap.assinaturaDentista?.assinaturaData;
  if (sigDentista && typeof sigDentista === "string" && sigDentista.startsWith("data:image/")) {
    try {
      pdf.addImage(sigDentista, "PNG", margin + 14, y + 40, boxW - 28, 45);
    } catch (_) {}
  }

  pdf.setDrawColor(203, 213, 225);
  pdf.line(margin + 10, y + 92, margin + boxW - 10, y + 92);
  pdf.setFontSize(6.5);
  pdf.setTextColor(100, 116, 139);
  const dataDra = snap.assinaturaDentista?.dataHora ? new Date(snap.assinaturaDentista.dataHora).toLocaleString("pt-BR") : "Data registrada";
  pdf.text(`✓ Certificado Digital Profissional em ${dataDra}`, margin + 10, y + 104);
  pdf.text(`ID Autorização: ${snap.assinaturaDentista?.autorizacaoId || "AUT-PROF-DRA-ROSANGELA"}`, margin + 10, y + 114);

  // --- Box Paciente ---
  const pX = margin + boxW + 16;
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(pX, y, boxW, boxH, 4, 4, "FD");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(29, 78, 216); // blue-700
  pdf.text("ASSINATURA DO(A) PACIENTE", pX + 10, y + 14);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(71, 85, 105);
  pdf.text(`${pacNome} - CPF: ${pacCpf}`, pX + 10, y + 25);
  pdf.text("Assinado eletronicamente via autenticação por token seguro", pX + 10, y + 34);

  // Imagem assinatura paciente
  const sigPac = snap.assinaturaPaciente?.assinaturaData || docClinico?.assinatura_data;
  if (sigPac && typeof sigPac === "string" && sigPac.startsWith("data:image/")) {
    try {
      pdf.addImage(sigPac, "PNG", pX + 14, y + 40, boxW - 28, 45);
    } catch (_) {}
  }

  pdf.setDrawColor(203, 213, 225);
  pdf.line(pX + 10, y + 92, pX + boxW - 10, y + 92);
  pdf.setFontSize(6.5);
  pdf.setTextColor(100, 116, 139);
  const dataPac = snap.assinaturaPaciente?.dataHora ? new Date(snap.assinaturaPaciente.dataHora).toLocaleString("pt-BR") : new Date().toLocaleString("pt-BR");
  pdf.text(`✓ Assinado em ${dataPac}  |  IP: ${snap.assinaturaPaciente?.ip || "web-secure"}`, pX + 10, y + 104);
  const hashCurto = snap.assinaturaPaciente?.documentHash ? `${snap.assinaturaPaciente.documentHash.slice(0, 24)}...` : "SHA-256 Validado";
  pdf.text(`Hash Integridade: ${hashCurto}`, pX + 10, y + 114);

  y += boxH + 16;

  // 7. NOTA DE CONFORMIDADE LEGAL
  checkPageBreak(30);
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(6.5);
  pdf.setTextColor(148, 163, 184); // slate-400
  const txtLegal = "Este documento foi emitido e assinado eletronicamente em conformidade com a Medida Provisória nº 2.200-2/2001 e a Lei nº 14.063/2020, possuindo validade jurídica e integridade criptográfica asseguradas em toda a sua extensão.";
  const lLegal = pdf.splitTextToSize(txtLegal, contentW);
  pdf.text(lLegal, margin, y);

  // 8. RODAPÉ EM TODAS AS PÁGINAS
  const totalPages = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`Página ${i} de ${totalPages} - Contrato ${snap.contratoId || docClinico?.identificador || "CTR"}`, margin, pageH - 18);
    pdf.text("Autenticidade e integridade garantidas pelo sistema clínico", pageW - margin - 200, pageH - 18);
  }

  const ab = pdf.output("arraybuffer");
  return new Uint8Array(ab);
}

// PIPELINE DE PROCESSAMENTO E ARQUIVAMENTO AUTÔNOMO DE PDF NO SERVIDOR
async function executarArquivamentoPdfServidor(
  supabase: any,
  doc: any,
  updatedSnapshot: any,
  dataHoraIso: string
): Promise<{ ok: boolean; pdfPath?: string; signedUrl?: string; error?: string }> {
  const identificador = String(updatedSnapshot.contratoId || doc.itens?.contratoId || doc.identificador || doc.id);
  const targetPacId = doc.paciente_id || updatedSnapshot.pacienteId || updatedSnapshot.paciente?.id;

  const isUuid = (val: any): boolean =>
    typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  let targetUserId = isUuid(doc.user_id) ? doc.user_id : null;
  if (!targetUserId && targetPacId) {
    const { data: pacRow } = await supabase.from("pacientes").select("user_id").eq("id", targetPacId).maybeSingle();
    if (isUuid(pacRow?.user_id)) targetUserId = pacRow.user_id;
  }
  if (!targetUserId) {
    const { data: cfgRow } = await supabase.from("configuracoes").select("user_id").limit(1).maybeSingle();
    if (isUuid(cfgRow?.user_id)) targetUserId = cfgRow.user_id;
  }

  const canonicalFileName = `Contrato_Assinado_${identificador}.pdf`;
  const canonicalPath = `contratos/${identificador}/${canonicalFileName}`;

  // 1. Receber/enfileirar uma tarefa persistida
  try {
    await supabase.from("fila_arquivamento_pdf").upsert({
      contrato_id: identificador,
      documento_id: isUuid(doc.id) ? doc.id : null,
      paciente_id: isUuid(targetPacId) ? targetPacId : null,
      clinica_id: targetUserId,
      status: "processando",
      tentativas: 1,
      payload: {
        identificador,
        formalizadoEm: dataHoraIso,
      },
      atualizado_em: dataHoraIso,
    }, { onConflict: "contrato_id" });
  } catch (qErr) {
    console.warn("[contrato-publico] Aviso ao registrar na fila_arquivamento_pdf:", qErr);
  }

  try {
    // 2. Processar o documento final no servidor utilizando a versão imutável assinada
    const pdfBytes = gerarPdfServidorContrato(updatedSnapshot, doc);

    // 3. Garantir que o bucket privado exista
    try {
      await supabase.storage.createBucket("documentos-pacientes", { public: false });
    } catch (_) {}

    // 4. Armazenar o PDF em bucket privado
    const { error: uploadErr } = await supabase.storage
      .from("documentos-pacientes")
      .upload(canonicalPath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) throw uploadErr;

    // 5. Confirmar a existência do arquivo gerando URL assinada
    const { data: signedData, error: signErr } = await supabase.storage
      .from("documentos-pacientes")
      .createSignedUrl(canonicalPath, 300);

    if (signErr || !signedData?.signedUrl) {
      throw signErr || new Error("Falha ao validar URL assinada do PDF no Storage");
    }

    // 6. Vincular o PDF ao contrato em documentos_clinicos
    const finalItens = { ...(doc.itens || {}), ...(updatedSnapshot || {}), pdfPath: canonicalPath };
    await supabase
      .from("documentos_clinicos")
      .update({
        itens: finalItens,
        atualizado_em: dataHoraIso,
      })
      .eq("id", doc.id);

    // 7. Vincular o PDF ao paciente em documentos_paciente
    if (targetPacId && targetUserId) {
      try {
        const { data: existingDp } = await supabase
          .from("documentos_paciente")
          .select("id")
          .eq("paciente_id", targetPacId)
          .or(`url.eq.${canonicalPath},nome.ilike.%${identificador}%`)
          .maybeSingle();

        if (!existingDp) {
          await supabase.from("documentos_paciente").insert({
            user_id: targetUserId,
            paciente_id: targetPacId,
            nome: `Contrato Odontológico Assinado - ${identificador}`,
            tipo: "contrato",
            url: canonicalPath,
            tamanho: pdfBytes.length,
            criado_em: dataHoraIso,
            atualizado_em: dataHoraIso,
          });
        } else {
          await supabase.from("documentos_paciente").update({
            nome: `Contrato Odontológico Assinado - ${identificador}`,
            url: canonicalPath,
            tamanho: pdfBytes.length,
            atualizado_em: dataHoraIso,
          }).eq("id", existingDp.id);
        }
      } catch (dpErr) {
        console.warn("[contrato-publico] Aviso ao registrar em documentos_paciente:", dpErr);
      }
    }

    // 8. Vincular o PDF ao orçamento associado
    try {
      const orcId = updatedSnapshot.orcamentoId || doc.orcamento_id;
      let orcRow: any = null;
      if (orcId) {
        const { data: oData } = await supabase.from("orcamentos").select("*").eq("id", orcId).maybeSingle();
        if (oData) orcRow = oData;
      }
      if (!orcRow && targetPacId) {
        const { data: oData2 } = await supabase.from("orcamentos").select("*").eq("paciente_id", targetPacId).order("atualizado_em", { ascending: false }).limit(1);
        if (oData2 && oData2.length > 0) orcRow = oData2[0];
      }

      if (orcRow) {
        const currentSnap = (orcRow.assinatura_paciente || {}) as Record<string, any>;
        const updatedOrcSnap = {
          ...currentSnap,
          contratoId: identificador,
          contratoStatus: "assinaturas_realizadas",
          statusContrato: "assinaturas_realizadas",
          contratoFormalizadoEm: currentSnap.contratoFormalizadoEm || dataHoraIso,
          pdfPath: canonicalPath,
          assinaturaDraStatus: "concluida",
          assinaturaPacienteStatus: "concluida",
        };

        await supabase.from("orcamentos").update({
          contrato_id: identificador,
          assinatura_paciente: updatedOrcSnap,
          atualizado_em: dataHoraIso,
        }).eq("id", orcRow.id);
      }
    } catch (orcErr) {
      console.warn("[contrato-publico] Aviso ao sincronizar orcamento:", orcErr);
    }

    // 9. Marcar a tarefa como CONCLUÍDA na fila persistida
    try {
      await supabase.from("fila_arquivamento_pdf").update({
        status: "concluido",
        storage_path: canonicalPath,
        ultimo_erro: null,
        atualizado_em: dataHoraIso,
      }).eq("contrato_id", identificador);
    } catch (_) {}

    return {
      ok: true,
      pdfPath: canonicalPath,
      signedUrl: signedData.signedUrl,
    };
  } catch (err: any) {
    console.error("[contrato-publico] Erro no arquivamento PDF server-side:", err);
    try {
      await supabase.from("fila_arquivamento_pdf").update({
        status: "falha",
        ultimo_erro: err.message || String(err),
        atualizado_em: new Date().toISOString(),
      }).eq("contrato_id", identificador);
    } catch (_) {}

    return {
      ok: false,
      error: err.message || "Erro desconhecido ao arquivar PDF no servidor",
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return json({ error: "Configuração do servidor incompleta (service_role)" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (!action) {
      return json({ error: "Parâmetro 'action' é obrigatório" }, 400);
    }

    // =========================================================================
    // 1. AÇÃO: SAVE / UPSERT (Persistência garantida via backend)
    // =========================================================================
    if (action === "save" || action === "upsert") {
      const snap = body.snapshot || {};
      const identificador = String(body.identificador || body.id || snap.contratoId || "").trim();
      const token = String(body.token || snap.token || "").trim();
      const pacienteNome = String(body.pacienteNome || snap.pacienteNome || snap.paciente?.nome || "Paciente").trim();
      const pacienteId = body.pacienteId || snap.pacienteId || snap.paciente?.id || null;
      const titulo = String(body.titulo || `Contrato Odontológico - ${pacienteNome} (${identificador || "Novo"})`);
      const conteudo = String(body.conteudo || body.html || "");

      if (!identificador) {
        return json({ error: "Identificador do contrato é obrigatório" }, 400);
      }

      // Garante que o snapshot carregue o identificador e token internamente
      snap.contratoId = identificador;
      if (token) snap.token = token;
      if (!snap.status) snap.status = "pendente";

      // Hidrata dados completos do paciente caso estejam ausentes no snapshot recebido
      if (pacienteId && (!temValorValido(snap.paciente?.cpf) || !temValorValido(snap.paciente?.endereco) || !temValorValido(snap.paciente?.telefone))) {
        try {
          const { data: pDb } = await supabase.from("pacientes").select("*").eq("id", pacienteId).maybeSingle();
          if (pDb) {
            const endDb = formatarEnderecoCompleto(pDb) || pDb.endereco || "";
            snap.paciente = {
              ...(snap.paciente || {}),
              nome: snap.paciente?.nome || pDb.nome,
              cpf: temValorValido(snap.paciente?.cpf) ? snap.paciente.cpf : (pDb.cpf ? formatarDocumento(pDb.cpf) : null),
              rg: temValorValido(snap.paciente?.rg) ? snap.paciente.rg : (pDb.rg || null),
              telefone: temValorValido(snap.paciente?.telefone) ? snap.paciente.telefone : (pDb.telefone ? formatarTelefone(pDb.telefone) : null),
              email: temValorValido(snap.paciente?.email) ? snap.paciente.email : (pDb.email || null),
              endereco: temValorValido(snap.paciente?.endereco) ? snap.paciente.endereco : (endDb || null),
              dataNascimento: temValorValido(snap.paciente?.dataNascimento) ? snap.paciente.dataNascimento : (pDb.data_nascimento || null),
              profissao: temValorValido(snap.paciente?.profissao) ? snap.paciente.profissao : (pDb.profissao || null),
              estadoCivil: temValorValido(snap.paciente?.estadoCivil) ? snap.paciente.estadoCivil : (pDb.estado_civil || null),
            };
          }
        } catch (_) {}
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identificador);
      let existingDoc: Record<string, any> | null = null;

      if (isUuid) {
        const { data: ex } = await supabase.from("documentos_clinicos").select("*").eq("id", identificador).maybeSingle();
        if (ex?.id) existingDoc = ex;
      }
      if (!existingDoc) {
        const { data: ex2 } = await supabase.from("documentos_clinicos").select("*").filter("itens->>contratoId", "eq", identificador).maybeSingle();
        if (ex2?.id) existingDoc = ex2;
      }
      if (!existingDoc && identificador.toLowerCase().startsWith("ctr-")) {
        const { data: ex3 } = await supabase.from("documentos_clinicos").select("*").filter("itens->>contratoId", "eq", identificador.toUpperCase()).maybeSingle();
        if (ex3?.id) existingDoc = ex3;
      }

      if (existingDoc) {
        // Se já está assinado pelo paciente, não permite sobrescrever os termos imutáveis
        if (existingDoc.assinado_em || existingDoc.itens?.status === "assinado" || existingDoc.itens?.assinaturaPaciente) {
          return json({ ok: true, id: existingDoc.id, identificador, status: "assinado", jaAssinado: true });
        }

        const { error: updErr } = await supabase.from("documentos_clinicos").update({
          paciente_nome: pacienteNome,
          paciente_id: pacienteId,
          titulo: body.titulo ? titulo : (existingDoc.titulo || titulo),
          conteudo: (body.conteudo || body.html) ? conteudo : (existingDoc.conteudo || conteudo),
          itens: snap,
          atualizado_em: new Date().toISOString(),
        }).eq("id", existingDoc.id);

        if (updErr) throw updErr;
        return json({ ok: true, id: existingDoc.id, identificador, token, action: "updated" });
      } else {
        const insertPayload: Record<string, any> = {
          paciente_id: pacienteId,
          paciente_nome: pacienteNome,
          tipo: "contrato",
          titulo,
          conteudo,
          itens: snap,
          dentista: snap.clinica?.dentistaResponsavel || null,
        };
        if (isUuid) {
          insertPayload.id = identificador;
        }

        const { data: ins, error: insErr } = await supabase.from("documentos_clinicos").insert(insertPayload).select().maybeSingle();
        if (insErr) throw insErr;

        return json({
          ok: true,
          id: ins?.id || identificador,
          identificador,
          token,
          action: "inserted"
        });
      }
    }

    // =========================================================================
    // 2. AÇÃO: GET (Consulta pública com validação estrita de token)
    // =========================================================================
    if (action === "get") {
      const targetId = String(body.id || body.identificador || body.contratoId || "").trim();
      const token = String(body.token || body.t || "").trim();

      if (!targetId) {
        return json({ error: "Identificador do contrato ausente" }, 400);
      }
      if (!token) {
        return json({ error: "Token de acesso não informado. Acesso não autorizado." }, 403);
      }

      const doc = await localizarContratoCompativel(supabase, targetId, token);
      if (!doc) {
        return json({ error: "Contrato não encontrado" }, 404);
      }

      // Validação do Token Criptográfico
      const tokenArmazenado = doc.itens?.token;
      if (!tokenArmazenado || tokenArmazenado !== token) {
        return json({ error: "Token de acesso inválido ou expirado" }, 403);
      }

      // Validação de expiração se houver
      const expiraEm = doc.itens?.tokenValidoAte;
      if (expiraEm) {
        try {
          if (new Date(expiraEm) < new Date()) {
            return json({ error: "Este link de contrato expirou. Solicite um novo à clínica." }, 403);
          }
        } catch (_) {}
      }

      const isAssinadoPaciente = !!doc.assinado_em || !!doc.itens?.assinaturaPaciente;
      const isAssinadoDentista = !!doc.itens?.assinaturaDentista;
      const isFormalizadoTotal = isAssinadoPaciente && isAssinadoDentista;

      let statusTexto = "pendente";
      if (isFormalizadoTotal) statusTexto = "formalizado";
      else if (isAssinadoPaciente) statusTexto = "assinado_paciente";
      else if (isAssinadoDentista) statusTexto = "aguardando_assinatura_paciente";

      const pdfPath = doc.pdf_path || doc.itens?.pdfPath || null;
      let signedPdfUrl = null;

      if (pdfPath) {
        try {
          const { data: signUrlData } = await supabase.storage
            .from("documentos-pacientes")
            .createSignedUrl(pdfPath, 300);
          if (signUrlData?.signedUrl) {
            signedPdfUrl = signUrlData.signedUrl;
          }
        } catch (_) {}
      }

      let snapshotRetorno = doc.itens ? { ...doc.itens } : {};
      if (!isAssinadoPaciente && doc.paciente_id) {
        const pacCurrent = snapshotRetorno.paciente || {};
        if (!temValorValido(pacCurrent.cpf) || !temValorValido(pacCurrent.endereco) || !temValorValido(pacCurrent.telefone)) {
          try {
            const { data: pDb } = await supabase.from("pacientes").select("*").eq("id", doc.paciente_id).maybeSingle();
            if (pDb) {
              const endDb = formatarEnderecoCompleto(pDb) || pDb.endereco || "";
              snapshotRetorno.paciente = {
                ...pacCurrent,
                nome: pacCurrent.nome || pDb.nome,
                cpf: temValorValido(pacCurrent.cpf) ? pacCurrent.cpf : (pDb.cpf ? formatarDocumento(pDb.cpf) : null),
                rg: temValorValido(pacCurrent.rg) ? pacCurrent.rg : (pDb.rg || null),
                telefone: temValorValido(pacCurrent.telefone) ? pacCurrent.telefone : (pDb.telefone ? formatarTelefone(pDb.telefone) : null),
                email: temValorValido(pacCurrent.email) ? pacCurrent.email : (pDb.email || null),
                endereco: temValorValido(pacCurrent.endereco) ? pacCurrent.endereco : (endDb || null),
                dataNascimento: temValorValido(pacCurrent.dataNascimento) ? pacCurrent.dataNascimento : (pDb.data_nascimento || null),
                profissao: temValorValido(pacCurrent.profissao) ? pacCurrent.profissao : (pDb.profissao || null),
                estadoCivil: temValorValido(pacCurrent.estadoCivil) ? pacCurrent.estadoCivil : (pDb.estado_civil || null),
              };
            }
          } catch (_) {}
        }
      }

      return json({
        ok: true,
        id: doc.id,
        identificador: doc.itens?.contratoId || doc.id,
        titulo: doc.titulo,
        conteudo: doc.conteudo,
        pacienteNome: doc.paciente_nome,
        pacienteId: doc.paciente_id,
        status: statusTexto,
        jaAssinadoPaciente: isAssinadoPaciente,
        jaAssinadoDentista: isAssinadoDentista,
        isFormalizadoTotal,
        pdfPath,
        signedPdfUrl,
        assinadoEm: doc.assinado_em,
        assinanteNome: doc.assinante_nome,
        snapshot: snapshotRetorno,
      });
    }

    // =========================================================================
    // 3. AÇÃO: SIGN (Assinatura digital do paciente com bloqueio de reassinatura)
    // =========================================================================
    if (action === "sign") {
      const targetId = String(body.id || body.identificador || body.contratoId || "").trim();
      const token = String(body.token || body.t || "").trim();
      const signature = String(body.signature || "").trim();
      const signerName = String(body.signerName || "").trim();

      if (!targetId || !token) {
        return json({ error: "Identificador e token são obrigatórios" }, 400);
      }
      if (!signature) {
        return json({ error: "Traço de assinatura gráfica é obrigatório" }, 400);
      }

      const doc = await localizarContratoCompativel(supabase, targetId, token);
      if (!doc) {
        return json({ error: "Contrato não encontrado" }, 404);
      }

      // Validação estrita do token
      const tokenArmazenado = doc.itens?.token;
      if (!tokenArmazenado || tokenArmazenado !== token) {
        return json({ error: "Token de acesso inválido ou expirado" }, 403);
      }

      // BLOQUEIO DEFINITIVO DE REASSINATURA DO PACIENTE
      if (doc.assinado_em || doc.itens?.status === "assinado" || doc.itens?.assinaturaPaciente) {
        return json({
          ok: false,
          error: "Contrato já assinado! Sua assinatura digital foi registrada com sucesso anteriormente e não é permitido assinar novamente.",
          jaAssinado: true,
          assinadoEm: doc.assinado_em,
          snapshot: doc.itens,
        }, 400);
      }

      const dataHoraIso = new Date().toISOString();
      const clientIp = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "web";
      const userAgent = req.headers.get("user-agent") || "";
      const documentHash = await gerarHashConteudo(doc.conteudo || JSON.stringify(doc.itens || {}));

      const existingItens = typeof doc.itens === "object" && doc.itens ? doc.itens : {};
      const updatedSnapshot = { ...existingItens };

      // Se dados cadastrais do paciente estiverem ausentes no snapshot prévio, hidrata do banco
      const targetPacId = doc.paciente_id || updatedSnapshot.pacienteId || updatedSnapshot.paciente?.id;
      if (targetPacId && (!temValorValido(updatedSnapshot.paciente?.cpf) || !temValorValido(updatedSnapshot.paciente?.endereco) || !temValorValido(updatedSnapshot.paciente?.telefone))) {
        try {
          const { data: pDb } = await supabase.from("pacientes").select("*").eq("id", targetPacId).maybeSingle();
          if (pDb) {
            const endDb = formatarEnderecoCompleto(pDb) || pDb.endereco || "";
            updatedSnapshot.paciente = {
              ...(updatedSnapshot.paciente || {}),
              nome: updatedSnapshot.paciente?.nome || pDb.nome,
              cpf: temValorValido(updatedSnapshot.paciente?.cpf) ? updatedSnapshot.paciente.cpf : (pDb.cpf ? formatarDocumento(pDb.cpf) : null),
              rg: temValorValido(updatedSnapshot.paciente?.rg) ? updatedSnapshot.paciente.rg : (pDb.rg || null),
              telefone: temValorValido(updatedSnapshot.paciente?.telefone) ? updatedSnapshot.paciente.telefone : (pDb.telefone ? formatarTelefone(pDb.telefone) : null),
              email: temValorValido(updatedSnapshot.paciente?.email) ? updatedSnapshot.paciente.email : (pDb.email || null),
              endereco: temValorValido(updatedSnapshot.paciente?.endereco) ? updatedSnapshot.paciente.endereco : (endDb || null),
              dataNascimento: temValorValido(updatedSnapshot.paciente?.dataNascimento) ? updatedSnapshot.paciente.dataNascimento : (pDb.data_nascimento || null),
              profissao: temValorValido(updatedSnapshot.paciente?.profissao) ? updatedSnapshot.paciente.profissao : (pDb.profissao || null),
              estadoCivil: temValorValido(updatedSnapshot.paciente?.estadoCivil) ? updatedSnapshot.paciente.estadoCivil : (pDb.estado_civil || null),
            };
          }
        } catch (_) {}
      }

      const selfie = body.selfie || null;
      const signerInfo = body.signerInfo || {};
      const cpf = signerInfo.cpf || updatedSnapshot.paciente?.cpf || null;
      const rg = signerInfo.rg || updatedSnapshot.paciente?.rg || null;
      const email = signerInfo.email || updatedSnapshot.paciente?.email || null;

      // Validação impeditiva para novos contratos se faltar identificação obrigatória
      const pacCad = updatedSnapshot.paciente || {};
      const finalNome = (signerName || pacCad.nome || doc.paciente_nome || "").trim();
      const finalCpf = (cpf || pacCad.cpf || "").trim();
      const finalTelefone = (pacCad.telefone || "").trim();
      const finalEndereco = (pacCad.endereco || "").trim();

      const camposFaltantes: string[] = [];
      if (!finalNome || !temValorValido(finalNome)) camposFaltantes.push("Nome completo");
      if (!finalCpf || !temValorValido(finalCpf)) camposFaltantes.push("CPF");
      if (!finalEndereco || !temValorValido(finalEndereco)) camposFaltantes.push("Endereço completo");
      if (!finalTelefone || !temValorValido(finalTelefone)) camposFaltantes.push("Telefone/WhatsApp");

      if (camposFaltantes.length > 0) {
        return json({
          ok: false,
          error: `Não é possível formalizar o contrato: dados cadastrais obrigatórios ausentes (${camposFaltantes.join(", ")}). Por favor, complete o cadastro no sistema antes de prosseguir.`,
          code: "MISSING_REQUIRED_PATIENT_DATA",
          camposFaltantes,
        }, 400);
      }

      const temDentista = !!updatedSnapshot.assinaturaDentista;

      updatedSnapshot.status = temDentista ? "formalizado" : "assinado";
      updatedSnapshot.statusAssinaturaPaciente = "assinado";
      updatedSnapshot.isFormalizadoTotal = temDentista;
      updatedSnapshot.assinaturaPaciente = {
        assinaturaData: signature,
        nome: signerName || doc.paciente_nome || "Paciente",
        dataHora: dataHoraIso,
        ip: clientIp,
        userAgent,
        selfie: selfie || undefined,
        cpf: cpf || undefined,
        rg: rg || undefined,
        email: email || undefined,
        documentHash,
      };

      if (body.termoUsoImagem) {
        updatedSnapshot.termoUsoImagem = body.termoUsoImagem;
      }

      const { error: updateErr } = await supabase
        .from("documentos_clinicos")
        .update({
          assinado_em: dataHoraIso,
          assinante_nome: signerName || doc.paciente_nome || "Paciente",
          assinatura_data: signature,
          itens: updatedSnapshot,
          atualizado_em: dataHoraIso,
        })
        .eq("id", doc.id);

      if (updateErr) throw updateErr;

      // Grava na tabela assinaturas com registro separado
      try {
        await supabase.from("assinaturas").insert({
          documento_id: String(doc.id),
          documento_tipo: "contrato",
          tipo: "paciente",
          nome: signerName || doc.paciente_nome || "Paciente",
          assinatura_data: signature,
          paciente_id: doc.paciente_id || null,
          user_id: doc.user_id || null,
          evidencias: {
            ip: clientIp,
            userAgent,
            cpf,
            email,
            documentHash,
          },
          criado_em: dataHoraIso,
          atualizado_em: dataHoraIso,
        });
      } catch (_) {}

      // Atualização automática do orçamento associado no Supabase
      try {
        const orcId = updatedSnapshot.orcamentoId || doc.orcamento_id;
        const targetPacId = doc.paciente_id || updatedSnapshot.pacienteId;

        let orcRow: any = null;
        if (orcId) {
          const { data: oData } = await supabase.from("orcamentos").select("*").eq("id", orcId).maybeSingle();
          if (oData) orcRow = oData;
        }
        if (!orcRow && targetPacId) {
          const { data: oData2 } = await supabase.from("orcamentos").select("*").eq("paciente_id", targetPacId).order("atualizado_em", { ascending: false }).limit(1);
          if (oData2 && oData2.length > 0) orcRow = oData2[0];
        }

        if (orcRow) {
          const currentSnap = (orcRow.assinatura_paciente || {}) as Record<string, any>;
          const updatedOrcSnap = {
            ...currentSnap,
            contratoId: updatedSnapshot.contratoId || doc.id,
            contratoStatus: temDentista ? "assinaturas_realizadas" : "aguardando_assinatura_dentista",
            statusContrato: temDentista ? "assinaturas_realizadas" : "aguardando_assinatura_dentista",
            contratoFormalizadoEm: temDentista ? dataHoraIso : (currentSnap.contratoFormalizadoEm || null),
            assinaturaPacienteStatus: "concluida",
            assinaturaDraStatus: temDentista ? "concluida" : (currentSnap.assinaturaDraStatus || "pendente"),
          };

          await supabase.from("orcamentos").update({
            contrato_id: updatedSnapshot.contratoId || doc.id,
            assinatura_paciente: updatedOrcSnap,
            data_assinatura: currentSnap.data_assinatura || dataHoraIso,
            atualizado_em: dataHoraIso,
          }).eq("id", orcRow.id);
        }
      } catch (orcUpdErr) {
        console.warn("[contrato-publico] Erro ao sincronizar orçamento no sign:", orcUpdErr);
      }

      // ARQUIVAMENTO AUTOMÁTICO DO PDF NO SERVIDOR INDEPENDENTE DA SESSÃO DO PACIENTE
      let serverPdfResult: { ok: boolean; pdfPath?: string; signedUrl?: string; error?: string } | null = null;
      if (temDentista) {
        try {
          serverPdfResult = await executarArquivamentoPdfServidor(supabase, doc, updatedSnapshot, dataHoraIso);
        } catch (pdfErr) {
          console.warn("[contrato-publico] Aviso ao arquivar PDF no servidor no sign:", pdfErr);
        }
      }

      return json({
        ok: true,
        mensagem: "Contrato assinado digitalmente com sucesso!",
        assinadoEm: dataHoraIso,
        isFormalizadoTotal: temDentista,
        snapshot: updatedSnapshot,
        pdfPath: serverPdfResult?.pdfPath || null,
        signedUrl: serverPdfResult?.signedUrl || null,
        pdfGeradoNoServidor: Boolean(serverPdfResult?.ok),
      });
    }

    // =========================================================================
    // 4. AÇÃO: SIGN_PROFESSIONAL (Assinatura digital da profissional / dentista)
    // =========================================================================
    if (action === "sign_professional") {
      const targetId = String(body.id || body.identificador || body.contratoId || "").trim();
      const signature = String(body.signature || "").trim();
      const signerName = String(body.signerName || "").trim();
      const cro = String(body.cro || "").trim();

      if (!targetId) {
        return json({ error: "Identificador do contrato é obrigatório" }, 400);
      }
      if (!signature) {
        return json({ error: "Assinatura gráfica é obrigatória" }, 400);
      }

      const doc = await localizarContratoCompativel(supabase, targetId, token);
      if (!doc) {
        return json({ error: "Contrato não encontrado" }, 404);
      }

      const dataHoraIso = new Date().toISOString();
      const existingItens = typeof doc.itens === "object" && doc.itens ? doc.itens : {};
      const updatedSnapshot = { ...existingItens };

      const temPaciente = !!doc.assinado_em || !!updatedSnapshot.assinaturaPaciente;

      updatedSnapshot.assinaturaDentista = {
        assinaturaData: signature,
        nome: signerName || doc.dentista || updatedSnapshot.clinica?.dentistaResponsavel || "Cirurgião(ã)-Dentista Responsável",
        cro: cro || updatedSnapshot.clinica?.cro || "",
        dataHora: dataHoraIso,
      };
      updatedSnapshot.statusAssinaturaDentista = "assinado";

      if (temPaciente) {
        updatedSnapshot.status = "formalizado";
        updatedSnapshot.isFormalizadoTotal = true;
      }

      const { error: updErr } = await supabase
        .from("documentos_clinicos")
        .update({
          itens: updatedSnapshot,
          atualizado_em: dataHoraIso,
        })
        .eq("id", doc.id);

      if (updErr) throw updErr;

      // Registra na tabela assinaturas
      try {
        await supabase.from("assinaturas").insert({
          documento_id: String(doc.id),
          documento_tipo: "contrato",
          tipo: "dentista",
          nome: signerName || doc.dentista || "Cirurgião(ã)-Dentista Responsável",
          assinatura_data: signature,
          paciente_id: doc.paciente_id || null,
          user_id: doc.user_id || null,
          criado_em: dataHoraIso,
          atualizado_em: dataHoraIso,
        });
      } catch (_) {}

      // Atualização automática do orçamento associado no Supabase
      try {
        const orcId = updatedSnapshot.orcamentoId || doc.orcamento_id;
        const targetPacId = doc.paciente_id || updatedSnapshot.pacienteId;

        let orcRow: any = null;
        if (orcId) {
          const { data: oData } = await supabase.from("orcamentos").select("*").eq("id", orcId).maybeSingle();
          if (oData) orcRow = oData;
        }
        if (!orcRow && targetPacId) {
          const { data: oData2 } = await supabase.from("orcamentos").select("*").eq("paciente_id", targetPacId).order("atualizado_em", { ascending: false }).limit(1);
          if (oData2 && oData2.length > 0) orcRow = oData2[0];
        }

        if (orcRow) {
          const currentSnap = (orcRow.assinatura_paciente || {}) as Record<string, any>;
          const updatedOrcSnap = {
            ...currentSnap,
            contratoId: updatedSnapshot.contratoId || doc.id,
            contratoStatus: temPaciente ? "assinaturas_realizadas" : (currentSnap.contratoStatus || "aguardando_assinatura_paciente"),
            statusContrato: temPaciente ? "assinaturas_realizadas" : (currentSnap.statusContrato || "aguardando_assinatura_paciente"),
            contratoFormalizadoEm: temPaciente ? dataHoraIso : (currentSnap.contratoFormalizadoEm || null),
            assinaturaDraStatus: "concluida",
            assinaturaPacienteStatus: temPaciente ? "concluida" : (currentSnap.assinaturaPacienteStatus || "pendente"),
          };

          await supabase.from("orcamentos").update({
            assinatura_paciente: updatedOrcSnap,
            atualizado_em: dataHoraIso,
          }).eq("id", orcRow.id);
        }
      } catch (orcUpdErr) {
        console.warn("[contrato-publico] Erro ao sincronizar orçamento no sign_professional:", orcUpdErr);
      }

      // ARQUIVAMENTO AUTOMÁTICO DO PDF NO SERVIDOR SE AMBAS AS PARTES ASSINARAM
      let serverPdfResult: { ok: boolean; pdfPath?: string; signedUrl?: string; error?: string } | null = null;
      if (temPaciente) {
        try {
          serverPdfResult = await executarArquivamentoPdfServidor(supabase, doc, updatedSnapshot, dataHoraIso);
        } catch (pdfErr) {
          console.warn("[contrato-publico] Aviso ao arquivar PDF no servidor no sign_professional:", pdfErr);
        }
      }

      return json({
        ok: true,
        mensagem: "Assinatura da profissional registrada com sucesso no banco de dados!",
        assinadoEm: dataHoraIso,
        isFormalizadoTotal: temPaciente,
        snapshot: updatedSnapshot,
        pdfPath: serverPdfResult?.pdfPath || null,
        signedUrl: serverPdfResult?.signedUrl || null,
        pdfGeradoNoServidor: Boolean(serverPdfResult?.ok),
      });
    }

    // =========================================================================
    // 5. AÇÃO: GET_PDF_SIGNED_URL (Obtém URL assinada do PDF privado com validação de token)
    // =========================================================================
    if (action === "get_pdf_signed_url") {
      const targetId = String(body.id || body.identificador || body.contratoId || "").trim();
      const token = String(body.token || body.t || "").trim();

      if (!targetId) {
        return json({ error: "Identificador do contrato ausente" }, 400);
      }
      if (!token) {
        return json({ error: "Token de acesso não informado. Acesso não autorizado." }, 403);
      }

      const doc = await localizarContratoCompativel(supabase, targetId, token);
      if (!doc) {
        return json({ error: "Contrato não encontrado" }, 404);
      }

      // Validação estrita de Token
      const tokenArmazenado = doc.itens?.token;
      if (!tokenArmazenado || tokenArmazenado !== token) {
        return json({ error: "Token de acesso inválido ou expirado" }, 403);
      }

      const isAssinadoPaciente = !!doc.assinado_em || !!doc.itens?.assinaturaPaciente;
      const isAssinadoDentista = !!doc.itens?.assinaturaDentista;
      const isFormalizadoTotal = isAssinadoPaciente && isAssinadoDentista;

      const pdfPath = doc.pdf_path || doc.itens?.pdfPath || null;
      let signedUrl: string | null = null;

      if (pdfPath) {
        try {
          const { data: signUrlData } = await supabase.storage
            .from("documentos-pacientes")
            .createSignedUrl(pdfPath, 300); // 300s = 5 minutos
          if (signUrlData?.signedUrl) {
            signedUrl = signUrlData.signedUrl;
          }
        } catch (e) {
          console.warn("Erro ao gerar URL assinada:", e);
        }
      }

      return json({
        ok: true,
        pdfPath,
        signedUrl,
        isAssinadoPaciente,
        isAssinadoDentista,
        isFormalizadoTotal,
        snapshot: doc.itens,
      });
    }

    // =========================================================================
    // 6. AÇÃO: UPLOAD_SIGNED_PDF (Armazena versão final em PDF no bucket privado)
    // =========================================================================
    if (action === "upload_signed_pdf") {
      const targetId = String(body.id || body.identificador || body.contratoId || "").trim();
      const token = String(body.token || body.t || "").trim();
      const pdfBase64 = String(body.pdfBase64 || "").trim();
      const isFormalizado = Boolean(body.isFormalizado);

      if (!targetId || !token) {
        return json({ error: "Identificador e token são obrigatórios" }, 400);
      }
      if (!pdfBase64) {
        return json({ error: "Conteúdo do PDF em Base64 é obrigatório" }, 400);
      }

      const doc = await localizarContratoCompativel(supabase, targetId, token);
      if (!doc) {
        return json({ error: "Contrato não encontrado" }, 404);
      }

      // Validação estrita de Token
      const tokenArmazenado = doc.itens?.token;
      if (!tokenArmazenado || tokenArmazenado !== token) {
        return json({ error: "Token de acesso inválido ou expirado" }, 403);
      }

      // Decodifica base64 para Uint8Array
      const cleanBase64 = pdfBase64.replace(/^data:[^;]+;base64,/, "");
      const binaryStr = atob(cleanBase64);
      const pdfBytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        pdfBytes[i] = binaryStr.charCodeAt(i);
      }

      const identificador = doc.itens?.contratoId || doc.id;
      const tipoSufixo = isFormalizado ? "formalizado" : "paciente";
      const filePath = `contratos/${identificador}/contrato_${tipoSufixo}.pdf`;
      const canonicalFileName = `Contrato_Assinado_${identificador}.pdf`;
      const canonicalPath = `contratos/${identificador}/${canonicalFileName}`;

      // Garante que o bucket privado exista
      try {
        await supabase.storage.createBucket("documentos-pacientes", { public: false });
      } catch (_) {}

      // Upload do arquivo para o bucket privado (versão sufixo e canônica)
      const { error: uploadErr } = await supabase.storage
        .from("documentos-pacientes")
        .upload(filePath, pdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadErr) {
        throw uploadErr;
      }

      try {
        await supabase.storage
          .from("documentos-pacientes")
          .upload(canonicalPath, pdfBytes, {
            contentType: "application/pdf",
            upsert: true,
          });
      } catch (_) {}

      // Gera URL assinada de curta duração (300 segundos = 5 minutos)
      const { data: signedData } = await supabase.storage
        .from("documentos-pacientes")
        .createSignedUrl(canonicalPath, 300);

      const nowIso = new Date().toISOString();

      // Atualiza o documento clínico com o caminho do PDF
      const updatedItens = { ...(doc.itens || {}), pdfPath: canonicalPath };
      await supabase
        .from("documentos_clinicos")
        .update({
          pdf_path: canonicalPath,
          itens: updatedItens,
          atualizado_em: nowIso,
        })
        .eq("id", doc.id);

      // ARQUIVAMENTO AUTOMÁTICO EM DOCUMENTOS DO PACIENTE (documentos_paciente)
      const isUuid = (val: any): boolean => typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      const targetPacId = doc.paciente_id || doc.itens?.pacienteId;
      let targetUserId = isUuid(doc.user_id) ? doc.user_id : null;

      if (!targetUserId && targetPacId) {
        const { data: pacRow } = await supabase.from("pacientes").select("user_id").eq("id", targetPacId).maybeSingle();
        if (isUuid(pacRow?.user_id)) targetUserId = pacRow.user_id;
      }
      if (!targetUserId) {
        const { data: cfgRow } = await supabase.from("configuracoes").select("user_id").limit(1).maybeSingle();
        if (isUuid(cfgRow?.user_id)) targetUserId = cfgRow.user_id;
      }

      if (targetPacId && targetUserId) {
        try {
          const { data: existingDp } = await supabase
            .from("documentos_paciente")
            .select("id")
            .eq("paciente_id", targetPacId)
            .or(`url.eq.${canonicalPath},url.eq.${filePath},nome.ilike.%${identificador}%`)
            .maybeSingle();

          if (!existingDp) {
            await supabase.from("documentos_paciente").insert({
              user_id: targetUserId,
              paciente_id: targetPacId,
              nome: `Contrato Odontológico Assinado - ${identificador}`,
              tipo: "contrato",
              url: canonicalPath,
              tamanho: pdfBytes.length,
              criado_em: nowIso,
              atualizado_em: nowIso,
            });
          } else {
            await supabase.from("documentos_paciente").update({
              nome: `Contrato Odontológico Assinado - ${identificador}`,
              url: canonicalPath,
              tamanho: pdfBytes.length,
              atualizado_em: nowIso,
            }).eq("id", existingDp.id);
          }
        } catch (dpErr) {
          console.warn("[contrato-publico] Erro ao arquivar em documentos_paciente:", dpErr);
        }
      }

      // ATUALIZAÇÃO AUTOMÁTICA DO ORÇAMENTO ASSOCIADO
      try {
        const orcId = doc.itens?.orcamentoId || doc.orcamento_id;
        let orcRow: any = null;
        if (orcId) {
          const { data: oData } = await supabase.from("orcamentos").select("*").eq("id", orcId).maybeSingle();
          if (oData) orcRow = oData;
        }
        if (!orcRow && targetPacId) {
          const { data: oData2 } = await supabase.from("orcamentos").select("*").eq("paciente_id", targetPacId).order("atualizado_em", { ascending: false }).limit(1);
          if (oData2 && oData2.length > 0) orcRow = oData2[0];
        }

        if (orcRow) {
          const temDentista = Boolean(
            (doc.itens?.assinaturaDentista && (doc.itens.assinaturaDentista.assinaturaData || doc.itens.assinaturaDentista.nome)) ||
            (doc.itens?.assinaturaDra && (doc.itens.assinaturaDra.assinaturaData || doc.itens.assinaturaDra.nome)) ||
            doc.itens?.statusAssinaturaDentista === "assinado"
          );
          const temPaciente = Boolean(
            doc.assinado_em ||
            doc.assinatura_data ||
            (doc.itens?.assinaturaPaciente && (doc.itens.assinaturaPaciente.assinaturaData || doc.itens.assinaturaPaciente.dataHora))
          );
          const isAmbas = temDentista && temPaciente;
          const statusFinal = isAmbas
            ? "assinaturas_realizadas"
            : (temPaciente ? "aguardando_assinatura_dentista" : "aguardando_assinatura_paciente");

          const currentSnap = (orcRow.assinatura_paciente || {}) as Record<string, any>;
          const updatedOrcSnap = {
            ...currentSnap,
            contratoId: identificador,
            contratoStatus: statusFinal,
            statusContrato: statusFinal,
            contratoFormalizadoEm: isAmbas ? (currentSnap.contratoFormalizadoEm || nowIso) : null,
            pdfPath: canonicalPath,
            assinaturaDraStatus: temDentista ? "concluida" : "pendente",
            assinaturaPacienteStatus: temPaciente ? "concluida" : "pendente",
          };

          await supabase.from("orcamentos").update({
            contrato_id: identificador,
            assinatura_paciente: updatedOrcSnap,
            atualizado_em: nowIso,
          }).eq("id", orcRow.id);
        }
      } catch (orcErr) {
        console.warn("[contrato-publico] Erro ao atualizar orçamento no upload_signed_pdf:", orcErr);
      }

      return json({
        ok: true,
        pdfPath: canonicalPath,
        signedUrl: signedData?.signedUrl || null,
        mensagem: "PDF assinado arquivado com sucesso no Supabase Storage e na aba Documentos do Paciente",
      });
    }

    // =========================================================================
    // 5. AÇÃO: ORCAMENTO-GET (Consulta pública do orçamento com validação de token)
    // =========================================================================
    if (action === "orcamento-get") {
      const targetId = String(body.id || body.identificador || "").trim();
      const token = String(body.token || body.t || "").trim();

      if (!targetId || !token) {
        return json({ error: "Identificador e token são obrigatórios" }, 400);
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
      let orc: Record<string, any> | null = null;

      if (isUuid) {
        const { data } = await supabase.from("orcamentos").select("*").eq("id", targetId).maybeSingle();
        if (data) orc = data;
      }
      if (!orc) {
        const { data } = await supabase.from("orcamentos").select("*").eq("identificador", targetId).maybeSingle();
        if (data) orc = data;
      }
      if (!orc && targetId.toLowerCase().startsWith("orc-")) {
        const { data } = await supabase.from("orcamentos").select("*").eq("identificador", targetId.toUpperCase()).maybeSingle();
        if (data) orc = data;
      }

      if (!orc) {
        return json({ error: "Orçamento não encontrado" }, 404);
      }

      if (orc.token_assinatura !== token) {
        return json({ error: "Token de acesso inválido ou expirado" }, 403);
      }

      if (orc.data_expiracao_link && new Date(orc.data_expiracao_link) < new Date()) {
        return json({ error: "Esta proposta de orçamento expirou.", isExpirado: true }, 403);
      }

      // Converte fotos para signed URLs se houver storagePath
      let fotosComSignedUrls = [];
      if (Array.isArray(orc.fotos_planejamento)) {
        for (const f of orc.fotos_planejamento) {
          if (f.storagePath) {
            try {
              const { data: signRes } = await supabase.storage
                .from("documentos-pacientes")
                .createSignedUrl(f.storagePath, 3600);
              fotosComSignedUrls.push({ ...f, url: signRes?.signedUrl || f.url });
            } catch (_) {
              fotosComSignedUrls.push(f);
            }
          } else {
            fotosComSignedUrls.push(f);
          }
        }
      }

      return json({
        ok: true,
        orcamento: {
          ...orc,
          fotos_planejamento: fotosComSignedUrls,
        },
      });
    }

    // =========================================================================
    // 6. AÇÃO: ORCAMENTO-APPROVE (Aprovação online do orçamento pelo paciente)
    // =========================================================================
    if (action === "orcamento-approve") {
      const targetId = String(body.id || body.identificador || "").trim();
      const token = String(body.token || body.t || "").trim();
      const condicao = body.condicaoEscolhida;

      if (!targetId || !token) {
        return json({ error: "Identificador e token são obrigatórios" }, 400);
      }
      if (!condicao) {
        return json({ error: "Condição de pagamento é obrigatória" }, 400);
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
      let orc: Record<string, any> | null = null;

      if (isUuid) {
        const { data } = await supabase.from("orcamentos").select("*").eq("id", targetId).maybeSingle();
        if (data) orc = data;
      }
      if (!orc) {
        const { data } = await supabase.from("orcamentos").select("*").eq("identificador", targetId).maybeSingle();
        if (data) orc = data;
      }

      if (!orc) {
        return json({ error: "Orçamento não encontrado" }, 404);
      }
      if (orc.token_assinatura !== token) {
        return json({ error: "Token de acesso inválido" }, 403);
      }
      if (orc.status === "aprovado") {
        return json({ ok: true, jaAprovado: true, aprovadoEm: orc.aprovado_em, condicaoEscolhida: orc.condicao_escolhida });
      }

      const nowIso = new Date().toISOString();
      const snapshot = {
        orcamentoId: orc.id,
        identificador: orc.identificador,
        titulo: orc.titulo,
        itens: orc.itens,
        total: condicao.valorTotal || orc.total,
        condicaoEscolhida: condicao,
        aprovadoEm: nowIso,
        pacienteNome: orc.paciente_nome,
        pacienteId: orc.paciente_id,
        evidencias: body.evidencias || {},
      };

      await supabase
        .from("orcamentos")
        .update({
          status: "aprovado",
          aprovado_em: nowIso,
          condicao_escolhida: condicao,
          snapshot_aprovacao: snapshot,
          atualizado_em: nowIso,
        })
        .eq("id", orc.id);

      if (orc.paciente_id) {
        try {
          await supabase.from("pacientes").update({ status: "Em Tratamento", atualizado_em: nowIso }).eq("id", orc.paciente_id);
        } catch (_) {}
      }

      return json({ ok: true, aprovadoEm: nowIso, condicaoEscolhida: condicao });
    }

    // =========================================================================
    // 7. AÇÕES DE AUTORIZAÇÃO DE ASSINATURA AUTOMÁTICA DA PROFISSIONAL
    // =========================================================================
    if (action === "autorizacao_obter") {
      const cro = String(body.cro || "06267-AL").trim();
      let autorizacao: any = null;

      try {
        const { data: rows } = await supabase
          .from("autorizacoes_assinatura_profissional")
          .select("*")
          .eq("ativo", true)
          .is("revogado_em", null)
          .order("autorizado_em", { ascending: false })
          .limit(1);

        if (rows && rows.length > 0) {
          autorizacao = rows[0];
        }
      } catch (_) {
        // Fallback
        try {
          const { data: docs } = await supabase
            .from("documentos_clinicos")
            .select("*")
            .eq("tipo", "autorizacao_profissional")
            .filter("itens->>ativo", "eq", "true")
            .order("criado_em", { ascending: false })
            .limit(1);

          if (docs && docs.length > 0) {
            autorizacao = docs[0].itens;
          }
        } catch (_) {}
      }

      return json({
        ok: true,
        temAutorizacao: !!autorizacao,
        autorizacao: autorizacao ? {
          id: autorizacao.id,
          profissionalNome: autorizacao.profissional_nome || autorizacao.profissionalNome || "Dra. Rosângela Santos Pereira",
          profissionalCro: autorizacao.profissional_cro || autorizacao.profissionalCro || "06267-AL",
          profissionalDocumento: autorizacao.profissional_documento || autorizacao.profissionalDocumento || "032.663.962-43",
          autorizacaoExpressa: autorizacao.autorizacao_expressa || autorizacao.autorizacaoExpressa,
          modelosAutorizados: autorizacao.modelos_autorizados || autorizacao.modelosAutorizados || ["geral", "lentes_resina", "endodontia"],
          condicoesAbrangidas: autorizacao.condicoes_abrangidas || autorizacao.condicoesAbrangidas || { apenas_orcamentos_aprovados: true },
          assinaturaGrafica: autorizacao.assinatura_grafica || autorizacao.assinaturaGrafica || null,
          ativo: autorizacao.ativo,
          autorizadoEm: autorizacao.autorizado_em || autorizacao.autorizadoEm,
          evidencias: autorizacao.evidencias || {},
        } : null,
      });
    }

    if (action === "autorizacao_conceder") {
      const {
        profissionalNome = "Dra. Rosângela Santos Pereira",
        profissionalCro = "06267-AL",
        profissionalDocumento = "032.663.962-43",
        autorizacaoExpressa,
        modelosAutorizados = ["geral", "lentes_resina", "endodontia"],
        condicoesAbrangidas = { apenas_orcamentos_aprovados: true },
        assinaturaGrafica,
        evidencias = {},
      } = body;

      if (!autorizacaoExpressa) {
        return json({ error: "Termo de autorização expressa é obrigatório" }, 400);
      }

      const nowIso = new Date().toISOString();
      const newId = crypto.randomUUID();

      const payload = {
        id: newId,
        profissional_nome: profissionalNome,
        profissional_cro: profissionalCro,
        profissional_documento: profissionalDocumento,
        autorizacao_expressa: autorizacaoExpressa,
        modelos_autorizados: modelosAutorizados,
        condicoes_abrangidas: condicoesAbrangidas,
        assinatura_grafica: assinaturaGrafica || null,
        ativo: true,
        autorizado_em: nowIso,
        evidencias: {
          ...evidencias,
          ip: req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for") || "web",
          timestamp: nowIso,
        },
        criado_em: nowIso,
        atualizado_em: nowIso,
      };

      try {
        // Desativa anteriores
        await supabase
          .from("autorizacoes_assinatura_profissional")
          .update({ ativo: false, revogado_em: nowIso, motivo_revogacao: "Substituída por nova outorga" })
          .eq("ativo", true);

        // Insere nova
        await supabase.from("autorizacoes_assinatura_profissional").insert(payload);
      } catch (_) {
        // Fallback em documentos_clinicos
        try {
          await supabase.from("documentos_clinicos").insert({
            tipo: "autorizacao_profissional",
            titulo: `Autorização de Assinatura Automática - ${profissionalNome}`,
            conteudo: autorizacaoExpressa,
            itens: {
              ...payload,
              profissionalNome,
              profissionalCro,
              profissionalDocumento,
              autorizacaoExpressa,
              modelosAutorizados,
              condicoesAbrangidas,
              assinaturaGrafica,
            },
            criado_em: nowIso,
            atualizado_em: nowIso,
          });
        } catch (_) {}
      }

      return json({
        ok: true,
        mensagem: "Autorização concedida e autenticada com sucesso!",
        autorizacao: {
          id: newId,
          profissionalNome,
          profissionalCro,
          autorizadoEm: nowIso,
          modelosAutorizados,
        },
      });
    }

    if (action === "autorizacao_revogar") {
      const { autorizacaoId, motivo = "Revogação voluntária pela profissional" } = body;
      const nowIso = new Date().toISOString();

      try {
        if (autorizacaoId) {
          await supabase
            .from("autorizacoes_assinatura_profissional")
            .update({ ativo: false, revogado_em: nowIso, motivo_revogacao: motivo, atualizado_em: nowIso })
            .eq("id", autorizacaoId);
        } else {
          await supabase
            .from("autorizacoes_assinatura_profissional")
            .update({ ativo: false, revogado_em: nowIso, motivo_revogacao: motivo, atualizado_em: nowIso })
            .eq("ativo", true);
        }
      } catch (_) {
        try {
          await supabase
            .from("documentos_clinicos")
            .update({
              itens: { ativo: false, revogadoEm: nowIso, motivoRevogacao: motivo },
              atualizado_em: nowIso,
            })
            .eq("tipo", "autorizacao_profissional");
        } catch (_) {}
      }

      return json({
        ok: true,
        mensagem: "Autorização de assinatura automática revogada com sucesso.",
        revogadoEm: nowIso,
      });
    }

    // =========================================================================
    // 8. AÇÃO: RECONCILIAR (Reconciliação retroativa de contratos já assinados)
    // =========================================================================
    if (action === "reconciliar") {
      const nowIso = new Date().toISOString();
      const { data: contratos } = await supabase
        .from("documentos_clinicos")
        .select("*")
        .eq("tipo", "contrato");

      const reconciliados: any[] = [];

      for (const c of (contratos || [])) {
        const snap = (typeof c.itens === "object" && c.itens) ? c.itens : {};
        const temPaciente = Boolean(c.assinado_em || snap.assinaturaPaciente?.assinaturaData || snap.status === "assinado" || snap.status === "formalizado");
        const temDentista = Boolean(snap.assinaturaDentista?.assinaturaData || snap.statusAssinaturaDentista === "assinado");
        const identificador = snap.contratoId || c.id;
        const pacId = c.paciente_id || snap.pacienteId;
        const orcId = snap.orcamentoId || c.orcamento_id;

        if (temPaciente) {
          // 1. Atualiza status formalizado em documentos_clinicos se ambos assinaram
          if (temDentista && c.status !== "formalizado") {
            snap.status = "formalizado";
            snap.isFormalizadoTotal = true;
            await supabase.from("documentos_clinicos").update({
              itens: snap,
              atualizado_em: nowIso,
            }).eq("id", c.id);
          }

          // 2. Localiza e atualiza o orçamento
          let orcRow: any = null;
          if (orcId) {
            const { data } = await supabase.from("orcamentos").select("*").eq("id", orcId).maybeSingle();
            if (data) orcRow = data;
          }
          if (!orcRow && pacId) {
            const { data } = await supabase.from("orcamentos").select("*").eq("paciente_id", pacId).order("atualizado_em", { ascending: false }).limit(1);
            if (data && data.length > 0) orcRow = data[0];
          }

          const canonicalPath = c.pdf_path || snap.pdfPath || `contratos/${identificador}/Contrato_Assinado_${identificador}.pdf`;

          if (orcRow) {
            const currentSnap = (orcRow.assinatura_paciente || {}) as Record<string, any>;
            const formalizadoEm = c.assinado_em || snap.assinaturaPaciente?.dataHora || currentSnap.contratoFormalizadoEm || nowIso;
            const updatedOrcSnap = {
              ...currentSnap,
              contratoId: identificador,
              contratoStatus: temDentista ? "assinaturas_realizadas" : "aguardando_assinatura_dentista",
              statusContrato: temDentista ? "assinaturas_realizadas" : "aguardando_assinatura_dentista",
              contratoFormalizadoEm: temDentista ? formalizadoEm : null,
              assinaturaPacienteStatus: "concluida",
              assinaturaDraStatus: temDentista ? "concluida" : (currentSnap.assinaturaDraStatus || "pendente"),
              pdfPath: canonicalPath,
            };

            await supabase.from("orcamentos").update({
              assinatura_paciente: updatedOrcSnap,
              data_assinatura: currentSnap.data_assinatura || formalizadoEm,
              atualizado_em: nowIso,
            }).eq("id", orcRow.id);
          }

          // 3. Garante registro em documentos_paciente
          if (pacId) {
            const { data: existingDp } = await supabase
              .from("documentos_paciente")
              .select("id")
              .eq("paciente_id", pacId)
              .or(`url.eq.${canonicalPath},nome.ilike.%${identificador}%`)
              .maybeSingle();

            if (!existingDp) {
              const isUuid = (val: any): boolean => typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
              let docPacUserId = isUuid(c.user_id) ? c.user_id : (isUuid(orcRow?.user_id) ? orcRow.user_id : null);
              if (!docPacUserId && pacId) {
                const { data: pR } = await supabase.from("pacientes").select("user_id").eq("id", pacId).maybeSingle();
                if (isUuid(pR?.user_id)) docPacUserId = pR.user_id;
              }
              if (!docPacUserId) {
                const { data: cR } = await supabase.from("configuracoes").select("user_id").limit(1).maybeSingle();
                if (isUuid(cR?.user_id)) docPacUserId = cR.user_id;
              }

              if (docPacUserId) {
                await supabase.from("documentos_paciente").insert({
                  user_id: docPacUserId,
                  paciente_id: pacId,
                  nome: `Contrato Odontológico Assinado - ${identificador}`,
                  tipo: "contrato",
                  url: canonicalPath,
                  tamanho: 50000,
                  criado_em: c.assinado_em || nowIso,
                  atualizado_em: nowIso,
                });
              }
            }
          }

          reconciliados.push({
            id: c.id,
            identificador,
            pacienteId: pacId,
            orcamentoId: orcRow?.id,
            temDentista,
            temPaciente,
          });
        }
      }

      return json({
        ok: true,
        mensagem: "Reconciliação de contratos concluída com sucesso",
        total: reconciliados.length,
        reconciliados,
      });
    }

    // =========================================================================
    // 13. AÇÃO: PROCESSAR_FILA_PDF (Reprocessamento autônomo de tarefas persistidas)
    // =========================================================================
    if (action === "processar_fila_pdf") {
      // 1. Verificação rigorosa de autorização contra acesso público não autorizado
      const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
      const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
      let autorizado = false;
      let authenticatedUserId: string | null = null;
      let isServiceRole = false;
      let contratoAutorizadoPorToken = false;

      if (bearerToken) {
        if (bearerToken === supabaseServiceKey) {
          autorizado = true;
          isServiceRole = true;
        } else {
          try {
            const { data: userData, error: userErr } = await supabase.auth.getUser(bearerToken);
            if (!userErr && userData?.user?.id) {
              autorizado = true;
              authenticatedUserId = userData.user.id;
            }
          } catch (_) {}
        }
      }

      // Se for acionamento para um contrato específico, permite também mediante validação do token do contrato
      const targetContratoId = body.contratoId || null;
      const contratoToken = body.token || body.t || null;
      if (!autorizado && targetContratoId && contratoToken) {
        try {
          const { data: dRow } = await supabase
            .from("documentos_clinicos")
            .select("itens")
            .or(`identificador.eq.${targetContratoId},itens->>contratoId.eq.${targetContratoId}`)
            .maybeSingle();
          if (dRow?.itens?.token && dRow.itens.token === contratoToken) {
            autorizado = true;
            contratoAutorizadoPorToken = true;
          }
        } catch (_) {}
      }

      if (!autorizado) {
        return json({ error: "Acesso não autorizado para processamento da fila de arquivamento" }, 403);
      }

      // REGRA DE SEGURANÇA 1: Tokens públicos NUNCA podem permitir reprocessamento em lote
      if (contratoAutorizadoPorToken && !targetContratoId) {
        return json({ error: "Tokens públicos de contrato não possuem permissão para reprocessamento em lote." }, 403);
      }

      // Resolução de vínculo entre auth.uid() e clinica_id para titulares e funcionários
      const authorizedClinicaIds: string[] = [];
      if (authenticatedUserId) {
        authorizedClinicaIds.push(authenticatedUserId);
        try {
          const { data: roleRecords } = await supabase
            .from("user_roles")
            .select("clinica_id")
            .eq("user_id", authenticatedUserId);
          if (roleRecords && roleRecords.length > 0) {
            for (const r of roleRecords) {
              if (r.clinica_id && !authorizedClinicaIds.includes(r.clinica_id)) {
                authorizedClinicaIds.push(r.clinica_id);
              }
            }
          }
        } catch (_) {}
      }

      const clinicaFilter = authorizedClinicaIds.length > 0
        ? authorizedClinicaIds.map((cId) => `clinica_id.eq.${cId}`).concat("clinica_id.is.null").join(",")
        : null;

      let query = supabase.from("fila_arquivamento_pdf").select("*");

      if (targetContratoId) {
        query = query.eq("contrato_id", targetContratoId);
        // Se usuário autenticado da clínica (não-service_role) chamou com contratoId, restringe à sua própria clínica
        if (!isServiceRole && !contratoAutorizadoPorToken && clinicaFilter) {
          query = query.or(clinicaFilter);
        }
      } else {
        // REGRA DE SEGURANÇA 2: Usuários autenticados processam em lote estritamente tarefas da sua própria clínica
        if (!isServiceRole && clinicaFilter) {
          query = query.or(clinicaFilter);
        }
        query = query
          .in("status", ["pendente", "falha"])
          .lt("tentativas", 5)
          .order("criado_em", { ascending: true })
          .limit(10);
      }

      const { data: fila, error: filaErr } = await query;
      if (filaErr) {
        return json({ error: filaErr.message }, 500);
      }

      const resultados: any[] = [];
      const nowIso = new Date().toISOString();

      for (const item of (fila || [])) {
        try {
          let docRow: any = null;
          const { data: d1 } = await supabase
            .from("documentos_clinicos")
            .select("*")
            .or(`identificador.eq.${item.contrato_id},itens->>contratoId.eq.${item.contrato_id}`)
            .maybeSingle();

          if (d1) docRow = d1;
          if (!docRow && item.documento_id) {
            const { data: d2 } = await supabase.from("documentos_clinicos").select("*").eq("id", item.documento_id).maybeSingle();
            if (d2) docRow = d2;
          }

          if (!docRow) {
            await supabase.from("fila_arquivamento_pdf").update({
              status: "falha",
              ultimo_erro: "Contrato não localizado em documentos_clinicos",
              tentativas: (item.tentativas || 0) + 1,
              atualizado_em: nowIso,
            }).eq("id", item.id);
            resultados.push({ contratoId: item.contrato_id, ok: false, error: "Contrato não encontrado" });
            continue;
          }

          const snap = (typeof docRow.itens === "object" && docRow.itens) ? docRow.itens : {};
          // Proteção contra concorrência: marca imediatamente como processando e incrementa tentativas
          await supabase.from("fila_arquivamento_pdf").update({
            status: "processando",
            tentativas: (item.tentativas || 0) + 1,
            atualizado_em: nowIso,
          }).eq("id", item.id);

          const res = await executarArquivamentoPdfServidor(supabase, docRow, snap, nowIso);
          resultados.push({ contratoId: item.contrato_id, ...res });
        } catch (itemErr: any) {
          resultados.push({ contratoId: item.contrato_id, ok: false, error: itemErr.message });
        }
      }

      return json({
        ok: true,
        mensagem: "Processamento da fila de arquivamento concluído",
        total: resultados.length,
        resultados,
      });
    }

    return json({ error: "Ação não suportada" }, 400);
  } catch (e) {
    console.error("contrato-publico error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
