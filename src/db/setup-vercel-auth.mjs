import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@libsql/client";
import { hashPassword, isAdminEmail, normalizeAdminEmail } from "../lib/auth/password.mjs";

async function setup() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN for this deployment.");

  const email = normalizeAdminEmail(process.env.PARKING_SUPER_ADMIN_EMAIL ?? "");
  const password = process.env.PARKING_SUPER_ADMIN_PASSWORD;
  const client = createClient({ url, authToken });
  try {
    await client.execute("CREATE TABLE IF NOT EXISTS __migrations (id TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)");
    const migration = "0004_admin_auth";
    const schema = await readFile(new URL(`../../drizzle/${migration}.sql`, import.meta.url), "utf8");
    const transaction = await client.transaction("write");

    try {
      const applied = await transaction.execute({ sql: "SELECT id FROM __migrations WHERE id = ?", args: [migration] });
      if (!applied.rows.length) {
        await transaction.executeMultiple(schema.replace(/^\uFEFF/, ""));
        await transaction.execute({
          sql: "INSERT INTO __migrations (id, applied_at) VALUES (?, ?)",
          args: [migration, new Date().toISOString()],
        });
      }
      const existing = await transaction.execute("SELECT 1 FROM admin_accounts WHERE role = 'super_admin' LIMIT 1");
      if (!existing.rows.length) {
        if (!isAdminEmail(email) || !password || password.length < 16 || password.length > 256) {
          throw new Error("First deploy: set PARKING_SUPER_ADMIN_EMAIL (@landuan.mfu.ac.th) and PARKING_SUPER_ADMIN_PASSWORD (16–256 characters).");
        }
        await transaction.execute({
          sql: "INSERT INTO admin_accounts (id, email, password_hash, role, created_at) VALUES (?, ?, ?, 'super_admin', ?)",
          args: [randomUUID(), email, await hashPassword(password), Date.now()],
        });
        await transaction.execute({
          sql: "INSERT INTO admin_audit_events (actor, action, target, status, recorded_at) VALUES ('system', 'account.bootstrap.super_admin', ?, 201, ?)",
          args: [email, Date.now()],
        });
      }
      await transaction.commit();
      console.log("Turso authentication schema and Super Admin are ready.");
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
