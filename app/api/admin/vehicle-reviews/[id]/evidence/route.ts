import { adminEndpoint } from "@/lib/auth/access";
import { fail } from "@/lib/http";
import { readDatabaseFile } from "@/lib/storage";
import { getReview } from "@/services/vehicle-reviews";

export const GET = adminEndpoint(async (_session, _request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const review = await getReview((await params).id);
  if (!review) return fail("ไม่พบคำขอ", 404);
  const bytes = await readDatabaseFile(`evidence/${review.id}`);
  return new Response(new Uint8Array(bytes), { headers: {
    "Content-Type": review.evidenceType,
    "Content-Disposition": review.evidenceType === "application/pdf" ? 'attachment; filename="evidence.pdf"' : "inline",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}, { audit: "vehicle.evidence_read" });
