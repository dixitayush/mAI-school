-- ============================================================
-- Migration 015 — Staff payroll and the salary compensation planner
--
-- A salary structure is an effective-dated set of components (Basic, HRA, PF,
-- TDS...). Each component is either a fixed rupee amount or a percentage of
-- basic / CTC, which is what makes the structure a planner rather than a
-- static number. A monthly payroll run snapshots the computed components onto
-- each payslip so later edits to the structure never rewrite history.
-- ============================================================

-- ------------------------------------------------------------
-- 1–5. Payroll tables (DROP + CREATE)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS payslips CASCADE;
DROP TABLE IF EXISTS payroll_runs CASCADE;
DROP TABLE IF EXISTS staff_attendance CASCADE;
DROP TABLE IF EXISTS salary_components CASCADE;
DROP TABLE IF EXISTS salary_structures CASCADE;
DROP TABLE IF EXISTS staff_bank_accounts CASCADE;

CREATE TABLE staff_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_holder_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  bank_name TEXT,
  branch_name TEXT,
  upi_id TEXT,
  pan_number TEXT,
  pf_number TEXT,
  esi_number TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX staff_bank_accounts_primary_uniq
  ON staff_bank_accounts (user_id) WHERE is_primary;
CREATE INDEX staff_bank_accounts_inst_idx ON staff_bank_accounts (institution_id);

CREATE TABLE salary_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  effective_from DATE NOT NULL,
  effective_to DATE,
  annual_ctc NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (annual_ctc >= 0),
  basic_monthly NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (basic_monthly >= 0),
  payment_mode TEXT NOT NULL DEFAULT 'bank_transfer'
    CHECK (payment_mode IN ('bank_transfer', 'cash', 'cheque', 'upi')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT salary_structures_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX salary_structures_user_idx
  ON salary_structures (user_id, effective_from DESC);
CREATE INDEX salary_structures_inst_idx ON salary_structures (institution_id, is_active);

CREATE TABLE salary_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_structure_id UUID NOT NULL REFERENCES salary_structures(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  component_type TEXT NOT NULL CHECK (component_type IN ('earning', 'deduction')),
  calculation TEXT NOT NULL DEFAULT 'fixed'
    CHECK (calculation IN ('fixed', 'percent_of_basic', 'percent_of_ctc')),
  value NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (value >= 0),
  is_taxable BOOLEAN NOT NULL DEFAULT TRUE,
  prorate_on_lop BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX salary_components_uniq
  ON salary_components (salary_structure_id, lower(code));

CREATE TABLE staff_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_month DATE NOT NULL,
  working_days NUMERIC(5, 1) NOT NULL DEFAULT 0 CHECK (working_days >= 0),
  present_days NUMERIC(5, 1) NOT NULL DEFAULT 0 CHECK (present_days >= 0),
  paid_leave_days NUMERIC(5, 1) NOT NULL DEFAULT 0 CHECK (paid_leave_days >= 0),
  unpaid_leave_days NUMERIC(5, 1) NOT NULL DEFAULT 0 CHECK (unpaid_leave_days >= 0),
  overtime_hours NUMERIC(6, 2) NOT NULL DEFAULT 0,
  remarks TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX staff_attendance_uniq
  ON staff_attendance (user_id, period_month);
CREATE INDEX staff_attendance_inst_idx ON staff_attendance (institution_id, period_month);

CREATE TABLE payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  period_month DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'paid', 'cancelled')),
  working_days NUMERIC(5, 1) NOT NULL DEFAULT 0,
  total_gross NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_net NUMERIC(14, 2) NOT NULL DEFAULT 0,
  staff_count INT NOT NULL DEFAULT 0,
  notes TEXT,
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX payroll_runs_period_uniq
  ON payroll_runs (institution_id, period_month);

