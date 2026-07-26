-- ============================================================
-- Migration 013 — Fee structure, invoicing and payment ledger
--
-- Extends the flat `fees` table rather than replacing it, so existing rows,
-- the admin fee views and the admit-card fee gate (006) keep working. A `fees`
-- row is now a single invoice LINE: it may belong to a fee_invoice, carry a
-- fee_head (Tuition, Bus, Exam, ...), and be settled by one or more
-- fee_payments rather than a manual status flip.
-- ============================================================

-- ------------------------------------------------------------
-- Shared guard: who may write financial records.
-- 'opsadmin' is added to user_role in migration 016; comparing the JWT claim
-- as text means this function does not depend on the enum existing yet.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION rls_is_finance_staff() RETURNS boolean AS $$
  SELECT rls_jwt_role() IN ('admin', 'principal', 'opsadmin');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION rls_is_staff() RETURNS boolean AS $$
  SELECT rls_jwt_role() IN ('admin', 'principal', 'opsadmin', 'teacher');
$$ LANGUAGE sql STABLE;

-- The students row belonging to the current JWT user, if any.
CREATE OR REPLACE FUNCTION rls_current_student_id() RETURNS uuid AS $$
  SELECT s.id FROM students s WHERE s.user_id = rls_jwt_user_id();
$$ LANGUAGE sql STABLE;

