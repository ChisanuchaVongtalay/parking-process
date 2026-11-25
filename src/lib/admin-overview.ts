import { queryRow, queryRows } from "@/db/client";
import { db } from "@/db";

const configuredAge = Number(process.env.SNAPSHOT_MAX_AGE_SECONDS || 900);
const maxAge = Number.isFinite(configuredAge) && configuredAge > 0 ? configuredAge : 900;
export { adminTime } from "./admin-time";

export async function readParkingOverview() {
  const cutoff = Date.now() - maxAge * 1000;
  const slots = await queryRows(`
    WITH latest AS (
      SELECT id, camera_id, captured_at,
             ROW_NUMBER() OVER (PARTITION BY camera_id ORDER BY captured_at DESC, created_at DESC, id DESC) AS rank
      FROM camera_observations
    ), mapped AS (
      SELECT cs.logical_slot_id, c.code, c.is_active, cs.enabled, c.zone_id,
             latest.captured_at, so.occupied
      FROM camera_slots cs
      JOIN cameras c ON c.id = cs.camera_id
      LEFT JOIN latest ON latest.camera_id = c.id AND latest.rank = 1
      LEFT JOIN slot_observations so ON so.observation_id = latest.id AND so.camera_slot_id = cs.id
      WHERE cs.logical_slot_id IS NOT NULL
    )
    SELECT ls.id, ls.zone_id AS zoneId, ls.slot_code AS code, ls.vehicle_type AS vehicleType,
           GROUP_CONCAT(DISTINCT m.code) AS cameras,
           MIN(CASE WHEN m.is_active AND m.enabled AND m.captured_at >= ? THEN m.occupied END) AS minOccupied,
           MAX(CASE WHEN m.is_active AND m.enabled AND m.captured_at >= ? THEN m.occupied END) AS maxOccupied,
           MAX(CASE WHEN m.is_active AND m.enabled AND m.occupied IS NOT NULL THEN m.captured_at END) AS observedAt
    FROM logical_slots ls
    LEFT JOIN mapped m ON m.logical_slot_id = ls.id AND m.zone_id = ls.zone_id
    WHERE ls.is_active
    GROUP BY ls.id
    ORDER BY ls.display_order, ls.slot_code
  `, [cutoff, cutoff]) as Array<{
    id: string; zoneId: string; code: string; vehicleType: string; cameras: string | null;
    minOccupied: number | null; maxOccupied: number | null; observedAt: number | null;
  }>;

  const observedSlots = slots.map((slot) => ({
    ...slot,
    status: slot.minOccupied !== slot.maxOccupied ? "Conflict"
      : slot.maxOccupied !== null ? (slot.maxOccupied ? "Occupied" : "Free")
      : slot.observedAt != null && slot.observedAt < cutoff ? "Stale" : "Unknown",
  }));
  const slotsByZone = new Map<string, typeof observedSlots>();
  for (const slot of observedSlots) {
    const group = slotsByZone.get(slot.zoneId) ?? [];
    group.push(slot);
    slotsByZone.set(slot.zoneId, group);
  }

  const zones = (await db.query.zones.findMany()).sort((a, b) => a.code.localeCompare(b.code)).map((zone) => {
    const slots = slotsByZone.get(zone.id) ?? [];
    const free = slots.filter((slot) => slot.status === "Free").length;
    const occupied = slots.filter((slot) => slot.status === "Occupied").length;
    const lastObservation = slots.reduce((mostRecent, slot) => {
      const observedAt = Number(slot.observedAt);
      return observedAt >= cutoff ? Math.max(mostRecent, observedAt) : mostRecent;
    }, 0);
    const lastUpdated = lastObservation ? new Date(lastObservation).toISOString() : null;
    return { ...zone, slots, occupied, free, unknown: slots.length - free - occupied, lastUpdated };
  });

  return {
    zones,
    totals: zones.reduce((total, zone) => ({
      slots: total.slots + zone.slots.length,
      occupied: total.occupied + zone.occupied,
      free: total.free + zone.free,
      unknown: total.unknown + zone.unknown,
    }), { slots: 0, occupied: 0, free: 0, unknown: 0 }),
  };
}

export async function readCameraHealth() {
  // Older databases can lack capture telemetry until migration 0002 is applied.
  const hasCaptureStatus = await queryRow(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'snapshot_capture_status'",
  );
  const captureSource = hasCaptureStatus
    ? "snapshot_capture_status"
    : "(SELECT NULL AS camera_id, NULL AS last_success_at, NULL AS last_error WHERE 0)";
  const cameras = await queryRows(`
    SELECT c.id, c.code, c.name, c.zone_id AS zoneId, c.is_active AS active,
           s.last_success_at AS captureAt, (s.last_error IS NOT NULL) AS captureError,
           (SELECT MAX(o.created_at) FROM camera_observations o WHERE o.camera_id = c.id) AS processedAt
    FROM cameras c
    LEFT JOIN ${captureSource} s ON s.camera_id = c.id
    ORDER BY c.code
  `) as Array<{
    id: string; code: string; name: string; zoneId: string; active: number;
    captureAt: number | null; captureError: number; processedAt: number | null;
  }>;
  const cutoff = Date.now() - maxAge * 1000;
  return cameras.map((camera) => ({
    ...camera,
    status: !camera.active ? "Disabled" : camera.captureError ? "Error"
      : camera.captureAt === null ? "Unknown" : camera.captureAt < cutoff ? "Stale" : "Fresh",
  }));
}
