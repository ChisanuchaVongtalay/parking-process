import { fail, ok } from "@/lib/http";
import { integrationAccess } from "@/lib/integration-access";
import { addVehicleReview, userReview, vehicleReviewSchema } from "@/services/vehicle-reviews";

export async function POST(request: Request) {
  const denied = integrationAccess(request);
  if (denied) return denied;
  const fields = await request.formData().catch(() => null);
  if (!fields) return fail("Expected multipart form data", 400);
  const submitted = vehicleReviewSchema.safeParse(Object.fromEntries(fields));
  const file = fields.get("evidence");
  if (!submitted.success || !(file instanceof File)) return fail("Invalid vehicle submission or missing evidence", 422);
  const result = await addVehicleReview(submitted.data, file);
  switch (result.code) {
    case "size": return fail("Evidence must be no larger than 3 MiB", 413);
    case "format": return fail("Evidence must be JPEG, PNG, or PDF", 415);
    case "conflict": return fail("Submission ID already exists with different content", 409);
    default: return ok(userReview(result.review), result.code === "created" ? 201 : 200);
  }
}