-- ------------------------------------------------------------
-- 1. Fee heads — the chargeable categories.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fee_heads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  default_frequency TEXT NOT NULL DEFAULT 'one_time'
    CHECK (default_frequency IN ('one_time', 'monthly', 'quarterly', 'half_yearly', 'yearly')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS fee_heads_code_uniq ON fee_heads (institution_id, lower(code));
CREATE INDEX IF NOT EXISTS fee_heads_inst_idx ON fee_heads (institution_id, is_active);

-- ------------------------------------------------------------
-- 2. Fee plans — a class-wise (or institution-wide) price list.
--    class_id NULL means the plan applies to every class.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fee_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  academic_session_id UUID REFERENCES academic_sessions(id) ON DELETE SET NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS fee_plans_name_uniq ON fee_plans (institution_id, lower(name));
CREATE INDEX IF NOT EXISTS fee_plans_class_idx ON fee_plans (institution_id, class_id);

-- ------------------------------------------------------------
-- 3. Fee plan items — one priced head within a plan.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fee_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_plan_id UUID NOT NULL REFERENCES fee_plans(id) ON DELETE CASCADE,
  fee_head_id UUID NOT NULL REFERENCES fee_heads(id) ON DELETE RESTRICT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  frequency TEXT NOT NULL DEFAULT 'one_time'
    CHECK (frequency IN ('one_time', 'monthly', 'quarterly', 'half_yearly', 'yearly')),
  due_day INT CHECK (due_day BETWEEN 1 AND 28),
  is_optional BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS fee_plan_items_uniq
  ON fee_plan_items (fee_plan_id, fee_head_id, frequency);

-- ------------------------------------------------------------
-- 4. Per-student overrides — concessions, scholarships, custom amounts.
--    fee_head_id NULL applies the discount to every head.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_fee_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_head_id UUID REFERENCES fee_heads(id) ON DELETE CASCADE,
  override_amount NUMERIC(12, 2) CHECK (override_amount IS NULL OR override_amount >= 0),
  discount_percent NUMERIC(5, 2) CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)),
  discount_amount NUMERIC(12, 2) CHECK (discount_amount IS NULL OR discount_amount >= 0),
  reason TEXT,
  valid_from DATE,
  valid_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT student_fee_overrides_has_effect
    CHECK (override_amount IS NOT NULL OR discount_percent IS NOT NULL OR discount_amount IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS student_fee_overrides_uniq
  ON student_fee_overrides (student_id, COALESCE(fee_head_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ------------------------------------------------------------
-- 5. Invoices — the header grouping fee lines for one student/period.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fee_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_plan_id UUID REFERENCES fee_plans(id) ON DELETE SET NULL,
  academic_session_id UUID REFERENCES academic_sessions(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  period_label TEXT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  paid_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'issued'
    CHECK (status IN ('draft', 'issued', 'partial', 'paid', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS fee_invoices_number_uniq
  ON fee_invoices (institution_id, invoice_number);
-- Makes plan generation idempotent: one invoice per student, plan and period.
CREATE UNIQUE INDEX IF NOT EXISTS fee_invoices_period_uniq
  ON fee_invoices (student_id, fee_plan_id, period_label)
  WHERE fee_plan_id IS NOT NULL AND period_label IS NOT NULL;
CREATE INDEX IF NOT EXISTS fee_invoices_student_idx ON fee_invoices (student_id, status);
CREATE INDEX IF NOT EXISTS fee_invoices_inst_idx ON fee_invoices (institution_id, issue_date);

-- ------------------------------------------------------------
-- 6. Extend `fees` into an invoice line item.
-- ------------------------------------------------------------
ALTER TABLE fees ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE;
ALTER TABLE fees ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES fee_invoices(id) ON DELETE CASCADE;
ALTER TABLE fees ADD COLUMN IF NOT EXISTS fee_head_id UUID REFERENCES fee_heads(id) ON DELETE SET NULL;
ALTER TABLE fees ADD COLUMN IF NOT EXISTS academic_session_id UUID REFERENCES academic_sessions(id) ON DELETE SET NULL;
ALTER TABLE fees ADD COLUMN IF NOT EXISTS period_label TEXT;
ALTER TABLE fees ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE fees ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE fees ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE fees ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Outstanding balance, maintained by Postgres so every reader agrees.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fees' AND column_name = 'balance'
  ) THEN
    ALTER TABLE fees ADD COLUMN balance NUMERIC(12, 2)
      GENERATED ALWAYS AS (amount - COALESCE(discount_amount, 0) - COALESCE(paid_amount, 0)) STORED;
  END IF;
END $$;

-- Widen the legacy status check to cover partial settlement and write-offs.
ALTER TABLE fees DROP CONSTRAINT IF EXISTS fees_status_check;
ALTER TABLE fees ADD CONSTRAINT fees_status_check
  CHECK (status IN ('pending', 'partial', 'paid', 'overdue', 'waived', 'cancelled'));

-- Backfill the tenant column for rows created before this migration.
UPDATE fees f
   SET institution_id = u.institution_id
  FROM students s
  JOIN users u ON u.id = s.user_id
 WHERE s.id = f.student_id
   AND f.institution_id IS DISTINCT FROM u.institution_id;

CREATE INDEX IF NOT EXISTS fees_institution_idx ON fees (institution_id, status);
CREATE INDEX IF NOT EXISTS fees_invoice_idx ON fees (invoice_id);
CREATE INDEX IF NOT EXISTS fees_head_idx ON fees (fee_head_id);

-- Keep institution_id authoritative without asking every caller to supply it.
CREATE OR REPLACE FUNCTION fees_set_institution() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.institution_id IS NULL AND NEW.student_id IS NOT NULL THEN
    SELECT u.institution_id INTO NEW.institution_id
      FROM students s JOIN users u ON u.id = s.user_id
     WHERE s.id = NEW.student_id;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fees_set_institution_trg ON fees;
CREATE TRIGGER fees_set_institution_trg
  BEFORE INSERT OR UPDATE ON fees
  FOR EACH ROW EXECUTE FUNCTION fees_set_institution();

-- ------------------------------------------------------------
-- 7. Payment ledger — supports partial payments and receipts.
--    Several rows may share a receipt_number when one receipt settles
--    multiple lines of an invoice.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  fee_id UUID NOT NULL REFERENCES fees(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES fee_invoices(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  receipt_number TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
  mode TEXT NOT NULL DEFAULT 'cash'
    CHECK (mode IN ('cash', 'upi', 'card', 'cheque', 'netbanking', 'dd', 'other')),
  reference_no TEXT,
  notes TEXT,
  is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  collected_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fee_payments_fee_idx ON fee_payments (fee_id) WHERE NOT is_cancelled;
CREATE INDEX IF NOT EXISTS fee_payments_receipt_idx ON fee_payments (institution_id, receipt_number);
CREATE INDEX IF NOT EXISTS fee_payments_date_idx ON fee_payments (institution_id, paid_on);
CREATE INDEX IF NOT EXISTS fee_payments_student_idx ON fee_payments (student_id, paid_on);

-- ------------------------------------------------------------
-- 8. Aggregate sync: payments drive fee and invoice state.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fee_recalculate(p_fee_id UUID) RETURNS VOID AS $$
DECLARE
  v_paid NUMERIC(12, 2);
  v_net NUMERIC(12, 2);
  v_due DATE;
  v_status TEXT;
  v_invoice UUID;
  v_last_paid DATE;
BEGIN
  SELECT COALESCE(SUM(p.amount), 0), MAX(p.paid_on)
    INTO v_paid, v_last_paid
    FROM fee_payments p
   WHERE p.fee_id = p_fee_id AND NOT p.is_cancelled;

  SELECT f.amount - COALESCE(f.discount_amount, 0), f.due_date, f.invoice_id, f.status
    INTO v_net, v_due, v_invoice, v_status
    FROM fees f WHERE f.id = p_fee_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- Write-offs and cancellations are deliberate; payments do not override them.
  IF v_status NOT IN ('waived', 'cancelled') THEN
    v_status := CASE
      WHEN v_paid >= v_net AND v_net > 0 THEN 'paid'
      WHEN v_paid > 0 THEN 'partial'
      WHEN v_due < CURRENT_DATE THEN 'overdue'
      ELSE 'pending'
    END;
  END IF;

  UPDATE fees
     SET paid_amount = v_paid,
         status = v_status,
         payment_date = CASE WHEN v_status = 'paid' THEN COALESCE(v_last_paid, payment_date) ELSE NULL END,
         updated_at = NOW()
   WHERE id = p_fee_id;

  IF v_invoice IS NOT NULL THEN
    UPDATE fee_invoices i
       SET subtotal = agg.subtotal,
           discount_total = agg.discount_total,
           total = agg.total,
           paid_total = agg.paid_total,
           status = CASE
             WHEN i.status = 'cancelled' THEN 'cancelled'
             WHEN agg.total > 0 AND agg.paid_total >= agg.total THEN 'paid'
             WHEN agg.paid_total > 0 THEN 'partial'
             ELSE 'issued'
           END,
           updated_at = NOW()
      FROM (
        SELECT COALESCE(SUM(f.amount), 0) AS subtotal,
               COALESCE(SUM(f.discount_amount), 0) AS discount_total,
               COALESCE(SUM(f.amount - f.discount_amount), 0) AS total,
               COALESCE(SUM(f.paid_amount), 0) AS paid_total
          FROM fees f
         WHERE f.invoice_id = v_invoice
           AND f.status <> 'cancelled'
      ) agg
     WHERE i.id = v_invoice;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Internal helper invoked by the trigger; not part of the public API.
COMMENT ON FUNCTION fee_recalculate(UUID) IS E'@omit';

CREATE OR REPLACE FUNCTION fee_payments_sync() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM fee_recalculate(OLD.fee_id);
    RETURN OLD;
  END IF;
  PERFORM fee_recalculate(NEW.fee_id);
  IF TG_OP = 'UPDATE' AND OLD.fee_id <> NEW.fee_id THEN
    PERFORM fee_recalculate(OLD.fee_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fee_payments_sync_trg ON fee_payments;
CREATE TRIGGER fee_payments_sync_trg
  AFTER INSERT OR UPDATE OR DELETE ON fee_payments
  FOR EACH ROW EXECUTE FUNCTION fee_payments_sync();

-- ------------------------------------------------------------
-- 9. Row level security.
--    Staff read the whole tenant; students read only their own money.
--    Only finance staff may write.
-- ------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['fee_heads', 'fee_plans', 'student_fee_overrides', 'fee_invoices', 'fee_payments']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO mai_graphql', t);
  END LOOP;
END $$;

ALTER TABLE fee_plan_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON fee_plan_items TO mai_graphql;

-- Configuration tables: tenant-wide read, finance-staff write.
DROP POLICY IF EXISTS mai_tenant_read ON fee_heads;
CREATE POLICY mai_tenant_read ON fee_heads FOR SELECT TO mai_graphql
  USING (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id());
DROP POLICY IF EXISTS mai_tenant_write ON fee_heads;
CREATE POLICY mai_tenant_write ON fee_heads FOR ALL TO mai_graphql
  USING (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id() AND rls_is_finance_staff()))
  WITH CHECK (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id() AND rls_is_finance_staff()));

DROP POLICY IF EXISTS mai_tenant_read ON fee_plans;
CREATE POLICY mai_tenant_read ON fee_plans FOR SELECT TO mai_graphql
  USING (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id());
DROP POLICY IF EXISTS mai_tenant_write ON fee_plans;
CREATE POLICY mai_tenant_write ON fee_plans FOR ALL TO mai_graphql
  USING (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id() AND rls_is_finance_staff()))
  WITH CHECK (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id() AND rls_is_finance_staff()));

-- Plan items inherit their tenant from the parent plan.
DROP POLICY IF EXISTS mai_tenant_read ON fee_plan_items;
CREATE POLICY mai_tenant_read ON fee_plan_items FOR SELECT TO mai_graphql
  USING (rls_is_mai_admin() OR EXISTS (
    SELECT 1 FROM fee_plans p
     WHERE p.id = fee_plan_items.fee_plan_id
       AND p.institution_id = rls_jwt_institution_id()));
DROP POLICY IF EXISTS mai_tenant_write ON fee_plan_items;
CREATE POLICY mai_tenant_write ON fee_plan_items FOR ALL TO mai_graphql
  USING (rls_is_mai_admin() OR (rls_is_finance_staff() AND EXISTS (
    SELECT 1 FROM fee_plans p
     WHERE p.id = fee_plan_items.fee_plan_id
       AND p.institution_id = rls_jwt_institution_id())))
  WITH CHECK (rls_is_mai_admin() OR (rls_is_finance_staff() AND EXISTS (
    SELECT 1 FROM fee_plans p
     WHERE p.id = fee_plan_items.fee_plan_id
       AND p.institution_id = rls_jwt_institution_id())));

DROP POLICY IF EXISTS mai_tenant_read ON student_fee_overrides;
CREATE POLICY mai_tenant_read ON student_fee_overrides FOR SELECT TO mai_graphql
  USING (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id()
         AND (rls_is_staff() OR student_id = rls_current_student_id())));
DROP POLICY IF EXISTS mai_tenant_write ON student_fee_overrides;
CREATE POLICY mai_tenant_write ON student_fee_overrides FOR ALL TO mai_graphql
  USING (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id() AND rls_is_finance_staff()))
  WITH CHECK (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id() AND rls_is_finance_staff()));

-- Money tables: students see only their own rows.
DROP POLICY IF EXISTS mai_tenant_read ON fee_invoices;
CREATE POLICY mai_tenant_read ON fee_invoices FOR SELECT TO mai_graphql
  USING (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id()
         AND (rls_is_staff() OR student_id = rls_current_student_id())));
