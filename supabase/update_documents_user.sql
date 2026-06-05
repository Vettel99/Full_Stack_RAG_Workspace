-- Step 1: Add user_id column to documents for per-user data isolation
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS documents_user_id_idx ON documents (user_id);

-- Step 2: Update match_documents to optionally filter by user.
-- Passing filter_user_id=NULL preserves backward-compatibility (CLI eval, no session).
-- Passing a real UUID restricts results to that user's documents only.
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding  VECTOR(1536),
  match_count      INT   DEFAULT 5,
  match_threshold  FLOAT DEFAULT 0.3,
  filter_user_id   UUID  DEFAULT NULL
)
RETURNS TABLE (
  id         UUID,
  content    TEXT,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    id,
    content,
    1 - (embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE
    (filter_user_id IS NULL OR user_id = filter_user_id)
    AND 1 - (embedding <=> query_embedding) >= match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
