CREATE TABLE IF NOT EXISTS invitations (
 code_hash TEXT PRIMARY KEY,
 creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL,
 consumed_at INTEGER,
 revoked_at INTEGER
);
CREATE TABLE IF NOT EXISTS relationships (
 id TEXT PRIMARY KEY,
 dominant_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 submissive_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 invitation_hash TEXT NOT NULL UNIQUE REFERENCES invitations(code_hash),
 created_at INTEGER NOT NULL,
 ended_at INTEGER,
 CHECK(dominant_id <> submissive_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS active_relationship_pair ON relationships(dominant_id,submissive_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS invitations_creator ON invitations(creator_id);
CREATE INDEX IF NOT EXISTS relationships_submissive ON relationships(submissive_id);
