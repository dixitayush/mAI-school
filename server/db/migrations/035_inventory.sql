-- 035: Inventory and asset management
-- PRD section 36

CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  asset_code TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'computer', 'projector', 'furniture', 'lab_equipment',
    'sports_equipment', 'stationery', 'vehicle', 'other'
  )),
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('available', 'assigned', 'under_repair', 'disposed')) DEFAULT 'available',
  purchase_date DATE,
  purchase_cost NUMERIC(12,2),
  warranty_expiry DATE,
  location TEXT,
  assigned_to UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ,
  qr_code TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_institution ON assets (institution_id, category);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets (institution_id, status);
CREATE INDEX IF NOT EXISTS idx_assets_code ON assets (institution_id, asset_code) WHERE asset_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS asset_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('repair', 'service', 'inspection', 'replacement')),
  description TEXT,
  cost NUMERIC(10,2),
  performed_by TEXT,
  performed_at DATE,
  next_due DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
