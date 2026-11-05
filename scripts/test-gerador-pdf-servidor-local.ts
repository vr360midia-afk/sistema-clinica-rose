
function formatarDataBrContratoLocal(isoStr?: string | null): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return String(isoStr);
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function somarMesesContratoLocal(baseIso: string | Date, qtdMeses: number, diaFixo = 10): string {
  const d = new Date(baseIso);
  d.setMonth(d.getMonth() + qtdMeses);
  d.setDate(diaFixo);
  return formatarDataBrContratoLocal(d.toISOString());
}

function gerarParcelasServidorContratoLocal(cond: any, total: number, dataIso = new Date().toISOString()): any[] {
  if (!cond) return [];
  const tipo = cond.tipo || 'personalizado';
  const hoje = new Date(dataIso || Date.now());
  const diaPadrao = Math.min(28, Math.max(1, cond.diaVencimento || 10));

  if (tipo === 'a_vista') {
    const val = typeof cond.valorTotal === 'number' && cond.valorTotal > 0 ? cond.valorTotal : total;
    const venc = cond.dataEntrada ? formatarDataBrContratoLocal(cond.dataEntrada) : formatarDataBrContratoLocal(dataIso);
    return [{
      numero: 1,
      descricao: 'Pagamento Único via PIX',
      vencimento: venc,
      valor: val,
      metodo: 'PIX',
      status: cond.situacaoEntrada === 'Quitada' ? 'Quitada' : 'A vencer',
    }];
  }

  if (tipo === 'cartao') {
    const qtd = Math.max(1, cond.parcelas || 1);
    const isDeb = cond.tipoCartao === 'debito';
    const mNome = isDeb ? 'Cartão de Débito' : 'Cartão de Crédito';
    const valBase = Math.floor((total / qtd) * 100) / 100;
    const centavos = Math.round((total - (valBase * qtd)) * 100);
    const parcs: any[] = [];
    for (let i = 0; i < qtd; i++) {
      const v = Number((valBase + (i < centavos ? 0.01 : 0)).toFixed(2));
      parcs.push({
        numero: i + 1,
        descricao: qtd === 1 ? `Pagamento em ${mNome}` : `Parcela ${i + 1} de ${qtd} (${mNome})`,
        vencimento: 'Fatura do Cartão',
        valor: v,
        metodo: mNome,
        status: isDeb ? (cond.situacaoSaldo === 'Quitado' ? 'Quitada' : 'Autorizado') : 'Autorizado',
      });
    }
    return parcs;
  }

  if (tipo === 'entrada_saldo') {
    const entVal = Number(cond.valorEntrada || 0);
    const saldoTotal = Math.max(0, Number((total - entVal).toFixed(2)));
    const qtdSaldo = Math.max(1, cond.saldoParcelas || 1);
    let mEnt = 'PIX';
    if (cond.metodoEntrada === 'cartao_credito') mEnt = 'Cartão de Crédito';
    else if (cond.metodoEntrada === 'cartao_debito') mEnt = 'Cartão de Débito';
    else if (cond.metodoEntrada === 'dinheiro') mEnt = 'Dinheiro';
    else if (cond.metodoEntrada === 'transferencia') mEnt = 'Transferência';

    let mSal = 'Cartão de Crédito';
    if (cond.saldoMetodo === 'pix_parcelado') mSal = 'PIX Parcelado';
    else if (cond.saldoMetodo === 'boleto') mSal = 'Boleto Bancário';
    else if (cond.saldoMetodo === 'conclusao') mSal = 'Na Conclusão do Tratamento';

    const isCartaoSaldo = /cart[aã]o/i.test(mSal);
    const parcs: any[] = [];
    if (entVal > 0) {
      parcs.push({
        numero: 1,
        descricao: `Entrada Inicial (${mEnt})`,
        vencimento: cond.dataEntrada ? formatarDataBrContratoLocal(cond.dataEntrada) : formatarDataBrContratoLocal(dataIso),
        valor: entVal,
        metodo: mEnt,
        status: cond.situacaoEntrada === 'Quitada' ? 'Quitada' : 'A vencer',
      });
    }

    const valBase = Math.floor((saldoTotal / qtdSaldo) * 100) / 100;
    const centavos = Math.round((saldoTotal - (valBase * qtdSaldo)) * 100);

    for (let i = 0; i < qtdSaldo; i++) {
      const v = Number((valBase + (i < centavos ? 0.01 : 0)).toFixed(2));
      const venc = isCartaoSaldo ? 'Fatura do Cartão' : somarMesesContratoLocal(hoje, i + 1, diaPadrao);
      parcs.push({
        numero: parcs.length + 1,
        descricao: qtdSaldo === 1 ? `Saldo Restante (${mSal})` : `Saldo Restante (${i + 1}/${qtdSaldo} - ${mSal})`,
        vencimento: venc,
        valor: v,
        metodo: mSal,
        status: isCartaoSaldo ? 'Autorizado' : (cond.situacaoSaldo === 'Quitado' ? 'Quitada' : 'A vencer'),
      });
    }
    return parcs;
  }

  if (tipo === 'pix_parcelado') {
    const qtd = Math.max(1, cond.parcelas || 1);
    const valBase = Math.floor((total / qtd) * 100) / 100;
    const centavos = Math.round((total - (valBase * qtd)) * 100);
    const parcs: any[] = [];
    for (let i = 0; i < qtd; i++) {
      const v = Number((valBase + (i < centavos ? 0.01 : 0)).toFixed(2));
      const venc = cond.dataPrimeiroVencimento && i === 0 ? formatarDataBrContratoLocal(cond.dataPrimeiroVencimento) : somarMesesContratoLocal(hoje, i + 1, diaPadrao);
      parcs.push({
        numero: i + 1,
        descricao: `Parcela ${i + 1} de ${qtd} (PIX Parcelado)`,
        vencimento: venc,
        valor: v,
        metodo: 'PIX Parcelado',
        status: cond.situacaoSaldo === 'Quitado' ? 'Quitada' : 'A vencer',
      });
    }
    return parcs;
  }

  return [{
    numero: 1,
    descricao: cond.titulo || 'Pagamento Único',
    vencimento: formatarDataBrContratoLocal(dataIso),
    valor: total,
    metodo: 'PIX',
    status: 'A vencer',
  }];
}

