import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@libsql/client";
import { hashPassword, isAdminEmail, normalizeAdminEmail } from "../lib/auth/password.mjs";

const authMigrations = ["0004_admin_auth", "0005_admin_email_domain"];

function validTemporaryPassword(password) {
  return typeof password === "string" && password.length >= 16 && password.length <= 256;
}

async function markApplied(transaction, id) {
  await transaction.execute({
    sql: "INSERT INTO __migrations (id, applied_at) VALUES (?, ?)",
    args: [id, new Date().toISOString()],
  });
}

async function alreadyApplied(transaction, id) {
  const result = await transaction.execute({ sql: "SELECT 1 FROM __migrations WHERE id = ?", args: [id] });
  return result.rows.length > 0;
}

async function audit(transaction, action, email, status) {
  await transaction.execute({
    sql: "INSERT INTO admin_audit_events (actor, action, target, status, recorded_at) VALUES ('system', ?, ?, ?, ?)",
    args: [action, email, status, Date.now()],
  });
}

async function resetSuperAdmin(transaction, marker, email, password) {
  if (await alreadyApplied(transaction, marker)) return false;
  if (!isAdminEmail(email) || !validTemporaryPassword(password)) {
    throw new Error("Password recovery requires the existing @lamduan.mfu.ac.th Super Admin email and a temporary password of 16–256 characters.");
  }

  const result = await transaction.execute({
    sql: "UPDATE admin_accounts SET password_hash = ?, must_change_password = 1 WHERE email = ? AND role = 'super_admin' AND active = 1 RETURNING id",
    args: [await hashPassword(password), email],
  });
  const account = result.rows[0];
  if (!account) throw new Error("Password recovery could not find the specified active Super Admin on this Turso database.");

  await transaction.execute({ sql: "DELETE FROM admin_sessions WHERE account_id = ?", args: [account.id] });
  const bucket = createHash("sha256").update(email).digest("hex");
  await transaction.execute({ sql: "DELETE FROM admin_login_limits WHERE bucket = ?", args: [bucket] });
  await audit(transaction, "account.password_recovery", email, 200);
  await markApplied(transaction, marker);
  return true;
}

async function setup() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN for this deployment.");

  const email = normalizeAdminEmail(process.env.PARKING_SUPER_ADMIN_EMAIL ?? "");
  const password = process.env.PARKING_SUPER_ADMIN_PASSWORD;
  const resetId = process.env.VERCEL_ENV === "production" ? process.env.PARKING_SUPER_ADMIN_RESET_ID : undefined;
  if (resetId && !/^[a-z0-9_-]{8,64}$/i.test(resetId)) {
    throw new Error("PARKING_SUPER_ADMIN_RESET_ID must contain 8–64 letters, digits, hyphens or underscores.");
  }
  const resetMarker = resetId ? `admin-reset:${resetId}` : undefined;
  const client = createClient({ url, authToken });
  try {
    await client.execute("CREATE TABLE IF NOT EXISTS __migrations (id TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)");
    const transaction = await client.transaction("write");

    try {
      for (const migration of authMigrations) {
        if (await alreadyApplied(transaction, migration)) continue;
        const schema = await readFile(new URL(`../../drizzle/${migration}.sql`, import.meta.url), "utf8");
        await transaction.executeMultiple(schema.replace(/^\uFEFF/, ""));
        await markApplied(transaction, migration);
      }
      const existing = await transaction.execute("SELECT 1 FROM admin_accounts WHERE role = 'super_admin' LIMIT 1");
      const hasSuperAdmin = existing.rows.length > 0;
      let message = "Turso authentication schema and Super Admin are ready.";
      if (!hasSuperAdmin) {
        if (resetMarker && await alreadyApplied(transaction, resetMarker)) {
          throw new Error("This password recovery ID has already been used. Use a new recovery ID to initialize an account.");
        }
        if (!isAdminEmail(email) || !validTemporaryPassword(password)) {
          throw new Error("First deploy: set PARKING_SUPER_ADMIN_EMAIL (@lamduan.mfu.ac.th) and PARKING_SUPER_ADMIN_PASSWORD (16–256 characters).");
        }
        await transaction.execute({
          sql: "INSERT INTO admin_accounts (id, email, password_hash, role, created_at) VALUES (?, ?, ?, 'super_admin', ?)",
          args: [randomUUID(), email, await hashPassword(password), Date.now()],
        });
        await audit(transaction, "account.bootstrap.super_admin", email, 201);
        if (resetMarker) await markApplied(transaction, resetMarker);
        message = "Turso authentication schema initialized and first Super Admin created.";
      } else if (resetMarker && await resetSuperAdmin(transaction, resetMarker, email, password)) {
        message = "Super Admin temporary password reset successfully.";
      }
      await transaction.commit();
      console.log(message);
    } finally {
      transaction.close();
    }
  } finally {
    client.close();
  }
}

setup().catch((error) => {
  console.error("Turso setup failed:", error.name === "LibsqlError" ? error.code : error.message);
  process.exitCode = 1;
});
