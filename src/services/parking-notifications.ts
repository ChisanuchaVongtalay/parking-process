import { randomUUID } from "node:crypto";
import type { Transaction } from "@libsql/client";
import { query, queryRow, queryRows } from "@/db/client";
import { BookingProblem, bookingEvents, bookingRows, liveAvailability } from "./parking-bookings";

const title = {
  created: "จองที่จอดสำเร็จ", cancelled: "ยกเลิกการจองแล้ว", expired: "การจองหมดอายุแล้ว",
};

async function notify(transaction: Transaction, id: string, userId: string, type: string,
  text: string, body: string, at: number, zoneId: string, bookingId: string | null = null) {
  await query(`INSERT INTO parking_notifications (id, applicant_id, type, title, body, created_at, zone_code, booking_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
  [id, userId, type, text, body, at, zoneId, bookingId], transaction);
}

export async function parkingNotifications(userId: string, now: number, transaction: Transaction) {
  const bookings = await bookingRows(userId, transaction);
  const known = new Set((await queryRows<{ id: string }>("SELECT id FROM parking_notifications WHERE applicant_id = ?", [userId], transaction)).map((item) => item.id));
  for (const booking of bookings) {
    for (const event of bookingEvents(booking, now)) {
      const id = `notification-${event.id}`;
      if (known.has(id)) continue;
      await notify(transaction, id, userId, `booking-${event.type}`, title[event.type],
        `${booking.zoneId} · ${booking.slotId}`, Date.parse(event.timestamp), booking.zoneId, booking.id);
    }
    const reminderId = `notification-${booking.id}-ending`;
    if (!known.has(reminderId) && booking.cancelledAt === null && booking.startsAt <= now &&
        booking.expiresAt > now && booking.expiresAt - now <= 300_000) {
      await notify(transaction, reminderId, userId, "booking-ending", "การจองเหลือเวลาไม่เกิน 5 นาที",
        `${booking.zoneId} · ${booking.slotId}`, Math.max(booking.startsAt, booking.expiresAt - 300_000), booking.zoneId, booking.id);
    }
  }

  const watches = await queryRows<{ id: string; code: string; status: string | null }>(`SELECT z.id, UPPER(z.code) AS code, w.last_status AS status
    FROM parking_zone_watches w JOIN zones z ON z.id = w.zone_id WHERE w.applicant_id = ?`, [userId], transaction);
  if (watches.length) {
    const zones = await liveAvailability(now, now + 1, transaction);
    for (const watch of watches) {
      const zone = zones.find((item) => item.id === watch.id);
      if (!zone || zone.total === 0 || zone.known !== zone.total) continue;
      const free = zone.bookableSlots.length;
      const status = free === 0 ? "full" : free / zone.total <= 0.3 ? "nearly-full" : "available";
      if (status === watch.status) continue;
      await query("UPDATE parking_zone_watches SET last_status = ? WHERE applicant_id = ? AND zone_id = ?", [status, userId, zone.id], transaction);
      if (status !== "available") await notify(transaction, randomUUID(), userId, `zone-${status}`,
        `โซน ${zone.zoneId} ${status === "full" ? "เต็มแล้ว" : "ใกล้เต็ม"}`,
        `พร้อมจอง ${free} จาก ${zone.total} ช่อง`, now, zone.zoneId);
    }
  }

  const rows = await queryRows<{ id: string; userId: string; type: string; title: string; body: string;
    createdAt: number; readAt: number | null; zoneId: string | null; bookingId: string | null }>(`
    SELECT id, applicant_id AS userId, type, title, body, created_at AS createdAt,
      read_at AS readAt, zone_code AS zoneId, booking_id AS bookingId FROM parking_notifications
    WHERE applicant_id = ? ORDER BY created_at DESC, id`, [userId], transaction);
  return { userId, notifications: rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt).toISOString(),
    readAt: row.readAt === null ? null : new Date(row.readAt).toISOString(),
    zoneId: row.zoneId ?? undefined, bookingId: row.bookingId ?? undefined,
  })), followedZoneIds: watches.map((watch) => watch.code) };
}

export async function markParkingNotifications(userId: string, now: number, transaction: Transaction, id?: string) {
  const result = await query(`UPDATE parking_notifications SET read_at = COALESCE(read_at, ?)
    WHERE applicant_id = ? AND (id = ? OR (? IS NULL AND read_at IS NULL))`, [now, userId, id ?? null, id ?? null], transaction);
  if (id && !result.rowsAffected) throw new BookingProblem("ไม่พบข้อความแจ้งเตือนของบัญชีนี้", 404);
}

export async function watchParkingZone(userId: string, code: string, follow: boolean, transaction: Transaction) {
  const zone = await queryRow<{ id: string }>("SELECT id FROM zones WHERE UPPER(code) = UPPER(?)", [code], transaction);
  if (!zone) throw new BookingProblem("ไม่พบโซนนี้", 404);
  if (follow) await query(`INSERT INTO parking_zone_watches (applicant_id, zone_id) VALUES (?, ?)
    ON CONFLICT(applicant_id, zone_id) DO NOTHING`, [userId, zone.id], transaction);
  else await query("DELETE FROM parking_zone_watches WHERE applicant_id = ? AND zone_id = ?", [userId, zone.id], transaction);
}
