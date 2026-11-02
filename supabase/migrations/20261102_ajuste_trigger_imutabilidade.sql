-- ==============================================================================
-- CORREÇÃO CIRÚRGICA DE PRODUÇÃO: BLINDAGEM DA ASSINATURA DO PACIENTE
-- Data: 2026-11-02
-- Objetivo:
-- 1. Garante que clinica_id e valor_total existam em documentos_clinicos
-- 2. Atualiza o trigger garantir_imutabilidade_contrato_v3 permitindo a
--    transição legítima de contrato pré-assinado pela profissional para assinado pelo paciente
--    (distinguindo corretamente o valor primitivo JSON null do objeto de assinatura)
-- 3. Blinda estritamente imutabilidade de cláusulas, termos financeiros e assinaturas formalizadas
-- ==============================================================================

-- 1. Garante colunas de integridade em documentos_clinicos (não destrutivo, preserva dados legados)
ALTER TABLE public.documentos_clinicos 
  ADD COLUMN IF NOT EXISTS clinica_id uuid;

ALTER TABLE public.documentos_clinicos 
  ADD COLUMN IF NOT EXISTS valor_total numeric;

ALTER TABLE public.documentos_clinicos 
  ADD COLUMN IF NOT EXISTS identificador text;

-- 2. Atualização idempotente do Trigger de Imutabilidade
CREATE OR REPLACE FUNCTION public.garantir_imutabilidade_contrato_v3()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ja_assinado boolean := false;
BEGIN
  -- Se o documento não for do tipo 'contrato', permite a alteração normalmente
  IF OLD.tipo IS DISTINCT FROM 'contrato' THEN
    RETURN NEW;
  END IF;

  -- Reconhecimento de todos os campos de assinatura utilizados pelo sistema
  -- Importante: no PostgreSQL JSONB, '{"campo": null}'::jsonb -> 'campo' IS NOT NULL é TRUE,
  -- portanto verificamos expressamente jsonb_typeof != 'null' para não bloquear contratos pré-assinados
  v_ja_assinado := (
    OLD.assinado_em IS NOT NULL
    OR OLD.assinatura_data IS NOT NULL
    OR (OLD.itens IS NOT NULL AND OLD.itens->'assinaturaPaciente' IS NOT NULL AND jsonb_typeof(OLD.itens->'assinaturaPaciente') != 'null')
    OR (OLD.itens IS NOT NULL AND OLD.itens->'assinaturaDentista' IS NOT NULL AND jsonb_typeof(OLD.itens->'assinaturaDentista') != 'null')
    OR (OLD.itens IS NOT NULL AND OLD.itens->'assinaturaDra' IS NOT NULL AND jsonb_typeof(OLD.itens->'assinaturaDra') != 'null')
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'assinaturaDra' IS NOT NULL)
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'statusAssinaturaPaciente' = 'assinado')
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'isFormalizadoTotal' = 'true')
    OR (OLD.itens IS NOT NULL AND OLD.itens->>'status' IN ('formalizado', 'assinado'))
  );

  -- Se já estiver assinado (ou pré-assinado pela profissional), blinda integralmente a versão contratual aceita
  IF v_ja_assinado THEN
    -- Proíbe alteração de identificador, paciente, criador ou tipo
    IF (NEW.identificador IS DISTINCT FROM OLD.identificador)
       OR ((NEW.itens->>'contratoId') IS DISTINCT FROM (OLD.itens->>'contratoId')) THEN
      RAISE EXCEPTION 'Não é permitido alterar o identificador de um contrato já assinado.';
    END IF;

    IF NEW.paciente_id IS DISTINCT FROM OLD.paciente_id THEN
      RAISE EXCEPTION 'Não é permitido alterar o paciente de um contrato já assinado.';
    END IF;

    IF NEW.tipo IS DISTINCT FROM OLD.tipo THEN
      RAISE EXCEPTION 'Não é permitido alterar o tipo de um contrato já assinado.';
    END IF;

    IF NEW.clinica_id IS DISTINCT FROM OLD.clinica_id THEN
      RAISE EXCEPTION 'Não é permitido transferir a titularidade de clínica de um contrato já assinado.';
    END IF;

    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Não é permitido alterar o criador de um contrato já assinado.';
    END IF;

    -- Proíbe alteração de termos essenciais (conteúdo textual, título e valor total)
    IF NEW.conteudo IS DISTINCT FROM OLD.conteudo THEN
      RAISE EXCEPTION 'Violação de integridade: O conteúdo textual de um contrato assinado é estritamente imutável.';
    END IF;

    IF NEW.titulo IS DISTINCT FROM OLD.titulo THEN
      RAISE EXCEPTION 'Violação de integridade: O título de um contrato assinado é estritamente imutável.';
    END IF;

    IF NEW.valor_total IS DISTINCT FROM OLD.valor_total THEN
      RAISE EXCEPTION 'Violação de integridade: O valor financeiro de um contrato assinado é estritamente imutável.';
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

      -- Permite que o paciente assine pela primeira vez (quando OLD.itens->'assinaturaPaciente' era NULL ou JSON null).
      -- Se já assinado pelo paciente, proíbe modificação da assinatura do paciente.
      IF (OLD.itens->'assinaturaPaciente' IS NOT NULL AND jsonb_typeof(OLD.itens->'assinaturaPaciente') != 'null') 
         AND (NEW.itens->'assinaturaPaciente') IS DISTINCT FROM (OLD.itens->'assinaturaPaciente') THEN
        RAISE EXCEPTION 'Violação de integridade: A assinatura do paciente já formalizada não pode ser modificada.';
      END IF;

      -- Proíbe modificação da assinatura prévia da Dra.
      IF (OLD.itens->'assinaturaDentista' IS NOT NULL AND jsonb_typeof(OLD.itens->'assinaturaDentista') != 'null') 
         AND (NEW.itens->'assinaturaDentista') IS DISTINCT FROM (OLD.itens->'assinaturaDentista') THEN
        RAISE EXCEPTION 'Violação de integridade: A assinatura da profissional já vinculada não pode ser modificada.';
      END IF;

      -- Proteção específica e integral da assinatura histórica da titular (assinaturaDra)
      IF (OLD.itens->'assinaturaDra' IS NOT NULL AND jsonb_typeof(OLD.itens->'assinaturaDra') != 'null') 
         AND (NEW.itens->'assinaturaDra') IS DISTINCT FROM (OLD.itens->'assinaturaDra') THEN
        RAISE EXCEPTION 'Violação de integridade: A assinatura da profissional titular (assinaturaDra) já vinculada não pode ser modificada.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Vinculação idempotente do trigger na tabela documentos_clinicos
DROP TRIGGER IF EXISTS trg_garantir_imutabilidade_contrato_v3 ON public.documentos_clinicos;
CREATE TRIGGER trg_garantir_imutabilidade_contrato_v3
  BEFORE UPDATE ON public.documentos_clinicos
  FOR EACH ROW
  EXECUTE FUNCTION public.garantir_imutabilidade_contrato_v3();
