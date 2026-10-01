-- Imports can now carry defaults chosen in the UI (target class, section and
-- academic session), so an admin bulk-loading one class's roster picks the class
-- from a dropdown instead of repeating class_name on every CSV row.
ALTER TABLE data_imports
  ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '{}'::jsonb;
