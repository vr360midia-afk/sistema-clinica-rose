const { loadEnv } = require('vite');

/**
 * SCRIPT DE VERIFICAÇÃO PRÉ-BUILD DE SEGURANÇA
 * Executado antes de qualquer compilação de produção (npm run build).
 * 
 * Regras Obrigatórias:
 * 1. O build de produção DEVE conter explicitamente o projeto Supabase 'skonxcdojbkbfnfemayz'.
 * 2. Bloqueia imediatamente o build caso o ambiente esteja apontando para homologação ou vazio.
 */

const mode = process.env.NODE_ENV || 'production';
const env = loadEnv('production', process.cwd(), '');

const targetUrl = env.VITE_SUPABASE_URL || '';
const targetKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '';

const PROD_REF = 'skonxcdojbkbfnfemayz';

console.log('\n================================================================================');
console.log('🔒 VERIFICAÇÃO PRÉ-BUILD DE SEGURANÇA (CLOUDFLARE PAGES / PRODUÇÃO)');
console.log('================================================================================');

if (!targetUrl) {
  console.error('\n❌ [FALHA CRÍTICA PRÉ-BUILD] VITE_SUPABASE_URL não configurada no ambiente de produção!');
  console.error('O build foi cancelado preventivamente para evitar a geração de um bundle com falha.\n');
  process.exit(1);
}

if (!targetKey) {
  console.error('\n❌ [FALHA CRÍTICA PRÉ-BUILD] Chave pública do Supabase não configurada no ambiente de produção!');
  console.error('O build foi cancelado preventivamente.\n');
  process.exit(1);
}

if (!targetUrl.includes(PROD_REF)) {
  console.error(`\n❌ [FALHA CRÍTICA DE DESTINO] O build de produção exige o projeto '${PROD_REF}'!`);
  console.error(`URL detectada: ${targetUrl}`);
  console.error('Operação abortada para impedir publicação acidental de banco de teste/homologação em produção.\n');
  process.exit(1);
}

console.log(`✓ Projeto Supabase Confirmado: ${PROD_REF} (Produção Oficial)`);
console.log(`✓ Endpoint Validado:          ${targetUrl}`);
console.log(`✓ Chave Pública:               ${targetKey.slice(0, 16)}...`);
console.log('✓ Destino de Produção:         Cloudflare Pages (app.lentesemresinamaceio.com.br)');
console.log('================================================================================\n');

process.exit(0);

