-- Drop the UPOS Shop Manager leftover.
UPDATE public.profiles
SET role_id = NULL
WHERE role_id IN (
  SELECT id FROM public.app_roles
  WHERE lower(regexp_replace(name, '[\s_-]+', '', 'g')) = 'shopmanager'
);

DELETE FROM public.app_roles
WHERE lower(regexp_replace(name, '[\s_-]+', '', 'g')) = 'shopmanager';
