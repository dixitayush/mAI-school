-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean up existing schema
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS meetings CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS results CASCADE;
DROP TABLE IF EXISTS exams CASCADE;
DROP TABLE IF EXISTS fees CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS institutions CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- 0. Tenants (institutes)
CREATE TYPE user_role AS ENUM ('mai_admin', 'admin', 'principal', 'teacher', 'student');

-- JWT helpers for RLS + SECURITY DEFINER checks (set by PostGraphile pgSettings per request)
CREATE OR REPLACE FUNCTION rls_jwt_institution_id() RETURNS uuid AS $$
  SELECT NULLIF(btrim(COALESCE(current_setting('jwt.claims.institution_id', true), '')), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION rls_is_mai_admin() RETURNS boolean AS $$
  SELECT COALESCE(NULLIF(btrim(COALESCE(current_setting('jwt.claims.role', true), '')), ''), '') = 'mai_admin';
$$ LANGUAGE sql STABLE;

CREATE TABLE institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  estimated_students INT CHECK (estimated_students IS NULL OR (estimated_students >= 0 AND estimated_students <= 500000)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT institutions_slug_format CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$')
);

-- 1. Users (scoped to an institution except platform mai_admin)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL,
  full_name TEXT NOT NULL,
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  login_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT users_mai_admin_institution CHECK (
    (role = 'mai_admin' AND institution_id IS NULL) OR (role <> 'mai_admin' AND institution_id IS NOT NULL)
  ),
  CONSTRAINT users_username_per_institution UNIQUE (institution_id, username)
);

CREATE UNIQUE INDEX users_mai_admin_username ON users (username) WHERE role = 'mai_admin';

-- 2. Profiles
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  photo_url TEXT,
  email TEXT,
  phone TEXT,
  address TEXT
);

-- 3. Core Tables
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade_level INT NOT NULL,
  teacher_id UUID REFERENCES users(id),
  CONSTRAINT classes_name_per_institution UNIQUE (institution_id, name)
);

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id),
  parent_name TEXT,
  parent_email TEXT,
  parent_phone TEXT,
  parent_address TEXT,
  dob DATE,
  enrollment_date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject_specialization TEXT,
  qualification TEXT,
  joining_date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT CHECK (status IN ('present', 'absent', 'late')),
  remarks TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, date)
);

-- 4. Fees Management
CREATE TABLE fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  status TEXT CHECK (status IN ('paid', 'pending', 'overdue')) DEFAULT 'pending',
  payment_date DATE,
  invoice_number TEXT UNIQUE
);

-- 5. Exams & Results
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id),
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  exam_date DATE NOT NULL,
  total_marks INT NOT NULL,
  description TEXT
);

CREATE TABLE results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id),
  marks_obtained INT NOT NULL,
  grade TEXT,
  feedback TEXT
);

-- 6. Reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  type TEXT CHECK (type IN ('student_performance', 'class_attendance', 'financial')),
  generated_by UUID REFERENCES users(id)
);

