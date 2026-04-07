import { ok, parseJsonError } from "@/lib/http";
import { getCameraLatestSlotObservations } from "@/lib/runtime/aggregate";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const slots = await getCameraLatestSlotObservations(id);
    return ok({ cameraId: id, slots });
  } catch (error) {
    return parseJsonError(error);
  }
}
