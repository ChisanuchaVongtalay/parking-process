import { adminEndpoint } from "@/lib/auth/access";
import { fail, ok, parseJsonError } from "@/lib/http";
import { slotBulkSchema } from "@/lib/validation";
import { replaceCameraSlots } from "@/services/camera-slots";

async function handlePOST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return fail("Missing JSON file", 400);
    if (file.type !== "application/json") return fail("File must be JSON", 400);

    const text = await file.text();
    const json = JSON.parse(text) as unknown;
    const payload = slotBulkSchema.parse(json);

    const slots = await replaceCameraSlots(id, payload.slots);
    return ok(slots);
  } catch (error) {
    return parseJsonError(error);
  }
}

export const POST = adminEndpoint((_session, ...args: Parameters<typeof handlePOST>) => handlePOST(...args), { audit: "camera.slots_import" });
