import type { Client } from "@libsql/client";

export function logAuthDatabase(client: Pick<Client, "transaction">, stage: string): Promise<void>;
