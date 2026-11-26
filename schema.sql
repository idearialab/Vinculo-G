PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, display_name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('dominant','submissive')), is_founder INTEGER NOT NULL DEFAULT 0 CHECK(is_founder IN (0,1)), password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, adult_confirmed INTEGER NOT NULL CHECK(adult_confirmed=1), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX IF NOT EXISTS one_founder ON users(is_founder) WHERE is_founder=1;
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
