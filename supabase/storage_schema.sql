-- ============================================================================
-- Store and serve the original uploaded PDFs via Supabase Storage.
-- Run these statements in the Supabase SQL editor.
-- ============================================================================

-- Step 1: Track where each document's original file lives in the bucket.
-- All chunks of the same upload share one file_path.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_path TEXT;

-- Step 2: Create the private "vault" bucket that holds the original files.
INSERT INTO storage.buckets (id, name, public)
VALUES ('vault', 'vault', false)
ON CONFLICT (id) DO NOTHING;

-- Step 3: Storage RLS — the app talks to Storage with the user's session
-- (anon key + JWT), so each user may only touch files under their own
-- "<user_id>/..." folder. Without these policies every upload/download fails.
DROP POLICY IF EXISTS "vault_select_own" ON storage.objects;
CREATE POLICY "vault_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'vault' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "vault_insert_own" ON storage.objects;
CREATE POLICY "vault_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vault' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "vault_update_own" ON storage.objects;
CREATE POLICY "vault_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'vault' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'vault' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "vault_delete_own" ON storage.objects;
CREATE POLICY "vault_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'vault' AND (storage.foldername(name))[1] = auth.uid()::text);
