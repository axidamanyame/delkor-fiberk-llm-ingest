-- Leadership can save other people. Run the WHOLE file (green Run), not Save.
-- Then in SQL:  select auth.jwt()->>'email', public.df_is_hq();
-- You want a true on the second column.

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
    public.df_leader_email(auth.jwt() ->> 'email')
    OR public.df_is_hq_name(auth.jwt() -> 'user_metadata' ->> 'role')
    OR public.df_is_hq_name(auth.jwt() -> 'app_metadata' ->> 'role')
    OR COALESCE((
      SELECT
        public.df_leader_email(p.email)
        OR public.df_is_hq_name(COALESCE(p.role, p.role_name, ''))
        OR lower(COALESCE(p.dashboard_group, p.user_group, '')) IN ('hq','owner','leadership')
      FROM public.profiles p WHERE p.id = auth.uid()
    ), false);
$$;

CREATE OR REPLACE FUNCTION public.df_is_owner()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.df_leader_email(auth.jwt() ->> 'email')
    AND public.df_is_owner_name(COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', ''))
    OR COALESCE((
      SELECT public.df_is_owner_name(COALESCE(p.role, p.role_name, ''))
          OR public.df_leader_email(p.email)
      FROM public.profiles p WHERE p.id = auth.uid()
    ), false);
$$;

CREATE OR REPLACE FUNCTION public.df_patch_profile(target uuid, patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result jsonb;
  k text;
  typ text;
  auth_id uuid;
  row_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  IF auth.uid() IS DISTINCT FROM target AND NOT public.df_is_hq() THEN
    RAISE EXCEPTION 'Not allowed for %', COALESCE(auth.jwt() ->> 'email', 'unknown');
  END IF;

  BEGIN
    PERFORM set_config('session_replication_role', 'replica', true);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  SELECT u.id INTO auth_id FROM auth.users u WHERE u.id = target;
  IF auth_id IS NULL AND NULLIF(patch->>'email','') IS NOT NULL THEN
    SELECT u.id INTO auth_id FROM auth.users u
    WHERE lower(u.email) = lower(patch->>'email')
    LIMIT 1;
  END IF;

  SELECT p.id INTO row_id FROM public.profiles p WHERE p.id = target;
  IF row_id IS NULL AND auth_id IS NOT NULL THEN
    SELECT p.id INTO row_id FROM public.profiles p WHERE p.id = auth_id;
  END IF;
  IF row_id IS NULL AND NULLIF(patch->>'email','') IS NOT NULL THEN
    SELECT p.id INTO row_id FROM public.profiles p
    WHERE lower(p.email) = lower(patch->>'email')
    LIMIT 1;
  END IF;

  IF row_id IS NULL AND auth_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name, role, role_name)
    VALUES (
      auth_id,
      NULLIF(patch->>'email',''),
      NULLIF(patch->>'full_name',''),
      NULLIF(patch->>'role',''),
      NULLIF(patch->>'role_name','')
    )
    RETURNING id INTO row_id;
  END IF;

  IF row_id IS NULL THEN
    BEGIN
      PERFORM set_config('session_replication_role', 'origin', true);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN jsonb_build_object('_skipped', true, '_reason', 'no_auth_user');
  END IF;

  FOR k IN SELECT jsonb_object_keys(patch)
  LOOP
    IF k IN ('id','created_at','updated_at') THEN CONTINUE; END IF;
    SELECT format_type(a.atttypid, a.atttypmod) INTO typ
    FROM pg_attribute a
    WHERE a.attrelid = 'public.profiles'::regclass
      AND a.attname = k AND a.attnum > 0 AND NOT a.attisdropped;
    IF typ IS NULL THEN CONTINUE; END IF;
    BEGIN
      EXECUTE format(
        'UPDATE public.profiles SET %I = NULLIF($1, '''')::%s WHERE id = $2',
        k, typ
      ) USING patch->>k, row_id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  SELECT to_jsonb(p.*) INTO result FROM public.profiles p WHERE p.id = row_id;

  BEGIN
    PERFORM set_config('session_replication_role', 'origin', true);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.df_patch_profile(uuid, jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';


GRANT EXECUTE ON FUNCTION public.df_role_key(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.df_is_owner_name(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.df_is_hq_name(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.df_leader_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.df_is_hq() TO authenticated;
GRANT EXECUTE ON FUNCTION public.df_is_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.df_patch_profile(uuid, jsonb) TO authenticated;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

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

NOTIFY pgrst, 'reload schema';
