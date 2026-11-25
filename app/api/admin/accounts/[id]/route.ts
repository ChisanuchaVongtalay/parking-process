import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/db";
import { fail, ok } from "@/lib/http";
import { adminEndpoint } from "@/lib/auth/access";
import { hashPassword } from "@/lib/auth/password.mjs";
import { recordAudit } from "@/lib/auth/session";

const updateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), role: z.enum(["admin", "super_admin"]), active: z.boolean() }),
  z.object({ action: z.literal("reset") }),
]);

export const PATCH = adminEndpoint(async (session, request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  if (id === session.id) return fail("ใช้หน้าเปลี่ยนรหัสผ่านเพื่อจัดการบัญชีของคุณ", 409);
  const input = updateSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return fail("ข้อมูลบัญชีไม่ถูกต้อง", 422);
  const change = input.data;
  const temporaryPassword = change.action === "reset" ? randomBytes(24).toString("base64url") : undefined;
  const passwordHash = temporaryPassword ? await hashPassword(temporaryPassword) : undefined;

  const sql = db.$client;
  return sql.transaction(() => {
    const account = sql.prepare("SELECT email, role, active FROM admin_accounts WHERE id = ?").get(id) as
      { email: string; role: string; active: number } | undefined;
    if (!account) return fail("ไม่พบบัญชี", 404);

    if (change.action === "update") {
      const active = Number(change.active);
      if (account.role === change.role && account.active === active) return ok({ email: account.email });
      if (account.active && account.role === "super_admin" && (!active || change.role !== "super_admin")) {
        const other = sql.prepare("SELECT 1 FROM admin_accounts WHERE role = 'super_admin' AND active = 1 AND id <> ?").get(id);
        if (!other) return fail("ระบบต้องมี Super Admin ที่เปิดใช้งานอย่างน้อยหนึ่งบัญชี", 409);
      }
      sql.prepare("UPDATE admin_accounts SET role = ?, active = ? WHERE id = ?").run(change.role, active, id);
      recordAudit(session.email, `account.update.${change.role}.${active ? "active" : "disabled"}`, account.email, 200);
    } else {
      sql.prepare("UPDATE admin_accounts SET password_hash = ?, must_change_password = 1 WHERE id = ?").run(passwordHash, id);
      recordAudit(session.email, "account.password_reset", account.email, 200);
    }
    sql.prepare("DELETE FROM admin_sessions WHERE account_id = ?").run(id);
    const response = ok({ email: account.email, temporaryPassword });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }).immediate();
}, { superAdmin: true });
