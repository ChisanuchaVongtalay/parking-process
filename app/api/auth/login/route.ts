import { NextResponse } from "next/server";
import { z } from "zod";
import { databaseClient } from "@/db/client";
import { logAuthDatabase } from "@/db/auth-diagnostics.mjs";
import { authRow, authWrite } from "@/lib/auth/database";
import { fail } from "@/lib/http";
import { hasSameOrigin } from "@/lib/auth/access";
import { isAdminEmail, normalizeAdminEmail, verifyPassword } from "@/lib/auth/password.mjs";
import { allowLoginAttempt, clearLoginLimit, createAdminSession, recordAudit, revokeCurrentSession, setSessionCookie } from "@/lib/auth/session";

const loginSchema = z.object({ email: z.string().max(254), password: z.string().min(1).max(256) });

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return fail("Origin not allowed", 403);
  const input = loginSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return fail("กรุณากรอกอีเมลและรหัสผ่าน", 422);
  const email = normalizeAdminEmail(input.data.email);
  if (!isAdminEmail(email)) return fail("กรุณาใช้อีเมล @lamduan.mfu.ac.th", 422);
  if (!(await allowLoginAttempt(email))) return fail("ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 15 นาที", 429);

  // Read credentials from the writer, including immediately after a password change.
  const account = await authWrite((transaction) => authRow<{ id: string; passwordHash: string }>(
    "SELECT id, password_hash AS passwordHash FROM admin_accounts WHERE email = ? AND active = 1", [email], transaction,
  ));
  const valid = await verifyPassword(input.data.password, account?.passwordHash);
  if (!valid || !account) {
    await logAuthDatabase(databaseClient(), "login-rejected");
    return fail("อีเมลหรือรหัสผ่านไม่ถูกต้อง", 401);
  }

  const signIn = await authWrite(async (transaction) => {
    const current = await authRow<{ mustChange: number }>(
      "SELECT must_change_password AS mustChange FROM admin_accounts WHERE id = ? AND active = 1 AND password_hash = ?",
      [account.id, account.passwordHash], transaction,
    );
    if (!current) return null;
    const token = await createAdminSession(account.id, transaction);
    await clearLoginLimit(email, transaction);
    await recordAudit(email, "session.login", "Admin Console", 200, transaction);
    return { token, mustChange: current.mustChange };
  });

  if (!signIn) return fail("อีเมลหรือรหัสผ่านไม่ถูกต้อง", 401);
  await logAuthDatabase(databaseClient(), "login-accepted");
  await revokeCurrentSession();
  const response = NextResponse.json({ data: { next: signIn.mustChange ? "/change-password" : "/admin" } });
  setSessionCookie(response, signIn.token);
  return response;
}
