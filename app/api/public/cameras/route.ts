import { ok, parseJsonError } from "@/lib/http";
import { getLatestCameraSummaries } from "@/lib/runtime/aggregate";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const zoneId = searchParams.get("zoneId") || undefined;

    const cameras = await getLatestCameraSummaries(zoneId);
    return ok({ cameras });
  } catch (error) {
    return parseJsonError(error);
  }
}
