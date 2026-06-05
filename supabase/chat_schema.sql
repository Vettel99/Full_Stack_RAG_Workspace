-- One chat session per user (supports multiple chats per user)
CREATE TABLE IF NOT EXISTS chats (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Individual messages within a chat (JSON parts mirror UIMessage format)
CREATE TABLE IF NOT EXISTS messages (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id    UUID        NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content    JSONB       NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS chats_user_id_idx    ON chats    (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_chat_id_idx ON messages (chat_id, created_at ASC);
