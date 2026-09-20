-- Till openings, silent discrepancy alerts, shop attendance sites.
-- Run once in the Supabase SQL editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.till_openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_session_id text,
  cashier_id uuid,
  cashier_email text,
  cashier_name text,
  subsidiary_code text,
  location_code text,
  location_name text,
  momo_on_hand numeric(14,2) NOT NULL DEFAULT 0,
  cash_on_hand numeric(14,2) NOT NULL DEFAULT 0,
  total_entered numeric(14,2) NOT NULL DEFAULT 0,
  system_expected_total numeric(14,2) NOT NULL DEFAULT 0,
  difference numeric(14,2) NOT NULL DEFAULT 0,
  note text,
  device_id text,
  public_ip text,
  geo_lat numeric(10,6),
  geo_lng numeric(10,6),
  geo_accuracy numeric(12,2),
  attend_method text,
  attend_verified boolean DEFAULT false,
  opened_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.till_discrepancy_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  till_opening_id uuid REFERENCES public.till_openings(id) ON DELETE CASCADE,
  difference numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  reviewed_by uuid,
  review_note text,
  payload jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.shop_attendance_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_code text NOT NULL,
  location_name text,
  public_ip text,
  device_token text,
  lat numeric(10,6),
  lng numeric(10,6),
  radius_m integer NOT NULL DEFAULT 60,
  active boolean NOT NULL DEFAULT true,
  enrolled_at timestamptz DEFAULT now(),
  enrolled_by text
);

CREATE INDEX IF NOT EXISTS till_openings_loc_idx ON public.till_openings (location_code, opened_at DESC);
CREATE INDEX IF NOT EXISTS till_alerts_status_idx ON public.till_discrepancy_alerts (status, created_at DESC);

ALTER TABLE public.pos_sessions ADD COLUMN IF NOT EXISTS momo_on_hand numeric(14,2);
ALTER TABLE public.pos_sessions ADD COLUMN IF NOT EXISTS cash_on_hand numeric(14,2);
ALTER TABLE public.pos_sessions ADD COLUMN IF NOT EXISTS system_expected_total numeric(14,2);
ALTER TABLE public.pos_sessions ADD COLUMN IF NOT EXISTS till_difference numeric(14,2);

ALTER TABLE public.till_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.till_discrepancy_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_attendance_sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS df_till_open_ins ON public.till_openings;
DROP POLICY IF EXISTS df_till_open_sel ON public.till_openings;
DROP POLICY IF EXISTS df_till_alert_ins ON public.till_discrepancy_alerts;
DROP POLICY IF EXISTS df_till_alert_sel ON public.till_discrepancy_alerts;
DROP POLICY IF EXISTS df_till_alert_upd ON public.till_discrepancy_alerts;
DROP POLICY IF EXISTS df_shop_site_sel ON public.shop_attendance_sites;
DROP POLICY IF EXISTS df_shop_site_wrt ON public.shop_attendance_sites;

CREATE POLICY df_till_open_ins ON public.till_openings
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY df_till_open_sel ON public.till_openings
  FOR SELECT TO authenticated
  USING (cashier_id = auth.uid() OR public.df_is_hq());

CREATE POLICY df_till_alert_ins ON public.till_discrepancy_alerts
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY df_till_alert_sel ON public.till_discrepancy_alerts
  FOR SELECT TO authenticated USING (public.df_is_hq());
CREATE POLICY df_till_alert_upd ON public.till_discrepancy_alerts
  FOR UPDATE TO authenticated USING (public.df_is_hq());

CREATE POLICY df_shop_site_sel ON public.shop_attendance_sites
  FOR SELECT TO authenticated USING (true);
CREATE POLICY df_shop_site_wrt ON public.shop_attendance_sites
  FOR ALL TO authenticated USING (public.df_is_hq()) WITH CHECK (public.df_is_hq());

GRANT SELECT, INSERT ON public.till_openings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.till_discrepancy_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_attendance_sites TO authenticated;

INSERT INTO public.shop_attendance_sites (location_code, location_name, lat, lng, radius_m)
SELECT 'FIB-SHOP', 'Fiberk Shop', 5.685577, -0.138635, 60
WHERE NOT EXISTS (
  SELECT 1 FROM public.shop_attendance_sites WHERE location_code = 'FIB-SHOP'
);

NOTIFY pgrst, 'reload schema';
