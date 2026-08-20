-- Move internal role-check helper out of the API-exposed schema
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);