-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean up existing schema
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

-- 2. Profiles (New)
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
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Link to login user
  class_id UUID REFERENCES classes(id),
  parent_contact TEXT,
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
  recorded_by UUID REFERENCES users(id), -- Teacher who marked it
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Fees Management (Updated)
CREATE TABLE fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT, -- e.g., "Tuition Fee - Term 1"
  due_date DATE NOT NULL,
  status TEXT CHECK (status IN ('paid', 'pending', 'overdue')) DEFAULT 'pending',
  payment_date DATE,
  invoice_number TEXT UNIQUE
);

-- 5. Exams & Results (Updated)
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id),
  subject TEXT NOT NULL,
  title TEXT NOT NULL, -- e.g., "Mid-Term Mathematics"
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

-- 6. Reports (New)
CREATE TABLE reports (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content JSONB, -- Storing structured report data
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  type TEXT CHECK (type IN ('student_performance', 'class_attendance', 'financial')),
  generated_by UUID REFERENCES users(id)
);

-- Helper Functions with SECURITY DEFINER
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
  
  -- Create role-specific record if needed (default empty)
  IF role = 'student' THEN
    INSERT INTO students (user_id) VALUES (new_user.id);
  ELSIF role = 'teacher' THEN
    INSERT INTO teachers (user_id) VALUES (new_user.id);
  END IF;
  
  RETURN new_user;
END;
$$ LANGUAGE plpgsql STRICT SECURITY DEFINER;

-- Specific registration functions for more control
CREATE OR REPLACE FUNCTION register_student(
  username TEXT,
  password TEXT,
  full_name TEXT,
  email TEXT DEFAULT NULL,
  class_id UUID DEFAULT NULL
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
  
  -- Create student record
  INSERT INTO students (user_id, class_id)
  VALUES (new_user.id, class_id)
  RETURNING * INTO new_student;
  
  RETURN new_student;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION register_student(TEXT, TEXT, TEXT, TEXT, UUID) IS E'@name registerStudent\nRegister a new student user';

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
  
  -- Create profile with email
  INSERT INTO profiles (user_id, email) VALUES (new_user.id, email);
  
  -- Create teacher record
  INSERT INTO teachers (user_id, subject_specialization, qualification)
  VALUES (new_user.id, subject_specialization, qualification)
  RETURNING * INTO new_teacher;
  
  RETURN new_teacher;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION register_teacher(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS E'@name registerTeacher\nRegister a new teacher user';

-- Seed Classes
INSERT INTO classes (name, grade_level) VALUES ('10-A', 10), ('10-B', 10), ('11-A', 11), ('11-B', 11), (' 12-A', 12), ('12-B', 12);

-- Create default admin user (username: admin, password: admin123)
DO $$
BEGIN
  PERFORM register_user('admin', 'admin123', 'admin', 'System Administrator');
END $$;
