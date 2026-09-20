-- Store "Modules this role can see" on the role row so every machine
-- (not only the HQ browser) hides unticked colour modules.
ALTER TABLE public.app_roles ADD COLUMN IF NOT EXISTS module_flags jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS module_flags jsonb DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
