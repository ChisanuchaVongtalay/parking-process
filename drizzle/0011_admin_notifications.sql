CREATE TABLE admin_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN (
    'vehicle_registration', 'vehicle_edit', 'vehicle_removal',
    'camera_unavailable', 'camera_recovered', 'booking_policy'
  )),
  target_id TEXT NOT NULL,
  detail TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE admin_notification_reads (
  account_id TEXT NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
  notification_id INTEGER NOT NULL REFERENCES admin_notifications(id) ON DELETE CASCADE,
  read_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, notification_id)
) WITHOUT ROWID;

CREATE TABLE admin_camera_incidents (
  camera_id TEXT PRIMARY KEY NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
  opened_at INTEGER NOT NULL
);
