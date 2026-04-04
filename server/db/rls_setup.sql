-- Row-level security for multi-tenant GraphQL (role: mai_graphql).
-- Run after schema + seed. Requires password set via ALTER ROLE from application.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mai_graphql') THEN
    CREATE ROLE mai_graphql LOGIN;
  END IF;
END
$$;

DO $grant$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO mai_graphql', current_database());
END
$grant$;
GRANT USAGE ON SCHEMA public TO mai_graphql;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mai_graphql;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mai_graphql;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO mai_graphql;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mai_graphql;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO mai_graphql;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO mai_graphql;

-- Policies (drop first for idempotent re-run on same DB without full schema reset)
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
    'institutions', 'users', 'profiles', 'classes', 'students', 'teachers',
    'attendance', 'fees', 'exams', 'results', 'reports', 'meetings', 'announcements'
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS mai_tenant_all ON public.%I', t);
  END LOOP;
END $$;

ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- institutions
CREATE POLICY mai_tenant_all ON institutions FOR ALL TO mai_graphql
  USING (rls_is_mai_admin() OR id = rls_jwt_institution_id())
  WITH CHECK (rls_is_mai_admin() OR id = rls_jwt_institution_id());

-- users (tenant rows only; mai_admin rows have institution_id NULL — visible only to mai_admin)
CREATE POLICY mai_tenant_all ON users FOR ALL TO mai_graphql
  USING (
    rls_is_mai_admin()
    OR institution_id = rls_jwt_institution_id()
  )
  WITH CHECK (
    rls_is_mai_admin()
    OR (institution_id IS NOT NULL AND institution_id = rls_jwt_institution_id() AND role <> 'mai_admin')
  );

-- profiles: same institution as user
CREATE POLICY mai_tenant_all ON profiles FOR ALL TO mai_graphql
  USING (
    rls_is_mai_admin()
    OR EXISTS (
      SELECT 1 FROM users u WHERE u.id = profiles.user_id AND u.institution_id = rls_jwt_institution_id()
    )
  )
  WITH CHECK (
    rls_is_mai_admin()
    OR EXISTS (
      SELECT 1 FROM users u WHERE u.id = profiles.user_id AND u.institution_id = rls_jwt_institution_id()
    )
  );

CREATE POLICY mai_tenant_all ON classes FOR ALL TO mai_graphql
  USING (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id())
  WITH CHECK (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id());

CREATE POLICY mai_tenant_all ON students FOR ALL TO mai_graphql
  USING (
    rls_is_mai_admin()
    OR EXISTS (
      SELECT 1 FROM users u WHERE u.id = students.user_id AND u.institution_id = rls_jwt_institution_id()
    )
  )
  WITH CHECK (
    rls_is_mai_admin()
    OR (
      EXISTS (SELECT 1 FROM users u WHERE u.id = students.user_id AND u.institution_id = rls_jwt_institution_id())
      AND EXISTS (
        SELECT 1 FROM classes c
        WHERE c.id = students.class_id AND c.institution_id = rls_jwt_institution_id()
      )
    )
  );

CREATE POLICY mai_tenant_all ON teachers FOR ALL TO mai_graphql
  USING (
    rls_is_mai_admin()
    OR EXISTS (
      SELECT 1 FROM users u WHERE u.id = teachers.user_id AND u.institution_id = rls_jwt_institution_id()
    )
  )
  WITH CHECK (
    rls_is_mai_admin()
    OR EXISTS (
      SELECT 1 FROM users u WHERE u.id = teachers.user_id AND u.institution_id = rls_jwt_institution_id()
    )
  );

CREATE POLICY mai_tenant_all ON attendance FOR ALL TO mai_graphql
  USING (
    rls_is_mai_admin()
    OR EXISTS (
      SELECT 1 FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = attendance.student_id AND u.institution_id = rls_jwt_institution_id()
    )
  )
  WITH CHECK (
    rls_is_mai_admin()
    OR EXISTS (
      SELECT 1 FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = attendance.student_id AND u.institution_id = rls_jwt_institution_id()
    )
  );

CREATE POLICY mai_tenant_all ON fees FOR ALL TO mai_graphql
  USING (
    rls_is_mai_admin()
    OR EXISTS (
      SELECT 1 FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = fees.student_id AND u.institution_id = rls_jwt_institution_id()
    )
  )
  WITH CHECK (
    rls_is_mai_admin()
    OR EXISTS (
      SELECT 1 FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = fees.student_id AND u.institution_id = rls_jwt_institution_id()
    )
  );

CREATE POLICY mai_tenant_all ON exams FOR ALL TO mai_graphql
  USING (
    rls_is_mai_admin()
    OR EXISTS (
      SELECT 1 FROM classes c WHERE c.id = exams.class_id AND c.institution_id = rls_jwt_institution_id()
    )
  )
  WITH CHECK (
    rls_is_mai_admin()
    OR EXISTS (
      SELECT 1 FROM classes c WHERE c.id = exams.class_id AND c.institution_id = rls_jwt_institution_id()
    )
  );

CREATE POLICY mai_tenant_all ON results FOR ALL TO mai_graphql
  USING (
    rls_is_mai_admin()
    OR EXISTS (
      SELECT 1 FROM exams e
      JOIN classes c ON c.id = e.class_id
      WHERE e.id = results.exam_id AND c.institution_id = rls_jwt_institution_id()
    )
  )
  WITH CHECK (
    rls_is_mai_admin()
    OR EXISTS (
      SELECT 1 FROM exams e
      JOIN classes c ON c.id = e.class_id
      WHERE e.id = results.exam_id AND c.institution_id = rls_jwt_institution_id()
    )
  );

CREATE POLICY mai_tenant_all ON reports FOR ALL TO mai_graphql
  USING (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id())
  WITH CHECK (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id());

CREATE POLICY mai_tenant_all ON meetings FOR ALL TO mai_graphql
  USING (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id())
  WITH CHECK (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id());

CREATE POLICY mai_tenant_all ON announcements FOR ALL TO mai_graphql
  USING (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id())
  WITH CHECK (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id());
