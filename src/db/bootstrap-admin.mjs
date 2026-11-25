import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { hashPassword, isAdminEmail, normalizeAdminEmail } from "../lib/auth/password.mjs";

async function bootstrap() {
  const [emailArg, passwordFile, ...extra] = process.argv.slice(2);
  const configuredEmail = process.env.PARKING_SUPER_ADMIN_EMAIL;
  const configuredPassword = process.env.PARKING_SUPER_ADMIN_PASSWORD;
  if (!emailArg && !configuredEmail && !configuredPassword) {
    if (process.env.NODE_ENV !== "production") {
      console.log("Usage: npm run admin:bootstrap -- <email> <new-password-file>");
    }
    return;
  }
  if (extra.length || (emailArg && !passwordFile) || (!emailArg && (!configuredEmail || !configuredPassword))) {
    throw new Error("Provide a login email and password file, or set both bootstrap environment variables.");
  }

  const email = normalizeAdminEmail(emailArg ?? configuredEmail);
  if (!isAdminEmail(email)) throw new Error("Use an @landuan.mfu.ac.th email.");
  if (!emailArg && (configuredPassword.length < 16 || configuredPassword.length > 256)) {
    throw new Error("The bootstrap password must be 16–256 characters.");
  }
  const password = emailArg ? randomBytes(24).toString("base64url") : configuredPassword;
  const dbPath = path.join(path.resolve(process.env.DATA_DIR || "data"), "sqlite", "parking.db");
  const sql = new Database(dbPath, { fileMustExist: true });
  try {
    const hasSuperAdmin = sql.prepare("SELECT 1 FROM admin_accounts WHERE role = 'super_admin' LIMIT 1");
    if (hasSuperAdmin.get()) {
      console.log("A Super Admin account already exists.");
      return;
    }
    const passwordHash = await hashPassword(password);

    const create = sql.transaction(() => {
      if (hasSuperAdmin.get()) return false;
      sql.prepare("INSERT INTO admin_accounts (id, email, password_hash, role, created_at) VALUES (?, ?, ?, 'super_admin', ?)")
        .run(randomUUID(), email, passwordHash, Date.now());
      sql.prepare("INSERT INTO admin_audit_events (actor, action, target, status, recorded_at) VALUES (?, ?, ?, 201, ?)")
        .run("system", "account.bootstrap.super_admin", email, Date.now());
      if (passwordFile) writeFileSync(passwordFile, password + "\n", { mode: 0o600, flag: "wx" });
      return true;
    });
    console.log(create.immediate() ? `Created initial Super Admin: ${email}` : "A Super Admin account already exists.");
  } finally {
    sql.close();
  }
}

bootstrap().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
