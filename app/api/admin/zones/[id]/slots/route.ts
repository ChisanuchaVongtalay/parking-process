import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { logicalSlots, zones } from "@/db/schema";
import { adminEndpoint } from "@/lib/auth/access";
import { fail, ok } from "@/lib/http";
import { createId } from "@/lib/id";
import { vehicleTypeSchema } from "@/lib/validation";

const schema = z.object({
  code: z.string().trim().min(1).max(64),
  vehicleType: vehicleTypeSchema,
});

export const POST = adminEndpoint(async (_session, request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return fail("กรุณาตรวจสอบรหัสหรือประเภทของช่องจอด", 422);
  const { id } = await params;
  return db.transaction(async (transaction) => {
    const zone = await transaction.query.zones.findFirst({ where: eq(zones.id, id) });
    if (!zone) return fail("ไม่พบโซน", 404);
    const duplicate = await transaction.query.logicalSlots.findFirst({
      where: and(eq(logicalSlots.zoneId, id), eq(logicalSlots.slotCode, input.data.code)),
    });
    if (duplicate) return fail("รหัสช่องจอดนี้มีอยู่แล้วในโซน", 409);
    const slot = { id: createId("ls"), zoneId: id, slotCode: input.data.code, vehicleType: input.data.vehicleType };
    await transaction.insert(logicalSlots).values(slot);
    return ok(slot, 201);
  });
}, { audit: "zone.slot_create" });