CREATE TABLE payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  salary_structure_id UUID REFERENCES salary_structures(id) ON DELETE SET NULL,
  period_month DATE NOT NULL,
  working_days NUMERIC(5, 1) NOT NULL DEFAULT 0,
  paid_days NUMERIC(5, 1) NOT NULL DEFAULT 0,
  lop_days NUMERIC(5, 1) NOT NULL DEFAULT 0,
  gross_earnings NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'on_hold')),
  paid_on DATE,
  payment_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX payslips_run_user_uniq ON payslips (payroll_run_id, user_id);
CREATE INDEX payslips_user_idx ON payslips (user_id, period_month DESC);
CREATE INDEX payslips_inst_idx ON payslips (institution_id, period_month);

-- ------------------------------------------------------------
-- 6. Working days in a month, derived from weekends and holidays.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION staff_working_days(
  p_institution_id UUID,
  p_period_month DATE
) RETURNS NUMERIC AS $$
DECLARE
  v_start DATE := date_trunc('month', p_period_month)::DATE;
  v_end DATE := (date_trunc('month', p_period_month) + INTERVAL '1 month - 1 day')::DATE;
  v_weekend INT[];
  v_days NUMERIC := 0;
BEGIN
  SELECT weekend_days INTO v_weekend
    FROM institution_settings WHERE institution_id = p_institution_id;
  -- Default to Sunday only (Postgres DOW: 0 = Sunday).
  v_weekend := COALESCE(v_weekend, ARRAY[0]);

  SELECT COUNT(*) INTO v_days
    FROM generate_series(v_start, v_end, INTERVAL '1 day') AS d(day)
   WHERE NOT (EXTRACT(DOW FROM d.day)::INT = ANY (v_weekend))
     AND NOT EXISTS (
       SELECT 1 FROM holidays h
        WHERE h.institution_id = p_institution_id
          AND d.day::DATE BETWEEN h.start_date AND h.end_date
     );

  RETURN v_days;
END;
$$ LANGUAGE plpgsql STABLE;
COMMENT ON FUNCTION staff_working_days(UUID, DATE)
  IS E'@name staffWorkingDays\nPayable working days in a month after weekends and holidays.';

-- ------------------------------------------------------------
-- 7. Resolve a structure's components into rupee amounts.
--    Exposed so the planner UI can preview a structure before saving.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION salary_structure_preview(p_structure_id UUID)
RETURNS TABLE (
  code TEXT,
  name TEXT,
  component_type TEXT,
  calculation TEXT,
  configured_value NUMERIC,
  monthly_amount NUMERIC
) AS $$
DECLARE
  st RECORD;
BEGIN
  SELECT * INTO st FROM salary_structures WHERE id = p_structure_id;
  IF NOT FOUND THEN RETURN; END IF;

  RETURN QUERY
  SELECT c.code, c.name, c.component_type, c.calculation, c.value,
         ROUND(
           CASE c.calculation
             WHEN 'fixed' THEN c.value
             WHEN 'percent_of_basic' THEN st.basic_monthly * c.value / 100
             WHEN 'percent_of_ctc' THEN (st.annual_ctc / 12) * c.value / 100
             ELSE 0
           END, 2)
    FROM salary_components c
   WHERE c.salary_structure_id = p_structure_id
   ORDER BY c.component_type DESC, c.sort_order, c.name;
END;
$$ LANGUAGE plpgsql STABLE;
COMMENT ON FUNCTION salary_structure_preview(UUID)
  IS E'@name salaryStructurePreview\nResolve a salary structure into monthly rupee amounts.';

-- ------------------------------------------------------------
-- 8. Build a month's payroll from active structures and attendance.
--    Idempotent per (institution, month): re-running a draft rebuilds it,
--    but an approved or paid run is never silently overwritten.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_payroll(
  p_institution_id UUID,
  p_period_month DATE
) RETURNS TABLE (
  payroll_run_id UUID,
  staff_count INT,
  total_gross NUMERIC,
  total_deductions NUMERIC,
  total_net NUMERIC,
  working_days NUMERIC
) AS $$
DECLARE
  v_inst UUID;
  v_month DATE := date_trunc('month', p_period_month)::DATE;
  v_run UUID;
  v_status TEXT;
  v_working NUMERIC;
  st RECORD;
  comp RECORD;
  v_paid_days NUMERIC;
  v_lop NUMERIC;
  v_factor NUMERIC;
  v_gross NUMERIC;
  v_ded NUMERIC;
  v_amount NUMERIC;
  v_components JSONB;
  v_count INT := 0;
  v_tot_gross NUMERIC := 0;
  v_tot_ded NUMERIC := 0;
