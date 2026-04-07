import { eq } from "drizzle-orm";

import { db } from "@/db";
import { cameras } from "@/db/schema";
import { fail, ok, parseJsonError } from "@/lib/http";
import { cameraPatchSchema } from "@/lib/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const camera = await db.query.cameras.findFirst({ where: eq(cameras.id, id) });
  if (!camera) {
    return fail("Camera not found", 404);
  }
  return ok(camera);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = cameraPatchSchema.parse(await request.json());

    const existing = await db.query.cameras.findFirst({ where: eq(cameras.id, id) });
    if (!existing) {
      return fail("Camera not found", 404);
    }

    const update = {
      zoneId: payload.zoneId ?? existing.zoneId,
      code: payload.code ?? existing.code,
      name: payload.name ?? existing.name,
      streamUrl: payload.streamUrl ?? existing.streamUrl,
      isPrimary: payload.isPrimary ?? existing.isPrimary,
      isActive: payload.isActive ?? existing.isActive,
      updatedAt: new Date(),
    };

    await db.update(cameras).set(update).where(eq(cameras.id, id));
    const camera = await db.query.cameras.findFirst({ where: eq(cameras.id, id) });

    return ok(camera);
  } catch (error) {
    return parseJsonError(error);
  }
}
