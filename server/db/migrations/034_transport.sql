-- 034: Transport management
-- PRD section 35

CREATE TABLE IF NOT EXISTS transport_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  vehicle_number TEXT NOT NULL,
  vehicle_type TEXT CHECK (vehicle_type IN ('bus', 'van', 'car', 'other')) DEFAULT 'bus',
  capacity INTEGER,
  driver_name TEXT,
  driver_phone TEXT,
  attendant_name TEXT,
  attendant_phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transport_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vehicle_id UUID REFERENCES transport_vehicles(id),
  morning_start_time TIME,
  afternoon_start_time TIME,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transport_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  pickup_time TIME,
  drop_time TIME,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7)
);

CREATE TABLE IF NOT EXISTS student_transport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES transport_routes(id),
  stop_id UUID REFERENCES transport_stops(id),
  transport_fee NUMERIC(10,2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT student_transport_unique UNIQUE (student_id, route_id)
);

CREATE INDEX IF NOT EXISTS idx_transport_vehicles_inst ON transport_vehicles (institution_id);
CREATE INDEX IF NOT EXISTS idx_transport_routes_inst ON transport_routes (institution_id);
CREATE INDEX IF NOT EXISTS idx_student_transport_student ON student_transport (student_id);
