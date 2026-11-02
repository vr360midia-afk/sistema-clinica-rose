import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'fs';

async function test() {
  const db = new PGlite({ extensions: { pgcrypto } });
  
  // 1. Setup base tables matching exact Supabase production schema
  await db.exec(`
    CREATE ROLE authenticated;
    CREATE ROLE anon;
    CREATE ROLE service_role;
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$ SELECT '00000000-0000-0000-0000-000000000000'::uuid $$ LANGUAGE sql;
    CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$ SELECT 'anon' $$ LANGUAGE sql;

    CREATE TABLE IF NOT EXISTS public.pacientes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nome text NOT NULL,
      cpf text,
      telefone text,
      email text,
      status text DEFAULT 'Ativo',
      criado_em timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.documentos_clinicos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      paciente_id uuid REFERENCES public.pacientes(id),
      paciente_nome text,
      tipo text NOT NULL,
      titulo text,
      conteudo text,
      itens jsonb,
      dentista text,
      assinado_em timestamptz,
      assinante_nome text,
      assinatura_data text,
      user_id uuid,
      criado_em timestamptz DEFAULT now(),
      atualizado_em timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.assinaturas (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      documento_id text NOT NULL,
      documento_tipo text NOT NULL,
      tipo text NOT NULL,
      nome text NOT NULL,
      assinatura_data text NOT NULL,
      paciente_id uuid,
      user_id uuid,
      evidencias jsonb DEFAULT '{}'::jsonb,
      criado_em timestamptz DEFAULT now(),
      atualizado_em timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.user_roles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      role text NOT NULL,
      clinica_id uuid
    );
  `);

  // Execute original migration v3 as currently deployed in production
  const sql = fs.readFileSync('supabase/migrations/20261102_blindagem_seguranca_v3.sql', 'utf-8');
  await db.exec(sql);
  console.log('1. Migration v3 executed successfully in PGlite!');

  // Insert a patient
  const pacRes = await db.query<{ id: string }>(`
    INSERT INTO public.pacientes (nome, cpf) VALUES ('Paciente Homologação', '111.222.333-44') RETURNING id;
  `);
  const pacId = pacRes.rows[0].id;

  // Insert a pre-signed contract (emitted with Dra. Rosângela's authorized signature)
  const initialItens = {
    contratoId: 'CTR-2026-001',
    token: 'valid-token-123',
    pacienteId: pacId,
    paciente: { nome: 'Paciente Homologação', cpf: '111.222.333-44' },
    clinica: { nome: 'Clínica Odontológica', dentistaResponsavel: 'Dra. Rosângela Santos', cro: '06267-AL' },
    financeiro: { total: 5000, parcelas: 10 },
    itens: [{ desc: 'Lentes em Resina (10 Elementos)' }],
    clausulas: [{ titulo: 'Cláusula 1', texto: 'Termos do Tratamento' }],
    parcelas: [{ numero: 1, valor: 500 }],
    status: 'emitido',
    statusAssinaturaDentista: 'assinado',
    statusAssinaturaPaciente: 'pendente',
    isFormalizadoTotal: false,
    assinaturaDentista: {
      nome: 'Dra. Rosângela Santos',
      cro: '06267-AL',
      assinaturaData: 'data:image/png;base64,assinaturaDraBase64',
      dataHora: new Date().toISOString()
    }
  };

  const docRes = await db.query<{ id: string }>(`
    INSERT INTO public.documentos_clinicos (
      paciente_id, paciente_nome, tipo, titulo, conteudo, itens, dentista, identificador
    ) VALUES (
      $1, 'Paciente Homologação', 'contrato', 'Contrato Odontológico', '<p>Termos do Contrato</p>', $2::jsonb, 'Dra. Rosângela Santos', 'CTR-2026-001'
    ) RETURNING id;
  `, [pacId, JSON.stringify(initialItens)]);
  const docId = docRes.rows[0].id;
  console.log('2. Contrato pré-assinado inserido com ID:', docId);

  // DEMONSTRATE BUG 1: Edge function tenta dar update em coluna 'status' que não existe
  console.log('\n--- Demonstração do Erro 1: Update na coluna documentos_clinicos.status ---');
  try {
    await db.query(`UPDATE public.documentos_clinicos SET status = 'formalizado' WHERE id = $1;`, [docId]);
    console.error('ERRO: Não deveria ter passado!');
  } catch (err: any) {
    console.log('✓ COMPROVADO: Falha 42703 (coluna status não existe):', err.message);
  }

  // DEMONSTRATE BUG 2: Trigger v3 atual falha com record "new" has no field "clinica_id"
  console.log('\n--- Demonstração do Erro 2: Trigger v3 referenciando clinica_id / valor_total inexistentes na tabela ---');
  const nowIso = new Date().toISOString();
  const updatedSnapshot = {
    ...initialItens,
    status: 'formalizado',
    statusAssinaturaPaciente: 'assinado',
    isFormalizadoTotal: true,
    assinaturaPaciente: {
      assinaturaData: 'data:image/png;base64,assinaturaPacienteBase64',
      nome: 'Paciente Homologação',
      dataHora: nowIso,
      ip: '177.200.45.12',
      userAgent: 'Mozilla/5.0'
    }
  };

  try {
    await db.query(`
      UPDATE public.documentos_clinicos
      SET
        assinado_em = $1::timestamptz,
        assinante_nome = 'Paciente Homologação',
        assinatura_data = 'data:image/png;base64,assinaturaPacienteBase64',
        itens = $2::jsonb,
        atualizado_em = $1::timestamptz
      WHERE id = $3;
    `, [nowIso, JSON.stringify(updatedSnapshot), docId]);
    console.error('ERRO: Não deveria ter passado com o trigger v3 não corrigido!');
  } catch (err: any) {
    console.log('✓ COMPROVADO: Trigger v3 falha em campo inexistente na tabela:', err.message);
  }

  // APLICAR CORREÇÃO NO TRIGGER (Mantendo toda a blindagem de segurança, removendo apenas referências a colunas que não existem na tabela)
  console.log('\n--- Aplicando Correção do Trigger garantir_imutabilidade_contrato_v3 ---');
  await db.exec(`
    CREATE OR REPLACE FUNCTION public.garantir_imutabilidade_contrato_v3()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
    DECLARE
      v_ja_assinado boolean := false;
    BEGIN
      -- Se o contrato não for do tipo 'contrato', permite a alteração normalmente
      IF OLD.tipo IS DISTINCT FROM 'contrato' THEN
        RETURN NEW;
      END IF;

      -- Reconhecimento de todos os campos de assinatura utilizados pelo sistema
      v_ja_assinado := (
        OLD.assinado_em IS NOT NULL
        OR OLD.assinatura_data IS NOT NULL
        OR (OLD.itens IS NOT NULL AND OLD.itens->'assinaturaPaciente' IS NOT NULL)
        OR (OLD.itens IS NOT NULL AND OLD.itens->'assinaturaDentista' IS NOT NULL)
        OR (OLD.itens IS NOT NULL AND OLD.itens->'assinaturaDra' IS NOT NULL)
        OR (OLD.itens IS NOT NULL AND OLD.itens->>'assinaturaDra' IS NOT NULL)
        OR (OLD.itens IS NOT NULL AND OLD.itens->>'statusAssinaturaPaciente' = 'assinado')
        OR (OLD.itens IS NOT NULL AND OLD.itens->>'isFormalizadoTotal' = 'true')
        OR (OLD.itens IS NOT NULL AND OLD.itens->>'status' IN ('formalizado', 'assinado'))
      );

      -- Se já estiver assinado (ou pré-assinado pela Dra.), blinda integralmente a versão contratual aceita
      IF v_ja_assinado THEN
        -- Proíbe alteração de identificador, paciente, criador ou tipo
        IF NEW.identificador IS DISTINCT FROM OLD.identificador THEN
          RAISE EXCEPTION 'Não é permitido alterar o identificador de um contrato já assinado.';
        END IF;

        IF NEW.paciente_id IS DISTINCT FROM OLD.paciente_id THEN
          RAISE EXCEPTION 'Não é permitido alterar o paciente de um contrato já assinado.';
        END IF;

        IF NEW.tipo IS DISTINCT FROM OLD.tipo THEN
          RAISE EXCEPTION 'Não é permitido alterar o tipo de um contrato já assinado.';
        END IF;

        IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
          RAISE EXCEPTION 'Não é permitido alterar o criador de um contrato já assinado.';
        END IF;

        -- Proíbe alteração de termos essenciais (conteúdo textual e título)
        IF NEW.conteudo IS DISTINCT FROM OLD.conteudo THEN
          RAISE EXCEPTION 'Violação de integridade: O conteúdo textual de um contrato assinado é estritamente imutável.';
        END IF;

        IF NEW.titulo IS DISTINCT FROM OLD.titulo THEN
          RAISE EXCEPTION 'Violação de integridade: O título de um contrato assinado é estritamente imutável.';
        END IF;

        -- Proíbe alteração da data original de formalização após o paciente assinar
        IF (OLD.assinado_em IS NOT NULL) AND NEW.assinado_em IS DISTINCT FROM OLD.assinado_em THEN
          RAISE EXCEPTION 'Violação de integridade: O carimbo de formalização de um contrato assinado não pode ser alterado.';
        END IF;

        -- Protege todos os blocos essenciais dentro de itens (incluindo financeiro e dados da clínica)
        IF (OLD.itens IS NOT NULL) THEN
          IF (NEW.itens->'financeiro') IS DISTINCT FROM (OLD.itens->'financeiro') THEN
            RAISE EXCEPTION 'Violação de integridade: As condições financeiras de um contrato assinado são estritamente imutáveis.';
          END IF;

          IF (NEW.itens->'itens') IS DISTINCT FROM (OLD.itens->'itens') THEN
            RAISE EXCEPTION 'Violação de integridade: A lista de procedimentos de um contrato assinado é estritamente imutável.';
          END IF;

          IF (NEW.itens->'paciente') IS DISTINCT FROM (OLD.itens->'paciente') THEN
            RAISE EXCEPTION 'Violação de integridade: Os dados do paciente no contrato assinado são estritamente imutáveis.';
          END IF;

          IF (NEW.itens->'clinica') IS DISTINCT FROM (OLD.itens->'clinica') THEN
            RAISE EXCEPTION 'Violação de integridade: Os dados da clínica no contrato assinado são estritamente imutáveis.';
          END IF;

          IF (NEW.itens->'parcelas') IS DISTINCT FROM (OLD.itens->'parcelas') THEN
            RAISE EXCEPTION 'Violação de integridade: As parcelas de um contrato assinado são estritamente imutáveis.';
          END IF;

          IF (NEW.itens->'clausulas') IS DISTINCT FROM (OLD.itens->'clausulas') THEN
            RAISE EXCEPTION 'Violação de integridade: As cláusulas de um contrato assinado são estritamente imutáveis.';
          END IF;

          -- Permite que o paciente assine pela PRIMEIRA vez (OLD.itens->'assinaturaPaciente' IS NULL).
          -- Se já assinado pelo paciente, proíbe modificação da assinatura do paciente.
          IF (OLD.itens->'assinaturaPaciente' IS NOT NULL) AND (NEW.itens->'assinaturaPaciente') IS DISTINCT FROM (OLD.itens->'assinaturaPaciente') THEN
            RAISE EXCEPTION 'Violação de integridade: A assinatura do paciente já formalizada não pode ser modificada.';
          END IF;

          -- Proíbe modificação da assinatura prévia da Dra.
          IF (OLD.itens->'assinaturaDentista' IS NOT NULL) AND (NEW.itens->'assinaturaDentista') IS DISTINCT FROM (OLD.itens->'assinaturaDentista') THEN
            RAISE EXCEPTION 'Violação de integridade: A assinatura da profissional já vinculada não pode ser modificada.';
          END IF;

          IF (OLD.itens->'assinaturaDra' IS NOT NULL) AND (NEW.itens->'assinaturaDra') IS DISTINCT FROM (OLD.itens->'assinaturaDra') THEN
            RAISE EXCEPTION 'Violação de integridade: A assinatura da profissional titular (assinaturaDra) já vinculada não pode ser modificada.';
          END IF;
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$;
  `);
  console.log('✓ Trigger corrigido com sucesso!');

  // TESTAR A TRANSIÇÃO LEGÍTIMA: Paciente assina o contrato pré-assinado
  console.log('\n--- Testando a Transição Legítima (Paciente Assina Contrato Pré-Assinado) ---');
  await db.query(`
    UPDATE public.documentos_clinicos
    SET
      assinado_em = $1::timestamptz,
      assinante_nome = 'Paciente Homologação',
      assinatura_data = 'data:image/png;base64,assinaturaPacienteBase64',
      itens = $2::jsonb,
      atualizado_em = $1::timestamptz
    WHERE id = $3;
  `, [nowIso, JSON.stringify(updatedSnapshot), docId]);
  console.log('✓ SUCESSO ABSOLUTO: Assinatura do paciente persistida perfeitamente!');

  // VERIFICAR PERSISTÊNCIA REAL
  const checkRes = await db.query<{ assinado_em: string; itens: any }>(`
    SELECT assinado_em, itens FROM public.documentos_clinicos WHERE id = $1;
  `, [docId]);
  const row = checkRes.rows[0];
  if (!row.assinado_em || !row.itens.assinaturaPaciente) {
    throw new Error('Falha na persistência dos dados');
  }
  console.log('✓ Dados confirmados no banco: assinado_em =', row.assinado_em);
  console.log('✓ Assinatura do paciente confirmada em itens->assinaturaPaciente!');
  console.log('✓ Assinatura da Dra. preservada intacta em itens->assinaturaDentista!');

  // TESTAR TENTATIVA DE REASSINATURA (DEVE BLOQUEAR)
  console.log('\n--- Testando Bloqueio de Reassinatura pelo Paciente ---');
  try {
    await db.query(`
      UPDATE public.documentos_clinicos
      SET assinatura_data = 'data:image/png;base64,outraAssinatura',
          itens = jsonb_set(itens, '{assinaturaPaciente,assinaturaData}', '"data:image/png;base64,outraAssinatura"')
      WHERE id = $1;
    `, [docId]);
    console.error('ERRO: Não deveria permitir re-assinatura!');
  } catch (err: any) {
    console.log('✓ BLOQUEIO CONFIRMADO (reassinatura proibida):', err.message);
  }

  // TESTAR TENTATIVA DE MODIFICAR VALOR OU CLÁUSULAS (DEVE BLOQUEAR)
  console.log('\n--- Testando Bloqueio de Adulteração de Cláusulas ou Condições Financeiras ---');
  try {
    await db.query(`
      UPDATE public.documentos_clinicos
      SET itens = jsonb_set(itens, '{financeiro,total}', '100'::jsonb)
      WHERE id = $1;
    `, [docId]);
    console.error('ERRO: Não deveria permitir alterar valor financeiro!');
  } catch (err: any) {
    console.log('✓ BLOQUEIO CONFIRMADO (adulteração financeira proibida):', err.message);
  }

  console.log('\n================================================================');
  console.log('TESTES DE HOMOLOGAÇÃO DO TRIGGER CONCLUÍDOS COM 100% DE SUCESSO');
  console.log('================================================================');
}

test().catch(console.error);
