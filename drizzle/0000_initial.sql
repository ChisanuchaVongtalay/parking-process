CREATE TABLE zones (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)),
  updated_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
);

CREATE TABLE cameras (
  id TEXT PRIMARY KEY NOT NULL,
  zone_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  stream_url TEXT,
  background_image_path TEXT,
  latest_snapshot_path TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)),
  updated_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)),
  FOREIGN KEY (zone_id) REFERENCES zones(id)
);
CREATE UNIQUE INDEX cameras_zone_code_unique ON cameras(zone_id, code);
CREATE INDEX cameras_zone_idx ON cameras(zone_id);

CREATE TABLE calibration_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  camera_id TEXT NOT NULL UNIQUE,
  pixel_threshold INTEGER NOT NULL DEFAULT 15,
  occupancy_threshold INTEGER NOT NULL DEFAULT 8,
  grayscale INTEGER NOT NULL DEFAULT 1,
  blur_radius INTEGER NOT NULL DEFAULT 1,
  normalize INTEGER NOT NULL DEFAULT 1,
  downscale INTEGER NOT NULL DEFAULT 1000,
  lighting_compensation INTEGER NOT NULL DEFAULT 700,
  edge_weight INTEGER NOT NULL DEFAULT 1500,
  created_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)),
  updated_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)),
  FOREIGN KEY (camera_id) REFERENCES cameras(id)
);

CREATE TABLE logical_slots (
  id TEXT PRIMARY KEY NOT NULL,
  zone_id TEXT NOT NULL,
  slot_code TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)),
  updated_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)),
  FOREIGN KEY (zone_id) REFERENCES zones(id)
);
CREATE UNIQUE INDEX logical_slots_zone_slot_unique ON logical_slots(zone_id, slot_code);
CREATE INDEX logical_slots_zone_order_idx ON logical_slots(zone_id, display_order);

CREATE TABLE camera_slots (
  id TEXT PRIMARY KEY NOT NULL,
  camera_id TEXT NOT NULL,
  logical_slot_id TEXT,
  slot_code TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  shape_type TEXT NOT NULL DEFAULT 'rect',
  points_json TEXT NOT NULL,
  bbox_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)),
  updated_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)),
  FOREIGN KEY (camera_id) REFERENCES cameras(id),
  FOREIGN KEY (logical_slot_id) REFERENCES logical_slots(id)
);
CREATE UNIQUE INDEX camera_slots_camera_slot_unique ON camera_slots(camera_id, slot_code);
CREATE INDEX camera_slots_camera_idx ON camera_slots(camera_id);
CREATE INDEX camera_slots_logical_idx ON camera_slots(logical_slot_id);

CREATE TABLE calibration_runs (
  id TEXT PRIMARY KEY NOT NULL,
  camera_id TEXT NOT NULL,
  snapshot_path TEXT NOT NULL,
  params_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)),
  FOREIGN KEY (camera_id) REFERENCES cameras(id)
);
CREATE INDEX calibration_runs_camera_created_idx ON calibration_runs(camera_id, created_at);

CREATE TABLE config_exports (
  id TEXT PRIMARY KEY NOT NULL,
  camera_id TEXT,
  zone_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  export_path TEXT NOT NULL,
  checksum TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)),
  FOREIGN KEY (camera_id) REFERENCES cameras(id),
  FOREIGN KEY (zone_id) REFERENCES zones(id)
);
CREATE INDEX config_exports_zone_idx ON config_exports(zone_id);
CREATE INDEX config_exports_camera_idx ON config_exports(camera_id);
