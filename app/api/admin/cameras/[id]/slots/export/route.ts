import { ok, parseJsonError } from "@/lib/http";
import { listCameraSlots } from "@/services/camera-slots";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const slots = await listCameraSlots(id);

    return ok({
      slots: slots.map((slot) => ({
        id: slot.id,
        logicalSlotId: slot.logicalSlotId,
        slotCode: slot.slotCode,
        vehicleType: slot.vehicleType,
        shapeType: slot.shapeType,
        points: slot.points,
        bbox: slot.bbox,
        enabled: slot.enabled,
      })),
    });
  } catch (error) {
    return parseJsonError(error);
  }
}
