-- jwt_role was left empty after 144. PostgREST needs "authenticated".
-- Application roles stay on public.profiles. This only fixes sign-in tokens.
-- Run once, then hard-refresh login.html.

UPDATE auth.users
SET raw_app_meta_data =
      coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object(
           'role', 'authenticated',
           'provider', coalesce(nullif(raw_app_meta_data->>'provider', ''), 'email'),
           'providers', CASE
             WHEN jsonb_typeof(raw_app_meta_data->'providers') = 'array'
               THEN raw_app_meta_data->'providers'
             ELSE '["email"]'::jsonb
           END
         ),
    banned_until = NULL,
    email_confirmed_at = coalesce(email_confirmed_at, now())
WHERE deleted_at IS NULL;

SELECT
  u.email,
  u.raw_app_meta_data->>'role' AS jwt_role,
  u.banned_until,
  u.email_confirmed_at IS NOT NULL AS confirmed,
  p.role AS security_role,
  p.designation AS position
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
ORDER BY u.email;
