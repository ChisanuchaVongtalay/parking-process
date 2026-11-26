import { integrationAccess } from "@/lib/integration-access";
import { fail, ok } from "@/lib/http";
import { requestVehicleChange, vehicleMutationSchema, vehicleRequestReasonSchema } from "@/services/vehicle-changes";
import { applicantIdSchema } from "@/services/vehicle-reviews";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = integrationAccess(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const applicant = applicantIdSchema.safeParse(body?.applicantId);
  const mutation = vehicleMutationSchema.safeParse(body?.mutation);
  if (!applicant.success || !mutation.success) return fail("Invalid vehicle change request", 422);
  const requestReason = vehicleRequestReasonSchema.safeParse(body?.requestReason);
  if (!requestReason.success) return fail("A request reason of 1–1000 characters is required", 422);
  const result = await requestVehicleChange((await params).id, applicant.data, mutation.data, requestReason.data);
  if (result.code === "missing") return fail("Vehicle not found", 404);
  if (result.code === "conflict") return fail("Vehicle was changed or a request is already pending", 409);
  return ok({ id: result.id, kind: mutation.data.kind, status: "pending", requestReason: requestReason.data, reason: null },
    result.code === "created" ? 201 : 200);
}
