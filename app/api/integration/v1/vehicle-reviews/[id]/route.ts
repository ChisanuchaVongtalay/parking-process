import { fail, ok } from "@/lib/http";
import { integrationAccess } from "@/lib/integration-access";
import { getReview, userReview } from "@/services/vehicle-reviews";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = integrationAccess(request);
  if (denied) return denied;
  const applicant = new URL(request.url).searchParams.get("applicantId");
  if (!applicant) return fail("applicantId is required", 422);
  const review = await getReview((await params).id);
  if (!review || review.applicantId !== applicant) return fail("Review not found", 404);
  const response = ok(userReview(review));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
