import { ok, parseJsonError } from "@/lib/http";
import { getZonesWithLatestSummary } from "@/lib/runtime/aggregate";

export async function GET() {
  try {
    const zones = await getZonesWithLatestSummary();

    const items = zones.map((zone) => ({
      zone: zone.zoneCode,
      total_slots: zone.summary.total,
      free_slots: zone.summary.free,
      occupied_slots: zone.summary.occupied,
      last_updated: zone.lastUpdated,
    }));

    return ok({ items });
  } catch (error) {
    return parseJsonError(error);
  }
}
