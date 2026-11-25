import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { createClient } from "@libsql/client";
import { hashPassword, isAdminEmail, normalizeAdminEmail } from "../lib/auth/password.mjs";

const migrationsDir = new URL("../../drizzle/", import.meta.url);

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

  const args = process.argv.slice(2);
  const mode = args[0] ?? "migrate";
  if (args.length > 1 || !["migrate", "--bootstrap", "--recover"].includes(mode)) {
    throw new Error("Use db:setup:vercel with no arguments, --bootstrap, or --recover.");
  }

  const email = normalizeAdminEmail(process.env.PARKING_SUPER_ADMIN_EMAIL ?? "");
  const password = process.env.PARKING_SUPER_ADMIN_PASSWORD;
  const resetId = process.env.PARKING_SUPER_ADMIN_RESET_ID;
  if (mode === "--recover" && (!resetId || !/^[a-z0-9_-]{8,64}$/i.test(resetId))) {
    throw new Error("PARKING_SUPER_ADMIN_RESET_ID must contain 8–64 letters, digits, hyphens or underscores.");
  }
  const resetMarker = mode === "--recover" ? `admin-reset:${resetId}` : undefined;
  const client = createClient({ url, authToken });
  try {
    await client.execute("CREATE TABLE IF NOT EXISTS __migrations (id TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)");
    const transaction = await client.transaction("write");

    try {
      const files = (await readdir(migrationsDir)).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
      for (const file of files) {
        const migration = file.slice(0, -4);
        if (await alreadyApplied(transaction, migration)) continue;
        const schema = await readFile(new URL(file, migrationsDir), "utf8");
        await transaction.executeMultiple(schema.replace(/^\uFEFF/, ""));
        await markApplied(transaction, migration);
      }
      let message = "Turso migrations completed. Admin credentials were not changed.";
      if (mode === "--bootstrap") {
        const accounts = await transaction.execute("SELECT 1 FROM admin_accounts LIMIT 1");
        if (accounts.rows.length) {
          message = "Admin accounts already exist. Bootstrap left them unchanged.";
        } else {
          if (!isAdminEmail(email) || !validTemporaryPassword(password)) {
            throw new Error("Bootstrap requires PARKING_SUPER_ADMIN_EMAIL (@lamduan.mfu.ac.th) and PARKING_SUPER_ADMIN_PASSWORD (16–256 characters).");
          }
          await transaction.execute({
            sql: "INSERT INTO admin_accounts (id, email, password_hash, role, created_at) VALUES (?, ?, ?, 'super_admin', ?)",
            args: [randomUUID(), email, await hashPassword(password), Date.now()],
          });
          await audit(transaction, "account.bootstrap.super_admin", email, 201);
          message = "First Super Admin created.";
        }
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
