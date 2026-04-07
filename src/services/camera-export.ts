import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { cameras, configExports, logicalSlots, zones } from "@/db/schema";
import { pointsToTuples } from "@/lib/geometry";
import { createId } from "@/lib/id";
import { saveExportJson } from "@/lib/storage";
import type { CameraExportDocument } from "@/types/export-schema";
import { getOrCreateCalibration } from "./calibration";
import { listCameraSlots } from "./camera-slots";

export async function exportCameraConfig(cameraId: string): Promise<{
  doc: CameraExportDocument;
  exportPath: string;
  checksum: string;
}> {
  const camera = await db.query.cameras.findFirst({ where: eq(cameras.id, cameraId) });
  if (!camera) {
    throw new Error("Camera not found");
  }

  const zone = await db.query.zones.findFirst({ where: eq(zones.id, camera.zoneId) });
  if (!zone) {
    throw new Error("Zone not found");
  }

  const slots = await listCameraSlots(cameraId);
  const calibration = await getOrCreateCalibration(cameraId);
  const zoneLogicalSlots = await db.query.logicalSlots.findMany({
    where: and(eq(logicalSlots.zoneId, zone.id), eq(logicalSlots.isActive, true)),
  });

  const doc: CameraExportDocument = {
    version: 1,
    exported_at: new Date().toISOString(),
    zone: {
      id: zone.id,
      name: zone.name,
    },
    cameras: [
      {
        id: camera.id,
        is_primary: camera.isPrimary,
        background_image: camera.backgroundImagePath,
        calibration: {
          pixel_threshold: calibration.pixelThreshold,
          occupancy_threshold: calibration.occupancyThreshold,
          grayscale: calibration.grayscale,
          blur_radius: calibration.blurRadius,
          normalize: calibration.normalize,
          downscale: calibration.downscale,
          lighting_compensation: calibration.lightingCompensation,
          edge_weight: calibration.edgeWeight,
        },
        slots: slots.map((slot) => ({
          camera_slot_id: slot.id,
          logical_slot_id: slot.logicalSlotId,
          slot_code: slot.slotCode,
          vehicle_type: slot.vehicleType,
          shape_type: slot.shapeType,
          points: pointsToTuples(slot.points),
        })),
      },
    ],
    logical_slots: zoneLogicalSlots.map((slot) => ({
      id: slot.id,
      slot_code: slot.slotCode,
      vehicle_type: slot.vehicleType,
    })),
  };

  const saved = await saveExportJson({
    cameraId,
    version: doc.version,
    payload: doc,
  });

  await db.insert(configExports).values({
    id: createId("exp"),
    cameraId: camera.id,
    zoneId: camera.zoneId,
    version: doc.version,
    exportPath: saved.relativePath,
    checksum: saved.checksum,
    createdAt: new Date(),
  });

  return {
    doc,
    exportPath: saved.relativePath,
    checksum: saved.checksum,
  };
}
