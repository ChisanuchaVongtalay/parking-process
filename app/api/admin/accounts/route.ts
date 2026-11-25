import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { authQuery, authWrite } from "@/lib/auth/database";
import { fail, ok } from "@/lib/http";
import { adminEndpoint } from "@/lib/auth/access";
import { hashPassword, isAdminEmail, normalizeAdminEmail } from "@/lib/auth/password.mjs";
import { recordAudit } from "@/lib/auth/session";

export const POST = adminEndpoint(async (session, request: Request) => {
  const input = z.object({ email: z.string().max(254), role: z.enum(["admin", "super_admin"]) })
    .safeParse(await request.json().catch(() => null));
  if (!input.success) return fail("ข้อมูลบัญชีไม่ถูกต้อง", 422);
  const email = normalizeAdminEmail(input.data.email);
  if (!isAdminEmail(email)) return fail("กรุณาใช้อีเมล @lamduan.mfu.ac.th", 422);

  const password = randomBytes(24).toString("base64url");
  const passwordHash = await hashPassword(password);
  const created = await authWrite(async (transaction) => {
    const result = await authQuery(`
      INSERT INTO admin_accounts (id, email, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT (email) DO NOTHING
    `, [randomUUID(), email, passwordHash, input.data.role, Date.now()], transaction);
    if (result.rowsAffected) await recordAudit(session.email, `account.create.${input.data.role}`, email, 201, transaction);
    return result.rowsAffected;
  });
  if (!created) return fail("อีเมลนี้มีบัญชีอยู่แล้ว", 409);
  const response = ok({ email, temporaryPassword: password }, 201);
  response.headers.set("Cache-Control", "no-store");
  return response;
}, { superAdmin: true });
