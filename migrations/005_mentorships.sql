CREATE TABLE IF NOT EXISTS mentorship_invitations (
 code_hash TEXT PRIMARY KEY,
 mentor_id TEXT NOT NULL REFERENCES users(id),
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 consumed_at INTEGER,
 revoked_at INTEGER
);
CREATE TABLE IF NOT EXISTS mentorships (
 id TEXT PRIMARY KEY,
 mentor_id TEXT NOT NULL REFERENCES users(id),
 student_id TEXT NOT NULL REFERENCES users(id),
 invitation_hash TEXT NOT NULL UNIQUE REFERENCES mentorship_invitations(code_hash),
 created_at INTEGER NOT NULL,
 ended_at INTEGER,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','completed','ended')),
 CHECK(mentor_id <> student_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS active_mentorship_pair ON mentorships(mentor_id,student_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS mentorship_student ON mentorships(student_id);
CREATE INDEX IF NOT EXISTS mentorship_inviter ON mentorship_invitations(mentor_id);
