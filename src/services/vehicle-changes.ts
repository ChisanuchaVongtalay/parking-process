import { randomUUID } from "node:crypto";
import type { Transaction } from "@libsql/client";
import { z } from "zod";
import { query, queryRow, queryRows, writeTransaction } from "@/db/client";
import { recordAudit } from "@/lib/auth/session";
import { reviewColumns, vehicleFieldsSchema, type Review } from "./vehicle-reviews";

const version = z.number().int().positive();
export const vehicleMutationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("edit"), version, changes: vehicleFieldsSchema }),
  z.object({ kind: z.literal("delete"), version }),
]);
export const changeDecisionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reason: z.string().trim().max(1000).optional(),
}).refine((value) => value.status === "approved" || Boolean(value.reason));
export const vehicleRequestReasonSchema = z.string().trim().min(1).max(1000);

type Mutation = z.infer<typeof vehicleMutationSchema>;
type Decision = z.infer<typeof changeDecisionSchema>;
type ChangeRow = {
  id: string; reviewId: string; kind: Mutation["kind"]; changesJson: string | null;
  baseVersion: number; status: Decision["status"] | "pending";
  requestReason: string | null; reason: string | null; createdAt: number; reviewedAt: number | null;
};
const changeColumns = `c.id, c.review_id AS reviewId, c.kind, c.changes_json AS changesJson,
  c.base_version AS baseVersion, c.status, c.request_reason AS requestReason, c.reason,
  c.created_at AS createdAt, c.reviewed_at AS reviewedAt`;

export function vehicleChange<T extends ChangeRow>(row: T) {
  const { changesJson, ...data } = row;
  return { ...data, changes: changesJson ? vehicleFieldsSchema.parse(JSON.parse(changesJson)) : null };
}

export async function latestVehicleChange(id: string, transaction?: Transaction) {
  const row = await queryRow<ChangeRow>(`SELECT ${changeColumns} FROM vehicle_change_requests c
    WHERE c.review_id = ? ORDER BY c.rowid DESC LIMIT 1`, [id], transaction);
  return row ? vehicleChange(row) : null;
}

export async function listPendingVehicleChanges(limit: number, offset: number) {
  return queryRows<{ id: string; reviewId: string; kind: Mutation["kind"]; plate: string; province: string; createdAt: number }>(`
    SELECT c.id, c.review_id AS reviewId, c.kind, v.plate, v.province, c.created_at AS createdAt
    FROM vehicle_change_requests c JOIN vehicle_reviews v ON v.id = c.review_id
    WHERE c.status = 'pending' AND v.deleted_at IS NULL ORDER BY c.created_at, c.id LIMIT ? OFFSET ?`, [limit, offset]);
}

export async function applicantVehicleChanges(applicantId: string, transaction?: Transaction) {
  const rows = await queryRows<ChangeRow & { plate: string; deletedAt: number | null }>(`
    SELECT ${changeColumns}, v.plate, v.deleted_at AS deletedAt
    FROM vehicle_change_requests c JOIN vehicle_reviews v ON v.id = c.review_id
    WHERE v.applicant_id = ? AND c.rowid = (
      SELECT latest.rowid FROM vehicle_change_requests latest WHERE latest.review_id = c.review_id
      ORDER BY latest.rowid DESC LIMIT 1
    )
    ORDER BY c.created_at DESC`, [applicantId], transaction);
  return rows.map(vehicleChange);
}

export async function requestVehicleChange(id: string, applicantId: string, mutation: Mutation, requestReason: string) {
  return writeTransaction(async (transaction) => {
    const review = await queryRow<Review>(`SELECT ${reviewColumns} FROM vehicle_reviews
      WHERE id = ? AND applicant_id = ? AND deleted_at IS NULL`, [id, applicantId], transaction);
    if (!review) return { code: "missing" } as const;
    if (review.version !== mutation.version) return { code: "conflict" } as const;
    const pending = await queryRow<ChangeRow>(`SELECT ${changeColumns} FROM vehicle_change_requests c
      WHERE c.review_id = ? AND c.status = 'pending'`, [id], transaction);
    const changes = mutation.kind === "edit" ? JSON.stringify(mutation.changes) : null;
    if (pending) {
      return pending.kind === mutation.kind && pending.changesJson === changes && pending.requestReason === requestReason
        ? { code: "repeat", id: pending.id } as const : { code: "conflict" } as const;
    }
    const changeId = randomUUID();
    await query(`INSERT INTO vehicle_change_requests (id, review_id, kind, changes_json, base_version, created_at, request_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)`, [changeId, id, mutation.kind, changes, mutation.version, Date.now(), requestReason], transaction);
    return { code: "created", id: changeId } as const;
  });
}

async function applyMutation(id: string, mutation: Mutation, at: number, transaction: Transaction) {
  const update = mutation.kind === "edit" ? await query(`UPDATE vehicle_reviews
    SET plate = ?, province = ?, brand = ?, vehicle_type = ?, version = version + 1
    WHERE id = ? AND version = ? AND deleted_at IS NULL`, [mutation.changes.plate, mutation.changes.province,
    mutation.changes.brand, mutation.changes.vehicleType, id, mutation.version], transaction)
    : await query(`UPDATE vehicle_reviews SET deleted_at = ?, version = version + 1
      WHERE id = ? AND version = ? AND deleted_at IS NULL`, [at, id, mutation.version], transaction);
  return update.rowsAffected === 1;
}

export function manageVehicle(id: string, mutation: Mutation, actor: string) {
  return writeTransaction(async (transaction) => {
    const at = Date.now();
    if (!await applyMutation(id, mutation, at, transaction)) return false;
    const changes = mutation.kind === "edit" ? JSON.stringify(mutation.changes) : null;
    await query(`UPDATE vehicle_change_requests
      SET status = CASE WHEN kind = ? AND changes_json IS ? THEN 'approved' ELSE 'rejected' END,
          reason = ?, reviewed_at = ?, reviewed_by = ?
      WHERE review_id = ? AND status = 'pending'`, [mutation.kind, changes, "ผู้ดูแลจัดการข้อมูลรถโดยตรง", at, actor, id], transaction);
    await recordAudit(actor, `vehicle.${mutation.kind}`, id, 200, transaction);
    return true;
  });
}

export function decideVehicleChange(id: string, decision: Decision, actor: string) {
  return writeTransaction(async (transaction) => {
    const row = await queryRow<ChangeRow>(`SELECT ${changeColumns} FROM vehicle_change_requests c
      WHERE c.id = ? AND c.status = 'pending'`, [id], transaction);
    if (!row) return false;
    const at = Date.now();
    if (decision.status === "approved") {
      const change = vehicleChange(row);
      const mutation = vehicleMutationSchema.parse({ kind: change.kind, version: change.baseVersion, changes: change.changes });
      if (!await applyMutation(change.reviewId, mutation, at, transaction)) return false;
    }
    await query(`UPDATE vehicle_change_requests SET status = ?, reason = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?`,
      [decision.status, decision.reason || null, at, actor, id], transaction);
    await recordAudit(actor, `vehicle.change.${decision.status}`, row.reviewId, 200, transaction);
    return true;
  });
}
