CREATE TABLE parking_bookings (
  id TEXT PRIMARY KEY NOT NULL,
  applicant_id TEXT NOT NULL,
  vehicle_review_id TEXT NOT NULL REFERENCES vehicle_reviews(id),
  slot_id TEXT NOT NULL REFERENCES logical_slots(id),
  slot_code TEXT NOT NULL,
  zone_code TEXT NOT NULL,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('car','motorcycle')),
  created_at INTEGER NOT NULL,
  starts_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > starts_at),
  cancelled_at INTEGER
);
CREATE INDEX parking_bookings_owner_idx ON parking_bookings(applicant_id, created_at DESC);
CREATE INDEX parking_bookings_interval_idx ON parking_bookings(expires_at, starts_at, slot_id) WHERE cancelled_at IS NULL;

CREATE TABLE parking_notifications (
  id TEXT PRIMARY KEY NOT NULL,
  applicant_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at INTEGER,
  zone_code TEXT,
  booking_id TEXT REFERENCES parking_bookings(id)
);
CREATE INDEX parking_notifications_owner_idx ON parking_notifications(applicant_id, created_at DESC);

CREATE TABLE parking_zone_watches (
  applicant_id TEXT NOT NULL,
  zone_id TEXT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  last_status TEXT CHECK (last_status IN ('available','nearly-full','full')),
  PRIMARY KEY (applicant_id, zone_id)
);
