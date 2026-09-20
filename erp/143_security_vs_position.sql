-- Security class vs position (one run).
-- role / role_name = Owner or HQ Admin (Supabase only, not shown on login).
-- designation     = Founder / Systems Developer / IT Director (what people see).
--
--   social.delkorfiberk@gmail.com  Founder             Owner
--   bernardfbk@gmail.com           Founder             Owner
--   dkormla@gmail.com              Systems Developer   HQ Admin
--   colemanharry600@gmail.com      IT Director         HQ Admin

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS designation text;
ALTER TABLE public.profiles DISABLE TRIGGER USER;

UPDATE public.profiles
SET
  dashboard_group = 'hq',
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
    ELSE role_name
  END
WHERE lower(email) IN (
  'social.delkorfiberk@gmail.com',
  'bernardfbk@gmail.com',
  'dkormla@gmail.com',
  'colemanharry600@gmail.com'
);

INSERT INTO public.app_roles (name, description, permissions)
VALUES
  ('Owner', 'Security class — not shown on login', '{"*":true,"superadmin.packages":true}'::jsonb),
  ('HQ Admin', 'Security class — not shown on login', '{"*":true}'::jsonb)
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

UPDATE auth.users
SET
  raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'owner'),
  raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'Owner', 'designation', 'Founder')
WHERE lower(email) IN ('social.delkorfiberk@gmail.com', 'bernardfbk@gmail.com');

UPDATE auth.users
SET
  raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'hq_admin'),
  raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'HQ Admin', 'designation', 'Systems Developer')
WHERE lower(email) = 'dkormla@gmail.com';

UPDATE auth.users
SET
  raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'hq_admin'),
  raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'HQ Admin', 'designation', 'IT Director')
WHERE lower(email) = 'colemanharry600@gmail.com';

ALTER TABLE public.profiles ENABLE TRIGGER USER;

SELECT email, full_name,
       role AS security_role,
       designation AS position,
       role_name
FROM public.profiles
ORDER BY email;