-- 7. Meetings (New)
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  host_id UUID REFERENCES users(id),
  guest_id UUID REFERENCES users(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT CHECK (status IN ('scheduled', 'completed', 'cancelled')) DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helper Functions
CREATE OR REPLACE FUNCTION register_user(
  username TEXT,
  password TEXT,
  role user_role,
  full_name TEXT,
  p_institution_id UUID DEFAULT NULL
) RETURNS users AS $$
DECLARE
  new_user users;
BEGIN
  IF role = 'mai_admin' THEN
    IF p_institution_id IS NOT NULL THEN
      RAISE EXCEPTION 'mai_admin cannot belong to an institution';
    END IF;
    INSERT INTO users (username, password_hash, role, full_name, institution_id)
    VALUES (username, crypt(password, gen_salt('bf')), role, full_name, NULL)
    RETURNING * INTO new_user;
  ELSE
    IF p_institution_id IS NULL THEN
      RAISE EXCEPTION 'institution required for role %', role;
    END IF;
    INSERT INTO users (username, password_hash, role, full_name, institution_id)
    VALUES (username, crypt(password, gen_salt('bf')), role, full_name, p_institution_id)
    RETURNING * INTO new_user;
  END IF;

  INSERT INTO profiles (user_id) VALUES (new_user.id);

  IF role = 'student' THEN
    INSERT INTO students (user_id) VALUES (new_user.id);
  ELSIF role = 'teacher' THEN
    INSERT INTO teachers (user_id) VALUES (new_user.id);
  END IF;

  RETURN new_user;
END;
$$ LANGUAGE plpgsql STRICT SECURITY DEFINER;

CREATE OR REPLACE FUNCTION register_student(
  username TEXT,
  password TEXT,
  full_name TEXT,
  email TEXT DEFAULT NULL,
  class_id UUID DEFAULT NULL,
  parent_name TEXT DEFAULT NULL,
  parent_email TEXT DEFAULT NULL,
  parent_phone TEXT DEFAULT NULL,
  parent_address TEXT DEFAULT NULL
) RETURNS students AS $$
DECLARE
  new_user users;
  new_student students;
  inst_id UUID;
BEGIN
  IF class_id IS NULL THEN
    RAISE EXCEPTION 'class_id is required for student registration';
  END IF;
  SELECT institution_id INTO inst_id FROM classes WHERE id = class_id;
  IF inst_id IS NULL THEN
    RAISE EXCEPTION 'class not found';
  END IF;

  IF NOT rls_is_mai_admin() AND rls_jwt_institution_id() IS NOT NULL THEN
    IF inst_id IS DISTINCT FROM rls_jwt_institution_id() THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;

  INSERT INTO users (username, password_hash, role, full_name, institution_id)
  VALUES (username, crypt(password, gen_salt('bf')), 'student', full_name, inst_id)
  RETURNING * INTO new_user;

  INSERT INTO profiles (user_id, email) VALUES (new_user.id, email);

  INSERT INTO students (
    user_id, class_id, parent_name, parent_email, parent_phone, parent_address
  )
  VALUES (
    new_user.id, class_id, parent_name, parent_email, parent_phone, parent_address
  )
  RETURNING * INTO new_student;

  RETURN new_student;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION register_student(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT) IS E'@name registerStudent\nRegister a new student';

CREATE OR REPLACE FUNCTION register_teacher(
  username TEXT,
  password TEXT,
  full_name TEXT,
  p_institution_id UUID,
  email TEXT DEFAULT NULL,
  subject_specialization TEXT DEFAULT NULL,
  qualification TEXT DEFAULT NULL
) RETURNS teachers AS $$
DECLARE
  new_user users;
  new_teacher teachers;
BEGIN
  IF p_institution_id IS NULL THEN
    RAISE EXCEPTION 'institution required for teacher registration';
  END IF;

  IF NOT rls_is_mai_admin() AND rls_jwt_institution_id() IS NOT NULL THEN
    IF p_institution_id IS DISTINCT FROM rls_jwt_institution_id() THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;

  INSERT INTO users (username, password_hash, role, full_name, institution_id)
  VALUES (username, crypt(password, gen_salt('bf')), 'teacher', full_name, p_institution_id)
  RETURNING * INTO new_user;

  INSERT INTO profiles (user_id, email) VALUES (new_user.id, email);

  INSERT INTO teachers (user_id, subject_specialization, qualification)
  VALUES (new_user.id, subject_specialization, qualification)
  RETURNING * INTO new_teacher;

  RETURN new_teacher;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION register_teacher(TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT) IS E'@name registerTeacher\nRegister a new teacher';

-- Permissions for PostGraphile to work smoothly
GRANT USAGE ON SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres;

-- Explicitly allow anonymous access (if we were using a different role, but we use postgres so it's fine)
-- But ensuring RLS doesn't block if we accidentally enable it later
ALTER TABLE institutions DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE classes DISABLE ROW LEVEL SECURITY;
ALTER TABLE students DISABLE ROW LEVEL SECURITY;
ALTER TABLE teachers DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE fees DISABLE ROW LEVEL SECURITY;
ALTER TABLE exams DISABLE ROW LEVEL SECURITY;
ALTER TABLE results DISABLE ROW LEVEL SECURITY;
ALTER TABLE reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE meetings DISABLE ROW LEVEL SECURITY;

-- Seed: default tenant + platform admin + institute admin
DO $$
DECLARE
  demo_id UUID;
  mai_id UUID;
BEGIN
  INSERT INTO institutions (name, slug) VALUES ('Demo Academy', 'demo') RETURNING id INTO demo_id;

  INSERT INTO users (username, password_hash, role, full_name, institution_id, login_enabled)
  VALUES (
    'mai_admin',
    crypt('mai_admin123', gen_salt('bf')),
    'mai_admin',
    'MAI Technical Admin',
    NULL,
    TRUE
  )
  RETURNING id INTO mai_id;

  INSERT INTO profiles (user_id) VALUES (mai_id);

  PERFORM register_user('admin', 'admin123', 'admin', 'Institute Administrator', demo_id);

  INSERT INTO classes (name, grade_level, institution_id) VALUES
    ('10-A', 10, demo_id),
    ('10-B', 10, demo_id),
    ('11-A', 11, demo_id),
    ('11-B', 11, demo_id),
    ('12-A', 12, demo_id);
END $$;
-- Custom Mutations to bypass missing auto-generation

-- 1. Create Exam
CREATE OR REPLACE FUNCTION create_exam(
  class_id UUID,
  title TEXT,
  subject TEXT,
  exam_date DATE,
  total_marks INT,
  description TEXT DEFAULT NULL
) RETURNS exams AS $$
  INSERT INTO exams (class_id, title, subject, exam_date, total_marks, description)
  VALUES (class_id, title, subject, exam_date, total_marks, description)
  RETURNING *;
$$ LANGUAGE SQL VOLATILE STRICT SECURITY DEFINER;

COMMENT ON FUNCTION create_exam(UUID, TEXT, TEXT, DATE, INT, TEXT) IS E'@omit';
-- Exposed as table mutation createExam only (avoids duplicate CreateExamPayload).

-- 2. Class create: use PostGraphile native createClass (table insert); avoid duplicate @name createClass proc.

-- 3. Update Class
CREATE OR REPLACE FUNCTION update_class(
  id UUID,
  name TEXT,
  grade_level INT,
  teacher_id UUID DEFAULT NULL
) RETURNS classes AS $$
  UPDATE classes
  SET name = $2, grade_level = $3, teacher_id = $4
  WHERE id = $1
  RETURNING *;
$$ LANGUAGE SQL VOLATILE STRICT SECURITY DEFINER;

COMMENT ON FUNCTION update_class(UUID, TEXT, INT, UUID) IS E'@omit';

-- 4. Delete Class
CREATE OR REPLACE FUNCTION delete_class(
  id UUID
) RETURNS UUID AS $$
DECLARE
  deleted_id UUID;
BEGIN
  DELETE FROM classes WHERE classes.id = $1 RETURNING classes.id INTO deleted_id;
  RETURN deleted_id;
END;
$$ LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER;

COMMENT ON FUNCTION delete_class(UUID) IS E'@omit';

-- 5. Delete Student (Fix missing deleteStudentById)
CREATE OR REPLACE FUNCTION delete_student(
  id UUID
) RETURNS UUID AS $$
DECLARE
  deleted_id UUID;
BEGIN
  DELETE FROM students WHERE students.id = $1 RETURNING students.id INTO deleted_id;
  RETURN deleted_id;
END;
$$ LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER;

COMMENT ON FUNCTION delete_student(UUID) IS E'@omit';
-- Custom Mutations to bypass missing auto-generation

-- 1. Register Exam
CREATE OR REPLACE FUNCTION register_exam(
  class_id UUID,
  title TEXT,
  subject TEXT,
  exam_date DATE,
  total_marks INT,
  description TEXT DEFAULT NULL
) RETURNS exams AS $$
  INSERT INTO exams (class_id, title, subject, exam_date, total_marks, description)
  VALUES (class_id, title, subject, exam_date, total_marks, description)
  RETURNING *;
$$ LANGUAGE SQL VOLATILE STRICT SECURITY DEFINER;

COMMENT ON FUNCTION register_exam(UUID, TEXT, TEXT, DATE, INT, TEXT) IS E'@name registerExam\nRegister a new exam';

-- 2. register_class removed — use native createClass to avoid duplicate GraphQL mutations.

-- 3. Update Class (rename to modifyClass to be safe)
CREATE OR REPLACE FUNCTION modify_class(
  id UUID,
  name TEXT,
  grade_level INT,
  teacher_id UUID DEFAULT NULL
) RETURNS classes AS $$
  UPDATE classes
  SET name = $2, grade_level = $3, teacher_id = $4
  WHERE id = $1
  RETURNING *;
$$ LANGUAGE SQL VOLATILE STRICT SECURITY DEFINER;

COMMENT ON FUNCTION modify_class(UUID, TEXT, INT, UUID) IS E'@omit';

-- 4. Delete Class (rename to removeClass)
CREATE OR REPLACE FUNCTION remove_class(
  id UUID
) RETURNS UUID AS $$
DECLARE
  deleted_id UUID;
BEGIN
  DELETE FROM classes WHERE classes.id = $1 RETURNING classes.id INTO deleted_id;
  RETURN deleted_id;
END;
$$ LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER;

COMMENT ON FUNCTION remove_class(UUID) IS E'@omit';

-- 5. Delete Student (rename to removeStudent)
CREATE OR REPLACE FUNCTION remove_student(
  id UUID
) RETURNS UUID AS $$
DECLARE
  deleted_id UUID;
BEGIN
  DELETE FROM students WHERE students.id = $1 RETURNING students.id INTO deleted_id;
  RETURN deleted_id;
END;
$$ LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER;

COMMENT ON FUNCTION remove_student(UUID) IS E'@omit';

-- 6. Update User Name
CREATE OR REPLACE FUNCTION update_user_name(
  user_id UUID,
  new_name TEXT
) RETURNS users AS $$
  UPDATE users
  SET full_name = new_name
  WHERE id = user_id
  RETURNING *;
$$ LANGUAGE SQL VOLATILE STRICT SECURITY DEFINER;

COMMENT ON FUNCTION update_user_name(UUID, TEXT) IS E'@name updateUserName\nUpdate a user name';

-- 7. Upsert Profile (create or update)
CREATE OR REPLACE FUNCTION upsert_profile(
  p_user_id UUID,
  p_bio TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_photo_url TEXT DEFAULT NULL
) RETURNS profiles AS $$
  INSERT INTO profiles (user_id, bio, email, phone, address, photo_url)
  VALUES (p_user_id, p_bio, p_email, p_phone, p_address, p_photo_url)
  ON CONFLICT (user_id)
  DO UPDATE SET
    bio = COALESCE(EXCLUDED.bio, profiles.bio),
    email = COALESCE(EXCLUDED.email, profiles.email),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    address = COALESCE(EXCLUDED.address, profiles.address),
    photo_url = COALESCE(EXCLUDED.photo_url, profiles.photo_url)
  RETURNING *;
$$ LANGUAGE SQL VOLATILE SECURITY DEFINER;

COMMENT ON FUNCTION upsert_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) IS E'@name upsertProfile\nCreate or update a user profile';

-- ============================================
-- 8. Announcements
-- ============================================
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('low', 'normal', 'high', 'urgent')) DEFAULT 'normal',
  target_audience TEXT CHECK (target_audience IN ('all', 'students', 'teachers')) DEFAULT 'all',
  created_by UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table CRUD would duplicate custom createAnnouncement / updateAnnouncement / deleteAnnouncement payloads
