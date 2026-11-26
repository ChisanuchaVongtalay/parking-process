import { createHash } from "node:crypto";
import type { Transaction } from "@libsql/client";
import { z } from "zod";
import { query, queryRow, queryRows } from "@/db/client";
import { readParkingOverview } from "@/lib/admin-overview";
import { getEffectivePolicy } from "./booking-policies";

export const bookingWindowSchema = z.object({
  zoneId: z.string().trim().min(1).max(120).transform((value) => value.toUpperCase()),
  vehicleType: z.enum(["car", "motorcycle"]),
  startsAt: z.iso.datetime({ offset: true }).nullable(),
  durationMinutes: z.number().int().min(5).max(10_080),
});
type Window = z.infer<typeof bookingWindowSchema>;
export type BookingRole = "student" | "staff";
export type BookingRow = {
  id: string; userId: string; zoneId: string; slotId: string; vehicleType: Window["vehicleType"];
  createdAt: number; startsAt: number; expiresAt: number; cancelledAt: number | null;
};
const columns = `id, applicant_id AS userId, zone_code AS zoneId, slot_code AS slotId,
  vehicle_type AS vehicleType, created_at AS createdAt, starts_at AS startsAt, expires_at AS expiresAt, cancelled_at AS cancelledAt`;
const minute = 60_000;
const iso = (time: number) => new Date(time).toISOString();

export class BookingProblem extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}

export async function bookingPolicy(role: BookingRole, transaction: Transaction) {
  const current = await getEffectivePolicy(transaction);
  const policy = current?.policy[role];
  return { role, maxActiveBookings: policy?.maxActive ?? (role === "staff" ? 2 : 1),
    maxMinutes: policy ? policy.maxDurationHours * 60 : (role === "staff" ? 120 : 60),
    advanceHours: policy ? policy.advanceDays * 24 : (role === "staff" ? 48 : 24) };
}

export function bookingRows(userId: string, transaction: Transaction) {
  return queryRows<BookingRow>(`SELECT ${columns} FROM parking_bookings WHERE applicant_id = ? ORDER BY created_at DESC, id`, [userId], transaction);
}

export function bookingEvents(booking: BookingRow, now: number) {
  const event = (type: "created" | "cancelled" | "expired", at: number) => ({
    id: `${booking.id}-${type}`, bookingId: booking.id, userId: booking.userId, slotId: booking.slotId, type, timestamp: iso(at),
  });
  const events = [event("created", booking.createdAt)];
  if (booking.cancelledAt !== null) events.push(event("cancelled", booking.cancelledAt));
  else if (booking.expiresAt <= now) events.push(event("expired", booking.expiresAt));
  return events;
}

function bookingView(booking: BookingRow, now: number) {
  const { createdAt, startsAt, expiresAt, cancelledAt, ...data } = booking;
  return { ...data, createdAt: iso(createdAt), startsAt: iso(startsAt), expiresAt: iso(expiresAt),
    status: cancelledAt !== null ? "cancelled" : expiresAt <= now ? "expired" : "confirmed" };
}

export async function liveAvailability(start: number, end: number, transaction: Transaction) {
  const { zones } = await readParkingOverview(transaction);
  const reservations = await queryRows<{ slotId: string }>(`SELECT DISTINCT slot_id AS slotId FROM parking_bookings
    WHERE cancelled_at IS NULL AND starts_at < ? AND expires_at > ?`, [end, start], transaction);
  const reserved = new Set(reservations.map((row) => row.slotId));
  return zones.map((zone) => ({
    id: zone.id, zoneId: zone.code.toUpperCase(), total: zone.slots.length, known: zone.free + zone.occupied,
    reservedSlots: zone.slots.filter((slot) => reserved.has(slot.id)),
    bookableSlots: zone.slots.filter((slot) => slot.status === "Free" && !reserved.has(slot.id)),
  }));
}

export async function bookingSnapshot(userId: string, role: BookingRole, now: number, transaction: Transaction) {
  const bookings = await bookingRows(userId, transaction);
  const approved = await queryRows<{ vehicleType: string }>(`SELECT DISTINCT vehicle_type AS vehicleType FROM vehicle_reviews
    WHERE applicant_id = ? AND status = 'approved' AND deleted_at IS NULL`, [userId], transaction);
  const availability = await liveAvailability(now, now + 1, transaction);
  return { bookings: bookings.map((booking) => bookingView(booking, now)),
    events: bookings.flatMap((booking) => bookingEvents(booking, now)), policy: await bookingPolicy(role, transaction),
    approvedVehicleTypes: [...new Set(approved.map((row) => row.vehicleType === "Motorcycle" ? "motorcycle" : "car"))],
    availability: availability.map(({ zoneId, bookableSlots, reservedSlots }) => ({
      zoneId, reserved: reservedSlots.length, bookable: bookableSlots.length,
      carBookable: bookableSlots.filter((slot) => slot.vehicleType === "car").length,
      motorcycleBookable: bookableSlots.filter((slot) => slot.vehicleType === "motorcycle").length,
      reservedSlotIds: reservedSlots.map((slot) => slot.code),
    })) };
}

