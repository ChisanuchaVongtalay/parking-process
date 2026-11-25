import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { fail } from "@/lib/http";
import { hasSameOrigin } from "@/lib/auth/access";
import { hashPassword, verifyPassword } from "@/lib/auth/password.mjs";
import { allowLoginAttempt, clearLoginLimit, clearSessionCookie, getAdminSession, recordAudit } from "@/lib/auth/session";

const passwordChange = z.object({
  currentPassword: z.string().min(1).max(256),
  password: z.string().min(12).max(256),
});

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return fail("Origin not allowed", 403);
  const session = await getAdminSession();
  if (!session) return fail("กรุณาเข้าสู่ระบบใหม่", 401);
  const input = passwordChange.safeParse(await request.json().catch(() => null));
  if (!input.success) return fail("รหัสผ่านใหม่ต้องมีอย่างน้อย 12 ตัวอักษร", 422);
  const { currentPassword, password } = input.data;
  if (currentPassword === password) return fail("กรุณาใช้รหัสผ่านที่ต่างจากเดิม", 422);
  if (!allowLoginAttempt(session.email)) return fail("ลองหลายครั้งเกินไป กรุณารอ 15 นาที", 429);

  const sql = db.$client;
  const row = sql.prepare("SELECT password_hash AS passwordHash FROM admin_accounts WHERE id = ? AND active = 1")
    .get(session.id) as { passwordHash: string } | undefined;
  if (!(await verifyPassword(currentPassword, row?.passwordHash)) || !row) return fail("รหัสผ่านปัจจุบันไม่ถูกต้อง", 403);
  const passwordHash = await hashPassword(password);
  const updated = sql.transaction(() => {
    const result = sql.prepare("UPDATE admin_accounts SET password_hash = ?, must_change_password = 0 WHERE id = ? AND active = 1 AND password_hash = ?")
      .run(passwordHash, session.id, row.passwordHash);
    if (!result.changes) return false;
    sql.prepare("DELETE FROM admin_sessions WHERE account_id = ?").run(session.id);
    clearLoginLimit(session.email);
    recordAudit(session.email, "account.password_changed", session.email, 200);
    return true;
  }).immediate();

  if (!updated) return fail("ข้อมูลบัญชีเปลี่ยนแปลง กรุณาเข้าสู่ระบบใหม่", 409);
  const response = NextResponse.json({ data: { next: "/login?changed=1" } });
  clearSessionCookie(response);
  return response;
}
