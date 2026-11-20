-- Migration: Corrigir Foreign Key de tratamentos_procedimentos para CASCADE
-- Data: 2026-11-20
-- Problema: A foreign key tratamentos_procedimentos_orcamento_id_fkey foi criada com ON DELETE RESTRICT,
-- impedindo a exclusão administrativa legítima de orçamentos (erro violates foreign key constraint).
-- Solução: Alterar a constraint para ON DELETE CASCADE.

ALTER TABLE public.tratamentos_procedimentos
    DROP CONSTRAINT IF EXISTS tratamentos_procedimentos_orcamento_id_fkey;

ALTER TABLE public.tratamentos_procedimentos
    ADD CONSTRAINT tratamentos_procedimentos_orcamento_id_fkey
    FOREIGN KEY (orcamento_id) REFERENCES public.orcamentos(id)
    ON DELETE CASCADE;

COMMENT ON CONSTRAINT tratamentos_procedimentos_orcamento_id_fkey ON public.tratamentos_procedimentos 
IS 'Permite exclusão em cascata das etapas do tratamento ao remover orçamento';
