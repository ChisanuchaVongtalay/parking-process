import { queryRows } from "@/db/client";

export function analyticsFilters(days?: string, zone?: string) {
  return { days: days === "30" ? 30 : 7, zone: zone || null };
}

export function readOccupancyAnalytics(filters: ReturnType<typeof analyticsFilters>) {
  const today = Date.now();
  const cutoff = today - filters.days * 86_400_000;
  return queryRows<{ day: string; samples: number; occupancy: number }>(`
    SELECT date(o.captured_at / 1000, 'unixepoch', '+7 hours') AS day, COUNT(*) AS samples,
           ROUND(AVG(100.0 * o.occupied_count / o.total_count), 1) AS occupancy
    FROM camera_observations o JOIN cameras c ON c.id = o.camera_id
    WHERE o.captured_at >= ? AND o.captured_at <= ? AND o.total_count > 0
      AND (? IS NULL OR c.zone_id = ?)
    GROUP BY day ORDER BY day
  `, [cutoff, today, filters.zone, filters.zone]);
}
