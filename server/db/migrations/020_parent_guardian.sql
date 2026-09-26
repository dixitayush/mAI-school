-- migrate:no-transaction
-- 020: Parent/Guardian role and tables
-- PRD sections 5.6, 11

-- Add parent to user_role enum (requires no-transaction)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'parent' AND enumtypid = 'user_role'::regtype) THEN
    ALTER TYPE user_role ADD VALUE 'parent';
  END IF;
END $$;
