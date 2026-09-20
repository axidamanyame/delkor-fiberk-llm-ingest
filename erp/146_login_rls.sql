-- Sign-in is Auth. A profiles trigger / policy can still abort it
-- ("Database error granting user") for every account, including CCS.
-- This file: never block Auth, keep application roles on profiles.
-- Run the WHOLE file once.

-- 1) JWT postgres role must be authenticated (not owner / hq_admin / empty).
UPDATE auth.users
SET raw_app_meta_data =
      coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object(
           'role', 'authenticated',
           'provider', coalesce(nullif(raw_app_meta_data->>'provider', ''), 'email'),
           'providers', CASE
             WHEN jsonb_typeof(raw_app_meta_data->'providers') = 'array'
               THEN raw_app_meta_data->'providers'
             ELSE '["email"]'::jsonb
           END
         ),
    banned_until = NULL,
    email_confirmed_at = coalesce(email_confirmed_at, now())
WHERE deleted_at IS NULL;

-- 2) HQ check must NOT read app_metadata.role (that is now "authenticated").
CREATE OR REPLACE FUNCTION public.df_role_key(raw text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(lower(trim(COALESCE(raw, ''))), '[\s_-]+', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.df_is_owner_name(raw text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT public.df_role_key(raw) IN ('owner','founder','partner','superadmin','superadminrole');
$$;

CREATE OR REPLACE FUNCTION public.df_is_hq_name(raw text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT public.df_is_owner_name(raw)
      OR public.df_role_key(raw) IN (
        'hqadmin','admin','hq','systemsdeveloper','systemdeveloper',
        'itdirector','erpadministrator','erpadmin'
      );
$$;

CREATE OR REPLACE FUNCTION public.df_leader_email(raw text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(trim(COALESCE(raw, ''))) IN (
    'dkormla@gmail.com',
    'social.delkorfiberk@gmail.com',
    'bernardfbk@gmail.com',
    'colemanharry600@gmail.com'
  );
$$;

CREATE OR REPLACE FUNCTION public.df_is_hq()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.df_leader_email(coalesce(auth.jwt() ->> 'email', ''))
    OR public.df_is_hq_name(auth.jwt() -> 'user_metadata' ->> 'role')
    OR COALESCE((
      SELECT
        public.df_leader_email(p.email)
        OR public.df_is_hq_name(COALESCE(p.role, p.role_name, p.designation, ''))
        OR lower(COALESCE(p.dashboard_group, p.user_group, '')) IN ('hq','owner','leadership')
      FROM public.profiles p WHERE p.id = auth.uid()
    ), false);
$$;

CREATE OR REPLACE FUNCTION public.df_is_owner()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.df_leader_email(coalesce(auth.jwt() ->> 'email', ''))
    AND public.df_is_owner_name(COALESCE(
      (SELECT COALESCE(p.role, p.role_name, '') FROM public.profiles p WHERE p.id = auth.uid()),
      auth.jwt() -> 'user_metadata' ->> 'role',
      ''
    ))
    OR COALESCE((
      SELECT public.df_is_owner_name(COALESCE(p.role, p.role_name, ''))
          OR (
            public.df_leader_email(p.email)
            AND public.df_is_owner_name(COALESCE(p.role, p.role_name, ''))
          )
      FROM public.profiles p WHERE p.id = auth.uid()
    ), false);
$$;

-- 3) Role-protect trigger must never abort a sign-in or a designation-only save.
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

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE UPDATE OF role, role_id, role_name ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();

-- 4) Auth trigger: create the profile on FIRST signup only.
-- Never throw — that is what blocks every login.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, role_name, allow_login, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    coalesce(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'Pending',
    'Pending',
    true,
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DO $$
BEGIN
  BEGIN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  EXCEPTION WHEN OTHERS THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE PROCEDURE public.handle_new_user();
  END;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- If an older project attached handle_new_user to UPDATE (last_sign_in), drop it.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE n.nspname = 'auth' AND c.relname = 'users' AND NOT t.tgisinternal
      AND p.proname IN ('handle_new_user', 'protect_profile_role')
      AND t.tgname <> 'on_auth_user_created'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users', r.tgname);
  END LOOP;
END $$;

-- 5) Profiles + roles: signed-in people can read their own row; HQ can read all.
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.app_roles TO authenticated, anon;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY df_profiles_read ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.df_is_hq());
CREATE POLICY df_profiles_write ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.df_is_hq());
CREATE POLICY df_profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.df_is_hq())
  WITH CHECK (id = auth.uid() OR public.df_is_hq());
CREATE POLICY df_profiles_delete ON public.profiles
  FOR DELETE TO authenticated
  USING (public.df_is_hq());

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_roles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.app_roles', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY df_app_roles_read ON public.app_roles
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY df_app_roles_write ON public.app_roles
  FOR ALL TO authenticated
  USING (public.df_is_hq())
  WITH CHECK (public.df_is_hq());

GRANT EXECUTE ON FUNCTION public.df_is_hq() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.df_is_owner() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.df_is_hq_name(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.df_is_owner_name(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.df_leader_email(text) TO authenticated, anon;
DO $$
BEGIN
  GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

NOTIFY pgrst, 'reload schema';

-- 6) What Auth still has attached (should only be internal + on_auth_user_created)
SELECT n.nspname AS schema, c.relname AS table, t.tgname, p.proname AS fn
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE n.nspname IN ('auth', 'public') AND c.relname IN ('users', 'profiles')
  AND NOT t.tgisinternal
ORDER BY 1, 2, 3;

SELECT email, raw_app_meta_data->>'role' AS jwt_role, banned_until,
       email_confirmed_at IS NOT NULL AS confirmed
FROM auth.users
ORDER BY email;
