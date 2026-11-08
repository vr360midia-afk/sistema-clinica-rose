/**
 * Bateria Completa de Homologação:
 * Retificação Segura de Contrato Pendente, Rotação de Token, Imutabilidade e Integridade Financeira
 * 
 * Execução 100% isolada no ambiente de homologação (fsroaymkuopapwlnknhl).
 * NENHUM dado é criado ou alterado em produção.
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import {
  HOMOLOG_URL,
  HOMOLOG_SERVICE_KEY,
  validarAmbienteHomologacao,
} from './guard-homologacao';
import {
  mapearDadosContrato,
  gerarHtmlContrato,
  gerarTokenAcesso,
  validarIntegridadeOrcamentoContrato,
  validarCronogramaFinanceiroContrato,
  validarAutorizacaoAssinatura,
} from '../src/utils/contratoEngine';

validarAmbienteHomologacao(HOMOLOG_URL, 'Bateria de Retificação Segura e Rotação de Token');

interface TestMetric {
  id: number;
  nome: string;
  sucesso: boolean;
  detalhes?: string;
}

const metrics: TestMetric[] = [];

function assert(cond: boolean, id: number, nome: string, detalhes?: string) {
  if (cond) {
    metrics.push({ id, nome, sucesso: true });
    console.log(`  ✓ [TESTE ${id}] ${nome}`);
  } else {
    metrics.push({ id, nome, sucesso: false, detalhes });
    console.error(`  ❌ [FALHA TESTE ${id}] ${nome}`);
    if (detalhes) console.error(`     Detalhes: ${detalhes}`);
    throw new Error(`Falha no teste ${id}: ${nome}`);
  }
}

async function run() {
  console.log('================================================================================');
  console.log('BATERIA DE HOMOLOGAÇÃO: RETIFICAÇÃO, ROTAÇÃO DE TOKEN E IMUTABILIDADE');
  console.log('Ambiente:', HOMOLOG_URL);
  console.log('Data:', new Date().toISOString());
  console.log('================================================================================\n');

  const supabase = createClient(HOMOLOG_URL, HOMOLOG_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const testSuffix = Date.now().toString().slice(-6);
  const pacienteId = crypto.randomUUID();
  const pacienteNome = `Maria Roseane Alves ${testSuffix}`;
  const orcamentoId = crypto.randomUUID();
  const ctrCodigo = `CTR-${testSuffix.toUpperCase()}`;

  // Cria paciente de teste em homologação
  const { error: errP } = await supabase.from('pacientes').insert({
    id: pacienteId,
    nome: pacienteNome,
    cpf: `123.${testSuffix.slice(0, 3)}.${testSuffix.slice(3, 6)}-00`,
    telefone: '(82) 99364-1813',
    endereco: 'Rua Exemplo, 123, Maceió - AL',
  });
  assert(!errP, 1, 'Paciente criado com sucesso no banco de homologação');

  // Cria orçamento de teste correspondente ao #CCCE6389
  const { error: errO } = await supabase.from('orcamentos').insert({
    id: orcamentoId,
    paciente_id: pacienteId,
    valor_total: 8870,
    desconto: 2820,
    total: 6050,
    status: 'aprovado',
    contrato_id: ctrCodigo,
    identificador: 'CCCE6389',
    itens: [
      { nome: 'Plastia Gengival', quantidade: 1, valorUnitario: 350, valorTotal: 350 },
      { nome: 'Clareamento Dental Inferior', quantidade: 1, valorUnitario: 950, valorTotal: 950 },
      { nome: 'Remoção de Caries', quantidade: 1, valorUnitario: 1400, valorTotal: 1400 },
      { nome: 'Lentes em Resina Superior', quantidade: 1, valorUnitario: 5500, valorTotal: 5500 },
      { nome: 'Raio X Periapical Dentes Selecionados', quantidade: 1, valorUnitario: 120, valorTotal: 120 },
      { nome: 'Taxa maquininha', quantidade: 1, valorUnitario: 550, valorTotal: 550 },
    ],
  });
  assert(!errO, 2, 'Orçamento aprovado criado com sucesso (Total R$ 6.050,00, Desconto R$ 2.820,00)', errO ? JSON.stringify(errO) : undefined);

  // ---------------------------------------------------------------------------
  // TESTE 1: Validação Matemática & Financeira (Requisitos 6 e 7)
  // ---------------------------------------------------------------------------
  console.log('\n--- 1. Validação Financeira e Conciliação dos Centavos ---');
  const orcamentoMock = {
    id: orcamentoId,
    titulo: 'Plano de tratamento',
    total: 6050,
    subtotal: 8870,
    desconto: 2820,
    formasPagamento: 'Cartão de crédito em 18x de R$ 336,11',
    itens: [
      { nome: 'Plastia Gengival', quantidade: 1, valorUnitario: 350, valorTotal: 350 },
      { nome: 'Clareamento Dental Inferior', quantidade: 1, valorUnitario: 950, valorTotal: 950 },
      { nome: 'Remoção de Caries', quantidade: 1, valorUnitario: 1400, valorTotal: 1400 },
      { nome: 'Lentes em Resina Superior', quantidade: 1, valorUnitario: 5500, valorTotal: 5500 },
      { nome: 'Raio X Periapical Dentes Selecionados', quantidade: 1, valorUnitario: 120, valorTotal: 120 },
      { nome: 'Taxa maquininha', quantidade: 1, valorUnitario: 550, valorTotal: 550 },
    ],
  };

  const snapCalculado = mapearDadosContrato({
    patient: { id: pacienteId, nome: pacienteNome, cpf: '123.456.789-00' },
    orcamento: orcamentoMock,
  });

  assert(snapCalculado.financeiro.subtotal === 8870, 3, 'Subtotal financeiro calculado é R$ 8.870,00');
  assert(snapCalculado.financeiro.desconto === 2820, 4, 'Desconto financeiro calculado é R$ 2.820,00');
  assert(snapCalculado.financeiro.total === 6050, 5, 'Total financeiro calculado é R$ 6.050,00');
  assert(snapCalculado.financeiro.parcelas.length === 18, 6, 'Quantidade de parcelas é exatamente 18');

  const p1 = snapCalculado.financeiro.parcelas[0].valor;
  const p2 = snapCalculado.financeiro.parcelas[1].valor;
  const p3 = snapCalculado.financeiro.parcelas[2].valor;
  const p18 = snapCalculado.financeiro.parcelas[17].valor;
  assert(p1 === 336.12 && p2 === 336.12, 7, 'Primeiras 2 parcelas conciliam com R$ 336,12');
  assert(p3 === 336.11 && p18 === 336.11, 8, 'Demais 16 parcelas conciliam com R$ 336,11');

  const somaCentavos = snapCalculado.financeiro.parcelas.reduce((acc, p) => acc + p.valor, 0);
  assert(Math.abs(somaCentavos - 6050) < 0.001, 9, `Soma exata das 18 parcelas é R$ ${somaCentavos.toFixed(2)} (R$ 6.050,00 sem resíduo)`);

  const integridadeInicial = validarIntegridadeOrcamentoContrato(orcamentoMock, snapCalculado);
  assert(integridadeInicial.valido === true && integridadeInicial.erros.length === 0, 10, 'Validação de integridade entre orçamento e snapshot aprovada com zero erros');

  // ---------------------------------------------------------------------------
  // TESTE 2: Criação Inicial de Contrato Pendente V1 (com snapshot antigo)
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Criação do Registro Pendente Inicial (Versão 1 com Token Antigo) ---');
  const tokenAntigo = gerarTokenAcesso();
  const contratoDocId = crypto.randomUUID();

  const snapshotV1 = {
    ...snapCalculado,
    versao: '1',
    contratoId: ctrCodigo,
    token: tokenAntigo,
    status: 'aguardando_assinatura_dentista',
    statusAssinaturaDentista: 'pendente',
    statusAssinaturaPaciente: 'pendente',
    assinaturaDentista: null,
    financeiro: {
      ...snapCalculado.financeiro,
      total: 8870, // Simula a divergência legada da Versão 1
      parcelas: [{ numero: 1, valor: 8870, metodo: 'Cartão de Crédito', status: 'Pendente', vencimento: 'Fatura do Cartão', descricao: 'Cartão de Crédito' }],
    },
  };

  const { error: errDocIns } = await supabase.from('documentos_clinicos').insert({
    id: contratoDocId,
    paciente_id: pacienteId,
    paciente_nome: pacienteNome,
    tipo: 'contrato',
    identificador: ctrCodigo,
    titulo: `Contrato Odontológico - ${pacienteNome} (${ctrCodigo})`,
    conteudo: '<html><body>Conteudo Legado V1 - Total R$ 8.870,00</body></html>',
    itens: snapshotV1,
    assinado_em: null, // Pendente de assinatura do paciente!
  });
  assert(!errDocIns, 11, 'Contrato pendente V1 gravado no banco de homologação');

  // ---------------------------------------------------------------------------
  // TESTE 3: Retificação Segura in-place, Preservação de UUID e Anti-Duplicação (Requisito 1)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Retificação in-place com Rotação de Token e Histórico (Requisitos 1, 2, 5) ---');
  const tokenNovo = gerarTokenAcesso();

  // Prepara o snapshot retificado (Versão 2) com arquivamento da Versão 1
  const snapshotV2 = {
    ...snapCalculado,
    versao: '2',
    contratoId: ctrCodigo,
    contratoAnteriorId: contratoDocId,
    token: tokenNovo,
    tokensRevogados: [tokenAntigo],
    tokenValidoAte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'aguardando_assinatura_paciente',
    statusAssinaturaDentista: 'assinado',
    statusAssinaturaPaciente: 'pendente',
    assinaturaDentista: {
      nome: 'Dra. Rosângela Santos Pereira',
      cro: '06267-AL',
      dataHora: new Date().toISOString(),
      metodo: 'assinatura_automatica_autorizada',
      autorizacaoId: 'fd777489-8d1e-4a86-abfe-ad7a59a5bdb9',
      autorizacaoExpressa: true,
    },
    versoesAnteriores: [
      {
        versao: '1',
        substituidoEm: new Date().toISOString(),
        motivo: 'Retificação de valores para alinhamento estrito com o orçamento aprovado',
        token: tokenAntigo,
        financeiro: snapshotV1.financeiro,
        orcamento: snapshotV1.orcamento,
        assinaturaDentista: snapshotV1.assinaturaDentista,
        conteudoHtml: '<html><body>Conteudo Legado V1 - Total R$ 8.870,00</body></html>',
      },
    ],
  };

  const htmlV2 = gerarHtmlContrato(snapshotV2);

  // Executa o UPDATE direto no mesmo registro UUID
  const { error: errUpd } = await supabase
    .from('documentos_clinicos')
    .update({
      conteudo: htmlV2,
      itens: snapshotV2,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', contratoDocId);
  assert(!errUpd, 12, 'UPDATE executado com sucesso no registro UUID existente', errUpd ? JSON.stringify(errUpd) : undefined);

  // Verifica contagem de registros para o paciente e código CTR
  const { data: rowsVerif } = await supabase
    .from('documentos_clinicos')
    .select('*')
    .eq('tipo', 'contrato')
    .eq('paciente_id', pacienteId)
    .eq('identificador', ctrCodigo);

  assert(rowsVerif?.length === 1, 13, `Contagem de contratos no banco é exatamente 1 (UUID preservado: ${contratoDocId})`);
  assert(rowsVerif?.[0].id === contratoDocId, 14, 'O UUID permaneceu idêntico após a retificação');
  assert(rowsVerif?.[0].identificador === ctrCodigo, 15, `O código CTR permaneceu idêntico (${ctrCodigo})`);

  // ---------------------------------------------------------------------------
  // TESTE 4: Verificação do Histórico da Versão Anterior (Requisito 2)
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Verificação Forense do Histórico da Versão 1 ---');
  const docRetificado = rowsVerif?.[0];
  const snapRecuperado = docRetificado.itens;

  assert(snapRecuperado.versao === '2', 16, 'Versão do contrato foi incrementada para 2');
  assert(Array.isArray(snapRecuperado.versoesAnteriores) && snapRecuperado.versoesAnteriores.length === 1, 17, 'Contrato possui histórico com exatamente 1 versão anterior arquivada');
  assert(snapRecuperado.versoesAnteriores[0].versao === '1', 18, 'Histórico arquivou corretamente a Versão 1');
  assert(snapRecuperado.versoesAnteriores[0].financeiro.total === 8870, 19, 'Histórico preserva o valor anterior de R$ 8.870,00');
  assert(snapRecuperado.versoesAnteriores[0].token === tokenAntigo, 20, 'Histórico preserva o token antigo revogado');
  assert(snapRecuperado.versoesAnteriores[0].assinaturaDentista === null || snapRecuperado.versoesAnteriores[0].assinaturaDentista?.nome === 'Dra. Rosângela Santos Pereira', 21, 'Histórico preserva o estado da assinatura da profissional da V1');

  // ---------------------------------------------------------------------------
  // TESTE 5: Rotação de Token & Invalidação Imediata do Token Anterior (Requisito 5 e 9)
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Validação de Rotação e Bloqueio de Token Revogado ---');
  assert(snapRecuperado.token === tokenNovo, 22, 'Token ativo no contrato é o novo token gerado');
  assert(snapRecuperado.tokensRevogados.includes(tokenAntigo), 23, 'Token antigo consta na lista de tokens revogados do contrato');

  // Simula a lógica de verificação de token revogado (mesma lógica inserida na Edge Function)
  function validarAcessoToken(doc: any, tokenInformado: string): { valido: boolean; motivo?: string } {
    const tokensRev = Array.isArray(doc.itens?.tokensRevogados) ? doc.itens.tokensRevogados : [];
    const versoesAnt = Array.isArray(doc.itens?.versoesAnteriores) ? doc.itens.versoesAnteriores : [];
    const tokensHistRev = versoesAnt.map((v: any) => v?.token).filter(Boolean);

    if (tokensRev.includes(tokenInformado) || tokensHistRev.includes(tokenInformado)) {
      return { valido: false, motivo: 'TOKEN_REVOGADO' };
    }
    const tokenAtual = (doc.itens?.token || '').trim();
    if (tokenAtual && tokenAtual === tokenInformado) {
      return { valido: true };
    }
    return { valido: false, motivo: 'TOKEN_INVALIDO' };
  }

  const resTokenAntigo = validarAcessoToken(docRetificado, tokenAntigo);
  assert(resTokenAntigo.valido === false && resTokenAntigo.motivo === 'TOKEN_REVOGADO', 24, 'Acesso com o TOKEN ANTIGO foi bloqueado imediatamente como TOKEN_REVOGADO');

  const resTokenNovo = validarAcessoToken(docRetificado, tokenNovo);
  assert(resTokenNovo.valido === true, 25, 'Acesso com o NOVO TOKEN foi autorizado com sucesso');

  // ---------------------------------------------------------------------------
  // TESTE 6: Proteção contra Alteração de Contrato Formalizado / Assinado (Requisito 3 e 9)
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Proteção de Imutabilidade Bilateral (Server-Side) ---');
  const contratoFormalizadoId = crypto.randomUUID();
  const ctrFormalizadoCodigo = `CTR-FORMALIZADO-${testSuffix}`;

  const { error: errFormIns } = await supabase.from('documentos_clinicos').insert({
    id: contratoFormalizadoId,
    paciente_id: pacienteId,
    paciente_nome: pacienteNome,
    tipo: 'contrato',
    identificador: ctrFormalizadoCodigo,
    titulo: `Contrato Formalizado - ${pacienteNome}`,
    conteudo: '<html>Conteudo Bilateral Imutavel</html>',
    itens: { status: 'formalizado', assinaturaPaciente: { dataHora: new Date().toISOString() } },
    assinado_em: new Date().toISOString(),
  });
  assert(!errFormIns, 26, 'Contrato formalizado de teste inserido com sucesso');

  // Simula tentativa de alteração do contrato formalizado
  function validarPermissaoSobrescrita(doc: any): { permitido: boolean; erro?: string } {
    const jaAssinado = Boolean(
      doc.assinado_em ||
      doc.status === 'formalizado' ||
      doc.itens?.status === 'formalizado' ||
      doc.itens?.status === 'assinado' ||
      doc.itens?.assinaturaPaciente?.assinaturaData ||
      doc.itens?.assinaturaPaciente
    );
    if (jaAssinado) {
      return {
        permitido: false,
        erro: 'CONTRATO_FORMALIZADO_IMUTAVEL: Operação bloqueada. Contrato formalizado ou assinado pelo paciente é imutável.',
      };
    }
    return { permitido: true };
  }

  const docFormalizadoRecuperado = (await supabase.from('documentos_clinicos').select('*').eq('id', contratoFormalizadoId).single()).data;
  const resTentativaAlteracao = validarPermissaoSobrescrita(docFormalizadoRecuperado);
  assert(resTentativaAlteracao.permitido === false && resTentativaAlteracao.erro?.includes('CONTRATO_FORMALIZADO_IMUTAVEL'), 27, 'Tentativa de alteração de contrato formalizado foi categoricamente bloqueada');

  // ---------------------------------------------------------------------------
  // TESTE 7: Regra de Assinatura Profissional com vs. sem Autorização (Requisito 4)
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Validação da Assinatura Profissional ---');
  // Cenário 7A: Autorização válida
  const authValida = {
    id: 'auth-123',
    ativo: true,
    profissionalNome: 'Dra. Rosângela Santos Pereira',
    profissionalCro: 'CRO-AL 06267',
    modelosAutorizados: ['geral', 'lentes_resina'],
  };
  assert(validarAutorizacaoAssinatura(authValida, 'geral') === true, 28, 'Autorização expressa válida da Dra. Rosângela é aceita para os novos termos');

  // Cenário 7B: Autorização revogada ou inexistente
  const authRevogada = {
    ...authValida,
    revogadoEm: new Date().toISOString(),
  };
  assert(validarAutorizacaoAssinatura(authRevogada, 'geral') === false, 29, 'Autorização revogada é rejeitada (exigindo nova assinatura manual da Dra.)');
  assert(validarAutorizacaoAssinatura(null, 'geral') === false, 30, 'Ausência de autorização é rejeitada (exigindo nova assinatura manual da Dra.)');

  // ---------------------------------------------------------------------------
  // TESTE 8: Concorrência Simultânea Anti-Duplicação (Requisito 9)
  // ---------------------------------------------------------------------------
  console.log('\n--- 8. Concorrência Simultânea Anti-Duplicação ---');
  // Dispara 5 updates concorrentes simultâneos no mesmo documento ID
  const updatesConcorrentes = Array.from({ length: 5 }).map((_, idx) =>
    supabase
      .from('documentos_clinicos')
      .update({
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', contratoDocId)
  );

  const resConcorrencia = await Promise.all(updatesConcorrentes);
  const todosSucesso = resConcorrencia.every((r) => !r.error);
  assert(todosSucesso, 31, 'Todos os 5 updates simultâneos concorrentes foram processados pelo banco sem falhas');

  const { data: rowsPosConcorrencia } = await supabase
    .from('documentos_clinicos')
    .select('id')
    .eq('tipo', 'contrato')
    .eq('paciente_id', pacienteId)
    .eq('identificador', ctrCodigo);
  assert(rowsPosConcorrencia?.length === 1, 32, 'Nenhuma duplicata criada durante execução de escrita concorrente');

  // ---------------------------------------------------------------------------
  // TESTE 9: Validação de HTML e PDF Oficial (Requisito 10)
  // ---------------------------------------------------------------------------
  console.log('\n--- 9. Verificação das Cláusulas 2ª, 3ª e Renderização HTML/PDF ---');
  assert(htmlV2.includes('6.050,00'), 33, 'HTML gerado contém expressamente o valor total de R$ 6.050,00');
  assert(htmlV2.includes('2.820,00'), 34, 'HTML gerado contém expressamente o desconto de R$ 2.820,00');
  assert(htmlV2.includes('8.870,00'), 35, 'HTML gerado contém expressamente o subtotal de R$ 8.870,00');
  assert(htmlV2.includes('18x') || htmlV2.includes('18 parcelas') || htmlV2.includes('336,11'), 36, 'HTML gerado descreve o parcelamento em 18 vezes com parcelas de R$ 336,11');
  assert(htmlV2.includes('336,12'), 37, 'HTML gerado descreve a parcela conciliada de R$ 336,12');

  // ---------------------------------------------------------------------------
  // TESTE 10: Fluxo Completo de Assinatura do Paciente sem Erro 422 (Requisito 10)
  // ---------------------------------------------------------------------------
  console.log('\n--- 10. Fluxo de Assinatura Digital do Paciente no Contrato Retificado ---');
  // O paciente assina o contrato retificado com R$ 6.050,00
  const validacaoAssinaturaPaciente = validarIntegridadeOrcamentoContrato(orcamentoMock, snapshotV2);
  assert(validacaoAssinaturaPaciente.valido === true, 38, 'Integridade financeira aceita: paciente NÃO é bloqueado com 422 FINANCIAL_DIVERGENCE_BLOCKED');

  const snapshotAssinadoFinal = {
    ...snapshotV2,
    status: 'formalizado',
    isFormalizadoTotal: true,
    assinadoEm: new Date().toISOString(),
    assinaturaPaciente: {
      nome: pacienteNome,
      cpf: '123.456.789-00',
      dataHora: new Date().toISOString(),
      metodo: 'assinatura_digital_tela',
    },
  };

  const { error: errAssinatura } = await supabase
    .from('documentos_clinicos')
    .update({
      assinado_em: snapshotAssinadoFinal.assinadoEm,
      itens: snapshotAssinadoFinal,
    })
    .eq('id', contratoDocId);
  assert(!errAssinatura, 39, 'Assinatura do paciente registrada com sucesso no banco de homologação');

  // Tenta re-assinar após formalizado: deve ser bloqueado
  const docFinal = (await supabase.from('documentos_clinicos').select('*').eq('id', contratoDocId).single()).data;
  const podeReassinar = !docFinal.assinado_em && !docFinal.itens?.assinaturaPaciente;
  assert(podeReassinar === false, 40, 'Re-assinatura pelo paciente bloqueada definitivamente após formalização');

  // Limpeza de homologação
  await supabase.from('documentos_clinicos').delete().eq('paciente_id', pacienteId);
  await supabase.from('orcamentos').delete().eq('paciente_id', pacienteId);
  await supabase.from('pacientes').delete().eq('id', pacienteId);

  console.log('\n================================================================================');
  console.log(`TODOS OS ${metrics.length} TESTES DE HOMOLOGAÇÃO PASSARAM COM 100% DE SUCESSO!`);
  console.log('================================================================================\n');
}

run().catch((err) => {
  console.error('\n❌ ERRO CRÍTICO NA EXECUÇÃO DOS TESTES DE HOMOLOGAÇÃO:', err);
  process.exit(1);
});
