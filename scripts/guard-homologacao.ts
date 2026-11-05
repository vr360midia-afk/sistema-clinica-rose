import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Trava de Segurança Crítica contra Execução de Testes em Produção.
 * Impede que scripts de teste criem dados, orçamentos, contratos ou transações na base de produção.
 */

export const PROD_PROJECT_REF = 'skonxcdojbkbfnfemayz';
export const HOMOLOG_PROJECT_REF = 'fsroaymkuopapwlnknhl';
export const HOMOLOG_URL = 'https://fsroaymkuopapwlnknhl.supabase.co';
export const HOMOLOG_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzcm9heW1rdW9wYXB3bG5rbmhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTUwMDQ3MywiZXhwIjoyMTA3MDc2NDczfQ.p74EmozEkxHV8-etstzxKeeOXpWKdP1ZSlpjwkuwc6I';
export const HOMOLOG_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzcm9heW1rdW9wYXB3bG5rbmhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MDA0NzMsImV4cCI6MjEwNzA3NjQ3M30.QV06zSi8oKTBz2s4x6oyHCWf_i0o8Gdu-obiE7SBOWA';

if (typeof process !== 'undefined') {
  process.env.VITE_SUPABASE_URL = HOMOLOG_URL;
  process.env.HOMOLOG_URL = HOMOLOG_URL;
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = HOMOLOG_ANON_KEY;
  process.env.HOMOLOG_SUPABASE_ANON_KEY = HOMOLOG_ANON_KEY;
}

export function validarAmbienteHomologacao(url: string, contexto: string = 'Teste Automatizado'): void {
  if (!url) {
    throw new Error(`[SEGURANÇA BLOQUEADA] ${contexto}: Nenhuma URL do Supabase fornecida.`);
  }

  const urlLower = url.toLowerCase();

  // Verifica se a URL aponta para a produção
  if (urlLower.includes(PROD_PROJECT_REF) || urlLower.includes('sistema-clinica.supabase.co')) {
    const msg = `
=============================================================================
⛔ BLOQUEIO DE SEGURANÇA CRÍTICA ATIVADO ⛔
Contexto: ${contexto}
Tentativa de conexão ao SUPABASE DE PRODUÇÃO (${PROD_PROJECT_REF}) em rotina de teste!
Nenhum script de teste automatizado possui permissão para criar, alterar ou
excluir registros em produção.
Use exclusivamente o ambiente de homologação (${HOMOLOG_PROJECT_REF}).
=============================================================================
`;
    console.error(msg);
    throw new Error(`[SEGURANÇA] Execução abortada: ${contexto} direcionado à Produção (${PROD_PROJECT_REF})!`);
  }

  // Validação explícita de ambiente seguro
  if (!urlLower.includes(HOMOLOG_PROJECT_REF) && !urlLower.includes('localhost') && !urlLower.includes('127.0.0.1')) {
    console.warn(`[AVISO] Conectando a ambiente Supabase customizado: ${url}`);
  }
}

/**
 * Cria cliente Supabase de Teste garantindo 100% que não conecta à produção.
 */
export function criarClienteHomologacaoSeguro(customUrl?: string, customKey?: string): SupabaseClient {
  const url = customUrl || HOMOLOG_URL;
  validarAmbienteHomologacao(url, 'criarClienteHomologacaoSeguro');
  const key = customKey || HOMOLOG_SERVICE_KEY;
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