COMMENT ON TABLE announcements IS E'@omit create,update,delete';

ALTER TABLE announcements DISABLE ROW LEVEL SECURITY;

-- 9. Announcement CRUD Functions
CREATE OR REPLACE FUNCTION create_announcement(
  p_title TEXT,
  p_content TEXT,
  p_institution_id UUID,
  p_priority TEXT DEFAULT 'normal',
  p_target_audience TEXT DEFAULT 'all',
  p_created_by UUID DEFAULT NULL
) RETURNS announcements AS $$
DECLARE
  r announcements;
BEGIN
  IF NOT rls_is_mai_admin() THEN
    IF rls_jwt_institution_id() IS NULL OR p_institution_id IS DISTINCT FROM rls_jwt_institution_id() THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;
  INSERT INTO announcements (title, content, institution_id, priority, target_audience, created_by)
  VALUES (p_title, p_content, p_institution_id, p_priority, p_target_audience, p_created_by)
  RETURNING * INTO r;
  RETURN r;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

COMMENT ON FUNCTION create_announcement(TEXT, TEXT, UUID, TEXT, TEXT, UUID) IS E'@name createAnnouncement\nCreate a new announcement';

CREATE OR REPLACE FUNCTION update_announcement(
  p_id UUID,
  p_title TEXT,
  p_content TEXT,
  p_priority TEXT DEFAULT 'normal',
  p_target_audience TEXT DEFAULT 'all',
  p_is_active BOOLEAN DEFAULT TRUE
) RETURNS announcements AS $$
DECLARE
  r announcements;
