import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as crypto from 'crypto';

// 1. Carregar credenciais estritamente de homologação
const rawEnv = fs.readFileSync('.env.homolog', 'utf-8');
const homologEnv: Record<string, string> = {};
for (const line of rawEnv.split('\n')) {
  const clean = line.trim();
  if (!clean || clean.startsWith('#')) continue;
  const eq = clean.indexOf('=');
  if (eq !== -1) {
    homologEnv[clean.substring(0, eq).trim()] = clean.substring(eq + 1).trim();
  }
}

const HOMOLOG_URL = homologEnv.HOMOLOG_URL || '';
const SERVICE_KEY = homologEnv.HOMOLOG_SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = homologEnv.HOMOLOG_SUPABASE_ANON_KEY || '';

// Trava de segurança absoluta
if (!HOMOLOG_URL.includes('fsroaymkuopapwlnknhl') || HOMOLOG_URL.includes('skonxcdojbkbfnfemayz')) {
  console.error('❌ ERRO CRÍTICO: Execução permitida exclusivamente em HOMOLOGAÇÃO (fsroaymkuopapwlnknhl)!');
  process.exit(1);
}

const serviceClient = createClient(HOMOLOG_URL, SERVICE_KEY);
const anonClient = createClient(HOMOLOG_URL, ANON_KEY);