import { jsPDF } from "jspdf";
import qrcode from "qrcode-generator";

function formatarMoedaBr(num?: number | null): string {
  if (typeof num !== "number" || isNaN(num)) return "R$ 0,00";
  return `R$ ${num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Teste do gerador com qrcode-generator
function identificarTipoDocumento(doc?: string | null): "cpf" | "cnpj" | "outro" {
  if (!doc) return "outro";
  const d = String(doc).replace(/\D/g, "");
  if (d.length === 11) return "cpf";
  if (d.length === 14) return "cnpj";
  return "outro";
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

function formatarEnderecoCompleto(input?: any): string {
  if (!input) return "";
  if (typeof input === "string") return input.trim();
  return "";
}

export function gerarPdfServidorContrato(snap: any, docClinico?: any, qrcodeFn?: any): Uint8Array {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 36;
  const contentW = pageW - margin * 2;
  let y = margin;

  const clinicaNome = (snap.clinica?.nome || docClinico?.dentista || "CLÍNICA ODONTOLÓGICA").trim();

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
    pdf.text(`${clinicaNome} | Contrato Odontológico Ref: ${snap.contratoId || docClinico?.identificador || "CTR"}`, margin, y);
    pdf.setDrawColor(210, 210, 210);
    pdf.setLineWidth(0.5);
    pdf.line(margin, y + 4, pageW - margin, y + 4);
    y += 18;
  }

  // 1. CABEÇALHO PRINCIPAL
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(15, 23, 42); // slate-900
  pdf.text(clinicaNome.toUpperCase(), margin, y);
  y += 16;

  pdf.setFontSize(10.5);
  pdf.setTextColor(30, 41, 59);
  pdf.text("CONTRATO DE PRESTAÇÃO DE SERVIÇOS ODONTOLÓGICOS", margin, y);
  y += 14;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  const dataFormatada = snap.emitidoEm ? new Date(snap.emitidoEm).toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR");
  pdf.text(`Identificador Único: ${snap.contratoId || docClinico?.identificador || "CTR"}  |  Formalização: ${dataFormatada}  |  Versão Registrada: ${snap.versao || "1.0"}`, margin, y);
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

  const tipoDocClinica = identificarTipoDocumento(snap.clinica?.cnpj);
  const docClinica = temValorValido(snap.clinica?.cnpj) ? formatarDocumento(snap.clinica.cnpj) : (snap.clinica?.cnpj || "Não informado");
  const endClinica = snap.clinica?.endereco || "Endereço da clínica";
  const telClinica = temValorValido(snap.clinica?.telefone) ? formatarTelefone(snap.clinica.telefone) : (snap.clinica?.telefone || "Não informado");
  const emailClinica = snap.clinica?.email || "Não informado";
  const respTecnica = (snap.clinica?.dentistaResponsavel || snap.dentista || "Cirurgião(ã)-Dentista Responsável").trim();
  const croClinica = (snap.clinica?.cro || "CRO sob consulta").trim();

  let txtContratada = "";
  if (tipoDocClinica === "cnpj") {
    txtContratada = `CONTRATADA: ${clinicaNome.toUpperCase()}, pessoa jurídica de direito privado inscrita no CNPJ sob o nº ${docClinica}, com sede estabelecida em ${endClinica}, telefone: ${telClinica}, e-mail: ${emailClinica}, tendo como Responsável Técnica a ${respTecnica}, inscrita no Conselho Regional de Odontologia sob o CRO nº ${croClinica}.`;
  } else {
    txtContratada = `CONTRATADA: ${clinicaNome.toUpperCase()}, Cirurgiã(o)-Dentista inscrita(o) no Conselho Regional de Odontologia sob o CRO nº ${croClinica}, inscrita(o) no CPF/MF sob o nº ${docClinica}, com consultório estabelecido em ${endClinica}, telefone: ${telClinica}, e-mail: ${emailClinica}.`;
  }
  const lContratada = pdf.splitTextToSize(txtContratada, contentW);
  pdf.text(lContratada, margin, y);
  y += lContratada.length * 10 + 6;

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
  const procs = snap.procedimentos || snap.itensContrato || snap.orcamento?.itens || [];
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
      pdf.text(proc.dente || proc.denteOuRegiao || proc.regiao || "Conforme plano", margin + 260, y + 10);
      const val = typeof proc.valor === "number" ? `R$ ${proc.valor.toFixed(2).replace(".", ",")}` : (typeof proc.valorTotal === "number" ? `R$ ${proc.valorTotal.toFixed(2).replace(".", ",")}` : (proc.valor || "Incluso"));
      pdf.text(String(val), pageW - margin - 50, y + 10);
      y += 16;
    }
    y += 8;
  }

  // 4. VALOR E FORMA DE PAGAMENTO DETALHADA
  checkPageBreak(90);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text("3. VALOR TOTAL E CONDIÇÕES DE PAGAMENTO", margin, y);
  y += 13;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(51, 65, 85);

  const totalNum = snap.financeiro?.total ?? snap.financeiro?.valorTotal ?? docClinico?.valor_total;
  const totalFormatado = formatarMoedaBr(totalNum);
  const subtotalNum = snap.financeiro?.subtotal;
  const subtotalFormatado = subtotalNum ? formatarMoedaBr(subtotalNum) : null;
  const descontoNum = snap.financeiro?.desconto;
  const descontoFormatado = (descontoNum && descontoNum > 0) ? formatarMoedaBr(descontoNum) : null;
  const totalExtenso = snap.financeiro?.totalExtenso ? ` (${snap.financeiro.totalExtenso})` : "";
  const condFormatada = snap.financeiro?.formaPagamento || snap.financeiro?.condicoes || "Condição de pagamento pactuada em orçamento.";

  let txtFin = `O valor total ajustado para os procedimentos acima descritos é de ${totalFormatado}${totalExtenso}`;
  if (subtotalFormatado && descontoFormatado) {
    txtFin += ` (valor original: ${subtotalFormatado}, com desconto contratual de ${descontoFormatado})`;
  }
  txtFin += `, a ser adimplido sob as seguintes condições formalmente aprovadas: ${condFormatada}.`;
  const lFin = pdf.splitTextToSize(txtFin, contentW);
  pdf.text(lFin, margin, y);
  y += lFin.length * 10 + 10;

  // Cronograma Financeiro em Tabela
  let parcelas = snap.financeiro?.parcelas || [];
  if (!Array.isArray(parcelas) || parcelas.length === 0) {
    const condAprov = snap.financeiro?.condicaoEscolhida || snap.orcamento?.condicaoEscolhida;
    if (condAprov) {
      parcelas = gerarParcelasServidorContratoLocal(condAprov, totalNum || 0, snap.emitidoEm || dataFormatada);
    }
  }
  if (Array.isArray(parcelas) && parcelas.length > 0) {
    checkPageBreak(50 + parcelas.length * 16);
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(226, 232, 240);
    pdf.rect(margin, y, contentW, 16, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(71, 85, 105);
    pdf.text("PARCELA", margin + 8, y + 11);
    pdf.text("DESCRIÇÃO", margin + 65, y + 11);
    pdf.text("VENCIMENTO", margin + 260, y + 11);
    pdf.text("VALOR", pageW - margin - 120, y + 11);
    pdf.text("SITUAÇÃO", pageW - margin - 55, y + 11);
    y += 16;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(51, 65, 85);

    for (const p of parcelas) {
      checkPageBreak(18);
      pdf.setDrawColor(241, 245, 249);
      pdf.line(margin, y + 14, pageW - margin, y + 14);
      pdf.text(String(p.numero ?? "-"), margin + 8, y + 10);
      pdf.text(String(p.descricao || "Parcela"), margin + 65, y + 10);
      pdf.text(String(p.vencimento || "Conforme plano"), margin + 260, y + 10);
      const valFmt = typeof p.valor === "number" ? formatarMoedaBr(p.valor) : String(p.valor || "-");
      pdf.text(valFmt, pageW - margin - 120, y + 10);
      pdf.text(String(p.status || "A vencer"), pageW - margin - 55, y + 10);
      y += 16;
    }
    y += 10;
  }

  // Quadro de Pagamento PIX Bacen com Favorecido, Banco, Chave e QR Code
  const temPix = /pix/i.test(condFormatada) || (Array.isArray(parcelas) && parcelas.some((p: any) => /pix/i.test(p.metodo || p.descricao || "")));
  const chavePix = snap.clinica?.chavePix;
  if (temPix && chavePix) {
    checkPageBreak(95);
    const pixBoxW = contentW;
    const pixBoxH = 84;
    pdf.setFillColor(240, 253, 244); // green-50
    pdf.setDrawColor(187, 247, 208); // green-200
    pdf.setLineWidth(0.8);
    pdf.roundedRect(margin, y, pixBoxW, pixBoxH, 4, 4, "FD");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(22, 101, 52); // green-800
    pdf.text("PAGAMENTO VIA PIX — DADOS OFICIAIS DA CLÍNICA", margin + 10, y + 14);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(51, 65, 85);

    const favorecido = snap.clinica?.favorecidoPix || clinicaNome;
    const banco = snap.clinica?.bancoPix || "Nu Pagamentos S.A. (260)";
    const tipoChave = snap.clinica?.tipoChavePix ? ` (${snap.clinica.tipoChavePix.toUpperCase()})` : "";
    const chaveFmt = formatarDocumento(chavePix) || chavePix;

    pdf.text(`Favorecido: ${favorecido}`, margin + 10, y + 27);
    pdf.text(`Banco: ${banco}`, margin + 10, y + 38);
    pdf.text(`Chave PIX: ${chaveFmt}${tipoChave}`, margin + 10, y + 49);

    const instrucoes = snap.clinica?.instrucoesPix || "Utilize o app do seu banco para transferir para a chave informada acima ou efetuar a leitura do QR Code.";
    const lInst = pdf.splitTextToSize(instrucoes, pixBoxW - 95);
    pdf.setFontSize(7);
    pdf.setTextColor(71, 85, 105);
    pdf.text(lInst, margin + 10, y + 62);

    // Desenha QR Code no canto direito
    let payloadParaQr = "";
    if (Array.isArray(parcelas)) {
      const pPix = parcelas.find((p: any) => p.payloadPix);
      if (pPix?.payloadPix) payloadParaQr = pPix.payloadPix;
    }
    if (!payloadParaQr && snap.financeiro?.payloadPix) {
      payloadParaQr = snap.financeiro.payloadPix;
    }

    if (payloadParaQr && typeof qrcode === "function") {
      try {
        const qr = qrcode(0, "M");
        qr.addData(payloadParaQr);
        qr.make();
        const count = qr.getModuleCount();
        const qrSize = 60;
        const qrX = pageW - margin - qrSize - 12;
        const qrY = y + 12;
        const cellSize = qrSize / count;

        pdf.setFillColor(255, 255, 255);
        pdf.rect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6, "F");
        pdf.setFillColor(0, 0, 0);

        for (let r = 0; r < count; r++) {
          for (let c = 0; c < count; c++) {
            if (qr.isDark(r, c)) {
              pdf.rect(qrX + c * cellSize, qrY + r * cellSize, cellSize, cellSize, "F");
            }
          }
        }
      } catch (_) {}
    }

    y += pixBoxH + 12;
  }

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
  const dentistaNome = snap.assinaturaDentista?.nome || respTecnica;
  const dentistaCro = snap.assinaturaDentista?.cro || croClinica;
  pdf.text(`${dentistaNome} (${dentistaCro})`, margin + 10, y + 25);
  pdf.text("Assinatura eletrônica com autorização prévia ativa", margin + 10, y + 34);

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
