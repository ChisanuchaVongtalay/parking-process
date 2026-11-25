import { eq } from "drizzle-orm";

import { db } from "@/db";
import { cameras } from "@/db/schema";
import { queryRow } from "@/db/client";
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

  let effectiveCapturedAt = capturedAt;
  if (!snapshotPath && effectiveSnapshotPath === `snapshots/${cameraId}/latest.jpg`) {
    const status = await queryRow<{ last_success_at: number | null }>("SELECT last_success_at FROM snapshot_capture_status WHERE camera_id = ?", [cameraId]);
    const configuredAge = Number(process.env.SNAPSHOT_MAX_AGE_SECONDS || 900);
    const maxAge = Number.isFinite(configuredAge) && configuredAge > 0 ? configuredAge : 900;
    if (!status?.last_success_at || Date.now() - status.last_success_at > maxAge * 1000) {
      throw new Error("Latest snapshot is stale or has no capture timestamp");
    }
    effectiveCapturedAt = new Date(status.last_success_at);
  }

  const config = await loadCameraConfig(cameraId);
  const result = await processCameraSnapshot(config, effectiveSnapshotPath);
  const saved = await saveProcessingResult({
    cameraId,
    snapshotPath: effectiveSnapshotPath,
    result,
    capturedAt: effectiveCapturedAt,
  });

  return {
    observationId: saved.observationId,
    result,
  };
}
