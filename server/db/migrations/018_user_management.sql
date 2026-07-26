-- ============================================================
-- Migration 018 — Staff accounts and privilege escalation fix
--
-- Before this migration any authenticated tenant user could call the
-- SECURITY DEFINER registerUser mutation, or write to `users` directly, and
-- mint themselves an admin account: the users policy only checked the tenant,
-- and the register_* functions checked nothing at all.
--
-- The fix has two halves:
--   * an RLS split so only managers write to `users`, and
--   * a trigger that also covers the SECURITY DEFINER path, which runs as the
--     table owner and therefore bypasses RLS entirely.
-- ============================================================

CREATE OR REPLACE FUNCTION rls_can_manage_users() RETURNS boolean AS $$
  SELECT rls_jwt_role() IN ('mai_admin', 'admin', 'principal');
$$ LANGUAGE sql STABLE;

-- ------------------------------------------------------------
-- 1. Choke point for every account change.
--
--    session_user tells us how the statement arrived: PostGraphile connects
--    as mai_graphql, while trusted server-side work (boot seeding, onboarding
--    a brand-new institution, the platform admin routes) uses the superuser
--    pool and is left alone. session_user, unlike current_user, is not
--    rewritten by SECURITY DEFINER.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION users_guard_privileges() RETURNS TRIGGER AS $$
DECLARE
  caller TEXT := rls_jwt_role();
BEGIN
  IF session_user <> 'mai_graphql' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.role IS NOT DISTINCT FROM OLD.role
     AND NEW.institution_id IS NOT DISTINCT FROM OLD.institution_id
     AND NEW.username IS NOT DISTINCT FROM OLD.username
     AND NEW.password_hash IS NOT DISTINCT FROM OLD.password_hash
     AND rls_jwt_user_id() = NEW.id THEN
    RETURN NEW;  -- editing your own display name, nothing privileged
  END IF;

  IF NOT rls_can_manage_users() THEN
    RAISE EXCEPTION 'Not authorised to create or modify user accounts';
  END IF;
  IF NEW.role = 'mai_admin' AND caller <> 'mai_admin' THEN
    RAISE EXCEPTION 'Only a platform admin can create a platform admin';
  END IF;
  IF caller <> 'mai_admin'
     AND NEW.institution_id IS DISTINCT FROM rls_jwt_institution_id() THEN
    RAISE EXCEPTION 'Cannot create or move a user into another institution';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_guard_privileges_trg ON users;
CREATE TRIGGER users_guard_privileges_trg
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION users_guard_privileges();

-- ------------------------------------------------------------
-- 2. Split the users policy: everyone in the tenant may still read the
--    directory, only managers may write it.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS mai_tenant_all ON users;
DROP POLICY IF EXISTS mai_tenant_read ON users;
CREATE POLICY mai_tenant_read ON users FOR SELECT TO mai_graphql
  USING (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id());

DROP POLICY IF EXISTS mai_tenant_write ON users;
CREATE POLICY mai_tenant_write ON users FOR ALL TO mai_graphql
  USING (rls_is_mai_admin()
         OR (institution_id = rls_jwt_institution_id()
             AND (rls_can_manage_users() OR id = rls_jwt_user_id())))
  WITH CHECK (rls_is_mai_admin()
              OR (institution_id IS NOT NULL
                  AND institution_id = rls_jwt_institution_id()
                  AND role <> 'mai_admin'
                  AND (rls_can_manage_users() OR id = rls_jwt_user_id())));

-- ------------------------------------------------------------
-- 3. Staff account creation for the admin user-management page.
--    Students keep their richer register_student() path (class, parent
--    details); this covers admin, principal, opsadmin and teacher.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION register_staff_user(
  p_username TEXT,
  p_password TEXT,
  p_role TEXT,
  p_full_name TEXT,
  p_email TEXT DEFAULT NULL,
  p_subject_specialization TEXT DEFAULT NULL,
  p_qualification TEXT DEFAULT NULL
) RETURNS users AS $$
DECLARE
  new_user users;
  inst UUID := rls_jwt_institution_id();
