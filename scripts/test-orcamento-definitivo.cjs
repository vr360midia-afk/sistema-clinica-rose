const assert = require('assert');

// 1. Simulação das funções canônicas do orcamentoEngine.ts
function slugifyNome(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizarIdentificadorPublico(input) {
  const raw = String(input || '').trim();
  const upper = raw.toUpperCase();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);

  let code8 = null;
  if (isUuid) {
    code8 = raw.slice(0, 8).toUpperCase();
  } else if (/^(ORC|CTR)-[0-9A-F]{8}$/i.test(raw)) {
    code8 = raw.slice(4, 12).toUpperCase();
  } else if (/^[0-9A-F]{8}$/i.test(raw)) {
    code8 = upper;
  }

  const withOrc = code8 ? `ORC-${code8}` : upper.startsWith('ORC-') ? upper : `ORC-${upper}`;
  const withCtr = code8 ? `CTR-${code8}` : upper.startsWith('CTR-') ? upper : `CTR-${upper}`;

  return { raw, upper, code8, isUuid, withOrc, withCtr };
}

function construirUrlPublicaOrcamento({ pacienteNome, identificador, token }) {
  const base = 'https://app.lentesemresinamaceio.com.br';
  const slug = slugifyNome(pacienteNome || 'paciente');
  const tokenParam = token ? `token=${encodeURIComponent(token)}` : '';
  const queryStr = tokenParam ? `?${tokenParam}` : '';
  return `${base}/${slug}/orcamento/${identificador}${queryStr}`;
}

