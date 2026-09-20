-- Sign-in broke after 143 because Auth's reserved "role" was set to owner / hq_admin.
-- That field is the Postgres JWT role. It must be "authenticated" or omitted.
-- Application roles stay on public.profiles (Owner / HQ Admin).
-- Position stays on designation (Founder / Systems Developer / IT Director).
--
-- Run this once. Then sign in with the full Gmail + password.

UPDATE auth.users
SET raw_app_meta_data =
      (coalesce(raw_app_meta_data, '{}'::jsonb) - 'role')
      || jsonb_build_object(
           'provider', coalesce(nullif(raw_app_meta_data->>'provider', ''), 'email'),
           'providers', CASE
             WHEN jsonb_typeof(raw_app_meta_data->'providers') = 'array'
               THEN raw_app_meta_data->'providers'
             ELSE '["email"]'::jsonb
           END
         )
WHERE coalesce(raw_app_meta_data->>'role', '')
      NOT IN ('', 'authenticated', 'anon', 'service_role');

-- Keep user_metadata in line with the public position (not the security class).
UPDATE auth.users u
SET raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object(
       'role', coalesce(nullif(p.designation, ''), p.role_name, p.role),
       'designation', p.designation
     )
FROM public.profiles p
WHERE p.id = u.id
  AND p.designation IS NOT NULL;

SELECT
  u.email,
  u.raw_app_meta_data->>'role' AS jwt_role,
  u.raw_app_meta_data->>'provider' AS provider,
  p.role AS security_role,
  p.designation AS position
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
ORDER BY u.email;
