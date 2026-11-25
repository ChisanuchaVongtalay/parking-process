import { adminEndpoint } from "@/lib/auth/access";
import { fail, ok } from "@/lib/http";
import { decideVehicleReview, decisionSchema, getReview, userReview } from "@/services/vehicle-reviews";

export const POST = adminEndpoint(async (session, request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const change = decisionSchema.safeParse(await request.json().catch(() => null));
  if (!change.success) return fail("ตรวจสอบข้อมูล หากปฏิเสธต้องระบุเหตุผล", 422);
  const review = await decideVehicleReview(id, change.data, session.email);
  if (review) return ok(userReview(review));
  if (!await getReview(id)) return fail("ไม่พบคำขอ", 404);
  return fail("คำขอนี้ถูกตรวจแล้วหรือข้อมูลเปลี่ยน กรุณารีเฟรชหน้า", 409);
}, { audit: "vehicle.decision" });