DROP POLICY IF EXISTS mai_tenant_write ON fee_invoices;
CREATE POLICY mai_tenant_write ON fee_invoices FOR ALL TO mai_graphql
  USING (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id() AND rls_is_finance_staff()))
  WITH CHECK (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id() AND rls_is_finance_staff()));

DROP POLICY IF EXISTS mai_tenant_read ON fee_payments;
CREATE POLICY mai_tenant_read ON fee_payments FOR SELECT TO mai_graphql
  USING (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id()
         AND (rls_is_staff() OR student_id = rls_current_student_id())));
DROP POLICY IF EXISTS mai_tenant_write ON fee_payments;
CREATE POLICY mai_tenant_write ON fee_payments FOR ALL TO mai_graphql
  USING (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id() AND rls_is_finance_staff()))
  WITH CHECK (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id() AND rls_is_finance_staff()));

-- Tighten `fees` itself: the old policy let any tenant user read every
-- student's fees. Students are now limited to their own.
DROP POLICY IF EXISTS mai_tenant_all ON fees;
DROP POLICY IF EXISTS mai_tenant_read ON fees;
CREATE POLICY mai_tenant_read ON fees FOR SELECT TO mai_graphql
  USING (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id()
         AND (rls_is_staff() OR student_id = rls_current_student_id())));
