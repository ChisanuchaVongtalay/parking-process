import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { cameraSlots } from "@/db/schema";
import { createId } from "@/lib/id";
import { rectToPoints } from "@/lib/geometry";
import type { CameraSlot, Point2D } from "@/types/domain";

function parsePoints(pointsJson: string): Point2D[] {
  return JSON.parse(pointsJson) as Point2D[];
}

function parseBbox(bboxJson: string) {
  return JSON.parse(bboxJson) as CameraSlot["bbox"];
}

function toDomain(row: typeof cameraSlots.$inferSelect): CameraSlot {
  return {
    id: row.id,
    cameraId: row.cameraId,
    logicalSlotId: row.logicalSlotId,
    slotCode: row.slotCode,
    vehicleType: row.vehicleType,
    shapeType: row.shapeType,
    points: parsePoints(row.pointsJson),
    bbox: parseBbox(row.bboxJson),
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listCameraSlots(cameraId: string): Promise<CameraSlot[]> {
  const rows = await db.query.cameraSlots.findMany({
    where: eq(cameraSlots.cameraId, cameraId),
    orderBy: (table, { asc }) => [asc(table.slotCode)],
  });
  return rows.map(toDomain);
}

export async function replaceCameraSlots(
  cameraId: string,
  slots: Array<{
    id?: string;
    logicalSlotId?: string | null;
    slotCode: string;
    vehicleType: "car" | "motorcycle";
    shapeType: "rect" | "polygon";
    points?: Point2D[];
    bbox: CameraSlot["bbox"];
    enabled: boolean;
  }>,
): Promise<CameraSlot[]> {
  const existing = await listCameraSlots(cameraId);
  const existingIds = new Set(existing.map((slot) => slot.id));
  const incomingIds = new Set(slots.map((slot) => slot.id).filter(Boolean));

  for (const prev of existingIds) {
    if (!incomingIds.has(prev)) {
      await db.delete(cameraSlots).where(and(eq(cameraSlots.cameraId, cameraId), eq(cameraSlots.id, prev)));
    }
  }

  const now = new Date();
  for (const slot of slots) {
    const points = slot.points?.length ? slot.points : rectToPoints(slot.bbox);
    if (slot.id && existingIds.has(slot.id)) {
      await db
        .update(cameraSlots)
        .set({
          logicalSlotId: slot.logicalSlotId ?? null,
          slotCode: slot.slotCode,
          vehicleType: slot.vehicleType,
          shapeType: slot.shapeType,
          pointsJson: JSON.stringify(points),
          bboxJson: JSON.stringify(slot.bbox),
          enabled: slot.enabled,
          updatedAt: now,
        })
        .where(and(eq(cameraSlots.cameraId, cameraId), eq(cameraSlots.id, slot.id)));
      continue;
    }

    await db.insert(cameraSlots).values({
      id: createId("cslot"),
      cameraId,
      logicalSlotId: slot.logicalSlotId ?? null,
      slotCode: slot.slotCode,
      vehicleType: slot.vehicleType,
      shapeType: slot.shapeType,
      pointsJson: JSON.stringify(points),
      bboxJson: JSON.stringify(slot.bbox),
      enabled: slot.enabled,
      createdAt: now,
      updatedAt: now,
    });
  }

  return listCameraSlots(cameraId);
}
