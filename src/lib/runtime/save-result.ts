import path from "node:path";

import { db } from "@/db";
import { cameraObservations, slotObservations } from "@/db/schema";
import { createId } from "@/lib/id";
import type { RuntimeProcessResult } from "./processor";

export async function saveProcessingResult(args: {
  cameraId: string;
  snapshotPath: string;
  result: RuntimeProcessResult;
  capturedAt?: Date;
}) {
  const { cameraId, snapshotPath, result, capturedAt = new Date() } = args;
  const createdAt = new Date();

  const observationId = createId("obs");
  const relativeSnapshot = path.isAbsolute(snapshotPath)
    ? snapshotPath.replace(process.cwd(), "").replace(/^[\\/]+/, "")
    : snapshotPath;

  db.transaction((tx) => {
    tx.insert(cameraObservations).values({
      id: observationId,
      cameraId,
      snapshotPath: relativeSnapshot,
      occupiedCount: result.summary.occupied,
      freeCount: result.summary.free,
      totalCount: result.summary.total,
      capturedAt,
      createdAt,
    }).run();

    if (result.slots.length) {
      tx.insert(slotObservations).values(
        result.slots.map((slot) => ({
          id: createId("sobs"),
          observationId,
          cameraSlotId: slot.cameraSlotId,
          score: Math.round(slot.score * 10000),
          occupied: slot.occupied,
          createdAt,
        })),
      ).run();
    }
  });

  return {
    observationId,
  };
}
