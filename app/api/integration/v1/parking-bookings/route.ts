import { z } from "zod";
import { writeTransaction } from "@/db/client";
import { fail, ok } from "@/lib/http";
import { integrationAccess } from "@/lib/integration-access";
import { availableBookingSlots, BookingProblem, bookingSnapshot, bookingWindowSchema, cancelParkingBooking, createParkingBooking } from "@/services/parking-bookings";
import { markParkingNotifications, parkingNotifications, watchParkingZone } from "@/services/parking-notifications";
import { applicantIdSchema } from "@/services/vehicle-reviews";

const id = z.string().trim().min(1).max(180);
const payload = z.object({ applicantId: applicantIdSchema, role: z.enum(["student", "staff"]), command: z.discriminatedUnion("action", [
  z.object({ action: z.literal("snapshot") }),
  bookingWindowSchema.extend({ action: z.literal("available") }),
  bookingWindowSchema.extend({ action: z.literal("create"), requestId: z.uuid() }),
  z.object({ action: z.literal("cancel"), bookingId: id }),
  z.object({ action: z.literal("notifications") }),
  z.object({ action: z.literal("mark-read"), id }),
  z.object({ action: z.literal("mark-all-read") }),
  z.object({ action: z.literal("watch"), zoneId: id, follow: z.boolean() }),
]) });

export async function POST(request: Request) {
  const denied = integrationAccess(request);
  if (denied) return denied;
  const parsed = payload.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("กรุณาตรวจสอบโซน ประเภทรถ และช่วงเวลา", 422);
  const { applicantId, role, command } = parsed.data;
  try {
    const data = await writeTransaction(async (transaction) => {
      const now = Date.now();
      switch (command.action) {
        case "snapshot": return bookingSnapshot(applicantId, role, now, transaction);
        case "available": return availableBookingSlots(command, role, now, transaction);
        case "create": return createParkingBooking(applicantId, role, command, now, transaction);
        case "notifications": return parkingNotifications(applicantId, now, transaction);
        case "cancel": return cancelParkingBooking(applicantId, command.bookingId, now, transaction);
        case "mark-read": return markParkingNotifications(applicantId, now, transaction, command.id);
        case "mark-all-read": return markParkingNotifications(applicantId, now, transaction);
        case "watch": return watchParkingZone(applicantId, command.zoneId, command.follow, transaction);
      }
    });
    const response = ok(data ?? null);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    if (error instanceof BookingProblem) return fail(error.message, error.status);
    console.error("Parking booking request failed", error instanceof Error ? error.name : "Unknown error");
    return fail("ระบบจองไม่พร้อมใช้งาน", 500);
  }
}
