-- Reset the 4 leadership logins to Supabase security classes.
-- UI shows designation (position) only — never Owner / HQ Admin on login or profile.
--
--   social.delkorfiberk@gmail.com  position Founder            security Owner
--   bernardfbk@gmail.com           position Founder            security Owner
--   dkormla@gmail.com              position Systems Developer  security HQ Admin
--   colemanharry600@gmail.com      position IT Director        security HQ Admin
--
-- Run in the Supabase SQL editor. Safe to re-run.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS designation text;

ALTER TABLE public.profiles DISABLE TRIGGER USER;

UPDATE public.profiles
SET dashboard_group = 'hq',
    designation = CASE lower(email)
      WHEN 'social.delkorfiberk@gmail.com' THEN 'Founder'
      WHEN 'bernardfbk@gmail.com' THEN 'Founder'
      WHEN 'dkormla@gmail.com' THEN 'Systems Developer'
      WHEN 'colemanharry600@gmail.com' THEN 'IT Director'
      ELSE designation
    END,
    role = CASE lower(email)
      WHEN 'social.delkorfiberk@gmail.com' THEN 'Owner'
      WHEN 'bernardfbk@gmail.com' THEN 'Owner'
      WHEN 'dkormla@gmail.com' THEN 'HQ Admin'
      WHEN 'colemanharry600@gmail.com' THEN 'HQ Admin'
      ELSE role
    END,
    role_name = CASE lower(email)
      WHEN 'social.delkorfiberk@gmail.com' THEN 'Owner'
      WHEN 'bernardfbk@gmail.com' THEN 'Owner'
      WHEN 'dkormla@gmail.com' THEN 'HQ Admin'
      WHEN 'colemanharry600@gmail.com' THEN 'HQ Admin'
      ELSE COALESCE(role_name, role)
    END
WHERE lower(email) IN (
  'social.delkorfiberk@gmail.com',
  'bernardfbk@gmail.com',
  'dkormla@gmail.com',
  'colemanharry600@gmail.com'
);

INSERT INTO public.app_roles (name, description, permissions)
VALUES
  ('Owner', 'Owner class — not shown on login', '{"*":true}'::jsonb),
  ('HQ Admin', 'Group operator — not shown on login', '{"*":true}'::jsonb)
ON CONFLICT (name) DO UPDATE
  SET permissions = public.app_roles.permissions || EXCLUDED.permissions;

UPDATE public.profiles p
SET role_id = r.id
FROM public.app_roles r
WHERE lower(r.name) = lower(p.role)
  AND lower(p.email) IN (
    'social.delkorfiberk@gmail.com',
    'bernardfbk@gmail.com',
    'dkormla@gmail.com',
    'colemanharry600@gmail.com'
  );

-- Auth metadata: security class + public position.
UPDATE auth.users
SET
  raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'owner'),
  raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'Owner', 'designation', 'Founder')
WHERE lower(email) IN ('social.delkorfiberk@gmail.com', 'bernardfbk@gmail.com');

UPDATE auth.users
SET
  raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'hq_admin'),
  raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'HQ Admin', 'designation', 'Systems Developer')
WHERE lower(email) = 'dkormla@gmail.com';

UPDATE auth.users
SET
  raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'hq_admin'),
  raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'HQ Admin', 'designation', 'IT Director')
WHERE lower(email) = 'colemanharry600@gmail.com';

ALTER TABLE public.profiles ENABLE TRIGGER USER;

-- Confirm
SELECT p.email, p.role AS security_role, p.designation AS position, p.role_name, r.name AS app_role
FROM public.profiles p
LEFT JOIN public.app_roles r ON r.id = p.role_id
WHERE lower(p.email) IN (
  'social.delkorfiberk@gmail.com',
  'bernardfbk@gmail.com',
  'dkormla@gmail.com',
  'colemanharry600@gmail.com'
)
ORDER BY p.email;
