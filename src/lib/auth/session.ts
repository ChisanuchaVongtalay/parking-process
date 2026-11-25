import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import type { Transaction } from "@libsql/client";

import { authQuery, authRow, authWrite } from "./database";
import type { AdminRole } from "./roles";

const cookieName = "mfu_admin_session";
const tokenPattern = /^[0-9a-f]{64}$/;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export type AdminSession = {
  id: string;
  email: string;
  role: AdminRole;
  mustChangePassword: number;
  expiresAt: number;
};

async function readSessionToken() {
  const value = (await cookies()).get(cookieName)?.value;
  return value && tokenPattern.test(value) ? value : null;
}

export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  return await authRow<AdminSession>(`
    SELECT a.id, a.email, a.role, a.must_change_password AS mustChangePassword, s.expires_at AS expiresAt
    FROM admin_sessions s JOIN admin_accounts a ON a.id = s.account_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND a.active = 1
  `, [hash(token), Date.now()]) ?? null;
});

export async function requireAdminPage(role?: AdminRole) {
  const session = await getAdminSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/change-password");
  if (role === "super_admin" && session.role !== role) redirect("/admin");
  return session;
}

function cookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(cookieName, token, cookieOptions());
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(cookieName, "", { ...cookieOptions(), maxAge: 0 });
}

export async function readSessionMinutes(transaction?: Transaction) {
  const settings = await authRow<{ minutes: number }>(
    "SELECT session_minutes AS minutes FROM admin_settings WHERE id = 1", [], transaction,
  );
  if (!settings) throw new Error("Admin session settings are not initialized");
  return settings.minutes;
}

export async function createAdminSession(accountId: string, transaction: Transaction) {
  const now = Date.now();
  const token = randomBytes(32).toString("hex");
  const minutes = await readSessionMinutes(transaction);
  await authQuery("DELETE FROM admin_sessions WHERE expires_at <= ?", [now], transaction);
  await authQuery("INSERT INTO admin_sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)",
    [hash(token), accountId, now + minutes * 60_000], transaction);
  return token;
}

export async function revokeCurrentSession() {
  const token = await readSessionToken();
  if (token) await authQuery("DELETE FROM admin_sessions WHERE token_hash = ?", [hash(token)]);
}

export async function recordAudit(actor: string, action: string, target: string, status: number, transaction?: Transaction) {
  await authQuery("INSERT INTO admin_audit_events (actor, action, target, status, recorded_at) VALUES (?, ?, ?, ?, ?)",
    [actor, action, target, status, Date.now()], transaction);
}

export function allowLoginAttempt(email: string) {
  return authWrite(async (transaction) => {
    const now = Date.now();
    const expiresAt = now + 15 * 60_000;
    const bucket = hash(email);
    await authQuery("DELETE FROM admin_login_limits WHERE expires_at <= ?", [now], transaction);
    const limits = await authRow<{ perEmail: number; total: number }>(`
      SELECT COALESCE(MAX(CASE WHEN bucket = ? THEN attempts END), 0) AS perEmail,
             COALESCE(MAX(CASE WHEN bucket = '*' THEN attempts END), 0) AS total
      FROM admin_login_limits WHERE bucket IN (?, '*')
    `, [bucket, bucket], transaction);
    if (limits && (limits.perEmail >= 8 || limits.total >= 400)) return false;

    await authQuery(`
      INSERT INTO admin_login_limits (bucket, attempts, expires_at) VALUES (?, 1, ?), ('*', 1, ?)
      ON CONFLICT (bucket) DO UPDATE SET attempts = attempts + 1
    `, [bucket, expiresAt, expiresAt], transaction);
    return true;
  });
}

export async function clearLoginLimit(email: string, transaction: Transaction) {
  await authQuery("DELETE FROM admin_login_limits WHERE bucket = ?", [hash(email)], transaction);
}
