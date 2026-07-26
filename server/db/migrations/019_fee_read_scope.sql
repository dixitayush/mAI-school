-- ============================================================
-- Migration 019 — Narrow who can read the fee ledger
--
-- 013 granted read on fees, invoices, payments and concessions to
-- rls_is_staff(), which includes teachers: any teacher could pull the whole
-- school's receivables. No teacher-facing screen needs it, so reads now match
-- writes — finance staff, plus the student for their own rows.
-- ============================================================

DROP POLICY IF EXISTS mai_tenant_read ON fees;
CREATE POLICY mai_tenant_read ON fees FOR SELECT TO mai_graphql
  USING (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id()
         AND (rls_is_finance_staff() OR student_id = rls_current_student_id())));

DROP POLICY IF EXISTS mai_tenant_read ON fee_invoices;
CREATE POLICY mai_tenant_read ON fee_invoices FOR SELECT TO mai_graphql
  USING (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id()
         AND (rls_is_finance_staff() OR student_id = rls_current_student_id())));

DROP POLICY IF EXISTS mai_tenant_read ON fee_payments;
CREATE POLICY mai_tenant_read ON fee_payments FOR SELECT TO mai_graphql
  USING (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id()
         AND (rls_is_finance_staff() OR student_id = rls_current_student_id())));

DROP POLICY IF EXISTS mai_tenant_read ON student_fee_overrides;
CREATE POLICY mai_tenant_read ON student_fee_overrides FOR SELECT TO mai_graphql
  USING (rls_is_mai_admin() OR (institution_id = rls_jwt_institution_id()
         AND (rls_is_finance_staff() OR student_id = rls_current_student_id())));

-- The admit-card gate sums outstanding fees for a whole class, so it has to
-- outlive the reader's own access to the ledger. It only ever returns the
-- aggregate for the exam's class, never individual charges.
ALTER FUNCTION admit_eligibility_for_exam(UUID) SECURITY DEFINER;
