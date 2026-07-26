-- ============================================================
-- Migration 014 — Fee generation and collection procedures
--
-- Bulk-raises invoices from a class fee plan and records payments against
-- invoice lines. Both are SECURITY DEFINER so they can write across a whole
-- class, and both re-check the caller's role and tenant explicitly because
-- SECURITY DEFINER bypasses RLS.
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS fee_invoice_number_seq;
CREATE SEQUENCE IF NOT EXISTS fee_receipt_number_seq;

-- ------------------------------------------------------------
-- Resolve what a given student actually owes for one fee head, applying any
-- active override (flat amount, percentage discount or fixed discount).
-- Returns the gross amount and the discount to subtract.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fee_amount_for_student(
  p_student_id UUID,
  p_fee_head_id UUID,
  p_base_amount NUMERIC
) RETURNS TABLE (gross NUMERIC, discount NUMERIC) AS $$
DECLARE
  ov RECORD;
  v_gross NUMERIC(12, 2) := p_base_amount;
  v_disc NUMERIC(12, 2) := 0;
BEGIN
  -- A head-specific override wins over a blanket (fee_head_id IS NULL) one.
  SELECT * INTO ov
    FROM student_fee_overrides o
   WHERE o.student_id = p_student_id
     AND o.is_active
     AND (o.fee_head_id = p_fee_head_id OR o.fee_head_id IS NULL)
     AND (o.valid_from IS NULL OR o.valid_from <= CURRENT_DATE)
     AND (o.valid_to IS NULL OR o.valid_to >= CURRENT_DATE)
   ORDER BY (o.fee_head_id IS NOT NULL) DESC
   LIMIT 1;

  IF FOUND THEN
    IF ov.override_amount IS NOT NULL THEN
      v_gross := ov.override_amount;
    END IF;
    IF ov.discount_percent IS NOT NULL THEN
      v_disc := ROUND(v_gross * ov.discount_percent / 100, 2);
    END IF;
    IF ov.discount_amount IS NOT NULL THEN
      v_disc := LEAST(v_gross, v_disc + ov.discount_amount);
    END IF;
  END IF;

  RETURN QUERY SELECT v_gross, v_disc;
END;
$$ LANGUAGE plpgsql STABLE;
COMMENT ON FUNCTION fee_amount_for_student(UUID, UUID, NUMERIC) IS E'@omit';

-- ------------------------------------------------------------
-- Raise one invoice per student covered by a plan, for a given period.
-- Idempotent: students who already have an invoice for
-- (plan, period) are skipped, so re-running is safe.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_invoices_for_plan(
  p_plan_id UUID,
  p_period_label TEXT,
  p_due_date DATE DEFAULT NULL,
  p_frequency TEXT DEFAULT NULL
) RETURNS TABLE (
  invoices_created INT,
  lines_created INT,
  students_skipped INT,
  total_billed NUMERIC
) AS $$
DECLARE
  plan RECORD;
  stu RECORD;
  item RECORD;
  calc RECORD;
  v_invoice UUID;
  v_due DATE;
  v_created INT := 0;
  v_lines INT := 0;
  v_skipped INT := 0;
  v_total NUMERIC(12, 2) := 0;
