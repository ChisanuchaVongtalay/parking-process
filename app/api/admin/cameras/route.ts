import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { calibrationProfiles, cameras } from "@/db/schema";
import { fail, ok, parseJsonError } from "@/lib/http";
import { createId } from "@/lib/id";
import { cameraCreateSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const zoneId = searchParams.get("zoneId");

  const where = zoneId ? eq(cameras.zoneId, zoneId) : undefined;
  const data = await db.query.cameras.findMany({
    where,
    orderBy: [desc(cameras.createdAt)],
  });

  return ok(data);
}

export async function POST(request: Request) {
  try {
    const payload = cameraCreateSchema.parse(await request.json());
    const now = new Date();

    const item = {
      id: createId("cam"),
      zoneId: payload.zoneId,
      code: payload.code,
      name: payload.name,
      streamUrl: payload.streamUrl ?? null,
      backgroundImagePath: null,
      latestSnapshotPath: null,
      isPrimary: payload.isPrimary,
      isActive: payload.isActive,
      createdAt: now,
      updatedAt: now,
    };

    db.transaction((tx) => {
      tx.insert(cameras).values(item).run();
      tx.insert(calibrationProfiles).values({
        id: createId("cal"),
        cameraId: item.id,
        pixelThreshold: 15,
        occupancyThreshold: 8,
        grayscale: true,
        blurRadius: 1,
        normalize: true,
        downscale: 1000,
        lightingCompensation: 700,
        edgeWeight: 1500,
        createdAt: now,
        updatedAt: now,
      }).run();
    });

    return ok(item, 201);
  } catch (error) {
    if (error instanceof Error && /UNIQUE/.test(error.message)) {
      return fail("Camera code already exists in this zone", 409);
    }
    if (error instanceof Error && /FOREIGN KEY/.test(error.message)) {
      return fail("Zone not found", 404);
    }
    return parseJsonError(error);
  }
}
