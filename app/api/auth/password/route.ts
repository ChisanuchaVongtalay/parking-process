import { NextResponse } from "next/server";
import { z } from "zod";
import { authQuery, authRow, authWrite } from "@/lib/auth/database";
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
  if (!(await allowLoginAttempt(session.email))) return fail("ลองหลายครั้งเกินไป กรุณารอ 15 นาที", 429);

  const row = await authRow<{ passwordHash: string }>(
    "SELECT password_hash AS passwordHash FROM admin_accounts WHERE id = ? AND active = 1", [session.id],
  );
  if (!(await verifyPassword(currentPassword, row?.passwordHash)) || !row) return fail("รหัสผ่านปัจจุบันไม่ถูกต้อง", 403);
  const passwordHash = await hashPassword(password);
  const updated = await authWrite(async (transaction) => {
    const result = await authQuery(
      "UPDATE admin_accounts SET password_hash = ?, must_change_password = 0 WHERE id = ? AND active = 1 AND password_hash = ?",
      [passwordHash, session.id, row.passwordHash], transaction,
    );
    if (!result.rowsAffected) return false;
    await authQuery("DELETE FROM admin_sessions WHERE account_id = ?", [session.id], transaction);
    await clearLoginLimit(session.email, transaction);
    await recordAudit(session.email, "account.password_changed", session.email, 200, transaction);
    return true;
  });

  if (!updated) return fail("ข้อมูลบัญชีเปลี่ยนแปลง กรุณาเข้าสู่ระบบใหม่", 409);
  const persisted = await authWrite((transaction) => authRow<{ confirmed: number }>(
    "SELECT 1 AS confirmed FROM admin_accounts WHERE id = ? AND active = 1 AND password_hash = ? AND must_change_password = 0",
    [session.id, passwordHash], transaction,
  ));
  if (!persisted?.confirmed) {
    return fail("ยืนยันรหัสผ่านใหม่ไม่ได้ กรุณาเข้าสู่ระบบใหม่หรือติดต่อผู้ดูแล", 503);
  }

  const response = NextResponse.json({ data: { next: "/login?changed=1" } });
  clearSessionCookie(response);
  return response;
}
