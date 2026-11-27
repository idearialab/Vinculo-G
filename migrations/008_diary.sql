CREATE TABLE IF NOT EXISTS diary_entries (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL REFERENCES users(id),
 section TEXT NOT NULL,
 title TEXT NOT NULL,
 mood TEXT NOT NULL,
 body TEXT NOT NULL,
 inspiration TEXT NOT NULL DEFAULT '',
 interest TEXT NOT NULL DEFAULT '',
 shared_relationship_id TEXT REFERENCES relationships(id),
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS diary_owner ON diary_entries(owner_id,created_at);
