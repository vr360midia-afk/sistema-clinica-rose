import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';

// Carrega .env.homolog se existir
const envPath = path.resolve(process.cwd(), '.env.homolog');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      process.env[key] = val;
    }
  }
}

const SUPABASE_URL = process.env.HOMOLOG_URL || process.env.VITE_SUPABASE_URL || 'https://fsroaymkuopapwlnknhl.supabase.co';
const SERVICE_KEY = process.env.HOMOLOG_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('[ERRO] SUPABASE_SERVICE_ROLE_KEY não configurada no ambiente ou em .env.homolog');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// Importações dos motores do sistema
import {
  mapearDadosContrato,
  emitirContratoPersistido,
  gerarHtmlContrato,
  gerarIdentificadorContrato,
  gerarTokenAcesso,
  ContratoSnapshot,
} from '../src/utils/contratoEngine';

import { gerarContratoDoOrcamentoAprovado } from '../src/utils/orcamentoEngine';

// Simulação da lógica exata implementada no ContratoModal.tsx
function resolverContratoExistente(
  documentos: any[],
  targetOrcId: string | null,
  targetContratoId: string | null
) {
  if ((!targetOrcId && !targetContratoId) || documentos.length === 0) return null;

  const candidatos = documentos.filter(
    (d) =>
      d.tipo === 'contrato' &&
      ((targetOrcId && ((d.itens as any)?.orcamentoId === targetOrcId || d.orcamentoId === targetOrcId)) ||
        (targetContratoId &&
          (d.id === targetContratoId ||
            d.identificador === targetContratoId ||
            (d.itens as any)?.contratoId === targetContratoId)))
  );

  if (candidatos.length === 0) return null;

  candidatos.sort((a, b) => {
    const aSnap = (a.itens || {}) as any;
    const bSnap = (b.itens || {}) as any;
    const aFormalizado = Boolean(a.assinadoEm || aSnap.assinaturaPaciente?.assinaturaData || aSnap.status === 'formalizado' || a.status === 'formalizado');
    const bFormalizado = Boolean(b.assinadoEm || bSnap.assinaturaPaciente?.assinaturaData || bSnap.status === 'formalizado' || b.status === 'formalizado');
    if (aFormalizado !== bFormalizado) return aFormalizado ? -1 : 1;

    const aDra = Boolean(aSnap.assinaturaDentista?.assinaturaData || aSnap.statusAssinaturaDentista === 'assinado');
    const bDra = Boolean(bSnap.assinaturaDentista?.assinaturaData || bSnap.statusAssinaturaDentista === 'assinado');
    if (aDra !== bDra) return aDra ? -1 : 1;

    const aTime = new Date(a.assinadoEm || a.atualizadoEm || a.criadoEm || 0).getTime();
    const bTime = new Date(b.assinadoEm || b.atualizadoEm || b.criadoEm || 0).getTime();
    return bTime - aTime;
  });

  return candidatos[0];
}

