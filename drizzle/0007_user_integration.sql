CREATE TABLE vehicle_reviews (
  id TEXT PRIMARY KEY NOT NULL,
  applicant_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  plate TEXT NOT NULL,
  province TEXT NOT NULL,
  brand TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  evidence_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  version INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX vehicle_reviews_queue_idx ON vehicle_reviews(status, created_at DESC);

CREATE TABLE booking_policy (
  version INTEGER PRIMARY KEY,
  policy_json TEXT NOT NULL,
  effective_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL
);
