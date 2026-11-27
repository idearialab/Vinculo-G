CREATE TABLE IF NOT EXISTS relationship_sharing (
 relationship_id TEXT NOT NULL REFERENCES relationships(id),
 owner_id TEXT NOT NULL REFERENCES users(id),
 module TEXT NOT NULL CHECK(module IN ('profile','diary','secrets','reflection','fantasies','progress','activities','agenda','academy','preferences','agreements','recognitions')),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(relationship_id,owner_id,module)
);
