-- Catalog photo uploads from the desk.
-- Safe to re-run.

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
  BEGIN
    CREATE POLICY product_images_select ON storage.objects
      FOR SELECT USING (bucket_id = 'product-images');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    CREATE POLICY product_images_insert ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'product-images');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    CREATE POLICY product_images_update ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'product-images')
      WITH CHECK (bucket_id = 'product-images');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS catalog_image_url text;
