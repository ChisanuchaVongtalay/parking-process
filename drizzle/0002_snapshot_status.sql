CREATE TABLE IF NOT EXISTS snapshot_capture_status (
  camera_id TEXT PRIMARY KEY NOT NULL REFERENCES cameras(id),
  last_success_at INTEGER,
  last_attempt_at INTEGER NOT NULL,
  last_error TEXT
);
