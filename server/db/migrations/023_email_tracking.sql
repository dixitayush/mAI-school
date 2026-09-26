-- 023: Email delivery tracking
-- PRD section 47.4

CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  provider_message_id TEXT,
  template TEXT,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'delivered', 'opened', 'bounced', 'complained', 'failed')),
  metadata JSONB,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  complained_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_messages_tenant ON email_messages (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_email_messages_recipient ON email_messages (recipient_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_provider ON email_messages (provider_message_id);
