CREATE TABLE IF NOT EXISTS personal_profiles (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 bio TEXT NOT NULL DEFAULT '',
 archetype TEXT NOT NULL DEFAULT '',
 availability TEXT NOT NULL DEFAULT '',
 exclusivity TEXT NOT NULL DEFAULT 'undecided' CHECK(exclusivity IN ('undecided','exclusive','nonexclusive')),
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS transition_requests (
 id TEXT PRIMARY KEY,
 mentorship_id TEXT NOT NULL REFERENCES mentorships(id),
 student_id TEXT NOT NULL REFERENCES users(id),
 mentor_id TEXT NOT NULL REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','withdrawn')),
 created_at INTEGER NOT NULL,
 resolved_at INTEGER,
 CHECK(student_id <> mentor_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS transition_pending_pair ON transition_requests(student_id,mentor_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS transition_mentor ON transition_requests(mentor_id);
