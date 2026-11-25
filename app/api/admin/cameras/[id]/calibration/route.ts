import { adminEndpoint } from "@/lib/auth/access";
import { ok, parseJsonError } from "@/lib/http";
import { calibrationUpdateSchema } from "@/lib/validation";
import { getOrCreateCalibration, updateCalibration } from "@/services/calibration";

async function handleGET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const calibration = await getOrCreateCalibration(id);
    return ok(calibration);
  } catch (error) {
    return parseJsonError(error);
  }
}

async function handlePUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = calibrationUpdateSchema.parse(await request.json());
    const calibration = await updateCalibration(id, payload);
    return ok(calibration);
  } catch (error) {
    return parseJsonError(error);
  }
}

export const GET = adminEndpoint((_session, ...args: Parameters<typeof handleGET>) => handleGET(...args));
export const PUT = adminEndpoint((_session, ...args: Parameters<typeof handlePUT>) => handlePUT(...args), { audit: "camera.calibration_update" });