BEGIN
  UPDATE announcements
  SET title = p_title,
      content = p_content,
      priority = p_priority,
      target_audience = p_target_audience,
      is_active = p_is_active,
      updated_at = NOW()
  WHERE id = p_id
    AND (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id())
  RETURNING * INTO r;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN r;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

COMMENT ON FUNCTION update_announcement(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN) IS E'@name updateAnnouncement\nUpdate an existing announcement';

CREATE OR REPLACE FUNCTION delete_announcement(
  p_id UUID
) RETURNS UUID AS $$
DECLARE
  deleted_id UUID;
BEGIN
  DELETE FROM announcements
  WHERE id = p_id
    AND (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id())
  RETURNING id INTO deleted_id;
  IF deleted_id IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN deleted_id;
END;
$$ LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER;

COMMENT ON FUNCTION delete_announcement(UUID) IS E'@name deleteAnnouncement\nDelete an announcement';

CREATE OR REPLACE FUNCTION toggle_announcement(
  p_id UUID
) RETURNS announcements AS $$
DECLARE
  r announcements;
BEGIN
  UPDATE announcements
  SET is_active = NOT is_active,
      updated_at = NOW()
  WHERE id = p_id
    AND (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id())
  RETURNING * INTO r;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN r;
END;
$$ LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER;

COMMENT ON FUNCTION toggle_announcement(UUID) IS E'@name toggleAnnouncement\nToggle announcement active status';
