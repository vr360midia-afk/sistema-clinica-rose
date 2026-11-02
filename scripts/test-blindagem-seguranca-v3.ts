/**
 * SUÍTE DE TESTES DE SEGURANÇA E BLINDAGEM DA MIGRATION V3.0
 * Execução em PostgreSQL 18.6 Isolado (PGlite WASM)
 * 
 * Validação rigorosa dos 4 novos impedimentos + 8 pontos de blindagem:
 * 1. Proibição de exclusão (DELETE) de contratos formalizados
 * 2. Exigência estrita de identidade da profissional titular para conceder assinatura (admin ou outro dentista não autorizam em nome dela)
 * 3. Remoção de acesso genérico e resolução segura de titularidade de contratos legados sem acesso cross-clínica
 * 4. Imutabilidade total de cláusulas, termos, partes, valores e parcelas com permissão estrita de pdf_path
 * 5. Fila de PDFs e histórico com leitura restrita por clínica comprovada e sem escrita direta para authenticated
 */

import fs from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const OK = '\x1b[32m✓ PASS\x1b[0m';
const FAIL = '\x1b[31m✗ FAIL\x1b[0m';
const STEP = '\x1b[35m▶\x1b[0m';

let totalTests = 0;
let passedTests = 0;

function assert(cond: boolean, desc: string) {
  totalTests++;
  if (cond) {
    passedTests++;
    console.log(`  ${OK} - ${desc}`);
  } else {
    console.error(`  ${FAIL} - ${desc}`);
    process.exit(1);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('TESTES DE SEGURANÇA REFORÇADOS: MIGRATION V3.0');
  console.log('================================================================\n');

  const db = new PGlite({ extensions: { pgcrypto } });

  // 1. Setup inicial de schemas do Supabase
  console.log(`${STEP} 1. Preparando base Supabase mock e tabelas do sistema`);
  await db.exec(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
    END $$;

    CREATE SCHEMA IF NOT EXISTS auth;

    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
      SELECT nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid;
    $$ LANGUAGE sql STABLE;

    CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
      SELECT coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', 'authenticated');
    $$ LANGUAGE sql STABLE;

    CREATE TABLE IF NOT EXISTS auth.users (
      id uuid PRIMARY KEY,
      email text,
      raw_app_meta_data jsonb DEFAULT '{}'::jsonb
    );

    CREATE TABLE IF NOT EXISTS public.user_roles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id),
      role text NOT NULL,
      clinica_id uuid
    );

    CREATE TABLE IF NOT EXISTS public.pacientes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nome text NOT NULL,
      cpf text,
      clinica_id uuid
    );

    CREATE TABLE IF NOT EXISTS public.documentos_clinicos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      paciente_id uuid,
      tipo text NOT NULL,
      titulo text,
      conteudo text,
      itens jsonb,
      valor_total numeric,
      identificador text,
      hash_integridade text,
      pdf_path text,
      assinado_em timestamptz,
      assinatura_data text,
      clinica_id uuid,
      user_id uuid,
      criado_em timestamptz DEFAULT now(),
      atualizado_em timestamptz DEFAULT now()
    );

    GRANT USAGE ON SCHEMA public TO authenticated;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT SELECT ON public.user_roles TO authenticated;
    GRANT SELECT ON public.documentos_clinicos TO authenticated;
  `);
  assert(true, 'Estrutura base criada com sucesso');

  // Identificadores de Clínicas e Usuários
  const ID_CLINICA_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; // Clínica Dra. Rosângela
  const ID_DRA_ROSANGELA = ID_CLINICA_A;                       // Dra. Rosângela (proprietária e titular técnica)
  const ID_OUTRO_ADMIN_CLINICA_A = '12121212-1212-1212-1212-121212121212'; // Outro administrador na mesma clínica A
  const ID_OUTRO_DENTISTA_CLINICA_A = '34343434-3434-3434-3434-343434343434'; // Outro dentista contratado na clínica A
  const ID_RECEPCAO_CLINICA_A = '56565656-5656-5656-5656-565656565656'; // Recepcionista da clínica A
  const ID_CLINICA_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'; // Clínica Externa B
  const ID_DR_OUTRO_CLINICA_B = ID_CLINICA_B;                  // Titular da Clínica B

  // Cadastro de usuários e perfis
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES
      ('${ID_DRA_ROSANGELA}', 'dra.rosangela@clinica.com'),
      ('${ID_OUTRO_ADMIN_CLINICA_A}', 'admin.gestor@clinica.com'),
      ('${ID_OUTRO_DENTISTA_CLINICA_A}', 'dentista.assistente@clinica.com'),
      ('${ID_RECEPCAO_CLINICA_A}', 'recepcao@clinica.com'),
      ('${ID_DR_OUTRO_CLINICA_B}', 'dr.outro@clinicab.com');

    INSERT INTO public.user_roles (user_id, role, clinica_id) VALUES
      ('${ID_DRA_ROSANGELA}', 'admin', '${ID_CLINICA_A}'),
      ('${ID_DRA_ROSANGELA}', 'dentista_titular', '${ID_CLINICA_A}'),
      ('${ID_OUTRO_ADMIN_CLINICA_A}', 'admin', '${ID_CLINICA_A}'),
      ('${ID_OUTRO_DENTISTA_CLINICA_A}', 'dentista', '${ID_CLINICA_A}'),
      ('${ID_RECEPCAO_CLINICA_A}', 'recepcao', '${ID_CLINICA_A}'),
      ('${ID_DR_OUTRO_CLINICA_B}', 'admin', '${ID_CLINICA_B}');
  `);

  // Pacientes das clínicas
  const resPacA = await db.query<any>(`
    INSERT INTO public.pacientes (nome, cpf, clinica_id) VALUES
      ('Paciente da Clínica A', '111.111.111-11', '${ID_CLINICA_A}')
    RETURNING id;
  `);
  const pacAId = resPacA.rows[0].id;

  const resPacB = await db.query<any>(`
    INSERT INTO public.pacientes (nome, cpf, clinica_id) VALUES
      ('Paciente da Clínica B', '222.222.222-22', '${ID_CLINICA_B}')
    RETURNING id;
  `);
  const pacBId = resPacB.rows[0].id;

  // Inserção de contratos legados com clinica_id nulo para testar resolução de titularidade
  await db.exec(`
    INSERT INTO public.documentos_clinicos (id, paciente_id, tipo, titulo, itens, identificador, clinica_id) VALUES
      ('11111111-1111-1111-1111-111111111111', '${pacAId}', 'contrato', 'Contrato Legado A1', '{"contratoId": "CTR-DUPLICADO"}'::jsonb, NULL, NULL),
      ('22222222-2222-2222-2222-222222222222', '${pacAId}', 'contrato', 'Contrato Legado A2', '{"contratoId": "CTR-DUPLICADO"}'::jsonb, NULL, NULL),
      ('33333333-3333-3333-3333-333333333333', '${pacAId}', 'contrato', 'Contrato Legado A Sem Id', '{}'::jsonb, NULL, NULL),
      ('44444444-4444-4444-4444-444444444444', '${pacBId}', 'contrato', 'Contrato da Clínica B', '{"contratoId": "CTR-CLINICA-B-ORIG"}'::jsonb, 'CTR-CLINICA-B-ORIG', '${ID_CLINICA_B}');
  `);

  // 2. Executa a migration real atualizada
  console.log(`\n${STEP} 2. Aplicando a Migration 20261102_blindagem_seguranca_v3.sql com as 4 Correções`);
  const migrationSql = fs.readFileSync(path.resolve('supabase/migrations/20261102_blindagem_seguranca_v3.sql'), 'utf-8');
  await db.exec(migrationSql);
  assert(true, 'Migration 20261102_blindagem_seguranca_v3.sql aplicada com sucesso');

  // 3. Validação do Ponto 3: Preservação de Contratos Históricos sem UPDATE automático de clinica_id
  console.log(`\n${STEP} 3. Validação da Preservação de Contratos Históricos (Sem UPDATE automático de clinica_id)`);
  const resDocs = await db.query<any>(`
    SELECT id, identificador, clinica_id FROM public.documentos_clinicos ORDER BY criado_em ASC;
  `);
  const c1 = resDocs.rows.find(r => r.id === '11111111-1111-1111-1111-111111111111');
  const c2 = resDocs.rows.find(r => r.id === '22222222-2222-2222-2222-222222222222');
  const c3 = resDocs.rows.find(r => r.id === '33333333-3333-3333-3333-333333333333');

  assert(c1.clinica_id === null, 'Contrato legado 1 PRESERVADO intacto sem UPDATE automático (clinica_id IS NULL)');
  assert(c2.clinica_id === null, 'Contrato legado 2 PRESERVADO intacto sem UPDATE automático (clinica_id IS NULL)');
  assert(c1.identificador === 'CTR-DUPLICADO', 'Primeiro contrato legado manteve identificador original');
  assert(c2.identificador === 'CTR-DUPLICADO-LEG2', 'Segundo contrato legado recebeu sufixo não-colidente -LEG2');
  assert(c3.identificador.startsWith('CTR-33333333'), 'Contrato sem identificador recebeu código canônico CTR-');

  // Inserção de contrato regular com clinica_id comprovada para testes de fluxo da Clínica A
  const resDocClinicaA = await db.query<any>(`
    INSERT INTO public.documentos_clinicos (id, paciente_id, tipo, titulo, itens, identificador, clinica_id)
    VALUES ('55555555-5555-5555-5555-555555555555', '${pacAId}', 'contrato', 'Contrato Regular Clínica A', '{"contratoId": "CTR-REGULAR-A"}'::jsonb, 'CTR-REGULAR-A', '${ID_CLINICA_A}')
    RETURNING id;
  `);
  const docRegularAId = resDocClinicaA.rows[0].id;

  // 4. Validação do Ponto 2: Exigência da Identidade da Profissional Titular
  console.log(`\n${STEP} 4. Testes Estritos em conceder_autorizacao_assinatura (Identidade da Titular)`);

  // 4.1 Administrador de outra pessoa tentando autorizar em nome da Dra. Rosângela
  await db.exec(`SET request.jwt.claims = '{"sub": "${ID_OUTRO_ADMIN_CLINICA_A}", "role": "authenticated"}';`);
  const resAdminOutro = await db.query<any>(`
    SELECT public.conceder_autorizacao_assinatura(
      'Dra. Rosângela Santos Pereira',
      '06267-AL',
      'data:image/png;base64,assinatura_falsa_por_admin',
      'contrato_odontologico',
      '["geral"]'::jsonb,
      '${ID_CLINICA_A}',
      true
    ) as result;
  `);
  assert(resAdminOutro.rows[0].result.ok === false, 'Outro administrador NÃO tem permissão para assinar/autorizar em nome da Dra. Rosângela');
  assert(resAdminOutro.rows[0].result.code === 'FORBIDDEN', 'Retornou código FORBIDDEN para outro administrador');

  // 4.2 Outro dentista da mesma clínica tentando autorizar em nome da Dra. Rosângela
  await db.exec(`SET request.jwt.claims = '{"sub": "${ID_OUTRO_DENTISTA_CLINICA_A}", "role": "authenticated"}';`);
  const resDentistaOutro = await db.query<any>(`
    SELECT public.conceder_autorizacao_assinatura(
      'Dra. Rosângela Santos Pereira',
      '06267-AL',
      'data:image/png;base64,assinatura_falsa_por_dentista',
      'contrato_odontologico',
      '["geral"]'::jsonb,
      '${ID_CLINICA_A}',
      true
    ) as result;
  `);
  assert(resDentistaOutro.rows[0].result.ok === false, 'Outro dentista NÃO tem permissão para assinar/autorizar em nome da Dra. Rosângela');
  assert(resDentistaOutro.rows[0].result.code === 'FORBIDDEN', 'Retornou código FORBIDDEN para outro dentista');

  // 4.2.b Usuário com perfil 'recepcao' tentando autorizar em nome da Dra. Rosângela
  await db.exec(`SET request.jwt.claims = '{"sub": "${ID_RECEPCAO_CLINICA_A}", "role": "authenticated"}';`);
  const resRecepcaoOutro = await db.query<any>(`
    SELECT public.conceder_autorizacao_assinatura(
      'Dra. Rosângela Santos Pereira',
      '06267-AL',
      'data:image/png;base64,assinatura_falsa_por_recepcao',
      'contrato_odontologico',
      '["geral"]'::jsonb,
      '${ID_CLINICA_A}',
      true
    ) as result;
  `);
  assert(resRecepcaoOutro.rows[0].result.ok === false, 'Usuário de recepção NÃO tem permissão para autorizar assinatura titular');
  assert(resRecepcaoOutro.rows[0].result.code === 'FORBIDDEN', 'Retornou código FORBIDDEN para usuário de recepção');

  // 4.2.c Tentativa de forjar concessão para clínica externa
  await db.exec(`SET request.jwt.claims = '{"sub": "${ID_DRA_ROSANGELA}", "role": "authenticated"}';`);
  const resClinicaExterna = await db.query<any>(`
    SELECT public.conceder_autorizacao_assinatura(
      'Dra. Rosângela Santos Pereira',
      '06267-AL',
      'data:image/png;base64,assinatura_ok',
      'contrato_odontologico',
      '["geral"]'::jsonb,
      '${ID_CLINICA_B}',
      true
    ) as result;
  `);
  assert(resClinicaExterna.rows[0].result.ok === false, 'Tentativa de conceder autorização para outra clínica foi BLOQUEADA');
  assert(resClinicaExterna.rows[0].result.code === 'FORBIDDEN', 'Retornou código FORBIDDEN para clínica externa');

  // 4.3.a Validação do Ajuste 1: Omissão de p_consentimento_expresso (deve assumir DEFAULT false)
  await db.exec(`SET request.jwt.claims = '{"sub": "${ID_DRA_ROSANGELA}", "role": "authenticated"}';`);
  const resDefaultFalse = await db.query<any>(`
    SELECT public.conceder_autorizacao_assinatura(
      'Dra. Rosângela Santos Pereira',
      '06267-AL',
      'data:image/png;base64,assinatura_ok',
      'contrato_odontologico',
      '["geral"]'::jsonb,
      '${ID_CLINICA_A}'
      -- p_consentimento_expresso OMITIDO propositalmente
    ) as result;
  `);
  assert(resDefaultFalse.rows[0].result.ok === false, 'Chamada com parâmetro omitido foi BLOQUEADA (DEFAULT false confirmado)');
  assert(resDefaultFalse.rows[0].result.code === 'CONSENT_REQUIRED', 'Retornou código CONSENT_REQUIRED por DEFAULT false');

  // 4.3.b Tentativa com consentimento falso explícito
  const resSemConsentimento = await db.query<any>(`
    SELECT public.conceder_autorizacao_assinatura(
      'Dra. Rosângela Santos Pereira',
      '06267-AL',
      'data:image/png;base64,assinatura_ok',
      'contrato_odontologico',
      '["geral"]'::jsonb,
      '${ID_CLINICA_A}',
      false
    ) as result;
  `);
  assert(resSemConsentimento.rows[0].result.ok === false, 'Tentativa com consentimento false explícito foi BLOQUEADA');
  assert(resSemConsentimento.rows[0].result.code === 'CONSENT_REQUIRED', 'Retornou código CONSENT_REQUIRED');

  // 4.3.c Validação do Ajuste 2: Bloqueio de Nome Arbitrário (Não aceita nome aleatório)
  const resNomeArbitrario = await db.query<any>(`
    SELECT public.conceder_autorizacao_assinatura(
      'Dr. João da Silva Arbitrário',
      '06267-AL',
      'data:image/png;base64,assinatura_ok',
      'contrato_odontologico',
      '["geral"]'::jsonb,
      '${ID_CLINICA_A}',
      true
    ) as result;
  `);
  assert(resNomeArbitrario.rows[0].result.ok === false, 'Tentativa com Nome arbitrário divergente da titular foi BLOQUEADA');
  assert(resNomeArbitrario.rows[0].result.code === 'TITULAR_CADASTRO_DIVERGENTE', 'Retornou código TITULAR_CADASTRO_DIVERGENTE para nome');

  // 4.3.d Validação do Ajuste 2: Bloqueio de CRO Arbitrário (Não aceita CRO aleatório)
  const resCroArbitrario = await db.query<any>(`
    SELECT public.conceder_autorizacao_assinatura(
      'Dra. Rosângela Santos Pereira',
      '99999-SP',
      'data:image/png;base64,assinatura_ok',
      'contrato_odontologico',
      '["geral"]'::jsonb,
      '${ID_CLINICA_A}',
      true
    ) as result;
  `);
  assert(resCroArbitrario.rows[0].result.ok === false, 'Tentativa com CRO arbitrário divergente da titular foi BLOQUEADA');
  assert(resCroArbitrario.rows[0].result.code === 'TITULAR_CADASTRO_DIVERGENTE', 'Retornou código TITULAR_CADASTRO_DIVERGENTE para CRO');

  // 4.3.e Validação do Ajuste 2: Validação de p_clinica_id contra vínculo real do usuário
  const resClinicaInvalida = await db.query<any>(`
    SELECT public.conceder_autorizacao_assinatura(
      'Dra. Rosângela Santos Pereira',
      '06267-AL',
      'data:image/png;base64,assinatura_ok',
      'contrato_odontologico',
      '["geral"]'::jsonb,
      '99999999-9999-9999-9999-999999999999',
      true
    ) as result;
  `);
  assert(resClinicaInvalida.rows[0].result.ok === false, 'Tentativa com clinica_id arbitrário sem vínculo foi BLOQUEADA');
  assert(resClinicaInvalida.rows[0].result.code === 'FORBIDDEN', 'Retornou código FORBIDDEN para clínica sem vínculo');

  // 4.4 Titular legítima Dra. Rosângela com cadastro conferido e consentimento formal explícito (true)
  const resTitularLegitima = await db.query<any>(`
    SELECT public.conceder_autorizacao_assinatura(
      'Dra. Rosângela Santos Pereira',
      '06267-AL',
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'contrato_odontologico',
      '["geral", "lentes_resina"]'::jsonb,
      '${ID_CLINICA_A}',
      true
    ) as result;
  `);
  assert(resTitularLegitima.rows[0].result.ok === true, 'Própria titular (Dra. Rosângela) com dados verificados concedeu autorização com sucesso');
  const authId = resTitularLegitima.rows[0].result.autorizacao_id;
  assert(Boolean(authId), 'UUID da autorização gerado');

  // 4.5.a Teste de Acesso Anônimo à RPC obter_autorizacao_ativa_profissional (REVOKE EXECUTE + Trava Interna)
  let bloqueouPermissaoAnon = false;
  try {
    await db.exec(`SET ROLE anon;`);
    await db.query(`SELECT public.obter_autorizacao_ativa_profissional('06267-AL');`);
  } catch (err: any) {
    bloqueouPermissaoAnon = true;
  } finally {
    await db.exec(`SET ROLE postgres;`);
  }
  assert(bloqueouPermissaoAnon, 'EXECUTE negado ao role anon em obter_autorizacao_ativa_profissional (REVOKE aplicado)');

  // Chamada anônima direta sem credenciais/sub
  await db.exec(`SET request.jwt.claims = '{"role": "anon"}';`);
  const resAnonRpc = await db.query<any>(`
    SELECT public.obter_autorizacao_ativa_profissional('06267-AL') as result;
  `);
  assert(resAnonRpc.rows[0].result.ok === false, 'Acesso não autenticado à RPC foi BLOQUEADO');
  assert(resAnonRpc.rows[0].result.code === 'UNAUTHORIZED', 'Retornou código UNAUTHORIZED para chamada anônima');
  assert(!resAnonRpc.rows[0].result.assinaturaGrafica, 'Rubrica gráfica NÃO foi exposta em chamada pública');

  // 4.5.b Teste de Acesso Cross-Clínica (Clínica B tentando obter assinatura da Clínica A)
  await db.exec(`SET request.jwt.claims = '{"sub": "${ID_DR_OUTRO_CLINICA_B}", "role": "authenticated"}';`);
  const resCrossClinicaExplicit = await db.query<any>(`
    SELECT public.obter_autorizacao_ativa_profissional('06267-AL', '${ID_CLINICA_A}') as result;
  `);
  assert(resCrossClinicaExplicit.rows[0].result.ok === false, 'Tentativa explícita de acessar assinatura de outra clínica foi BLOQUEADA');
  assert(resCrossClinicaExplicit.rows[0].result.code === 'FORBIDDEN', 'Retornou código FORBIDDEN para isolamento entre clínicas');
  assert(!resCrossClinicaExplicit.rows[0].result.assinaturaGrafica, 'Rubrica gráfica NÃO foi exposta para clínica externa');

  const resCrossClinicaImplicit = await db.query<any>(`
    SELECT public.obter_autorizacao_ativa_profissional('06267-AL') as result;
  `);
  assert(resCrossClinicaImplicit.rows[0].result.ok === true && resCrossClinicaImplicit.rows[0].result.temAutorizacao === false, 'Consulta no escopo de outra clínica não encontra autorização');
  assert(!resCrossClinicaImplicit.rows[0].result.assinaturaGrafica, 'Rubrica gráfica NÃO vazou no escopo da Clínica B');

  // 4.5.c Teste de Acesso Autorizado da Própria Clínica (Dra. Rosângela / Clínica A)
  await db.exec(`SET request.jwt.claims = '{"sub": "${ID_DRA_ROSANGELA}", "role": "authenticated"}';`);
  const resInterfaceRpc = await db.query<any>(`
    SELECT public.obter_autorizacao_ativa_profissional('06267-AL') as result;
  `);
  assert(resInterfaceRpc.rows[0].result.ok === true, 'Interface RPC obter_autorizacao_ativa_profissional retornou sucesso para usuário autorizado');
  assert(resInterfaceRpc.rows[0].result.temAutorizacao === true, 'Interface detecta autorização ativa da Dra. Rosângela');
  assert(resInterfaceRpc.rows[0].result.profissionalCro === '06267-AL', 'Interface confirma CRO oficial 06267-AL');
  assert(Boolean(resInterfaceRpc.rows[0].result.assinaturaGrafica), 'Rubrica gráfica entregue exclusivamente para fluxo autenticado e autorizado');

  // 4.6 Confirmação de compatibilidade da consulta direta da interface com order by autorizado_em
  const resInterfaceDirect = await db.query<any>(`
    SELECT id, profissional_nome, profissional_cro, assinatura_grafica, ativo, autorizado_em
    FROM public.autorizacoes_assinatura_profissional
    WHERE ativo = true AND revogado_em IS NULL
    ORDER BY autorizado_em DESC
    LIMIT 1;
  `);
  assert(resInterfaceDirect.rows.length === 1, 'Consulta direta da interface administrativa retornou autorização vigente');
  assert(resInterfaceDirect.rows[0].profissional_cro === '06267-AL', 'Consulta direta confirmou profissional_cro');
  assert(Boolean(resInterfaceDirect.rows[0].assinatura_grafica), 'Consulta direta confirmou assinatura_grafica');

  // 5. Validação do Ponto 1: RLS da Fila de PDFs Sem clinica_id IS NULL e Restrita por Clínica
  console.log(`\n${STEP} 5. Testes em Fila de PDFs (Isolamento Estrito de Leitura e Sem clinica_id IS NULL)`);

  // Insere tarefa na fila para a Clínica A associada ao contrato regular da própria clínica
  await db.exec(`
    INSERT INTO public.fila_arquivamento_pdf (contrato_id, documento_id, clinica_id, status)
    VALUES ('CTR-FILA-TESTE-A', '${docRegularAId}', '${ID_CLINICA_A}', 'pendente');
  `);

  // 5.1 Usuário da Clínica B tenta ler a fila da Clínica A
  await db.exec(`
    SET ROLE authenticated;
    SET request.jwt.claims = '{"sub": "${ID_DR_OUTRO_CLINICA_B}", "role": "authenticated"}';
  `);
  const resFilaLeituraB = await db.query<any>(`
    SELECT count(*) as total FROM public.fila_arquivamento_pdf WHERE contrato_id = 'CTR-FILA-TESTE-A';
  `);
  // RLS deve filtrar e retornar 0 linhas
  assert(parseInt(resFilaLeituraB.rows[0].total, 10) === 0, 'Usuário da Clínica B visualizou ZERO registros da fila da Clínica A (RLS isolada)');

  // 5.2 Membro da Clínica A lê sua própria fila
  await db.exec(`
    SET ROLE authenticated;
    SET request.jwt.claims = '{"sub": "${ID_DRA_ROSANGELA}", "role": "authenticated"}';
  `);
  const resFilaLeituraA = await db.query<any>(`
    SELECT count(*) as total FROM public.fila_arquivamento_pdf WHERE contrato_id = 'CTR-FILA-TESTE-A';
  `);
  assert(parseInt(resFilaLeituraA.rows[0].total, 10) === 1, 'Titular da Clínica A visualizou seu registro na fila com sucesso');

  // Retorna para role postgres para operações subsequentes de teste
  await db.exec(`SET ROLE postgres;`);

  // 5.3 Validação do Ajuste 3: Preservação de contrato legado e bloqueio de enfileiramento sem vínculo comprovado
  await db.exec(`SET request.jwt.claims = '{"sub": "${ID_DRA_ROSANGELA}", "role": "authenticated"}';`);
  const resLegacyFilaA = await db.query<any>(`
    SELECT public.enfileirar_ou_processar_pdf('CTR-DUPLICADO') as result;
  `);
  assert(resLegacyFilaA.rows[0].result.ok === false, 'Contrato legado com clinica_id IS NULL é protegido contra enfileiramento sem vínculo comprovado');
  assert(resLegacyFilaA.rows[0].result.code === 'NOT_FOUND', 'Retornou NOT_FOUND preservando documento legado');

  // 5.3.b Enfileiramento de contrato regular da própria clínica pelo titular
  const resRegularFilaA = await db.query<any>(`
    SELECT public.enfileirar_ou_processar_pdf('CTR-REGULAR-A') as result;
  `);
  assert(resRegularFilaA.rows[0].result.ok === true, 'Contrato regular da própria clínica enfileirado com sucesso pelo titular');

  // 5.3.c Tentativa de manipulação de contratos entre clínicas em enfileirar_ou_processar_pdf
  await db.exec(`SET request.jwt.claims = '{"sub": "${ID_DR_OUTRO_CLINICA_B}", "role": "authenticated"}';`);
  const resCrossFila = await db.query<any>(`
    SELECT public.enfileirar_ou_processar_pdf('CTR-REGULAR-A') as result;
  `);
  assert(resCrossFila.rows[0].result.ok === false, 'Tentativa de manipular contrato da Clínica A por usuário da Clínica B foi BLOQUEADA');
  assert(resCrossFila.rows[0].result.code === 'NOT_FOUND', 'Contrato alheio não é localizado no acervo da clínica');

  // 5.4 Tentativa de revogar autorização por usuário de outra clínica
  await db.exec(`SET request.jwt.claims = '{"sub": "${ID_DR_OUTRO_CLINICA_B}", "role": "authenticated"}';`);
  const resRevogacaoCross = await db.query<any>(`
    SELECT public.revogar_autorizacao_assinatura('${authId}', 'Tentativa indevida externa') as result;
  `);
  assert(resRevogacaoCross.rows[0].result.ok === false, 'Tentativa de revogar autorização alheia foi BLOQUEADA');
  assert(resRevogacaoCross.rows[0].result.code === 'FORBIDDEN', 'Retornou código FORBIDDEN para revogação cross-clínica');

  // 5.5 Tentativa de INSERT direto na tabela fila_arquivamento_pdf por usuário authenticated
  await db.exec(`
    SET ROLE authenticated;
    SET request.jwt.claims = '{"sub": "${ID_DRA_ROSANGELA}", "role": "authenticated"}';
  `);
  let bloqueouInsertDiretoFila = false;
  try {
    await db.exec(`
      INSERT INTO public.fila_arquivamento_pdf (contrato_id, clinica_id)
      VALUES ('CTR-HACK', '${ID_CLINICA_A}');
    `);
  } catch (err: any) {
    bloqueouInsertDiretoFila = true;
  }
  assert(bloqueouInsertDiretoFila, 'Usuário authenticated está BLOQUEADO de fazer INSERT direto em fila_arquivamento_pdf');

  // 5.6 Tentativa de UPDATE/DELETE direto na tabela historico_autorizacoes_assinatura
  let bloqueouUpdateHistorico = false;
  try {
    await db.exec(`
      UPDATE public.historico_autorizacoes_assinatura
      SET acao = 'FRAUDE';
    `);
  } catch (err: any) {
    bloqueouUpdateHistorico = true;
  }
  assert(bloqueouUpdateHistorico, 'Usuário authenticated está BLOQUEADO de modificar historico_autorizacoes_assinatura (imutável)');

  await db.exec(`SET ROLE postgres;`);

  // 6. Validação do Ponto 4: Imutabilidade Total e Proibição de Exclusão de Contratos Assinados
  console.log(`\n${STEP} 6. Testes de Imutabilidade Total e Bloqueio de DELETE`);

  // 6.0 Validação do Ajuste 4: Contrato contendo assinaturaDra antes da assinatura do paciente
  const resDocDra = await db.query<any>(`
    INSERT INTO public.documentos_clinicos (
      tipo, titulo, conteudo, valor_total, identificador, clinica_id, user_id, itens
    ) VALUES (
      'contrato', 'Contrato com Pré-Assinatura Dra', 'Texto integral do contrato...', 5000.00,
      'CTR-DRA-PRE-001', '${ID_CLINICA_A}', '${ID_DRA_ROSANGELA}',
      '{
        "status": "aguardando_paciente",
        "assinaturaDra": {
          "nome": "Dra. Rosângela Santos Pereira",
          "cro": "06267-AL",
          "dataHora": "2026-11-02T10:00:00Z",
          "assinaturaData": "base64_assinatura_dra"
        }
      }'::jsonb
    ) RETURNING id;
  `);
  const docDraId = resDocDra.rows[0].id;

  // 6.0.a Tentativa de DELETE em contrato contendo assinaturaDra (Ajuste 4)
  let bloqueouDeleteDra = false;
  let erroDeleteDraMsg = '';
  try {
    await db.exec(`DELETE FROM public.documentos_clinicos WHERE id = '${docDraId}';`);
  } catch (err: any) {
    bloqueouDeleteDra = true;
    erroDeleteDraMsg = err.message || '';
  }
  assert(bloqueouDeleteDra, 'Trigger bloqueou tentativa de DELETE em contrato contendo assinaturaDra (Ajuste 4)');
  assert(erroDeleteDraMsg.includes('não podem ser excluídos'), 'Mensagem jurídica de proibição confirmada para assinaturaDra');

  // 6.0.b Consistência: Trigger de UPDATE também bloqueia adulteração de contrato com assinaturaDra
  let bloqueouUpdateDra = false;
  try {
    await db.exec(`UPDATE public.documentos_clinicos SET conteudo = 'Texto adulterado' WHERE id = '${docDraId}';`);
  } catch (err) {
    bloqueouUpdateDra = true;
  }
  assert(bloqueouUpdateDra, 'Trigger de UPDATE bloqueou alteração de conteúdo em contrato com assinaturaDra (consistência total)');

  // 6.0.c Proteção específica da assinatura histórica assinaturaDra contra modificação
  let bloqueouModificarAssinaturaDra = false;
  let erroModificarDraMsg = '';
  try {
    await db.exec(`
      UPDATE public.documentos_clinicos 
      SET itens = jsonb_set(itens, '{assinaturaDra,assinaturaData}', '"assinatura_adulterada"'::jsonb)
      WHERE id = '${docDraId}';
    `);
  } catch (err: any) {
    bloqueouModificarAssinaturaDra = true;
    erroModificarDraMsg = err.message || '';
  }
  assert(bloqueouModificarAssinaturaDra, 'Trigger bloqueou tentativa de modificar a assinatura histórica da titular (assinaturaDra)');
  assert(erroModificarDraMsg.includes('assinaturaDra'), 'Mensagem de violação de integridade específica de assinaturaDra confirmada');

  const resNovoDoc = await db.query<any>(`
    INSERT INTO public.documentos_clinicos (
      tipo, titulo, conteudo, valor_total, identificador, clinica_id, user_id, assinado_em, itens
    ) VALUES (
      'contrato', 'Contrato Blindado de Lentes', 'Texto integral da Cláusula 1ª...', 12000.00,
      'CTR-BLINDADO-001', '${ID_CLINICA_A}', '${ID_DRA_ROSANGELA}', now(),
      '{
        "status": "formalizado",
        "isFormalizadoTotal": true,
        "titulo": "Contrato Blindado de Lentes",
        "financeiro": {"valorTotal": 12000.00, "condicao": "Entrada + 10x"},
        "itens": [{"nome": "Lentes Cerâmicas", "qtd": 10}],
        "parcelas": [{"numero": 1, "valor": 1200.00}],
        "clausulas": ["Cláusula 1: Prestação", "Cláusula 2: Pagamento"],
        "paciente": {"nome": "Paciente Protegido", "cpf": "111.111.111-11"},
        "clinica": {"nome": "Clínica Dra. Rosângela", "cnpj": "00.000.000/0001-00"},
        "assinaturaDentista": {"dataHora": "2026-11-02T10:00:00Z", "assinaturaData": "base64_dra"},
        "assinaturaPaciente": {"dataHora": "2026-11-02T10:05:00Z", "assinaturaData": "base64_pac"}
      }'::jsonb
    ) RETURNING id;
  `);
  const docAssinadoId = resNovoDoc.rows[0].id;

  // 6.1 Tentativa de DELETE em contrato assinado (PROIBIÇÃO DE EXCLUSÃO)
  let bloqueouDelete = false;
  let erroDeleteMsg = '';
  try {
    await db.exec(`DELETE FROM public.documentos_clinicos WHERE id = '${docAssinadoId}';`);
  } catch (err: any) {
    bloqueouDelete = true;
    erroDeleteMsg = err.message || '';
  }
  assert(bloqueouDelete, 'Tentativa de DELETE em contrato formalizado foi IMPEDIDA por trigger');
  assert(erroDeleteMsg.includes('não podem ser excluídos'), 'Mensagem de proibição jurídica confirmada');

  // 6.2 Tentativa de adulterar dados do paciente dentro de itens
  let bloqueouPaciente = false;
  try {
    await db.exec(`
      UPDATE public.documentos_clinicos
      SET itens = jsonb_set(itens, '{paciente,nome}', '"Nome Adulterado"'::jsonb)
      WHERE id = '${docAssinadoId}';
    `);
  } catch (err: any) {
    bloqueouPaciente = true;
  }
  assert(bloqueouPaciente, 'Trigger bloqueou tentativa de adulterar itens->paciente em contrato assinado');

  // 6.3 Tentativa de adulterar parcelas dentro de itens
  let bloqueouParcelas = false;
  try {
    await db.exec(`
      UPDATE public.documentos_clinicos
      SET itens = jsonb_set(itens, '{parcelas}', '[{"numero": 1, "valor": 10.00}]'::jsonb)
      WHERE id = '${docAssinadoId}';
    `);
  } catch (err: any) {
    bloqueouParcelas = true;
  }
  assert(bloqueouParcelas, 'Trigger bloqueou tentativa de adulterar itens->parcelas em contrato assinado');

  // 6.4 Tentativa de adulterar cláusulas contratuais dentro de itens
  let bloqueouClausulas = false;
  try {
    await db.exec(`
      UPDATE public.documentos_clinicos
      SET itens = jsonb_set(itens, '{clausulas}', '["Cláusula Adulterada"]'::jsonb)
      WHERE id = '${docAssinadoId}';
    `);
  } catch (err: any) {
    bloqueouClausulas = true;
  }
  assert(bloqueouClausulas, 'Trigger bloqueou tentativa de adulterar itens->clausulas em contrato assinado');

  // 6.5 Tentativa de transferir a titularidade de clínica do contrato
  let bloqueouTrocaClinica = false;
  try {
    await db.exec(`
      UPDATE public.documentos_clinicos
      SET clinica_id = '${ID_CLINICA_B}'
      WHERE id = '${docAssinadoId}';
    `);
  } catch (err: any) {
    bloqueouTrocaClinica = true;
  }
  assert(bloqueouTrocaClinica, 'Trigger bloqueou tentativa de transferir a titularidade de clínica do contrato assinado');

  // 6.6 Operação Técnica Legítima: Gravação do pdf_path pelo Storage
  let permitiuPdfPath = false;
  try {
    await db.exec(`
      UPDATE public.documentos_clinicos
      SET pdf_path = 'contratos/CTR-BLINDADO-001/Contrato_Assinado_CTR-BLINDADO-001.pdf',
          atualizado_em = now()
      WHERE id = '${docAssinadoId}';
    `);
    permitiuPdfPath = true;
  } catch (err: any) {
    permitiuPdfPath = false;
  }
  assert(permitiuPdfPath, 'Trigger PERMITIU atualização técnica autorizada de pdf_path e atualizado_em');

  // 6.7 Tentativa de alterar o título do contrato assinado
  let bloqueouTitulo = false;
  try {
    await db.exec(`UPDATE public.documentos_clinicos SET titulo = 'Contrato Alterado' WHERE id = '${docAssinadoId}';`);
  } catch (err) {
    bloqueouTitulo = true;
  }
  assert(bloqueouTitulo, 'Trigger bloqueou tentativa de adulterar título em contrato assinado');

  // 6.8 Tentativa de alterar o conteúdo textual do contrato assinado
  let bloqueouConteudo = false;
  try {
    await db.exec(`UPDATE public.documentos_clinicos SET conteudo = 'Texto modificado unilateralmente' WHERE id = '${docAssinadoId}';`);
  } catch (err) {
    bloqueouConteudo = true;
  }
  assert(bloqueouConteudo, 'Trigger bloqueou tentativa de adulterar conteúdo textual em contrato assinado');

  // 6.9 Tentativa de alterar o valor financeiro total do contrato assinado
  let bloqueouValor = false;
  try {
    await db.exec(`UPDATE public.documentos_clinicos SET valor_total = 500.00 WHERE id = '${docAssinadoId}';`);
  } catch (err) {
    bloqueouValor = true;
  }
  assert(bloqueouValor, 'Trigger bloqueou tentativa de adulterar valor_total em contrato assinado');

  // 6.10 Tentativa de alterar itens->financeiro do contrato assinado
  let bloqueouFinanceiro = false;
  try {
    await db.exec(`
      UPDATE public.documentos_clinicos 
      SET itens = jsonb_set(itens, '{financeiro,condicao}', '"À vista com 90% desconto"'::jsonb)
      WHERE id = '${docAssinadoId}';
    `);
  } catch (err) {
    bloqueouFinanceiro = true;
  }
  assert(bloqueouFinanceiro, 'Trigger bloqueou tentativa de adulterar condições financeiras em contrato assinado');

  // 6.11 Tentativa de alterar itens->itens (lista de procedimentos)
  let bloqueouListaItens = false;
  try {
    await db.exec(`
      UPDATE public.documentos_clinicos 
      SET itens = jsonb_set(itens, '{itens}', '[]'::jsonb)
      WHERE id = '${docAssinadoId}';
    `);
  } catch (err) {
    bloqueouListaItens = true;
  }
  assert(bloqueouListaItens, 'Trigger bloqueou tentativa de adulterar lista de procedimentos em contrato assinado');

  // 6.12 Tentativa de alterar itens->assinaturaPaciente
  let bloqueouAssinaturaPac = false;
  try {
    await db.exec(`
      UPDATE public.documentos_clinicos 
      SET itens = jsonb_set(itens, '{assinaturaPaciente,assinaturaData}', '"assinatura_adulterada"'::jsonb)
      WHERE id = '${docAssinadoId}';
    `);
  } catch (err) {
    bloqueouAssinaturaPac = true;
  }
  assert(bloqueouAssinaturaPac, 'Trigger bloqueou tentativa de adulterar assinatura do paciente formalizada');

  // 6.13 Tentativa de alterar itens->assinaturaDentista
  let bloqueouAssinaturaDent = false;
  try {
    await db.exec(`
      UPDATE public.documentos_clinicos 
      SET itens = jsonb_set(itens, '{assinaturaDentista,assinaturaData}', '"assinatura_adulterada"'::jsonb)
      WHERE id = '${docAssinadoId}';
    `);
  } catch (err) {
    bloqueouAssinaturaDent = true;
  }
  assert(bloqueouAssinaturaDent, 'Trigger bloqueou tentativa de adulterar assinatura da profissional vinculada');

  console.log('\n================================================================');
  console.log(`RESULTADO FINAL: ${passedTests}/${totalTests} TESTES DE SEGURANÇA APROVADOS (100%)`);
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('Falha nos testes de segurança:', err);
  process.exit(1);
});
