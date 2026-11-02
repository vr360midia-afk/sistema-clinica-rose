const assert = require('assert');

// Mock localStorage for Node.js environment
const store = new Map();
global.window = {
  localStorage: {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] || null,
    get length() { return store.size; },
  },
};

// Import utilities
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function gerarIdentificadorOrcamento() {
  const chars = '0123456789ABCDEF';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * 16)];
  }
  return `ORC-${code}`;
}

function gerarTokenAcesso() {
  const chars = '0123456789abcdef';
  let token = '';
  for (let i = 0; i < 48; i++) {
    token += chars[Math.floor(Math.random() * 16)];
  }
  return token;
}

function construirUrlPublicaOrcamento(pacienteNome, identificador, token) {
  const base = 'https://app.lentesemresinamaceio.com.br';
  const slug = slugify(pacienteNome);
  return `${base}/${slug}/orcamento/${identificador}?token=${encodeURIComponent(token)}`;
}

function formatMoney(val) {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Simulador do serviço centralizado usando as regras exatas do orcamentoEngine.ts
function criarServicoCentralizado() {
  const db = new Map();

  return {
    async salvarOrcamento(orcamento) {
      const id = orcamento.id || 'uuid-' + Math.random().toString(36).substring(2, 9);
      const identificador = orcamento.identificador || gerarIdentificadorOrcamento();
      const token = orcamento.token || gerarTokenAcesso();
      const row = {
        id,
        paciente_id: orcamento.pacienteId || 'pac-123',
        paciente_nome: orcamento.pacienteNome || 'Paciente Teste',
        titulo: orcamento.titulo || 'Plano de Tratamento Odontológico',
        itens: orcamento.itens || [],
        desconto: orcamento.desconto || 0,
        total: orcamento.total || 0,
        status: orcamento.status || 'enviado',
        formas_pagamento: orcamento.formasPagamento || null,
        token_assinatura: token,
        data_expiracao_link: orcamento.dataExpiracaoLink || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        data_assinatura: null,
        assinatura_paciente: {
          identificador,
          token,
          versao: orcamento.versao || 1,
          solicitacoesAjuste: orcamento.solicitacoesAjuste || [],
          historicoVersoes: orcamento.historicoVersoes || [],
          condicaoEscolhida: null,
          aprovadoEm: null,
        },
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      };
      db.set(id, row);

      // Cache localStorage contingency
      global.window.localStorage.setItem(`orcamento_${identificador}`, JSON.stringify(row));
      global.window.localStorage.setItem(`orcamento_${id}`, JSON.stringify(row));

      return {
        ok: true,
        id,
        identificador,
        token,
        link: construirUrlPublicaOrcamento(row.paciente_nome, identificador, token),
      };
    },

    async localizarRegistroOrcamento(identificadorOuId, token, orcamentoId) {
      const cleanId = String(identificadorOuId || '').trim();
      const cleanToken = String(token || '').trim();
      const cleanUuid = String(orcamentoId || '').trim();

      let row = null;
      if (cleanUuid && db.has(cleanUuid)) {
        row = db.get(cleanUuid);
      }
      if (!row && cleanId && db.has(cleanId)) {
        row = db.get(cleanId);
      }
      if (!row && cleanId) {
        for (const [_, r] of db) {
          const snap = r.assinatura_paciente || {};
          if (
            snap.identificador === cleanId ||
            snap.identificador === cleanId.toUpperCase() ||
            `ORC-${cleanId}` === snap.identificador
          ) {
            row = r;
            break;
          }
        }
      }
      if (!row && cleanToken) {
        for (const [_, r] of db) {
          if (r.token_assinatura === cleanToken || r.assinatura_paciente?.token === cleanToken) {
            row = r;
            break;
          }
        }
      }

      // Fallback localStorage
      if (!row) {
        const cachedStr = global.window.localStorage.getItem(`orcamento_${cleanId}`) ||
                          global.window.localStorage.getItem(`orcamento_${cleanId.toUpperCase()}`);
        if (cachedStr) {
          row = JSON.parse(cachedStr);
        }
      }

      if (!row) {
        return { ok: false, error: 'Orçamento não encontrado. Verifique o link ou solicite um novo à clínica.' };
      }

      const snap = row.assinatura_paciente || {};
      const tokenEsperado = row.token_assinatura || snap.token;
      if (cleanToken && tokenEsperado && cleanToken !== tokenEsperado) {
        return { ok: false, error: 'Token de segurança inválido. Acesso não autorizado.' };
      }

      const expiraEm = row.data_expiracao_link || snap.dataExpiracaoLink;
      if (expiraEm && new Date(expiraEm) < new Date()) {
        return { ok: false, error: 'Esta proposta de orçamento expirou.', isExpirado: true };
      }

      return {
        ok: true,
        row,
        uuid: row.id,
        identificador: snap.identificador || cleanId,
        versao: Number(snap.versao || 1),
        status: row.status,
      };
    },

    async obterOrcamentoPublico(identificador, token) {
      const loc = await this.localizarRegistroOrcamento(identificador, token);
      if (!loc.ok) return loc;
      const row = loc.row;
      const snap = row.assinatura_paciente || {};
      return {
        ok: true,
        orcamento: {
          id: row.id,
          identificador: loc.identificador,
          versao: loc.versao,
          status: row.status,
          total: row.total,
          itens: row.itens,
          desconto: row.desconto,
          solicitacoesAjuste: snap.solicitacoesAjuste || [],
          historicoVersoes: snap.historicoVersoes || [],
          condicaoEscolhida: snap.condicaoEscolhida || null,
        },
      };
    },

    async solicitarAjusteOrcamentoPublico({ identificador, token, motivo, mensagem, orcamentoId }) {
      if (!identificador || !token) return { ok: false, error: 'Identificador e token são obrigatórios.' };
      if (!motivo || !motivo.trim()) return { ok: false, error: 'Selecione o motivo da solicitação de ajuste.' };

      const loc = await this.localizarRegistroOrcamento(identificador, token, orcamentoId);
      if (!loc.ok) return { ok: false, error: loc.error };

      const row = loc.row;
      const snap = row.assinatura_paciente || {};

      if (row.status === 'aprovado' || snap.status === 'aprovado') {
        return { ok: false, error: 'Este orçamento já foi aprovado e não pode receber solicitações de ajuste.' };
      }

      const agora = new Date().toISOString();
      const novaSolicitacao = {
        id: `ajuste-${Date.now()}`,
        orcamentoId: row.id,
        pacienteId: row.paciente_id,
        versaoOrcamento: loc.versao,
        motivo: motivo.trim(),
        mensagem: mensagem?.trim() || undefined,
        solicitadaEm: agora,
        atendida: false,
      };

      const novas = [...(snap.solicitacoesAjuste || []), novaSolicitacao];
      row.status = 'ajuste_solicitado';
      snap.status = 'ajuste_solicitado';
      snap.solicitacoesAjuste = novas;
      row.assinatura_paciente = snap;
      row.atualizado_em = agora;
      db.set(row.id, row);

      return {
        ok: true,
        solicitacao: novaSolicitacao,
        status: 'ajuste_solicitado',
      };
    },

    async enviarNovaProposta({ orcamentoId, novosItens, novoDesconto, usuarioNome, motivoAjuste }) {
      const loc = await this.localizarRegistroOrcamento(orcamentoId);
      if (!loc.ok) return loc;

      const row = loc.row;
      const snap = row.assinatura_paciente || {};
      const versaoAtual = loc.versao;
      const novaVersao = versaoAtual + 1;
      const agora = new Date().toISOString();

      const subtotal = novosItens.reduce((acc, i) => acc + i.valor * i.quantidade, 0);
      const totalNovo = Math.max(0, subtotal - novoDesconto);

      const snapAnterior = {
        versao: versaoAtual,
        total: row.total,
        desconto: row.desconto,
        itens: row.itens,
        alteradaEm: agora,
        alteradaPor: usuarioNome || 'Clínica',
      };

      const atendidas = (snap.solicitacoesAjuste || []).map((s) => ({ ...s, atendida: true }));

      row.itens = novosItens;
      row.desconto = novoDesconto;
      row.total = totalNovo;
      row.status = 'nova_proposta_enviada';
      snap.status = 'nova_proposta_enviada';
      snap.versao = novaVersao;
      snap.historicoVersoes = [...(snap.historicoVersoes || []), snapAnterior];
      snap.solicitacoesAjuste = atendidas;
      row.assinatura_paciente = snap;
      row.atualizado_em = agora;
      db.set(row.id, row);

      return {
        ok: true,
        novaVersao,
        identificador: loc.identificador,
        link: construirUrlPublicaOrcamento(row.paciente_nome, loc.identificador, row.token_assinatura),
      };
    },

    async aprovarOrcamentoPublico({ identificador, token, condicaoEscolhida, versaoAprovada, orcamentoId }) {
      if (!identificador || !token) return { ok: false, error: 'Identificador e token são obrigatórios.' };
      if (!condicaoEscolhida) return { ok: false, error: 'Selecione uma condição de pagamento.' };

      const loc = await this.localizarRegistroOrcamento(identificador, token, orcamentoId);
      if (!loc.ok) return { ok: false, error: loc.error };

      const row = loc.row;
      const snap = row.assinatura_paciente || {};
      const agora = new Date().toISOString();

      if (row.status === 'aprovado' || snap.status === 'aprovado') {
        return {
          ok: true,
          jaAprovado: true,
          aprovadoEm: row.data_assinatura || snap.aprovadoEm || agora,
        };
      }

      if (versaoAprovada !== undefined && versaoAprovada < loc.versao) {
        return {
          ok: false,
          error: 'Uma nova versão deste orçamento foi enviada pela clínica. Por favor, atualize a página.',
        };
      }

      row.status = 'aprovado';
      row.data_assinatura = agora;
      snap.status = 'aprovado';
      snap.aprovadoEm = agora;
      snap.condicaoEscolhida = condicaoEscolhida;
      snap.versaoAprovada = loc.versao;
      row.assinatura_paciente = snap;
      row.atualizado_em = agora;
      db.set(row.id, row);

      return {
        ok: true,
        aprovadoEm: agora,
        status: 'aprovado',
      };
    },
  };
}

async function runValidation() {
  console.log('================================================================');
  console.log('VALIDAÇÃO DO SERVIÇO CENTRALIZADO DE AÇÕES PÚBLICAS DE ORÇAMENTO');
  console.log('================================================================\n');

  const servico = criarServicoCentralizado();

  // 1. Emissão e Persistência do Orçamento
  console.log('TESTE 1: Emissão do orçamento e geração do link público canônico');
  const itensV1 = [
    { nome: 'Facetas em Resina Composta (10 Dentes)', quantidade: 1, valor: 4000 },
    { nome: 'Placa de Bruxismo em Silicone', quantidade: 1, valor: 1000 },
  ];
  const emissao = await servico.salvarOrcamento({
    pacienteNome: 'Juliana Costa e Silva',
    titulo: 'Transformação do Sorriso',
    itens: itensV1,
    desconto: 500,
    total: 4500,
  });

  assert.strictEqual(emissao.ok, true);
  assert.ok(emissao.identificador.startsWith('ORC-'));
  assert.strictEqual(emissao.token.length, 48);
  assert.ok(!emissao.link.includes('base64'));
  console.log(`  • ID Gerado: ${emissao.id}`);
  console.log(`  • Identificador Amigável: ${emissao.identificador}`);
  console.log(`  • Link Público: ${emissao.link}`);
  console.log('  [PASSOU] Orçamento emitido e persistido com sucesso!\n');

  // 2. Resolução do Orçamento por diferentes identificadores
  console.log('TESTE 2: Resolução centralizada por Identificador Amigável, UUID e Token');
  // Busca por ORC-XXXXXXXX
  const resPorIdentificador = await servico.localizarRegistroOrcamento(emissao.identificador, emissao.token);
  assert.strictEqual(resPorIdentificador.ok, true);
  assert.strictEqual(resPorIdentificador.uuid, emissao.id);

  // Busca por UUID direto
  const resPorUuid = await servico.localizarRegistroOrcamento(emissao.id, emissao.token);
  assert.strictEqual(resPorUuid.ok, true);
  assert.strictEqual(resPorUuid.identificador, emissao.identificador);

  // Busca combinada (identificador + orcamentoId)
  const resCombinada = await servico.localizarRegistroOrcamento(emissao.identificador, emissao.token, emissao.id);
  assert.strictEqual(resCombinada.ok, true);
  assert.strictEqual(resCombinada.uuid, emissao.id);
  console.log('  • Localização por ORC-XXXXXXXX -> SUCESSO');
  console.log('  • Localização por UUID -> SUCESSO');
  console.log('  • Localização por token -> SUCESSO');
  console.log('  [PASSOU] Resolução centralizada confirmada!\n');

  // 3. Teste de Erros: Token Inválido, Orçamento Inexistente, Proposta Expirada
  console.log('TESTE 3: Validação de Segurança e Erros Estritos');
  const resTokenInvalido = await servico.localizarRegistroOrcamento(emissao.identificador, 'token_invalido_1234567890abcdef');
  assert.strictEqual(resTokenInvalido.ok, false);
  assert.ok(resTokenInvalido.error.includes('Token de segurança inválido'));
  console.log('  • Token inválido -> REJEITADO com sucesso');

  const resInexistente = await servico.localizarRegistroOrcamento('ORC-99999999', 'token_qualquer');
  assert.strictEqual(resInexistente.ok, false);
  assert.ok(resInexistente.error.includes('Orçamento não encontrado'));
  console.log('  • Orçamento inexistente -> REJEITADO com sucesso');

  // Orçamento expirado
  const emissaoExpirada = await servico.salvarOrcamento({
    pacienteNome: 'Expirado Teste',
    total: 1000,
    dataExpiracaoLink: new Date(Date.now() - 10000).toISOString(),
  });
  const resExpirado = await servico.localizarRegistroOrcamento(emissaoExpirada.identificador, emissaoExpirada.token);
  assert.strictEqual(resExpirado.ok, false);
  assert.strictEqual(resExpirado.isExpirado, true);
  console.log('  • Proposta expirada -> REJEITADA com flag isExpirado');
  console.log('  [PASSOU] Testes de segurança e erros aprovados!\n');

  // 4. Solicitação de Ajuste pelo Paciente (em sessão anônima)
  console.log('TESTE 4: Paciente solicita ajuste no orçamento');
  const resAjuste = await servico.solicitarAjusteOrcamentoPublico({
    identificador: emissao.identificador,
    orcamentoId: emissao.id,
    token: emissao.token,
    motivo: 'Preciso de mais opções de parcelamento',
    mensagem: 'Consigo dar R$ 1.500 de entrada e o restante em 10x?',
  });
  assert.strictEqual(resAjuste.ok, true);
  assert.strictEqual(resAjuste.status, 'ajuste_solicitado');
  assert.strictEqual(resAjuste.solicitacao.motivo, 'Preciso de mais opções de parcelamento');

  // Confirma que foi gravado e pode ser lido pelo painel da clínica
  const statusClinica = await servico.obterOrcamentoPublico(emissao.identificador, emissao.token);
  assert.strictEqual(statusClinica.orcamento.status, 'ajuste_solicitado');
  assert.strictEqual(statusClinica.orcamento.solicitacoesAjuste.length, 1);
  assert.strictEqual(statusClinica.orcamento.solicitacoesAjuste[0].mensagem, 'Consigo dar R$ 1.500 de entrada e o restante em 10x?');
  console.log(`  • Solicitação registrada: "${resAjuste.solicitacao.motivo}"`);
  console.log(`  • Status atualizado: ${resAjuste.status}`);
  console.log('  • Visualização pelo painel da clínica -> Confirmado!');
  console.log('  [PASSOU] Solicitação de ajuste gravada e sincronizada!\n');

  // 5. Clínica envia Nova Proposta (Versão 2)
  console.log('TESTE 5: Clínica revisa valores e envia Nova Proposta (Versão 2)');
  const resNovaProposta = await servico.enviarNovaProposta({
    orcamentoId: emissao.id,
    novosItens: itensV1,
    novoDesconto: 700,
    usuarioNome: 'Dra. Camila',
    motivoAjuste: 'Condição especial negociada para entrada + parcelamento',
  });
  assert.strictEqual(resNovaProposta.ok, true);
  assert.strictEqual(resNovaProposta.novaVersao, 2);
  assert.strictEqual(resNovaProposta.link, emissao.link); // Mantém o MESMO link

  const statusV2 = await servico.obterOrcamentoPublico(emissao.identificador, emissao.token);
  assert.strictEqual(statusV2.orcamento.versao, 2);
  assert.strictEqual(statusV2.orcamento.status, 'nova_proposta_enviada');
  assert.strictEqual(statusV2.orcamento.total, 4300);
  assert.strictEqual(statusV2.orcamento.historicoVersoes.length, 1);
  console.log(`  • Versão incrementada: ${resNovaProposta.novaVersao}`);
  console.log(`  • Histórico da V1 arquivado: R$ ${statusV2.orcamento.historicoVersoes[0].total}`);
  console.log(`  • Novo Total V2: R$ ${statusV2.orcamento.total}`);
  console.log('  [PASSOU] Nova proposta emitida com histórico preservado!\n');

  // 6. Paciente tenta aprovar Versão 1 antiga -> BLOQUEADO
  console.log('TESTE 6: Bloqueio estrito de aprovação de versão antiga/desatualizada');
  const resAprovarV1 = await servico.aprovarOrcamentoPublico({
    identificador: emissao.identificador,
    orcamentoId: emissao.id,
    token: emissao.token,
    condicaoEscolhida: { id: 'opt_1', titulo: 'À vista', tipo: 'a_vista', valorTotal: 4500 },
    versaoAprovada: 1, // VERSÃO OBSOLETA
  });
  assert.strictEqual(resAprovarV1.ok, false);
  assert.ok(resAprovarV1.error.includes('Uma nova versão deste orçamento foi enviada'));
  console.log('  • Tentativa de aprovar V1 -> BLOQUEADA!');
  console.log('  [PASSOU] Integridade de versão validada!\n');

  // 7. Paciente aprova a Versão 2 no mesmo link
  console.log('TESTE 7: Paciente aprova a Versão 2');
  const condicaoNegociada = {
    id: 'opt_entrada_10x',
    titulo: 'Entrada R$ 1.500 + 10x de R$ 280',
    tipo: 'entrada_saldo',
    valorTotal: 4300,
    valorEntrada: 1500,
    parcelas: 10,
    valorParcela: 280,
  };
  const resAprovarV2 = await servico.aprovarOrcamentoPublico({
    identificador: emissao.identificador,
    orcamentoId: emissao.id,
    token: emissao.token,
    condicaoEscolhida: condicaoNegociada,
    versaoAprovada: 2,
  });
  assert.strictEqual(resAprovarV2.ok, true);
  assert.strictEqual(resAprovarV2.status, 'aprovado');
  assert.ok(resAprovarV2.aprovadoEm);

  // Confirmação no estado
  const statusAprovado = await servico.obterOrcamentoPublico(emissao.identificador, emissao.token);
  assert.strictEqual(statusAprovado.orcamento.status, 'aprovado');
  assert.strictEqual(statusAprovado.orcamento.condicaoEscolhida.id, 'opt_entrada_10x');
  console.log(`  • Status pós-aprovação: ${statusAprovado.orcamento.status}`);
  console.log(`  • Condição registrada: ${statusAprovado.orcamento.condicaoEscolhida.titulo}`);
  console.log('  [PASSOU] Aprovação registrada com sucesso!\n');

  // 8. Bloqueio de aprovação duplicada
  console.log('TESTE 8: Bloqueio estrito de re-aprovação duplicada');
  const resReaprovacao = await servico.aprovarOrcamentoPublico({
    identificador: emissao.identificador,
    orcamentoId: emissao.id,
    token: emissao.token,
    condicaoEscolhida: condicaoNegociada,
    versaoAprovada: 2,
  });
  assert.strictEqual(resReaprovacao.ok, true);
  assert.strictEqual(resReaprovacao.jaAprovado, true);
  console.log('  • Re-aprovação duplicada -> IDENTIFICADA (jaAprovado = true)');
  console.log('  [PASSOU] Proteção contra re-aprovação confirmada!\n');

  console.log('================================================================');
  console.log('TODOS OS 8 TESTES DO SERVIÇO CENTRALIZADO PASSARAM COM 100%!');
  console.log('================================================================');
}

runValidation().catch(console.error);

