import { z } from "zod";
import { adminEndpoint } from "@/lib/auth/access";
import { fail, ok } from "@/lib/http";
import { reconcileCameraAlerts } from "@/services/admin-camera-alerts";
import { markAdminNotificationsRead, readAdminNotifications } from "@/services/admin-notifications";

const notificationId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const readSelection = z.union([z.strictObject({ id: notificationId }), z.strictObject({ through: notificationId })]);

function privateFeed(data: Awaited<ReturnType<typeof readAdminNotifications>>) {
  const response = ok(data);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const GET = adminEndpoint(async (session, request: Request) => {
  const params = new URL(request.url).searchParams;
  const cursor = notificationId.safeParse(Number(params.get("before") ?? Number.MAX_SAFE_INTEGER));
  if (!cursor.success) return fail("หน้าการแจ้งเตือนไม่ถูกต้อง", 422);

  if (!params.has("before")) await reconcileCameraAlerts();
  return privateFeed(await readAdminNotifications(session.id, cursor.data, params.get("unread") === "1"));
});

export const PATCH = adminEndpoint(async (session, request: Request) => {
  const selection = readSelection.safeParse(await request.json().catch(() => null));
  if (!selection.success) return fail("ข้อมูลการแจ้งเตือนไม่ถูกต้อง", 422);
  await markAdminNotificationsRead(session.id, selection.data);
  return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
});
