import { adminEndpoint } from "@/lib/auth/access";
import { fail, ok } from "@/lib/http";
import { manageVehicle, vehicleMutationSchema } from "@/services/vehicle-changes";

export const PATCH = adminEndpoint(async (session, request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const mutation = vehicleMutationSchema.safeParse(await request.json().catch(() => null));
  if (!mutation.success) return fail("กรุณาตรวจสอบข้อมูลรถ", 422);
  if (!await manageVehicle((await params).id, mutation.data, session.email)) {
    return fail("ข้อมูลรถเปลี่ยนแล้ว กรุณารีเฟรชหน้า", 409);
  }
  return ok({ updated: true });
});
