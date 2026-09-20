-- Unbind Valerie from Manager/Admin token + id, bind only Call Center Supervisor.
-- Paste in Supabase, Run.

INSERT INTO public.app_roles (name, code, permissions)
SELECT 'Call Center Supervisor', 'callcentersupervisor', '{}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_roles
  WHERE name ILIKE 'Call Center Supervisor'
);

UPDATE public.app_roles
SET permissions = '{}'::jsonb
WHERE name ILIKE 'Call Center Supervisor';

ALTER TABLE public.profiles DISABLE TRIGGER USER;

UPDATE public.profiles
SET
  role = 'Call Center Supervisor',
  role_name = 'Call Center Supervisor',
  role_id = (SELECT id FROM public.app_roles WHERE name ILIKE 'Call Center Supervisor' LIMIT 1),
  dashboard_group = NULL
WHERE lower(email) = 'valeriemarbell.delkorfiberk@gmail.com';

ALTER TABLE public.profiles ENABLE TRIGGER USER;

UPDATE auth.users
SET
  raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'Call Center Supervisor'),
  raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    - 'role'
WHERE lower(email) = 'valeriemarbell.delkorfiberk@gmail.com';

SELECT
  p.email,
  p.role,
  p.role_name,
  p.role_id,
  r.name AS role_row,
  r.permissions,
  u.raw_user_meta_data ->> 'role' AS token_role,
  u.raw_app_meta_data ->> 'role' AS app_role
FROM public.profiles p
LEFT JOIN public.app_roles r ON r.id = p.role_id
LEFT JOIN auth.users u ON u.id = p.id
WHERE lower(p.email) = 'valeriemarbell.delkorfiberk@gmail.com';
