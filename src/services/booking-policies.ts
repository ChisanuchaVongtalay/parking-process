import { z } from "zod";
import type { Transaction } from "@libsql/client";
import { queryRow, queryRows, writeTransaction } from "@/db/client";

const limitsSchema = z.object({
  maxActive: z.number().int().min(0).max(100),
  maxDurationHours: z.number().int().min(1).max(168),
  advanceDays: z.number().int().min(0).max(365),
});
export const policySchema = z.object({
  expectedVersion: z.number().int().min(0),
  effectiveDate: z.iso.date(),
  student: limitsSchema,
  staff: limitsSchema,
});

type Row = { version: number; policy: string; effectiveAt: number; updatedAt: number; updatedBy: string };
const selection = "version, policy_json AS policy, effective_at AS effectiveAt, updated_at AS updatedAt, updated_by AS updatedBy";

function toPolicy(row: Row) {
  return { ...row, policy: JSON.parse(row.policy) as Pick<z.infer<typeof policySchema>, "student" | "staff"> };
}

export async function getPolicies() {
  return (await queryRows<Row>(`SELECT ${selection} FROM booking_policy ORDER BY version DESC LIMIT 10`)).map(toPolicy);
}

export async function getEffectivePolicy(transaction?: Transaction) {
  const row = await queryRow<Row>(`SELECT ${selection} FROM booking_policy WHERE effective_at <= ? ORDER BY effective_at DESC, version DESC LIMIT 1`, [Date.now()], transaction);
  return row ? toPolicy(row) : null;
}

export function publishPolicy(input: z.infer<typeof policySchema>, actor: string) {
  return writeTransaction(async (transaction) => {
    const latest = await queryRow<{ version: number }>("SELECT MAX(version) AS version FROM booking_policy", [], transaction);
    const version = latest?.version ?? 0;
    if (input.expectedVersion !== version) return null;
    const effectiveAt = Date.parse(`${input.effectiveDate}T00:00:00+07:00`);
    const row = await queryRow<Row>(`
      INSERT INTO booking_policy (version, policy_json, effective_at, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?) RETURNING ${selection}
    `, [version + 1, JSON.stringify({ student: input.student, staff: input.staff }), effectiveAt, Date.now(), actor], transaction);
    if (!row) throw new Error("Booking policy was not saved");
    return toPolicy(row);
  });
}
