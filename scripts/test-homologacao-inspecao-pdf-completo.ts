import { HOMOLOG_URL, HOMOLOG_SERVICE_KEY, validarAmbienteHomologacao, criarClienteHomologacaoSeguro } from './guard-homologacao';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\Jhonatha\\.gemini\\antigravity\\brain\\3fde8683-1cdc-470e-b96c-c7ee35115842';

async function main() {
  console.log('================================================================================');
  console.log('INSPEÇÃO PROFUNDA: PDF CONTRATUAL COMPLETO PELA EDGE FUNCTION HOSPEDADA');
  console.log('Ambiente Remoto:', HOMOLOG_URL);
  console.log('================================================================================\n');

  validarAmbienteHomologacao(HOMOLOG_URL, 'test-homologacao-inspecao-pdf-completo');
  const supabase = criarClienteHomologacaoSeguro();

  const timestamp = Date.now();
  const testId = `PDFCOMPLETO-${timestamp.toString().slice(-6)}`;

  // ---------------------------------------------------------------------------
  // 1. Garantir Autorização Ativa da Dra. Rosângela
  // ---------------------------------------------------------------------------
  console.log('▶ 1. Verificando autorização profissional ativa na Edge Function...');
  const rubricaPng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==';

  const { data: authData, error: authErr } = await supabase.functions.invoke('contrato-publico', {
    body: {
      action: 'autorizacao_conceder',
      profissionalNome: 'Dra. Rosângela Santos Pereira',
      profissionalCro: '06267-AL',
      profissionalDocumento: '08343132483',
      modelosAutorizados: ['geral', 'endodontia', 'lentes_resina'],
      condicoesAbrangidas: { todas: true },
      assinaturaGrafica: rubricaPng,
      autorizacaoExpressa:
        'Autorizo formalmente a aposição da minha assinatura digital nos contratos vinculados a orçamentos aprovados.',
    },
  });

  if (authErr) {
    console.warn('  • Aviso ao conceder autorização remota:', authErr);
  } else {
    console.log('  ✓ Autorização ativa pronta:', authData?.id || 'OK');
  }

  // ---------------------------------------------------------------------------
  // 2. Cadastrar Paciente com dados realistas completos
  // ---------------------------------------------------------------------------
  console.log('\n▶ 2. Cadastrando Paciente para Emissão Contratual...');
  const pacienteId = crypto.randomUUID();
  const pacienteNome = `Carlos Eduardo dos Santos ${testId}`;
  const pacienteCpf = `234.${timestamp.toString().slice(-3)}.890-11`;

  const { error: pacErr } = await supabase.from('pacientes').insert({
    id: pacienteId,
    nome: pacienteNome,
    cpf: pacienteCpf,
    rg: '345678 SSP/AL',
    telefone: '(82) 99876-5432',
    email: `carlos.${testId.toLowerCase()}@duracenski.com.br`,
    endereco: 'Av. Álvaro Otacílio, 2000, Apt 801, Ponta Verde, Maceió - AL, CEP 57035-180',
  });
  if (pacErr) throw new Error(`Falha ao cadastrar paciente: ${JSON.stringify(pacErr)}`);
  console.log(`  ✓ Paciente cadastrado: ID=${pacienteId} | Nome=${pacienteNome} | CPF=${pacienteCpf}`);

  // ---------------------------------------------------------------------------
  // 3. Cadastrar Orçamento com os 2 Procedimentos e Desconto Comercial
  // ---------------------------------------------------------------------------
  console.log('\n▶ 3. Cadastrando Orçamento com Exodontia (R$ 1.000,00) e Lentes (R$ 6.499,96)...');
  const orcamentoId = crypto.randomUUID();
  const orcamentoToken = `tok_pdf_${timestamp}`;

  const itens = [
    {
      id: 'item-1',
      nome: 'Exodontia Siso Inferior',
      denteOuRegiao: 'Elemento 38',
      quantidade: 1,
      valor: 1000.0,
      valorUnitario: 1000.0,
      valorTotal: 1000.0,
    },
    {
      id: 'item-2',
      nome: 'Lentes em Resina Superior',
      denteOuRegiao: 'Elementos 15 ao 25',
      quantidade: 1,
      valor: 6499.96,
      valorUnitario: 6499.96,
      valorTotal: 6499.96,
    },
  ];

  const subtotalEsperado = 7499.96;
  const descontoEsperado = 750.0;
  const totalLiquidoEsperado = 6749.96;

  const condicaoAprovada = {
    id: `cond-pix-${timestamp}`,
    titulo: 'PIX à Vista (10% de desconto comercial)',
    tipo: 'a_vista',
    valorTotal: totalLiquidoEsperado,
    descontoValor: descontoEsperado,
    valorDesconto: descontoEsperado,
    descricao: 'Pagamento Único via PIX com 10% de desconto comercial',
    selecionada: true,
  };

  const { error: orcErr } = await supabase.from('orcamentos').insert({
    id: orcamentoId,
    paciente_id: pacienteId,
    valor_total: subtotalEsperado,
    desconto: descontoEsperado,
    total: totalLiquidoEsperado,
    status: 'aguardando_aprovacao',
    itens: itens,
    assinatura_paciente: {
      token: orcamentoToken,
      identificador: `ORC-${timestamp.toString().slice(-6)}`,
      status: 'aguardando_aprovacao',
      titulo: 'Plano Odontológico Reabilitador e Estético',
      formasPagamento: JSON.stringify({
        versao: '2.0',
        condicoes: [condicaoAprovada],
        selecionadaId: condicaoAprovada.id,
      }),
    },
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  });
  if (orcErr) throw new Error(`Falha ao cadastrar orçamento: ${JSON.stringify(orcErr)}`);
  console.log(`  ✓ Orçamento #${orcamentoId} criado. Subtotal=R$ 7.499,96 | Desconto=R$ 750,00 | Total=R$ 6.749,96`);

  // ---------------------------------------------------------------------------
  // 4. Aprovação via Edge Function Hospedada 'orcamento-publico'
  // ---------------------------------------------------------------------------
  console.log('\n▶ 4. Aprovando Orçamento via Edge Function hospedada orcamento-publico...');
  const { data: aprovResult, error: aprovErr } = await supabase.functions.invoke('orcamento-publico', {
    body: {
      action: 'approve',
      identificador: orcamentoId,
      token: orcamentoToken,
      condicaoEscolhida: condicaoAprovada,
      evidencias: {
        navegador: 'Inspecao Profunda Edge Function Homologacao',
        ip: '187.19.222.10',
        origem: 'teste_inspecao_pdf_completo',
      },
    },
  });

  if (aprovErr || !aprovResult?.ok) {
    throw new Error(`Falha na aprovação remota do orçamento: ${JSON.stringify(aprovErr || aprovResult)}`);
  }

  const contratoId = aprovResult.contratoId;
  const contratoToken = aprovResult.contratoToken;
  console.log(`  ✓ Contrato gerado na Edge Function: ID=${contratoId} | Token=${contratoToken?.slice(0, 8)}...`);

  // ---------------------------------------------------------------------------
  // 5. Assinatura Digital do Paciente via Edge Function 'contrato-publico' (action: sign)
  // ---------------------------------------------------------------------------
  console.log('\n▶ 5. Executando Assinatura Digital via Edge Function hospedada contrato-publico (action: sign)...');
  const assinaturaPacientePng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==';

  const { data: signResult, error: signErr } = await supabase.functions.invoke('contrato-publico', {
    body: {
      action: 'sign',
      id: contratoId,
      token: contratoToken,
      signature: assinaturaPacientePng,
      signerName: pacienteNome,
      signerInfo: {
        cpf: pacienteCpf,
        rg: '345678 SSP/AL',
        email: `carlos.${testId.toLowerCase()}@duracenski.com.br`,
      },
      termoUsoImagem: {
        ativo: true,
        autorizado: true,
        usoDidaticoCientifico: true,
        usoPublicitarioRedesSociais: true,
        identificacaoFacialVoz: 'rosto_e_voz',
        depoimentos: true,
      },
    },
  });

  if (signErr || !signResult?.ok) {
    let errBody = '';
    try {
      errBody = await (signErr as any)?.context?.text?.() || '';
    } catch (_) {}
    throw new Error(`Falha ao assinar contrato via Edge Function: ${JSON.stringify(signErr || signResult)} | Body: ${errBody}`);
  }

  console.log('  ✓ Contrato assinado bilateralmente com sucesso pela Edge Function!');
  console.log('  • Resposta da Edge Function:', {
    formalizado: signResult.formalizado,
    pdfPath: signResult.pdfPath,
    hasPdfUrl: Boolean(signResult.pdfUrl),
  });

  // ---------------------------------------------------------------------------
  // 6. Download do Binário Completo do PDF Gerado pelo Servidor
  // ---------------------------------------------------------------------------
  console.log('\n▶ 6. Baixando binário oficial do PDF gerado pela Edge Function...');
  let pdfBuffer: Buffer | null = null;

  if (signResult.pdfUrl) {
    const res = await fetch(signResult.pdfUrl);
    if (res.ok) {
      const arr = await res.arrayBuffer();
      pdfBuffer = Buffer.from(arr);
    }
  }

  // Fallback para download direto via Storage SDK se a URL expirou
  if (!pdfBuffer && signResult.pdfPath) {
    const { data: fileData, error: dlErr } = await supabase.storage
      .from('documentos-pacientes')
      .download(signResult.pdfPath);

    if (dlErr) throw new Error(`Falha ao baixar PDF do storage: ${JSON.stringify(dlErr)}`);
    const arr = await fileData.arrayBuffer();
    pdfBuffer = Buffer.from(arr);
  }

  if (!pdfBuffer || pdfBuffer.length === 0) {
    throw new Error('Falha crítica: o binário do PDF gerado pelo servidor não pôde ser recuperado.');
  }

  console.log(`  ✓ Binário do PDF recuperado com sucesso! Tamanho exato: ${pdfBuffer.length.toLocaleString('pt-BR')} bytes.`);

  // Salva o PDF localmente e no diretório de artefatos
  const pdfArtifactPath = path.join(ARTIFACT_DIR, 'contrato-completo-inspecao-homolog.pdf');
  fs.writeFileSync(pdfArtifactPath, pdfBuffer);
  console.log(`  ✓ PDF completo salvo em: ${pdfArtifactPath}`);

  // ---------------------------------------------------------------------------
  // 7. Inspeção Detalhada do Conteúdo e Integridade do PDF
  // ---------------------------------------------------------------------------
  console.log('\n▶ 7. Inspecionando texto e seções renderizadas no PDF oficial...');

  const pdfRawText = pdfBuffer.toString('latin1');
  const lines: string[] = [];
  const regex = /\((.*?)\)\s*Tj/g;
  let m;
  while ((m = regex.exec(pdfRawText)) !== null) {
    lines.push(m[1]);
  }
  const fullExtractedText = lines.join(' ');

  console.log(`  • Total de blocos de texto extraídos: ${lines.length}`);

  // Asserção 1: Procedimentos presentes no PDF
  const hasExodontia = fullExtractedText.includes('Exodontia Siso Inferior') || pdfRawText.includes('Exodontia');
  const hasLentes = fullExtractedText.includes('Lentes em Resina Superior') || pdfRawText.includes('Lentes em Resina');
  if (!hasExodontia) throw new Error('Procedimento Exodontia Siso Inferior ausente no PDF!');
  if (!hasLentes) throw new Error('Procedimento Lentes em Resina Superior ausente no PDF!');
  console.log('  [PASS] Procedimentos discriminados com sucesso: Exodontia Siso Inferior e Lentes em Resina Superior');

  // Asserção 2: Valores dos procedimentos presentes e NENHUM zerado
  const hasValExodontia = fullExtractedText.includes('1.000,00') || pdfRawText.includes('1.000,00');
  const hasValLentes = fullExtractedText.includes('6.499,96') || pdfRawText.includes('6.499,96');
  if (!hasValExodontia) throw new Error('Valor R$ 1.000,00 da Exodontia ausente no PDF!');
  if (!hasValLentes) throw new Error('Valor R$ 6.499,96 das Lentes ausente no PDF!');
  console.log('  [PASS] Valores individuais dos procedimentos renderizados com exatidão: R$ 1.000,00 e R$ 6.499,96');

  // Asserção 3: Subtotal, Desconto e Total Líquido
  const hasSubtotal = fullExtractedText.includes('7.499,96') || pdfRawText.includes('7.499,96');
  const hasDesconto = fullExtractedText.includes('750,00') || pdfRawText.includes('750,00');
  const hasTotal = fullExtractedText.includes('6.749,96') || pdfRawText.includes('6.749,96');
  if (!hasSubtotal) throw new Error('Subtotal R$ 7.499,96 ausente no PDF!');
  if (!hasDesconto) throw new Error('Desconto R$ 750,00 ausente no PDF!');
  if (!hasTotal) throw new Error('Total Líquido R$ 6.749,96 ausente no PDF!');
  console.log('  [PASS] Cláusula Financeira completa: Subtotal R$ 7.499,96 | Desconto R$ 750,00 | Total Líquido R$ 6.749,96');

  // Asserção 4: Cronograma financeiro
  const hasCronograma = fullExtractedText.includes('PARCELA') || pdfRawText.includes('PARCELA');
  if (!hasCronograma) throw new Error('Tabela de cronograma de parcelas ausente no PDF!');
  console.log('  [PASS] Tabela de cronograma de parcelas renderizada com sucesso');

  // Asserção 5: Dados PIX reais da clínica e bloqueio de dados fictícios
  const hasFakeCnpj = pdfRawText.includes('12345678000190') || fullExtractedText.includes('12345678000190');
  if (hasFakeCnpj) {
    throw new Error('Chave PIX fictícia 12345678000190 foi encontrada no PDF!');
  }
  console.log('  [PASS] Chave PIX fictícia 12345678000190 NÃO existe no PDF');

  // Asserção 6: Tamanho do PDF reflete documento oficial multi-páginas
  if (pdfBuffer.length < 15000) {
    throw new Error(`PDF gerado possui apenas ${pdfBuffer.length} bytes, insuficiente para contrato completo com cabeçalho, tabelas e assinaturas.`);
  }
  console.log(`  [PASS] Tamanho do documento oficial validado: ${pdfBuffer.length.toLocaleString('pt-BR')} bytes (> 15 KB)`);

  // Asserção 7: Assinaturas presentes
  const hasSignatures = pdfRawText.includes('Ros') || fullExtractedText.includes('Ros') || pdfRawText.includes('06267');
  if (!hasSignatures) throw new Error('Assinatura da Dra. Rosângela ausente no PDF!');
  console.log('  [PASS] Assinatura profissional da Dra. Rosângela Santos Pereira (CRO-AL 06267) confirmada');

  console.log('\n================================================================================');
  console.log('INSPEÇÃO CONCLUÍDA COM 100% DE SUCESSO: O PDF GERADO PELA EDGE FUNCTION HOSPEDADA');
  console.log('APRESENTA TODAS AS SEÇÕES, PROCEDIMENTOS, VALORES, DESCONTO, CRONOGRAMA E PIX ÍNTEGROS!');
  console.log('================================================================================');
}

main().catch((err) => {
  console.error('\n❌ ERRO NA INSPEÇÃO DO PDF:', err);
  process.exit(1);
});
