import type { Transaction } from "@libsql/client";
import { query, queryRow, queryRows } from "@/db/client";

const kinds = {
  vehicle_registration: { title: "มีคำขอลงทะเบียนรถใหม่", category: "vehicle" },
  vehicle_edit: { title: "มีคำขอแก้ไขข้อมูลรถ", category: "vehicle" },
  vehicle_removal: { title: "มีคำขอลบรถ", category: "vehicle" },
  camera_unavailable: { title: "กล้องดึงภาพผิดปกติ", category: "camera" },
  camera_recovered: { title: "กล้องกลับมาส่งภาพแล้ว", category: "camera" },
  booking_policy: { title: "เผยแพร่นโยบายการจองใหม่", category: "policy" },
} as const;

type Kind = keyof typeof kinds;
type NotificationRow = {
  id: number;
  kind: Kind;
  targetId: string;
  detail: string | null;
  createdAt: number;
  readAt: number | null;
  targetExists: number;
};

export function recordAdminNotification(
  transaction: Transaction, kind: Kind, targetId: string, at: number, detail: string | null = null,
) {
  return query(`INSERT INTO admin_notifications (kind, target_id, detail, created_at) VALUES (?, ?, ?, ?)`,
    [kind, targetId, detail, at], transaction);
}

const pageSize = 12;

export async function readAdminNotifications(accountId: string, before: number, unreadOnly: boolean) {
  const [counts, rows] = await Promise.all([
    queryRow<{ latestId: number; unread: number }>(`
      SELECT COALESCE(MAX(n.id), 0) AS latestId,
             COUNT(*) - COUNT(r.notification_id) AS unread
      FROM admin_notifications n
      LEFT JOIN admin_notification_reads r ON r.notification_id = n.id AND r.account_id = ?
    `, [accountId]),
    queryRows<NotificationRow>(`
      SELECT n.id, n.kind, n.target_id AS targetId, n.detail, n.created_at AS createdAt, r.read_at AS readAt,
             EXISTS(SELECT 1 FROM vehicle_reviews v WHERE v.id = n.target_id AND v.deleted_at IS NULL) AS targetExists
      FROM admin_notifications n
      LEFT JOIN admin_notification_reads r ON r.notification_id = n.id AND r.account_id = ?
      WHERE n.id < ? AND (? = 0 OR r.notification_id IS NULL)
      ORDER BY n.id DESC LIMIT ?
    `, [accountId, before, Number(unreadOnly), pageSize + 1]),
  ]);
  const items = rows.slice(0, pageSize).map((row) => {
    const { title, category } = kinds[row.kind];
    const target = encodeURIComponent(row.targetId);
    const href = category === "camera" ? `/admin/cameras/${target}`
      : category === "policy" ? "/admin/policies"
      : row.targetExists ? `/admin/vehicle-approvals/${target}${row.kind === "vehicle_registration" ? "" : "#vehicle-change-request"}`
      : "/admin/vehicle-approvals";
    return { id: row.id, category, title, detail: row.detail, href, createdAt: row.createdAt, readAt: row.readAt };
  });
  return {
    items,
    latestId: counts?.latestId ?? 0,
    unread: counts?.unread ?? 0,
    nextBefore: rows.length > pageSize ? items.at(-1)!.id : null,
  };
}

export type AdminNotificationFeed = Awaited<ReturnType<typeof readAdminNotifications>>;

export async function markAdminNotificationsRead(accountId: string, selection: { id: number } | { through: number }) {
  const individual = "id" in selection;
  await query(`
    INSERT INTO admin_notification_reads (account_id, notification_id, read_at)
    SELECT ?, n.id, ? FROM admin_notifications n WHERE n.id ${individual ? "= ?" : "<= ?"}
    ON CONFLICT (account_id, notification_id) DO NOTHING
  `, [accountId, Date.now(), individual ? selection.id : selection.through]);
}
