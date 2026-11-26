import { fail, ok } from "@/lib/http";
import { writeTransaction } from "@/db/client";
import { integrationAccess } from "@/lib/integration-access";
import { addVehicleReview, listApplicantReviews, userReview, vehicleReviewSchema } from "@/services/vehicle-reviews";
import { applicantVehicleChanges } from "@/services/vehicle-changes";

export async function GET(request: Request) {
  const denied = integrationAccess(request);
  if (denied) return denied;
  const applicantId = new URL(request.url).searchParams.get("applicantId");
  if (!applicantId?.trim() || applicantId.length > 120) return fail("A valid applicantId is required", 422);
  return writeTransaction(async (transaction) => {
    const reviews = await listApplicantReviews(applicantId, transaction);
    const changes = await applicantVehicleChanges(applicantId, transaction);
    const byVehicle = new Map(changes.map((change) => [change.reviewId, change]));
    const items = reviews.map((review) => ({
      ...userReview(review), plate: review.plate, province: review.province, brand: review.brand, vehicleType: review.vehicleType,
      change: byVehicle.get(review.id) ?? null,
    }));
    const response = ok({ items, deleted: changes.filter((change) => change.deletedAt !== null) });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  });
}

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
