-- Update existing profiles only. Never insert (avoids profiles_id_fkey and 409).
-- Run the whole file, green Run.

CREATE OR REPLACE FUNCTION public.df_patch_profile(target uuid, patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result jsonb;
  k text;
  typ text;
  row_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  IF target IS DISTINCT FROM auth.uid() AND NOT public.df_is_hq() THEN
    RAISE EXCEPTION 'Not allowed for %', COALESCE(auth.jwt() ->> 'email', 'unknown');
  END IF;

  BEGIN
    PERFORM set_config('session_replication_role', 'replica', true);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  SELECT p.id INTO row_id FROM public.profiles p WHERE p.id = target;
  IF row_id IS NULL AND NULLIF(patch->>'email','') IS NOT NULL THEN
    SELECT p.id INTO row_id FROM public.profiles p
    WHERE lower(p.email) = lower(patch->>'email')
    LIMIT 1;
  END IF;
  IF row_id IS NULL AND NULLIF(patch->>'email','') IS NOT NULL THEN
    SELECT p.id INTO row_id
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE lower(u.email) = lower(patch->>'email')
    LIMIT 1;
  END IF;

  IF row_id IS NULL THEN
    BEGIN
      PERFORM set_config('session_replication_role', 'origin', true);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN jsonb_build_object('_skipped', true, '_reason', 'no_profile');
  END IF;

  FOR k IN SELECT jsonb_object_keys(patch)
  LOOP
    IF k IN ('id','created_at','updated_at','role_id') THEN CONTINUE; END IF;
    IF k = 'email' AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE lower(p.email) = lower(patch->>'email') AND p.id IS DISTINCT FROM row_id
    ) THEN
      CONTINUE;
    END IF;
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
    EXCEPTION WHEN unique_violation THEN
      NULL;
    WHEN foreign_key_violation THEN
      NULL;
    WHEN OTHERS THEN
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
