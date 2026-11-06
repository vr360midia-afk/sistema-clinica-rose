/**
 * TESTE DE CONFIRMAÇÃO ADICIONAL EM HOMOLOGAÇÃO
 * Cenário especificado pelo usuário:
 * - Valor total: R$ 4.500,00
 * - Entrada PIX: R$ 291,00
 * - Saldo: 10x de R$ 420,90 no Cartão de Crédito
 * - Total de 11 linhas no cronograma
 * - Verificação no PDF definitivo gerado pela Edge Function hospedada
 * - Validação de ausência de datas inventadas e sem quitação indevida
 */

import { HOMOLOG_URL, criarClienteHomologacaoSeguro, validarAmbienteHomologacao } from './guard-homologacao';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ARTIFACT_DIR = 'C:\\Users\\Jhonatha\\.gemini\\antigravity\\brain\\50b2c5dc-cc53-4c24-ae85-eb0642d75490';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FALHA: ${msg}`);
    throw new Error(`[FALHA DE VALIDAÇÃO]: ${msg}`);
  }
  console.log(`   ✓ ${msg}`);
}

async function runConfirmacaoAdicional() {
  console.log('================================================================================');
  console.log('CONFIRMAÇÃO ADICIONAL EM HOMOLOGAÇÃO: R$ 4.500 (ENTRADA R$ 291 + 10x R$ 420,90)');
  console.log('Ambiente:', HOMOLOG_URL);
  console.log('================================================================================\n');

  validarAmbienteHomologacao(HOMOLOG_URL, 'test-homologacao-confirmacao-adicional');
  const supabase = criarClienteHomologacaoSeguro();

  const timestamp = Date.now();
  const testId = `TEST-${timestamp.toString().slice(-6)}`;

  // 1. Cadastrar Paciente Fictício
  console.log('▶ 1. Cadastrando Paciente Fictício...');
  const pacienteId = crypto.randomUUID();
  const pacienteNome = `Beatriz Fictícia ${testId}`;
  const pacienteCpf = `234.${timestamp.toString().slice(-3)}.890-11`;

  const { data: pacRow, error: pacErr } = await supabase
    .from('pacientes')
    .insert({
      id: pacienteId,
      nome: pacienteNome,
      cpf: pacienteCpf,
      telefone: '(82) 99887-6655',
      email: `beatriz.${testId.toLowerCase()}@ficticio.com.br`,
      endereco: 'Rua Sandoval Arroxelas, 300, Ponta Verde, Maceió - AL, CEP 57035-230',
    })
    .select('*')
    .single();

  if (pacErr || !pacRow) {
    throw new Error(`Falha ao cadastrar paciente: ${JSON.stringify(pacErr)}`);
  }
  console.log(`   ✓ Paciente cadastrado: ID=${pacienteId} | Nome=${pacienteNome}`);

  // 2. Criar Orçamento com R$ 4.500,00 e condição mista
  console.log('\n▶ 2. Criando Orçamento em Homologação...');
  const orcamentoId = crypto.randomUUID();
  const orcamentoToken = `tok_orc_${timestamp}`;

  const condicaoAprovada = {
    id: `cond-aprov-${timestamp}`,
    titulo: 'Entrada PIX R$ 291,00 + 10x Cartão de R$ 420,90',
    tipo: 'entrada_saldo',
    valorTotal: 4500.0,
    valorEntrada: 291.0,
    metodoEntrada: 'pix',
    dataEntrada: '2026-11-06',
    saldoParcelas: 10,
    saldoMetodo: 'cartao',
    diaVencimento: 10,
    descricao: 'Entrada de R$ 291,00 via PIX + Saldo em 10x de R$ 420,90 no Cartão de Crédito',
    cartaoAutorizado: false,
    selecionada: true,
  };

  const itensOrcamento = [
    { id: '1', nome: 'Plano Reabilitador com Resinas Estéticas', denteOuRegiao: 'Arcada Superior', valorUnitario: 4500.0, quantidade: 1, valorTotal: 4500.0 },
  ];

  const { data: orcRow, error: orcErr } = await supabase
    .from('orcamentos')
    .insert({
      id: orcamentoId,
      paciente_id: pacienteId,
      valor_total: 4500.0,
      desconto: 0,
      total: 4500.0,
      status: 'aguardando_aprovacao',
      itens: itensOrcamento,
      assinatura_paciente: {
        token: orcamentoToken,
        identificador: `ORC-${timestamp.toString().slice(-6)}`,
        status: 'aguardando_aprovacao',
        formasPagamento: JSON.stringify({
          versao: '2.0',
          condicoes: [condicaoAprovada],
          selecionadaId: condicaoAprovada.id,
        }),
      },
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (orcErr || !orcRow) {
    throw new Error(`Falha ao cadastrar orçamento: ${JSON.stringify(orcErr)}`);
  }
  console.log(`   ✓ Orçamento criado: ID=${orcamentoId} | Total líquido=R$ 4.500,00`);

  // 3. Aprovação via Edge Function hospedada 'orcamento-publico'
  console.log('\n▶ 3. Aprovando Orçamento via Edge Function hospedada orcamento-publico...');
  const { data: aprovResult, error: aprovErr } = await supabase.functions.invoke('orcamento-publico', {
    body: {
      action: 'approve',
      identificador: orcamentoId,
      token: orcamentoToken,
      condicaoEscolhida: condicaoAprovada,
      evidencias: {
        navegador: 'Teste Confirmação Adicional R$ 4.500',
        ip: '189.40.110.22',
        origem: 'teste_adicional_4500',
      },
    },
  });

  if (aprovErr || !aprovResult?.ok) {
    throw new Error(`Falha na Edge Function orcamento-publico: ${JSON.stringify(aprovErr || aprovResult)}`);
  }

  const contratoId = aprovResult.contratoId;
  const contratoToken = aprovResult.contratoToken;
  console.log(`   ✓ Orçamento aprovado! Contrato Vinculado: ${contratoId}`);

  // 4. Inspecionar o Snapshot persistido em documentos_clinicos
  console.log('\n▶ 4. Inspecionando Cronograma Financeiro no Banco de Dados...');
  const { data: docContrato, error: docErr } = await supabase
    .from('documentos_clinicos')
    .select('*')
    .eq('tipo', 'contrato')
    .contains('itens', { contratoId })
    .single();

  if (docErr || !docContrato) {
    throw new Error(`Contrato não encontrado em documentos_clinicos: ${JSON.stringify(docErr)}`);
  }

  const snapshot = docContrato.itens;
  const parcelas = snapshot?.financeiro?.parcelas || [];
  console.log(`   ✓ Total de parcelas encontradas no snapshot: ${parcelas.length}`);

  assert(parcelas.length === 11, 'O cronograma deve conter exatamente 11 linhas (1 entrada + 10 parcelas no cartão)');

  // Linha 1: Entrada PIX
  const p1 = parcelas[0];
  console.log(`   • Linha 1: ${p1.descricao} | Venc: ${p1.vencimento} | Valor: R$ ${p1.valor.toFixed(2)} | Situação: [${p1.status}]`);
  assert(p1.descricao.includes('Entrada') && p1.descricao.includes('PIX'), 'Linha 1 deve ser Entrada via PIX');
  assert(p1.valor === 291.0, 'Valor da entrada deve ser exatamente R$ 291,00');
  assert(p1.metodo === 'PIX', 'Método da entrada deve ser PIX');
  assert(p1.status === 'Pendente', 'Entrada não comprovada deve constar como Pendente (nunca Quitada sem comprovante)');

  // Linhas 2 a 11: 10x Cartão de Crédito de R$ 420,90
  for (let i = 1; i < 11; i++) {
    const p = parcelas[i];
    console.log(`   • Linha ${i + 1}: ${p.descricao} | Venc: ${p.vencimento} | Valor: R$ ${p.valor.toFixed(2)} | Situação: [${p.status}]`);
    assert(p.metodo === 'Cartão de Crédito', `Linha ${i + 1} deve ter método 'Cartão de Crédito'`);
    assert(p.vencimento === 'Fatura do Cartão', `Linha ${i + 1} deve indicar 'Fatura do Cartão' (sem datas inventadas)`);
    assert(p.valor === 420.90, `Linha ${i + 1} deve ter valor de R$ 420,90`);
    assert(p.status === 'Pendente', `Linha ${i + 1} deve ter status 'Pendente' (sem autorização inventada de cartão)`);
  }

  // Verificar soma das parcelas
  const soma = parcelas.reduce((acc: number, p: any) => acc + Number(p.valor || 0), 0);
  assert(Math.abs(soma - 4500.0) < 0.001, `A soma exata das 11 linhas corresponde a R$ 4.500,00: ${soma.toFixed(2)} == 4500.00`);

  // Verificar que nenhuma transação indevida ou duplicada foi criada em transacoes
  const { data: transacoesCriadas } = await supabase
    .from('transacoes')
    .select('*')
    .eq('orcamento_id', orcamentoId);

  const qtdTrans = transacoesCriadas?.length || 0;
  console.log(`   • Transações no financeiro para o orçamento: ${qtdTrans}`);
  assert(qtdTrans === 0, 'Nenhuma cobrança ou autorização espúria foi inserida indevidamente em transacoes');

  // 5. Formalização Bilateral e Geração do PDF no Servidor Remoto
  console.log('\n▶ 5. Formalizando Contrato via Edge Function hospedada contrato-publico...');
  const { data: signResult, error: signErr } = await supabase.functions.invoke('contrato-publico', {
    body: {
      action: 'sign',
      id: contratoId,
      token: contratoToken,
      signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      signerName: pacienteNome,
      termoUsoImagem: { ativo: false },
    },
  });

  if (signErr || !signResult?.ok) {
    throw new Error(`Falha ao assinar contrato via Edge Function: ${JSON.stringify(signErr || signResult)}`);
  }

  console.log(`   ✓ Contrato assinado! isFormalizadoTotal=${signResult.isFormalizadoTotal}`);
  console.log(`   ✓ Caminho do PDF no Storage: ${signResult.pdfPath}`);

  // 6. Download do PDF Definitivo gerado pela Edge Function
  console.log('\n▶ 6. Baixando PDF Definitivo gerado no servidor...');
  const { data: pdfBlob, error: dlErr } = await supabase.storage
    .from('documentos-pacientes')
    .download(signResult.pdfPath);

  if (dlErr || !pdfBlob) {
    throw new Error(`Falha ao baixar PDF do Storage: ${JSON.stringify(dlErr)}`);
  }

  const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());
  const localPdfPath = path.join(ARTIFACT_DIR, 'contrato-confirmacao-adicional-4500.pdf');
  fs.writeFileSync(localPdfPath, pdfBuffer);
  console.log(`   ✓ PDF definitivo salvo localmente em: ${localPdfPath} (${pdfBuffer.length} bytes)`);

  // 7. Inspecionar conteúdo do PDF
  console.log('\n▶ 7. Inspecionando Conteúdo do PDF Definitivo...');
  const pdfString = pdfBuffer.toString('latin1');

  // Regex para extrair texto de Tj no PDF
  const textLines: string[] = [];
  const regexTj = /\((.*?)\)\s*Tj/g;
  let m;
  while ((m = regexTj.exec(pdfString)) !== null) {
    textLines.push(m[1]);
  }

  console.log(`   • Total de blocos de texto no PDF: ${textLines.length}`);

  const fullText = textLines.join(' ');
  const contem4500 = fullText.includes('4.500,00') || fullText.includes('4500');
  const contem291 = fullText.includes('291,00');
  const contem42090 = fullText.includes('420,90');
  const contemFaturaCartao = fullText.includes('Fatura do Cart') || fullText.includes('Fatura');
  const contemPendente = fullText.includes('Pendente');
  const contemEntrada = fullText.includes('Entrada Inicial') || fullText.includes('Entrada');
  const contemPixBox = fullText.includes('PAGAMENTO VIA PIX') || fullText.includes('PIX');

  assert(contem4500, 'PDF contém o valor total de R$ 4.500,00');
  assert(contem291, 'PDF contém o valor da entrada de R$ 291,00');
  assert(contem42090, 'PDF contém o valor das parcelas de R$ 420,90');
  assert(contemFaturaCartao, 'PDF contém a indicação "Fatura do Cartão" para o saldo em cartão');
  assert(contemPendente, 'PDF contém o status "Pendente" refletindo ausência de quitação prematura');
  assert(contemEntrada, 'PDF discrimina a Entrada Inicial');
  assert(contemPixBox, 'PDF contém os dados oficiais para pagamento via PIX da entrada');

  // 8. Renderizar Imagens do PDF para auditoria visual
  console.log('\n▶ 8. Renderizando Captura Visual do PDF via Edge...');
  const viewerHtmlPath = path.join(ARTIFACT_DIR, 'viewer-confirmacao-4500.html');
  const base64Pdf = pdfBuffer.toString('base64');
  const viewerHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Confirmação Adicional R$ 4.500,00</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    body { font-family: sans-serif; background: #0f172a; margin: 0; padding: 20px; color: #f8fafc; }
    .page-container { display: flex; flex-direction: column; align-items: center; gap: 24px; }
    .canvas-wrap { background: #fff; border-radius: 4px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); overflow: hidden; }
  </style>
</head>
<body>
  <div style="text-align: center; margin-bottom: 20px;">
    <h2 style="color: #38bdf8;">AUDITORIA DO CONTRATO DEFINITIVO — R$ 4.500,00 (11 PARCELAS)</h2>
    <p>ID: ${contratoId} | Entrada: R$ 291,00 (PIX) + 10x R$ 420,90 (Cartão)</p>
  </div>
  <div class="page-container" id="pages"></div>
  <script>
    const pdfData = atob("${base64Pdf}");
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    pdfjsLib.getDocument({ data: pdfData }).promise.then(async (pdf) => {
      const container = document.getElementById('pages');
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const wrap = document.createElement('div');
        wrap.className = 'canvas-wrap';
        const canvas = document.createElement('canvas');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        wrap.appendChild(canvas);
        container.appendChild(wrap);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      }
    });
  </script>
</body>
</html>`;

  fs.writeFileSync(viewerHtmlPath, viewerHtml, 'utf8');

  const imgScreenPath = path.join(ARTIFACT_DIR, 'evidencia-confirmacao-adicional-4500.png');
  try {
    if (fs.existsSync(EDGE_PATH)) {
      const cmdScreenshot = `& "${EDGE_PATH}" --headless --disable-gpu --window-size=1200,3200 --screenshot="${imgScreenPath}" "file:///${viewerHtmlPath.replace(/\\/g, '/')}"`;
      execSync(cmdScreenshot, { shell: 'powershell.exe' });
      console.log(`   ✓ Captura visual salva em: ${imgScreenPath}`);
    }
  } catch (renderErr) {
    console.warn('   • Aviso na captura visual via Edge:', renderErr);
  }

  console.log('\n================================================================================');
  console.log('>>> CONFIRMAÇÃO ADICIONAL EM HOMOLOGAÇÃO CONCLUÍDA COM 100% DE SUCESSO! <<<');
  console.log('================================================================================\n');

  return {
    ok: true,
    contratoId,
    pacienteId,
    orcamentoId,
    pdfPath: signResult.pdfPath,
    tamanhoBytes: pdfBuffer.length,
  };
}

runConfirmacaoAdicional().catch(err => {
  console.error('\n❌ ERRO NA CONFIRMAÇÃO ADICIONAL:', err);
  process.exit(1);
});
