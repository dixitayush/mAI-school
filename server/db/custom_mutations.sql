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
