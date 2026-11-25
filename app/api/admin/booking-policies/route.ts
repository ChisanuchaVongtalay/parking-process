import { adminEndpoint } from "@/lib/auth/access";
import { fail, ok } from "@/lib/http";
import { policySchema, publishPolicy } from "@/services/booking-policies";

export const POST = adminEndpoint(async (session, request: Request) => {
  const parsed = policySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("ข้อมูลนโยบายไม่ถูกต้อง", 422);
  const policy = await publishPolicy(parsed.data, session.email);
  return policy ? ok(policy, 201) : fail("นโยบายถูกแก้ไขแล้ว กรุณารีเฟรชก่อนบันทึก", 409);
}, { superAdmin: true, audit: "booking.policy_publish" });
