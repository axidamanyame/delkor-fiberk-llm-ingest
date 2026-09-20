-- Call Centre desk agents (not BNPL field agents, not shop cashiers).
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.call_agents (
  id text PRIMARY KEY,
  kind text DEFAULT 'call_centre',
  name text NOT NULL,
  phone text,
  email text,
  extension text,
  shift text,
  queues text,
  status text DEFAULT 'active',
  start_date date,
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS call_agents_status_idx ON public.call_agents (status);
CREATE INDEX IF NOT EXISTS call_agents_name_idx ON public.call_agents (name);

DO $$ BEGIN
  ALTER TABLE public.call_tickets ADD COLUMN IF NOT EXISTS agent_id text;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

ALTER TABLE public.call_agents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS call_agents_all ON public.call_agents;
CREATE POLICY call_agents_all ON public.call_agents
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_agents TO authenticated;

COMMENT ON TABLE public.call_agents IS
  'Inbound Call Centre desk staff. Separate from sales_commission_agents (BNPL field) and profiles/users (shop/till).';
