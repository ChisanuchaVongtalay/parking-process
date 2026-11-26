import { createHash } from "node:crypto";
import { tursoConfiguration } from "./turso-config.mjs";

export async function logAuthDatabase(client, stage) {
  if (process.env.VERCEL !== "1") return;
  try {
    const hostname = new URL(tursoConfiguration().url).hostname;
    const transaction = await client.transaction("write");
    let state;
    try {
      ({ rows: [state] } = await transaction.execute(`
        SELECT (SELECT applied_at FROM __migrations WHERE id = '0004_admin_auth') AS authMigration,
               (SELECT COUNT(*) FROM admin_accounts WHERE active = 1 AND role = 'super_admin') AS activeSuperAdmins,
               (SELECT COUNT(*) FROM admin_accounts WHERE active = 1 AND role = 'super_admin' AND must_change_password = 1) AS temporarySuperAdmins,
               (SELECT MAX(recorded_at) FROM admin_audit_events WHERE action = 'account.password_changed') AS lastPasswordChange,
               (SELECT MAX(recorded_at) FROM admin_audit_events WHERE action = 'session.login') AS lastLogin
      `));
      await transaction.rollback();
    } finally {
      transaction.close();
    }
    console.info("[admin-auth-db]", JSON.stringify({
      stage,
      deployment: process.env.VERCEL_DEPLOYMENT_ID,
      region: process.env.VERCEL_REGION,
      endpoint: createHash("sha256").update(hostname).digest("hex").slice(0, 16),
      state,
    }));
  } catch {
    console.warn("[admin-auth-db]", JSON.stringify({ stage, diagnostic: "unavailable" }));
  }
}