BEGIN
  IF rls_jwt_role() NOT IN ('admin', 'principal', 'opsadmin') THEN
    RAISE EXCEPTION 'Not authorised to run payroll';
  END IF;

  v_inst := COALESCE(p_institution_id, rls_jwt_institution_id());
  IF NOT rls_is_mai_admin() AND v_inst <> rls_jwt_institution_id() THEN
    RAISE EXCEPTION 'Payroll belongs to another institution';
  END IF;

  v_working := staff_working_days(v_inst, v_month);

  SELECT id, status INTO v_run, v_status
    FROM payroll_runs WHERE institution_id = v_inst AND period_month = v_month;

  IF FOUND AND v_status <> 'draft' THEN
    RAISE EXCEPTION 'Payroll for % is already % and cannot be regenerated',
      to_char(v_month, 'Mon YYYY'), v_status;
  END IF;

  IF v_run IS NULL THEN
    INSERT INTO payroll_runs (institution_id, period_month, working_days, generated_by)
    VALUES (v_inst, v_month, v_working, rls_jwt_user_id())
    RETURNING id INTO v_run;
  ELSE
    -- Rebuild the draft from scratch so edits to structures are picked up.
    -- Qualify payslips.payroll_run_id: RETURNS TABLE also exposes that name
    -- as an OUT variable, which Postgres would otherwise treat as ambiguous.
    DELETE FROM payslips p WHERE p.payroll_run_id = v_run;
    UPDATE payroll_runs SET working_days = v_working, generated_by = rls_jwt_user_id()
     WHERE id = v_run;
  END IF;

  -- One payslip per staff member with a structure in force this month.
  FOR st IN
    SELECT DISTINCT ON (s.user_id) s.*
      FROM salary_structures s
      JOIN users u ON u.id = s.user_id
     WHERE s.institution_id = v_inst
       AND s.is_active
       AND u.institution_id = v_inst
       AND s.effective_from <= (v_month + INTERVAL '1 month - 1 day')::DATE
       AND (s.effective_to IS NULL OR s.effective_to >= v_month)
     ORDER BY s.user_id, s.effective_from DESC
  LOOP
    SELECT COALESCE(a.unpaid_leave_days, 0) INTO v_lop
      FROM staff_attendance a
     WHERE a.user_id = st.user_id AND a.period_month = v_month;
    v_lop := COALESCE(v_lop, 0);

    v_paid_days := GREATEST(v_working - v_lop, 0);
    v_factor := CASE WHEN v_working > 0 THEN v_paid_days / v_working ELSE 1 END;

    v_gross := 0;
    v_ded := 0;
    v_components := '[]'::jsonb;

    FOR comp IN
      SELECT * FROM salary_components
       WHERE salary_structure_id = st.id
       ORDER BY component_type DESC, sort_order, name
    LOOP
      v_amount := ROUND(
        CASE comp.calculation
          WHEN 'fixed' THEN comp.value
          WHEN 'percent_of_basic' THEN st.basic_monthly * comp.value / 100
          WHEN 'percent_of_ctc' THEN (st.annual_ctc / 12) * comp.value / 100
          ELSE 0
        END, 2);

      IF comp.prorate_on_lop THEN
        v_amount := ROUND(v_amount * v_factor, 2);
      END IF;

      IF comp.component_type = 'earning' THEN
        v_gross := v_gross + v_amount;
      ELSE
        v_ded := v_ded + v_amount;
      END IF;

      v_components := v_components || jsonb_build_object(
        'code', comp.code,
        'name', comp.name,
        'type', comp.component_type,
        'calculation', comp.calculation,
        'configuredValue', comp.value,
        'amount', v_amount
      );
    END LOOP;

    INSERT INTO payslips (
      payroll_run_id, institution_id, user_id, salary_structure_id, period_month,
      working_days, paid_days, lop_days, gross_earnings, total_deductions, net_pay, components
    ) VALUES (
      v_run, v_inst, st.user_id, st.id, v_month,
      v_working, v_paid_days, v_lop, v_gross, v_ded, v_gross - v_ded, v_components
    );

    v_count := v_count + 1;
    v_tot_gross := v_tot_gross + v_gross;
    v_tot_ded := v_tot_ded + v_ded;
  END LOOP;

  UPDATE payroll_runs
     SET staff_count = v_count,
         total_gross = v_tot_gross,
         total_deductions = v_tot_ded,
         total_net = v_tot_gross - v_tot_ded
   WHERE id = v_run;

  RETURN QUERY SELECT v_run, v_count, v_tot_gross, v_tot_ded, v_tot_gross - v_tot_ded, v_working;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION generate_payroll(UUID, DATE)
  IS E'@name generatePayroll\nBuild or rebuild a draft payroll run for one month.';

