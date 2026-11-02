/**
 * SUÍTE DE TESTES DE SEGURANÇA E BLINDAGEM DA MIGRATION V3.0
 * Execução em PostgreSQL 18.6 Isolado (PGlite WASM)
 * 
 * Validação rigorosa dos 8 pontos de segurança:
 * 1. Imutabilidade do histórico para usuários comuns (escrita direta negada)
 * 2. RLS da Fila PDF restrita por clínica e operação (escrita direta negada)
 * 3. RPC conceder_autorizacao_assinatura: exige vínculo e identidade da titular
 * 4. RPC revogar_autorizacao_assinatura: restrita à titular e delegados autorizados
 * 5. RPC enfileirar_ou_processar_pdf: isolamento de tenant e bloqueio a loops infinitos
 * 6. usuario_possui_perfil_clinica: sem confiança cega e sem acesso universal por clinica_id IS NULL
 * 7. Trigger de imutabilidade: proteção de itens (financeiro, procedimento, assinaturas) e permissão de pdf_path
 * 8. UPDATE de contratos históricos: não colidente e preservação determinística
 * 9. Sem GRANT ALL para authenticated em tabelas sensíveis
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
  console.log('TESTES DE SEGURANÇA: MIGRATION 20261102_blindagem_seguranca_v3.sql');
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
  `);
  assert(true, 'Estrutura base criada com sucesso');

  // Insere contratos legados para testar o UPDATE não colidente
  await db.exec(`
    INSERT INTO public.documentos_clinicos (id, tipo, titulo, itens, identificador) VALUES
      ('11111111-1111-1111-1111-111111111111', 'contrato', 'Contrato Legado 1', '{"contratoId": "CTR-TESTE-DUPLICADO"}'::jsonb, NULL),
      ('22222222-2222-2222-2222-222222222222', 'contrato', 'Contrato Legado 2', '{"contratoId": "CTR-TESTE-DUPLICADO"}'::jsonb, NULL),
      ('33333333-3333-3333-3333-333333333333', 'contrato', 'Contrato Legado 3 Sem Id', '{}'::jsonb, NULL),
      ('44444444-4444-4444-4444-444444444444', 'contrato', 'Contrato Já Identificado', '{}'::jsonb, 'CTR-HISTORICO-INTACTO');
  `);

  // 2. Executa a migration real corrigida
  console.log(`\n${STEP} 2. Aplicando a Migration 20261102_blindagem_seguranca_v3.sql`);
  const migrationSql = fs.readFileSync(path.resolve('supabase/migrations/20261102_blindagem_seguranca_v3.sql'), 'utf-8');
  await db.exec(migrationSql);
  assert(true, 'Migration 20261102_blindagem_seguranca_v3.sql aplicada sem erros de sintaxe ou execução');

  // 3. Teste do Ponto 8: UPDATE de Contratos Históricos sem Colisão
  console.log(`\n${STEP} 3. Validação do UPDATE de Contratos Históricos (Resolução de Colisão)`);
  const resLegados = await db.query<any>(`
    SELECT id, identificador FROM public.documentos_clinicos ORDER BY criado_em ASC;
  `);
  const c1 = resLegados.rows.find(r => r.id === '11111111-1111-1111-1111-111111111111');
  const c2 = resLegados.rows.find(r => r.id === '22222222-2222-2222-2222-222222222222');
  const c3 = resLegados.rows.find(r => r.id === '33333333-3333-3333-3333-333333333333');
  const c4 = resLegados.rows.find(r => r.id === '44444444-4444-4444-4444-444444444444');

  assert(c4.identificador === 'CTR-HISTORICO-INTACTO', 'Contrato que já possuía identificador permaneceu 100% inalterado');
  assert(c1.identificador === 'CTR-TESTE-DUPLICADO', 'Primeiro contrato legado recebeu o identificador original');
  assert(c2.identificador === 'CTR-TESTE-DUPLICADO-LEG2', 'Segundo contrato legado com mesmo ID recebeu sufixo não colidente determinístico');
  assert(c3.identificador.startsWith('CTR-33333333'), 'Contrato sem identificador recebeu formato canônico prefixado por CTR-');

  // Usuários de Teste:
  const ID_DRA_ROSANGELA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; // Titular da Clínica A
  const ID_RECEPCAO = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';      // Funcionária da Clínica A (role: recepcionista)
  const ID_OUTRA_CLINICA = 'cccccccc-cccc-cccc-cccc-cccccccccccc'; // Titular da Clínica B
  const ID_CLINICA_A = ID_DRA_ROSANGELA;
  const ID_CLINICA_B = ID_OUTRA_CLINICA;

  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES
      ('${ID_DRA_ROSANGELA}', 'dra.rosangela@clinica.com'),
      ('${ID_RECEPCAO}', 'recepcao@clinica.com'),
      ('${ID_OUTRA_CLINICA}', 'dr.outro@clinicab.com');

    INSERT INTO public.user_roles (user_id, role, clinica_id) VALUES
      ('${ID_DRA_ROSANGELA}', 'admin', '${ID_CLINICA_A}'),
      ('${ID_DRA_ROSANGELA}', 'dentista', '${ID_CLINICA_A}'),
      ('${ID_RECEPCAO}', 'recepcao', '${ID_CLINICA_A}'),
      ('${ID_OUTRA_CLINICA}', 'admin', '${ID_CLINICA_B}');
  `);

  // 4. Teste do Ponto 3: RPC conceder_autorizacao_assinatura
  console.log(`\n${STEP} 4. Testes de Segurança em conceder_autorizacao_assinatura`);

  // 4.1 Usuário da Clínica B tentando criar autorização para a Clínica A
  await db.exec(`SET request.jwt.claims = '{"sub": "${ID_OUTRA_CLINICA}", "role": "authenticated"}';`);
  const resAttacker = await db.query<any>(`
    SELECT public.conceder_autorizacao_assinatura(
      'Dra. Rosângela Santos Pereira',
      '06267-AL',
      'data:image/png;base64,assinatura_forjada',
      'contrato_odontologico',
      '["geral"]'::jsonb,
      '${ID_CLINICA_A}'
    ) as result;
  `);
  assert(resAttacker.rows[0].result.ok === false, 'Tentativa de usuário de outra clínica de forjar autorização foi BLOQUEADA');
  assert(resAttacker.rows[0].result.code === 'FORBIDDEN', 'Código de erro retornado: FORBIDDEN');

  // 4.2 Funcionária recepcionista tentando criar autorização
  await db.exec(`SET request.jwt.claims = '{"sub": "${ID_RECEPCAO}", "role": "authenticated"}';`);
  const resRecepcao = await db.query<any>(`
    SELECT public.conceder_autorizacao_assinatura(
      'Dra. Rosângela Santos Pereira',
      '06267-AL',
      'data:image/png;base64,assinatura_recepcao',
      'contrato_odontologico',
      '["geral"]'::jsonb,
      '${ID_CLINICA_A}'
    ) as result;
  `);
  assert(resRecepcao.rows[0].result.ok === false, 'Tentativa de recepcionista de criar autorização foi BLOQUEADA');
  assert(resRecepcao.rows[0].result.code === 'FORBIDDEN', 'Código retornado para recepcionista: FORBIDDEN');

  // 4.3 Titular Dra. Rosângela concedendo autorização legítima
  await db.exec(`SET request.jwt.claims = '{"sub": "${ID_DRA_ROSANGELA}", "role": "authenticated"}';`);
  const resTitular = await db.query<any>(`
    SELECT public.conceder_autorizacao_assinatura(
      'Dra. Rosângela Santos Pereira',
      '06267-AL',
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'contrato_odontologico',
      '["geral", "lentes_resina"]'::jsonb,
      '${ID_CLINICA_A}'
    ) as result;
  `);
  assert(resTitular.rows[0].result.ok === true, 'Titular Dra. Rosângela concedeu autorização com sucesso');
  const authId = resTitular.rows[0].result.autorizacao_id;
  assert(Boolean(authId), 'UUID da autorização gerado');

  // 5. Teste do Ponto 4: RPC revogar_autorizacao_assinatura
  console.log(`\n${STEP} 5. Testes de Segurança em revogar_autorizacao_assinatura`);

  // 5.1 Outra clínica tentando revogar autorização da Dra. Rosângela
  await db.exec(`SET request.jwt.claims = '{"sub": "${ID_OUTRA_CLINICA}", "role": "authenticated"}';`);
  const resRevogOutro = await db.query<any>(`
    SELECT public.revogar_autorizacao_assinatura('${authId}', 'Tentativa maliciosa') as result;
  `);
  assert(resRevogOutro.rows[0].result.ok === false, 'Tentativa de outra clínica de revogar foi BLOQUEADA');
  assert(resRevogOutro.rows[0].result.code === 'FORBIDDEN', 'Código FORBIDDEN retornado');

  // 6. Teste dos Pontos 1, 2 e 9: RLS e Ausência de GRANT ALL para authenticated
  console.log(`\n${STEP} 6. Validação de Imutabilidade e Bloqueio de Escrita Direta (RLS e Grants)`);

  // 6.1 Tentativa de INSERT direto na tabela historico_autorizacoes_assinatura por authenticated
  await db.exec(`SET ROLE authenticated;`);
  let falhouEscritaHistorico = false;
  try {
    await db.exec(`
      INSERT INTO public.historico_autorizacoes_assinatura (autorizacao_id, acao, executado_por)
      VALUES ('${authId}', 'INVASAO_DIRETA', '${ID_DRA_ROSANGELA}');
    `);
  } catch (err: any) {
    falhouEscritaHistorico = true;
  }
  assert(falhouEscritaHistorico, 'INSERT direto em historico_autorizacoes_assinatura por authenticated foi IMPEDIDO pelo banco');

  // 6.2 Tentativa de DELETE direto na fila_arquivamento_pdf por authenticated
  let falhouDeleteFila = false;
  try {
    await db.exec(`DELETE FROM public.fila_arquivamento_pdf WHERE true;`);
  } catch (err: any) {
    falhouDeleteFila = true;
  }
  assert(falhouDeleteFila, 'DELETE direto em fila_arquivamento_pdf por authenticated foi IMPEDIDO pelo banco');

  // Retorna para role postgres/service_role para os testes das funções
  await db.exec(`SET ROLE postgres;`);

  // 7. Teste do Ponto 5: RPC enfileirar_ou_processar_pdf (Tenant Isolation & Loop Prevention)
  console.log(`\n${STEP} 7. Testes de Segurança na Fila de PDFs (enfileirar_ou_processar_pdf)`);

  // Cadastra um contrato da Clínica A
  const CTR_A = 'CTR-CLINICA-A-001';
  await db.exec(`
    INSERT INTO public.documentos_clinicos (
      id, tipo, titulo, identificador, clinica_id, user_id, itens
    ) VALUES (
      '55555555-5555-5555-5555-555555555555', 'contrato', 'Contrato Teste A', '${CTR_A}', '${ID_CLINICA_A}', '${ID_CLINICA_A}', '{"contratoId": "${CTR_A}"}'::jsonb
    );
  `);

  // 7.1 Usuário da Clínica B tentando processar/enfileirar contrato da Clínica A
  await db.exec(`SET request.jwt.claims = '{"sub": "${ID_OUTRA_CLINICA}", "role": "authenticated"}';`);
  const resFilaB = await db.query<any>(`
    SELECT public.enfileirar_ou_processar_pdf(
      '${CTR_A}',
      '55555555-5555-5555-5555-555555555555',
      NULL,
      '${ID_CLINICA_B}'
    ) as result;
  `);
  // O contrato não pertence à clínica B, deve ser negado ou não encontrado
  assert(resFilaB.rows[0].result.ok === false, 'Usuário de outra clínica não consegue enfileirar contrato alheio');

  // 7.2 Clínica A enfileira seu próprio contrato (Legítimo)
  await db.exec(`SET request.jwt.claims = '{"sub": "${ID_DRA_ROSANGELA}", "role": "authenticated"}';`);
  const resFilaA = await db.query<any>(`
    SELECT public.enfileirar_ou_processar_pdf(
      '${CTR_A}',
      '55555555-5555-5555-5555-555555555555',
      NULL,
      '${ID_CLINICA_A}'
    ) as result;
  `);
  assert(resFilaA.rows[0].result.ok === true, 'Clínica A enfileirou seu contrato com sucesso');

  // 7.3 Simulação de tentativas excessivas (Prevenção de Loop Infinito)
  await db.exec(`UPDATE public.fila_arquivamento_pdf SET tentativas = 5 WHERE contrato_id = '${CTR_A}';`);
  const resLoop = await db.query<any>(`
    SELECT public.enfileirar_ou_processar_pdf('${CTR_A}') as result;
  `);
  assert(resLoop.rows[0].result.ok === false, 'Chamada que excede limite máximo de tentativas é BLOQUEADA');
  assert(resLoop.rows[0].result.code === 'MAX_RETRIES_EXCEEDED', 'Código retornado: MAX_RETRIES_EXCEEDED');

  // 8. Teste do Ponto 6: usuario_possui_perfil_clinica
  console.log(`\n${STEP} 8. Testes na Função usuario_possui_perfil_clinica`);
  // Usuário aleatório não pode consultar o perfil de terceiros
  await db.exec(`SET request.jwt.claims = '{"sub": "${ID_OUTRA_CLINICA}", "role": "authenticated"}';`);
  const resEnum = await db.query<any>(`
    SELECT public.usuario_possui_perfil_clinica('${ID_DRA_ROSANGELA}', '${ID_CLINICA_A}', 'admin') as has_role;
  `);
  assert(resEnum.rows[0].has_role === false, 'Tentativa de enumeração de perfil de terceiro por usuário não-admin retornou false');

  // Própria titular consulta seu perfil
  await db.exec(`SET request.jwt.claims = '{"sub": "${ID_DRA_ROSANGELA}", "role": "authenticated"}';`);
  const resPropria = await db.query<any>(`
    SELECT public.usuario_possui_perfil_clinica('${ID_DRA_ROSANGELA}', '${ID_CLINICA_A}', 'admin') as has_role;
  `);
  assert(resPropria.rows[0].has_role === true, 'Titular consultando seu próprio perfil na clínica retorna true');

  // 9. Teste do Ponto 7: Trigger de Imutabilidade Integral
  console.log(`\n${STEP} 9. Testes no Trigger de Imutabilidade (Proteção Integral do Contrato)`);

  const CTR_ASSINADO = 'CTR-ASSINADO-001';
  const resDocAssinado = await db.query<any>(`
    INSERT INTO public.documentos_clinicos (
      tipo, titulo, identificador, clinica_id, valor_total, conteudo, assinado_em, itens
    ) VALUES (
      'contrato', 'Contrato Formalizado', '${CTR_ASSINADO}', '${ID_CLINICA_A}', 8000.00,
      'Cláusula 1: Procedimentos de Resina...',
      now(),
      '{
        "status": "formalizado",
        "isFormalizadoTotal": true,
        "financeiro": {"valorTotal": 8000.00, "parcelas": 10},
        "itens": [{"nome": "Lentes", "qtd": 10}],
        "paciente": {"nome": "Paciente Protegido"},
        "assinaturaPaciente": {"dataHora": "2026-11-02T10:00:00Z", "assinaturaData": "base64_paciente"},
        "assinaturaDentista": {"dataHora": "2026-11-02T10:00:00Z", "assinaturaData": "base64_dentista"}
      }'::jsonb
    ) RETURNING id;
  `);
  const docId = resDocAssinado.rows[0].id;

  // 9.1 Tentativa maliciosa de adulterar o valor total no banco
  let bloqueouValor = false;
  try {
    await db.exec(`UPDATE public.documentos_clinicos SET valor_total = 2000.00 WHERE id = '${docId}';`);
  } catch (err: any) {
    bloqueouValor = true;
  }
  assert(bloqueouValor, 'Trigger bloqueou tentativa de adulterar valor_total de contrato assinado');

  // 9.2 Tentativa maliciosa de adulterar as parcelas financeiras dentro de itens
  let bloqueouFinanceiro = false;
  try {
    await db.exec(`
      UPDATE public.documentos_clinicos 
      SET itens = jsonb_set(itens, '{financeiro,valorTotal}', '1000.00'::jsonb)
      WHERE id = '${docId}';
    `);
  } catch (err: any) {
    bloqueouFinanceiro = true;
  }
  assert(bloqueouFinanceiro, 'Trigger bloqueou tentativa de adulterar itens->financeiro de contrato assinado');

  // 9.3 Tentativa de substituir ou apagar a assinatura do paciente já colhida
  let bloqueouAssinaturaPac = false;
  try {
    await db.exec(`
      UPDATE public.documentos_clinicos 
      SET itens = jsonb_set(itens, '{assinaturaPaciente,assinaturaData}', '"outra_assinatura"'::jsonb)
      WHERE id = '${docId}';
    `);
  } catch (err: any) {
    bloqueouAssinaturaPac = true;
  }
  assert(bloqueouAssinaturaPac, 'Trigger bloqueou tentativa de adulterar itens->assinaturaPaciente');

  // 9.4 Operação LEGÍTIMA: Atualização do pdf_path pelo arquivador / Storage
  let permitiuPdfPath = false;
  try {
    await db.exec(`
      UPDATE public.documentos_clinicos 
      SET pdf_path = 'contratos/${CTR_ASSINADO}/Contrato_Final.pdf',
          atualizado_em = now()
      WHERE id = '${docId}';
    `);
    permitiuPdfPath = true;
  } catch (err: any) {
    permitiuPdfPath = false;
  }
  assert(permitiuPdfPath, 'Trigger PERMITIU gravação legítima de pdf_path e metadados de arquivamento');

  console.log('\n================================================================');
  console.log(`RESULTADO FINAL: ${passedTests}/${totalTests} TESTES DE BLINDAGEM APROVADOS (100%)`);
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('Falha nos testes de segurança:', err);
  process.exit(1);
});
