import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type Client, type InValue, type Transaction } from "@libsql/client";

type Executor = Pick<Client | Transaction, "execute">;
let client: Client | undefined;

export function usesRemoteDatabase() {
  return process.env.VERCEL === "1" || Boolean(process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN);
}

export function databaseClient() {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (usesRemoteDatabase()) {
    if (!url || !authToken) throw new Error("Turso database is not configured");
    client = createClient({ url, authToken });
  } else {
    const file = path.resolve(process.env.DATA_DIR || "data", "sqlite", "parking.db");
    mkdirSync(path.dirname(file), { recursive: true });
    client = createClient({ url: pathToFileURL(file).href });
  }
  return client;
}

export function query(sql: string, args: InValue[] = [], transaction?: Executor) {
  return (transaction ?? databaseClient()).execute({ sql, args });
}

export async function queryRows<T>(sql: string, args: InValue[] = [], transaction?: Executor): Promise<T[]> {
  const { rows } = await query(sql, args, transaction);
  return rows.map((row) => ({ ...row })) as T[];
}

export async function queryRow<T>(sql: string, args: InValue[] = [], transaction?: Executor): Promise<T | undefined> {
  return (await queryRows<T>(sql, args, transaction))[0];
}

export async function writeTransaction<T>(callback: (transaction: Transaction) => Promise<T>) {
  const transaction = await databaseClient().transaction("write");
  try {
    const result = await callback(transaction);
    await transaction.commit();
    return result;
  } finally {
    transaction.close();
  }
}
