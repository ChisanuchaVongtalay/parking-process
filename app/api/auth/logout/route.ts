import { NextResponse } from "next/server";
import { fail } from "@/lib/http";
import { hasSameOrigin } from "@/lib/auth/access";
import { clearSessionCookie, getAdminSession, recordAudit, revokeCurrentSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return fail("Origin not allowed", 403);
  const session = await getAdminSession();
  await revokeCurrentSession();
  if (session) recordAudit(session.email, "session.logout", "Admin Console", 200);
  const response = new NextResponse(null, { status: 303, headers: { Location: "/login" } });
  clearSessionCookie(response);
  return response;
}
