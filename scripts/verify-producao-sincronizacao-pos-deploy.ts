/**
 * Verificação Pós-Deploy da Publicação de Sincronização Orçamentos-Financeiro-Timeline
 * Ambiente: Produção (skonxcdojbkbfnfemayz)
 * Modo: ESTRITAMENTE SOMENTE LEITURA
 */

import { createClient } from '@supabase/supabase-js';

const PROD_URL = 'https://skonxcdojbkbfnfemayz.supabase.co';
const PROD_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrb254Y2RvamJrYmZuZmVtYXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg1Mjg2ODUsImV4cCI6MjA1ND insect...'; // anon key
// We will use supabase remote CLI for queries to ensure complete read-only integrity

async function main() {
  console.log('='.repeat(80));
  console.log('VERIFICAÇÃO PÓS-DEPLOY: SINCRONIZAÇÃO ORÇAMENTOS, FINANCEIRO E TIMELINE');
  console.log('Ambiente: Produção (skonxcdojbkbfnfemayz)');
  console.log('Bundle ativo esperado: assets/index-AhUDX42s.js');
  console.log('='.repeat(80));

  // 1. Validar bundle na Cloudflare Pages
  const cfResp = await fetch('https://app.lentesemresinamaceio.com.br/');
  const html = await cfResp.text();
  const match = html.match(/assets\/index-[a-zA-Z0-9_\-]+\.js/);
  const bundle = match ? match[0] : 'não encontrado';
  console.log(`\n1. Bundle Cloudflare Pages ativo: ${bundle}`);
  if (bundle === 'assets/index-AhUDX42s.js') {
    console.log('  ✓ [PASS] Novo bundle de sincronização ativo em produção');
  } else {
    console.error(`  ✗ [FAIL] Bundle inesperado: ${bundle}`);
    process.exit(1);
  }

  // 2. Validar HTTP 200 no bundle JS
  const bundleResp = await fetch(`https://app.lentesemresinamaceio.com.br/${bundle}`);
  console.log(`2. Status HTTP do bundle: ${bundleResp.status}`);
  if (bundleResp.status === 200) {
    console.log('  ✓ [PASS] Bundle acessível com sucesso');
  } else {
    console.error('  ✗ [FAIL] Erro ao carregar bundle');
    process.exit(1);
  }

  console.log('\n='.repeat(80));
  console.log('VALIDAÇÃO CONCLUÍDA COM SUCESSO');
  console.log('='.repeat(80));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
