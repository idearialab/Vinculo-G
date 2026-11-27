CREATE TABLE IF NOT EXISTS auth_limits (bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_start INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS auth_limits_window ON auth_limits(window_start);
