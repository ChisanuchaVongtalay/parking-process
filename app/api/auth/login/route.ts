import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
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
  if (!isAdminEmail(email)) return fail("กรุณาใช้อีเมล @landuan.mfu.ac.th", 422);
  if (!allowLoginAttempt(email)) return fail("ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 15 นาที", 429);

  const sql = db.$client;
  const account = sql.prepare("SELECT id, password_hash AS passwordHash FROM admin_accounts WHERE email = ? AND active = 1")
    .get(email) as { id: string; passwordHash: string } | undefined;
  const valid = await verifyPassword(input.data.password, account?.passwordHash);
  if (!valid || !account) return fail("อีเมลหรือรหัสผ่านไม่ถูกต้อง", 401);

  const signIn = sql.transaction(() => {
    const current = sql.prepare("SELECT must_change_password AS mustChange FROM admin_accounts WHERE id = ? AND active = 1 AND password_hash = ?")
      .get(account.id, account.passwordHash) as { mustChange: number } | undefined;
    if (!current) return null;
    const token = createAdminSession(account.id);
    clearLoginLimit(email);
    recordAudit(email, "session.login", "Admin Console", 200);
    return { token, mustChange: current.mustChange };
  }).immediate();

  if (!signIn) return fail("อีเมลหรือรหัสผ่านไม่ถูกต้อง", 401);
  await revokeCurrentSession();
  const response = NextResponse.json({ data: { next: signIn.mustChange ? "/change-password" : "/admin" } });
  setSessionCookie(response, signIn.token);
  return response;
}
