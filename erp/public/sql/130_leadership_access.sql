-- Leadership access in the database (not only the UI).
-- Founder / Owner / Partner = owner class.
-- HQ Admin / Systems Developer / IT Director = HQ class.
-- Safe to re-run in the Supabase SQL editor.
--
-- Order matters: replace the old "HQ Admin" trigger FIRST, then update rows.
-- The SQL editor has no auth.uid(), so that path must pass.

CREATE OR REPLACE FUNCTION public.df_role_key(raw text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(lower(trim(COALESCE(raw, ''))), '[\s_-]+', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.df_is_owner_name(raw text)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT public.df_role_key(raw) IN (
    'owner', 'founder', 'partner', 'superadmin', 'superadminrole'
  );
$$;

CREATE OR REPLACE FUNCTION public.df_is_hq_name(raw text)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT public.df_is_owner_name(raw)
      OR public.df_role_key(raw) IN (
        'hqadmin', 'admin', 'hq',
        'systemsdeveloper', 'systemdeveloper', 'itdirector',
        'erpadministrator', 'erpadmin'
      );
$$;

CREATE OR REPLACE FUNCTION public.df_my_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT COALESCE(p.role, p.role_name, '') FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1),
    COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', ''),
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '')
  );
$$;

CREATE OR REPLACE FUNCTION public.df_is_owner()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.df_is_owner_name(public.df_my_role());
$$;

CREATE OR REPLACE FUNCTION public.df_is_hq()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT
      public.df_is_hq_name(COALESCE(p.role, p.role_name, ''))
      OR lower(COALESCE(p.dashboard_group, p.user_group, '')) IN ('hq', 'owner', 'leadership')
    FROM public.profiles p WHERE p.id = auth.uid()
  ), public.df_is_hq_name(public.df_my_role()));
$$;

CREATE OR REPLACE FUNCTION public.current_permissions()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(r.permissions, '{}'::jsonb)
  FROM public.profiles p
  LEFT JOIN public.app_roles r ON r.id = p.role_id OR lower(r.name) = lower(COALESCE(p.role, ''))
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_perm(perm text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.df_is_hq() THEN true
    ELSE COALESCE((public.current_permissions() ->> perm)::boolean, false)
      OR COALESCE((public.current_permissions() ->> '*')::boolean, false)
  END;
$$;

GRANT EXECUTE ON FUNCTION public.df_role_key(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.df_is_owner_name(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.df_is_hq_name(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.df_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.df_is_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.df_is_hq() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_perm(text) TO authenticated;

-- Replace the old guard BEFORE any profile UPDATE.
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND COALESCE(NEW.role, '') IS NOT DISTINCT FROM COALESCE(OLD.role, '')
     AND COALESCE(NEW.role_name, '') IS NOT DISTINCT FROM COALESCE(OLD.role_name, '')
     AND COALESCE(NEW.role_id::text, '') IS NOT DISTINCT FROM COALESCE(OLD.role_id::text, '') THEN
    RETURN NEW;
  END IF;
  IF public.df_is_hq() OR public.df_is_owner() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.id = auth.uid() THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Role changes must be made by Founder, Owner or HQ Admin';
END;
$$;

ALTER TABLE public.profiles DISABLE TRIGGER USER;

UPDATE public.profiles
SET dashboard_group = 'hq',
    role = CASE lower(email)
      WHEN 'social.delkorfiberk@gmail.com' THEN 'Founder'
      WHEN 'bernardfbk@gmail.com' THEN 'Founder'
      WHEN 'dkormla@gmail.com' THEN 'Systems Developer'
      WHEN 'colemanharry600@gmail.com' THEN 'IT Director'
      ELSE role
    END,
    role_name = CASE lower(email)
      WHEN 'social.delkorfiberk@gmail.com' THEN 'Founder'
      WHEN 'bernardfbk@gmail.com' THEN 'Founder'
      WHEN 'dkormla@gmail.com' THEN 'Systems Developer'
      WHEN 'colemanharry600@gmail.com' THEN 'IT Director'
      ELSE COALESCE(role_name, role)
    END
WHERE lower(email) IN (
  'social.delkorfiberk@gmail.com',
  'bernardfbk@gmail.com',
  'dkormla@gmail.com',
  'colemanharry600@gmail.com'
);

UPDATE public.profiles
SET dashboard_group = 'hq'
WHERE public.df_is_hq_name(COALESCE(role, role_name, ''));

INSERT INTO public.app_roles (name, description, permissions)
VALUES
  ('Founder', 'Owner class', '{"*":true}'::jsonb),
  ('Owner', 'Owner class', '{"*":true}'::jsonb),
  ('HQ Admin', 'Group operator', '{"*":true}'::jsonb),
  ('Systems Developer', 'HQ class', '{"*":true}'::jsonb),
  ('IT Director', 'HQ class', '{"*":true}'::jsonb)
ON CONFLICT (name) DO UPDATE
  SET permissions = public.app_roles.permissions || EXCLUDED.permissions;

UPDATE public.profiles p
SET role_id = r.id
FROM public.app_roles r
WHERE lower(r.name) = lower(COALESCE(p.role, p.role_name, ''))
  AND lower(p.email) IN (
    'social.delkorfiberk@gmail.com',
    'bernardfbk@gmail.com',
    'dkormla@gmail.com',
    'colemanharry600@gmail.com'
  );

ALTER TABLE public.profiles ENABLE TRIGGER USER;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS df_profiles_self ON public.profiles;
DROP POLICY IF EXISTS df_profiles_all ON public.profiles;
DROP POLICY IF EXISTS df_profiles_read ON public.profiles;
DROP POLICY IF EXISTS df_profiles_write ON public.profiles;
DROP POLICY IF EXISTS df_profiles_update ON public.profiles;
DROP POLICY IF EXISTS df_profiles_delete ON public.profiles;
CREATE POLICY df_profiles_read ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.df_is_hq());
CREATE POLICY df_profiles_write ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.df_is_hq());
CREATE POLICY df_profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.df_is_hq())
  WITH CHECK (id = auth.uid() OR public.df_is_hq());
CREATE POLICY df_profiles_delete ON public.profiles
  FOR DELETE TO authenticated
  USING (public.df_is_hq());

ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_roles_select ON public.app_roles;
DROP POLICY IF EXISTS app_roles_write ON public.app_roles;
CREATE POLICY app_roles_select ON public.app_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY app_roles_write ON public.app_roles
  FOR ALL TO authenticated
  USING (public.df_is_hq())
  WITH CHECK (public.df_is_hq());

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
DROP TRIGGER IF EXISTS protect_profile_role ON public.profiles;
CREATE TRIGGER protect_profile_role
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

NOTIFY pgrst, 'reload schema';
