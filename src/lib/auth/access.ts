import { fail } from "@/lib/http";
import { getAdminSession, recordAudit, type AdminSession } from "./session";

export function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const expected = process.env.PARKING_ADMIN_ORIGIN;
    return expected
      ? new URL(origin).origin === new URL(expected).origin
      : new URL(origin).host === (request.headers.get("host") ?? new URL(request.url).host);
  } catch {
    return false;
  }
}

type EndpointArgs = [request: Request, context?: never] | [request: Request, context: { params: Promise<Record<string, string | string[]>> }];

export function adminEndpoint<Args extends EndpointArgs>(
  handler: (session: AdminSession, ...args: Args) => Response | Promise<Response>,
  options: { superAdmin?: boolean; audit?: string } = {},
) {
  return async (...args: Args) => {
    const [request] = args;
    const session = await getAdminSession();
    if (!session) return fail("กรุณาเข้าสู่ระบบใหม่", 401);
    if (session.mustChangePassword) return fail("กรุณาเปลี่ยนรหัสผ่านชั่วคราว", 403);
    if (options.superAdmin && session.role !== "super_admin") return fail("ต้องใช้สิทธิ์ Super Admin", 403);
    if (request.method !== "GET" && !hasSameOrigin(request)) return fail("Origin not allowed", 403);
    const response = await handler(session, ...args);
    if (options.audit) recordAudit(session.email, options.audit, new URL(request.url).pathname, response.status);
    return response;
  };
}
