import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/db";
import { fail, ok } from "@/lib/http";
import { adminEndpoint } from "@/lib/auth/access";
import { hashPassword, isAdminEmail, normalizeAdminEmail } from "@/lib/auth/password.mjs";
import { recordAudit } from "@/lib/auth/session";

export const POST = adminEndpoint(async (session, request: Request) => {
  const input = z.object({ email: z.string().max(254), role: z.enum(["admin", "super_admin"]) })
    .safeParse(await request.json().catch(() => null));
  if (!input.success) return fail("ข้อมูลบัญชีไม่ถูกต้อง", 422);
  const email = normalizeAdminEmail(input.data.email);
  if (!isAdminEmail(email)) return fail("กรุณาใช้อีเมล @landuan.mfu.ac.th", 422);

  const password = randomBytes(24).toString("base64url");
  const passwordHash = await hashPassword(password);
  const sql = db.$client;
  const created = sql.transaction(() => {
    const result = sql.prepare(`
      INSERT INTO admin_accounts (id, email, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT (email) DO NOTHING
    `).run(randomUUID(), email, passwordHash, input.data.role, Date.now());
    if (result.changes) recordAudit(session.email, `account.create.${input.data.role}`, email, 201);
    return result.changes;
  }).immediate();
  if (!created) return fail("อีเมลนี้มีบัญชีอยู่แล้ว", 409);
  const response = ok({ email, temporaryPassword: password }, 201);
  response.headers.set("Cache-Control", "no-store");
  return response;
}, { superAdmin: true });
