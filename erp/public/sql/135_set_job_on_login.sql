-- 1) See the job each login actually has in the company book (not the HQ browser).
SELECT email, full_name, role, role_name, role_id
FROM public.profiles
ORDER BY email;

-- 2) See the Call Center Supervisor row and its tick count.
SELECT id, name,
       (SELECT count(*) FROM jsonb_each(permissions) e WHERE e.value = 'true'::jsonb) AS ticks
FROM public.app_roles
WHERE name ILIKE '%call%center%';

-- 3) After you know the email, run this (edit the email).
-- UPDATE public.profiles
-- SET role = 'Call Center Supervisor',
--     role_name = 'Call Center Supervisor',
--     role_id = (SELECT id FROM public.app_roles WHERE name ILIKE 'Call Center Supervisor' LIMIT 1)
-- WHERE lower(email) = lower('paste-email-here@gmail.com');
