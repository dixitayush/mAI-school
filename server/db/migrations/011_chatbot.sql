-- ============================================================
-- Migration 011 — AI Chatbot (Feature 8)
-- Role- and tenant-scoped assistant. Conversations are persisted per user.
-- Reads are RLS-scoped to the tenant AND the owning user; the REST chatbot
-- route (server/routes/chatbot.js) builds the grounding context with the
-- superuser pool, scoping every query by req.auth manually.
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE chat_sessions IS E'@omit create,update,delete';
CREATE INDEX IF NOT EXISTS chat_sessions_user_idx
  ON chat_sessions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE chat_messages IS E'@omit create,update,delete';
CREATE INDEX IF NOT EXISTS chat_messages_session_idx
  ON chat_messages (session_id, created_at ASC);

-- ---- RLS: a user sees only their own sessions/messages within their tenant ----
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_sessions TO mai_graphql;
DROP POLICY IF EXISTS mai_tenant_all ON chat_sessions;
CREATE POLICY mai_tenant_all ON chat_sessions FOR ALL TO mai_graphql
  USING (
    rls_is_mai_admin()
    OR (institution_id = rls_jwt_institution_id() AND user_id = rls_jwt_user_id())
  )
  WITH CHECK (
    rls_is_mai_admin()
    OR (institution_id = rls_jwt_institution_id() AND user_id = rls_jwt_user_id())
  );

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_messages TO mai_graphql;
DROP POLICY IF EXISTS mai_tenant_all ON chat_messages;
CREATE POLICY mai_tenant_all ON chat_messages FOR ALL TO mai_graphql
  USING (
    rls_is_mai_admin()
    OR EXISTS (
      SELECT 1 FROM chat_sessions s
       WHERE s.id = chat_messages.session_id
         AND s.institution_id = rls_jwt_institution_id()
         AND s.user_id = rls_jwt_user_id()
    )
  )
  WITH CHECK (
    rls_is_mai_admin()
    OR EXISTS (
      SELECT 1 FROM chat_sessions s
       WHERE s.id = chat_messages.session_id
         AND s.institution_id = rls_jwt_institution_id()
         AND s.user_id = rls_jwt_user_id()
    )
  );
