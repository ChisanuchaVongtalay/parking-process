import { isStoredImagePath } from "@/lib/auth/protected-files";
import { adminEndpoint } from "@/lib/auth/access";
import { fail, ok, parseJsonError } from "@/lib/http";
import { saveUploadedFile } from "@/lib/storage";
import { runRuntimeProcessing } from "@/lib/runtime/run-pipeline";

async function handlePOST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const contentType = request.headers.get("content-type") || "";

    let snapshotPath: string | undefined;
    let capturedAt: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      capturedAt = (formData.get("capturedAt") as string | null) ?? undefined;
      const uploaded = formData.get("file");

      if (uploaded instanceof File) {
        const saved = await saveUploadedFile({
          file: uploaded,
          kind: "snapshot",
          cameraId: id,
        });
        snapshotPath = saved.relativePath;
      }
    } else {
      const body = (await request.json().catch(() => ({}))) as {
        snapshotPath?: string;
        capturedAt?: string;
      };
      if (body.snapshotPath !== undefined &&
          (typeof body.snapshotPath !== "string" || !isStoredImagePath(body.snapshotPath, "snapshots"))) {
        return fail("Invalid snapshot path", 400);
      }
      snapshotPath = body.snapshotPath;
      capturedAt = body.capturedAt;
    }

    const output = await runRuntimeProcessing({
      cameraId: id,
      snapshotPath,
      capturedAt: capturedAt ? new Date(capturedAt) : undefined,
    });

    return ok(output, 201);
  } catch (error) {
    return parseJsonError(error);
  }
}

export const POST = adminEndpoint((_session, ...args: Parameters<typeof handlePOST>) => handlePOST(...args), { audit: "camera.process" });
