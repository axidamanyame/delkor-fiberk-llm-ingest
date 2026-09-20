-- One run. Removes test logins (fake emails, no Auth user) and the leftover
-- Accountant / Sales seed jobs. Does not touch the four real accounts.
--
-- Keep:
--   social.delkorfiberk@gmail.com
--   bernardfbk@gmail.com
--   dkormla@gmail.com
--   colemanharry600@gmail.com

ALTER TABLE public.profiles DISABLE TRIGGER USER;

CREATE TEMP TABLE keep_email (email text PRIMARY KEY);
INSERT INTO keep_email(email) VALUES
  ('social.delkorfiberk@gmail.com'),
  ('bernardfbk@gmail.com'),
  ('dkormla@gmail.com'),
  ('colemanharry600@gmail.com');

CREATE TEMP TABLE drop_email AS
SELECT p.id, p.email, p.full_name, p.role, p.role_name
FROM public.profiles p
WHERE lower(coalesce(p.email, '')) NOT IN (SELECT email FROM keep_email)
  AND (
    lower(p.email) IN (
      'hr@delkor-fiberk.com',
      'accounts@delkor-fiberk.com',
      'ama.mensah@fiberk.com',
      'kojo.owusu@fiberk.com',
      'efua.boateng@axidigetek.com',
      'yaw.asante@delkor.com',
      'akosua.darko@bnpl.com',
      'kofi.asante@axidigetek.com',
      'ama.serwaa@fiberk.com',
      'finance@delkorfiberk.com',
      'hq@delkor-fiberk.com'
    )
    OR p.email ~* '@(fiberk\.com|delkor-fiberk\.com|axidigetek\.com|bnpl\.com|delkor\.com)$'
    OR (
      p.email ~* '@(fiberk|delkor-fiberk|axidigetek|bnpl|delkor)'
      AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
    )
  );

-- Who is leaving (result set 1)
SELECT * FROM drop_email ORDER BY email;

DELETE FROM public.profiles
WHERE id IN (SELECT id FROM drop_email);

DELETE FROM auth.users
WHERE id IN (SELECT id FROM drop_email)
   OR lower(email) IN (SELECT lower(email) FROM drop_email);

UPDATE public.profiles
SET role_id = NULL
WHERE role_id IN (SELECT id FROM public.app_roles WHERE lower(name) IN ('accountant', 'sales'));

DELETE FROM public.app_roles
WHERE lower(name) IN ('accountant', 'sales');

UPDATE public.app_roles
SET permissions = '{"*": true, "superadmin.packages": true}'::jsonb
WHERE lower(name) = 'owner'
  AND (permissions IS NULL OR permissions = '{}'::jsonb);

ALTER TABLE public.profiles ENABLE TRIGGER USER;

DROP TABLE drop_email;
DROP TABLE keep_email;

-- Who remains (result set 2)
SELECT email, full_name, role, role_name, designation
FROM public.profiles
ORDER BY email;
