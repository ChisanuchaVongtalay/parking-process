import { adminEndpoint } from "@/lib/auth/access";
import { fail, ok } from "@/lib/http";
import { changeDecisionSchema, decideVehicleChange } from "@/services/vehicle-changes";

export const POST = adminEndpoint(async (session, request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const decision = changeDecisionSchema.safeParse(await request.json().catch(() => null));
  if (!decision.success) return fail("ตรวจสอบข้อมูล หากปฏิเสธต้องระบุเหตุผล", 422);
  if (!await decideVehicleChange((await params).id, decision.data, session.email)) {
    return fail("คำขอหรือข้อมูลรถเปลี่ยนแล้ว กรุณารีเฟรชหน้า", 409);
  }
  return ok({ updated: true });
});
