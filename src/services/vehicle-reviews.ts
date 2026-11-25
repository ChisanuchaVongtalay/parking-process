import { createHash } from "node:crypto";
import { z } from "zod";
import { queryRow, queryRows, writeTransaction } from "@/db/client";
import { CLOUD_FILE_LIMIT, writeDatabaseFile } from "@/lib/storage";

export const vehicleReviewSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,99}$/i),
  applicantId: z.string().trim().min(1).max(120),
  vehicleId: z.string().trim().min(1).max(120),
  plate: z.string().trim().min(1).max(32),
  province: z.string().trim().min(1).max(100),
  brand: z.string().trim().min(1).max(100),
  vehicleType: z.enum(["Sedan", "Hatchback", "SUV", "Pickup", "Van", "Motorcycle", "Other"]),
});

export const decisionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  version: z.number().int().positive(),
  reason: z.string().trim().max(1000).optional(),
}).refine((value) => value.status !== "rejected" || Boolean(value.reason));

type Submission = z.infer<typeof vehicleReviewSchema>;
export type Review = Submission & {
  status: "pending" | "approved" | "rejected";
  version: number;
  evidenceType: string;
  evidenceHash: string;
  reason: string | null;
  reviewedAt: number | null;
  reviewedBy: string | null;
  createdAt: number;
};

export const reviewColumns = `id, applicant_id AS applicantId, vehicle_id AS vehicleId,
  plate, province, brand, vehicle_type AS vehicleType, status, version, reason,
  evidence_type AS evidenceType, evidence_hash AS evidenceHash, reviewed_at AS reviewedAt,
  reviewed_by AS reviewedBy, created_at AS createdAt`;

export function userReview(review: Review) {
  return {
    id: review.id, vehicleId: review.vehicleId, status: review.status, version: review.version,
    reason: review.reason, createdAt: review.createdAt, reviewedAt: review.reviewedAt,
  };
}

export function getReview(id: string) {
  return queryRow<Review>(`SELECT ${reviewColumns} FROM vehicle_reviews WHERE id = ?`, [id]);
}

export function listApplicantReviews(applicantId: string) {
  return queryRows<Review>(`SELECT ${reviewColumns} FROM vehicle_reviews WHERE applicant_id = ? ORDER BY created_at DESC, id`, [applicantId]);
}

export async function addVehicleReview(submission: Submission, file: File) {
  if (!file.size || file.size > CLOUD_FILE_LIMIT) return { code: "size" } as const;
  const bytes = Buffer.from(await file.arrayBuffer());
  const fileType = bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ? "image/jpeg"
    : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "image/png"
    : bytes.subarray(0, 5).toString("ascii") === "%PDF-" ? "application/pdf" : null;
  if (!fileType) return { code: "format" } as const;
  const digest = createHash("sha256").update(bytes).digest("hex");

  return writeTransaction(async (transaction) => {
    const existing = await queryRow<Review>(`SELECT ${reviewColumns} FROM vehicle_reviews WHERE id = ?`, [submission.id], transaction);
    if (existing) {
      const keys = Object.keys(submission) as (keyof Submission)[];
      return keys.every((key) => submission[key] === existing[key]) && existing.evidenceHash === digest
        ? { code: "repeat", review: existing } as const : { code: "conflict" } as const;
    }
    const review = await queryRow<Review>(`
      INSERT INTO vehicle_reviews (id, applicant_id, vehicle_id, plate, province, brand, vehicle_type, evidence_type, evidence_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING ${reviewColumns}
    `, [submission.id, submission.applicantId, submission.vehicleId, submission.plate, submission.province,
      submission.brand, submission.vehicleType, fileType, digest, Date.now()], transaction);
    await writeDatabaseFile(`evidence/${submission.id}`, bytes, transaction);
    if (!review) throw new Error("Vehicle review was not saved");
    return { code: "created", review } as const;
  });
}

export async function decideVehicleReview(id: string, change: z.infer<typeof decisionSchema>, actor: string) {
  return queryRow<Review>(`
    UPDATE vehicle_reviews SET status = ?, reason = ?, reviewed_at = ?, reviewed_by = ?, version = version + 1
    WHERE id = ? AND status = 'pending' AND version = ?
    RETURNING ${reviewColumns}
  `, [change.status, change.reason || null, Date.now(), actor, id, change.version]);
}
