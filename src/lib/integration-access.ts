import { createHash, timingSafeEqual } from "node:crypto";
import { fail } from "@/lib/http";

export function integrationAccess(request: Request) {
  const key = process.env.PARKING_USER_API_KEY;
  if (!key || key.length < 32) return fail("User service integration is not configured", 503);
  const provided = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!provided || !timingSafeEqual(digest(key), digest(provided))) return fail("Unauthorized", 401);
  return null;
}
