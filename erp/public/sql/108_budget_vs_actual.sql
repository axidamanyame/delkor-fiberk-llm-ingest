-- Budget vs actual for Accounting / Finance menus.
-- Safe to re-run. Does not read gl_code from chart_of_accounts.

CREATE TABLE IF NOT EXISTS finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name text NOT NULL,
  account_type text,
  gl_code text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid,
  department_id text,
  amount numeric DEFAULT 0,
  transaction_date date,
  source text,
  source_id text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS departments (
  id text PRIMARY KEY,
  department_name text
);

INSERT INTO departments (id, department_name) VALUES
  ('axidigetek', 'Axidigetek'),
  ('bnpl', 'BuyNowPaysLater'),
  ('delkor', 'Delkor Logistics'),
  ('fiberk', 'Fiberk'),
  ('ops', 'Operations Hub')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE IF EXISTS budgets
  ADD COLUMN IF NOT EXISTS department_id text,
  ADD COLUMN IF NOT EXISTS category_id text,
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date,
  ADD COLUMN IF NOT EXISTS budget_amount numeric,
  ADD COLUMN IF NOT EXISTS subsidiary_code text,
  ADD COLUMN IF NOT EXISTS account_id text,
  ADD COLUMN IF NOT EXISTS amount numeric,
  ADD COLUMN IF NOT EXISTS period text;

INSERT INTO finance_categories (category_name, account_type, gl_code)
SELECT DISTINCT
  COALESCE(coa.account_type, coa.name),
  coa.account_type,
  NULL::text
FROM chart_of_accounts AS coa
WHERE NOT EXISTS (SELECT 1 FROM finance_categories LIMIT 1);

CREATE OR REPLACE VIEW v_budget_vs_actual AS
WITH budget_data AS (
    SELECT
        b.id AS budget_id,
        COALESCE(b.department_id, b.subsidiary_code, 'fiberk') AS department_id,
        COALESCE(d.department_name, b.subsidiary_code, 'Fiberk') AS department_name,
        COALESCE(b.category_id, a.account_type, 'Expenses') AS category_id,
        COALESCE(c.category_name, a.account_type, 'Expenses') AS category_name,
        COALESCE(b.period_start, CURRENT_DATE) AS period_start,
        COALESCE(b.period_end, CURRENT_DATE) AS period_end,
        COALESCE(b.budget_amount, b.amount, 0) AS budget_amount
    FROM budgets b
    LEFT JOIN departments d ON d.id::text = COALESCE(b.department_id, b.subsidiary_code)
    LEFT JOIN finance_categories c ON c.id::text = b.category_id
    LEFT JOIN chart_of_accounts a ON a.id::text = b.account_id::text
),
actual_data AS (
    SELECT
        t.category_id,
        t.department_id,
        SUM(t.amount) AS actual_amount
    FROM finance_transactions t
    GROUP BY t.category_id, t.department_id
),
combined AS (
    SELECT
        bd.department_id,
        bd.department_name,
        bd.category_id,
        bd.category_name,
        bd.budget_amount,
        COALESCE(ad.actual_amount, 0) AS actual_amount,
        (bd.budget_amount - COALESCE(ad.actual_amount, 0)) AS variance,
        bd.period_start,
        bd.period_end
    FROM budget_data bd
    LEFT JOIN actual_data ad
        ON ad.category_id::text = bd.category_id::text
        AND ad.department_id::text = bd.department_id::text
)
SELECT *
FROM combined
ORDER BY department_name, category_name;
