-- Store attributes for Filters, inventory tables, and WooCommerce.
-- Safe to re-run. Does not drop data.

DO $$
DECLARE
  col text;
BEGIN
  IF to_regclass('public.products') IS NULL THEN
    RETURN;
  END IF;
  FOREACH col IN ARRAY ARRAY[
    'brand', 'model', 'model_number', 'color', 'colour', 'size',
    'product_type', 'unit', 'tax_name', 'branch', 'branch_name',
    'subcategory', 'department'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.products ADD COLUMN IF NOT EXISTS %I text', col);
    EXCEPTION WHEN others THEN NULL;
    END;
  END LOOP;
  BEGIN
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS woocommerce_enabled boolean DEFAULT false;
  EXCEPTION WHEN others THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS not_for_selling boolean DEFAULT false;
  EXCEPTION WHEN others THEN NULL;
  END;
END $$;
