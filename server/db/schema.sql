-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Roles & Users
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'principal', 'teacher', 'student');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Profiles
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  photo_url TEXT,
  email TEXT,
  phone TEXT,
  address TEXT
);

-- 3. Core Tables
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- e.g., "10-A"
  grade_level INT NOT NULL,
  teacher_id UUID REFERENCES users(id)
);

-- New Parents Table
CREATE TABLE IF NOT EXISTS parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id),
  parent_id UUID REFERENCES parents(id), -- Linked parent
  parent_contact TEXT, -- Deprecated, kept for backward compatibility if needed
  dob DATE,
  enrollment_date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject_specialization TEXT,
  qualification TEXT,
  joining_date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT CHECK (status IN ('present', 'absent', 'late')),
  remarks TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Fees Management
CREATE TABLE IF NOT EXISTS fees (
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
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id),
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  exam_date DATE NOT NULL,
  total_marks INT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id),
  marks_obtained INT NOT NULL,
  grade TEXT,
  feedback TEXT
);

-- 6. Reports
CREATE TABLE IF NOT EXISTS reports (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  type TEXT CHECK (type IN ('student_performance', 'class_attendance', 'financial')),
  generated_by UUID REFERENCES users(id)
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
  new_parent_id UUID;
BEGIN
  -- Create base user
  INSERT INTO users (username, password_hash, role, full_name)
  VALUES (username, crypt(password, gen_salt('bf')), 'student', full_name)
  RETURNING * INTO new_user;
  
  INSERT INTO profiles (user_id, email) VALUES (new_user.id, email);
  
  -- Handle Parent Creation if provided
  IF parent_name IS NOT NULL THEN
    INSERT INTO parents (full_name, email, phone, address)
    VALUES (parent_name, parent_email, parent_phone, parent_address)
    RETURNING id INTO new_parent_id;
  END IF;
  
  -- Create student record
  INSERT INTO students (user_id, class_id, parent_id)
  VALUES (new_user.id, class_id, new_parent_id)
  RETURNING * INTO new_student;
  
  RETURN new_student;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION register_student(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT) IS E'@name registerStudent\nRegister a new student user with optional parent details';

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

COMMENT ON FUNCTION register_teacher(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS E'@name registerTeacher\nRegister a new teacher user';

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
