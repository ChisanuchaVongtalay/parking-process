import { drizzle } from "drizzle-orm/libsql";
import { databaseClient } from "./client";
import * as schema from "./schema";

function connect() {
  return drizzle(databaseClient(), { schema });
}

let connection: ReturnType<typeof connect> | undefined;

export const db = new Proxy({} as ReturnType<typeof connect>, {
  get(_target, property) {
    const current = connection ??= connect();
    const value = Reflect.get(current, property);
    return typeof value === "function" ? value.bind(current) : value;
  },
});