BEGIN
  IF rls_jwt_role() NOT IN ('admin', 'principal', 'opsadmin') THEN
    RAISE EXCEPTION 'Not authorised to generate invoices';
  END IF;

  SELECT * INTO plan FROM fee_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fee plan not found';
  END IF;
  IF NOT rls_is_mai_admin() AND plan.institution_id <> rls_jwt_institution_id() THEN
    RAISE EXCEPTION 'Fee plan belongs to another institution';
  END IF;
  IF NOT plan.is_active THEN
    RAISE EXCEPTION 'Fee plan is inactive';
  END IF;

  v_due := COALESCE(p_due_date, CURRENT_DATE + 15);

  -- A plan with no class applies to every class in the institution.
  FOR stu IN
    SELECT s.id
      FROM students s
      JOIN users u ON u.id = s.user_id
     WHERE u.institution_id = plan.institution_id
       AND (plan.class_id IS NULL OR s.class_id = plan.class_id)
  LOOP
    IF EXISTS (
      SELECT 1 FROM fee_invoices i
       WHERE i.student_id = stu.id
         AND i.fee_plan_id = p_plan_id
         AND i.period_label = p_period_label
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO fee_invoices (
      institution_id, student_id, fee_plan_id, academic_session_id,
      invoice_number, period_label, issue_date, due_date, status, created_by
    ) VALUES (
      plan.institution_id, stu.id, p_plan_id, plan.academic_session_id,
      'INV-' || to_char(CURRENT_DATE, 'YYYY') || '-' ||
        lpad(nextval('fee_invoice_number_seq')::TEXT, 6, '0'),
      p_period_label, CURRENT_DATE, v_due, 'issued', rls_jwt_user_id()
    )
    RETURNING id INTO v_invoice;

    FOR item IN
      SELECT pi.*, fh.name AS head_name
        FROM fee_plan_items pi
        JOIN fee_heads fh ON fh.id = pi.fee_head_id
       WHERE pi.fee_plan_id = p_plan_id
         AND NOT pi.is_optional
         AND (p_frequency IS NULL OR pi.frequency = p_frequency)
       ORDER BY pi.sort_order, fh.sort_order
    LOOP
      SELECT * INTO calc
        FROM fee_amount_for_student(stu.id, item.fee_head_id, item.amount);

      INSERT INTO fees (
        student_id, institution_id, invoice_id, fee_head_id, academic_session_id,
        amount, discount_amount, description, due_date, status, period_label
      ) VALUES (
        stu.id, plan.institution_id, v_invoice, item.fee_head_id, plan.academic_session_id,
        calc.gross, calc.discount,
        item.head_name || CASE WHEN p_period_label IS NULL THEN '' ELSE ' - ' || p_period_label END,
        v_due, 'pending', p_period_label
      );

      v_lines := v_lines + 1;
      v_total := v_total + (calc.gross - calc.discount);
    END LOOP;

    -- Roll the new lines up into the invoice header.
    UPDATE fee_invoices i
       SET subtotal = agg.subtotal,
           discount_total = agg.discount_total,
           total = agg.total,
           updated_at = NOW()
      FROM (
        SELECT COALESCE(SUM(f.amount), 0) AS subtotal,
               COALESCE(SUM(f.discount_amount), 0) AS discount_total,
               COALESCE(SUM(f.amount - f.discount_amount), 0) AS total
          FROM fees f WHERE f.invoice_id = v_invoice
      ) agg
     WHERE i.id = v_invoice;

    v_created := v_created + 1;
  END LOOP;

  RETURN QUERY SELECT v_created, v_lines, v_skipped, v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION generate_invoices_for_plan(UUID, TEXT, DATE, TEXT)
  IS E'@name generateInvoicesForPlan\nRaise invoices for every student covered by a fee plan.';

-- ------------------------------------------------------------
-- Record a payment against one fee line. Returns the receipt number so the
-- caller can print it; pass an existing receipt number to add another line
-- to the same receipt.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_fee_payment(
  p_fee_id UUID,
  p_amount NUMERIC,
  p_mode TEXT DEFAULT 'cash',
  p_paid_on DATE DEFAULT NULL,
  p_reference_no TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_receipt_number TEXT DEFAULT NULL
) RETURNS TABLE (
  payment_id UUID,
  receipt_number TEXT,
  fee_status TEXT,
  fee_balance NUMERIC
) AS $$
DECLARE
  f RECORD;
  v_receipt TEXT;
  v_id UUID;
BEGIN
  IF rls_jwt_role() NOT IN ('admin', 'principal', 'opsadmin') THEN
    RAISE EXCEPTION 'Not authorised to record payments';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  SELECT * INTO f FROM fees WHERE id = p_fee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fee record not found';
  END IF;
  IF NOT rls_is_mai_admin() AND f.institution_id IS DISTINCT FROM rls_jwt_institution_id() THEN
    RAISE EXCEPTION 'Fee record belongs to another institution';
  END IF;
  IF f.status IN ('cancelled', 'waived') THEN
    RAISE EXCEPTION 'Cannot collect against a % fee', f.status;
  END IF;
  IF p_amount > (f.amount - COALESCE(f.discount_amount, 0) - COALESCE(f.paid_amount, 0)) THEN
    RAISE EXCEPTION 'Payment exceeds the outstanding balance';
  END IF;

  v_receipt := COALESCE(
    p_receipt_number,
    'RCP-' || to_char(CURRENT_DATE, 'YYYY') || '-' ||
      lpad(nextval('fee_receipt_number_seq')::TEXT, 6, '0')
  );

  INSERT INTO fee_payments (
    institution_id, fee_id, invoice_id, student_id, receipt_number,
    amount, paid_on, mode, reference_no, notes, collected_by
  ) VALUES (
    f.institution_id, p_fee_id, f.invoice_id, f.student_id, v_receipt,
    p_amount, COALESCE(p_paid_on, CURRENT_DATE), p_mode, p_reference_no, p_notes,
    rls_jwt_user_id()
  )
  RETURNING id INTO v_id;

  -- The trigger on fee_payments has already refreshed the aggregates.
  RETURN QUERY
    SELECT v_id, v_receipt, f2.status, f2.balance
      FROM fees f2 WHERE f2.id = p_fee_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION record_fee_payment(UUID, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT)
  IS E'@name recordFeePayment\nRecord a full or partial payment against a fee line.';

-- ------------------------------------------------------------
-- Collection summary for dashboards: one row per status bucket.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fee_collection_summary(p_institution_id UUID DEFAULT NULL)
RETURNS TABLE (
  total_billed NUMERIC,
  total_collected NUMERIC,
  total_outstanding NUMERIC,
  total_overdue NUMERIC,
  collected_today NUMERIC,
  collected_this_month NUMERIC,
  invoice_count INT,
  defaulter_count INT
) AS $$
DECLARE
  inst UUID;
BEGIN
  inst := COALESCE(p_institution_id, rls_jwt_institution_id());

  RETURN QUERY
  SELECT
    COALESCE((SELECT SUM(f.amount - f.discount_amount) FROM fees f
               WHERE f.institution_id = inst AND f.status <> 'cancelled'), 0),
    COALESCE((SELECT SUM(f.paid_amount) FROM fees f
               WHERE f.institution_id = inst AND f.status <> 'cancelled'), 0),
    COALESCE((SELECT SUM(f.balance) FROM fees f
               WHERE f.institution_id = inst
                 AND f.status NOT IN ('paid', 'cancelled', 'waived')), 0),
    COALESCE((SELECT SUM(f.balance) FROM fees f
               WHERE f.institution_id = inst AND f.status = 'overdue'), 0),
    COALESCE((SELECT SUM(p.amount) FROM fee_payments p
               WHERE p.institution_id = inst AND NOT p.is_cancelled
                 AND p.paid_on = CURRENT_DATE), 0),
    COALESCE((SELECT SUM(p.amount) FROM fee_payments p
               WHERE p.institution_id = inst AND NOT p.is_cancelled
                 AND p.paid_on >= date_trunc('month', CURRENT_DATE)::DATE), 0),
    COALESCE((SELECT COUNT(*)::INT FROM fee_invoices i
               WHERE i.institution_id = inst AND i.status <> 'cancelled'), 0),
    COALESCE((SELECT COUNT(DISTINCT f.student_id)::INT FROM fees f
               WHERE f.institution_id = inst AND f.status = 'overdue'), 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
COMMENT ON FUNCTION fee_collection_summary(UUID)
  IS E'@name feeCollectionSummary\nHeadline fee collection figures for the current institution.';

-- ------------------------------------------------------------
-- Outstanding dues per class, for the ops dashboard.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fee_outstanding_by_class(p_institution_id UUID DEFAULT NULL)
RETURNS TABLE (
  class_id UUID,
  class_name TEXT,
  student_count INT,
  billed NUMERIC,
  collected NUMERIC,
  outstanding NUMERIC
) AS $$
DECLARE
  inst UUID;
BEGIN
  inst := COALESCE(p_institution_id, rls_jwt_institution_id());

  RETURN QUERY
  SELECT c.id, c.name,
         COUNT(DISTINCT f.student_id)::INT,
         COALESCE(SUM(f.amount - f.discount_amount), 0),
         COALESCE(SUM(f.paid_amount), 0),
         COALESCE(SUM(f.balance) FILTER (WHERE f.status NOT IN ('paid', 'cancelled', 'waived')), 0)
    FROM classes c
    LEFT JOIN students s ON s.class_id = c.id
    LEFT JOIN fees f ON f.student_id = s.id AND f.status <> 'cancelled'
   WHERE c.institution_id = inst
   GROUP BY c.id, c.name
   ORDER BY c.name;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
COMMENT ON FUNCTION fee_outstanding_by_class(UUID)
  IS E'@name feeOutstandingByClass\nBilled, collected and outstanding totals per class.';
