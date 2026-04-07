import fs from "node:fs/promises";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { calibrationRuns, cameras } from "@/db/schema";
import { fail, ok, parseJsonError } from "@/lib/http";
import { createId } from "@/lib/id";
import { resolveDataPath, saveUploadedFile } from "@/lib/storage";
import { calibrationUpdateSchema, slotBulkSchema } from "@/lib/validation";
import { getOrCreateCalibration } from "@/services/calibration";
import { listCameraSlots } from "@/services/camera-slots";
import { analyzeCameraSnapshot } from "@/services/processing-engine";
import type { CameraSlot } from "@/types/domain";

function parseOptionalJsonField<T>(field: FormDataEntryValue | null, label: string): T | null {
  if (typeof field !== "string" || !field.trim()) return null;
  try {
    return JSON.parse(field) as T;
  } catch {
    throw new Error(`Invalid JSON in ${label}`);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const camera = await db.query.cameras.findFirst({ where: eq(cameras.id, id) });
    if (!camera) return fail("Camera not found", 404);
    if (!camera.backgroundImagePath) return fail("Background image not uploaded", 400);

    const formData = await request.formData();
    const uploaded = formData.get("file");
    const slotsRaw = parseOptionalJsonField<unknown>(formData.get("slots"), "slots");
    const calibrationRaw = parseOptionalJsonField<unknown>(
      formData.get("calibration"),
      "calibration",
    );

    let snapshotPath = camera.latestSnapshotPath;
    if (uploaded instanceof File) {
      const saved = await saveUploadedFile({ file: uploaded, kind: "snapshot", cameraId: id });
      snapshotPath = saved.relativePath;
      await db
        .update(cameras)
        .set({ latestSnapshotPath: snapshotPath, updatedAt: new Date() })
        .where(eq(cameras.id, id));
    }

    if (!snapshotPath) return fail("Snapshot not available", 400);

    const [backgroundBuffer, snapshotBuffer, calibrationFromDb, slotsFromDb] = await Promise.all([
      fs.readFile(resolveDataPath(camera.backgroundImagePath)),
      fs.readFile(resolveDataPath(snapshotPath)),
      getOrCreateCalibration(id),
      listCameraSlots(id),
    ]);

    const calibration = calibrationRaw
      ? calibrationUpdateSchema.parse(calibrationRaw)
      : calibrationFromDb;

    const slots = slotsRaw
      ? slotBulkSchema.parse(slotsRaw).slots.map((slot): CameraSlot => {
          const now = new Date();
          return {
            id: slot.id ?? `tmp-${slot.slotCode}`,
            cameraId: id,
            logicalSlotId: slot.logicalSlotId ?? null,
            slotCode: slot.slotCode,
            vehicleType: slot.vehicleType,
            shapeType: slot.shapeType,
            points: slot.points,
            bbox: slot.bbox,
            enabled: slot.enabled,
            createdAt: now,
            updatedAt: now,
          };
        })
      : slotsFromDb;

    const result = await analyzeCameraSnapshot({
      cameraId: id,
      backgroundBuffer,
      snapshotBuffer,
      slots: slots.filter((slot) => slot.enabled),
      calibration,
    });

    await db.insert(calibrationRuns).values({
      id: createId("run"),
      cameraId: id,
      snapshotPath,
      paramsJson: JSON.stringify(calibration),
      resultJson: JSON.stringify(result),
      createdAt: new Date(),
    });

    return ok(result, 201);
  } catch (error) {
    return parseJsonError(error);
  }
}
