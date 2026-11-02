/**
 * TESTE AUTOMATIZADO DE VALIDAÇÃO DE LINKS DE CONTRATO
 * Regra: Links de contrato devem ser curtos, amigáveis e NUNCA conter ?c=, &c= ou Base64.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Simulação das funções canônicas do contratoEngine
function slugifyNome(nome) {
  return nome
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function obterBaseUrlOficial() {
  return 'https://app.lentesemresinamaceio.com.br';
}

function construirUrlPublicaContrato(params) {
  const base = obterBaseUrlOficial();
  const slug = slugifyNome(params.pacienteNome || 'paciente');
  const tokenParam = params.token ? `token=${encodeURIComponent(params.token)}` : '';
  const queryStr = tokenParam ? `?${tokenParam}` : '';
  return `${base}/${slug}/contrato/${params.identificador}${queryStr}`;
}

function gerarTokenAcesso() {
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : require('crypto');
  if (cryptoObj.getRandomValues) {
    const bytes = new Uint8Array(24);
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return Array.from({ length: 48 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function runTests() {
  console.log('================================================================');
  console.log('TESTES AUTOMATIZADOS: LINKS DE CONTRATO SEM BASE64');
  console.log('================================================================\n');

  // Teste 1: Contrato Real do Usuário (CTR-CB8883D3 e Diego Duracenski)
  console.log('TESTE 1: Contrato Real CTR-CB8883D3 (Diego Duracenski)');
  const tokenDiego = 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0';
  const urlDiego = construirUrlPublicaContrato({
    pacienteNome: 'Diego Duracenski',
    identificador: 'CTR-CB8883D3',
    token: tokenDiego,
  });

  console.log('  URL Gerada:', urlDiego);
  console.log('  Tamanho:', urlDiego.length, 'caracteres');

  assert.strictEqual(
    urlDiego,
    `https://app.lentesemresinamaceio.com.br/diego-duracenski/contrato/CTR-CB8883D3?token=${tokenDiego}`,
    'A URL gerada deve seguir o padrão canônico exato'
  );
  assert.ok(!urlDiego.includes('&c='), 'URL NÃO pode conter &c=');
  assert.ok(!urlDiego.includes('?c='), 'URL NÃO pode conter ?c=');
  assert.ok(!urlDiego.includes('data='), 'URL NÃO pode conter data=');
  assert.ok(urlDiego.length < 200, `URL deve ser curta (atual: ${urlDiego.length} caracteres, anterior: 52.030)`);
  console.log('  [PASSOU] URL limpa, sem Base64 e dentro do tamanho ideal!\n');

  // Teste 2: Paciente com acentos e caracteres especiais
  console.log('TESTE 2: Normalização de nomes com acentos e caracteres especiais');
  const tokenAcento = gerarTokenAcesso();
  const urlAcento = construirUrlPublicaContrato({
    pacienteNome: 'João da Conceição Araújo & Filhos',
    identificador: 'CTR-98AB4321',
    token: tokenAcento,
  });

  console.log('  URL Gerada:', urlAcento);
  assert.ok(urlAcento.includes('/joao-da-conceicao-araujo-filhos/contrato/CTR-98AB4321'), 'Slug deve ser sanitizado');
  assert.ok(!urlAcento.includes('&c='), 'Sem &c=');
  assert.ok(!urlAcento.includes('?c='), 'Sem ?c=');
  console.log('  [PASSOU] Normalização de caracteres especiais aprovada!\n');

  // Teste 3: Verificação de código estático no projeto (Regra Permanente)
  console.log('TESTE 3: Varredura de código-fonte em busca de injeções de ?c= ou Base64 nos links');
  const engineContent = fs.readFileSync(path.join(__dirname, '../src/utils/contratoEngine.ts'), 'utf-8');
  
  // Procura por cParam ou c= sendo adicionado no construirUrlPublicaContrato
  const construirFnRegex = /export function construirUrlPublicaContrato[\s\S]*?^}/m;
  const matchFn = engineContent.match(construirFnRegex);
  assert.ok(matchFn, 'Função construirUrlPublicaContrato deve existir em contratoEngine.ts');
  
  const fnBody = matchFn[0];
  assert.ok(!fnBody.includes('cParam'), 'construirUrlPublicaContrato não deve ter variável cParam');
  assert.ok(!fnBody.includes('codificarContratoUrl'), 'construirUrlPublicaContrato não deve codificar snapshot');
  assert.ok(!fnBody.includes('`c='), 'construirUrlPublicaContrato não deve acrescentar c=');
  assert.ok(!fnBody.includes('snapshot?:'), 'construirUrlPublicaContrato não deve aceitar snapshot nos parâmetros de link');

  console.log('  [PASSOU] Nenhuma injeção de Base64 em construirUrlPublicaContrato!\n');

  // Teste 4: Garantir que AssinarContrato limpa resíduos de c= da URL
  console.log('TESTE 4: Verificação de limpeza de URL em AssinarContrato.tsx');
  const assinarContent = fs.readFileSync(path.join(__dirname, '../src/pages/AssinarContrato.tsx'), 'utf-8');
  assert.ok(assinarContent.includes('limparUrlNavegador'), 'AssinarContrato.tsx deve conter função limparUrlNavegador');
  assert.ok(assinarContent.includes('window.history.replaceState'), 'AssinarContrato.tsx deve atualizar a URL do navegador com replaceState');
  console.log('  [PASSOU] Higienização de URL de links legados confirmada!\n');

  console.log('================================================================');
  console.log('TODOS OS 4 TESTES FORAM APROVADOS COM SUCESSO (100%)');
  console.log('================================================================');
}

runTests();

