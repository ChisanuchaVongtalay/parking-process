import { eq } from "drizzle-orm";

import { db } from "@/db";
import { cameras } from "@/db/schema";
import { resolveDataPath } from "@/lib/storage";
import { loadCameraConfig } from "./load-config";
import { processCameraSnapshot } from "./processor";
import { saveProcessingResult } from "./save-result";

export async function runRuntimeProcessing(args: {
  cameraId: string;
  snapshotPath?: string;
  capturedAt?: Date;
}) {
  const { cameraId, snapshotPath, capturedAt } = args;

  const camera = await db.query.cameras.findFirst({ where: eq(cameras.id, cameraId) });
  if (!camera) {
    throw new Error("Camera not found");
  }

  const effectiveSnapshotPath = snapshotPath ?? camera.latestSnapshotPath;
  if (!effectiveSnapshotPath) {
    throw new Error("Snapshot path not available");
  }

  const config = await loadCameraConfig(cameraId);
  const result = await processCameraSnapshot(config, resolveDataPath(effectiveSnapshotPath));
  const saved = await saveProcessingResult({
    cameraId,
    snapshotPath: effectiveSnapshotPath,
    result,
    capturedAt,
  });

  return {
    observationId: saved.observationId,
    result,
  };
}
