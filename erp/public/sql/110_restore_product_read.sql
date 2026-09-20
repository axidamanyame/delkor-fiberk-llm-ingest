-- Undo the catalog blackout after 109.
-- Restores SELECT (and staff writes) on live books. Does not drop the
-- profiles role-protect trigger.

GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.products TO authenticated;
GRANT SELECT ON TABLE public.products TO anon;

DO $$
BEGIN
  IF to_regclass('public.products') IS NULL THEN
    RETURN;
  END IF;
  BEGIN
    CREATE POLICY products_read_auth ON public.products
      FOR SELECT TO authenticated USING (true);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    CREATE POLICY products_read_anon ON public.products
      FOR SELECT TO anon USING (true);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    CREATE POLICY products_write_auth ON public.products
      FOR ALL TO authenticated
      USING (true)
      WITH CHECK (true);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
