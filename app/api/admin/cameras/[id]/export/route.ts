import { adminEndpoint } from "@/lib/auth/access";
import { ok, parseJsonError } from "@/lib/http";
import { exportCameraConfig } from "@/services/camera-export";

async function handlePOST(
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

export const POST = adminEndpoint((_session, ...args: Parameters<typeof handlePOST>) => handlePOST(...args), { audit: "camera.config_export" });
