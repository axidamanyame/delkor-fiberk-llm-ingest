-- Tamper lock: anon cannot write. Profiles cannot self-promote.
-- Safe to re-run. Does not drop existing policies.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.app_roles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    CREATE POLICY profiles_select_auth ON public.profiles
      FOR SELECT TO authenticated
      USING (true);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    CREATE POLICY profiles_update_self ON public.profiles
      FOR UPDATE TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    CREATE POLICY profiles_insert_self ON public.profiles
      FOR INSERT TO authenticated
      WITH CHECK (id = auth.uid());
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_ok boolean := false;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.role IS NOT DISTINCT FROM OLD.role
     AND NEW.role_id IS NOT DISTINCT FROM OLD.role_id
     AND NEW.role_name IS NOT DISTINCT FROM OLD.role_name THEN
    RETURN NEW;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.role_name, p.role, '') ~* '(hq|owner|admin)'
      )
  ) INTO actor_ok;
  IF actor_ok THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Role changes must be made by HQ Admin';
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RETURN;
  END IF;
  DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
  CREATE TRIGGER trg_protect_profile_role
    BEFORE UPDATE OF role, role_id, role_name ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_role();
EXCEPTION WHEN undefined_column OR undefined_table THEN
  NULL;
END $$;

DO $$
BEGIN
  IF to_regclass('public.app_roles') IS NULL THEN RETURN; END IF;
  BEGIN
    CREATE POLICY app_roles_select_auth ON public.app_roles
      FOR SELECT TO authenticated USING (true);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    CREATE POLICY app_roles_write_hq ON public.app_roles
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND COALESCE(p.role_name, p.role, '') ~* '(hq|owner|admin)'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND COALESCE(p.role_name, p.role, '') ~* '(hq|owner|admin)'
        )
      );
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
