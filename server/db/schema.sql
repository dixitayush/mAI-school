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
DROP TYPE IF EXISTS user_role CASCADE;

-- 1. Roles & Users
CREATE TYPE user_role AS ENUM ('admin', 'principal', 'teacher', 'student');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
  name TEXT NOT NULL, -- e.g., "10-A"
  grade_level INT NOT NULL,
  teacher_id UUID REFERENCES users(id) -- Class teacher
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
  title TEXT NOT NULL,
  content JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  type TEXT CHECK (type IN ('student_performance', 'class_attendance', 'financial')),
  generated_by UUID REFERENCES users(id)
);

-- 7. Meetings (New)
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES users(id), -- Principal or Admin
  guest_id UUID REFERENCES users(id), -- Student or Teacher
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
  full_name TEXT
) RETURNS users AS $$
DECLARE
  new_user users;
BEGIN
  INSERT INTO users (username, password_hash, role, full_name)
  VALUES (username, crypt(password, gen_salt('bf')), role, full_name)
  RETURNING * INTO new_user;
  
  -- Create empty profile
  INSERT INTO profiles (user_id) VALUES (new_user.id);
  
  -- Create role-specific record if needed
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
BEGIN
  -- Create base user
  INSERT INTO users (username, password_hash, role, full_name)
  VALUES (username, crypt(password, gen_salt('bf')), 'student', full_name)
  RETURNING * INTO new_user;
  
  INSERT INTO profiles (user_id, email) VALUES (new_user.id, email);
  
  -- Create student record with parent details
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
  email TEXT DEFAULT NULL,
  subject_specialization TEXT DEFAULT NULL,
  qualification TEXT DEFAULT NULL
) RETURNS teachers AS $$
DECLARE
  new_user users;
  new_teacher teachers;
BEGIN
  -- Create base user
  INSERT INTO users (username, password_hash, role, full_name)
  VALUES (username, crypt(password, gen_salt('bf')), 'teacher', full_name)
  RETURNING * INTO new_user;
  
  INSERT INTO profiles (user_id, email) VALUES (new_user.id, email);
  
  INSERT INTO teachers (user_id, subject_specialization, qualification)
  VALUES (new_user.id, subject_specialization, qualification)
  RETURNING * INTO new_teacher;
  
  RETURN new_teacher;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION register_teacher(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS E'@name registerTeacher\nRegister a new teacher';

-- Permissions for PostGraphile to work smoothly
GRANT USAGE ON SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres;

-- Explicitly allow anonymous access (if we were using a different role, but we use postgres so it's fine)
-- But ensuring RLS doesn't block if we accidentally enable it later
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

-- Seed Data (Initial Admin)
INSERT INTO classes (name, grade_level) VALUES ('10-A', 10), ('10-B', 10), ('11-A', 11), ('11-B', 11), ('12-A', 12);

DO $$
BEGIN
  PERFORM register_user('admin', 'admin123', 'admin', 'System Administrator');
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

COMMENT ON FUNCTION create_exam(UUID, TEXT, TEXT, DATE, INT, TEXT) IS E'@name createExam\nCreate a new exam';

-- 2. Create Class
CREATE OR REPLACE FUNCTION create_class(
  name TEXT,
  grade_level INT,
  teacher_id UUID DEFAULT NULL
) RETURNS classes AS $$
  INSERT INTO classes (name, grade_level, teacher_id)
  VALUES (name, grade_level, teacher_id)
  RETURNING *;
$$ LANGUAGE SQL VOLATILE STRICT SECURITY DEFINER;

COMMENT ON FUNCTION create_class(TEXT, INT, UUID) IS E'@name createClass\nCreate a new class';

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

COMMENT ON FUNCTION update_class(UUID, TEXT, INT, UUID) IS E'@name updateClass\nUpdate an existing class';

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

COMMENT ON FUNCTION delete_class(UUID) IS E'@name deleteClass\nDelete a class';

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

COMMENT ON FUNCTION delete_student(UUID) IS E'@name deleteStudent\nDelete a student';
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

-- 2. Register Class
CREATE OR REPLACE FUNCTION register_class(
  name TEXT,
  grade_level INT,
  teacher_id UUID DEFAULT NULL
) RETURNS classes AS $$
  INSERT INTO classes (name, grade_level, teacher_id)
  VALUES (name, grade_level, teacher_id)
  RETURNING *;
$$ LANGUAGE SQL VOLATILE STRICT SECURITY DEFINER;

COMMENT ON FUNCTION register_class(TEXT, INT, UUID) IS E'@name registerClass\nRegister a new class';

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

COMMENT ON FUNCTION modify_class(UUID, TEXT, INT, UUID) IS E'@name modifyClass\nModify an existing class';

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

COMMENT ON FUNCTION remove_class(UUID) IS E'@name removeClass\nRemove a class';

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

COMMENT ON FUNCTION remove_student(UUID) IS E'@name removeStudent\nRemove a student';

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
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('low', 'normal', 'high', 'urgent')) DEFAULT 'normal',
  target_audience TEXT CHECK (target_audience IN ('all', 'students', 'teachers')) DEFAULT 'all',
  created_by UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE announcements DISABLE ROW LEVEL SECURITY;

-- 9. Announcement CRUD Functions
CREATE OR REPLACE FUNCTION create_announcement(
  p_title TEXT,
  p_content TEXT,
  p_priority TEXT DEFAULT 'normal',
  p_target_audience TEXT DEFAULT 'all',
  p_created_by UUID DEFAULT NULL
) RETURNS announcements AS $$
  INSERT INTO announcements (title, content, priority, target_audience, created_by)
  VALUES (p_title, p_content, p_priority, p_target_audience, p_created_by)
  RETURNING *;
$$ LANGUAGE SQL VOLATILE SECURITY DEFINER;

COMMENT ON FUNCTION create_announcement(TEXT, TEXT, TEXT, TEXT, UUID) IS E'@name createAnnouncement\nCreate a new announcement';

CREATE OR REPLACE FUNCTION update_announcement(
  p_id UUID,
  p_title TEXT,
  p_content TEXT,
  p_priority TEXT DEFAULT 'normal',
  p_target_audience TEXT DEFAULT 'all',
  p_is_active BOOLEAN DEFAULT TRUE
) RETURNS announcements AS $$
  UPDATE announcements
  SET title = p_title,
      content = p_content,
      priority = p_priority,
      target_audience = p_target_audience,
      is_active = p_is_active,
      updated_at = NOW()
  WHERE id = p_id
  RETURNING *;
$$ LANGUAGE SQL VOLATILE SECURITY DEFINER;

COMMENT ON FUNCTION update_announcement(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN) IS E'@name updateAnnouncement\nUpdate an existing announcement';

CREATE OR REPLACE FUNCTION delete_announcement(
  p_id UUID
) RETURNS UUID AS $$
DECLARE
  deleted_id UUID;
BEGIN
  DELETE FROM announcements WHERE id = p_id RETURNING id INTO deleted_id;
  RETURN deleted_id;
END;
$$ LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER;

COMMENT ON FUNCTION delete_announcement(UUID) IS E'@name deleteAnnouncement\nDelete an announcement';

CREATE OR REPLACE FUNCTION toggle_announcement(
  p_id UUID
) RETURNS announcements AS $$
  UPDATE announcements
  SET is_active = NOT is_active,
      updated_at = NOW()
  WHERE id = p_id
  RETURNING *;
$$ LANGUAGE SQL VOLATILE STRICT SECURITY DEFINER;

COMMENT ON FUNCTION toggle_announcement(UUID) IS E'@name toggleAnnouncement\nToggle announcement active status';
