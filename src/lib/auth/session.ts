import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";

import { db } from "@/db";
import type { AdminRole } from "./roles";

const sql = db.$client;
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
  return sql.prepare(`
    SELECT a.id, a.email, a.role, a.must_change_password AS mustChangePassword, s.expires_at AS expiresAt
    FROM admin_sessions s JOIN admin_accounts a ON a.id = s.account_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND a.active = 1
  `).get(hash(token), Date.now()) as AdminSession | undefined ?? null;
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

export function readSessionMinutes() {
  return (sql.prepare("SELECT session_minutes AS minutes FROM admin_settings WHERE id = 1").get() as { minutes: number }).minutes;
}

export function createAdminSession(accountId: string) {
  const now = Date.now();
  const token = randomBytes(32).toString("hex");
  sql.prepare("DELETE FROM admin_sessions WHERE expires_at <= ?").run(now);
  sql.prepare("INSERT INTO admin_sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)")
    .run(hash(token), accountId, now + readSessionMinutes() * 60_000);
  return token;
}

export async function revokeCurrentSession() {
  const token = await readSessionToken();
  if (token) sql.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(hash(token));
}

export function recordAudit(actor: string, action: string, target: string, status: number) {
  sql.prepare("INSERT INTO admin_audit_events (actor, action, target, status, recorded_at) VALUES (?, ?, ?, ?, ?)")
    .run(actor, action, target, status, Date.now());
}

const reserveLoginAttempt = sql.transaction((email: string) => {
  const now = Date.now();
  const expiresAt = now + 15 * 60_000;
  sql.prepare("DELETE FROM admin_login_limits WHERE expires_at <= ?").run(now);
  const bucket = hash(email);
  const read = sql.prepare("SELECT attempts FROM admin_login_limits WHERE bucket = ?");
  const attempts = (key: string) => (read.get(key) as { attempts: number } | undefined)?.attempts ?? 0;
  if (attempts(bucket) >= 8 || attempts("*") >= 400) return false;

  const increment = sql.prepare(`
    INSERT INTO admin_login_limits (bucket, attempts, expires_at) VALUES (?, 1, ?)
    ON CONFLICT (bucket) DO UPDATE SET attempts = attempts + 1
  `);
  increment.run(bucket, expiresAt);
  increment.run("*", expiresAt);
  return true;
});

export function allowLoginAttempt(email: string) {
  return reserveLoginAttempt.immediate(email);
}

export function clearLoginLimit(email: string) {
  sql.prepare("DELETE FROM admin_login_limits WHERE bucket = ?").run(hash(email));
}