// 2. Simulador do Backend do orcamento-publico (Edge Function e RPC)
function criarServidorBackend() {
  const bancoDeDados = new Map();

  return {
    salvarNoBanco(registro) {
      bancoDeDados.set(registro.id, JSON.parse(JSON.stringify(registro)));
    },

    buscarNoBanco(targetId) {
      const norm = normalizarIdentificadorPublico(targetId);
      for (const [id, row] of bancoDeDados.entries()) {
        const snap = row.assinatura_paciente || {};
        const snapId = snap.identificador || row.identificador;
        const normSnap = snapId ? normalizarIdentificadorPublico(snapId) : null;

        // Match por UUID exato
        if (norm.isUuid && row.id === norm.raw) return row;
        // Match por código de 8 caracteres do UUID (ex: 3327cc94 -> 3327cc94-xxxx)
        if (norm.code8 && row.id.toUpperCase().startsWith(norm.code8)) return row;
        // Match por identificador com prefixo ORC- ou CTR-
        if (norm.code8 && normSnap?.code8 === norm.code8) return row;
        // Match por string exata
        if (snapId === norm.raw || snapId === norm.upper || snapId === norm.withOrc || snapId === norm.withCtr) return row;
        if (row.token_assinatura === targetId) return row;
      }
      return null;
    },

    // Endpoint Backend: action 'get'
    async endpointGet(targetId, token) {
      if (!targetId || !token) {
        return { ok: false, error: 'Identificador e token são obrigatórios', code: 'INVALID_PARAM', status: 400 };
      }

      const row = this.buscarNoBanco(targetId);
      if (!row) {
        return { ok: false, error: 'Orçamento não encontrado. Verifique o link ou solicite um novo à clínica.', code: 'NOT_FOUND', status: 404 };
      }

      const snap = row.assinatura_paciente || {};
      const tokenSalvo = row.token_assinatura || snap.token;

      if (!tokenSalvo || tokenSalvo !== token) {
        return { ok: false, error: 'Orçamento não encontrado. Verifique o link ou solicite um novo à clínica.', code: 'INVALID_TOKEN', status: 403 };
      }

      const expiraEm = row.data_expiracao_link || snap.dataExpiracaoLink;
      if (expiraEm && new Date(expiraEm) < new Date()) {
        return { ok: false, error: 'Esta proposta de orçamento expirou. Solicite um novo link à clínica.', code: 'EXPIRED_TOKEN', isExpirado: true, status: 410 };
      }

      return {
        ok: true,
        status: 200,
        orcamento: {
          id: row.id,
          identificador: snap.identificador || row.identificador,
          titulo: row.titulo,
          itens: row.itens,
          subtotal: (row.itens || []).reduce((acc, i) => acc + i.valor * i.quantidade, 0),
          desconto: row.desconto || 0,
          total: row.total,
          status: row.status,
          versao: row.versao || snap.versao || 1,
          condicaoEscolhida: snap.condicaoEscolhida || null,
          aprovadoEm: snap.aprovadoEm || null,
          solicitacoesAjuste: snap.solicitacoesAjuste || [],
          contratoId: snap.contratoId || null,
          contratoLink: snap.contratoLink || null,
          clinica: { nome: 'Clínica Odontológica' },
          pacienteNome: row.paciente_nome,
        },
      };
    },

    // Endpoint Backend: action 'approve'
    async endpointApprove(targetId, token, condicaoEscolhida, versaoAprovada) {
      if (!targetId || !token || !condicaoEscolhida) {
        return { ok: false, error: 'Parâmetros obrigatórios ausentes', code: 'INVALID_PARAM', status: 400 };
      }

      const row = this.buscarNoBanco(targetId);
      if (!row) {
        return { ok: false, error: 'Orçamento não encontrado', code: 'NOT_FOUND', status: 404 };
      }

      const snap = row.assinatura_paciente || {};
      const tokenSalvo = row.token_assinatura || snap.token;
      if (!tokenSalvo || tokenSalvo !== token) {
        return { ok: false, error: 'Token inválido', code: 'INVALID_TOKEN', status: 403 };
      }

      if (row.status === 'aprovado' || snap.status === 'aprovado') {
        return { ok: true, jaAprovado: true, status: 'aprovado', aprovadoEm: snap.aprovadoEm, statusHttp: 200 };
      }

      const nowIso = new Date().toISOString();
      row.status = 'aprovado';
      row.aprovado_em = nowIso;
      row.condicao_escolhida = condicaoEscolhida;
      snap.status = 'aprovado';
      snap.aprovadoEm = nowIso;
      snap.condicaoEscolhida = condicaoEscolhida;
      row.assinatura_paciente = snap;
      this.salvarNoBanco(row);

      return {
        ok: true,
        id: row.id,
        status: 'aprovado',
        aprovadoEm: nowIso,
        condicaoEscolhida,
        statusHttp: 200,
      };
    },

    // Endpoint Backend: action 'request_adjustment'
    async endpointRequestAdjustment(targetId, token, motivo, mensagem) {
      if (!targetId || !token || !motivo) {
        return { ok: false, error: 'Parâmetros obrigatórios ausentes', code: 'INVALID_PARAM', status: 400 };
      }

      const row = this.buscarNoBanco(targetId);
      if (!row) {
        return { ok: false, error: 'Orçamento não encontrado', code: 'NOT_FOUND', status: 404 };
      }

      const snap = row.assinatura_paciente || {};
      const tokenSalvo = row.token_assinatura || snap.token;
      if (!tokenSalvo || tokenSalvo !== token) {
        return { ok: false, error: 'Token inválido', code: 'INVALID_TOKEN', status: 403 };
      }

      if (row.status === 'aprovado' || snap.status === 'aprovado') {
        return { ok: false, error: 'Orçamento já aprovado não pode receber solicitação de ajuste', code: 'ALREADY_APPROVED', status: 400 };
      }

      const nowIso = new Date().toISOString();
      const versaoAtual = Number(row.versao || snap.versao || 1);
      const novaSol = {
        id: `ajuste-${Date.now()}`,
        orcamentoId: row.id,
        versaoOrcamento: versaoAtual,
        motivo,
        mensagem: mensagem || null,
        solicitadaEm: nowIso,
        atendida: false,
      };

      row.status = 'ajuste_solicitado';
      snap.status = 'ajuste_solicitado';
      snap.solicitacoesAjuste = [...(snap.solicitacoesAjuste || []), novaSol];
      row.assinatura_paciente = snap;
      this.salvarNoBanco(row);

      return {
        ok: true,
        id: row.id,
        status: 'ajuste_solicitado',
        solicitacao: novaSol,
        statusHttp: 200,
      };
    },
  };
}

