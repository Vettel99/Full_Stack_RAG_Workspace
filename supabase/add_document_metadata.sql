-- Adds document_name and created_at columns for the management panel.
-- Existing rows get NULL for document_name and the migration timestamp for created_at.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_name TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now() NOT NULL;

CREATE INDEX IF NOT EXISTS documents_user_created_idx
  ON documents (user_id, created_at DESC);