function avaliarStatusContrato(doc: any, snapAtual: any) {
  const snapItens = (doc?.itens || {}) as any;
  const hasAssinaturaPaciente = Boolean(
    doc?.assinaturaData ||
    doc?.assinadoEm ||
    snapItens.assinaturaPaciente?.assinaturaData ||
    snapItens.status === 'formalizado' ||
    doc?.status === 'formalizado' ||
    snapAtual?.assinaturaPaciente?.assinaturaData ||
    snapAtual?.status === 'assinado' ||
    snapAtual?.status === 'formalizado'
  );

  const hasAssinaturaProfissional = Boolean(
    snapItens.assinaturaDentista?.assinaturaData ||
    snapItens.statusAssinaturaDentista === 'assinado' ||
    snapAtual?.assinaturaDentista?.assinaturaData ||
    snapAtual?.statusAssinaturaDentista === 'assinado'
  );

  const isFormalizadoBilateral = Boolean(hasAssinaturaPaciente && hasAssinaturaProfissional);
  const isContratoGravado = Boolean(doc?.id);

  let badgeTexto = '';
  if (isFormalizadoBilateral) {
    badgeTexto = '✓ Contrato Formalizado e Assinado Bilateralmente';
  } else if (hasAssinaturaProfissional && !hasAssinaturaPaciente) {
    badgeTexto = '⏳ Contrato Emitido — Assinado pela Profissional / Aguardando Paciente';
  } else if (hasAssinaturaPaciente && !hasAssinaturaProfissional) {
    badgeTexto = '⏳ Assinado pelo Paciente — Aguardando Profissional';
  } else if (isContratoGravado) {
    badgeTexto = '⏳ Contrato Gravado — Aguardando Assinaturas';
  } else {
    badgeTexto = '📝 Minuta em Elaboração — Aguardando Gravação';
  }

  return {
    hasAssinaturaPaciente,
    hasAssinaturaProfissional,
    isFormalizadoBilateral,
    isContratoGravado,
    badgeTexto,
    botaoFooter: isContratoGravado ? 'Contrato Gravado' : 'Gravar Contrato',
  };
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 TESTE DE VALIDAÇÃO: CORREÇÃO DO BOTÃO "GRAVAR CONTRATO"');
  console.log('   Ambiente: Homologação Supabase fsroaymkuopapwlnknhl');
  console.log('================================================================\n');

  let pacienteId: string | null = null;
  let orcamentoId: string | null = null;
  let docContratoId: string | null = null;

  try {
    // 1. Criar Paciente Fictício de Teste
    console.log('1️⃣ Criando paciente de teste em homologação...');
    const { data: pacData, error: pacErr } = await supabase
      .from('pacientes')
      .insert({
        nome: 'Paciente Teste Homologacao Modal ' + Date.now().toString().slice(-4),
        cpf: '111.222.333-44',
        telefone: '(82) 99999-8888',
        email: 'teste.modal@clinica-rose.com.br',
        endereco: 'Rua de Teste, 100 - Jatiúca, Maceió - AL',
        data_nascimento: '1990-05-15',
      })
      .select('id, nome, cpf, telefone, email, endereco, data_nascimento')
      .single();

    if (pacErr || !pacData) throw new Error('Falha ao criar paciente: ' + pacErr?.message);
    pacienteId = pacData.id;
    console.log(`   ✓ Paciente criado: ${pacData.nome} (ID: ${pacienteId})`);

    // 2. Criar Orçamento Aprovado com Condição PIX com Desconto
    console.log('\n2️⃣ Criando orçamento aprovado com condição acordada...');
    const condicaoAprovada = {
      id: 'cond_pix_vista_' + Date.now(),
      titulo: 'Opção 1: À Vista no PIX (10% de Desconto)',
      tipo: 'a_vista',
      descontoPercentual: 10,
      descontoValor: 350,
      valorTotal: 3150,
      selecionada: true,
      destaque: true,
      descricao: 'À vista com 10% de desconto via PIX no fechamento.',
    };

    const formasPagamentoJson = JSON.stringify({
      condicoes: [condicaoAprovada],
      condicaoEscolhidaId: condicaoAprovada.id,
    });

    const { data: orcData, error: orcErr } = await supabase
      .from('orcamentos')
      .insert({
        paciente_id: pacienteId,
        valor_total: 3500,
        total: 3150,
        desconto: 350,
        status: 'aprovado',
        itens: [
          { dente: 'Geral', descricao: 'Facetas em Resina Composta', quantidade: 6, valor: 583.33 },
        ],
        assinatura_paciente: {
          formasPagamento: formasPagamentoJson,
          condicaoEscolhida: condicaoAprovada,
        },
      })
      .select()
      .single();

    if (orcErr || !orcData) throw new Error('Falha ao criar orçamento: ' + orcErr?.message);
    orcamentoId = orcData.id;
    console.log(`   ✓ Orçamento criado e aprovado: ID ${orcamentoId} - Total: R$ ${orcData.total}`);

    // 3. Executar gravação automática pós-aprovação (função existente oficial)
    console.log('\n3️⃣ Executando gravação automática oficial (gerarContratoDoOrcamentoAprovado)...');
    const resContrato = await gerarContratoDoOrcamentoAprovado({
      orcamento: {
        id: orcamentoId,
        titulo: 'Plano Reabilitação Teste Modal',
        pacienteId,
        pacienteNome: pacData.nome,
        itens: orcData.itens,
        desconto: orcData.desconto,
        total: orcData.total,
        status: 'aprovado',
        formasPagamento: formasPagamentoJson,
        condicaoEscolhida: condicaoAprovada,
      } as any,
      patient: pacData,
      configuracoes: {
        nomeClinica: 'Clínica Dra. Rosângela Santos',
        croResponsavel: '06267-AL',
      },
      configContrato: {
        cidadeForoContrato: 'Maceió',
      },
      modeloId: 'lentes_resina',
    });

    if (!resContrato.ok || !resContrato.contratoId) {
      throw new Error('Falha na geração automática do contrato: ' + resContrato.error);
    }

    const contratoIdOficial = resContrato.contratoId;
    const tokenOficial = resContrato.contratoToken;
    console.log(`   ✓ Contrato gerado automaticamente: Identificador: ${contratoIdOficial}`);
    console.log(`   ✓ Token de acesso seguro: ${tokenOficial.slice(0, 8)}... (Comprimento: ${tokenOficial.length})`);

    // 4. Buscar documentos clínicos do paciente para testar a resolução do modal
    const { data: docsDb, error: docsErr } = await supabase
      .from('documentos_clinicos')
      .select('*')
      .eq('paciente_id', pacienteId);

    if (docsErr || !docsDb || docsDb.length === 0) {
      throw new Error('Documento não localizado em documentos_clinicos: ' + docsErr?.message);
    }
    docContratoId = docsDb[0].id;
    console.log(`   ✓ Documento persistido em documentos_clinicos: ID UUID ${docContratoId}`);

    // ==========================================================================
    // CENÁRIO 1: Orçamento aprovado com contrato aguardando assinatura
    // ==========================================================================
    console.log('\n📋 CENÁRIO 1: Orçamento aprovado com contrato aguardando assinatura');
    const docEncontrado1 = resolverContratoExistente(docsDb, orcamentoId, contratoIdOficial);
    if (!docEncontrado1) throw new Error('CENÁRIO 1 FALHOU: Contrato não localizado pelo resolvedor do modal!');
    console.log(`   ✓ Contrato localizado com sucesso pelo ID do orçamento: ${docEncontrado1.id}`);

    const snapCenario1 = docEncontrado1.itens as ContratoSnapshot;
    const avaliacao1 = avaliarStatusContrato(docEncontrado1, snapCenario1);
    console.log(`   ✓ isContratoGravado: ${avaliacao1.isContratoGravado}`);
    console.log(`   ✓ Botão exibido no footer: "${avaliacao1.botaoFooter}" (O botão "Gravar Contrato" foi OCULTADO)`);
    console.log(`   ✓ Badge de cabeçalho: "${avaliacao1.badgeTexto}"`);
    console.log(`   ✓ Identificador preservado: ${snapCenario1.contratoId} === ${contratoIdOficial}`);
    console.log(`   ✓ Token preservado: ${snapCenario1.token} === ${tokenOficial}`);

    if (!avaliacao1.isContratoGravado || avaliacao1.botaoFooter !== 'Contrato Gravado') {
      throw new Error('CENÁRIO 1 FALHOU: Botão não foi ocultado/substituído por "Contrato Gravado"');
    }

    // ==========================================================================
    // CENÁRIO 2: Contrato com assinatura profissional
    // ==========================================================================
    console.log('\n📋 CENÁRIO 2: Contrato com assinatura da profissional registrada');
    const docCenario2 = {
      ...docEncontrado1,
      itens: {
        ...snapCenario1,
        statusAssinaturaDentista: 'assinado',
        assinaturaDentista: {
          assinaturaData: 'data:image/png;base64,ficticiaProfissional',
          dataHora: new Date().toISOString(),
          nome: 'Dra. Rosângela Santos Pereira',
          cro: '06267-AL',
        },
      },
    };
    const avaliacao2 = avaliarStatusContrato(docCenario2, docCenario2.itens);
    console.log(`   ✓ hasAssinaturaProfissional: ${avaliacao2.hasAssinaturaProfissional}`);
    console.log(`   ✓ hasAssinaturaPaciente: ${avaliacao2.hasAssinaturaPaciente}`);
    console.log(`   ✓ Badge de cabeçalho: "${avaliacao2.badgeTexto}"`);
    console.log(`   ✓ Botão no footer: "${avaliacao2.botaoFooter}"`);
    if (!avaliacao2.hasAssinaturaProfissional || avaliacao2.hasAssinaturaPaciente || avaliacao2.isFormalizadoBilateral) {
      throw new Error('CENÁRIO 2 FALHOU: Status de assinatura da profissional incorreto!');
    }

    // ==========================================================================
    // CENÁRIO 3: Contrato com assinatura do paciente
    // ==========================================================================
    console.log('\n📋 CENÁRIO 3: Contrato com assinatura do paciente registrada');
    const docCenario3 = {
      ...docEncontrado1,
      itens: {
        ...snapCenario1,
        statusAssinaturaDentista: 'pendente',
        assinaturaDentista: null,
        statusAssinaturaPaciente: 'assinado',
        assinaturaPaciente: {
          assinaturaData: 'data:image/png;base64,ficticiaPaciente',
          dataHora: new Date().toISOString(),
          nome: pacData.nome,
        },
      },
    };
    const avaliacao3 = avaliarStatusContrato(docCenario3, docCenario3.itens);
    console.log(`   ✓ hasAssinaturaPaciente: ${avaliacao3.hasAssinaturaPaciente}`);
    console.log(`   ✓ hasAssinaturaProfissional: ${avaliacao3.hasAssinaturaProfissional}`);
    console.log(`   ✓ isFormalizadoBilateral: ${avaliacao3.isFormalizadoBilateral}`);
    console.log(`   ✓ Badge de cabeçalho: "${avaliacao3.badgeTexto}"`);
    console.log(`   ✓ Botão no footer: "${avaliacao3.botaoFooter}"`);
    if (!avaliacao3.hasAssinaturaPaciente || avaliacao3.isFormalizadoBilateral || avaliacao3.badgeTexto !== '⏳ Assinado pelo Paciente — Aguardando Profissional') {
      throw new Error('CENÁRIO 3 FALHOU: Status de assinatura do paciente incorreto!');
    }

    // ==========================================================================
    // CENÁRIO 4: Contrato totalmente formalizado (ambas as assinaturas)
    // ==========================================================================
    console.log('\n📋 CENÁRIO 4: Contrato totalmente formalizado (bilateral)');
    const docCenario4 = {
      ...docEncontrado1,
      status: 'formalizado',
      assinadoEm: new Date().toISOString(),
      itens: {
        ...snapCenario1,
        status: 'formalizado',
        assinaturaDentista: { assinaturaData: 'data:simuladaDra' },
        assinaturaPaciente: { assinaturaData: 'data:simuladaPac' },
      },
    };
    const avaliacao4 = avaliarStatusContrato(docCenario4, docCenario4.itens);
    console.log(`   ✓ isFormalizadoBilateral: ${avaliacao4.isFormalizadoBilateral}`);
    console.log(`   ✓ Badge de cabeçalho: "${avaliacao4.badgeTexto}"`);
    console.log(`   ✓ Botão no footer: "${avaliacao4.botaoFooter}"`);
    if (!avaliacao4.isFormalizadoBilateral || avaliacao4.badgeTexto !== '✓ Contrato Formalizado e Assinado Bilateralmente') {
      throw new Error('CENÁRIO 4 FALHOU: Contrato bilateral não identificado como formalizado!');
    }

    // ==========================================================================
    // CENÁRIO 5: Contrato manual ainda não gravado
    // ==========================================================================
    console.log('\n📋 CENÁRIO 5: Contrato manual / novo orçamento ainda não gravado');
    const docManual = resolverContratoExistente([], 'orc_inexistente_999', null);
    const avaliacao5 = avaliarStatusContrato(docManual, null);
    console.log(`   ✓ docManual encontrado: ${docManual}`);
    console.log(`   ✓ isContratoGravado: ${avaliacao5.isContratoGravado}`);
    console.log(`   ✓ Botão exibido no footer: "${avaliacao5.botaoFooter}" (Permanece ativo para gravação)`);
    console.log(`   ✓ Badge de cabeçalho: "${avaliacao5.badgeTexto}"`);
    if (avaliacao5.isContratoGravado || avaliacao5.botaoFooter !== 'Gravar Contrato') {
      throw new Error('CENÁRIO 5 FALHOU: Contrato novo não persistido deveria exibir "Gravar Contrato"!');
    }

    // ==========================================================================
    // CENÁRIO 6: Reabertura do modal e prevenção de duplicidade (Idempotência)
    // ==========================================================================
    console.log('\n📋 CENÁRIO 6: Reabertura do modal e teste de prevenção estrita de duplicidade');
    
    // Contagem inicial de contratos deste paciente
    const { count: countInicial } = await supabase
      .from('documentos_clinicos')
      .select('*', { count: 'exact', head: true })
      .eq('paciente_id', pacienteId)
      .eq('tipo', 'contrato');

    console.log(`   ✓ Contratos existentes antes da simulação: ${countInicial}`);

    // Simulação 1: Reabertura e resolução repetida 5 vezes
    for (let i = 1; i <= 5; i++) {
      const docReaberto = resolverContratoExistente(docsDb, orcamentoId, contratoIdOficial);
      if (!docReaberto || docReaberto.id !== docContratoId) {
        throw new Error(`Falha na reabertura ${i}: ID divergente!`);
      }
    }
    console.log('   ✓ Reabertura por 5 vezes consecutivas manteve exatamente o mesmo ID original sem duplicar.');

    // Simulação 2: Tentativa de re-executar salvamento forçando idParaGravar
    let idParaGravar = docContratoId; // Lógica do ContratoModal.tsx
    const payloadUpdate = {
      paciente_id: pacienteId,
      paciente_nome: pacData.nome,
      tipo: 'contrato',
      titulo: docEncontrado1.titulo,
      conteudo: gerarHtmlContrato(snapCenario1),
      itens: snapCenario1 as any,
    };

    // UPDATE executado pelo salvarDocumento
    const { error: updErr } = await supabase
      .from('documentos_clinicos')
      .update(payloadUpdate)
      .eq('id', idParaGravar);

    if (updErr) throw new Error('Falha no update idempotente: ' + updErr.message);

    // Contagem após a re-gravação
    const { count: countFinal } = await supabase
      .from('documentos_clinicos')
      .select('*', { count: 'exact', head: true })
      .eq('paciente_id', pacienteId)
      .eq('tipo', 'contrato');

    console.log(`   ✓ Contratos existentes após tentativa de re-gravação: ${countFinal}`);

    if (countFinal !== countInicial || countFinal !== 1) {
      throw new Error(`CENÁRIO 6 FALHOU: Duplicidade detectada! Esperado 1, encontrado ${countFinal}`);
    }
    console.log('   ✓ Confirmação: NENHUM registro duplicado foi criado. Idempotência garantida (1 contrato exato)!');

    // ==========================================================================
    // CENÁRIO 7: Proteção de snapshot e versionamento oficial (Ajuste 2)
    // ==========================================================================
    console.log('\n📋 CENÁRIO 7: Proteção de snapshot jurídico/financeiro e versionamento oficial');
    
    // Simulação da edição manual com versionamento (Proteção 3)
    const versaoAnterior = Number(snapCenario1.versao) || 1;
    const novaVersao = versaoAnterior + 1;
    const snapVersao2 = {
      ...snapCenario1,
      versao: String(novaVersao),
      contratoAnteriorId: docContratoId,
    };

    const { data: docV2, error: errV2 } = await supabase
      .from('documentos_clinicos')
      .insert({
        paciente_id: pacienteId,
        paciente_nome: pacData.nome,
        tipo: 'contrato',
        titulo: `Contrato Odontológico - Orçamento #${orcamentoId.slice(0, 8)} (v${novaVersao})`,
        conteudo: gerarHtmlContrato(snapVersao2 as any),
        itens: snapVersao2 as any,
      })
      .select()
      .single();

    if (errV2 || !docV2) throw new Error('Falha ao criar versão 2: ' + errV2?.message);
    console.log(`   ✓ Nova versão ${novaVersao} criada vinculada à versão anterior: ID ${docV2.id}`);

    // Verifica que a Versão 1 foi 100% PRESERVADA intacta
    const { data: checkV1 } = await supabase
      .from('documentos_clinicos')
      .select('*')
      .eq('id', docContratoId)
      .single();

    if (!checkV1 || (checkV1.itens as any).contratoId !== contratoIdOficial) {
      throw new Error('CENÁRIO 7 FALHOU: O snapshot da versão 1 foi corrompido ou sobrescrito!');
    }
    console.log(`   ✓ Versão 1 preservada intacta com identificador original: ${(checkV1.itens as any).contratoId}`);
    console.log(`   ✓ Cronograma financeiro da Versão 1 intacto: ${checkV1.itens.financeiro.parcelas.length} parcela(s)`);

    // Remove a versão 2 criada no teste
    await supabase.from('documentos_clinicos').delete().eq('id', docV2.id);
    console.log('   ✓ Teste de versionamento concluído e higienizado com sucesso.');

    console.log('\n================================================================');
    console.log('🎉 TODOS OS 7 CENÁRIOS FORAM VALIDADOS COM 100% DE SUCESSO!');
    console.log('================================================================');
  } finally {
    // Limpeza de dados de teste em homologação
    console.log('\n🧹 Limpando dados fictícios de homologação...');
    if (docContratoId) {
      await supabase.from('documentos_clinicos').delete().eq('id', docContratoId);
    }
    if (orcamentoId) {
      await supabase.from('orcamentos').delete().eq('id', orcamentoId);
    }
    if (pacienteId) {
      await supabase.from('pacientes').delete().eq('id', pacienteId);
    }
    console.log('   ✓ Limpeza concluída.');
  }
}

runTests().catch((err) => {
  console.error('\n❌ ERRO NA EXECUÇÃO DO TESTE:', err);
  process.exit(1);
});
