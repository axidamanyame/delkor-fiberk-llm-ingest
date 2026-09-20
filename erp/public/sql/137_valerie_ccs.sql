INSERT INTO public.app_roles (name, code)
SELECT 'Call Center Supervisor', 'callcentersupervisor'
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_roles
  WHERE lower(regexp_replace(name, '[\s_-]+', '', 'g'))
        IN ('callcentersupervisor', 'callcentresupervisor')
);

ALTER TABLE public.profiles DISABLE TRIGGER USER;

UPDATE public.profiles
SET
  role = 'Call Center Supervisor',
  role_name = 'Call Center Supervisor',
  role_id = (
    SELECT id FROM public.app_roles
    WHERE lower(regexp_replace(name, '[\s_-]+', '', 'g'))
          IN ('callcentersupervisor', 'callcentresupervisor')
    LIMIT 1
  )
WHERE id = 'b5480d35-ce8c-49d9-8d4c-b70fcfda1fa0'
   OR lower(email) = 'valeriemarbell.delkorfiberk@gmail.com'
   OR lower(COALESCE(full_name, '')) LIKE '%marbell%';

ALTER TABLE public.profiles ENABLE TRIGGER USER;

SELECT email, full_name, role, role_name
FROM public.profiles
WHERE id = 'b5480d35-ce8c-49d9-8d4c-b70fcfda1fa0'
   OR lower(email) = 'valeriemarbell.delkorfiberk@gmail.com'
   OR lower(COALESCE(full_name, '')) LIKE '%marbell%';