DROP POLICY IF EXISTS mai_tenant_write ON fees;
CREATE POLICY mai_tenant_write ON fees FOR ALL TO mai_graphql
  USING (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id() AND rls_is_finance_staff()))
  WITH CHECK (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id() AND rls_is_finance_staff()));

-- ------------------------------------------------------------
-- 10. The admit-card fee gate must count outstanding balance, not the full
--     invoice amount — otherwise a partly-paid student stays blocked.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION admit_eligibility_for_exam(p_exam_id UUID)
RETURNS TABLE (
  student_id UUID, full_name TEXT, roll_number TEXT, photo_file_id UUID,
  attendance_pct NUMERIC, threshold NUMERIC, attendance_ok BOOLEAN,
  pending_fees NUMERIC, fee_gate BOOLEAN, fee_threshold NUMERIC, fee_ok BOOLEAN,
  eligible BOOLEAN, reason TEXT
) AS $$
DECLARE
  inst UUID;
  cls UUID;
  thr NUMERIC;
  fgate BOOLEAN;
  fthr NUMERIC;
BEGIN
  SELECT c.institution_id, e.class_id INTO inst, cls
  FROM exams e JOIN classes c ON c.id = e.class_id
  WHERE e.id = p_exam_id;

  SELECT COALESCE(s.attendance_threshold, 75),
         COALESCE(s.fee_block_enabled, false),
         COALESCE(s.fee_threshold, 0)
  INTO thr, fgate, fthr
  FROM institution_settings s WHERE s.institution_id = inst;
  thr := COALESCE(thr, 75);
  fgate := COALESCE(fgate, false);
  fthr := COALESCE(fthr, 0);

  RETURN QUERY
  WITH base AS (
    SELECT s.id AS sid, u.full_name AS name, s.roll_number AS roll, s.photo_file_id AS photo,
           COALESCE(st.percentage, 0) AS pct,
           COALESCE((SELECT SUM(f.amount - COALESCE(f.discount_amount, 0) - COALESCE(f.paid_amount, 0))
                       FROM fees f
                      WHERE f.student_id = s.id
                        AND f.status NOT IN ('paid', 'waived', 'cancelled')), 0) AS pend
    FROM students s
    JOIN users u ON u.id = s.user_id
    CROSS JOIN LATERAL student_attendance_stats(s.id) st
    WHERE s.class_id = cls
  )
  SELECT
    b.sid, b.name, b.roll, b.photo,
    b.pct, thr, (b.pct >= thr),
    b.pend, fgate, fthr, (NOT fgate OR b.pend <= fthr),
    (b.pct >= thr) AND (NOT fgate OR b.pend <= fthr),
    CASE
      WHEN (b.pct >= thr) AND (NOT fgate OR b.pend <= fthr) THEN 'Eligible'
      ELSE NULLIF(trim(both ' ;' FROM
        CASE WHEN b.pct < thr
             THEN format('Attendance %s%% below %s%%; ', b.pct, thr) ELSE '' END ||
        CASE WHEN fgate AND b.pend > fthr
             THEN format('Pending fees %s above limit %s', b.pend, fthr) ELSE '' END
      ), '')
    END
  FROM base b
  ORDER BY b.name;
