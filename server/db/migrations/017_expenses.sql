-- ============================================================
-- Migration 017 — School expenses with approval flow
--
-- The spend side of the finance module: categorised expenses with a vendor,
-- tax, a scanned bill in `files`, and a draft -> pending -> approved -> paid
-- state machine. Rejection is terminal until the row is edited back to draft.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Expense categories.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  monthly_budget NUMERIC(12, 2) CHECK (monthly_budget IS NULL OR monthly_budget >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS expense_categories_code_uniq
  ON expense_categories (institution_id, lower(code));
CREATE INDEX IF NOT EXISTS expense_categories_inst_idx
  ON expense_categories (institution_id, is_active);

-- ------------------------------------------------------------
-- 2. Expenses.
--    total_amount is derived so no caller can post an inconsistent bill.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  expense_category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  vendor_name TEXT,
  vendor_gstin TEXT,
  bill_number TEXT,
  bill_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount NUMERIC(12, 2) GENERATED ALWAYS AS (amount + tax_amount) STORED,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode TEXT CHECK (payment_mode IN ('cash', 'upi', 'card', 'cheque', 'dd', 'bank_transfer')),
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'paid')),
  notes TEXT,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS expenses_inst_date_idx
  ON expenses (institution_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS expenses_status_idx ON expenses (institution_id, status);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON expenses (expense_category_id);

-- Stamp the tenant and requester from the JWT so the client cannot post to
-- another institution, mirroring the fees trigger in 013.
CREATE OR REPLACE FUNCTION expenses_set_defaults() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.institution_id IS NULL THEN
    NEW.institution_id := rls_jwt_institution_id();
  END IF;
  IF NEW.requested_by IS NULL THEN
    NEW.requested_by := rls_jwt_user_id();
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS expenses_set_defaults_trg ON expenses;
CREATE TRIGGER expenses_set_defaults_trg
  BEFORE INSERT OR UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION expenses_set_defaults();

-- ------------------------------------------------------------
-- 3. Approval state machine.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_expense_status(
  p_expense_id UUID,
  p_status TEXT,
  p_reason TEXT DEFAULT NULL
) RETURNS TABLE (id UUID, status TEXT) AS $$
DECLARE
  exp RECORD;
BEGIN
  IF rls_jwt_role() NOT IN ('admin', 'principal', 'opsadmin') THEN
    RAISE EXCEPTION 'Not authorised to change expense status';
  END IF;
  IF p_status NOT IN ('draft', 'pending', 'approved', 'rejected', 'paid') THEN
    RAISE EXCEPTION 'Unknown expense status %', p_status;
  END IF;

  SELECT * INTO exp FROM expenses e WHERE e.id = p_expense_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Expense not found'; END IF;
  IF NOT rls_is_mai_admin() AND exp.institution_id <> rls_jwt_institution_id() THEN
    RAISE EXCEPTION 'Expense belongs to another institution';
  END IF;

  IF exp.status = 'paid' AND p_status <> 'paid' THEN
    RAISE EXCEPTION 'A paid expense cannot be reopened';
  END IF;
  IF p_status = 'paid' AND exp.status <> 'approved' THEN
    RAISE EXCEPTION 'Approve the expense before marking it paid';
  END IF;
  IF p_status = 'rejected' AND COALESCE(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'A rejection needs a reason';
  END IF;
  -- Only an admin or principal signs off on spending.
  IF p_status = 'approved' AND rls_jwt_role() NOT IN ('admin', 'principal') THEN
    RAISE EXCEPTION 'Only an admin or principal can approve an expense';
  END IF;

  UPDATE expenses e
     SET status = p_status,
         approved_by = CASE WHEN p_status = 'approved' THEN rls_jwt_user_id()
                            WHEN p_status = 'draft' THEN NULL
                            ELSE e.approved_by END,
         approved_at = CASE WHEN p_status = 'approved' THEN NOW()
                            WHEN p_status = 'draft' THEN NULL
                            ELSE e.approved_at END,
         rejection_reason = CASE WHEN p_status = 'rejected' THEN p_reason ELSE NULL END,
         paid_at = CASE WHEN p_status = 'paid' THEN NOW() ELSE e.paid_at END
   WHERE e.id = p_expense_id;

  RETURN QUERY SELECT p_expense_id, p_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION set_expense_status(UUID, TEXT, TEXT)
  IS E'@name setExpenseStatus\nMove an expense through draft, pending, approved, rejected and paid.';

-- ------------------------------------------------------------
-- 4. Dashboard summaries.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION expense_summary()
RETURNS TABLE (
  spent_this_month NUMERIC,
  spent_this_year NUMERIC,
  pending_count BIGINT,
  pending_amount NUMERIC,
  approved_unpaid NUMERIC
) AS $$
  SELECT
    COALESCE(SUM(e.total_amount) FILTER (
      WHERE e.status = 'paid'
        AND e.expense_date >= date_trunc('month', CURRENT_DATE)::date), 0),
    COALESCE(SUM(e.total_amount) FILTER (
      WHERE e.status = 'paid'
        AND e.expense_date >= date_trunc('year', CURRENT_DATE)::date), 0),
    COUNT(*) FILTER (WHERE e.status = 'pending'),
    COALESCE(SUM(e.total_amount) FILTER (WHERE e.status = 'pending'), 0),
    COALESCE(SUM(e.total_amount) FILTER (WHERE e.status = 'approved'), 0)
  FROM expenses e
  WHERE e.institution_id = rls_jwt_institution_id();
$$ LANGUAGE sql STABLE;
COMMENT ON FUNCTION expense_summary()
  IS E'@name expenseSummary\nSpend totals for the calling user''s institution.';

CREATE OR REPLACE FUNCTION expense_by_category()
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  spent_this_year NUMERIC,
  monthly_budget NUMERIC,
  expense_count BIGINT
) AS $$
  SELECT
    c.id,
    c.name,
    COALESCE(SUM(e.total_amount) FILTER (
      WHERE e.status = 'paid'
        AND e.expense_date >= date_trunc('year', CURRENT_DATE)::date), 0),
    c.monthly_budget,
    COUNT(e.id)
  FROM expense_categories c
  LEFT JOIN expenses e ON e.expense_category_id = c.id
  WHERE c.institution_id = rls_jwt_institution_id()
  GROUP BY c.id, c.name, c.monthly_budget, c.sort_order
  ORDER BY c.sort_order, c.name;
$$ LANGUAGE sql STABLE;
COMMENT ON FUNCTION expense_by_category()
  IS E'@name expenseByCategory\nYear-to-date spend per category.';

-- ------------------------------------------------------------
-- 5. Row level security — finance staff only, plus own drafts.
-- ------------------------------------------------------------
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON expense_categories TO mai_graphql;
GRANT SELECT, INSERT, UPDATE, DELETE ON expenses TO mai_graphql;

DROP POLICY IF EXISTS mai_tenant_read ON expense_categories;
CREATE POLICY mai_tenant_read ON expense_categories FOR SELECT TO mai_graphql
  USING (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id() AND rls_is_staff()));