BEGIN
  IF rls_jwt_role() NOT IN ('admin', 'principal') THEN
    RAISE EXCEPTION 'Only an admin or principal can create staff accounts';
  END IF;
  IF p_role NOT IN ('admin', 'principal', 'opsadmin', 'teacher') THEN
    RAISE EXCEPTION 'Unsupported staff role %. Students are created from the students page.', p_role;
  END IF;
  IF inst IS NULL THEN
    RAISE EXCEPTION 'No institution context';
  END IF;
  IF COALESCE(btrim(p_username), '') = '' OR COALESCE(btrim(p_password), '') = '' THEN
    RAISE EXCEPTION 'Username and password are required';
  END IF;
  IF length(p_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters';
  END IF;
  IF EXISTS (SELECT 1 FROM users u WHERE lower(u.username) = lower(btrim(p_username))) THEN
    RAISE EXCEPTION 'That username is already taken';
  END IF;

  INSERT INTO users (username, password_hash, role, full_name, institution_id)
  VALUES (btrim(p_username), crypt(p_password, gen_salt('bf')), p_role::user_role,
          p_full_name, inst)
  RETURNING * INTO new_user;

  INSERT INTO profiles (user_id) VALUES (new_user.id);

  IF p_role = 'teacher' THEN
    INSERT INTO teachers (user_id, subject_specialization, qualification)
    VALUES (new_user.id, p_subject_specialization, p_qualification);
    IF p_email IS NOT NULL THEN
      UPDATE profiles SET email = p_email WHERE user_id = new_user.id;
    END IF;
  END IF;

  RETURN new_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION register_staff_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  IS E'@name registerStaffUser\nCreate an admin, principal, opsadmin or teacher account in the caller''s institution.';

-- ------------------------------------------------------------
-- 4. Password reset and enable/disable, so an admin can run the account
--    without touching password_hash through the generic mutation.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_user_password(
  p_user_id UUID,
  p_password TEXT
) RETURNS TABLE (id UUID) AS $$
DECLARE
  target users;
BEGIN
  IF rls_jwt_role() NOT IN ('admin', 'principal') THEN
    RAISE EXCEPTION 'Only an admin or principal can reset a password';
  END IF;
  IF length(COALESCE(p_password, '')) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters';
  END IF;

  SELECT * INTO target FROM users u WHERE u.id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  IF target.institution_id IS DISTINCT FROM rls_jwt_institution_id() THEN
    RAISE EXCEPTION 'User belongs to another institution';
  END IF;
  IF target.role = 'mai_admin' THEN
    RAISE EXCEPTION 'Cannot reset a platform admin password';
  END IF;

  UPDATE users u SET password_hash = crypt(p_password, gen_salt('bf'))
   WHERE u.id = p_user_id;

  RETURN QUERY SELECT p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION set_user_password(UUID, TEXT)
  IS E'@name setUserPassword\nReset another user''s password within your institution.';

CREATE OR REPLACE FUNCTION set_user_login_enabled(
  p_user_id UUID,
  p_enabled BOOLEAN
) RETURNS TABLE (id UUID, login_enabled BOOLEAN) AS $$
DECLARE
  target users;
BEGIN
  IF rls_jwt_role() NOT IN ('admin', 'principal') THEN
    RAISE EXCEPTION 'Only an admin or principal can enable or disable an account';
  END IF;

  SELECT * INTO target FROM users u WHERE u.id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  IF target.institution_id IS DISTINCT FROM rls_jwt_institution_id() THEN
    RAISE EXCEPTION 'User belongs to another institution';
  END IF;
  IF target.id = rls_jwt_user_id() THEN
    RAISE EXCEPTION 'You cannot disable your own account';
  END IF;

  UPDATE users u SET login_enabled = p_enabled WHERE u.id = p_user_id;
  RETURN QUERY SELECT p_user_id, p_enabled;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION set_user_login_enabled(UUID, BOOLEAN)
  IS E'@name setUserLoginEnabled\nEnable or disable sign-in for a user in your institution.';
