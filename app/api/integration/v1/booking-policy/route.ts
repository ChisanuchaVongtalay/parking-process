import { ok } from "@/lib/http";
import { integrationAccess } from "@/lib/integration-access";
import { getEffectivePolicy } from "@/services/booking-policies";

export async function GET(request: Request) {
  const denied = integrationAccess(request);
  if (denied) return denied;
  const entry = await getEffectivePolicy();
  const response = ok(entry ? { version: entry.version, effectiveAt: entry.effectiveAt, ...entry.policy } : null);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
