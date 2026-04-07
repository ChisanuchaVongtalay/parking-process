import { fail, ok, parseJsonError } from "@/lib/http";
import { slotBulkSchema } from "@/lib/validation";
import { listCameraSlots, replaceCameraSlots } from "@/services/camera-slots";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const slots = await listCameraSlots(id);
  return ok(slots);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = slotBulkSchema.parse(await request.json());

    const slots = await replaceCameraSlots(id, payload.slots);
    return ok(slots);
  } catch (error) {
    if (error instanceof Error && /UNIQUE/.test(error.message)) {
      return fail("Duplicate slot code in this camera", 409);
    }
    return parseJsonError(error);
  }
}
