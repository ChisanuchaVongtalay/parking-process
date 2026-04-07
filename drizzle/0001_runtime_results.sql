CREATE TABLE camera_observations (
  id TEXT PRIMARY KEY NOT NULL,
  camera_id TEXT NOT NULL,
  snapshot_path TEXT NOT NULL,
  occupied_count INTEGER NOT NULL,
  free_count INTEGER NOT NULL,
  total_count INTEGER NOT NULL,
  captured_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)),
  FOREIGN KEY (camera_id) REFERENCES cameras(id)
);
CREATE INDEX camera_observations_camera_captured_idx ON camera_observations(camera_id, captured_at);

CREATE TABLE slot_observations (
  id TEXT PRIMARY KEY NOT NULL,
  observation_id TEXT NOT NULL,
  camera_slot_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  occupied INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)),
  FOREIGN KEY (observation_id) REFERENCES camera_observations(id),
  FOREIGN KEY (camera_slot_id) REFERENCES camera_slots(id)
);
CREATE INDEX slot_observations_observation_idx ON slot_observations(observation_id);
CREATE INDEX slot_observations_camera_slot_idx ON slot_observations(camera_slot_id);
