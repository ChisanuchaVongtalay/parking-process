import { fail, ok, parseJsonError } from "@/lib/http";
import { getCameraLatestSummary } from "@/lib/runtime/aggregate";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const summary = await getCameraLatestSummary(id);
    if (!summary) {
      return fail("Camera summary not found", 404);
    }

    return ok(summary);
  } catch (error) {
    return parseJsonError(error);
  }
}
