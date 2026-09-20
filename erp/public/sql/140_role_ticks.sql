-- Call Center Supervisor (and any job with a seed id like r-cs-…)
-- must live as a real UUID row so Edit Role ticks save to the company book.
-- Safe to re-run.

INSERT INTO public.app_roles (name, description, permissions)
SELECT 'Call Center Supervisor', 'Customer Support — ticks on Edit Role are the gate', '{}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_roles WHERE lower(name) = 'call center supervisor'
);

UPDATE public.app_roles
SET description = COALESCE(description, 'Customer Support — ticks on Edit Role are the gate')
WHERE lower(name) = 'call center supervisor';

-- Point the person in that job at the UUID row.
UPDATE public.profiles p
SET role_id = r.id,
    role = 'Call Center Supervisor',
    role_name = 'Call Center Supervisor',
    dashboard_group = COALESCE(NULLIF(p.dashboard_group, 'hq'), 'office')
FROM public.app_roles r
WHERE lower(r.name) = 'call center supervisor'
  AND (
    lower(COALESCE(p.role, p.role_name, '')) = 'call center supervisor'
    OR p.role_id::text ILIKE 'r-cs-%'
  );

SELECT id, name,
       (SELECT count(*) FROM jsonb_each(permissions) e WHERE e.value = 'true'::jsonb) AS ticks
FROM public.app_roles
WHERE lower(name) IN (
  'call center supervisor', 'accountant', 'sales',
  'founder', 'it director', 'systems developer', 'owner', 'hq admin'
)
ORDER BY name;
