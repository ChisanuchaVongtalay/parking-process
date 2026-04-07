import { ok, parseJsonError } from "@/lib/http";
import { saveUploadedFile } from "@/lib/storage";
import { runRuntimeProcessing } from "@/lib/runtime/run-pipeline";

export async function POST(
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