END;
$$ LANGUAGE plpgsql STABLE;
COMMENT ON FUNCTION admit_eligibility_for_exam(UUID) IS E'@name admitEligibilityForExam';

-- ------------------------------------------------------------
-- 11. Seed the fee heads every Indian school needs, per institution.
--     Admins can add custom heads on top of these.
-- ------------------------------------------------------------
INSERT INTO fee_heads (institution_id, name, code, description, is_recurring, default_frequency, sort_order)
SELECT i.id, h.name, h.code, h.description, h.is_recurring, h.freq, h.sort_order
  FROM institutions i
  CROSS JOIN (VALUES
    ('Tuition Fee',    'TUITION',    'Core academic tuition',            TRUE,  'monthly',  10),
    ('Admission Fee',  'ADMISSION',  'One-time admission charge',        FALSE, 'one_time', 20),
    ('Exam Fee',       'EXAM',       'Examination and evaluation',       FALSE, 'yearly',   30),
    ('Bus Fee',        'BUS',        'School transport',                 TRUE,  'monthly',  40),
    ('Practical Fee',  'PRACTICAL',  'Laboratory and practical work',    FALSE, 'yearly',   50),
    ('Uniform Fee',    'UNIFORM',    'School uniform',                   FALSE, 'one_time', 60),
    ('Stationary Fee', 'STATIONARY', 'Books and stationery',             FALSE, 'yearly',   70),
    ('Library Fee',    'LIBRARY',    'Library membership and materials', FALSE, 'yearly',   80),
    ('Sports Fee',     'SPORTS',     'Sports and physical education',    FALSE, 'yearly',   90)
  ) AS h(name, code, description, is_recurring, freq, sort_order)
 WHERE NOT EXISTS (
   SELECT 1 FROM fee_heads fh
    WHERE fh.institution_id = i.id AND lower(fh.code) = lower(h.code)
 );
