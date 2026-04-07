import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { calibrationProfiles } from "@/db/schema";
import { createId } from "@/lib/id";
import type { CalibrationProfile } from "@/types/domain";

const defaultProfile = {
  pixelThreshold: 0.15,
  occupancyThreshold: 0.08,
  grayscale: true,
  blurRadius: 1,
  normalize: true,
  downscale: 1,
  lightingCompensation: 0.7,
  edgeWeight: 1.5,
};

function fromRow(row: typeof calibrationProfiles.$inferSelect): CalibrationProfile {
  return {
    id: row.id,
    cameraId: row.cameraId,
    pixelThreshold: row.pixelThreshold / 100,
    occupancyThreshold: row.occupancyThreshold / 100,
    grayscale: row.grayscale,
    blurRadius: row.blurRadius,
    normalize: row.normalize,
    downscale: row.downscale / 1000,
    lightingCompensation: row.lightingCompensation / 1000,
    edgeWeight: row.edgeWeight / 1000,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDb(profile: Omit<CalibrationProfile, "id" | "cameraId" | "createdAt" | "updatedAt">) {
  return {
    pixelThreshold: Math.round(profile.pixelThreshold * 100),
    occupancyThreshold: Math.round(profile.occupancyThreshold * 100),
    grayscale: profile.grayscale,
    blurRadius: profile.blurRadius,
    normalize: profile.normalize,
    downscale: Math.round(profile.downscale * 1000),
    lightingCompensation: Math.round(profile.lightingCompensation * 1000),
    edgeWeight: Math.round(profile.edgeWeight * 1000),
  };
}

export async function getOrCreateCalibration(cameraId: string): Promise<CalibrationProfile> {
  const existing = await db.query.calibrationProfiles.findFirst({
    where: eq(calibrationProfiles.cameraId, cameraId),
  });

  if (existing) {
    return fromRow(existing);
  }

  const now = new Date();
  const id = createId("cal");
  await db.insert(calibrationProfiles).values({
    id,
    cameraId,
    ...toDb(defaultProfile),
    createdAt: now,
    updatedAt: now,
  });

  const created = await db.query.calibrationProfiles.findFirst({
    where: and(eq(calibrationProfiles.id, id), eq(calibrationProfiles.cameraId, cameraId)),
  });

  if (!created) {
    throw new Error("Calibration profile creation failed");
  }
  return fromRow(created);
}

export async function updateCalibration(
  cameraId: string,
  payload: Omit<CalibrationProfile, "id" | "cameraId" | "createdAt" | "updatedAt">,
): Promise<CalibrationProfile> {
  const current = await getOrCreateCalibration(cameraId);
  const now = new Date();

  await db
    .update(calibrationProfiles)
    .set({
      ...toDb(payload),
      updatedAt: now,
    })
    .where(eq(calibrationProfiles.id, current.id));

  return getOrCreateCalibration(cameraId);
}
