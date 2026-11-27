import type { Transaction } from "@libsql/client";
import { query, queryRow, queryRows, writeTransaction } from "@/db/client";
import { recordAdminNotification } from "./admin-notifications";

const configuredAge = Number(process.env.SNAPSHOT_MAX_AGE_SECONDS || 900);
const freshnessMs = (Number.isFinite(configuredAge) && configuredAge > 0 ? configuredAge : 900) * 1000;
const monitored = "c.is_active = 1 AND NULLIF(TRIM(c.stream_url), '') IS NOT NULL";
type Issue = "error" | "stale";

async function cameraLabel(id: string, transaction: Transaction) {
  const camera = await queryRow<{ label: string }>(`
    SELECT z.code || ' · ' || c.code AS label
    FROM cameras c JOIN zones z ON z.id = c.zone_id
    WHERE c.id = ? AND ${monitored}
  `, [id], transaction);
  return camera?.label;
}

export async function openCameraIncident(id: string, issue: Issue, at: number, transaction: Transaction) {
  const inserted = await query(`
    INSERT INTO admin_camera_incidents (camera_id, opened_at)
    SELECT c.id, ? FROM cameras c WHERE c.id = ? AND ${monitored}
    ON CONFLICT (camera_id) DO NOTHING
  `, [at, id], transaction);
  if (!inserted.rowsAffected) return;
  const label = await cameraLabel(id, transaction);
  const reason = issue === "error" ? "ดึงภาพไม่สำเร็จ" : "ไม่มีภาพใหม่ในช่วงเวลาที่กำหนด";
  await recordAdminNotification(transaction, "camera_unavailable", id, at, label ? `${label} · ${reason}` : reason);
}

export async function closeCameraIncident(id: string, at: number, transaction: Transaction) {
  const closed = await query("DELETE FROM admin_camera_incidents WHERE camera_id = ? AND opened_at <= ?", [id, at], transaction);
  if (!closed.rowsAffected) return;
  const label = await cameraLabel(id, transaction);
  if (label) await recordAdminNotification(transaction, "camera_recovered", id, at, label);
}

type Transition = { id: string; action: Issue | "recovered" | "disabled"; captureAt: number | null };

function findTransitions(now: number, transaction?: Transaction) {
  return queryRows<Transition>(`
    WITH states AS (
      SELECT c.id, s.last_success_at AS captureAt, i.opened_at AS openedAt,
        CASE
          WHEN NOT (${monitored}) THEN 'disabled'
          WHEN s.last_error IS NOT NULL THEN 'error'
          WHEN COALESCE(s.last_success_at, c.updated_at) <= ? THEN 'stale'
          ELSE 'healthy'
        END AS state
      FROM cameras c
      LEFT JOIN snapshot_capture_status s ON s.camera_id = c.id
      LEFT JOIN admin_camera_incidents i ON i.camera_id = c.id
    )
    SELECT id, CASE WHEN state = 'healthy' THEN 'recovered' ELSE state END AS action, captureAt
    FROM states
    WHERE (openedAt IS NULL AND state IN ('error', 'stale'))
       OR (openedAt IS NOT NULL AND (state = 'disabled' OR (state = 'healthy' AND captureAt >= openedAt)))
  `, [now - freshnessMs], transaction);
}

// An Admin request can detect missing captures even when the worker itself has stopped.
export async function reconcileCameraAlerts() {
  const now = Date.now();
  if (!(await findTransitions(now)).length) return;
  await writeTransaction(async (transaction) => {
    for (const transition of await findTransitions(now, transaction)) {
      if (transition.action === "disabled") {
        await query("DELETE FROM admin_camera_incidents WHERE camera_id = ?", [transition.id], transaction);
      } else if (transition.action === "recovered" && transition.captureAt !== null) {
        await closeCameraIncident(transition.id, transition.captureAt, transaction);
      } else if (transition.action === "error" || transition.action === "stale") {
        await openCameraIncident(transition.id, transition.action, now, transaction);
      }
    }
  });
}
