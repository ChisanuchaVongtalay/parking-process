import { desc } from "drizzle-orm";

import { db } from "@/db";
import { zones } from "@/db/schema";
import { fail, ok, parseJsonError } from "@/lib/http";
import { createId } from "@/lib/id";
import { zoneCreateSchema } from "@/lib/validation";

export async function GET() {
  const data = await db.query.zones.findMany({
    orderBy: [desc(zones.createdAt)],
  });
  return ok(data);
}

export async function POST(request: Request) {
  try {
    const payload = zoneCreateSchema.parse(await request.json());

    const item = {
      id: createId("zone"),
      code: payload.code,
      name: payload.name,
      description: payload.description ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(zones).values(item);

    return ok(item, 201);
  } catch (error) {
    if (error instanceof Error && /UNIQUE/.test(error.message)) {
      return fail("Zone code already exists", 409);
    }
    return parseJsonError(error);
  }
}
