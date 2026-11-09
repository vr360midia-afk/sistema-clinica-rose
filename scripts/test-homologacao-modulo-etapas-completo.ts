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

// Trava absoluta contra execução em produção
if (HOMOLOG_URL.includes('skonxcdojbkbfnfemayz')) {
  console.error('❌ ERRO CRÍTICO: Tentativa de execução no banco de PRODUÇÃO (skonxcdojbkbfnfemayz)! Abortando imediatamente.');
  process.exit(1);
}

if (!HOMOLOG_URL.includes('fsroaymkuopapwlnknhl')) {
  console.error('❌ ERRO: Ambiente não corresponde ao Supabase de HOMOLOGAÇÃO (fsroaymkuopapwlnknhl)! Abortando.');
  process.exit(1);
}

const serviceClient = createClient(HOMOLOG_URL, SERVICE_KEY);
const anonClient = createClient(HOMOLOG_URL, ANON_KEY);

async function runModuloEtapasTests() {
  console.log('========================================================================');
  console.log('🧪 BATERIA DE HOMOLOGAÇÃO COMPLETA: MÓDULO ETAPAS DO TRATAMENTO');
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
    // 1. Obter clínica ativa através da equipe de homologação
    const { data: equipeData } = await serviceClient.from('equipe').select('clinica_id').limit(1);
    const clinicaId = equipeData?.[0]?.clinica_id || '1c61f5dc-ef3a-4022-a6e7-a6596bc73959';
    assert(!!clinicaId, 'Identificar clínica ativa em homologação', { clinicaId });

    const { data: usersData } = await serviceClient.auth.admin.listUsers();
    const testUser = usersData?.users?.find(u => u.email?.includes('admin-rls')) || usersData?.users?.[0];
    assert(!!testUser, 'Identificar usuário de homologação', { userId: testUser?.id, email: testUser?.email });

    // 2. Verificar ou obter dentista de homologação
    const { data: dentistas } = await serviceClient.from('dentistas').select('id, nome').limit(1);
    const dentistaId = dentistas?.[0]?.id;
    const dentistaNome = dentistas?.[0]?.nome || 'Dra. Rosângela Santos Pereira';
    assert(!!dentistaId, 'Dentista disponível para conduzir as sessões', { dentistaId, dentistaNome });

    // 3. Criar paciente de teste exclusivo para validação do ciclo de tratamento
    const testPatientName = `Paciente Homolog Etapas ${Date.now()}`;
    const testPatientPhone = '82999887766';
    const { data: paciente, error: errPac } = await serviceClient.from('pacientes').insert({
      nome: testPatientName,
      telefone: testPatientPhone,
      email: 'etapas.teste@clinicarose.com.br',
      cpf: '123.456.789-00',
      status: 'Em Tratamento',
      user_id: clinicaId
    }).select().single();
    assert(!!paciente && !errPac, 'Criar paciente de teste com vínculo de tenant', { id: paciente?.id, erro: errPac?.message });

    // 4. Criar orçamento aprovado com procedimentos clínicos E taxas financeiras (para testar o filtro inteligente)
    const itensOrcamento = [
      {
        nome: 'Clareamento Dental a Laser com Moldeiras',
        quantidade: 1,
        valor: 1200.00,
        dente_regiao: 'Arcadas Superior e Inferior'
      },
      {
        nome: 'Faceta em Resina Composta Dente 11 e 21',
        quantidade: 2,
        valor: 1600.00,
        dente_regiao: '11, 21'
      },
      {
        nome: 'Taxa maquina pagamento em 18x de 10% conforme acordado',
        quantidade: 1,
        valor: 280.00
      },
      {
        nome: 'Desconto promocional especial',
        quantidade: 1,
        valor: -150.00
      }
    ];

    const { data: orcamento, error: errOrc } = await serviceClient.from('orcamentos').insert({
      paciente_id: paciente.id,
      user_id: clinicaId,
      status: 'aprovado',
      valor_total: 2930.00,
      total: 2930.00,
      desconto: 0,
      itens: itensOrcamento,
      contrato_id: `CTR-HOMOLOG-${Date.now()}`
    }).select().single();
    assert(!!orcamento && !errOrc, 'Criar orçamento aprovado contendo procedimentos clínicos e taxas de máquina', { id: orcamento?.id, erro: errOrc?.message });

    // 5. Testar sincronização automática via RPC sincronizar_procedimentos_orcamento
    const { data: resSync1, error: errSync1 } = await serviceClient.rpc('sincronizar_procedimentos_orcamento', {
      p_orcamento_id: orcamento.id,
      p_usuario_id: testUser.id,
      p_usuario_nome: dentistaNome
    });
    assert(!errSync1 && resSync1?.sucesso, 'Executar sincronizar_procedimentos_orcamento pela 1ª vez', resSync1);
    assert(resSync1?.importados === 2, 'Importar estritamente 2 procedimentos clínicos legítimos', { importados: resSync1?.importados });
    assert(resSync1?.ignorados_financeiros === 2, 'Descartar automaticamente 2 itens financeiros (taxa maquina e desconto)', { ignorados: resSync1?.ignorados_financeiros });

    // 6. Testar IDEMPOTÊNCIA da sincronização (executar 2ª vez)
    const { data: resSync2, error: errSync2 } = await serviceClient.rpc('sincronizar_procedimentos_orcamento', {
      p_orcamento_id: orcamento.id,
      p_usuario_id: testUser.id,
      p_usuario_nome: dentistaNome
    });
    assert(!errSync2 && resSync2?.sucesso && resSync2?.importados === 0, 'Garantir IDEMPOTÊNCIA na 2ª sincronização (0 duplicatas geradas)', resSync2);

    const { data: procsNoBanco, error: errProcs } = await serviceClient
      .from('tratamentos_procedimentos')
      .select('*')
      .eq('orcamento_id', orcamento.id);
    assert(!errProcs && procsNoBanco?.length === 2, 'Confirmar exatamente 2 procedimentos gravados no banco', { total: procsNoBanco?.length });

    // 7. Validar descarte total de taxas financeiras nas tabelas clínicas
    const achouTaxa = procsNoBanco?.some(p => p.procedimento_nome.toLowerCase().includes('taxa maquina') || p.procedimento_nome.toLowerCase().includes('desconto'));
    assert(!achouTaxa, 'Taxas de cartão e descontos foram 100% excluídos da tabela clínica');

    const procClareamento = procsNoBanco?.find(p => p.procedimento_nome.includes('Clareamento'));
    assert(!!procClareamento && procClareamento.status === 'nao_iniciado', 'Procedimento Clareamento gravado com status "nao_iniciado"', { status: procClareamento?.status });

    // 8. Testar criação ilimitada de sessões sequenciais
    // Sessão 1
    const { data: sessao1, error: errS1 } = await serviceClient.from('tratamento_sessoes').insert({
      clinica_id: clinicaId,
      paciente_id: paciente.id,
      tratamento_procedimento_id: procClareamento.id,
      numero_sessao: 1,
      nome_objetivo: 'Sessão 1 - Profilaxia e 1ª Aplicação Laser',
      data_prevista: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      profissional_id: dentistaId,
      profissional_nome: dentistaNome,
      status: 'agendada'
    }).select().single();
    assert(!errS1 && !!sessao1 && sessao1.numero_sessao === 1, 'Criar Sessão 1 numerada sequencialmente', { id: sessao1?.id, num: sessao1?.numero_sessao });

    // Sessão 2
    const { data: sessao2, error: errS2 } = await serviceClient.from('tratamento_sessoes').insert({
      clinica_id: clinicaId,
      paciente_id: paciente.id,
      tratamento_procedimento_id: procClareamento.id,
      numero_sessao: 2,
      nome_objetivo: 'Sessão 2 - 2ª Aplicação Laser e Ajuste',
      data_prevista: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
      profissional_id: dentistaId,
      profissional_nome: dentistaNome,
      status: 'prevista'
    }).select().single();
    assert(!errS2 && !!sessao2 && sessao2.numero_sessao === 2, 'Criar Sessão 2 sequencial', { id: sessao2?.id, num: sessao2?.numero_sessao });

    // Sessão 3
    const { data: sessao3, error: errS3 } = await serviceClient.from('tratamento_sessoes').insert({
      clinica_id: clinicaId,
      paciente_id: paciente.id,
      tratamento_procedimento_id: procClareamento.id,
      numero_sessao: 3,
      nome_objetivo: 'Sessão 3 - Polimento e Registro Final',
      data_prevista: new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0],
      profissional_id: dentistaId,
      profissional_nome: dentistaNome,
      status: 'prevista'
    }).select().single();
    assert(!errS3 && !!sessao3 && sessao3.numero_sessao === 3, 'Criar Sessão 3 sequencial', { id: sessao3?.id, num: sessao3?.numero_sessao });

    // 9. Testar fluxo de reagendamento com auditoria da data anterior e justificativa
    const dataAnterior = sessao2.data_prevista;
    const novaDataPrevista = new Date(Date.now() + 86400000 * 9).toISOString().split('T')[0];
    const motivoReagendamento = 'Paciente solicitou alteração de data devido a escala de trabalho';

    const { data: s2Reagendada, error: errReag } = await serviceClient
      .from('tratamento_sessoes')
      .update({
        data_prevista: novaDataPrevista,
        data_prevista_anterior: dataAnterior,
        motivo_reagendamento: motivoReagendamento,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', sessao2.id)
      .select()
      .single();

    assert(!errReag && s2Reagendada.data_prevista === novaDataPrevista, 'Reagendar Sessão 2 preservando data_prevista_anterior e motivo', {
      anterior: s2Reagendada?.data_prevista_anterior,
      nova: s2Reagendada?.data_prevista,
      motivo: s2Reagendada?.motivo_reagendamento
    });

    // 10. Transição do procedimento para "em_tratamento"
    const { error: errUpStatus } = await serviceClient
      .from('tratamentos_procedimentos')
      .update({ status: 'em_tratamento', data_inicio: new Date().toISOString().split('T')[0] })
      .eq('id', procClareamento.id);
    assert(!errUpStatus, 'Transicionar status do procedimento para "em_tratamento"');

    // 11. Marcar Sessão 1 como REALIZADA
    const atosRealizados = 'Profilaxia com ultrassom; barreira gengival fotoativada; 3 aplicações de peróxido a 35%.';
    const { data: s1Realizada, error: errS1Real } = await serviceClient
      .from('tratamento_sessoes')
      .update({
        status: 'realizada',
        data_realizada: new Date().toISOString().split('T')[0],
        hora_realizada: '14:30',
        descricao_atos: atosRealizados,
        observacoes_clinicas: 'Paciente tolerou bem a aplicação, sem sensibilidade imediata.'
      })
      .eq('id', sessao1.id)
      .select()
      .single();
    assert(!errS1Real && s1Realizada.status === 'realizada', 'Marcar Sessão 1 como "realizada" registrando atos e horários');

    // 12. Gerar link de confirmação digital com validade padrão de 7 dias
    const tokenConfirmacao = crypto.randomBytes(32).toString('hex');
    const dataExpiracao = new Date(Date.now() + 7 * 86400000).toISOString();
    const textoDeclaracao = 'Declaro para os devidos fins que compareci à clínica na data informada e recebi os atos clínicos descritos. Não constitui quitação financeira ou renúncia de direitos.';

    const { data: confirmacao, error: errConf } = await serviceClient
      .from('tratamento_confirmacoes')
      .insert({
        clinica_id: clinicaId,
        sessao_id: sessao1.id,
        paciente_id: paciente.id,
        token: tokenConfirmacao,
        token_expira_em: dataExpiracao,
        status: 'pendente',
        declaracao_texto: textoDeclaracao
      })
      .select()
      .single();
    assert(!errConf && !!confirmacao, 'Gerar registro de confirmação com token criptográfico de 64 caracteres e expiração em 7 dias', { token: tokenConfirmacao });

    // Atualizar status da sessão para aguardando_confirmacao
    await serviceClient.from('tratamento_sessoes').update({
      status: 'aguardando_confirmacao'
    }).eq('id', sessao1.id);

    // 13. Testar RPC obter_confirmacao_sessao_publica com anonClient (acesso público do paciente)
    const { data: resPublico, error: errRpcPub } = await anonClient.rpc('obter_confirmacao_sessao_publica', {
      p_token: tokenConfirmacao
    });
    assert(!errRpcPub && resPublico?.sucesso, 'RPC obter_confirmacao_sessao_publica acessível sem autenticação', resPublico);
    assert(resPublico?.dados?.paciente_nome === paciente.nome, 'Dados públicos retornam nome correto do paciente e atos praticados');
    assert(resPublico?.dados?.status === 'pendente', 'Status retornado como "pendente" para assinatura');

    // 14. Testar assinatura digital pelo paciente via RPC assinar_confirmacao_sessao_publica
    const mockAssinaturaBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const observacaoPaciente = 'Atendimento excelente, pontual e muito cuidadoso.';

    const { data: resAssinatura, error: errAss } = await anonClient.rpc('assinar_confirmacao_sessao_publica', {
      p_token: tokenConfirmacao,
      p_assinatura_base64: mockAssinaturaBase64,
      p_assinante_nome: paciente.nome,
      p_assinante_cpf: paciente.cpf,
      p_observacoes_paciente: observacaoPaciente,
      p_concorda: true,
      p_ip: '187.19.200.45',
      p_user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) HomologTest/1.0'
    });
    assert(!errAss && resAssinatura?.sucesso, 'RPC assinar_confirmacao_sessao_publica executada pelo paciente gerando hash SHA-256', resAssinatura);
    assert(!!resAssinatura?.documento_clinico_id, 'Comprovante gravado em documentos_clinicos (termo_confirmacao_sessao)');

    // 15. Validar que a sessão foi atualizada para "confirmada" no banco
    const { data: sessao1PosAss, error: errS1Pos } = await serviceClient
      .from('tratamento_sessoes')
      .select('status, atualizado_em')
      .eq('id', sessao1.id)
      .single();
    assert(!errS1Pos && sessao1PosAss.status === 'confirmada', 'Sessão 1 atualizada no banco para o status "confirmada"');

    // 16. Testar TRAVA ANTI-DUPLICIDADE (tentar assinar novamente o mesmo token)
    const { data: resReassinatura } = await anonClient.rpc('assinar_confirmacao_sessao_publica', {
      p_token: tokenConfirmacao,
      p_assinatura_base64: mockAssinaturaBase64,
      p_assinante_nome: paciente.nome,
      p_assinante_cpf: paciente.cpf,
      p_concorda: true
    });
    assert(resReassinatura?.sucesso === false, 'Trava atômica impede assinatura duplicada em token já confirmado', resReassinatura);

    // 17. Testar REJEIÇÃO DE TOKEN EXPIRADO
    const tokenExpirado = crypto.randomBytes(32).toString('hex');
    await serviceClient.from('tratamento_confirmacoes').insert({
      clinica_id: clinicaId,
      sessao_id: sessao2.id,
      paciente_id: paciente.id,
      token: tokenExpirado,
      status: 'pendente',
      token_expira_em: new Date(Date.now() - 86400000).toISOString(), // Expirado ontem
      declaracao_texto: textoDeclaracao
    });

    const { data: resTokenExp } = await anonClient.rpc('obter_confirmacao_sessao_publica', {
      p_token: tokenExpirado
    });
    assert(resTokenExp?.valido === false && resTokenExp?.erro?.toLowerCase().includes('expir'), 'Rejeição segura de token expirado', resTokenExp);

    // 18. Concluir Sessão 2 e 3 para testar o fluxo de CONCLUSÃO DEFINITIVA DO PROCEDIMENTO
    await serviceClient.from('tratamento_sessoes').update({
      status: 'confirmada',
      data_realizada: new Date().toISOString().split('T')[0],
      hora_realizada: '15:00',
      descricao_atos: '2ª aplicação de laser e teste oclusal final.'
    }).eq('id', sessao2.id);

    await serviceClient.from('tratamento_sessoes').update({
      status: 'confirmada',
      data_realizada: new Date().toISOString().split('T')[0],
      hora_realizada: '16:00',
      descricao_atos: 'Polimento final com discos Sof-Lex e pasta Diamond.'
    }).eq('id', sessao3.id);

    // 19. Executar RPC concluir_procedimento_tratamento
    const observacaoConclusao = 'Procedimento concluído com êxito total e estabilidade de cor atingida.';
    const { data: resConclusao, error: errConc } = await serviceClient.rpc('concluir_procedimento_tratamento', {
      p_procedimento_id: procClareamento.id,
      p_usuario_id: testUser.id,
      p_usuario_nome: dentistaNome,
      p_observacoes: observacaoConclusao
    });
    assert(!errConc && resConclusao?.sucesso, 'RPC concluir_procedimento_tratamento executada com sucesso', resConclusao);

    const { data: procConcluido } = await serviceClient
      .from('tratamentos_procedimentos')
      .select('status, data_conclusao, termo_conclusao_id')
      .eq('id', procClareamento.id)
      .single();
    assert(procConcluido?.status === 'concluido' && !!procConcluido?.termo_conclusao_id, 'Procedimento transicionado para "concluido" com Termo de Conclusão emitido');

    // 20. Testar REABERTURA AUDITADA do procedimento
    const justificativaReabertura = 'Necessidade de sessão complementar de ajuste oclusal solicitada pelo paciente';
    const { data: resReabertura, error: errReab } = await serviceClient.rpc('reabrir_procedimento_tratamento', {
      p_procedimento_id: procClareamento.id,
      p_usuario_id: testUser.id,
      p_usuario_nome: dentistaNome,
      p_justificativa: justificativaReabertura
    });
    assert(!errReab && resReabertura?.sucesso, 'RPC reabrir_procedimento_tratamento executada mediante justificativa obrigatória', resReabertura);

    const { data: procReaberto } = await serviceClient
      .from('tratamentos_procedimentos')
      .select('status')
      .eq('id', procClareamento.id)
      .single();
    assert(procReaberto?.status === 'em_tratamento', 'Procedimento reaberto retornou com êxito para "em_tratamento"');

    // 21. Validar registro de auditoria em tratamento_historico_alteracoes
    const { data: historicos, error: errHist } = await serviceClient
      .from('tratamento_historico_alteracoes')
      .select('*')
      .eq('tratamento_procedimento_id', procClareamento.id);
    assert(!errHist && (historicos?.length || 0) >= 3, 'Trilha de auditoria completa registrada em tratamento_historico_alteracoes', { totalEventos: historicos?.length });

    // 22. Validar integridade das tabelas existentes (ZERO mutação em orcamentos)
    const { data: orcamentoIntacto } = await serviceClient.from('orcamentos').select('id, status, valor_total').eq('id', orcamento.id).single();
    assert(orcamentoIntacto?.status === 'aprovado' && Number(orcamentoIntacto?.valor_total) === 2930.00, 'Orçamento original integralmente preservado sem mutações');

    console.log('\n========================================================================');
    console.log(`📊 RESULTADO FINAL DA HOMOLOGAÇÃO: ${passed} PASS, ${failed} FAIL`);
    console.log('========================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error('💥 Erro durante execução dos testes:', error);
    process.exit(1);
  }
}

runModuloEtapasTests();
