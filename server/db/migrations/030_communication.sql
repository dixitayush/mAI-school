-- 030: Communication hub — message threads
-- PRD section 17

CREATE TABLE IF NOT EXISTS message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  subject TEXT,
  thread_type TEXT NOT NULL CHECK (thread_type IN (
    'teacher_parent', 'teacher_class', 'admin_school',
    'principal_staff', 'student_teacher', 'direct'
  )),
  created_by UUID NOT NULL REFERENCES users(id),
  class_id UUID REFERENCES classes(id),
  is_moderated BOOLEAN NOT NULL DEFAULT FALSE,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ,
  muted BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT msg_participant_unique UNIQUE (thread_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  attachment_file_id UUID,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_threads_institution ON message_threads (institution_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_participants_user ON message_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages (thread_id, created_at ASC);
