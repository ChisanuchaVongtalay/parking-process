import { z } from "zod";
import { db } from "@/db";
import { fail, ok } from "@/lib/http";
import { adminEndpoint } from "@/lib/auth/access";
import { recordAudit } from "@/lib/auth/session";

export const PATCH = adminEndpoint(async (session, request: Request) => {
  const input = z.object({ sessionMinutes: z.number().int().min(5).max(480) })
    .safeParse(await request.json().catch(() => null));
  if (!input.success) return fail("กำหนดเวลาได้ตั้งแต่ 5 ถึง 480 นาที", 422);
  const { sessionMinutes } = input.data;

  db.$client.transaction(() => {
    db.$client.prepare("UPDATE admin_settings SET session_minutes = ? WHERE id = 1").run(sessionMinutes);
    recordAudit(session.email, "settings.session_duration", String(sessionMinutes), 200);
  }).immediate();

  return ok({ sessionMinutes });
}, { superAdmin: true });
