-- Accounts for owners and admins. Login is by a one-time code sent to the
-- email address; there are no passwords to leak. Session tokens and codes are
-- stored only as SHA-256 hashes.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'owner',
  created TEXT NOT NULL,
  last_login TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires TEXT NOT NULL,
  created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);

CREATE TABLE IF NOT EXISTS login_codes (
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS login_codes_email ON login_codes (email, created);

CREATE INDEX IF NOT EXISTS items_member ON items (collection, json_extract(data, '$.memberId'));
CREATE INDEX IF NOT EXISTS items_moderation ON items (collection, json_extract(data, '$.moderationStatus'));