async function available(request: Window, role: BookingRole, now: number, transaction: Transaction) {
  const start = request.startsAt === null ? now : Date.parse(request.startsAt);
  const end = start + request.durationMinutes * minute;
  const policy = await bookingPolicy(role, transaction);
  if (start < now) throw new BookingProblem("เวลาเริ่มต้องไม่อยู่ในอดีต กรุณาเลือกเวลาใหม่", 422);
  if (request.durationMinutes > policy.maxMinutes) throw new BookingProblem(`จองได้ครั้งละไม่เกิน ${policy.maxMinutes} นาที`, 422);
  if (start > now + policy.advanceHours * 60 * minute) throw new BookingProblem(`จองล่วงหน้าได้ไม่เกิน ${policy.advanceHours} ชั่วโมง`, 422);
  const zone = (await liveAvailability(start, end, transaction)).find((item) => item.zoneId === request.zoneId);
  if (!zone) throw new BookingProblem("ไม่พบโซนนี้", 404);
  return { start, end, policy, slots: zone.bookableSlots.filter((slot) => slot.vehicleType === request.vehicleType) };
}

export async function availableBookingSlots(request: Window, role: BookingRole, now: number, transaction: Transaction) {
  return (await available(request, role, now, transaction)).slots.map((slot) => slot.code);
}

export async function createParkingBooking(userId: string, role: BookingRole, request: Window & { requestId: string }, now: number, transaction: Transaction) {
  const id = createHash("sha256").update(`${userId}:${request.requestId}`).digest("hex");
  const previous = await queryRow<BookingRow>(`SELECT ${columns} FROM parking_bookings WHERE id = ? AND applicant_id = ?`, [id, userId], transaction);
  if (previous) {
    if (previous.zoneId !== request.zoneId || previous.vehicleType !== request.vehicleType ||
        previous.expiresAt - previous.startsAt !== request.durationMinutes * minute ||
        (request.startsAt !== null && previous.startsAt !== Date.parse(request.startsAt))) {
      throw new BookingProblem("คำขอนี้ถูกใช้กับการจองอื่นแล้ว");
    }
    return bookingView(previous, now);
  }
  const vehicle = await queryRow<{ id: string }>(`SELECT id FROM vehicle_reviews WHERE applicant_id = ? AND status = 'approved'
    AND deleted_at IS NULL AND (vehicle_type = 'Motorcycle') = ? ORDER BY created_at, id LIMIT 1`,
  [userId, request.vehicleType === "motorcycle" ? 1 : 0], transaction);
  if (!vehicle) throw new BookingProblem("ต้องลงทะเบียนรถประเภทนี้และได้รับอนุมัติก่อนจอง", 403);
  const { start, end, slots, policy } = await available(request, role, now, transaction);
  const active = await queryRows<{ startsAt: number; expiresAt: number }>(`SELECT starts_at AS startsAt, expires_at AS expiresAt
    FROM parking_bookings WHERE applicant_id = ? AND cancelled_at IS NULL AND expires_at > ?`, [userId, now], transaction);
  if (active.some((booking) => booking.startsAt < end && start < booking.expiresAt)) throw new BookingProblem("คุณมีการจองในช่วงเวลานี้แล้ว");
  if (active.length >= policy.maxActiveBookings) throw new BookingProblem(`มีการจองที่ยังไม่สิ้นสุดได้สูงสุด ${policy.maxActiveBookings} รายการ`);
  const slot = slots[0];
  if (!slot) throw new BookingProblem("ไม่มีช่องพร้อมจองสำหรับรถและช่วงเวลาที่เลือก");
  const booking = await queryRow<BookingRow>(`INSERT INTO parking_bookings
    (id, applicant_id, vehicle_review_id, slot_id, slot_code, zone_code, vehicle_type, created_at, starts_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING ${columns}`,
  [id, userId, vehicle.id, slot.id, slot.code, request.zoneId, request.vehicleType, now, start, end], transaction);
  if (!booking) throw new Error("Booking was not saved");
  return bookingView(booking, now);
}

export async function cancelParkingBooking(userId: string, id: string, now: number, transaction: Transaction) {
  const result = await query(`UPDATE parking_bookings SET cancelled_at = ?
    WHERE id = ? AND applicant_id = ? AND cancelled_at IS NULL AND expires_at > ?`, [now, id, userId, now], transaction);
  if (!result.rowsAffected) {
    const existing = await queryRow<{ cancelledAt: number | null }>("SELECT cancelled_at AS cancelledAt FROM parking_bookings WHERE id = ? AND applicant_id = ?", [id, userId], transaction);
    if (!existing) throw new BookingProblem("ไม่พบการจองของบัญชีนี้", 404);
    if (existing.cancelledAt === null) throw new BookingProblem("การจองนี้หมดอายุแล้ว");
  }
}
