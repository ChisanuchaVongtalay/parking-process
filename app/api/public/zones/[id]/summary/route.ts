import { fail, ok, parseJsonError } from "@/lib/http";
import { getZoneSummary } from "@/lib/runtime/aggregate";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const summary = await getZoneSummary(id);
    if (!summary) {
      return fail("Zone summary not found", 404);
    }

    return ok({ zoneId: id, summary });
  } catch (error) {
    return parseJsonError(error);
  }
}
