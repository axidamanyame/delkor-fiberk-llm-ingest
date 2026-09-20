-- Remove UPOS Manager/Admin leftover and put Valerie on Call Center Supervisor.
-- Run the whole file (green Run).

INSERT INTO public.app_roles (name, code)
SELECT 'Call Center Supervisor', 'callcentersupervisor'
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_roles
  WHERE lower(regexp_replace(name, '[\s_-]+', '', 'g')) IN ('callcentersupervisor','callcentresupervisor')
);

ALTER TABLE public.profiles DISABLE TRIGGER USER;

UPDATE public.profiles
SET
  role = 'Call Center Supervisor',
  role_name = 'Call Center Supervisor',
  role_id = (
    SELECT id FROM public.app_roles
    WHERE lower(regexp_replace(name, '[\s_-]+', '', 'g')) IN ('callcentersupervisor','callcentresupervisor')
    LIMIT 1
  )
WHERE id = 'b5480d35-ce8c-49d9-8d4c-b70fcfda1fa0'
   OR lower(COALESCE(full_name, '')) LIKE '%marbell%'
   OR lower(COALESCE(full_name, '')) LIKE '%valerie%naa%';

UPDATE public.profiles p
SET
  role = COALESCE((
    SELECT r.name FROM public.app_roles r
    WHERE r.id = p.role_id
       OR lower(r.name) = lower(COALESCE(p.role_name, p.role, ''))
    LIMIT 1
  ), p.role_name, p.role),
  role_name = COALESCE((
    SELECT r.name FROM public.app_roles r
    WHERE r.id = p.role_id
       OR lower(r.name) = lower(COALESCE(p.role_name, p.role, ''))
    LIMIT 1
  ), p.role_name, p.role)
WHERE lower(regexp_replace(COALESCE(p.role, p.role_name, ''), '[\s_-]+', '', 'g'))
  IN ('manager','admin','shopmanager','superadmin');

DELETE FROM public.app_roles
WHERE lower(regexp_replace(name, '[\s_-]+', '', 'g'))
  IN ('manager','admin','shopmanager','superadmin','storekeeper','waiter','cook','chef','demo','tables');

ALTER TABLE public.profiles ENABLE TRIGGER USER;

SELECT email, full_name, role, role_name FROM public.profiles
WHERE id = 'b5480d35-ce8c-49d9-8d4c-b70fcfda1fa0'
   OR lower(COALESCE(full_name, '')) LIKE '%marbell%'
   OR lower(COALESCE(full_name, '')) LIKE '%valerie%';
