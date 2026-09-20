-- Accountant + Sales keep coming back from two places:
--   1) js seed (r-acct, r-accounting, r-sales) merged on every Roles page load
--   2) sql/132_delkor_roles_only.sql INSERT of every Delkor job name
--
-- Owner / HQ Admin are NOT weaker. They use permissions {"*": true}
-- (one key = everything). Accountant 33 and Sales 25 are named keys from seed.
--
-- Run part 1 first (who holds the jobs). Then part 2 if you still want them gone.
-- Do not re-run 132 after this.

-- Part 1 — who is still labelled Accountant or Sales
SELECT id, email, full_name, role, role_name, role_id, designation
FROM public.profiles
WHERE lower(coalesce(role, '')) IN ('accountant', 'sales')
   OR lower(coalesce(role_name, '')) IN ('accountant', 'sales')
   OR role_id IN (
        SELECT id FROM public.app_roles
        WHERE lower(name) IN ('accountant', 'sales')
      )
ORDER BY email;

SELECT id, name,
       (SELECT count(*) FROM jsonb_each(permissions) e WHERE e.value = 'true'::jsonb) AS ticks
FROM public.app_roles
WHERE lower(name) IN ('accountant', 'sales', 'owner', 'hq admin', 'founder');

-- Part 2 — unhook people, then drop the leftover seed jobs.
-- Uncomment after you have read part 1.
/*
UPDATE public.profiles
SET role_id = NULL
WHERE role_id IN (SELECT id FROM public.app_roles WHERE lower(name) IN ('accountant', 'sales'));

DELETE FROM public.app_roles
WHERE lower(name) IN ('accountant', 'sales');

-- Owner should show as * (full access), not a blank tick count.
UPDATE public.app_roles
SET permissions = '{"*": true, "superadmin.packages": true}'::jsonb
WHERE lower(name) = 'owner'
  AND (permissions IS NULL OR permissions = '{}'::jsonb);
*/

SELECT 'Part 1 done — read the people list. Uncomment Part 2 only if you want Accountant and Sales removed.' AS next_step;
