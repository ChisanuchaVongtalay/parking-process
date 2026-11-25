INSERT INTO zones (id, code, name) VALUES
  ('zone_inventory_m-square', 'M-Square', 'M Square'),
  ('zone_inventory_e1', 'E1', 'E1'),
  ('zone_inventory_e3', 'E3', 'E3'),
  ('zone_inventory_e2', 'E2', 'E2'),
  ('zone_inventory_d1', 'D1', 'D1'),
  ('zone_inventory_c2', 'C2', 'C2'),
  ('zone_inventory_c3', 'C3', 'C3'),
  ('zone_inventory_c5', 'C5', 'C5')
ON CONFLICT (code) DO NOTHING;

-- New inventory entries stay disabled until their RTSP source is configured.
WITH inventory(zone_code, camera_code) AS (
  VALUES
  ('M-Square', 'M-Square-Parking-02'),
  ('M-Square', 'M-Square-Parking-03'),
  ('M-Square', 'M-Square-Parking-04'),
  ('M-Square', 'M-Square-Parking-05'),
  ('E1', 'E1-Parking-01'),
  ('E1', 'E1-Parking-02'),
  ('E1', 'E1-Parking-03'),
  ('E1', 'E1-Parking-04'),
  ('E1', 'E1-Motorcycle-01'),
  ('E1', 'E1-Motorcycle-02'),
  ('E3', 'E3-Parking-01'),
  ('E3', 'E3-Parking-02'),
  ('E3', 'E3-Parking-03'),
  ('E3', 'E3-Parking-04'),
  ('E2', 'E2-Motorcycle-01'),
  ('E2', 'E2-Motorcycle-02'),
  ('E2', 'E2-Parking-01'),
  ('E2', 'E2-Parking-02'),
  ('D1', 'D1-Parking-01'),
  ('D1', 'D1-Parking-02'),
  ('D1', 'D1-Motorcycle'),
  ('C2', 'C2-Parking-01'),
  ('C2', 'C2-Parking-02'),
  ('C2', 'C2-Motorcycle-01'),
  ('C2', 'C2-Motorcycle-02'),
  ('C3', 'C3-Paking'),
  ('C5', 'C5-Paking-01'),
  ('C5', 'C5-Paking-02')
)
INSERT INTO cameras (id, zone_id, code, name, is_active)
SELECT 'cam_inventory_' || lower(inventory.camera_code), zones.id,
       inventory.camera_code, inventory.camera_code, 0
FROM inventory
JOIN zones ON zones.code = inventory.zone_code
ON CONFLICT (zone_id, code) DO NOTHING;

INSERT INTO calibration_profiles (id, camera_id)
SELECT 'cal_' || id, id
FROM cameras
WHERE id GLOB 'cam_inventory_*'
ON CONFLICT (camera_id) DO NOTHING;
