import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type Client, type InValue, type Transaction } from "@libsql/client";

type Executor = Pick<Client | Transaction, "execute">;
let client: Client | undefined;

export function isAuthOnlyDeployment() {
  return process.env.VERCEL === "1" || Boolean(process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN);
}

function authClient() {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (isAuthOnlyDeployment()) {
    if (!url || !authToken) throw new Error("Turso auth storage is not configured");
    client = createClient({ url, authToken });
  } else {
    const file = path.resolve(process.env.DATA_DIR || "data", "sqlite", "parking.db");
    client = createClient({ url: pathToFileURL(file).href });
  }
  return client;
}

export function authQuery(sql: string, args: InValue[] = [], transaction?: Executor) {
  return (transaction ?? authClient()).execute({ sql, args });
}

export async function authRows<T>(sql: string, args: InValue[] = [], transaction?: Executor): Promise<T[]> {
  const { rows } = await authQuery(sql, args, transaction);
  return rows.map((row) => ({ ...row })) as T[];
}

export async function authRow<T>(sql: string, args: InValue[] = [], transaction?: Executor): Promise<T | undefined> {
  return (await authRows<T>(sql, args, transaction))[0];
}

export async function authWrite<T>(callback: (transaction: Transaction) => Promise<T>) {
  const transaction = await authClient().transaction("write");
  try {
    const result = await callback(transaction);
    await transaction.commit();
    return result;
  } finally {
    transaction.close();
  }
}
