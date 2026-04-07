import { ok, parseJsonError } from "@/lib/http";
import { calibrationUpdateSchema } from "@/lib/validation";
import { getOrCreateCalibration, updateCalibration } from "@/services/calibration";

export async function GET(
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

export async function PUT(
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