-- ------------------------------------------------------------
-- 9. Approve / mark paid, with the state machine enforced server side.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_payroll_status(
  p_run_id UUID,
  p_status TEXT
) RETURNS TABLE (id UUID, status TEXT) AS $$
DECLARE
  run RECORD;
BEGIN
  IF rls_jwt_role() NOT IN ('admin', 'principal', 'opsadmin') THEN
    RAISE EXCEPTION 'Not authorised to change payroll status';
  END IF;
  IF p_status NOT IN ('draft', 'approved', 'paid', 'cancelled') THEN
    RAISE EXCEPTION 'Unknown payroll status %', p_status;
  END IF;

  SELECT * INTO run FROM payroll_runs WHERE payroll_runs.id = p_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payroll run not found'; END IF;
  IF NOT rls_is_mai_admin() AND run.institution_id <> rls_jwt_institution_id() THEN
    RAISE EXCEPTION 'Payroll run belongs to another institution';
  END IF;
  IF run.status = 'paid' AND p_status <> 'paid' THEN
    RAISE EXCEPTION 'A paid payroll run cannot be reopened';
  END IF;
  IF p_status = 'paid' AND run.status <> 'approved' THEN
    RAISE EXCEPTION 'Approve the payroll run before marking it paid';
  END IF;

  UPDATE payroll_runs r
     SET status = p_status,
         approved_by = CASE WHEN p_status = 'approved' THEN rls_jwt_user_id() ELSE r.approved_by END,
         approved_at = CASE WHEN p_status = 'approved' THEN NOW() ELSE r.approved_at END,
         paid_at = CASE WHEN p_status = 'paid' THEN NOW() ELSE r.paid_at END
   WHERE r.id = p_run_id;

  IF p_status = 'paid' THEN
    UPDATE payslips SET payment_status = 'paid', paid_on = CURRENT_DATE
     WHERE payroll_run_id = p_run_id AND payment_status <> 'on_hold';
  END IF;

  RETURN QUERY SELECT p_run_id, p_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION set_payroll_status(UUID, TEXT)
  IS E'@name setPayrollStatus\nMove a payroll run through draft, approved and paid.';

-- ------------------------------------------------------------
-- 10. Row level security.
--     Staff see their own bank details, structure and payslips;
--     finance staff see and write everything in the tenant.
-- ------------------------------------------------------------
-- Tables carrying user_id: the owning staff member may read their own row.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'staff_bank_accounts', 'salary_structures', 'staff_attendance', 'payslips'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO mai_graphql', t);

    EXECUTE format($f$
      DROP POLICY IF EXISTS mai_tenant_read ON %1$I;
      CREATE POLICY mai_tenant_read ON %1$I FOR SELECT TO mai_graphql
        USING (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id()
               AND (rls_is_finance_staff() OR user_id = rls_jwt_user_id())));
      DROP POLICY IF EXISTS mai_tenant_write ON %1$I;
      CREATE POLICY mai_tenant_write ON %1$I FOR ALL TO mai_graphql
        USING (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id() AND rls_is_finance_staff()))
        WITH CHECK (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id() AND rls_is_finance_staff()));
    $f$, t);
  END LOOP;
