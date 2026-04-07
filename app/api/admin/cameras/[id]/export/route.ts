import { ok, parseJsonError } from "@/lib/http";
import { exportCameraConfig } from "@/services/camera-export";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const exported = await exportCameraConfig(id);

    return ok(exported, 201);
  } catch (error) {
    return parseJsonError(error);
  }
}
