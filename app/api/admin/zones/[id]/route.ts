import { eq } from "drizzle-orm";
import { db } from "@/db";
import { zones } from "@/db/schema";
import { adminEndpoint } from "@/lib/auth/access";
import { fail, ok } from "@/lib/http";
import { zoneCreateSchema } from "@/lib/validation";

export const PATCH = adminEndpoint(async (_session, request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const input = zoneCreateSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return fail("กรุณาระบุรหัสและชื่อโซนที่ถูกต้อง", 422);
  try {
    const zone = await db.update(zones).set({ ...input.data, updatedAt: new Date() })
      .where(eq(zones.id, (await params).id)).returning().get();
    return zone ? ok(zone) : fail("ไม่พบโซน", 404);
  } catch (error) {
    if (error instanceof Error && /UNIQUE/i.test(error.message)) return fail("รหัสโซนนี้ถูกใช้อยู่แล้ว", 409);
    throw error;
  }
}, { audit: "zone.update" });