END $$;

-- payroll_runs is institution-level (no user_id): staff read, finance staff write.
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON payroll_runs TO mai_graphql;
DROP POLICY IF EXISTS mai_tenant_read ON payroll_runs;
CREATE POLICY mai_tenant_read ON payroll_runs FOR SELECT TO mai_graphql
  USING (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id() AND rls_is_staff()));
DROP POLICY IF EXISTS mai_tenant_write ON payroll_runs;
CREATE POLICY mai_tenant_write ON payroll_runs FOR ALL TO mai_graphql
  USING (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id() AND rls_is_finance_staff()))
  WITH CHECK (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id() AND rls_is_finance_staff()));

-- Components inherit their tenant from the parent structure.
ALTER TABLE salary_components ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON salary_components TO mai_graphql;
DROP POLICY IF EXISTS mai_tenant_read ON salary_components;
CREATE POLICY mai_tenant_read ON salary_components FOR SELECT TO mai_graphql
  USING (rls_is_mai_admin() OR EXISTS (
    SELECT 1 FROM salary_structures s
     WHERE s.id = salary_components.salary_structure_id
       AND s.institution_id = rls_jwt_institution_id()
       AND (rls_is_finance_staff() OR s.user_id = rls_jwt_user_id())));
DROP POLICY IF EXISTS mai_tenant_write ON salary_components;
CREATE POLICY mai_tenant_write ON salary_components FOR ALL TO mai_graphql
  USING (rls_is_mai_admin() OR (rls_is_finance_staff() AND EXISTS (
    SELECT 1 FROM salary_structures s
     WHERE s.id = salary_components.salary_structure_id
       AND s.institution_id = rls_jwt_institution_id())))
  WITH CHECK (rls_is_mai_admin() OR (rls_is_finance_staff() AND EXISTS (
    SELECT 1 FROM salary_structures s
     WHERE s.id = salary_components.salary_structure_id
       AND s.institution_id = rls_jwt_institution_id())));

-- ------------------------------------------------------------
-- 11. Payroll summary for dashboards.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION payroll_summary(p_institution_id UUID DEFAULT NULL)
RETURNS TABLE (
  staff_on_payroll INT,
  monthly_gross NUMERIC,
  monthly_net NUMERIC,
  last_run_month DATE,
  last_run_status TEXT,
  pending_payslips INT
) AS $$
DECLARE
  inst UUID;
  latest UUID;
BEGIN
  inst := COALESCE(p_institution_id, rls_jwt_institution_id());

  SELECT id INTO latest FROM payroll_runs
   WHERE institution_id = inst AND status <> 'cancelled'
   ORDER BY period_month DESC LIMIT 1;

  RETURN QUERY
  SELECT
    (SELECT COUNT(DISTINCT s.user_id)::INT FROM salary_structures s
      WHERE s.institution_id = inst AND s.is_active),
    COALESCE((SELECT r.total_gross FROM payroll_runs r WHERE r.id = latest), 0),
    COALESCE((SELECT r.total_net FROM payroll_runs r WHERE r.id = latest), 0),
    (SELECT r.period_month FROM payroll_runs r WHERE r.id = latest),
    (SELECT r.status FROM payroll_runs r WHERE r.id = latest),
    COALESCE((SELECT COUNT(*)::INT FROM payslips p
               WHERE p.institution_id = inst AND p.payment_status = 'pending'), 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
COMMENT ON FUNCTION payroll_summary(UUID)
  IS E'@name payrollSummary\nHeadline payroll figures for the current institution.';
