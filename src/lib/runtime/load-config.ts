import fs from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { cameras, zones } from "@/db/schema";
import { getOrCreateCalibration } from "@/services/calibration";
import { listCameraSlots } from "@/services/camera-slots";
import { readDataFile, resolveDataPath } from "@/lib/storage";

const pointTupleSchema = z.tuple([z.number(), z.number()]);

const exportedCameraConfigSchema = z.object({
  id: z.string(),
  is_primary: z.boolean(),
  background_image: z.string().nullable(),
  calibration: z.object({
    pixel_threshold: z.number().min(0).max(1),
    occupancy_threshold: z.number().min(0).max(1),
    grayscale: z.boolean(),
    blur_radius: z.number().min(0),
    normalize: z.boolean(),
    downscale: z.number().min(0.1).max(1),
    lighting_compensation: z.number().min(0).max(2),
    edge_weight: z.number().min(0).max(5),
  }),
  slots: z.array(
    z.object({
      camera_slot_id: z.string(),
      logical_slot_id: z.string().nullable(),
      slot_code: z.string(),
      vehicle_type: z.enum(["car", "motorcycle"]),
      shape_type: z.enum(["rect", "polygon"]),
      points: z.array(pointTupleSchema).min(4),
    }),
  ),
});

const cameraExportSchema = z.object({
  version: z.number(),
  exported_at: z.string(),
  zone: z.object({
    id: z.string(),
    name: z.string(),
  }),
  cameras: z.array(exportedCameraConfigSchema).min(1),
  logical_slots: z.array(
    z.object({
      id: z.string(),
      slot_code: z.string(),
      vehicle_type: z.enum(["car", "motorcycle"]),
    }),
  ),
});

export type RuntimeCameraConfig = {
  version: number;
  exportedAt: string;
  zone: {
    id: string;
    name: string;
  };
  camera: {
    id: string;
    isPrimary: boolean;
    backgroundImagePath: string;
    backgroundAbsolutePath: string;
    calibration: {
      pixelThreshold: number;
      occupancyThreshold: number;
      grayscale: boolean;
      blurRadius: number;
      normalize: boolean;
      downscale: number;
      lightingCompensation: number;
      edgeWeight: number;
    };
    slots: Array<{
      cameraSlotId: string;
      logicalSlotId: string | null;
      slotCode: string;
      vehicleType: "car" | "motorcycle";
      shapeType: "rect" | "polygon";
      points: Array<{ x: number; y: number }>;
    }>;
  };
};

function toRuntimeConfig(doc: z.infer<typeof cameraExportSchema>, cameraId?: string): RuntimeCameraConfig {
  const selected = cameraId
    ? doc.cameras.find((camera) => camera.id === cameraId)
    : doc.cameras[0];

  if (!selected) {
    throw new Error(`Camera config not found in exported JSON${cameraId ? ` for ${cameraId}` : ""}`);
  }
  if (!selected.background_image) {
    throw new Error(`Background image is missing in config for camera ${selected.id}`);
  }

  return {
    version: doc.version,
    exportedAt: doc.exported_at,
    zone: {
      id: doc.zone.id,
      name: doc.zone.name,
    },
    camera: {
      id: selected.id,
      isPrimary: selected.is_primary,
      backgroundImagePath: selected.background_image,
      backgroundAbsolutePath: resolveDataPath(selected.background_image),
      calibration: {
        pixelThreshold: selected.calibration.pixel_threshold,
        occupancyThreshold: selected.calibration.occupancy_threshold,
        grayscale: selected.calibration.grayscale,
        blurRadius: selected.calibration.blur_radius,
        normalize: selected.calibration.normalize,
        downscale: selected.calibration.downscale,
        lightingCompensation: selected.calibration.lighting_compensation,
        edgeWeight: selected.calibration.edge_weight,
      },
      slots: selected.slots.map((slot) => ({
        cameraSlotId: slot.camera_slot_id,
        logicalSlotId: slot.logical_slot_id,
        slotCode: slot.slot_code,
        vehicleType: slot.vehicle_type,
        shapeType: slot.shape_type,
        points: slot.points.map(([x, y]) => ({ x, y })),
      })),
    },
  };
}

async function readExportFile(filePath: string): Promise<z.infer<typeof cameraExportSchema>> {
  const text = path.isAbsolute(filePath) ? await fs.readFile(filePath, "utf8") : (await readDataFile(filePath)).toString("utf8");
  const parsed = JSON.parse(text) as unknown;
  return cameraExportSchema.parse(parsed);
}

export async function loadCameraConfig(input: string): Promise<RuntimeCameraConfig> {
  const looksLikePath = input.includes("/") || input.includes("\\") || input.endsWith(".json");

  if (looksLikePath) {
    const doc = await readExportFile(input);
    return toRuntimeConfig(doc);
  }

  const camera = await db.query.cameras.findFirst({ where: eq(cameras.id, input) });
  if (!camera) throw new Error(`Camera not found: ${input}`);
  if (!camera.backgroundImagePath) throw new Error("Background image is missing");
  const zone = await db.query.zones.findFirst({ where: eq(zones.id, camera.zoneId) });
  if (!zone) throw new Error("Camera zone not found");
  const [calibration, slots] = await Promise.all([
    getOrCreateCalibration(camera.id), listCameraSlots(camera.id),
  ]);
  const enabledSlots = slots.filter((slot) => slot.enabled);
  if (!enabledSlots.length) throw new Error("No enabled parking slots configured");
  return {
    version: 1,
    exportedAt: camera.updatedAt.toISOString(),
    zone: { id: zone.id, name: zone.name },
    camera: {
      id: camera.id,
      isPrimary: camera.isPrimary,
      backgroundImagePath: camera.backgroundImagePath,
      backgroundAbsolutePath: resolveDataPath(camera.backgroundImagePath),
      calibration,
      slots: enabledSlots.map((slot) => ({
        cameraSlotId: slot.id, logicalSlotId: slot.logicalSlotId,
        slotCode: slot.slotCode, vehicleType: slot.vehicleType,
        shapeType: slot.shapeType, points: slot.points,
      })),
    },
  };
}
