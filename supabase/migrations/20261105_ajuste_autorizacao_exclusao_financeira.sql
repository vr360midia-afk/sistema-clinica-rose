-- =============================================================================
-- Migration: Ajuste de Autorização para Exclusão e Cancelamento Financeiro
-- Data: 05/11/2026
-- Objetivo: Garantir que titulares e administradores da clínica com permissões
-- de gestão (configurações + financeiro) ou perfis administrativos possam executar
-- exclusões e cancelamentos legítimos, mantendo bloqueio irrestrito para usuários
-- anônimos e membros operacionais não-administradores.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.usuario_is_admin_clinica(p_clinica_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Se o chamador é o titular/dono da clínica do registro (p_clinica_id = auth.uid())
  IF p_clinica_id IS NOT NULL AND v_caller = p_clinica_id THEN
    RETURN true;
  END IF;

  -- 2. Se o chamador é o próprio titular da clínica ativa (clinica_id = auth.uid())
  IF v_caller = public.clinica_id() THEN
    RETURN true;
  END IF;

  -- 3. Se possui role = 'admin' em user_roles
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_caller
      AND lower(ur.role) = 'admin'
      AND (p_clinica_id IS NULL OR ur.clinica_id IS NULL OR ur.clinica_id = p_clinica_id)
  ) THEN
    RETURN true;
  END IF;

  -- 4. Se possui autorização administrativa explícita em equipe
  -- (Acesso operacional a configurações ou financeiro NÃO concede autorização administrativa)
  IF EXISTS (
    SELECT 1 FROM public.equipe eq
    WHERE eq.usuario_id = v_caller
      AND (p_clinica_id IS NULL OR eq.clinica_id = p_clinica_id OR eq.clinica_id = public.clinica_id())
      AND (
        lower(coalesce(eq.permissoes->>'role', '')) = 'admin'
        OR (eq.permissoes->>'admin')::boolean = true
        OR (eq.permissoes->>'exclusao_financeira')::boolean = true
        OR (eq.permissoes->>'admin_financeiro')::boolean = true
      )
  ) THEN
    RETURN true;
  END IF;

  -- 5. Se é titular registrado na tabela configuracoes
  IF EXISTS (
    SELECT 1 FROM public.configuracoes c
    WHERE c.user_id = v_caller
      AND (p_clinica_id IS NULL OR c.user_id = p_clinica_id OR c.user_id = public.clinica_id())
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Permissões de execução seguras
REVOKE ALL ON FUNCTION public.usuario_is_admin_clinica(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.usuario_is_admin_clinica(uuid) TO authenticated;

-- Notifica PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';