DROP POLICY IF EXISTS mai_tenant_write ON expense_categories;
CREATE POLICY mai_tenant_write ON expense_categories FOR ALL TO mai_graphql
  USING (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id() AND rls_is_finance_staff()))
  WITH CHECK (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id() AND rls_is_finance_staff()));

-- A teacher may raise and track their own reimbursement, nothing more.
DROP POLICY IF EXISTS mai_tenant_read ON expenses;
CREATE POLICY mai_tenant_read ON expenses FOR SELECT TO mai_graphql
  USING (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id()
         AND (rls_is_finance_staff() OR requested_by = rls_jwt_user_id())));
DROP POLICY IF EXISTS mai_tenant_write ON expenses;
CREATE POLICY mai_tenant_write ON expenses FOR ALL TO mai_graphql
  USING (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id() AND rls_is_finance_staff()))
  WITH CHECK (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id() AND rls_is_finance_staff()));

-- ------------------------------------------------------------
-- 6. Seed the categories a school actually books against.
-- ------------------------------------------------------------
INSERT INTO expense_categories (institution_id, name, code, description, sort_order)
SELECT i.id, c.name, c.code, c.description, c.sort_order
  FROM institutions i
  CROSS JOIN (VALUES
    ('Salaries',         'SALARY',      'Staff salaries and payroll payouts', 10),
    ('Utilities',        'UTILITIES',   'Electricity, water, internet',       20),
    ('Maintenance',      'MAINTENANCE', 'Building and equipment upkeep',      30),
    ('Transport',        'TRANSPORT',   'Bus fuel, servicing and permits',    40),
    ('Academic Supplies','ACADEMIC',    'Books, lab and teaching material',   50),
    ('Stationery',       'STATIONERY',  'Office and classroom stationery',    60),
    ('Events',           'EVENTS',      'Functions, sports and celebrations', 70),
    ('Marketing',        'MARKETING',   'Admissions and outreach',            80),
    ('Miscellaneous',    'MISC',        'Anything uncategorised',             90)
  ) AS c(name, code, description, sort_order)
 WHERE NOT EXISTS (
   SELECT 1 FROM expense_categories ec
    WHERE ec.institution_id = i.id AND lower(ec.code) = lower(c.code)
 );
