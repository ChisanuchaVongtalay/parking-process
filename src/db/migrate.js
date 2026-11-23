import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

const dbPath = path.join(path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data")), "sqlite", "parking.db");
const migrationDir = path.join(process.cwd(), "drizzle");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS __migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`);

const migrationFiles = fs
  .readdirSync(migrationDir)
  .filter((name) => /^\d+_.*\.sql$/.test(name))
  .sort((a, b) => a.localeCompare(b));

for (const fileName of migrationFiles) {
  const migrationId = fileName.replace(/\.sql$/, "");
  const exists = sqlite
    .prepare("SELECT id FROM __migrations WHERE id = ?")
    .get(migrationId);

  if (exists) {
    console.log("Migration already applied:", migrationId);
    continue;
  }

  const migrationPath = path.join(migrationDir, fileName);
  const sql = fs.readFileSync(migrationPath, "utf8");
  sqlite.exec("BEGIN");
  try {
    sqlite.exec(sql);
    sqlite
      .prepare("INSERT INTO __migrations (id, applied_at) VALUES (?, ?)")
      .run(migrationId, new Date().toISOString());
    sqlite.exec("COMMIT");
    console.log("Migration applied:", migrationId);
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
}

sqlite.close();
