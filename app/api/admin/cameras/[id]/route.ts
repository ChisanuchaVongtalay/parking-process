import { adminEndpoint } from "@/lib/auth/access";
import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { cameras, cameraSlots, zones } from "@/db/schema";
import { fail, ok } from "@/lib/http";
import { ZodError } from "zod";
import { cameraPatchSchema } from "@/lib/validation";

async function handleGET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const camera = await db.query.cameras.findFirst({ where: eq(cameras.id, id) });
  if (!camera) {
    return fail("Camera not found", 404);
  }
  const { streamUrl, ...safeCamera } = camera;
  return ok({ ...safeCamera, hasStream: Boolean(streamUrl) });
}

async function handlePATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = cameraPatchSchema.parse(await request.json());

    return await db.transaction(async (tx) => {
      const existing = await tx.query.cameras.findFirst({ where: eq(cameras.id, id) });
      if (!existing) return fail("Camera not found", 404);

      if (payload.zoneId && payload.zoneId !== existing.zoneId) {
        const zone = await tx.query.zones.findFirst({ where: eq(zones.id, payload.zoneId) });
        if (!zone) return fail("Zone not found", 404);

        const mappedSlot = await tx.query.cameraSlots.findFirst({
          where: and(eq(cameraSlots.cameraId, id), isNotNull(cameraSlots.logicalSlotId)),
        });
        if (mappedSlot) {
          return fail("ยกเลิกการผูก Logical Slot ของกล้องกับโซนเดิมก่อนย้ายโซน", 409);
        }
      }

      const updated = await tx.update(cameras)
        .set({ ...payload, updatedAt: new Date() })
        .where(eq(cameras.id, id))
        .returning().get();

      const { streamUrl, ...safeCamera } = updated;
      return ok({ ...safeCamera, hasStream: Boolean(streamUrl) });
    });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return fail("ข้อมูลกล้องไม่ถูกต้อง กรุณาตรวจสอบข้อมูลและ Stream URL", 422);
    }
    if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) {
      return fail("Camera Code นี้มีอยู่แล้วในโซนที่เลือก", 409);
    }
    return fail("บันทึกข้อมูลกล้องไม่สำเร็จ", 500);
  }
}

export const GET = adminEndpoint((_session, ...args: Parameters<typeof handleGET>) => handleGET(...args));
export const PATCH = adminEndpoint((_session, ...args: Parameters<typeof handlePATCH>) => handlePATCH(...args), { audit: "camera.update" });
