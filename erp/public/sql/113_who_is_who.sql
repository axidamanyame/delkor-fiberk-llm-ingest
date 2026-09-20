-- Leadership jobs on the four live logins.
-- Supabase → SQL Editor → New query → paste → Run.
-- Auth users have no ERP edit screen. This is the place that writes them.

UPDATE auth.users
SET
  raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'role', 'Founder',
      'full_name', coalesce(nullif(raw_user_meta_data->>'full_name', ''), email),
      'email_verified', true
    ),
  raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'founder')
WHERE lower(email) IN (
  'social.delkorfiberk@gmail.com',
  'bernardfbk@gmail.com'
);

UPDATE auth.users
SET
  raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'role', 'Systems Developer',
      'full_name', coalesce(nullif(raw_user_meta_data->>'full_name', ''), 'Delase Kormla'),
      'email_verified', true
    ),
  raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'systems_developer')
WHERE lower(email) = 'dkormla@gmail.com';

UPDATE auth.users
SET
  raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'role', 'IT Director',
      'full_name', coalesce(nullif(raw_user_meta_data->>'full_name', ''), 'Harry Coleman'),
      'email_verified', true
    ),
  raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'it_director')
WHERE lower(email) = 'colemanharry600@gmail.com';

-- ERP profiles (id = auth.users.id)
INSERT INTO public.profiles (id, email, role, role_name, full_name)
SELECT
  u.id,
  u.email,
  CASE
    WHEN lower(u.email) IN ('social.delkorfiberk@gmail.com', 'bernardfbk@gmail.com') THEN 'Founder'
    WHEN lower(u.email) = 'dkormla@gmail.com' THEN 'Systems Developer'
    WHEN lower(u.email) = 'colemanharry600@gmail.com' THEN 'IT Director'
  END,
  CASE
    WHEN lower(u.email) IN ('social.delkorfiberk@gmail.com', 'bernardfbk@gmail.com') THEN 'Founder'
    WHEN lower(u.email) = 'dkormla@gmail.com' THEN 'Systems Developer'
    WHEN lower(u.email) = 'colemanharry600@gmail.com' THEN 'IT Director'
  END,
  coalesce(u.raw_user_meta_data->>'full_name', u.email)
FROM auth.users u
WHERE lower(u.email) IN (
  'social.delkorfiberk@gmail.com',
  'bernardfbk@gmail.com',
  'dkormla@gmail.com',
  'colemanharry600@gmail.com'
)
ON CONFLICT (id) DO UPDATE
SET
  role = EXCLUDED.role,
  role_name = EXCLUDED.role_name;

-- HQ / Founder may edit other people from the ERP Users screen after this.
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN RETURN; END IF;
  BEGIN
    CREATE POLICY profiles_update_hq ON public.profiles
      FOR UPDATE TO authenticated
      USING (
        id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND coalesce(p.role_name, p.role, '')
              ~* '(owner|founder|partner|hq admin|systems developer|it director)'
        )
      )
      WITH CHECK (
        id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND coalesce(p.role_name, p.role, '')
              ~* '(owner|founder|partner|hq admin|systems developer|it director)'
        )
      );
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
      AND coalesce(p.role_name, p.role, '')
        ~* '(owner|founder|partner|hq admin|systems developer|it director|hq)'
  ) INTO actor_ok;
  IF actor_ok THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Role changes must be made by Leadership';
END;
$$;
