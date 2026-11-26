ALTER TABLE vehicle_change_requests ADD COLUMN request_reason TEXT
  CHECK (request_reason IS NULL OR length(trim(request_reason)) BETWEEN 1 AND 1000);