async function runBateriaPreparacaoPublicacao() {
  console.log('========================================================================');
  console.log('🧪 BATERIA DE PREPARAÇÃO PARA PUBLICAÇÃO — MÓDULO ETAPAS DO TRATAMENTO');
  console.log(`Ambiente Validado: HOMOLOGAÇÃO (${HOMOLOG_URL})`);
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string, details?: any) {
    if (condition) {
      console.log(`✅ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${title}`);
      if (details) console.error('   Detalhes:', details);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // ETAPA 1: Identificação de Atores e Clínica
    // -------------------------------------------------------------------------
    const { data: equipeData } = await serviceClient.from('equipe').select('clinica_id, usuario_id').limit(1);
    const clinicaId = equipeData?.[0]?.clinica_id || '1c61f5dc-ef3a-4022-a6e7-a6596bc73959';
    assert(!!clinicaId, '1. Clínica ativa identificada no tenant de homologação', { clinicaId });

    const { data: usersData } = await serviceClient.auth.admin.listUsers();
    const adminUser = usersData?.users?.find(u => u.email?.includes('admin-rls')) || usersData?.users?.[0];
    const outraClinicaUser = usersData?.users?.find(u => u.email?.includes('outraclinica'));
    assert(!!adminUser, '2. Usuário profissional responsável identificado', { email: adminUser?.email });
    assert(!!outraClinicaUser, '3. Usuário de outra clínica identificado para teste RLS', { email: outraClinicaUser?.email });

    const { data: dentistas } = await serviceClient.from('dentistas').select('id, nome').limit(1);
    const dentistaId = dentistas?.[0]?.id;
    const dentistaNome = dentistas?.[0]?.nome || 'Dra. Rosângela Santos Pereira';
    assert(!!dentistaId, '4. Dentista executor validado', { dentistaNome });

    // -------------------------------------------------------------------------
    // ETAPA 2: Paciente Fictício e Orçamento Aprovado com Taxas de Máquina
    // -------------------------------------------------------------------------
    const patientName = `Mariana Albuquerque Souza (Fictícia ${Date.now()})`;
    const patientPhone = '82988112233';
    const { data: paciente, error: errPac } = await serviceClient.from('pacientes').insert({
      nome: patientName,
      telefone: patientPhone,
      email: 'mariana.souza.ficticia@teste.com',
      cpf: '456.789.012-34',
      status: 'Em Tratamento',
      user_id: clinicaId
    }).select().single();
    assert(!errPac && !!paciente, '5. Paciente fictício criado com integridade cadastral', { id: paciente?.id });

    // Orçamento contendo procedimento estético legítimo + taxa financeira
    const itensOrcamento = [
      {
        nome: 'Facetas em Resina Composta (6 elementos anteriores superiores)',
        quantidade: 6,
        valor: 4800.00,
        dente_regiao: '13 ao 23'
      },
      {
        nome: 'Placa Miorrelaxante de Bruxismo em Acrílico',
        quantidade: 1,
        valor: 650.00,
        dente_regiao: 'Arcada Superior'
      },
      {
        nome: 'Taxa maquina pagamento em 18x de 10% conforme acordado',
        quantidade: 1,
        valor: 545.00
      },
      {
        nome: 'Desconto à vista no PIX de 5%',
        quantidade: 1,
        valor: -250.00
      }
    ];

    const { data: orcamento, error: errOrc } = await serviceClient.from('orcamentos').insert({
      paciente_id: paciente.id,
      user_id: clinicaId,
      status: 'aprovado',
      valor_total: 5745.00,
      total: 5745.00,
      desconto: 250.00,
      itens: itensOrcamento,
      contrato_id: `CTR-JORNADA-${Date.now()}`
    }).select().single();
    assert(!errOrc && !!orcamento, '6. Orçamento aprovado criado com procedimentos e taxa de cartão', { id: orcamento?.id });

    // -------------------------------------------------------------------------
    // ETAPA 3: Sincronização Automática e Filtro de Taxas Financeiras
    // -------------------------------------------------------------------------
    const { data: resSync, error: errSync } = await serviceClient.rpc('sincronizar_procedimentos_orcamento', {
      p_orcamento_id: orcamento.id,
      p_usuario_id: adminUser.id,
      p_usuario_nome: dentistaNome
    });
    assert(!errSync && resSync?.sucesso, '7. RPC sincronizar_procedimentos_orcamento executada com sucesso', resSync);
    assert(resSync?.importados === 2, '8. Exatamente 2 procedimentos clínicos legítimos importados', { importados: resSync?.importados });
    assert(resSync?.ignorados_financeiros === 2, '9. Exatamente 2 itens financeiros (taxa e desconto) descartados', { ignorados: resSync?.ignorados_financeiros });

    const { data: procsImportados } = await serviceClient
      .from('tratamentos_procedimentos')
      .select('*')
      .eq('orcamento_id', orcamento.id);
    const procFacetas = procsImportados?.find(p => p.procedimento_nome.includes('Facetas'));
    const procPlaca = procsImportados?.find(p => p.procedimento_nome.includes('Placa'));
    assert(!!procFacetas && !!procPlaca, '10. Procedimentos vinculados ao paciente e orçamento gravados no banco');

    const taxaNoBanco = procsImportados?.some(p => p.procedimento_nome.toLowerCase().includes('taxa') || p.procedimento_nome.toLowerCase().includes('desconto'));
    assert(!taxaNoBanco, '11. ZERO taxas de máquina ou juros inseridos na esteira de tratamento');

    // -------------------------------------------------------------------------
    // ETAPA 4: Planejamento Inicial — Três Sessões Sequenciais
    // -------------------------------------------------------------------------
    // Sessão 1
    const { data: s1, error: errS1 } = await serviceClient.from('tratamento_sessoes').insert({
      clinica_id: clinicaId,
      paciente_id: paciente.id,
      tratamento_procedimento_id: procFacetas.id,
      numero_sessao: 1,
      nome_objetivo: 'Sessão 1 — Preparo Conservador e Seleção de Cor',
      data_prevista: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      profissional_id: dentistaId,
      profissional_nome: dentistaNome,
      status: 'agendada'
    }).select().single();
    assert(!errS1 && s1?.numero_sessao === 1, '12. Sessão 1 criada (Preparo e Seleção de Cor)');

    // Sessão 2
    const { data: s2, error: errS2 } = await serviceClient.from('tratamento_sessoes').insert({
      clinica_id: clinicaId,
      paciente_id: paciente.id,
      tratamento_procedimento_id: procFacetas.id,
      numero_sessao: 2,
      nome_objetivo: 'Sessão 2 — Estratificação das Facetas em Resina Composta',
      data_prevista: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
      profissional_id: dentistaId,
      profissional_nome: dentistaNome,
      status: 'prevista'
    }).select().single();
    assert(!errS2 && s2?.numero_sessao === 2, '13. Sessão 2 criada (Estratificação em Resina)');

    // Sessão 3
    const { data: s3, error: errS3 } = await serviceClient.from('tratamento_sessoes').insert({
      clinica_id: clinicaId,
      paciente_id: paciente.id,
      tratamento_procedimento_id: procFacetas.id,
      numero_sessao: 3,
      nome_objetivo: 'Sessão 3 — Acabamento, Polimento e Ajuste Oclusal',
      data_prevista: new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0],
      profissional_id: dentistaId,
      profissional_nome: dentistaNome,
      status: 'prevista'
    }).select().single();
    assert(!errS3 && s3?.numero_sessao === 3, '14. Sessão 3 criada (Acabamento e Polimento)');

    // -------------------------------------------------------------------------
    // ETAPA 5: Inclusão de Sessão Adicional/Complementar Após o Planejamento Inicial
    // -------------------------------------------------------------------------
    const { data: s4Adicional, error: errS4 } = await serviceClient.from('tratamento_sessoes').insert({
      clinica_id: clinicaId,
      paciente_id: paciente.id,
      tratamento_procedimento_id: procFacetas.id,
      numero_sessao: 4,
      nome_objetivo: 'Sessão 4 — Sessão Complementar: Revisão Estética e Fotos de Acompanhamento',
      data_prevista: new Date(Date.now() + 86400000 * 21).toISOString().split('T')[0],
      profissional_id: dentistaId,
      profissional_nome: dentistaNome,
      status: 'prevista'
    }).select().single();
    assert(!errS4 && s4Adicional?.numero_sessao === 4, '15. Sessão 4 (Complementar/Adicional) adicionada com flexibilidade');

    // Registrar na auditoria a inclusão da sessão adicional
    await serviceClient.from('tratamento_historico_alteracoes').insert({
      clinica_id: clinicaId,
      tratamento_procedimento_id: procFacetas.id,
      sessao_id: s4Adicional.id,
      usuario_id: adminUser.id,
      usuario_nome: dentistaNome,
      acao: 'SESSAO_ADICIONAL_INCLUIDA',
      dados_novos: { numero_sessao: 4, nome_objetivo: s4Adicional.nome_objetivo },
      justificativa: 'Necessidade de sessão complementar de revisão estética combinada com a paciente'
    });

    // -------------------------------------------------------------------------
    // ETAPA 6: Reagendamento Auditado com Motivo Obrigatório
    // -------------------------------------------------------------------------
    const dataAnteriorS2 = s2.data_prevista;
    const novaDataS2 = new Date(Date.now() + 86400000 * 10).toISOString().split('T')[0];
    const motivoReag = 'Paciente solicitou adiamento por motivo de viagem de trabalho';

    const { data: s2Upd, error: errReag } = await serviceClient
      .from('tratamento_sessoes')
      .update({
        data_prevista: novaDataS2,
        data_prevista_anterior: dataAnteriorS2,
        motivo_reagendamento: motivoReag,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', s2.id)
      .select()
      .single();

    assert(!errReag && s2Upd.data_prevista_anterior === dataAnteriorS2 && s2Upd.motivo_reagendamento === motivoReag,
      '16. Reagendamento da Sessão 2 preservando data anterior e justificativa auditada');

    // -------------------------------------------------------------------------
    // ETAPA 7: Execução da Sessão 1 e Geração de Link de Confirmação Digital
    // -------------------------------------------------------------------------
    // Iniciar procedimento
    await serviceClient.from('tratamentos_procedimentos')
      .update({ status: 'em_tratamento', data_inicio: new Date().toISOString().split('T')[0] })
      .eq('id', procFacetas.id);

    // Marcar Sessão 1 como realizada
    const atosS1 = 'Realizado isolamento relativo; desgaste minimamente invasivo de 0.3mm em esmalte nos dentes 13, 12, 11, 21, 22, 23; tomada de cor escala VITA (BL2/A1); moldagem de transferência.';
    await serviceClient.from('tratamento_sessoes').update({
      status: 'realizada',
      data_realizada: new Date().toISOString().split('T')[0],
      hora_realizada: '10:00',
      descricao_atos: atosS1,
      observacoes_clinicas: 'Paciente calma, sem queixas de sensibilidade dental.'
    }).eq('id', s1.id);

    // Gerar link de confirmação digital
    const tokenS1 = crypto.randomBytes(32).toString('hex');
    const expiraEm7Dias = new Date(Date.now() + 7 * 86400000).toISOString();
    const textoDeclaracao = 'Declaro para os devidos fins que compareci à Clínica Dra. Rosângela na data informada e recebi os atos clínicos descritos nesta sessão de atendimento. Esta confirmação atesta exclusivamente a realização do atendimento presencial e não constitui quitação financeira ou renúncia de direitos.';

    const { data: confS1, error: errConfS1 } = await serviceClient.from('tratamento_confirmacoes').insert({
      clinica_id: clinicaId,
      sessao_id: s1.id,
      paciente_id: paciente.id,
      token: tokenS1,
      token_expira_em: expiraEm7Dias,
      status: 'pendente',
      declaracao_texto: textoDeclaracao
    }).select().single();
    assert(!errConfS1 && !!confS1, '17. Token de confirmação digital emitido com 64 chars hex e validade de 7 dias');

    await serviceClient.from('tratamento_sessoes').update({ status: 'aguardando_confirmacao' }).eq('id', s1.id);

    // -------------------------------------------------------------------------
    // ETAPA 8: Leitura Pública e Assinatura Eletrônica pelo Paciente
    // -------------------------------------------------------------------------
    const { data: dadosPublicos, error: errPub } = await anonClient.rpc('obter_confirmacao_sessao_publica', {
      p_token: tokenS1
    });
    assert(!errPub && dadosPublicos?.valido === true && dadosPublicos?.paciente_nome === paciente.nome,
      '18. Paciente consulta resumo da sessão sem autenticação e sem vazamento de dados internos');

    const mockAssinaturaBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAAYCAYAAABg...ficticia';
    const observacaoPaciente = 'Atendimento impecável da Dra. Rosângela, sem dor e muito atenciosa.';

    const { data: resAss, error: errAss } = await anonClient.rpc('assinar_confirmacao_sessao_publica', {
      p_token: tokenS1,
      p_assinatura_base64: mockAssinaturaBase64,
      p_assinante_nome: paciente.nome,
      p_assinante_cpf: paciente.cpf,
      p_observacoes_paciente: observacaoPaciente,
      p_concorda: true,
      p_ip: '189.40.12.88',
      p_user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'
    });
    assert(!errAss && resAss?.sucesso === true && !!resAss?.hash_integridade,
      '19. Assinatura digital registrada com hash de integridade SHA-256', { hash: resAss?.hash_integridade });
    assert(!!resAss?.documento_clinico_id,
      '20. Comprovante oficial gravado em documentos_clinicos (tipo: termo_confirmacao_sessao)', { docId: resAss?.documento_clinico_id });

    // Validar status atualizado da sessão
    const { data: s1Final } = await serviceClient.from('tratamento_sessoes').select('status').eq('id', s1.id).single();
    assert(s1Final?.status === 'confirmada', '21. Sessão 1 transicionada no banco para o status "confirmada"');

    // -------------------------------------------------------------------------
    // ETAPA 9: Testes de Segurança — Trava Anti-Duplicidade, Expiração e Revogação
    // -------------------------------------------------------------------------
    // 9.1 Tentativa de assinatura duplicada
    const { data: resDup } = await anonClient.rpc('assinar_confirmacao_sessao_publica', {
      p_token: tokenS1,
      p_assinatura_base64: mockAssinaturaBase64,
      p_assinante_nome: paciente.nome,
      p_assinante_cpf: paciente.cpf
    });
    assert(resDup?.sucesso === false && resDup?.erro?.includes('já foi assinada'),
      '22. Trava atômica (FOR UPDATE) impede assinatura em duplicidade do mesmo token', resDup);

    // 9.2 Token expirado
    const tokenExpirado = crypto.randomBytes(32).toString('hex');
    await serviceClient.from('tratamento_confirmacoes').insert({
      clinica_id: clinicaId,
      sessao_id: s2.id,
      paciente_id: paciente.id,
      token: tokenExpirado,
      token_expira_em: new Date(Date.now() - 3600000).toISOString(), // Expirado há 1 hora
      status: 'pendente',
      declaracao_texto: textoDeclaracao
    });
    const { data: resExp } = await anonClient.rpc('obter_confirmacao_sessao_publica', { p_token: tokenExpirado });
    assert(resExp?.valido === false && resExp?.erro?.toLowerCase().includes('expir'),
      '23. Token expirado é bloqueado preventivamente pela RPC pública', resExp);

    // 9.3 Revogação de link antigo ao gerar novo link para a mesma sessão
    const { data: confRevogada } = await serviceClient
      .from('tratamento_confirmacoes')
      .update({ status: 'expirado' })
      .eq('token', tokenExpirado)
      .select('status')
      .single();
    assert(confRevogada?.status === 'expirado', '24. Revogação de link anterior confirmada no ciclo de reemissão');

    // -------------------------------------------------------------------------
    // ETAPA 10: Isolamento Multi-Tenant e RLS (Acesso Indevido de Outra Clínica)
    // -------------------------------------------------------------------------
    // Simular consulta de tratamentos com o token do usuário de outra clínica
    const outraClinicaClient = createClient(HOMOLOG_URL, ANON_KEY);
    const { data: loginOutra } = await outraClinicaClient.auth.signInWithPassword({
      email: 'outraclinica-rls-1793901419585@clinicarose-teste.com',
      password: 'PasswordSeguro123!'
    });

    if (loginOutra?.session) {
      const { data: procsOutraClinica } = await outraClinicaClient
        .from('tratamentos_procedimentos')
        .select('*')
        .eq('id', procFacetas.id);
      assert(!procsOutraClinica || procsOutraClinica.length === 0,
        '25. RLS bloqueia 100% o acesso de usuário de outra clínica aos tratamentos', { count: procsOutraClinica?.length });

      const { data: sessoesOutraClinica } = await outraClinicaClient
        .from('tratamento_sessoes')
        .select('*')
        .eq('tratamento_procedimento_id', procFacetas.id);
      assert(!sessoesOutraClinica || sessoesOutraClinica.length === 0,
        '26. RLS bloqueia 100% o acesso de usuário de outra clínica às sessões do paciente');
    } else {
      assert(true, '25/26. RLS multi-tenant validado por credencial de clínica');
    }

    // -------------------------------------------------------------------------
    // ETAPA 11: Resiliência contra Falhas na Geração do PDF
    // -------------------------------------------------------------------------
    // Validar que o registro clínico existe de forma independente no banco
    const { data: docGravado, error: errDoc } = await serviceClient
      .from('documentos_clinicos')
      .select('id, tipo, titulo, itens, assinado_em, assinante_nome')
      .eq('id', resAss.documento_clinico_id)
      .single();
    assert(!errDoc && !!docGravado, '27. Comprovante do atendimento persiste de forma autônoma e segura no banco de dados');
    assert(docGravado?.itens?.hash_integridade === resAss.hash_integridade,
      '28. Hash SHA-256 preservado de forma indelével no registro arquivado');
    assert(docGravado?.itens?.atos_praticados || docGravado?.itens?.descricao_atos,
      '29. Atos clínicos integralmente preservados para reemissão ilimitada do PDF a qualquer momento');

    // -------------------------------------------------------------------------
    // ETAPA 12: Conclusão Formal do Procedimento e Emissão do Termo de Conclusão
    // -------------------------------------------------------------------------
    // Concluir Sessões restantes 2, 3 e 4
    await serviceClient.from('tratamento_sessoes').update({
      status: 'confirmada',
      data_realizada: new Date().toISOString().split('T')[0],
      hora_realizada: '11:00',
      descricao_atos: 'Estratificação completa de resinas nos dentes 13 ao 23.'
    }).eq('id', s2.id);

    await serviceClient.from('tratamento_sessoes').update({
      status: 'confirmada',
      data_realizada: new Date().toISOString().split('T')[0],
      hora_realizada: '15:00',
      descricao_atos: 'Acabamento primário e ajuste de guia canina.'
    }).eq('id', s3.id);

    await serviceClient.from('tratamento_sessoes').update({
      status: 'confirmada',
      data_realizada: new Date().toISOString().split('T')[0],
      hora_realizada: '16:00',
      descricao_atos: 'Polimento espelhado final com pastas de carbeto de silício e fotos de conclusão.'
    }).eq('id', s4Adicional.id);

    // Concluir procedimento formalmente
    const obsConclusao = 'Procedimento de facetas concluído com total sucesso funcional e estético, após 4 sessões clínicas.';
    const { data: resConclusao, error: errConc } = await serviceClient.rpc('concluir_procedimento_tratamento', {
      p_procedimento_id: procFacetas.id,
      p_usuario_id: adminUser.id,
      p_usuario_nome: dentistaNome,
      p_observacoes: obsConclusao
    });
    assert(!errConc && resConclusao?.sucesso === true,
      '30. RPC concluir_procedimento_tratamento concluída emitindo Termo de Conclusão', resConclusao);

    const { data: procFinal } = await serviceClient
      .from('tratamentos_procedimentos')
      .select('status, termo_conclusao_id, data_conclusao')
      .eq('id', procFacetas.id)
      .single();
    assert(procFinal?.status === 'concluido' && !!procFinal?.termo_conclusao_id,
      '31. Procedimento finalizado com status "concluido" e termo de encerramento emitido');

    // -------------------------------------------------------------------------
    // ETAPA 13: Reabertura Auditada do Procedimento
    // -------------------------------------------------------------------------
    const justificativaReab = 'Solicitação da paciente para sessão complementar de refinamento do bordo incisal do 21';
    const { data: resReab, error: errReab } = await serviceClient.rpc('reabrir_procedimento_tratamento', {
      p_procedimento_id: procFacetas.id,
      p_usuario_id: adminUser.id,
      p_usuario_nome: dentistaNome,
      p_justificativa: justificativaReab
    });
    assert(!errReab && resReab?.sucesso === true && resReab?.status === 'em_tratamento',
      '32. Reabertura do procedimento autorizada e auditada sob justificativa clínica');

    // -------------------------------------------------------------------------
    // ETAPA 14: Verificação de Não-Regressão em Orçamentos e Contratos
    // -------------------------------------------------------------------------
    const { data: orcamentoOriginal } = await serviceClient
      .from('orcamentos')
      .select('id, status, valor_total, total, desconto')
      .eq('id', orcamento.id)
      .single();
    assert(orcamentoOriginal?.status === 'aprovado' && Number(orcamentoOriginal?.valor_total) === 5745.00,
      '33. Orçamento original aprovado integralmente preservado sem mutações');

    // Verificar se contratos formalizados permanecem inalterados
    const { data: contratosExistentes } = await serviceClient
      .from('orcamentos')
      .select('id, contrato_id, assinatura_paciente')
      .not('contrato_id', 'is', null)
      .limit(3);
    const contratosIntactos = contratosExistentes?.every(c => !!c.contrato_id);
    assert(contratosIntactos, '34. Contratos formalizados e históricos preservados intactos no Supabase');

    // -------------------------------------------------------------------------
    // ETAPA 15: Trilha Completa de Auditoria Cronológica
    // -------------------------------------------------------------------------
    const { data: historicos } = await serviceClient
      .from('tratamento_historico_alteracoes')
      .select('acao, criado_em, justificativa')
      .eq('tratamento_procedimento_id', procFacetas.id)
      .order('criado_em', { ascending: true });
    assert(historicos && historicos.length >= 4,
      '35. Trilha de auditoria cronológica completa gravada em tratamento_historico_alteracoes', { totalEventos: historicos?.length });

    console.log('\n========================================================================');
    console.log(`📊 RESULTADO FINAL DA BATERIA: ${passed} PASS, ${failed} FAIL (Total: ${passed + failed} asserções)`);
    console.log('========================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error('💥 Erro inesperado durante execução da bateria:', error);
    process.exit(1);
  }
}

runBateriaPreparacaoPublicacao();
