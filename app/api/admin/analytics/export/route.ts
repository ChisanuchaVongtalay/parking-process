import { adminEndpoint } from "@/lib/auth/access";
import { analyticsFilters, readOccupancyAnalytics } from "@/services/parking-analytics";

export const GET = adminEndpoint(async (_session, request: Request) => {
  const params = new URL(request.url).searchParams;
  const rows = await readOccupancyAnalytics(analyticsFilters(params.get("days") ?? undefined, params.get("zone") ?? undefined));
  const csv = ["date_bangkok,camera_samples,average_camera_occupancy_percent",
    ...rows.map(({ day, samples, occupancy }) => [day, samples, occupancy].join(","))].join("\r\n");
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="parking-analytics.csv"', "cache-control": "private, no-store" },
  });
}, { audit: "analytics.export" });
