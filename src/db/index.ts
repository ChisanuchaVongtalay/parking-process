import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

function openDb() {
  const dbPath = path.join(path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data")), "sqlite", "parking.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  return drizzle(sqlite, { schema });
}

let connection: ReturnType<typeof openDb> | undefined;

export const db = new Proxy({} as ReturnType<typeof openDb>, {
  get(_target, property) {
    const current = connection ??= openDb();
    const value = Reflect.get(current, property);
    return typeof value === "function" ? value.bind(current) : value;
  },
});
