import { eq } from "drizzle-orm";

import { db } from "@/db";
import { cameras } from "@/db/schema";
import { fail, ok, parseJsonError } from "@/lib/http";
import { saveUploadedFile } from "@/lib/storage";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const camera = await db.query.cameras.findFirst({ where: eq(cameras.id, id) });
    if (!camera) return fail("Camera not found", 404);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return fail("Missing file", 400);

    const saved = await saveUploadedFile({
      file,
      kind: "snapshot",
      cameraId: id,
    });

    await db
      .update(cameras)
      .set({ latestSnapshotPath: saved.relativePath, updatedAt: new Date() })
      .where(eq(cameras.id, id));

    return ok({ path: saved.relativePath }, 201);
  } catch (error) {
    return parseJsonError(error);
  }
}
