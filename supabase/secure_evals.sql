-- ============================================================================
-- Cross-tenant data leakage fix for eval_runs.
-- Run these statements in order in the Supabase SQL editor.
-- ============================================================================

-- Step 1: Wipe stale rows.
-- Existing eval_runs have no user_id. A NOT NULL column cannot be added while
-- those rows exist, and keeping them would leak across tenants. CASCADE also
-- clears the dependent eval_details rows via their foreign key.
TRUNCATE TABLE eval_runs CASCADE;

-- Step 2: Add the owning user_id, NOT NULL, tied to auth.users.
ALTER TABLE eval_runs
  ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 3: Index for the per-user dashboard read.
CREATE INDEX IF NOT EXISTS eval_runs_user_id_idx
  ON eval_runs (user_id, created_at DESC);
