-- 016_opsadmin_role.sql
-- Adds the 'opsadmin' role: fee collection, payroll and expense operations.
--
-- migrate:no-transaction
--
-- ALTER TYPE ... ADD VALUE cannot be used by any statement in the same
-- transaction that adds it, so this file stays alone and adds nothing else.
-- Migration 017 (expenses) is the first to rely on the value existing.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'opsadmin' AFTER 'principal';
