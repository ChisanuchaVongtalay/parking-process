import { ok, parseJsonError } from "@/lib/http";
import { getZonesWithLatestSummary } from "@/lib/runtime/aggregate";

export async function GET() {
  try {
    const zones = await getZonesWithLatestSummary();
    return ok({ zones });
  } catch (error) {
    return parseJsonError(error);
  }
}
