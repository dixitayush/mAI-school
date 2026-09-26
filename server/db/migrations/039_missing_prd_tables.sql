-- 039: Missing PRD tables — dashboard preferences, billing, tenant domains, password resets
-- PRD sections 56, 61, 63, 8.2

-- Dashboard personalization (PRD §56)
CREATE TABLE IF NOT EXISTS dashboard_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  layout JSONB NOT NULL DEFAULT '{}',
  density TEXT CHECK (density IN ('compact', 'comfortable')) DEFAULT 'comfortable',
  hidden_widgets TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dashboard_pref_user_unique UNIQUE (user_id)
);

-- Tenant billing / subscription (PRD §61)
CREATE TABLE IF NOT EXISTS tenant_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'trial'
    CHECK (plan IN ('trial', 'starter', 'professional', 'enterprise', 'custom')),
  billing_status TEXT NOT NULL DEFAULT 'trial'
    CHECK (billing_status IN ('trial', 'active', 'past_due', 'suspended', 'cancelled')),
  student_limit INT NOT NULL DEFAULT 100,
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual')) DEFAULT 'monthly',
  subscription_start TIMESTAMPTZ DEFAULT NOW(),
  subscription_end TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_billing_unique UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'issued', 'paid', 'overdue', 'cancelled', 'refunded')),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  description TEXT,
  line_items JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (tenant_id, status);

-- Tenant custom domains (PRD §63)
CREATE TABLE IF NOT EXISTS tenant_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL,
  domain_type TEXT CHECK (domain_type IN ('subdomain', 'custom')) DEFAULT 'subdomain',
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  verification_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_domains_hostname_unique UNIQUE (hostname)
);

CREATE INDEX IF NOT EXISTS idx_tenant_domains_tenant ON tenant_domains (tenant_id);

-- Password reset tokens (PRD §8.2)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens (user_id, created_at DESC);

-- Tenant branding extended fields (PRD §62)
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#6FA371';
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#4d7c78';
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS favicon_url TEXT;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS email_logo_url TEXT;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS login_background_url TEXT;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kolkata';
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'en';
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS date_format TEXT DEFAULT 'DD/MM/YYYY';