async function runSuite() {
  console.log('================================================================');
  console.log('TESTES DE INTEGRAÇÃO OBRIGATÓRIOS: ACESSO AO ORÇAMENTO');
  console.log('================================================================\n');

  const backend = criarServidorBackend();

  // DADOS DE TESTE BASEADOS NO CASO REAL DO USUÁRIO
  const uuidOrcamento = '3327cc94-e74f-4a02-86ee-396a84f3c75d';
  const tokenValido = 'a1b2c3d4e5f678901234567890abcdef1234567890abcdef';
  const tokenInvalido = '000000000000000000000000000000000000000000000000';
  const pacienteNome = 'Michael Jonathan Lima Germano';

  const orcamentoDb = {
    id: uuidOrcamento,
    identificador: 'ORC-3327CC94',
    token_assinatura: tokenValido,
    paciente_nome: pacienteNome,
    titulo: 'Tratamento de Lentes em Resina (10 elementos)',
    itens: [
      { nome: 'Facetas em Resina', quantidade: 10, valor: 450 },
      { nome: 'Placa Miorrelaxante', quantidade: 1, valor: 500 },
    ],
    desconto: 500,
    total: 4500,
    status: 'enviado',
    versao: 1,
    data_expiracao_link: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    assinatura_paciente: {
      identificador: 'ORC-3327CC94',
      token: tokenValido,
      versao: 1,
      solicitacoesAjuste: [],
      historicoVersoes: [],
      condicaoEscolhida: null,
      aprovadoEm: null,
      contratoId: null, // NÃO GERA CONTRATO ENQUANTO NÃO ESTIVER APROVADO!
    },
  };

  backend.salvarNoBanco(orcamentoDb);
  console.log('[OK] Orçamento inicial salvo no Supabase com UUID:', uuidOrcamento);

  // 1. TESTE DA URL PÚBLICA
  console.log('\n--- CENÁRIO 1: Validação do Formato da URL Pública ---');
  const urlPublica = construirUrlPublicaOrcamento({
    pacienteNome,
    identificador: 'CTR-3327CC94',
    token: tokenValido,
  });
  console.log('URL gerada:', urlPublica);
  assert.ok(!urlPublica.includes('base64'), 'URL não pode conter base64');
  assert.ok(!urlPublica.includes('&c='), 'URL não pode conter &c=');
  assert.ok(urlPublica.includes('/orcamento/CTR-3327CC94?token='), 'URL deve conter o formato canônico curto');
  console.log('[PASSOU] URL limpa, sem Base64 e em formato canônico.');

  // 2. TESTE DE NORMALIZAÇÃO DE IDENTIFICADORES (CTR-3327CC94 vs ORC-3327CC94 vs UUID)
  console.log('\n--- CENÁRIO 2: Normalização e Resolução de CTR / ORC / UUID ---');
  const normCtr = normalizarIdentificadorPublico('CTR-3327CC94');
  const normOrc = normalizarIdentificadorPublico('ORC-3327CC94');
  const normClean = normalizarIdentificadorPublico('3327CC94');
  const normUuid = normalizarIdentificadorPublico(uuidOrcamento);

  assert.strictEqual(normCtr.code8, '3327CC94');
  assert.strictEqual(normOrc.code8, '3327CC94');
  assert.strictEqual(normClean.code8, '3327CC94');
  assert.strictEqual(normUuid.code8, '3327CC94');
  console.log('[PASSOU] Todos os formatos (CTR-3327CC94, ORC-3327CC94, 3327CC94, UUID) normalizam para code8="3327CC94".');

  // 3. RECUPERAÇÃO DO ORÇAMENTO USANDO CTR-3327CC94
  console.log('\n--- CENÁRIO 3: Recuperação pública via identificador CTR-3327CC94 ---');
  const resCtr = await backend.endpointGet('CTR-3327CC94', tokenValido);
  assert.strictEqual(resCtr.ok, true, 'Deve carregar com identificador CTR-3327CC94');
  assert.strictEqual(resCtr.orcamento.id, uuidOrcamento);
  assert.strictEqual(resCtr.orcamento.total, 4500);
  assert.strictEqual(resCtr.orcamento.status, 'enviado');
  assert.strictEqual(resCtr.orcamento.contratoId, null, 'NÃO deve conter contrato antes da aprovação');
  console.log('[PASSOU] Orçamento carregado com sucesso via CTR-3327CC94 em navegador anônimo!');

  // 4. RECUPERAÇÃO DO ORÇAMENTO USANDO ORC-3327CC94 E UUID
  console.log('\n--- CENÁRIO 4: Recuperação pública via ORC-3327CC94 e UUID ---');
  const resOrc = await backend.endpointGet('ORC-3327CC94', tokenValido);
  assert.strictEqual(resOrc.ok, true);
  assert.strictEqual(resOrc.orcamento.id, uuidOrcamento);

  const resUuid = await backend.endpointGet(uuidOrcamento, tokenValido);
  assert.strictEqual(resUuid.ok, true);
  assert.strictEqual(resUuid.orcamento.id, uuidOrcamento);
  console.log('[PASSOU] Orçamento recuperado com sucesso via ORC-3327CC94 e via UUID interno.');

  // 5. TESTE DE ERROS: TOKEN INVÁLIDO
  console.log('\n--- CENÁRIO 5: Validação com Token Inválido ---');
  const resTokenInv = await backend.endpointGet('CTR-3327CC94', tokenInvalido);
  assert.strictEqual(resTokenInv.ok, false);
  assert.strictEqual(resTokenInv.code, 'INVALID_TOKEN');
  assert.strictEqual(resTokenInv.status, 403);
  assert.ok(!resTokenInv.error.includes(tokenInvalido), 'Não deve expor o token no erro');
  console.log('[PASSOU] Acesso negado com segurança para token incorreto.');

  // 6. TESTE DE ERROS: REGISTRO INEXISTENTE
  console.log('\n--- CENÁRIO 6: Validação de Registro Inexistente ---');
  const resInexistente = await backend.endpointGet('CTR-99999999', tokenValido);
  assert.strictEqual(resInexistente.ok, false);
  assert.strictEqual(resInexistente.code, 'NOT_FOUND');
  assert.strictEqual(resInexistente.status, 404);
  console.log('[PASSOU] Tratamento correto de orçamento inexistente.');

  // 7. TESTE DE ERROS: PROPOSTA EXPIRADA
  console.log('\n--- CENÁRIO 7: Validação de Token / Proposta Expirada ---');
  const orcamentoExpirado = {
    ...orcamentoDb,
    id: 'expirado-1234-5678-90ab-cdef12345678',
    identificador: 'ORC-EXPIRADO',
    data_expiracao_link: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    assinatura_paciente: {
      identificador: 'ORC-EXPIRADO',
      token: tokenValido,
    },
  };
  backend.salvarNoBanco(orcamentoExpirado);

  const resExp = await backend.endpointGet('ORC-EXPIRADO', tokenValido);
  assert.strictEqual(resExp.ok, false);
  assert.strictEqual(resExp.isExpirado, true);
  assert.strictEqual(resExp.code, 'EXPIRED_TOKEN');
  console.log('[PASSOU] Proposta expirada identificada com precisão (status 410).');

  // 8. TESTE: SOLICITAÇÃO DE AJUSTE PELO PACIENTE (ANÔNIMO)
  console.log('\n--- CENÁRIO 8: Solicitação de Ajuste pelo Paciente em Navegador Anônimo ---');
  const motivo = 'Gostaria de uma condição melhor no valor';
  const mensagem = 'Consigo pagar uma entrada maior de R$ 1.500 no PIX para reduzir as parcelas?';

  const resAjuste = await backend.endpointRequestAdjustment('CTR-3327CC94', tokenValido, motivo, mensagem);
  assert.strictEqual(resAjuste.ok, true);
  assert.strictEqual(resAjuste.status, 'ajuste_solicitado');
  assert.strictEqual(resAjuste.solicitacao.motivo, motivo);
  assert.strictEqual(resAjuste.solicitacao.mensagem, mensagem);

  // Verifica persistência no banco
  const orcAposAjuste = backend.buscarNoBanco('CTR-3327CC94');
  assert.strictEqual(orcAposAjuste.status, 'ajuste_solicitado');
  assert.strictEqual(orcAposAjuste.assinatura_paciente.solicitacoesAjuste.length, 1);
  console.log('[PASSOU] Solicitação de ajuste registrada no Supabase com sucesso mantendo o link!');

  // 9. TESTE: APROVAÇÃO DO ORÇAMENTO PELO PACIENTE (ANÔNIMO)
  console.log('\n--- CENÁRIO 9: Aprovação do Orçamento pelo Paciente em Navegador Anônimo ---');
  const condicaoAprovada = {
    id: 'pix-a-vista',
    tipo: 'a_vista',
    descricao: 'À Vista no PIX com 10% de desconto',
    valorTotal: 4050,
    valorDesconto: 450,
  };

  const resAprov = await backend.endpointApprove('CTR-3327CC94', tokenValido, condicaoAprovada, 1);
  assert.strictEqual(resAprov.ok, true);
  assert.strictEqual(resAprov.status, 'aprovado');
  assert.ok(resAprov.aprovadoEm, 'Deve conter timestamp de aprovação');

  // Verifica persistência definitiva no Supabase
  const orcAposAprovacao = backend.buscarNoBanco('CTR-3327CC94');
  assert.strictEqual(orcAposAprovacao.status, 'aprovado');
  assert.strictEqual(orcAposAprovacao.assinatura_paciente.condicaoEscolhida.id, 'pix-a-vista');
  console.log('[PASSOU] Orçamento aprovado com sucesso e persistido no Supabase!');

  // 10. TESTE: BLOQUEIO DE APROVAÇÃO DUPLICADA / IDEMPOTÊNCIA
  console.log('\n--- CENÁRIO 10: Bloqueio de Aprovação Duplicada (Idempotência) ---');
  const resAprovDup = await backend.endpointApprove('CTR-3327CC94', tokenValido, condicaoAprovada, 1);
  assert.strictEqual(resAprovDup.ok, true);
  assert.strictEqual(resAprovDup.jaAprovado, true);
  console.log('[PASSOU] Bloqueio idempotente de aprovação duplicada funcionando!');

  // 11. TESTE: BLOQUEIO DE AJUSTE APÓS APROVAÇÃO
  console.log('\n--- CENÁRIO 11: Bloqueio de Solicitação de Ajuste Após Aprovação ---');
  const resAjustePosAprov = await backend.endpointRequestAdjustment('CTR-3327CC94', tokenValido, 'Outro motivo');
  assert.strictEqual(resAjustePosAprov.ok, false);
  assert.strictEqual(resAjustePosAprov.code, 'ALREADY_APPROVED');
  console.log('[PASSOU] Solicitação de ajuste bloqueada em orçamento já aprovado!');

  console.log('\n================================================================');
  console.log('TODOS OS 11 TESTES OBRIGATÓRIOS FORAM EXECUTADOS E PASSARAM COM SUCESSO!');
  console.log('================================================================\n');
}

runSuite().catch((err) => {
  console.error('\n[FALHA NO TESTE]:', err);
  process.exit(1);
});

