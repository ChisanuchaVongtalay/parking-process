ALTER TABLE vehicle_reviews ADD COLUMN deleted_at INTEGER;
CREATE INDEX vehicle_reviews_applicant_idx ON vehicle_reviews(applicant_id, created_at DESC);

CREATE TABLE vehicle_change_requests (
  id TEXT PRIMARY KEY NOT NULL,
  review_id TEXT NOT NULL REFERENCES vehicle_reviews(id),
  kind TEXT NOT NULL CHECK (kind IN ('edit', 'delete')),
  changes_json TEXT,
  base_version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT,
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL,
  CHECK ((kind = 'edit' AND changes_json IS NOT NULL) OR (kind = 'delete' AND changes_json IS NULL))
);
CREATE UNIQUE INDEX vehicle_change_pending_idx ON vehicle_change_requests(review_id) WHERE status = 'pending';
CREATE INDEX vehicle_change_history_idx ON vehicle_change_requests(review_id, created_at DESC);
CREATE INDEX vehicle_change_queue_idx ON vehicle_change_requests(status, created_at);
