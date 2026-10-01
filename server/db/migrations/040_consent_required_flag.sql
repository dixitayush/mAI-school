-- The admin and parent consent screens both render a "Required" badge and the
-- create form has a Required toggle, but consent_types never had the column to
-- back it, so every type read as Optional. Add it.
ALTER TABLE consent_types
  ADD COLUMN IF NOT EXISTS required BOOLEAN NOT NULL DEFAULT FALSE;
